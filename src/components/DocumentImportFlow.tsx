import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Upload,
  FileText,
  FileSpreadsheet,
  Presentation,
  FileType,
  Image as ImageIcon,
  CheckSquare,
  Square,
  Trash2,
  ArrowRight,
  Eye,
  X,
} from 'lucide-react';
import { DocumentImportItem, FileCategory } from '../types/pdf';
import { formatBytes } from '../storage/db';

interface DocumentImportFlowProps {
  title?: string;
  acceptOverride?: string;
  helperLabel?: string;
  onBack: () => void;
  onContinue: (selectedDocs: DocumentImportItem[]) => void;
}

function detectCategory(ext: string): FileCategory {
  const e = ext.toLowerCase();
  if (e === 'pdf') return 'pdf';
  if (['doc', 'docx'].includes(e)) return 'word';
  if (['xls', 'xlsx', 'csv'].includes(e)) return 'excel';
  if (['ppt', 'pptx'].includes(e)) return 'powerpoint';
  if (['jpg', 'jpeg', 'png', 'webp'].includes(e)) return 'image';
  return 'document';
}

function getCategoryIcon(cat: FileCategory) {
  switch (cat) {
    case 'word':
      return { Icon: FileType, color: '#2B579A' };
    case 'excel':
      return { Icon: FileSpreadsheet, color: '#1E7145' };
    case 'powerpoint':
      return { Icon: Presentation, color: '#C2410C' };
    case 'image':
      return { Icon: ImageIcon, color: '#D97706' };
    case 'pdf':
      return { Icon: FileText, color: '#E50920' };
    default:
      return { Icon: FileText, color: '#0D9488' };
  }
}

export const DocumentImportFlow: React.FC<DocumentImportFlowProps> = ({
  title = 'Import Documents',
  acceptOverride = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png',
  helperLabel = 'PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, JPG, PNG',
  onBack,
  onContinue,
}) => {
  const [docs, setDocs] = useState<DocumentImportItem[]>([]);
  const [sortBy, setSortBy] = useState<'added' | 'name' | 'size'>('added');
  const [previewDoc, setPreviewDoc] = useState<DocumentImportItem | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const added: DocumentImportItem[] = [];
    for (const file of Array.from(fileList)) {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'txt';
      const category = detectCategory(ext);
      let previewText: string | undefined;
      let previewDataUrl: string | undefined;

      if (category === 'image') {
        previewDataUrl = await new Promise<string>((res) => {
          const fr = new FileReader();
          fr.onload = () => res(String(fr.result));
          fr.readAsDataURL(file);
        });
      } else if (ext === 'txt' || ext === 'csv') {
        previewText = (await file.text()).slice(0, 1200);
      } else {
        previewText = `${file.name} (${ext.toUpperCase()}) · Ready for offline PDF conversion.`;
      }

      added.push({
        id: crypto.randomUUID(),
        name: file.name,
        extension: ext,
        category,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        file,
        previewText,
        previewDataUrl,
        selected: true,
        addedAt: Date.now() + added.length,
      });
    }
    setDocs((prev) => [...prev, ...added]);
    if (inputRef.current) inputRef.current.value = '';
  };

  const sortedDocs = useMemo(() => {
    const copy = [...docs];
    if (sortBy === 'name') copy.sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === 'size') copy.sort((a, b) => b.size - a.size);
    return copy;
  }, [docs, sortBy]);

  const selectedDocs = sortedDocs.filter((d) => d.selected);

  return (
    <div className="space-y-6 pb-24">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={acceptOverride}
        onChange={(e) => handleFilesSelected(e.target.files)}
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
              {title}
            </h1>
            <p className="text-xs text-[#777777] dark:text-[#9CA3AF]">
              Supported: {helperLabel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {docs.length > 0 && (
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              aria-label="Sort imported documents"
              className="h-11 px-3 rounded-xl bg-white dark:bg-[#1A1C20] border border-[#E6E6E6] dark:border-[#2A2D34] text-xs sm:text-sm text-[#202124] dark:text-[#F3F4F6]"
            >
              <option value="added">Order Added</option>
              <option value="name">Name A–Z</option>
              <option value="size">Largest First</option>
            </select>
          )}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-[#202124] dark:bg-[#F3F4F6] text-white dark:text-[#111215] text-sm font-medium cursor-pointer whitespace-nowrap"
          >
            <Upload className="w-4 h-4" />
            <span>Add Files</span>
          </button>
        </div>
      </div>

      {/* Picker Dropzone or List */}
      {docs.length === 0 ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFilesSelected(e.dataTransfer.files);
          }}
          className="bg-white dark:bg-[#1A1C20] rounded-2xl border-2 border-dashed border-[#E6E6E6] dark:border-[#343842] hover:border-[#E50920]/60 p-10 sm:p-14 text-center flex flex-col items-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-[#E50920]/10 text-[#E50920] flex items-center justify-center mb-4">
            <FileText className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-[#202124] dark:text-[#F3F4F6] mb-1.5">
            Select documents to convert to PDF
          </h2>
          <p className="text-sm text-[#777777] dark:text-[#9CA3AF] max-w-md mb-6">
            Import Word, Excel, PowerPoint, Text, PDF, or Image files. Everything is parsed and converted offline on your device.
          </p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 px-6 py-3 min-h-[48px] rounded-xl bg-[#E50920] hover:bg-[#B81024] text-white text-sm font-semibold cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Browse Device Files</span>
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1A1C20] rounded-2xl border border-[#E6E6E6] dark:border-[#2A2D34] divide-y divide-[#E6E6E6] dark:divide-[#2A2D34] overflow-hidden">
          {sortedDocs.map((doc) => {
            const { Icon, color } = getCategoryIcon(doc.category);
            return (
              <div
                key={doc.id}
                className="flex items-center gap-3.5 px-4 py-3.5 hover:bg-[#F5F5F7]/70 dark:hover:bg-[#24272E]/60 transition-colors"
              >
                <button
                  type="button"
                  onClick={() =>
                    setDocs((prev) =>
                      prev.map((d) => (d.id === doc.id ? { ...d, selected: !d.selected } : d))
                    )
                  }
                  className="min-w-[40px] min-h-[40px] flex items-center justify-center cursor-pointer"
                  aria-label="Toggle document selection"
                >
                  {doc.selected ? (
                    <CheckSquare className="w-5 h-5 text-[#E50920]" />
                  ) : (
                    <Square className="w-5 h-5 text-[#777777]" />
                  )}
                </button>

                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
                  style={{ backgroundColor: `${color}15`, color }}
                >
                  {doc.previewDataUrl ? (
                    <img src={doc.previewDataUrl} alt={doc.name} className="w-full h-full object-cover" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#202124] dark:text-[#F3F4F6] truncate">
                    {doc.name}
                  </p>
                  <p className="text-xs text-[#777777] dark:text-[#9CA3AF] tabular-nums mt-0.5">
                    {doc.extension.toUpperCase()} · {formatBytes(doc.size)}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setPreviewDoc(doc)}
                    className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-[#777777] hover:text-[#202124] dark:hover:text-[#F3F4F6] hover:bg-[#F5F5F7] dark:hover:bg-[#2E323B] cursor-pointer"
                    aria-label="Preview document"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocs((prev) => prev.filter((d) => d.id !== doc.id))}
                    className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-[#E50920] hover:bg-[#E50920]/10 cursor-pointer"
                    aria-label="Remove document"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sticky Continue Bar */}
      {docs.length > 0 && (
        <div className="fixed bottom-16 lg:bottom-0 left-0 lg:left-64 right-0 z-30 bg-white/95 dark:bg-[#1A1C20]/95 backdrop-blur-md border-t border-[#E6E6E6] dark:border-[#2A2D34] px-4 sm:px-6 py-3">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
            <span className="text-sm font-semibold text-[#202124] dark:text-[#F3F4F6] tabular-nums">
              {selectedDocs.length} {selectedDocs.length === 1 ? 'document' : 'documents'} selected
            </span>
            <button
              type="button"
              disabled={selectedDocs.length === 0}
              onClick={() => onContinue(selectedDocs)}
              className="inline-flex items-center gap-2 px-6 py-2.5 min-h-[46px] rounded-xl bg-[#E50920] hover:bg-[#B81024] disabled:opacity-45 text-white text-sm font-semibold cursor-pointer whitespace-nowrap"
            >
              <span>Continue to PDF Settings</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4"
          onClick={() => setPreviewDoc(null)}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-[#1A1C20] rounded-2xl border border-[#E6E6E6] dark:border-[#2A2D34] overflow-hidden shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E6E6E6] dark:border-[#2A2D34]">
              <h3 className="text-sm font-bold text-[#202124] dark:text-[#F3F4F6] truncate">
                {previewDoc.name}
              </h3>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-[#777777] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 max-h-[60vh] overflow-y-auto">
              {previewDoc.previewDataUrl ? (
                <img
                  src={previewDoc.previewDataUrl}
                  alt={previewDoc.name}
                  className="max-h-96 mx-auto rounded-lg object-contain"
                />
              ) : (
                <pre className="text-xs font-mono whitespace-pre-wrap text-[#202124] dark:text-[#F3F4F6] bg-[#F5F5F7] dark:bg-[#24272E] p-4 rounded-xl">
                  {previewDoc.previewText}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
