import {
  PDFDocument,
  StandardFonts,
  rgb,
  degrees,
  PageSizes,
} from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import {
  DocumentImportItem,
  ImageItem,
  ImageQualityOption,
  MarginOption,
  PageSizeOption,
  PdfCreationSettings,
} from '../types/pdf';
import { processImageDataUrl } from './imageProcessor';

// Configure pdf.js worker locally for offline Vite bundling
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

const MM_TO_PT = 2.83464567;

function hexToRgbColor(hex: string) {
  const clean = hex.replace('#', '');
  const num = parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16);
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;
  return rgb(isNaN(r) ? 1 : r, isNaN(g) ? 1 : g, isNaN(b) ? 1 : b);
}

function getPageDimensionsPt(
  pageSize: PageSizeOption,
  customW: number,
  customH: number
): [number, number] {
  switch (pageSize) {
    case 'A3':
      return PageSizes.A3;
    case 'A5':
      return PageSizes.A5;
    case 'Letter':
      return PageSizes.Letter;
    case 'Legal':
      return PageSizes.Legal;
    case 'Custom':
      return [
        Math.max(100, customW * MM_TO_PT),
        Math.max(100, customH * MM_TO_PT),
      ];
    case 'A4':
    default:
      return PageSizes.A4;
  }
}

function getMarginPt(margin: MarginOption, customMm: number): number {
  switch (margin) {
    case 'none':
      return 0;
    case 'small':
      return 10 * MM_TO_PT;
    case 'medium':
      return 20 * MM_TO_PT;
    case 'large':
      return 32 * MM_TO_PT;
    case 'custom':
      return Math.max(0, customMm * MM_TO_PT);
  }
}

function qualityToParams(q: ImageQualityOption): { maxDim: number; jpegQuality: number } {
  switch (q) {
    case 'low':
      return { maxDim: 960, jpegQuality: 0.55 };
    case 'medium':
      return { maxDim: 1440, jpegQuality: 0.74 };
    case 'high':
      return { maxDim: 2048, jpegQuality: 0.88 };
    case 'ultra':
      return { maxDim: 3200, jpegQuality: 0.96 };
  }
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] || '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function sanitizePdfText(text: string): string {
  // pdf-lib StandardFonts use WinAnsi encoding; replace unsupported characters safely
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2022/g, '*')
    .replace(/[^\x20-\x7E\xA0-\xFF\n\r\t]/g, ' ');
}

function wrapTextLines(text: string, maxChars: number): string[] {
  const result: string[] = [];
  const paragraphs = text.split(/\r?\n/);
  for (const para of paragraphs) {
    if (!para.trim()) {
      result.push('');
      continue;
    }
    const words = para.split(/\s+/);
    let current = '';
    for (const word of words) {
      if ((current + ' ' + word).trim().length <= maxChars) {
        current = (current + ' ' + word).trim();
      } else {
        if (current) result.push(current);
        current = word.length > maxChars ? word.slice(0, maxChars) : word;
      }
    }
    if (current) result.push(current);
  }
  return result;
}

/**
 * Generates a JPEG thumbnail of page 1 of a PDF and returns pageCount.
 */
export async function generateThumbnailFromPdf(
  bytes: ArrayBuffer | Uint8Array
): Promise<{ thumbnailDataUrl: string; pageCount: number }> {
  const dataCopy = new Uint8Array(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)).slice();
  const loadingTask = pdfjsLib.getDocument({ data: dataCopy });
  const pdf = await loadingTask.promise;
  const pageCount = pdf.numPages;

  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 0.45 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(viewport.width));
  canvas.height = Math.max(1, Math.round(viewport.height));
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  }
  const thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.8);
  await pdf.cleanup();
  return { thumbnailDataUrl, pageCount };
}

/**
 * Renders thumbnails for every page in a PDF (for Split, Rotate, Reorder, Extract, Viewer).
 */
export async function renderPdfPageThumbnails(
  bytes: ArrayBuffer | Uint8Array,
  scale = 0.35,
  onProgress?: (pct: number) => void
): Promise<string[]> {
  const dataCopy = new Uint8Array(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)).slice();
  const pdf = await pdfjsLib.getDocument({ data: dataCopy }).promise;
  const thumbs: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    }
    thumbs.push(canvas.toDataURL('image/jpeg', 0.78));
    onProgress?.(Math.round((i / pdf.numPages) * 100));
  }

  await pdf.cleanup();
  return thumbs;
}

/**
 * Applies header, footer, page numbers, date/time, and watermark to all pages of a PDFDocument.
 */
async function applyDecorationsAndMetadata(
  pdfDoc: PDFDocument,
  settings: PdfCreationSettings
) {
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();
  const total = pages.length;
  const dateStr = new Date().toLocaleString();

  if (settings.fileName) pdfDoc.setTitle(sanitizePdfText(settings.fileName));
  if (settings.author) pdfDoc.setAuthor(sanitizePdfText(settings.author));
  if (settings.subject) pdfDoc.setSubject(sanitizePdfText(settings.subject));
  if (settings.keywords) {
    pdfDoc.setKeywords(
      settings.keywords
        .split(',')
        .map((k) => sanitizePdfText(k.trim()))
        .filter(Boolean)
    );
  }
  pdfDoc.setCreator('PDF Maker');

  for (let i = 0; i < total; i++) {
    const page = pages[i];
    const { width, height } = page.getSize();

    if (settings.headerText.trim()) {
      page.drawText(sanitizePdfText(settings.headerText.trim()), {
        x: 24,
        y: height - 20,
        size: 9,
        font,
        color: rgb(0.42, 0.44, 0.48),
      });
    }

    if (settings.includeDateTime) {
      const dt = sanitizePdfText(dateStr);
      const dtW = font.widthOfTextAtSize(dt, 8.5);
      page.drawText(dt, {
        x: width - dtW - 24,
        y: height - 20,
        size: 8.5,
        font,
        color: rgb(0.48, 0.5, 0.54),
      });
    }

    if (settings.footerText.trim()) {
      page.drawText(sanitizePdfText(settings.footerText.trim()), {
        x: 24,
        y: 14,
        size: 9,
        font,
        color: rgb(0.42, 0.44, 0.48),
      });
    }

    if (settings.showPageNumbers) {
      const numText = `Page ${i + 1} of ${total}`;
      const numW = font.widthOfTextAtSize(numText, 9);
      page.drawText(numText, {
        x: settings.footerText.trim() ? width - numW - 24 : (width - numW) / 2,
        y: 14,
        size: 9,
        font,
        color: rgb(0.4, 0.42, 0.46),
      });
    }

    if (settings.watermarkText.trim()) {
      const wm = sanitizePdfText(settings.watermarkText.trim());
      const wmSize = Math.max(24, Math.min(54, Math.round(width / 12)));
      const wmWidth = boldFont.widthOfTextAtSize(wm, wmSize);
      page.drawText(wm, {
        x: width / 2 - wmWidth / 2.6,
        y: height / 2 - wmSize / 2,
        size: wmSize,
        font: boldFont,
        color: rgb(0.82, 0.08, 0.14),
        opacity: Math.max(0.05, Math.min(0.8, settings.watermarkOpacity)),
        rotate: degrees(38),
      });
    }
  }
}

/**
 * Create a PDF from an ordered list of ImageItem objects with full layout and settings support.
 */
export async function createPdfFromImages(
  images: ImageItem[],
  settings: PdfCreationSettings,
  onProgress?: (pct: number) => void
): Promise<{ bytes: Uint8Array; pageCount: number; thumbnailDataUrl: string }> {
  const pdfDoc = await PDFDocument.create();
  const [baseW, baseH] = getPageDimensionsPt(
    settings.pageSize,
    settings.customWidthMm,
    settings.customHeightMm
  );
  const margin = getMarginPt(settings.margins, settings.customMarginMm);
  const bgColor = hexToRgbColor(settings.backgroundColor || '#FFFFFF');
  const qParams = qualityToParams(settings.imageQuality);

  let cols = 1;
  let rows = 1;
  if (settings.pageLayout === '2') {
    cols = 1;
    rows = 2;
  } else if (settings.pageLayout === '4') {
    cols = 2;
    rows = 2;
  } else if (settings.pageLayout === 'custom') {
    cols = Math.max(1, Math.min(4, settings.customCols));
    rows = Math.max(1, Math.min(4, settings.customRows));
  }
  const perPage = cols * rows;

  const totalImages = images.length;
  for (let start = 0; start < totalImages; start += perPage) {
    const chunk = images.slice(start, start + perPage);
    const firstImg = chunk[0];

    // Determine page orientation
    let pageW = baseW;
    let pageH = baseH;
    if (settings.orientation === 'landscape') {
      pageW = Math.max(baseW, baseH);
      pageH = Math.min(baseW, baseH);
    } else if (settings.orientation === 'portrait') {
      pageW = Math.min(baseW, baseH);
      pageH = Math.max(baseW, baseH);
    } else if (settings.orientation === 'auto' && perPage === 1) {
      const isRot = firstImg.rotation === 90 || firstImg.rotation === 270;
      const effW = isRot ? firstImg.height : firstImg.width;
      const effH = isRot ? firstImg.width : firstImg.height;
      if (effW > effH) {
        pageW = Math.max(baseW, baseH);
        pageH = Math.min(baseW, baseH);
      } else {
        pageW = Math.min(baseW, baseH);
        pageH = Math.max(baseW, baseH);
      }
    }

    const page = pdfDoc.addPage([pageW, pageH]);
    page.drawRectangle({
      x: 0,
      y: 0,
      width: pageW,
      height: pageH,
      color: bgColor,
    });

    const topExtra = settings.headerText.trim() || settings.includeDateTime ? 26 : 0;
    const bottomExtra = settings.footerText.trim() || settings.showPageNumbers ? 26 : 0;
    const availW = Math.max(40, pageW - margin * 2);
    const availH = Math.max(40, pageH - margin * 2 - topExtra - bottomExtra);
    const gap = perPage > 1 ? 12 : 0;
    const cellW = (availW - gap * (cols - 1)) / cols;
    const cellH = (availH - gap * (rows - 1)) / rows;

    for (let idx = 0; idx < chunk.length; idx++) {
      const item = chunk[idx];
      const processed = await processImageDataUrl(item.originalDataUrl, {
        rotation: item.rotation,
        crop: item.crop,
        filter: item.filter,
        brightness: item.brightness,
        contrast: item.contrast,
        removeShadows: item.removeShadows,
        maxDimension: qParams.maxDim,
        jpegQuality: qParams.jpegQuality,
      });

      const imgBytes = dataUrlToUint8Array(processed.dataUrl);
      const embedded = await pdfDoc.embedJpg(imgBytes);
      const imgRatio = embedded.width / embedded.height;
      const cellRatio = cellW / cellH;

      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const cellX = margin + col * (cellW + gap);
      const cellY = pageH - margin - topExtra - (row + 1) * cellH - row * gap;

      let drawW = cellW;
      let drawH = cellH;

      if (settings.imageFit === 'fit') {
        if (imgRatio > cellRatio) {
          drawW = cellW;
          drawH = cellW / imgRatio;
        } else {
          drawH = cellH;
          drawW = cellH * imgRatio;
        }
      } else if (settings.imageFit === 'fill') {
        // Fill cell cleanly
        drawW = cellW;
        drawH = cellH;
      } else {
        // Original size clamped to cell
        const ptW = embedded.width * 0.75;
        const ptH = embedded.height * 0.75;
        const scaleDown = Math.min(1, cellW / ptW, cellH / ptH);
        drawW = ptW * scaleDown;
        drawH = ptH * scaleDown;
      }

      const drawX = cellX + (cellW - drawW) / 2;
      const drawY = cellY + (cellH - drawH) / 2;

      page.drawImage(embedded, {
        x: drawX,
        y: drawY,
        width: drawW,
        height: drawH,
      });

      onProgress?.(Math.min(88, Math.round(((start + idx + 1) / totalImages) * 85)));
    }
  }

  await applyDecorationsAndMetadata(pdfDoc, settings);
  onProgress?.(94);
  const bytes = await pdfDoc.save();
  const { thumbnailDataUrl, pageCount } = await generateThumbnailFromPdf(bytes);
  onProgress?.(100);

  return { bytes, pageCount, thumbnailDataUrl };
}

/**
 * Extracts slides text from a PPTX zip file locally.
 */
async function extractPptxSlides(arrayBuffer: ArrayBuffer): Promise<string[][]> {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)\.xml/)?.[1] || '0', 10);
      const nb = parseInt(b.match(/slide(\d+)\.xml/)?.[1] || '0', 10);
      return na - nb;
    });

  const slides: string[][] = [];
  for (const path of slideFiles) {
    const xml = await zip.files[path].async('string');
    const matches = Array.from(xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)).map((m) =>
      m[1]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
    );
    slides.push(matches.length > 0 ? matches : ['(Slide without text content)']);
  }
  return slides;
}

/**
 * Converts multiple imported documents (DOCX, DOC, XLSX, XLS, PPTX, PPT, TXT, PDF, JPG, PNG) into one PDF.
 */
export async function convertDocumentsToPdf(
  docs: DocumentImportItem[],
  settings: PdfCreationSettings,
  onProgress?: (pct: number) => void
): Promise<{ bytes: Uint8Array; pageCount: number; thumbnailDataUrl: string }> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const [baseW, baseH] = getPageDimensionsPt(
    settings.pageSize,
    settings.customWidthMm,
    settings.customHeightMm
  );
  const pageW = settings.orientation === 'landscape' ? Math.max(baseW, baseH) : Math.min(baseW, baseH);
  const pageH = settings.orientation === 'landscape' ? Math.min(baseW, baseH) : Math.max(baseW, baseH);
  const margin = Math.max(24, getMarginPt(settings.margins, settings.customMarginMm));
  const bgColor = hexToRgbColor(settings.backgroundColor || '#FFFFFF');

  const addTextPages = (title: string, bodyText: string) => {
    const cleanBody = sanitizePdfText(bodyText);
    const fontSize = 11;
    const lineH = 16;
    const usableW = pageW - margin * 2;
    const maxChars = Math.max(35, Math.floor(usableW / 6.2));
    const lines = wrapTextLines(cleanBody, maxChars);

    let page = pdfDoc.addPage([pageW, pageH]);
    page.drawRectangle({ x: 0, y: 0, width: pageW, height: pageH, color: bgColor });
    let y = pageH - margin - 24;

    // Document title banner
    page.drawText(sanitizePdfText(title), {
      x: margin,
      y,
      size: 16,
      font: boldFont,
      color: rgb(0.12, 0.13, 0.14),
    });
    y -= 10;
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageW - margin, y },
      thickness: 1,
      color: rgb(0.9, 0.04, 0.13),
    });
    y -= 24;

    for (const line of lines) {
      if (y < margin + 32) {
        page = pdfDoc.addPage([pageW, pageH]);
        page.drawRectangle({ x: 0, y: 0, width: pageW, height: pageH, color: bgColor });
        y = pageH - margin - 24;
      }
      if (line) {
        page.drawText(line, {
          x: margin,
          y,
          size: fontSize,
          font,
          color: rgb(0.16, 0.17, 0.19),
        });
      }
      y -= lineH;
    }
  };

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    const ext = doc.extension.toLowerCase();
    const buf = await doc.file.arrayBuffer();

    if (ext === 'pdf') {
      const srcPdf = await PDFDocument.load(buf, { ignoreEncryption: true });
      const copied = await pdfDoc.copyPages(srcPdf, srcPdf.getPageIndices());
      copied.forEach((p) => pdfDoc.addPage(p));
    } else if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
      const dataUrl = await new Promise<string>((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result));
        fr.onerror = () => rej(fr.error);
        fr.readAsDataURL(doc.file);
      });
      const processed = await processImageDataUrl(dataUrl, {
        rotation: 0,
        filter: 'color',
        brightness: 0,
        contrast: 0,
        removeShadows: false,
      });
      const embedded = await pdfDoc.embedJpg(dataUrlToUint8Array(processed.dataUrl));
      const page = pdfDoc.addPage([pageW, pageH]);
      page.drawRectangle({ x: 0, y: 0, width: pageW, height: pageH, color: bgColor });
      const availW = pageW - margin * 2;
      const availH = pageH - margin * 2 - 40;
      const ratio = Math.min(availW / embedded.width, availH / embedded.height);
      const dw = embedded.width * ratio;
      const dh = embedded.height * ratio;
      page.drawImage(embedded, {
        x: (pageW - dw) / 2,
        y: (pageH - dh) / 2,
        width: dw,
        height: dh,
      });
    } else if (ext === 'docx') {
      const result = await mammoth.extractRawText({ arrayBuffer: buf });
      addTextPages(doc.name, result.value || '(Empty Word document)');
    } else if (ext === 'xls' || ext === 'xlsx' || ext === 'csv') {
      const workbook = XLSX.read(buf, { type: 'array' });
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
        let page = pdfDoc.addPage([pageW, pageH]);
        page.drawRectangle({ x: 0, y: 0, width: pageW, height: pageH, color: bgColor });
        let y = pageH - margin - 20;

        page.drawText(sanitizePdfText(`${doc.name} — ${sheetName}`), {
          x: margin,
          y,
          size: 14,
          font: boldFont,
          color: rgb(0.12, 0.13, 0.14),
        });
        y -= 24;

        const maxCols = Math.min(8, Math.max(1, ...rows.map((r) => (Array.isArray(r) ? r.length : 0))));
        const colW = (pageW - margin * 2) / maxCols;
        const rowH = 20;

        for (let rIdx = 0; rIdx < rows.length; rIdx++) {
          const row = rows[rIdx] || [];
          if (y < margin + 32) {
            page = pdfDoc.addPage([pageW, pageH]);
            page.drawRectangle({ x: 0, y: 0, width: pageW, height: pageH, color: bgColor });
            y = pageH - margin - 20;
          }

          if (rIdx === 0) {
            page.drawRectangle({
              x: margin,
              y: y - 5,
              width: pageW - margin * 2,
              height: rowH,
              color: rgb(0.95, 0.95, 0.97),
            });
          }

          for (let c = 0; c < maxCols; c++) {
            const cellText = sanitizePdfText(String(row[c] ?? '')).slice(0, Math.max(6, Math.floor(colW / 5.5)));
            page.drawText(cellText, {
              x: margin + c * colW + 4,
              y,
              size: 9,
              font: rIdx === 0 ? boldFont : font,
              color: rgb(0.15, 0.16, 0.18),
            });
          }
          page.drawLine({
            start: { x: margin, y: y - 5 },
            end: { x: pageW - margin, y: y - 5 },
            thickness: 0.4,
            color: rgb(0.86, 0.87, 0.89),
          });
          y -= rowH;
        }
      }
    } else if (ext === 'pptx') {
      const slides = await extractPptxSlides(buf);
      const slideW = Math.max(baseW, baseH);
      const slideH = Math.min(baseW, baseH);
      for (let s = 0; s < slides.length; s++) {
        const page = pdfDoc.addPage([slideW, slideH]);
        page.drawRectangle({ x: 0, y: 0, width: slideW, height: slideH, color: bgColor });
        page.drawRectangle({ x: 0, y: slideH - 12, width: slideW, height: 12, color: rgb(0.9, 0.04, 0.13) });

        const texts = slides[s];
        const heading = sanitizePdfText(texts[0] || `Slide ${s + 1}`);
        page.drawText(heading.slice(0, 72), {
          x: margin,
          y: slideH - 64,
          size: 20,
          font: boldFont,
          color: rgb(0.12, 0.13, 0.14),
        });

        let y = slideH - 104;
        const bodyLines = wrapTextLines(sanitizePdfText(texts.slice(1).join('\n')), 82);
        for (const line of bodyLines) {
          if (y < margin + 28) break;
          page.drawText(line, {
            x: margin,
            y,
            size: 13,
            font,
            color: rgb(0.24, 0.25, 0.28),
          });
          y -= 20;
        }
      }
    } else {
      // TXT, DOC, PPT fallback plain-text extraction
      const decoder = new TextDecoder('utf-8', { fatal: false });
      const raw = decoder.decode(buf).replace(/[^\x09\x0A\x0D\x20-\x7E]/g, ' ');
      addTextPages(doc.name, raw.trim() || `Converted document: ${doc.name}`);
    }

    onProgress?.(Math.min(86, Math.round(((i + 1) / docs.length) * 84)));
  }

  if (pdfDoc.getPageCount() === 0) {
    pdfDoc.addPage([pageW, pageH]);
  }

  await applyDecorationsAndMetadata(pdfDoc, settings);
  onProgress?.(94);
  const bytes = await pdfDoc.save();
  const { thumbnailDataUrl, pageCount } = await generateThumbnailFromPdf(bytes);
  onProgress?.(100);
  return { bytes, pageCount, thumbnailDataUrl };
}

/**
 * Merge multiple PDFs with optional per-file page selections (1-indexed page numbers).
 */
export async function mergePdfs(
  items: { data: ArrayBuffer; pageIndices?: number[] }[],
  onProgress?: (pct: number) => void
): Promise<{ bytes: Uint8Array; pageCount: number; thumbnailDataUrl: string }> {
  const merged = await PDFDocument.create();
  for (let i = 0; i < items.length; i++) {
    const src = await PDFDocument.load(items[i].data, { ignoreEncryption: true });
    const indices =
      items[i].pageIndices && items[i].pageIndices!.length > 0
        ? items[i].pageIndices!.filter((p) => p >= 0 && p < src.getPageCount())
        : src.getPageIndices();
    const copied = await merged.copyPages(src, indices);
    copied.forEach((p) => merged.addPage(p));
    onProgress?.(Math.round(((i + 1) / items.length) * 85));
  }
  const bytes = await merged.save();
  const { thumbnailDataUrl, pageCount } = await generateThumbnailFromPdf(bytes);
  onProgress?.(100);
  return { bytes, pageCount, thumbnailDataUrl };
}

/**
 * Split a PDF into multiple output PDFs by mode: 'individual' | 'ranges' | 'fixed'.
 */
export async function splitPdf(
  data: ArrayBuffer,
  mode: 'individual' | 'ranges' | 'fixed',
  options: { rangesText?: string; groupSize?: number },
  onProgress?: (pct: number) => void
): Promise<{ nameSuffix: string; bytes: Uint8Array; pageCount: number; thumbnailDataUrl: string }[]> {
  const src = await PDFDocument.load(data, { ignoreEncryption: true });
  const total = src.getPageCount();
  const groups: { label: string; indices: number[] }[] = [];

  if (mode === 'individual') {
    for (let i = 0; i < total; i++) {
      groups.push({ label: `Page ${i + 1}`, indices: [i] });
    }
  } else if (mode === 'fixed') {
    const size = Math.max(1, options.groupSize || 2);
    for (let i = 0; i < total; i += size) {
      const end = Math.min(total, i + size);
      const indices: number[] = [];
      for (let p = i; p < end; p++) indices.push(p);
      groups.push({ label: `Pages ${i + 1}-${end}`, indices });
    }
  } else {
    // Parse ranges like "1-3, 4, 5-7"
    const parts = (options.rangesText || '1').split(',').map((s) => s.trim()).filter(Boolean);
    for (const part of parts) {
      if (part.includes('-')) {
        const [aStr, bStr] = part.split('-');
        const a = Math.max(1, Math.min(total, parseInt(aStr, 10) || 1));
        const b = Math.max(a, Math.min(total, parseInt(bStr, 10) || total));
        const indices: number[] = [];
        for (let p = a - 1; p <= b - 1; p++) indices.push(p);
        groups.push({ label: `Pages ${a}-${b}`, indices });
      } else {
        const p = Math.max(1, Math.min(total, parseInt(part, 10) || 1));
        groups.push({ label: `Page ${p}`, indices: [p - 1] });
      }
    }
  }

  const results: { nameSuffix: string; bytes: Uint8Array; pageCount: number; thumbnailDataUrl: string }[] = [];
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    const out = await PDFDocument.create();
    const copied = await out.copyPages(src, g.indices);
    copied.forEach((p) => out.addPage(p));
    const bytes = await out.save();
    const { thumbnailDataUrl, pageCount } = await generateThumbnailFromPdf(bytes);
    results.push({ nameSuffix: g.label, bytes, pageCount, thumbnailDataUrl });
    onProgress?.(Math.round(((i + 1) / groups.length) * 100));
  }
  return results;
}

/**
 * Compress a PDF by re-rendering pages at tuned DPI and JPEG quality.
 */
export async function compressPdf(
  data: ArrayBuffer,
  level: 'low' | 'recommended' | 'high',
  onProgress?: (pct: number) => void
): Promise<{ bytes: Uint8Array; pageCount: number; thumbnailDataUrl: string }> {
  const settings =
    level === 'low'
      ? { scale: 1.5, quality: 0.84 }
      : level === 'recommended'
      ? { scale: 1.15, quality: 0.62 }
      : { scale: 0.85, quality: 0.38 };

  const copy = new Uint8Array(data).slice();
  const srcPdf = await pdfjsLib.getDocument({ data: copy }).promise;
  const outDoc = await PDFDocument.create();

  for (let i = 1; i <= srcPdf.numPages; i++) {
    const page = await srcPdf.getPage(i);
    const origViewport = page.getViewport({ scale: 1 });
    const renderViewport = page.getViewport({ scale: settings.scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(renderViewport.width));
    canvas.height = Math.max(1, Math.round(renderViewport.height));
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: renderViewport, canvas }).promise;

    const jpgUrl = canvas.toDataURL('image/jpeg', settings.quality);
    const embedded = await outDoc.embedJpg(dataUrlToUint8Array(jpgUrl));
    const outPage = outDoc.addPage([origViewport.width, origViewport.height]);
    outPage.drawImage(embedded, {
      x: 0,
      y: 0,
      width: origViewport.width,
      height: origViewport.height,
    });

    onProgress?.(Math.round((i / srcPdf.numPages) * 90));
  }

  await srcPdf.cleanup();
  const bytes = await outDoc.save({ useObjectStreams: true });
  const { thumbnailDataUrl, pageCount } = await generateThumbnailFromPdf(bytes);
  onProgress?.(100);
  return { bytes, pageCount, thumbnailDataUrl };
}

/**
 * Rotate individual pages by angle offsets (0, 90, 180, 270).
 */
export async function rotatePdf(
  data: ArrayBuffer,
  rotationsByPageIndex: Record<number, number>,
  onProgress?: (pct: number) => void
): Promise<{ bytes: Uint8Array; pageCount: number; thumbnailDataUrl: string }> {
  const doc = await PDFDocument.load(data, { ignoreEncryption: true });
  const pages = doc.getPages();
  pages.forEach((page, idx) => {
    const delta = rotationsByPageIndex[idx] || 0;
    if (delta !== 0) {
      const current = page.getRotation().angle;
      page.setRotation(degrees((current + delta) % 360));
    }
  });
  onProgress?.(75);
  const bytes = await doc.save();
  const { thumbnailDataUrl, pageCount } = await generateThumbnailFromPdf(bytes);
  onProgress?.(100);
  return { bytes, pageCount, thumbnailDataUrl };
}

/**
 * Extract or reorder pages according to pageOrder (0-indexed).
 */
export async function reorderOrExtractPages(
  data: ArrayBuffer,
  pageOrder: number[],
  onProgress?: (pct: number) => void
): Promise<{ bytes: Uint8Array; pageCount: number; thumbnailDataUrl: string }> {
  const src = await PDFDocument.load(data, { ignoreEncryption: true });
  const out = await PDFDocument.create();
  const validOrder = pageOrder.filter((i) => i >= 0 && i < src.getPageCount());
  const copied = await out.copyPages(src, validOrder);
  copied.forEach((p) => out.addPage(p));
  onProgress?.(80);
  const bytes = await out.save();
  const { thumbnailDataUrl, pageCount } = await generateThumbnailFromPdf(bytes);
  onProgress?.(100);
  return { bytes, pageCount, thumbnailDataUrl };
}

export type WatermarkPosition =
  | 'center'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'tile';

export interface WatermarkConfig {
  type: 'text' | 'image';
  text: string;
  imageDataUrl?: string;
  opacity: number;
  size: number; // font size or image width %
  position: WatermarkPosition;
  rotation: number;
  color: string;
}

/**
 * Add text or image watermark to all pages of a PDF.
 */
export async function watermarkPdf(
  data: ArrayBuffer,
  config: WatermarkConfig,
  onProgress?: (pct: number) => void
): Promise<{ bytes: Uint8Array; pageCount: number; thumbnailDataUrl: string }> {
  const doc = await PDFDocument.load(data, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const pages = doc.getPages();

  let embeddedImg: Awaited<ReturnType<PDFDocument['embedPng']>> | null = null;
  if (config.type === 'image' && config.imageDataUrl) {
    const imgBytes = dataUrlToUint8Array(config.imageDataUrl);
    embeddedImg = config.imageDataUrl.includes('image/png')
      ? await doc.embedPng(imgBytes)
      : await doc.embedJpg(imgBytes);
  }

  const color = hexToRgbColor(config.color || '#E50920');

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const { width, height } = page.getSize();

    if (config.type === 'text') {
      const txt = sanitizePdfText(config.text || 'CONFIDENTIAL');
      const tw = font.widthOfTextAtSize(txt, config.size);

      const drawAt = (x: number, y: number) => {
        page.drawText(txt, {
          x,
          y,
          size: config.size,
          font,
          color,
          opacity: config.opacity,
          rotate: degrees(config.rotation),
        });
      };

      if (config.position === 'tile') {
        const stepX = Math.max(140, tw + 70);
        const stepY = Math.max(120, config.size * 3.5);
        for (let y = 60; y < height; y += stepY) {
          for (let x = 40; x < width; x += stepX) {
            drawAt(x, y);
          }
        }
      } else {
        const pos = computePosition(config.position, width, height, tw, config.size);
        drawAt(pos.x, pos.y);
      }
    } else if (embeddedImg) {
      const targetW = (width * Math.max(10, Math.min(80, config.size))) / 100;
      const targetH = (embeddedImg.height / embeddedImg.width) * targetW;
      const pos = computePosition(config.position, width, height, targetW, targetH);
      page.drawImage(embeddedImg, {
        x: pos.x,
        y: pos.y,
        width: targetW,
        height: targetH,
        opacity: config.opacity,
        rotate: degrees(config.rotation),
      });
    }

    onProgress?.(Math.round(((i + 1) / pages.length) * 85));
  }

  const bytes = await doc.save();
  const { thumbnailDataUrl, pageCount } = await generateThumbnailFromPdf(bytes);
  onProgress?.(100);
  return { bytes, pageCount, thumbnailDataUrl };
}

function computePosition(
  pos: WatermarkPosition,
  pageW: number,
  pageH: number,
  itemW: number,
  itemH: number
) {
  const pad = 36;
  switch (pos) {
    case 'top-left':
      return { x: pad, y: pageH - pad - itemH };
    case 'top-right':
      return { x: pageW - pad - itemW, y: pageH - pad - itemH };
    case 'bottom-left':
      return { x: pad, y: pad };
    case 'bottom-right':
      return { x: pageW - pad - itemW, y: pad };
    case 'center':
    default:
      return { x: (pageW - itemW) / 2, y: (pageH - itemH) / 2 };
  }
}

/**
 * Convert every page of a PDF to PNG or JPEG images.
 */
export async function pdfToImages(
  data: ArrayBuffer,
  format: 'png' | 'jpeg',
  quality: number,
  scale: number,
  onProgress?: (pct: number) => void
): Promise<{ pageNumber: number; dataUrl: string; blob: Blob }[]> {
  const copy = new Uint8Array(data).slice();
  const pdf = await pdfjsLib.getDocument({ data: copy }).promise;
  const output: { pageNumber: number; dataUrl: string; blob: Blob }[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;

    const mime = format === 'png' ? 'image/png' : 'image/jpeg';
    const dataUrl = canvas.toDataURL(mime, quality);
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b || new Blob()), mime, quality)
    );
    output.push({ pageNumber: i, dataUrl, blob });
    onProgress?.(Math.round((i / pdf.numPages) * 100));
  }

  await pdf.cleanup();
  return output;
}

/**
 * Export images as a single ZIP archive Blob.
 */
export async function bundleImagesAsZip(
  images: { pageNumber: number; blob: Blob }[],
  baseName: string,
  ext: 'png' | 'jpg'
): Promise<Blob> {
  const zip = new JSZip();
  for (const img of images) {
    zip.file(`${baseName}_page_${img.pageNumber}.${ext}`, img.blob);
  }
  return zip.generateAsync({ type: 'blob' });
}

/**
 * Convert PDF to a genuine openable Word (.docx) file locally by extracting text per page
 * and packaging valid OOXML inside a ZIP archive.
 */
export async function pdfToWordDocx(
  data: ArrayBuffer,
  title: string,
  onProgress?: (pct: number) => void
): Promise<{ blob: Blob; pageCount: number; extractedChars: number }> {
  const copy = new Uint8Array(data).slice();
  const pdf = await pdfjsLib.getDocument({ data: copy }).promise;
  const pageParagraphs: string[][] = [];
  let totalChars = 0;

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const lines: string[] = [];
    let currentLine = '';
    let lastY: number | null = null;

    for (const item of textContent.items) {
      if ('str' in item) {
        const y = Math.round((item.transform?.[5] ?? 0) / 4);
        if (lastY !== null && Math.abs(y - lastY) > 2 && currentLine.trim()) {
          lines.push(currentLine.trim());
          currentLine = '';
        }
        currentLine += item.str + (item.hasEOL ? '\n' : ' ');
        lastY = y;
      }
    }
    if (currentLine.trim()) lines.push(currentLine.trim());
    totalChars += lines.join('').length;
    pageParagraphs.push(lines.length > 0 ? lines : [`[Page ${i} — Scanned/Image Content]`]);
    onProgress?.(Math.round((i / pdf.numPages) * 85));
  }
  const pageCount = pdf.numPages;
  await pdf.cleanup();

  const escapeXml = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  const bodyParts: string[] = [];
  bodyParts.push(
    `<w:p><w:r><w:rPr><w:b/><w:sz w:val="32"/></w:rPr><w:t>${escapeXml(title)}</w:t></w:r></w:p>`
  );

  pageParagraphs.forEach((lines, idx) => {
    bodyParts.push(
      `<w:p><w:r><w:rPr><w:b/><w:color w:val="E50920"/></w:rPr><w:t>Page ${idx + 1}</w:t></w:r></w:p>`
    );
    for (const line of lines) {
      bodyParts.push(
        `<w:p><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`
      );
    }
  });

  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  );
  zip.folder('_rels')!.file(
    '.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );
  zip.folder('word')!.file(
    'document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${bodyParts.join('\n    ')}
    <w:sectPr/>
  </w:body>
</w:document>`
  );

  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  onProgress?.(100);
  return { blob, pageCount, extractedChars: totalChars };
}

/**
 * Search text across all pages of a PDF for the integrated PDF Viewer.
 */
export async function searchPdfText(
  data: ArrayBuffer,
  query: string
): Promise<{ pageNumber: number; snippet: string }[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const copy = new Uint8Array(data).slice();
  const pdf = await pdfjsLib.getDocument({ data: copy }).promise;
  const matches: { pageNumber: number; snippet: string }[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const fullText = content.items
      .map((it) => ('str' in it ? it.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ');
    const idx = fullText.toLowerCase().indexOf(q);
    if (idx !== -1) {
      const start = Math.max(0, idx - 32);
      const end = Math.min(fullText.length, idx + q.length + 48);
      matches.push({
        pageNumber: i,
        snippet: `${start > 0 ? '…' : ''}${fullText.slice(start, end)}${end < fullText.length ? '…' : ''}`,
      });
    }
  }
  await pdf.cleanup();
  return matches;
}

/**
 * Creates genuine starter PDF documents locally on first launch so users can immediately
 * test the PDF Viewer, Merge, Split, Compress, Rotate, Watermark, and Converters offline.
 */
export async function createStarterSamplePdf(
  title: string,
  subtitle: string,
  pagesContent: { heading: string; paragraphs: string[] }[]
): Promise<{ bytes: Uint8Array; pageCount: number; thumbnailDataUrl: string }> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  pagesContent.forEach((p, idx) => {
    const page = doc.addPage(PageSizes.A4);
    const { width, height } = page.getSize();

    // Clean top accent band
    page.drawRectangle({ x: 0, y: height - 10, width, height: 10, color: rgb(0.9, 0.04, 0.13) });

    page.drawText(sanitizePdfText(title), {
      x: 48,
      y: height - 64,
      size: 22,
      font: bold,
      color: rgb(0.12, 0.13, 0.14),
    });
    page.drawText(sanitizePdfText(subtitle), {
      x: 48,
      y: height - 86,
      size: 11,
      font,
      color: rgb(0.46, 0.47, 0.5),
    });

    page.drawLine({
      start: { x: 48, y: height - 102 },
      end: { x: width - 48, y: height - 102 },
      thickness: 0.75,
      color: rgb(0.88, 0.89, 0.91),
    });

    page.drawText(sanitizePdfText(p.heading), {
      x: 48,
      y: height - 138,
      size: 15,
      font: bold,
      color: rgb(0.9, 0.04, 0.13),
    });

    let y = height - 168;
    for (const para of p.paragraphs) {
      const wrapped = wrapTextLines(sanitizePdfText(para), 74);
      for (const line of wrapped) {
        page.drawText(line, {
          x: 48,
          y,
          size: 11.5,
          font,
          color: rgb(0.18, 0.19, 0.21),
        });
        y -= 18;
      }
      y -= 12;
    }

    page.drawText(`Page ${idx + 1} of ${pagesContent.length}`, {
      x: width - 118,
      y: 28,
      size: 9.5,
      font,
      color: rgb(0.48, 0.5, 0.54),
    });
  });

  doc.setTitle(title);
  doc.setCreator('PDF Maker');
  const bytes = await doc.save();
  const { thumbnailDataUrl, pageCount } = await generateThumbnailFromPdf(bytes);
  return { bytes, pageCount, thumbnailDataUrl };
}

export function triggerFileDownload(data: Blob | ArrayBuffer | Uint8Array, filename: string, mime = 'application/pdf') {
  const blob =
    data instanceof Blob
      ? data
      : new Blob([data instanceof Uint8Array ? new Uint8Array(data) : new Uint8Array(data)], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function shareOrDownloadFile(
  data: ArrayBuffer | Uint8Array,
  filename: string,
  mime = 'application/pdf'
): Promise<'shared' | 'downloaded'> {
  const bytes = data instanceof Uint8Array ? new Uint8Array(data) : new Uint8Array(data);
  const file = new File([bytes], filename, { type: mime });
  if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        title: filename,
        files: [file],
      });
      return 'shared';
    } catch {
      // Fallback to download if user cancels or iframe blocks Web Share
    }
  }
  triggerFileDownload(bytes, filename, mime);
  return 'downloaded';
}

export function printPdfBuffer(data: ArrayBuffer) {
  const blob = new Blob([new Uint8Array(data)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.src = url;
  document.body.appendChild(iframe);
  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      triggerFileDownload(blob, 'document-print.pdf');
    }
    setTimeout(() => {
      document.body.removeChild(iframe);
      URL.revokeObjectURL(url);
    }, 60000);
  };
}
