import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Upload,
  FileText,
  CheckCircle2,
  Eye,
  Share2,
  Download,
  RotateCw,
  Loader2,
  GripVertical,
  Trash2,
  CheckSquare,
  Square,
  Plus,
} from 'lucide-react';
import { PdfFileRecord, ToolId } from '../types/pdf';
import {
  bundleImagesAsZip,
  compressPdf,
  generateThumbnailFromPdf,
  mergePdfs,
  pdfToImages,
  pdfToWordDocx,
  renderPdfPageThumbnails,
  reorderOrExtractPages,
  rotatePdf,
  shareOrDownloadFile,
  splitPdf,
  triggerFileDownload,
  WatermarkConfig,
  watermarkPdf,
  WatermarkPosition,
} from '../services/pdfEngine';
import { readFileAsDataUrl } from '../services/imageProcessor';
import { formatBytes } from '../storage/db';

interface PdfToolWorkbenchProps {
  toolId: ToolId;
  libraryFiles: PdfFileRecord[];
  initialSelectedIds?: string[];
  onBack: () => void;
  onSaveOutputFiles: (
    files: PdfFileRecord[],
    taskName: string,
    inputNames: string[],
    toolId: ToolId
  ) => Promise<void>;
  onOpenFile: (file: PdfFileRecord) => void;
}

const TOOL_META: Partial<Record<ToolId, { title: string; subtitle: string; folderId: string }>> = {
  'merge-pdf': { title: 'Merge PDF', subtitle: 'Select multiple PDFs, arrange order, and combine into one', folderId: 'merged' },
  'split-pdf': { title: 'Split PDF', subtitle: 'Split into individual pages, custom ranges, or fixed groups', folderId: 'created' },
  'compress-pdf': { title: 'Compress PDF', subtitle: 'Reduce PDF file size offline with selectable compression levels', folderId: 'compressed' },
  'rotate-pdf': { title: 'Rotate PDF', subtitle: 'Rotate individual pages or all pages by 90°, 180°, or 270°', folderId: 'created' },
  'pdf-to-images': { title: 'PDF to Images', subtitle: 'Export PDF pages to PNG or JPG with custom resolution', folderId: 'converted' },
  'extract-pages': { title: 'Extract Pages', subtitle: 'Select specific pages to save into a brand new PDF', folderId: 'created' },
  'reorder-pages': { title: 'Reorder Pages', subtitle: 'Drag and drop page thumbnails to change page order', folderId: 'created' },
  'watermark-pdf': { title: 'Watermark PDF', subtitle: 'Add customizable text or image watermarks across all pages', folderId: 'created' },
  'pdf-to-word': { title: 'PDF to Word', subtitle: 'Extract document content into an editable Word (.docx) file', folderId: 'converted' },
};

export const PdfToolWorkbench: React.FC<PdfToolWorkbenchProps> = ({
  toolId,
  libraryFiles,
  initialSelectedIds = [],
  onBack,
  onSaveOutputFiles,
  onOpenFile,
}) => {
  const pdfLibrary = libraryFiles.filter((f) => f.extension.toLowerCase() === 'pdf');
  const meta = TOOL_META[toolId] || { title: 'PDF Tool', subtitle: 'Offline PDF utility', folderId: 'created' };
  const isMultiFile = toolId === 'merge-pdf';

  // Selected source files
  const [selectedSources, setSelectedSources] = useState<
    { id: string; name: string; data: ArrayBuffer; pageCount: number; size: number; thumbnailDataUrl?: string; pageFilter?: string }[]
  >(() => {
    if (initialSelectedIds.length > 0) {
      return pdfLibrary
        .filter((f) => initialSelectedIds.includes(f.id))
        .map((f) => ({
          id: f.id,
          name: f.name,
          data: f.data,
          pageCount: f.pageCount,
          size: f.size,
          thumbnailDataUrl: f.thumbnailDataUrl,
        }));
    }
    return [];
  });

  // Page thumbnails for single-PDF page tools
  const [pageThumbs, setPageThumbs] = useState<string[]>([]);
  const [loadingThumbs, setLoadingThumbs] = useState(false);

  // Tool-specific states
  const [outputName, setOutputName] = useState('');
  const [splitMode, setSplitMode] = useState<'individual' | 'ranges' | 'fixed'>('individual');
  const [splitRanges, setSplitRanges] = useState('1-2');
  const [splitGroupSize, setSplitGroupSize] = useState(2);

  const [compressLevel, setCompressLevel] = useState<'low' | 'recommended' | 'high'>('recommended');
  const [compressStats, setCompressStats] = useState<{ before: number; after: number } | null>(null);

  const [rotations, setRotations] = useState<Record<number, number>>({});
  const [extractedIndices, setExtractedIndices] = useState<number[]>([]);
  const [pageOrder, setPageOrder] = useState<number[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const [imgFormat, setImgFormat] = useState<'png' | 'jpeg'>('png');
  const [imgQuality, setImgQuality] = useState(0.9);
  const [imgScale, setImgScale] = useState(1.5);
  const [exportedImages, setExportedImages] = useState<{ pageNumber: number; dataUrl: string; blob: Blob }[]>([]);

  const [watermark, setWatermark] = useState<WatermarkConfig>({
    type: 'text',
    text: 'CONFIDENTIAL',
    opacity: 0.25,
    size: 40,
    position: 'center',
    rotation: 38,
    color: '#E50920',
  });

  const [wordResult, setWordResult] = useState<{ blob: Blob; filename: string; chars: number } | null>(null);

  // Processing & Output state
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [outputFiles, setOutputFiles] = useState<PdfFileRecord[]>([]);

  const uploadInputRef = useRef<HTMLInputElement>(null);
  const wmImgInputRef = useRef<HTMLInputElement>(null);

  const activeSingleSource = !isMultiFile ? selectedSources[0] || null : null;

  // Load page thumbnails when single source changes for page-level tools
  useEffect(() => {
    if (!activeSingleSource) {
      setPageThumbs([]);
      return;
    }
    const base = activeSingleSource.name.replace(/\.pdf$/i, '');
    const suffixMap: Partial<Record<ToolId, string>> = {
      'split-pdf': `${base}_split`,
      'compress-pdf': `${base}_compressed`,
      'rotate-pdf': `${base}_rotated`,
      'extract-pages': `${base}_extracted`,
      'reorder-pages': `${base}_reordered`,
      'watermark-pdf': `${base}_watermarked`,
      'pdf-to-images': base,
      'pdf-to-word': base,
    };
    setOutputName(suffixMap[toolId] || `${base}_edited`);

    const needsThumbs = ['rotate-pdf', 'extract-pages', 'reorder-pages', 'split-pdf'].includes(toolId);
    if (!needsThumbs) return;

    let cancelled = false;
    setLoadingThumbs(true);
    renderPdfPageThumbnails(activeSingleSource.data, 0.32)
      .then((thumbs) => {
        if (cancelled) return;
        setPageThumbs(thumbs);
        setRotations({});
        setExtractedIndices(thumbs.map((_, i) => i));
        setPageOrder(thumbs.map((_, i) => i));
      })
      .catch(() => {
        if (!cancelled) setError('Could not render PDF page previews.');
      })
      .finally(() => {
        if (!cancelled) setLoadingThumbs(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeSingleSource?.id, toolId]);

  useEffect(() => {
    if (isMultiFile && !outputName) {
      setOutputName('Merged Document');
    }
  }, [isMultiFile]);

  const handleUploadPdf = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    const added: typeof selectedSources = [];
    for (const file of Array.from(files)) {
      if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') continue;
      const buf = await file.arrayBuffer();
      const { thumbnailDataUrl, pageCount } = await generateThumbnailFromPdf(buf);
      added.push({
        id: crypto.randomUUID(),
        name: file.name,
        data: buf,
        pageCount,
        size: buf.byteLength,
        thumbnailDataUrl,
      });
    }
    if (isMultiFile) {
      setSelectedSources((prev) => [...prev, ...added]);
    } else if (added[0]) {
      setSelectedSources([added[0]]);
    }
    if (uploadInputRef.current) uploadInputRef.current.value = '';
  };

  const toggleLibrarySource = (file: PdfFileRecord) => {
    if (isMultiFile) {
      setSelectedSources((prev) => {
        const exists = prev.some((s) => s.id === file.id);
        if (exists) return prev.filter((s) => s.id !== file.id);
        return [
          ...prev,
          {
            id: file.id,
            name: file.name,
            data: file.data,
            pageCount: file.pageCount,
            size: file.size,
            thumbnailDataUrl: file.thumbnailDataUrl,
          },
        ];
      });
    } else {
      setSelectedSources([
        {
          id: file.id,
          name: file.name,
          data: file.data,
          pageCount: file.pageCount,
          size: file.size,
          thumbnailDataUrl: file.thumbnailDataUrl,
        },
      ]);
    }
  };

  const parsePageSelection = (text: string | undefined, max: number): number[] | undefined => {
    if (!text || !text.trim()) return undefined;
    const set = new Set<number>();
    for (const part of text.split(',')) {
      const p = part.trim();
      if (!p) continue;
      if (p.includes('-')) {
        const [a, b] = p.split('-').map((n) => parseInt(n, 10));
        if (!isNaN(a) && !isNaN(b)) {
          for (let i = Math.max(1, a); i <= Math.min(max, b); i++) set.add(i - 1);
        }
      } else {
        const n = parseInt(p, 10);
        if (!isNaN(n) && n >= 1 && n <= max) set.add(n - 1);
      }
    }
    return set.size > 0 ? Array.from(set).sort((a, b) => a - b) : undefined;
  };

  const buildPdfRecord = (
    name: string,
    bytes: Uint8Array,
    pageCount: number,
    thumbnailDataUrl: string
  ): PdfFileRecord => ({
    id: crypto.randomUUID(),
    name: name.toLowerCase().endsWith('.pdf') ? name : `${name}.pdf`,
    extension: 'pdf',
    category: 'pdf',
    mimeType: 'application/pdf',
    size: bytes.byteLength,
    pageCount,
    status: 'completed',
    folderId: meta.folderId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    thumbnailDataUrl,
    data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    bookmarks: [],
    sourceTool: toolId,
  });

  const handleExecute = async () => {
    setProcessing(true);
    setProgress(5);
    setError(null);
    setOutputFiles([]);
    setExportedImages([]);
    setWordResult(null);
    setCompressStats(null);

    try {
      const baseName = (outputName.trim() || 'Output Document').replace(/\.pdf$/i, '');

      if (toolId === 'merge-pdf') {
        if (selectedSources.length < 2) throw new Error('Select at least 2 PDF files to merge.');
        const res = await mergePdfs(
          selectedSources.map((s) => ({
            data: s.data,
            pageIndices: parsePageSelection(s.pageFilter, s.pageCount),
          })),
          setProgress
        );
        const rec = buildPdfRecord(baseName, res.bytes, res.pageCount, res.thumbnailDataUrl);
        await onSaveOutputFiles([rec], 'Merge PDF', selectedSources.map((s) => s.name), toolId);
        setOutputFiles([rec]);
      } else if (toolId === 'split-pdf' && activeSingleSource) {
        const parts = await splitPdf(
          activeSingleSource.data,
          splitMode,
          { rangesText: splitRanges, groupSize: splitGroupSize },
          setProgress
        );
        const records = parts.map((p) =>
          buildPdfRecord(`${baseName} (${p.nameSuffix})`, p.bytes, p.pageCount, p.thumbnailDataUrl)
        );
        await onSaveOutputFiles(records, 'Split PDF', [activeSingleSource.name], toolId);
        setOutputFiles(records);
      } else if (toolId === 'compress-pdf' && activeSingleSource) {
        const res = await compressPdf(activeSingleSource.data, compressLevel, setProgress);
        setCompressStats({ before: activeSingleSource.size, after: res.bytes.byteLength });
        const rec = buildPdfRecord(baseName, res.bytes, res.pageCount, res.thumbnailDataUrl);
        await onSaveOutputFiles([rec], 'Compress PDF', [activeSingleSource.name], toolId);
        setOutputFiles([rec]);
      } else if (toolId === 'rotate-pdf' && activeSingleSource) {
        const res = await rotatePdf(activeSingleSource.data, rotations, setProgress);
        const rec = buildPdfRecord(baseName, res.bytes, res.pageCount, res.thumbnailDataUrl);
        await onSaveOutputFiles([rec], 'Rotate PDF', [activeSingleSource.name], toolId);
        setOutputFiles([rec]);
      } else if (toolId === 'extract-pages' && activeSingleSource) {
        if (extractedIndices.length === 0) throw new Error('Select at least one page to extract.');
        const res = await reorderOrExtractPages(activeSingleSource.data, extractedIndices, setProgress);
        const rec = buildPdfRecord(baseName, res.bytes, res.pageCount, res.thumbnailDataUrl);
        await onSaveOutputFiles([rec], 'Extract Pages', [activeSingleSource.name], toolId);
        setOutputFiles([rec]);
      } else if (toolId === 'reorder-pages' && activeSingleSource) {
        const res = await reorderOrExtractPages(activeSingleSource.data, pageOrder, setProgress);
        const rec = buildPdfRecord(baseName, res.bytes, res.pageCount, res.thumbnailDataUrl);
        await onSaveOutputFiles([rec], 'Reorder Pages', [activeSingleSource.name], toolId);
        setOutputFiles([rec]);
      } else if (toolId === 'watermark-pdf' && activeSingleSource) {
        const res = await watermarkPdf(activeSingleSource.data, watermark, setProgress);
        const rec = buildPdfRecord(baseName, res.bytes, res.pageCount, res.thumbnailDataUrl);
        await onSaveOutputFiles([rec], 'Watermark PDF', [activeSingleSource.name], toolId);
        setOutputFiles([rec]);
      } else if (toolId === 'pdf-to-images' && activeSingleSource) {
        const imgs = await pdfToImages(
          activeSingleSource.data,
          imgFormat,
          imgQuality,
          imgScale,
          setProgress
        );
        setExportedImages(imgs);
      } else if (toolId === 'pdf-to-word' && activeSingleSource) {
        const res = await pdfToWordDocx(activeSingleSource.data, baseName, setProgress);
        const filename = `${baseName}.docx`;
        setWordResult({ blob: res.blob, filename, chars: res.extractedChars });
        const buf = await res.blob.arrayBuffer();
        const wordRec: PdfFileRecord = {
          id: crypto.randomUUID(),
          name: filename,
          extension: 'docx',
          category: 'word',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          size: buf.byteLength,
          pageCount: res.pageCount,
          status: 'completed',
          folderId: 'converted',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          data: buf,
          sourceTool: toolId,
        };
        await onSaveOutputFiles([wordRec], 'PDF to Word', [activeSingleSource.name], toolId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <input
        ref={uploadInputRef}
        type="file"
        accept=".pdf,application/pdf"
        multiple={isMultiFile}
        onChange={(e) => handleUploadPdf(e.target.files)}
        className="hidden"
      />
      <input
        ref={wmImgInputRef}
        type="file"
        accept="image/png,image/jpeg"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) {
            const url = await readFileAsDataUrl(f);
            setWatermark((w) => ({ ...w, imageDataUrl: url }));
          }
        }}
        className="hidden"
      />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="min-w-[44px] min-h-[44px] rounded-xl bg-white dark:bg-[#1A1C20] border border-[#E6E6E6] dark:border-[#2A2D34] flex items-center justify-center text-[#202124] dark:text-[#F3F4F6] cursor-pointer"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-[#202124] dark:text-[#F3F4F6]">
              {meta.title}
            </h1>
            <p className="text-xs text-[#777777] dark:text-[#9CA3AF]">{meta.subtitle}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => uploadInputRef.current?.click()}
          className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-[#202124] dark:bg-[#F3F4F6] text-white dark:text-[#111215] text-sm font-medium cursor-pointer whitespace-nowrap"
        >
          <Upload className="w-4 h-4" />
          <span>Import PDF from Device</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-[#E50920]/10 border border-[#E50920]/30 text-sm text-[#B81024] dark:text-red-300">
          {error}
        </div>
      )}

      {/* Results Banner for PDF outputs */}
      {outputFiles.length > 0 && (
        <div className="bg-white dark:bg-[#1A1C20] rounded-2xl border border-[#25A55B]/40 p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#25A55B]/12 text-[#25A55B] flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#202124] dark:text-[#F3F4F6]">
                {outputFiles.length === 1
                  ? 'PDF Created Successfully'
                  : `${outputFiles.length} PDFs Created Successfully`}
              </h2>
              <p className="text-xs text-[#777777] dark:text-[#9CA3AF]">
                Saved automatically to My Files & Completed list.
              </p>
            </div>
          </div>

          {compressStats && (
            <div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] text-center tabular-nums">
              <div>
                <p className="text-xs text-[#777777] dark:text-[#9CA3AF]">Original Size</p>
                <p className="text-sm font-bold text-[#202124] dark:text-[#F3F4F6] mt-0.5">
                  {formatBytes(compressStats.before)}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#777777] dark:text-[#9CA3AF]">Compressed Size</p>
                <p className="text-sm font-bold text-[#25A55B] mt-0.5">
                  {formatBytes(compressStats.after)}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#777777] dark:text-[#9CA3AF]">Change</p>
                <p className="text-sm font-bold text-[#202124] dark:text-[#F3F4F6] mt-0.5">
                  {compressStats.after < compressStats.before
                    ? `-${Math.round(((compressStats.before - compressStats.after) / compressStats.before) * 100)}%`
                    : 'Optimized'}
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {outputFiles.map((f) => (
              <div
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="w-5 h-5 text-[#E50920] shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#202124] dark:text-[#F3F4F6] truncate">
                      {f.name}
                    </p>
                    <p className="text-xs text-[#777777] dark:text-[#9CA3AF] tabular-nums">
                      {formatBytes(f.size)} · {f.pageCount} {f.pageCount === 1 ? 'page' : 'pages'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenFile(f)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl bg-[#E50920] text-white text-xs font-semibold cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Open PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => shareOrDownloadFile(f.data, f.name)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl bg-white dark:bg-[#1A1C20] border border-[#E6E6E6] dark:border-[#343842] text-xs font-semibold text-[#202124] dark:text-[#F3F4F6] cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PDF to Word Success Result */}
      {wordResult && (
        <div className="bg-white dark:bg-[#1A1C20] rounded-2xl border border-[#25A55B]/40 p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-7 h-7 text-[#25A55B] shrink-0" />
            <div>
              <p className="text-sm font-bold text-[#202124] dark:text-[#F3F4F6]">
                Converted to Word: {wordResult.filename}
              </p>
              <p className="text-xs text-[#777777] dark:text-[#9CA3AF] tabular-nums">
                {formatBytes(wordResult.blob.size)} · {wordResult.chars.toLocaleString()} characters extracted
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              triggerFileDownload(
                wordResult.blob,
                wordResult.filename,
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
              )
            }
            className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-[#E50920] text-white text-sm font-semibold cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download .docx</span>
          </button>
        </div>
      )}

      {/* PDF to Images Exported Gallery */}
      {exportedImages.length > 0 && (
        <div className="bg-white dark:bg-[#1A1C20] rounded-2xl border border-[#25A55B]/40 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[#202124] dark:text-[#F3F4F6]">
                Exported {exportedImages.length} {imgFormat.toUpperCase()} Images
              </h2>
              <p className="text-xs text-[#777777] dark:text-[#9CA3AF]">
                Download individual pages or bundle everything into a ZIP archive.
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                const ext = imgFormat === 'png' ? 'png' : 'jpg';
                const zip = await bundleImagesAsZip(
                  exportedImages,
                  (outputName || 'pdf_pages').replace(/\.pdf$/i, ''),
                  ext
                );
                triggerFileDownload(zip, `${outputName || 'pdf_pages'}_images.zip`, 'application/zip');
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-[#E50920] text-white text-sm font-semibold cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download All (.zip)</span>
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {exportedImages.map((img) => (
              <div
                key={img.pageNumber}
                className="rounded-xl border border-[#E6E6E6] dark:border-[#2A2D34] overflow-hidden bg-[#F5F5F7] dark:bg-[#24272E]"
              >
                <img
                  src={img.dataUrl}
                  alt={`Page ${img.pageNumber}`}
                  className="w-full aspect-[3/4] object-contain p-2"
                />
                <div className="px-3 py-2 bg-white dark:bg-[#1A1C20] flex items-center justify-between text-xs">
                  <span className="font-semibold tabular-nums">Page {img.pageNumber}</span>
                  <button
                    type="button"
                    onClick={() =>
                      triggerFileDownload(
                        img.blob,
                        `${outputName || 'page'}_${img.pageNumber}.${imgFormat === 'png' ? 'png' : 'jpg'}`,
                        imgFormat === 'png' ? 'image/png' : 'image/jpeg'
                      )
                    }
                    className="text-[#E50920] font-semibold cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 1: Pick PDF from Local Library */}
      <div className="bg-white dark:bg-[#1A1C20] rounded-2xl border border-[#E6E6E6] dark:border-[#2A2D34] p-5 space-y-3.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#202124] dark:text-[#F3F4F6]">
            {isMultiFile ? '1. Select PDFs to Merge (2 or more)' : '1. Select a PDF File'}
          </h2>
          <button
            type="button"
            onClick={() => uploadInputRef.current?.click()}
            className="text-xs font-semibold text-[#E50920] inline-flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Upload PDF</span>
          </button>
        </div>

        {pdfLibrary.length === 0 ? (
          <div className="py-6 text-center text-xs text-[#777777] dark:text-[#9CA3AF]">
            No PDFs in your library yet. Tap "Upload PDF" above to pick one from your device.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-60 overflow-y-auto">
            {pdfLibrary.map((file) => {
              const isSelected = selectedSources.some((s) => s.id === file.id);
              return (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => toggleLibrarySource(file)}
                  className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'border-[#E50920] bg-[#E50920]/6'
                      : 'border-[#E6E6E6] dark:border-[#2A2D34] hover:bg-[#F5F5F7] dark:hover:bg-[#24272E]'
                  }`}
                >
                  {isSelected ? (
                    <CheckSquare className="w-4 h-4 text-[#E50920] shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-[#777777] shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[#202124] dark:text-[#F3F4F6] truncate">
                      {file.name}
                    </p>
                    <p className="text-[11px] text-[#777777] dark:text-[#9CA3AF] tabular-nums">
                      {file.pageCount} pages · {formatBytes(file.size)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Step 2: Tool-specific Workspace */}
      {selectedSources.length > 0 && (
        <div className="bg-white dark:bg-[#1A1C20] rounded-2xl border border-[#E6E6E6] dark:border-[#2A2D34] p-5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-[#202124] dark:text-[#F3F4F6]">
              2. Configure {meta.title}
            </h2>
            <div className="flex items-center gap-2">
              <label className="text-xs text-[#777777] whitespace-nowrap">Output Name:</label>
              <input
                type="text"
                value={outputName}
                onChange={(e) => setOutputName(e.target.value)}
                className="h-10 px-3 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] border border-[#E6E6E6] dark:border-[#343842] text-sm w-52"
              />
            </div>
          </div>

          {/* MERGE PDF UI */}
          {toolId === 'merge-pdf' && (
            <div className="space-y-2.5">
              <p className="text-xs text-[#777777] dark:text-[#9CA3AF]">
                Drag items to change merge order. Optionally specify page ranges (e.g. 1-3, 5) per file.
              </p>
              {selectedSources.map((src, idx) => (
                <div
                  key={src.id}
                  draggable
                  onDragStart={() => setDragIdx(idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragIdx === null || dragIdx === idx) return;
                    setSelectedSources((prev) => {
                      const next = [...prev];
                      const [moved] = next.splice(dragIdx, 1);
                      next.splice(idx, 0, moved);
                      return next;
                    });
                    setDragIdx(null);
                  }}
                  className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] border border-[#E6E6E6] dark:border-[#343842]"
                >
                  <GripVertical className="w-4 h-4 text-[#777777] cursor-grab" />
                  <span className="text-xs font-mono font-bold text-[#E50920]">#{idx + 1}</span>
                  <div className="flex-1 min-w-[140px]">
                    <p className="text-sm font-semibold text-[#202124] dark:text-[#F3F4F6] truncate">
                      {src.name}
                    </p>
                    <p className="text-xs text-[#777777] tabular-nums">
                      {src.pageCount} pages · {formatBytes(src.size)}
                    </p>
                  </div>
                  <input
                    type="text"
                    value={src.pageFilter || ''}
                    onChange={(e) =>
                      setSelectedSources((prev) =>
                        prev.map((item) =>
                          item.id === src.id ? { ...item, pageFilter: e.target.value } : item
                        )
                      )
                    }
                    placeholder={`Pages (1-${src.pageCount})`}
                    className="h-9 px-3 rounded-lg bg-white dark:bg-[#1A1C20] border border-[#E6E6E6] dark:border-[#343842] text-xs w-36"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedSources((prev) => prev.filter((item) => item.id !== src.id))
                    }
                    className="min-w-[36px] min-h-[36px] rounded-lg text-[#E50920] hover:bg-[#E50920]/10 flex items-center justify-center cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* SPLIT PDF UI */}
          {toolId === 'split-pdf' && activeSingleSource && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {[
                  { id: 'individual', label: 'Individual Pages', desc: `Creates ${activeSingleSource.pageCount} single-page PDFs` },
                  { id: 'ranges', label: 'Custom Page Ranges', desc: 'e.g. 1-2, 3, 4-5' },
                  { id: 'fixed', label: 'Fixed Page Groups', desc: 'Split every N pages' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSplitMode(opt.id as typeof splitMode)}
                    className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                      splitMode === opt.id
                        ? 'border-[#E50920] bg-[#E50920]/6'
                        : 'border-[#E6E6E6] dark:border-[#2A2D34]'
                    }`}
                  >
                    <p className="text-sm font-semibold text-[#202124] dark:text-[#F3F4F6]">{opt.label}</p>
                    <p className="text-xs text-[#777777] mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
              {splitMode === 'ranges' && (
                <div>
                  <label className="block text-xs font-medium text-[#777777] mb-1">
                    Page ranges (1 to {activeSingleSource.pageCount}, comma-separated)
                  </label>
                  <input
                    type="text"
                    value={splitRanges}
                    onChange={(e) => setSplitRanges(e.target.value)}
                    placeholder="1-2, 3-4"
                    className="w-full sm:w-80 h-11 px-3.5 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] border border-[#E6E6E6] dark:border-[#343842] text-sm"
                  />
                </div>
              )}
              {splitMode === 'fixed' && (
                <div>
                  <label className="block text-xs font-medium text-[#777777] mb-1">
                    Pages per split file
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, activeSingleSource.pageCount)}
                    value={splitGroupSize}
                    onChange={(e) => setSplitGroupSize(Number(e.target.value))}
                    className="w-32 h-11 px-3.5 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] border border-[#E6E6E6] dark:border-[#343842] text-sm tabular-nums"
                  />
                </div>
              )}
            </div>
          )}

          {/* COMPRESS PDF UI */}
          {toolId === 'compress-pdf' && activeSingleSource && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { id: 'low', label: 'Low Compression', desc: 'Best Quality · High clarity, mild size reduction' },
                { id: 'recommended', label: 'Recommended', desc: 'Balanced Quality · Ideal for email and sharing' },
                { id: 'high', label: 'High Compression', desc: 'Smallest File · Maximum reduction for storage' },
              ].map((lvl) => (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={() => setCompressLevel(lvl.id as typeof compressLevel)}
                  className={`p-4 rounded-xl border text-left transition-colors cursor-pointer ${
                    compressLevel === lvl.id
                      ? 'border-[#E50920] bg-[#E50920]/6'
                      : 'border-[#E6E6E6] dark:border-[#2A2D34]'
                  }`}
                >
                  <p className="text-sm font-bold text-[#202124] dark:text-[#F3F4F6]">{lvl.label}</p>
                  <p className="text-xs text-[#777777] dark:text-[#9CA3AF] mt-1">{lvl.desc}</p>
                </button>
              ))}
            </div>
          )}

          {/* ROTATE PDF UI */}
          {toolId === 'rotate-pdf' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-[#777777]">Rotate All Pages:</span>
                {[90, 180, 270].map((deg) => (
                  <button
                    key={deg}
                    type="button"
                    onClick={() => {
                      const next: Record<number, number> = {};
                      pageThumbs.forEach((_, idx) => {
                        next[idx] = ((rotations[idx] || 0) + deg) % 360;
                      });
                      setRotations(next);
                    }}
                    className="px-3 py-1.5 min-h-[38px] rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] text-xs font-semibold hover:bg-[#EAEAEF] cursor-pointer"
                  >
                    +{deg}°
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setRotations({})}
                  className="px-3 py-1.5 min-h-[38px] rounded-xl text-xs font-semibold text-[#E50920] cursor-pointer"
                >
                  Reset
                </button>
              </div>
              {loadingThumbs ? (
                <p className="text-xs text-[#777777] py-4">Rendering page thumbnails...</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                  {pageThumbs.map((src, idx) => {
                    const deg = rotations[idx] || 0;
                    return (
                      <div
                        key={idx}
                        className="rounded-xl border border-[#E6E6E6] dark:border-[#2A2D34] p-2.5 flex flex-col items-center gap-2"
                      >
                        <div className="w-full aspect-[3/4] bg-[#F5F5F7] dark:bg-[#24272E] rounded-lg overflow-hidden flex items-center justify-center">
                          <img
                            src={src}
                            alt={`Page ${idx + 1}`}
                            style={{ transform: `rotate(${deg}deg)` }}
                            className="max-h-full max-w-full object-contain transition-transform"
                          />
                        </div>
                        <div className="w-full flex items-center justify-between text-xs">
                          <span className="font-mono tabular-nums">P{idx + 1} ({deg}°)</span>
                          <button
                            type="button"
                            onClick={() =>
                              setRotations((r) => ({ ...r, [idx]: ((r[idx] || 0) + 90) % 360 }))
                            }
                            className="p-1.5 rounded-lg bg-[#F5F5F7] dark:bg-[#24272E] text-[#E50920] cursor-pointer"
                            aria-label={`Rotate page ${idx + 1}`}
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* EXTRACT PAGES UI */}
          {toolId === 'extract-pages' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-[#777777] tabular-nums">
                  {extractedIndices.length} of {pageThumbs.length} pages selected for extraction
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setExtractedIndices(pageThumbs.map((_, i) => i))}
                    className="text-xs font-semibold text-[#E50920] cursor-pointer"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => setExtractedIndices([])}
                    className="text-xs font-semibold text-[#777777] cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                {pageThumbs.map((src, idx) => {
                  const active = extractedIndices.includes(idx);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() =>
                        setExtractedIndices((prev) =>
                          prev.includes(idx)
                            ? prev.filter((i) => i !== idx)
                            : [...prev, idx].sort((a, b) => a - b)
                        )
                      }
                      className={`rounded-xl border p-2 text-left transition-all cursor-pointer ${
                        active
                          ? 'border-[#E50920] ring-2 ring-[#E50920]/15'
                          : 'border-[#E6E6E6] dark:border-[#2A2D34] opacity-55'
                      }`}
                    >
                      <img
                        src={src}
                        alt={`Page ${idx + 1}`}
                        className="w-full aspect-[3/4] object-contain bg-[#F5F5F7] dark:bg-[#24272E] rounded-lg"
                      />
                      <p className="text-xs font-semibold text-center mt-1.5 tabular-nums">
                        Page {idx + 1}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* REORDER PAGES UI */}
          {toolId === 'reorder-pages' && (
            <div className="space-y-3">
              <p className="text-xs text-[#777777]">
                Drag page thumbnails or use arrow buttons to set the new order.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                {pageOrder.map((origIdx, posIdx) => (
                  <div
                    key={`${origIdx}-${posIdx}`}
                    draggable
                    onDragStart={() => setDragIdx(posIdx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (dragIdx === null || dragIdx === posIdx) return;
                      setPageOrder((prev) => {
                        const arr = [...prev];
                        const [m] = arr.splice(dragIdx, 1);
                        arr.splice(posIdx, 0, m);
                        return arr;
                      });
                      setDragIdx(null);
                    }}
                    className="rounded-xl border border-[#E6E6E6] dark:border-[#2A2D34] p-2 bg-[#F5F5F7]/50 dark:bg-[#24272E]/50"
                  >
                    <img
                      src={pageThumbs[origIdx]}
                      alt={`Original Page ${origIdx + 1}`}
                      className="w-full aspect-[3/4] object-contain bg-white dark:bg-[#1A1C20] rounded-lg"
                    />
                    <div className="flex items-center justify-between mt-2 text-xs">
                      <span className="font-semibold tabular-nums">#{posIdx + 1} (P{origIdx + 1})</span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          disabled={posIdx === 0}
                          onClick={() =>
                            setPageOrder((prev) => {
                              const arr = [...prev];
                              [arr[posIdx - 1], arr[posIdx]] = [arr[posIdx], arr[posIdx - 1]];
                              return arr;
                            })
                          }
                          className="px-1.5 py-0.5 rounded bg-white dark:bg-[#1A1C20] disabled:opacity-30 cursor-pointer"
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          disabled={posIdx === pageOrder.length - 1}
                          onClick={() =>
                            setPageOrder((prev) => {
                              const arr = [...prev];
                              [arr[posIdx + 1], arr[posIdx]] = [arr[posIdx], arr[posIdx + 1]];
                              return arr;
                            })
                          }
                          className="px-1.5 py-0.5 rounded bg-white dark:bg-[#1A1C20] disabled:opacity-30 cursor-pointer"
                        >
                          →
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* WATERMARK PDF UI */}
          {toolId === 'watermark-pdf' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {(['text', 'image'] as const).map((tp) => (
                  <button
                    key={tp}
                    type="button"
                    onClick={() => setWatermark((w) => ({ ...w, type: tp }))}
                    className={`px-4 py-2 min-h-[40px] rounded-xl text-xs font-semibold capitalize cursor-pointer ${
                      watermark.type === tp
                        ? 'bg-[#E50920] text-white'
                        : 'bg-[#F5F5F7] dark:bg-[#24272E] text-[#202124] dark:text-[#F3F4F6]'
                    }`}
                  >
                    {tp} Watermark
                  </button>
                ))}
              </div>

              {watermark.type === 'text' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#777777] mb-1">Watermark Text</label>
                    <input
                      type="text"
                      value={watermark.text}
                      onChange={(e) => setWatermark((w) => ({ ...w, text: e.target.value }))}
                      className="w-full h-11 px-3.5 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] border border-[#E6E6E6] dark:border-[#343842] text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#777777] mb-1">Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={watermark.color}
                        onChange={(e) => setWatermark((w) => ({ ...w, color: e.target.value }))}
                        className="w-11 h-11 rounded-xl border border-[#E6E6E6] cursor-pointer"
                      />
                      <span className="text-xs font-mono text-[#777777]">{watermark.color}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => wmImgInputRef.current?.click()}
                    className="px-4 py-2.5 min-h-[44px] rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] text-xs font-semibold cursor-pointer"
                  >
                    Choose Watermark Image (PNG/JPG)
                  </button>
                  {watermark.imageDataUrl && (
                    <img src={watermark.imageDataUrl} alt="Watermark" className="h-11 rounded border" />
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <label className="space-y-1">
                  <span className="flex justify-between text-[#777777]">
                    <span>Opacity</span>
                    <span className="tabular-nums">{Math.round(watermark.opacity * 100)}%</span>
                  </span>
                  <input
                    type="range"
                    min={5}
                    max={90}
                    value={Math.round(watermark.opacity * 100)}
                    onChange={(e) =>
                      setWatermark((w) => ({ ...w, opacity: Number(e.target.value) / 100 }))
                    }
                    className="w-full accent-[#E50920]"
                  />
                </label>

                <label className="space-y-1">
                  <span className="flex justify-between text-[#777777]">
                    <span>Size</span>
                    <span className="tabular-nums">{watermark.size}</span>
                  </span>
                  <input
                    type="range"
                    min={14}
                    max={80}
                    value={watermark.size}
                    onChange={(e) => setWatermark((w) => ({ ...w, size: Number(e.target.value) }))}
                    className="w-full accent-[#E50920]"
                  />
                </label>

                <label className="space-y-1">
                  <span className="flex justify-between text-[#777777]">
                    <span>Rotation</span>
                    <span className="tabular-nums">{watermark.rotation}°</span>
                  </span>
                  <input
                    type="range"
                    min={-90}
                    max={90}
                    value={watermark.rotation}
                    onChange={(e) =>
                      setWatermark((w) => ({ ...w, rotation: Number(e.target.value) }))
                    }
                    className="w-full accent-[#E50920]"
                  />
                </label>

                <div>
                  <label className="block text-[#777777] mb-1">Position</label>
                  <select
                    value={watermark.position}
                    onChange={(e) =>
                      setWatermark((w) => ({ ...w, position: e.target.value as WatermarkPosition }))
                    }
                    className="w-full h-10 px-2.5 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] border border-[#E6E6E6] dark:border-[#343842] text-xs"
                  >
                    <option value="center">Center</option>
                    <option value="top-left">Top Left</option>
                    <option value="top-right">Top Right</option>
                    <option value="bottom-left">Bottom Left</option>
                    <option value="bottom-right">Bottom Right</option>
                    <option value="tile">Tiled Pattern</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* PDF TO IMAGES UI */}
          {toolId === 'pdf-to-images' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#777777] mb-1">Format</label>
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E]">
                  {(['png', 'jpeg'] as const).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setImgFormat(fmt)}
                      className={`h-9 rounded-lg text-xs font-bold uppercase cursor-pointer ${
                        imgFormat === fmt
                          ? 'bg-white dark:bg-[#1A1C20] text-[#E50920] shadow-xs'
                          : 'text-[#777777]'
                      }`}
                    >
                      {fmt === 'jpeg' ? 'JPG' : 'PNG'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#777777] mb-1">Resolution (DPI)</label>
                <select
                  value={imgScale}
                  onChange={(e) => setImgScale(Number(e.target.value))}
                  className="w-full h-11 px-3 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] border border-[#E6E6E6] dark:border-[#343842] text-sm"
                >
                  <option value={1}>Standard (72 DPI)</option>
                  <option value={1.5}>High (150 DPI)</option>
                  <option value={2.2}>Ultra HD (220 DPI)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#777777] mb-1">
                  Quality ({Math.round(imgQuality * 100)}%)
                </label>
                <input
                  type="range"
                  min={40}
                  max={100}
                  value={Math.round(imgQuality * 100)}
                  onChange={(e) => setImgQuality(Number(e.target.value) / 100)}
                  className="w-full mt-2 accent-[#E50920]"
                />
              </div>
            </div>
          )}

          {/* PDF TO WORD INFO */}
          {toolId === 'pdf-to-word' && activeSingleSource && (
            <p className="text-sm text-[#777777] dark:text-[#9CA3AF]">
              Ready to extract text across all <strong className="text-[#202124] dark:text-[#F3F4F6]">{activeSingleSource.pageCount}</strong> pages of{' '}
              <strong className="text-[#202124] dark:text-[#F3F4F6]">{activeSingleSource.name}</strong> into a standard Word (.docx) file completely offline.
            </p>
          )}

          {/* Execute Button / Progress */}
          {processing ? (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-[#E50920] animate-spin" />
                  Processing locally...
                </span>
                <span className="tabular-nums text-[#E50920]">{progress}%</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-[#F5F5F7] dark:bg-[#24272E] overflow-hidden">
                <div
                  className="h-full bg-[#E50920] transition-all rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleExecute}
              className="w-full sm:w-auto px-7 py-3 min-h-[48px] rounded-xl bg-[#E50920] hover:bg-[#B81024] text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              Run {meta.title}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
