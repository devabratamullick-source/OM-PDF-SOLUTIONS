import React from 'react';
import {
  Image as ImageIcon,
  Camera,
  FileText,
  ScanLine,
  Layers,
  Scissors,
  Minimize2,
  Images,
  FileType,
  FileSpreadsheet,
  Presentation,
  FileEdit,
  MoreVertical,
  ArrowRight,
  Lock,
  CheckCircle2,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { HOME_QUICK_ACTIONS, UI_STRINGS } from '../constants/tools';
import { LanguageCode, PdfFileRecord, ToolId } from '../types/pdf';
import { formatBytes, formatDateShort } from '../storage/db';
import { EmptyState } from './EmptyState';

export function getToolIcon(id: ToolId) {
  switch (id) {
    case 'images-to-pdf':
      return ImageIcon;
    case 'camera-to-pdf':
      return Camera;
    case 'documents-to-pdf':
      return FileText;
    case 'scan-document':
      return ScanLine;
    case 'merge-pdf':
      return Layers;
    case 'split-pdf':
      return Scissors;
    case 'compress-pdf':
      return Minimize2;
    case 'pdf-to-images':
      return Images;
    case 'pdf-to-word':
      return FileEdit;
    case 'word-to-pdf':
      return FileType;
    case 'excel-to-pdf':
      return FileSpreadsheet;
    case 'ppt-to-pdf':
      return Presentation;
    default:
      return FileText;
  }
}

interface HomeScreenProps {
  files: PdfFileRecord[];
  language: LanguageCode;
  hideThumbnails: boolean;
  onLaunchTool: (toolId: ToolId) => void;
  onOpenFile: (file: PdfFileRecord) => void;
  onMoreOptions: (file: PdfFileRecord) => void;
  onSeeAllFiles: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  files,
  language,
  hideThumbnails,
  onLaunchTool,
  onOpenFile,
  onMoreOptions,
  onSeeAllFiles,
}) => {
  const t = UI_STRINGS[language] || UI_STRINGS.en;
  const recentFiles = [...files]
    .sort((a, b) => (b.lastOpenedAt || b.createdAt) - (a.lastOpenedAt || a.createdAt))
    .slice(0, 6);

  return (
    <div className="space-y-8 pb-6">
      {/* Compact Primary Action Hero Strip */}
      <section className="bg-white dark:bg-[#1A1C20] rounded-2xl border border-[#E6E6E6] dark:border-[#2A2D34] p-5 sm:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
        <div className="space-y-1.5 max-w-xl">
          <h1 className="text-xl sm:text-2xl font-bold text-[#202124] dark:text-[#F3F4F6] tracking-tight text-balance">
            Create, scan, and convert PDFs offline
          </h1>
          <p className="text-sm text-[#777777] dark:text-[#9CA3AF] leading-relaxed">
            Turn gallery photos, camera scans, and Office documents into crisp PDFs stored privately on your device.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onLaunchTool('images-to-pdf')}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[48px] rounded-xl bg-[#E50920] hover:bg-[#B81024] text-white text-sm font-semibold transition-colors active:scale-[0.98] whitespace-nowrap cursor-pointer"
          >
            <ImageIcon className="w-4 h-4" />
            <span>{t.createPdf}</span>
          </button>
          <button
            type="button"
            onClick={() => onLaunchTool('scan-document')}
            className="inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[48px] rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] hover:bg-[#EAEAEF] dark:hover:bg-[#2E323B] text-[#202124] dark:text-[#F3F4F6] text-sm font-medium transition-colors whitespace-nowrap cursor-pointer"
          >
            <ScanLine className="w-4 h-4 text-[#E50920]" />
            <span>Scan Page</span>
          </button>
        </div>
      </section>

      {/* Quick Actions 12-Card Grid */}
      <section aria-labelledby="quick-actions-heading">
        <div className="flex items-center justify-between mb-4">
          <h2
            id="quick-actions-heading"
            className="text-base sm:text-lg font-bold text-[#202124] dark:text-[#F3F4F6]"
          >
            {t.quickActions}
          </h2>
          <span className="text-xs text-[#777777] dark:text-[#9CA3AF] tabular-nums">
            12 tools ready offline
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {HOME_QUICK_ACTIONS.map((tool) => {
            const Icon = getToolIcon(tool.id);
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => onLaunchTool(tool.id)}
                className="group text-left bg-white dark:bg-[#1A1C20] hover:border-[#E50920]/45 rounded-2xl border border-[#E6E6E6] dark:border-[#2A2D34] p-4 transition-all duration-150 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-[#E50920] cursor-pointer flex flex-col justify-between min-h-[126px]"
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-3 transition-transform duration-150 group-hover:scale-105"
                  style={{ backgroundColor: tool.bgTint, color: tool.color }}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#202124] dark:text-[#F3F4F6] leading-snug mb-1">
                    {tool.title}
                  </h3>
                  <p className="text-xs text-[#777777] dark:text-[#9CA3AF] line-clamp-2 leading-relaxed">
                    {tool.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Recent Files Section */}
      <section aria-labelledby="recent-files-heading">
        <div className="flex items-center justify-between mb-4">
          <h2
            id="recent-files-heading"
            className="text-base sm:text-lg font-bold text-[#202124] dark:text-[#F3F4F6]"
          >
            {t.recentFiles}
          </h2>
          <button
            type="button"
            onClick={onSeeAllFiles}
            className="inline-flex items-center gap-1 min-h-[40px] px-2 text-sm font-semibold text-[#E50920] hover:text-[#B81024] transition-colors whitespace-nowrap cursor-pointer"
          >
            <span>{t.seeAll}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {recentFiles.length === 0 ? (
          <EmptyState onAction={() => onLaunchTool('images-to-pdf')} />
        ) : (
          <div className="bg-white dark:bg-[#1A1C20] rounded-2xl border border-[#E6E6E6] dark:border-[#2A2D34] divide-y divide-[#E6E6E6] dark:divide-[#2A2D34] overflow-hidden">
            {recentFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-3.5 px-4 py-3.5 hover:bg-[#F5F5F7]/70 dark:hover:bg-[#24272E]/60 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => onOpenFile(file)}
                  className="flex items-center gap-3.5 flex-1 min-w-0 text-left cursor-pointer"
                >
                  <div className="w-11 h-14 rounded-lg bg-[#F5F5F7] dark:bg-[#24272E] border border-[#E6E6E6] dark:border-[#343842] overflow-hidden shrink-0 flex items-center justify-center">
                    {file.thumbnailDataUrl && !hideThumbnails ? (
                      <img
                        src={file.thumbnailDataUrl}
                        alt={file.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <FileText className="w-5 h-5 text-[#E50920]" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {file.password && (
                        <Lock className="w-3.5 h-3.5 text-[#E50920] shrink-0" />
                      )}
                      <p className="text-sm font-semibold text-[#202124] dark:text-[#F3F4F6] truncate">
                        {file.name}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#777777] dark:text-[#9CA3AF] mt-1 tabular-nums">
                      <span>{formatDateShort(file.createdAt)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatBytes(file.size)}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {file.pageCount} {file.pageCount === 1 ? 'page' : 'pages'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 font-medium text-[#25A55B]">
                        {file.status === 'completed' && (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Completed</span>
                          </>
                        )}
                        {file.status === 'processing' && (
                          <span className="inline-flex items-center gap-1 text-amber-600">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Processing</span>
                          </span>
                        )}
                        {file.status === 'failed' && (
                          <span className="inline-flex items-center gap-1 text-[#E50920]">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>Failed</span>
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onMoreOptions(file)}
                  aria-label={`More options for ${file.name}`}
                  className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-[#777777] hover:text-[#202124] dark:hover:text-[#F3F4F6] hover:bg-[#F5F5F7] dark:hover:bg-[#2E323B] transition-colors shrink-0 cursor-pointer"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
