import React, { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  Share2,
  Plus,
  FileText,
  Lock,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  AppSettings,
  createDefaultPdfSettings,
  DocumentImportItem,
  FolderRecord,
  ImageItem,
  PdfCreationSettings,
  PdfFileRecord,
  ToolId,
} from '../types/pdf';
import {
  convertDocumentsToPdf,
  createPdfFromImages,
  shareOrDownloadFile,
} from '../services/pdfEngine';
import { formatBytes } from '../storage/db';

interface PdfCreationWorkspaceProps {
  mode: 'images' | 'documents';
  sourceTool: ToolId;
  images?: ImageItem[];
  documents?: DocumentImportItem[];
  appSettings: AppSettings;
  folders: FolderRecord[];
  onBack: () => void;
  onCreated: (
    fileRecord: PdfFileRecord,
    inputNames: string[]
  ) => Promise<void>;
  onOpenFile: (file: PdfFileRecord) => void;
  onCreateAnother: () => void;
}

export const PdfCreationWorkspace: React.FC<PdfCreationWorkspaceProps> = ({
  mode,
  sourceTool,
  images = [],
  documents = [],
  appSettings,
  folders,
  onBack,
  onCreated,
  onOpenFile,
  onCreateAnother,
}) => {
  const [settings, setSettings] = useState<PdfCreationSettings>(() => {
    const base = createDefaultPdfSettings(appSettings);
    if (sourceTool === 'camera-to-pdf' || sourceTool === 'scan-document') {
      base.folderId = 'scanned';
      base.fileName = 'Scanned Document';
    } else if (mode === 'documents') {
      base.folderId = 'converted';
      if (documents.length === 1) {
        base.fileName = documents[0].name.replace(/\.[^.]+$/, '');
      }
    }
    return base;
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdFile, setCreatedFile] = useState<PdfFileRecord | null>(null);

  const update = <K extends keyof PdfCreationSettings>(
    key: K,
    val: PdfCreationSettings[K]
  ) => setSettings((prev) => ({ ...prev, [key]: val }));

  const handleGenerate = async () => {
    setGenerating(true);
    setProgress(8);
    setErrorMsg(null);
    try {
      const cleanName = (settings.fileName.trim() || 'My Document').replace(/\.pdf$/i, '');
      const finalFileName = `${cleanName}.pdf`;

      const result =
        mode === 'images'
          ? await createPdfFromImages(images, settings, setProgress)
          : await convertDocumentsToPdf(documents, settings, setProgress);

      const arrayBuffer = result.bytes.buffer.slice(
        result.bytes.byteOffset,
        result.bytes.byteOffset + result.bytes.byteLength
      ) as ArrayBuffer;

      const record: PdfFileRecord = {
        id: crypto.randomUUID(),
        name: finalFileName,
        extension: 'pdf',
        category: 'pdf',
        mimeType: 'application/pdf',
        size: result.bytes.byteLength,
        pageCount: result.pageCount,
        status: 'completed',
        folderId: settings.folderId || 'created',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        thumbnailDataUrl: result.thumbnailDataUrl,
        data: arrayBuffer,
        bookmarks: [],
        password: settings.password.trim() || undefined,
        sourceTool,
        metadata: {
          author: settings.author.trim() || undefined,
          subject: settings.subject.trim() || undefined,
          keywords: settings.keywords.trim() || undefined,
        },
      };

      const inputs =
        mode === 'images' ? images.map((i) => i.name) : documents.map((d) => d.name);

      await onCreated(record, inputs);
      setCreatedFile(record);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to generate PDF. Please check your input files.'
      );
    } finally {
      setGenerating(false);
    }
  };

  // Success Screen
  if (createdFile) {
    return (
      <div className="max-w-xl mx-auto py-8">
        <div className="bg-white dark:bg-[#1A1C20] rounded-3xl border border-[#E6E6E6] dark:border-[#2A2D34] p-6 sm:p-8 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-[#25A55B]/12 text-[#25A55B] mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-xl sm:text-2xl font-bold text-[#202124] dark:text-[#F3F4F6]">
              PDF Created Successfully
            </h1>
            <p className="text-sm text-[#777777] dark:text-[#9CA3AF]">
              Saved locally to your library and added to Completed Files.
            </p>
          </div>

          <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#F5F5F7] dark:bg-[#24272E] text-left">
            <div className="w-14 h-18 rounded-lg bg-white dark:bg-[#1A1C20] border border-[#E6E6E6] dark:border-[#343842] overflow-hidden shrink-0 flex items-center justify-center">
              {createdFile.thumbnailDataUrl ? (
                <img
                  src={createdFile.thumbnailDataUrl}
                  alt={createdFile.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <FileText className="w-6 h-6 text-[#E50920]" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[#202124] dark:text-[#F3F4F6] truncate flex items-center gap-1.5">
                {createdFile.password && <Lock className="w-3.5 h-3.5 text-[#E50920]" />}
                <span className="truncate">{createdFile.name}</span>
              </p>
              <p className="text-xs text-[#777777] dark:text-[#9CA3AF] tabular-nums mt-1">
                {formatBytes(createdFile.size)} · {createdFile.pageCount}{' '}
                {createdFile.pageCount === 1 ? 'page' : 'pages'} · Offline PDF
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <button
              type="button"
              onClick={() => onOpenFile(createdFile)}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[48px] rounded-xl bg-[#E50920] hover:bg-[#B81024] text-white text-sm font-semibold cursor-pointer whitespace-nowrap"
            >
              <Eye className="w-4 h-4" />
              <span>Open PDF</span>
            </button>
            <button
              type="button"
              onClick={() => shareOrDownloadFile(createdFile.data, createdFile.name)}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[48px] rounded-xl bg-[#202124] dark:bg-[#F3F4F6] text-white dark:text-[#111215] text-sm font-semibold cursor-pointer whitespace-nowrap"
            >
              <Share2 className="w-4 h-4" />
              <span>Share PDF</span>
            </button>
            <button
              type="button"
              onClick={onCreateAnother}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[48px] rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] hover:bg-[#EAEAEF] dark:hover:bg-[#2E323B] text-[#202124] dark:text-[#F3F4F6] text-sm font-semibold cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Create Another</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={generating}
          className="min-w-[44px] min-h-[44px] rounded-xl bg-white dark:bg-[#1A1C20] border border-[#E6E6E6] dark:border-[#2A2D34] flex items-center justify-center text-[#202124] dark:text-[#F3F4F6] cursor-pointer"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-[#202124] dark:text-[#F3F4F6]">
            PDF Creation Settings
          </h1>
          <p className="text-xs text-[#777777] dark:text-[#9CA3AF] tabular-nums">
            {mode === 'images'
              ? `${images.length} ${images.length === 1 ? 'image' : 'images'} queued`
              : `${documents.length} ${documents.length === 1 ? 'document' : 'documents'} queued`}
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-[#E50920]/10 border border-[#E50920]/30 text-sm text-[#B81024] dark:text-red-300">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Live Page Layout Preview */}
        <div className="lg:col-span-5 bg-white dark:bg-[#1A1C20] rounded-2xl border border-[#E6E6E6] dark:border-[#2A2D34] p-5 space-y-4 lg:sticky lg:top-20">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#202124] dark:text-[#F3F4F6]">
              Page Preview
            </h2>
            <span className="text-xs text-[#777777] dark:text-[#9CA3AF] tabular-nums">
              {settings.pageSize} · {settings.orientation}
            </span>
          </div>

          <div className="flex items-center justify-center bg-[#F5F5F7] dark:bg-[#111215] rounded-xl p-6">
            <div
              className="relative shadow-md border border-[#E6E6E6] dark:border-[#343842] transition-all flex flex-col justify-between overflow-hidden"
              style={{
                backgroundColor: settings.backgroundColor,
                width: settings.orientation === 'landscape' ? '260px' : '200px',
                height: settings.orientation === 'landscape' ? '186px' : '282px',
                padding:
                  settings.margins === 'none'
                    ? '4px'
                    : settings.margins === 'small'
                    ? '10px'
                    : settings.margins === 'medium'
                    ? '18px'
                    : '26px',
              }}
            >
              {(settings.headerText || settings.includeDateTime) && (
                <div className="flex items-center justify-between text-[8px] text-gray-500 pb-1">
                  <span className="truncate">{settings.headerText}</span>
                  {settings.includeDateTime && <span>{new Date().toLocaleDateString()}</span>}
                </div>
              )}

              <div
                className="flex-1 grid gap-1.5 overflow-hidden items-center justify-items-center"
                style={{
                  gridTemplateColumns:
                    settings.pageLayout === '1'
                      ? '1fr'
                      : settings.pageLayout === '2'
                      ? '1fr'
                      : settings.pageLayout === '4'
                      ? '1fr 1fr'
                      : `repeat(${settings.customCols}, 1fr)`,
                }}
              >
                {mode === 'images' ? (
                  images
                    .slice(
                      0,
                      settings.pageLayout === '1'
                        ? 1
                        : settings.pageLayout === '2'
                        ? 2
                        : settings.pageLayout === '4'
                        ? 4
                        : settings.customCols * settings.customRows
                    )
                    .map((img) => (
                      <img
                        key={img.id}
                        src={img.processedDataUrl}
                        alt={img.name}
                        className={`w-full h-full ${
                          settings.imageFit === 'fill' ? 'object-cover' : 'object-contain'
                        }`}
                      />
                    ))
                ) : (
                  <div className="w-full h-full flex flex-col justify-start p-2 gap-1.5 text-left">
                    <div className="h-2.5 w-3/4 bg-[#202124]/80 rounded-xs" />
                    <div className="h-0.5 w-full bg-[#E50920]" />
                    <div className="h-1.5 w-full bg-gray-300 rounded-xs mt-1" />
                    <div className="h-1.5 w-5/6 bg-gray-300 rounded-xs" />
                    <div className="h-1.5 w-11/12 bg-gray-300 rounded-xs" />
                    <div className="h-1.5 w-2/3 bg-gray-300 rounded-xs" />
                  </div>
                )}
              </div>

              {(settings.footerText || settings.showPageNumbers) && (
                <div className="flex items-center justify-between text-[8px] text-gray-500 pt-1">
                  <span className="truncate">{settings.footerText}</span>
                  {settings.showPageNumbers && <span>Page 1</span>}
                </div>
              )}

              {settings.watermarkText && (
                <div
                  className="absolute inset-0 flex items-center justify-center pointer-events-none select-none font-bold text-[#E50920] text-lg -rotate-35"
                  style={{ opacity: settings.watermarkOpacity }}
                >
                  {settings.watermarkText}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Settings Form */}
        <div className="lg:col-span-7 space-y-5">
          {/* Core Settings Card */}
          <div className="bg-white dark:bg-[#1A1C20] rounded-2xl border border-[#E6E6E6] dark:border-[#2A2D34] p-5 space-y-5">
            {/* File Name & Destination Folder */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#777777] dark:text-[#9CA3AF] mb-1.5">
                  File Name
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={settings.fileName}
                    onChange={(e) => update('fileName', e.target.value)}
                    placeholder="My Document"
                    className="flex-1 h-11 px-3.5 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] border border-[#E6E6E6] dark:border-[#343842] text-sm text-[#202124] dark:text-[#F3F4F6] focus:outline-none focus:border-[#E50920]"
                  />
                  <span className="text-xs font-mono text-[#777777]">.pdf</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#777777] dark:text-[#9CA3AF] mb-1.5">
                  Save to Folder
                </label>
                <select
                  value={settings.folderId}
                  onChange={(e) => update('folderId', e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] border border-[#E6E6E6] dark:border-[#343842] text-sm text-[#202124] dark:text-[#F3F4F6]"
                >
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Page Size & Orientation */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#777777] dark:text-[#9CA3AF] mb-1.5">
                  Page Size
                </label>
                <select
                  value={settings.pageSize}
                  onChange={(e) => update('pageSize', e.target.value as PdfCreationSettings['pageSize'])}
                  className="w-full h-11 px-3.5 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] border border-[#E6E6E6] dark:border-[#343842] text-sm text-[#202124] dark:text-[#F3F4F6]"
                >
                  <option value="A4">A4 (210 × 297 mm)</option>
                  <option value="A3">A3 (297 × 420 mm)</option>
                  <option value="A5">A5 (148 × 210 mm)</option>
                  <option value="Letter">Letter (8.5 × 11 in)</option>
                  <option value="Legal">Legal (8.5 × 14 in)</option>
                  <option value="Custom">Custom Size (mm)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#777777] dark:text-[#9CA3AF] mb-1.5">
                  Page Orientation
                </label>
                <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E]">
                  {(['portrait', 'landscape', 'auto'] as const).map((o) => (
                    <button
                      key={o}
                      type="button"
                      onClick={() => update('orientation', o)}
                      className={`h-9 rounded-lg text-xs font-semibold capitalize transition-colors cursor-pointer ${
                        settings.orientation === o
                          ? 'bg-white dark:bg-[#1A1C20] text-[#E50920] shadow-xs'
                          : 'text-[#777777] dark:text-[#9CA3AF]'
                      }`}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {settings.pageSize === 'Custom' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-[#777777] mb-1">Custom Width (mm)</label>
                  <input
                    type="number"
                    min={50}
                    max={1000}
                    value={settings.customWidthMm}
                    onChange={(e) => update('customWidthMm', Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] border border-[#E6E6E6] dark:border-[#343842] text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#777777] mb-1">Custom Height (mm)</label>
                  <input
                    type="number"
                    min={50}
                    max={1000}
                    value={settings.customHeightMm}
                    onChange={(e) => update('customHeightMm', Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] border border-[#E6E6E6] dark:border-[#343842] text-sm tabular-nums"
                  />
                </div>
              </div>
            )}

            {/* Margins & Quality */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#777777] dark:text-[#9CA3AF] mb-1.5">
                  Margins
                </label>
                <select
                  value={settings.margins}
                  onChange={(e) => update('margins', e.target.value as PdfCreationSettings['margins'])}
                  className="w-full h-11 px-3.5 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] border border-[#E6E6E6] dark:border-[#343842] text-sm text-[#202124] dark:text-[#F3F4F6]"
                >
                  <option value="none">No Margin (0 mm)</option>
                  <option value="small">Small (10 mm)</option>
                  <option value="medium">Medium (20 mm)</option>
                  <option value="large">Large (32 mm)</option>
                  <option value="custom">Custom Margin</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#777777] dark:text-[#9CA3AF] mb-1.5">
                  Image Quality
                </label>
                <select
                  value={settings.imageQuality}
                  onChange={(e) =>
                    update('imageQuality', e.target.value as PdfCreationSettings['imageQuality'])
                  }
                  className="w-full h-11 px-3.5 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] border border-[#E6E6E6] dark:border-[#343842] text-sm text-[#202124] dark:text-[#F3F4F6]"
                >
                  <option value="low">Low (Small file size)</option>
                  <option value="medium">Medium (Balanced)</option>
                  <option value="high">High (Recommended)</option>
                  <option value="ultra">Ultra HD (Maximum detail)</option>
                </select>
              </div>
            </div>

            {settings.margins === 'custom' && (
              <div>
                <label className="block text-xs text-[#777777] mb-1">
                  Custom Margin ({settings.customMarginMm} mm)
                </label>
                <input
                  type="range"
                  min={0}
                  max={50}
                  value={settings.customMarginMm}
                  onChange={(e) => update('customMarginMm', Number(e.target.value))}
                  className="w-full accent-[#E50920]"
                />
              </div>
            )}

            {/* Image Fit & Page Layout (for images) */}
            {mode === 'images' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#777777] dark:text-[#9CA3AF] mb-1.5">
                    Image Fit
                  </label>
                  <select
                    value={settings.imageFit}
                    onChange={(e) =>
                      update('imageFit', e.target.value as PdfCreationSettings['imageFit'])
                    }
                    className="w-full h-11 px-3.5 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] border border-[#E6E6E6] dark:border-[#343842] text-sm text-[#202124] dark:text-[#F3F4F6]"
                  >
                    <option value="fit">Fit to Page</option>
                    <option value="fill">Fill Page</option>
                    <option value="original">Original Size</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#777777] dark:text-[#9CA3AF] mb-1.5">
                    Page Layout
                  </label>
                  <select
                    value={settings.pageLayout}
                    onChange={(e) =>
                      update('pageLayout', e.target.value as PdfCreationSettings['pageLayout'])
                    }
                    className="w-full h-11 px-3.5 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] border border-[#E6E6E6] dark:border-[#343842] text-sm text-[#202124] dark:text-[#F3F4F6]"
                  >
                    <option value="1">1 image per page</option>
                    <option value="2">2 images per page</option>
                    <option value="4">4 images per page</option>
                    <option value="custom">Custom layout</option>
                  </select>
                </div>
              </div>
            )}

            {mode === 'images' && settings.pageLayout === 'custom' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-[#777777] mb-1">Columns (1–4)</label>
                  <input
                    type="number"
                    min={1}
                    max={4}
                    value={settings.customCols}
                    onChange={(e) => update('customCols', Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] border border-[#E6E6E6] dark:border-[#343842] text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#777777] mb-1">Rows (1–4)</label>
                  <input
                    type="number"
                    min={1}
                    max={4}
                    value={settings.customRows}
                    onChange={(e) => update('customRows', Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] border border-[#E6E6E6] dark:border-[#343842] text-sm tabular-nums"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Additional Settings Collapsible */}
          <div className="bg-white dark:bg-[#1A1C20] rounded-2xl border border-[#E6E6E6] dark:border-[#2A2D34] overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="w-full flex items-center justify-between px-5 py-4 min-h-[54px] text-left cursor-pointer hover:bg-[#F5F5F7]/60 dark:hover:bg-[#24272E]/50"
            >
              <div>
                <h2 className="text-sm font-bold text-[#202124] dark:text-[#F3F4F6]">
                  Additional Settings
                </h2>
                <p className="text-xs text-[#777777] dark:text-[#9CA3AF]">
                  Background color, page numbers, header/footer, watermark, password & metadata
                </p>
              </div>
              {showAdvanced ? (
                <ChevronUp className="w-5 h-5 text-[#777777]" />
              ) : (
                <ChevronDown className="w-5 h-5 text-[#777777]" />
              )}
            </button>

            {showAdvanced && (
              <div className="p-5 pt-2 border-t border-[#E6E6E6] dark:border-[#2A2D34] space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#777777] mb-1">
                      Background Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={settings.backgroundColor}
                        onChange={(e) => update('backgroundColor', e.target.value)}
                        className="w-10 h-10 rounded-lg border border-[#E6E6E6] cursor-pointer"
                      />
                      <span className="text-xs font-mono text-[#777777]">
                        {settings.backgroundColor}
                      </span>
                    </div>
                  </div>
                  <label className="flex items-center gap-2.5 text-sm text-[#202124] dark:text-[#F3F4F6] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.showPageNumbers}
                      onChange={(e) => update('showPageNumbers', e.target.checked)}
                      className="w-4 h-4 accent-[#E50920]"
                    />
                    <span>Page Numbers</span>
                  </label>
                  <label className="flex items-center gap-2.5 text-sm text-[#202124] dark:text-[#F3F4F6] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.includeDateTime}
                      onChange={(e) => update('includeDateTime', e.target.checked)}
                      className="w-4 h-4 accent-[#E50920]"
                    />
                    <span>Date & Time</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#777777] mb-1">Header Text</label>
                    <input
                      type="text"
                      value={settings.headerText}
                      onChange={(e) => update('headerText', e.target.value)}
                      placeholder="Optional header"
                      className="w-full h-10 px-3 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] border border-[#E6E6E6] dark:border-[#343842] text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#777777] mb-1">Footer Text</label>
                    <input
                      type="text"
                      value={settings.footerText}
                      onChange={(e) => update('footerText', e.target.value)}
                      placeholder="Optional footer"
                      className="w-full h-10 px-3 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] border border-[#E6E6E6] dark:border-[#343842] text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#777777] mb-1">Watermark</label>
                    <input
                      type="text"
                      value={settings.watermarkText}
                      onChange={(e) => update('watermarkText', e.target.value)}
                      placeholder="e.g. CONFIDENTIAL"
                      className="w-full h-10 px-3 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] border border-[#E6E6E6] dark:border-[#343842] text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#777777] mb-1">
                      Password Protection
                    </label>
                    <input
                      type="password"
                      value={settings.password}
                      onChange={(e) => update('password', e.target.value)}
                      placeholder="Optional lock password"
                      className="w-full h-10 px-3 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] border border-[#E6E6E6] dark:border-[#343842] text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#777777] mb-1">Author</label>
                    <input
                      type="text"
                      value={settings.author}
                      onChange={(e) => update('author', e.target.value)}
                      placeholder="Author name"
                      className="w-full h-10 px-3 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] border border-[#E6E6E6] dark:border-[#343842] text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#777777] mb-1">Subject</label>
                    <input
                      type="text"
                      value={settings.subject}
                      onChange={(e) => update('subject', e.target.value)}
                      placeholder="Document subject"
                      className="w-full h-10 px-3 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] border border-[#E6E6E6] dark:border-[#343842] text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#777777] mb-1">Keywords</label>
                    <input
                      type="text"
                      value={settings.keywords}
                      onChange={(e) => update('keywords', e.target.value)}
                      placeholder="invoice, receipt"
                      className="w-full h-10 px-3 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] border border-[#E6E6E6] dark:border-[#343842] text-sm"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Progress Bar or Generate Button */}
          {generating ? (
            <div className="bg-white dark:bg-[#1A1C20] rounded-2xl border border-[#E6E6E6] dark:border-[#2A2D34] p-5 space-y-3">
              <div className="flex items-center justify-between text-sm font-semibold text-[#202124] dark:text-[#F3F4F6]">
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-[#E50920] animate-spin" />
                  Generating PDF offline...
                </span>
                <span className="tabular-nums text-[#E50920]">{progress}%</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-[#F5F5F7] dark:bg-[#24272E] overflow-hidden">
                <div
                  className="h-full bg-[#E50920] transition-all duration-200 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleGenerate}
              className="w-full min-h-[52px] rounded-2xl bg-[#E50920] hover:bg-[#B81024] text-white text-base font-semibold transition-colors active:scale-[0.99] cursor-pointer shadow-sm"
            >
              Generate PDF
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
