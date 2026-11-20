import { CameraFilterMode, CropRect, ImageItem } from '../types/pdf';

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

/**
 * Automatically detects document content edges by scanning luminance gradients
 * against the border average luminance. Returns normalized CropRect.
 */
export async function detectDocumentEdges(dataUrl: string): Promise<CropRect> {
  const img = await loadImageElement(dataUrl);
  const maxDim = 320;
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.max(16, Math.round(img.width * scale));
  const h = Math.max(16, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { x: 0.04, y: 0.04, w: 0.92, h: 0.92 };

  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  const lum = (x: number, y: number) => {
    const idx = (y * w + x) * 4;
    return 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
  };

  // Sample border average luminance
  let borderSum = 0;
  let borderCount = 0;
  for (let x = 0; x < w; x++) {
    borderSum += lum(x, 0) + lum(x, h - 1);
    borderCount += 2;
  }
  for (let y = 0; y < h; y++) {
    borderSum += lum(0, y) + lum(w - 1, y);
    borderCount += 2;
  }
  const bgLum = borderSum / Math.max(1, borderCount);
  const diffThreshold = 26;

  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  let found = 0;

  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      if (Math.abs(lum(x, y) - bgLum) > diffThreshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        found++;
      }
    }
  }

  if (found < w * h * 0.05 || maxX - minX < w * 0.2 || maxY - minY < h * 0.2) {
    return { x: 0.04, y: 0.04, w: 0.92, h: 0.92 };
  }

  const padX = Math.round(w * 0.015);
  const padY = Math.round(h * 0.015);
  const x0 = Math.max(0, minX - padX) / w;
  const y0 = Math.max(0, minY - padY) / h;
  const x1 = Math.min(w, maxX + padX) / w;
  const y1 = Math.min(h, maxY + padY) / h;

  return {
    x: Number(x0.toFixed(3)),
    y: Number(y0.toFixed(3)),
    w: Number(Math.max(0.2, x1 - x0).toFixed(3)),
    h: Number(Math.max(0.2, y1 - y0).toFixed(3)),
  };
}

/**
 * Renders an image with rotation, crop, filter mode, brightness, contrast, and shadow removal.
 */
export async function processImageDataUrl(
  originalDataUrl: string,
  options: {
    rotation: number;
    crop?: CropRect;
    filter: CameraFilterMode;
    brightness: number;
    contrast: number;
    removeShadows: boolean;
    maxDimension?: number;
    jpegQuality?: number;
  }
): Promise<{ dataUrl: string; width: number; height: number; size: number }> {
  const img = await loadImageElement(originalDataUrl);
  const crop = options.crop ?? { x: 0, y: 0, w: 1, h: 1 };

  const sx = Math.round(crop.x * img.width);
  const sy = Math.round(crop.y * img.height);
  const sw = Math.max(1, Math.round(crop.w * img.width));
  const sh = Math.max(1, Math.round(crop.h * img.height));

  const rot = ((options.rotation % 360) + 360) % 360;
  const isRotated90 = rot === 90 || rot === 270;

  let outW = isRotated90 ? sh : sw;
  let outH = isRotated90 ? sw : sh;

  const maxDim = options.maxDimension ?? 2200;
  if (Math.max(outW, outH) > maxDim) {
    const ratio = maxDim / Math.max(outW, outH);
    outW = Math.max(1, Math.round(outW * ratio));
    outH = Math.max(1, Math.round(outH * ratio));
  }

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { dataUrl: originalDataUrl, width: img.width, height: img.height, size: originalDataUrl.length };
  }

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, outW, outH);

  ctx.save();
  ctx.translate(outW / 2, outH / 2);
  ctx.rotate((rot * Math.PI) / 180);
  const drawW = isRotated90 ? outH : outW;
  const drawH = isRotated90 ? outW : outH;
  ctx.drawImage(img, sx, sy, sw, sh, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();

  const needsPixelPass =
    options.filter !== 'color' ||
    options.brightness !== 0 ||
    options.contrast !== 0 ||
    options.removeShadows;

  if (needsPixelPass) {
    const imgData = ctx.getImageData(0, 0, outW, outH);
    const d = imgData.data;

    // Estimate background illumination for shadow removal using a coarse 8x8 grid
    let bgGrid: Float32Array | null = null;
    const gridN = 8;
    if (options.removeShadows || options.filter === 'document') {
      bgGrid = new Float32Array(gridN * gridN);
      const cellW = Math.max(1, Math.floor(outW / gridN));
      const cellH = Math.max(1, Math.floor(outH / gridN));
      for (let gy = 0; gy < gridN; gy++) {
        for (let gx = 0; gx < gridN; gx++) {
          let maxLum = 180;
          const startY = gy * cellH;
          const endY = Math.min(outH, startY + cellH);
          const startX = gx * cellW;
          const endX = Math.min(outW, startX + cellW);
          const step = Math.max(1, Math.floor(Math.min(cellW, cellH) / 6));
          for (let y = startY; y < endY; y += step) {
            for (let x = startX; x < endX; x += step) {
              const i = (y * outW + x) * 4;
              const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
              if (l > maxLum) maxLum = l;
            }
          }
          bgGrid[gy * gridN + gx] = maxLum;
        }
      }
    }

    const bOffset = (options.brightness / 100) * 140;
    const cFactor = (100 + options.contrast * 1.4) / 100;

    for (let y = 0; y < outH; y++) {
      const gy = bgGrid ? Math.min(gridN - 1, Math.floor((y / outH) * gridN)) : 0;
      for (let x = 0; x < outW; x++) {
        const idx = (y * outW + x) * 4;
        let r = d[idx];
        let g = d[idx + 1];
        let b = d[idx + 2];

        // Shadow removal: normalize local bright paper tone towards 250
        if (bgGrid) {
          const gx = Math.min(gridN - 1, Math.floor((x / outW) * gridN));
          const localPaper = Math.max(130, bgGrid[gy * gridN + gx]);
          const gain = options.removeShadows ? 248 / localPaper : 244 / localPaper;
          const clampedGain = Math.min(1.55, Math.max(0.95, gain));
          r *= clampedGain;
          g *= clampedGain;
          b *= clampedGain;
        }

        // Brightness & contrast
        r = (r - 128) * cFactor + 128 + bOffset;
        g = (g - 128) * cFactor + 128 + bOffset;
        b = (b - 128) * cFactor + 128 + bOffset;

        if (options.filter === 'document') {
          // Crisp document scan: boost paper whiteness and sharpen dark ink
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          if (lum > 188) {
            r = Math.min(255, r * 1.15 + 15);
            g = Math.min(255, g * 1.15 + 15);
            b = Math.min(255, b * 1.15 + 15);
          } else {
            r = (r - 128) * 1.28 + 118;
            g = (g - 128) * 1.28 + 118;
            b = (b - 128) * 1.28 + 118;
          }
        } else if (options.filter === 'grayscale') {
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;
          r = gray;
          g = gray;
          b = gray;
        } else if (options.filter === 'bw') {
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;
          const bw = gray > 142 ? 255 : 18;
          r = bw;
          g = bw;
          b = bw;
        }

        d[idx] = Math.max(0, Math.min(255, r));
        d[idx + 1] = Math.max(0, Math.min(255, g));
        d[idx + 2] = Math.max(0, Math.min(255, b));
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }

  const quality = options.jpegQuality ?? 0.88;
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  const approxSize = Math.round((dataUrl.length * 3) / 4);
  return { dataUrl, width: outW, height: outH, size: approxSize };
}

export async function createImageItemFromFile(file: File): Promise<ImageItem> {
  const dataUrl = await readFileAsDataUrl(file);
  const img = await loadImageElement(dataUrl);
  return {
    id: crypto.randomUUID(),
    name: file.name,
    originalDataUrl: dataUrl,
    processedDataUrl: dataUrl,
    mimeType: file.type || 'image/jpeg',
    size: file.size,
    width: img.width,
    height: img.height,
    rotation: 0,
    filter: 'color',
    brightness: 0,
    contrast: 0,
    removeShadows: false,
    selected: true,
  };
}

/**
 * Generates a realistic synthetic document page canvas when the user tests
 * Camera Scan on a device without an attached webcam.
 */
export function generateSimulatedScanCapture(pageNumber: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 1200;
  const ctx = canvas.getContext('2d')!;

  // Soft desk background
  ctx.fillStyle = '#D6D3CD';
  ctx.fillRect(0, 0, 900, 1200);

  // Paper sheet with slight shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = '#FDFDFB';
  ctx.fillRect(58, 66, 784, 1068);
  ctx.restore();

  // Header bar on paper
  ctx.fillStyle = '#E50920';
  ctx.fillRect(108, 120, 684, 6);

  ctx.fillStyle = '#202124';
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText(`Scanned Document — Page ${pageNumber}`, 108, 180);

  ctx.fillStyle = '#6B7280';
  ctx.font = '18px sans-serif';
  ctx.fillText(`Captured on ${new Date().toLocaleDateString()} · Auto-enhanced document copy`, 108, 218);

  // Simulated structured lines
  ctx.fillStyle = '#374151';
  ctx.font = '20px sans-serif';
  const paragraphs = [
    '1. Executive Summary',
    'This captured sheet demonstrates automatic edge detection, shadow',
    'removal, and document contrast enhancement built directly into',
    'PDF Maker. Apply Document, Grayscale, or Black & White filters.',
    '',
    '2. Key Document Details',
    '• Reference ID: DOC-2026-0' + pageNumber + '48',
    '• Department: Operations & Field Documentation',
    '• Verification Status: Ready for Offline PDF Archiving',
    '',
    '3. Notes & Signatures',
    'All processing happens locally on this device with zero cloud upload.',
    'You can crop, rotate, reorder, or append more pages before exporting.',
  ];

  let y = 290;
  for (const line of paragraphs) {
    if (line.startsWith('1.') || line.startsWith('2.') || line.startsWith('3.')) {
      ctx.font = 'bold 22px sans-serif';
      ctx.fillStyle = '#111827';
    } else {
      ctx.font = '19px sans-serif';
      ctx.fillStyle = '#374151';
    }
    ctx.fillText(line, 108, y);
    y += 42;
  }

  // Table box
  ctx.strokeStyle = '#D1D5DB';
  ctx.lineWidth = 2;
  ctx.strokeRect(108, 860, 684, 160);
  ctx.beginPath();
  ctx.moveTo(108, 912);
  ctx.lineTo(792, 912);
  ctx.moveTo(450, 860);
  ctx.lineTo(450, 1020);
  ctx.stroke();

  ctx.fillStyle = '#111827';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('Item Description', 128, 892);
  ctx.fillText('Status / Value', 470, 892);
  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#4B5563';
  ctx.fillText(`Scanned Sheet #${pageNumber}`, 128, 955);
  ctx.fillText('Verified · 300 DPI', 470, 955);
  ctx.fillText('Offline Storage', 128, 995);
  ctx.fillText('IndexedDB Local', 470, 995);

  return canvas.toDataURL('image/jpeg', 0.92);
}
