import React, { useState, useEffect } from 'react';
import {
  Eye,
  Edit3,
  Share2,
  Printer,
  FolderInput,
  Trash2,
  Info,
  Copy,
  Download,
  X,
  Folder,
  FileText,
  Lock,
} from 'lucide-react';
import { FolderRecord, PdfFileRecord } from '../types/pdf';
import { formatBytes, formatDateShort } from '../storage/db';

interface FileActionSheetProps {
  file: PdfFileRecord | null;
  folders: FolderRecord[];
  onClose: () => void;
  onOpen: (file: PdfFileRecord) => void;
  onRename: (file: PdfFileRecord, newName: string) => void;
  onShare: (file: PdfFileRecord) => void;
  onPrint: (file: PdfFileRecord) => void;
  onMove: (file: PdfFileRecord, folderId: string) => void;
  onCopy?: (file: PdfFileRecord) => void;
  onExport?: (file: PdfFileRecord) => void;
  onDelete: (file: PdfFileRecord) => void;
}

export const FileActionSheet: React.FC<FileActionSheetProps> = ({
  file,
  folders,
  onClose,
  onOpen,
  onRename,
  onShare,
  onPrint,
  onMove,
  onCopy,
  onExport,
  onDelete,
}) => {
  const [subModal, setSubModal] = useState<'menu' | 'rename' | 'move' | 'details' | 'confirmDelete'>('menu');
  const [renameValue, setRenameValue] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('');

  useEffect(() => {
    if (file) {
      setSubModal('menu');
      setRenameValue(file.name.replace(/\.pdf$/i, ''));
      setSelectedFolder(file.folderId);
    }
  }, [file]);

  if (!file) return null;

  const currentFolder = folders.find((f) => f.id === file.folderId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-white dark:bg-[#1A1C20] rounded-t-3xl sm:rounded-2xl border border-[#E6E6E6] dark:border-[#2A2D34] shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden w-10 h-1.5 bg-[#D1D5DB] dark:bg-[#3A3F4B] rounded-full mx-auto mt-3" />

        {/* File header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#E6E6E6] dark:border-[#2A2D34]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-12 rounded-lg bg-[#F5F5F7] dark:bg-[#24272E] border border-[#E6E6E6] dark:border-[#343842] overflow-hidden shrink-0 flex items-center justify-center">
              {file.thumbnailDataUrl ? (
                <img
                  src={file.thumbnailDataUrl}
                  alt={file.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <FileText className="w-5 h-5 text-[#E50920]" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#202124] dark:text-[#F3F4F6] truncate flex items-center gap-1.5">
                {file.password && <Lock className="w-3.5 h-3.5 text-[#E50920] shrink-0" />}
                <span className="truncate">{file.name}</span>
              </p>
              <p className="text-xs text-[#777777] dark:text-[#9CA3AF] tabular-nums mt-0.5">
                {formatBytes(file.size)} · {file.pageCount} {file.pageCount === 1 ? 'page' : 'pages'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-[#777777] hover:bg-[#F5F5F7] dark:hover:bg-[#262930] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {subModal === 'menu' && (
          <div className="p-2 max-h-[70vh] overflow-y-auto">
            {[
              { icon: Eye, label: 'Open & Preview', action: () => { onOpen(file); onClose(); } },
              { icon: Edit3, label: 'Rename', action: () => setSubModal('rename') },
              { icon: Share2, label: 'Share', action: () => { onShare(file); onClose(); } },
              { icon: Printer, label: 'Print', action: () => { onPrint(file); onClose(); } },
              { icon: FolderInput, label: 'Move to Folder', action: () => setSubModal('move') },
              ...(onCopy ? [{ icon: Copy, label: 'Duplicate Copy', action: () => { onCopy(file); onClose(); } }] : []),
              ...(onExport ? [{ icon: Download, label: 'Export / Download', action: () => { onExport(file); onClose(); } }] : []),
              { icon: Info, label: 'View Details', action: () => setSubModal('details') },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.action}
                  className="w-full flex items-center gap-3.5 px-4 py-3 min-h-[48px] rounded-xl text-left text-sm font-medium text-[#202124] dark:text-[#F3F4F6] hover:bg-[#F5F5F7] dark:hover:bg-[#24272E] transition-colors cursor-pointer"
                >
                  <Icon className="w-4 h-4 text-[#777777] dark:text-[#9CA3AF] shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
            <div className="my-1.5 border-t border-[#E6E6E6] dark:border-[#2A2D34]" />
            <button
              type="button"
              onClick={() => setSubModal('confirmDelete')}
              className="w-full flex items-center gap-3.5 px-4 py-3 min-h-[48px] rounded-xl text-left text-sm font-medium text-[#E50920] hover:bg-[#E50920]/8 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4 shrink-0" />
              <span>Delete File</span>
            </button>
          </div>
        )}

        {subModal === 'rename' && (
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#777777] dark:text-[#9CA3AF] mb-1.5">
                New file name
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  autoFocus
                  className="flex-1 h-11 px-3.5 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] border border-[#E6E6E6] dark:border-[#343842] text-sm text-[#202124] dark:text-[#F3F4F6] focus:outline-none focus:border-[#E50920]"
                />
                <span className="text-sm font-mono text-[#777777] dark:text-[#9CA3AF]">
                  .{file.extension}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSubModal('menu')}
                className="px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-medium text-[#777777] hover:bg-[#F5F5F7] dark:hover:bg-[#24272E] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const trimmed = renameValue.trim();
                  if (trimmed) {
                    const extSuffix = `.${file.extension}`;
                    const finalName = trimmed.toLowerCase().endsWith(extSuffix.toLowerCase())
                      ? trimmed
                      : `${trimmed}${extSuffix}`;
                    onRename(file, finalName);
                    onClose();
                  }
                }}
                className="px-5 py-2.5 min-h-[44px] rounded-xl bg-[#E50920] hover:bg-[#B81024] text-white text-sm font-medium cursor-pointer"
              >
                Save Name
              </button>
            </div>
          </div>
        )}

        {subModal === 'move' && (
          <div className="p-5 space-y-4">
            <p className="text-sm font-medium text-[#202124] dark:text-[#F3F4F6]">
              Choose destination folder
            </p>
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => setSelectedFolder(folder.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 min-h-[44px] rounded-xl border text-sm text-left transition-colors cursor-pointer ${
                    selectedFolder === folder.id
                      ? 'border-[#E50920] bg-[#E50920]/8 text-[#202124] dark:text-[#F3F4F6] font-medium'
                      : 'border-[#E6E6E6] dark:border-[#2A2D34] text-[#202124] dark:text-[#F3F4F6] hover:bg-[#F5F5F7] dark:hover:bg-[#24272E]'
                  }`}
                >
                  <Folder className="w-4 h-4 shrink-0" style={{ color: folder.color }} />
                  <span className="truncate">{folder.name}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSubModal('menu')}
                className="px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-medium text-[#777777] hover:bg-[#F5F5F7] dark:hover:bg-[#24272E] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onMove(file, selectedFolder);
                  onClose();
                }}
                className="px-5 py-2.5 min-h-[44px] rounded-xl bg-[#E50920] hover:bg-[#B81024] text-white text-sm font-medium cursor-pointer"
              >
                Move File
              </button>
            </div>
          </div>
        )}

        {subModal === 'details' && (
          <div className="p-5 space-y-3">
            <h4 className="text-sm font-semibold text-[#202124] dark:text-[#F3F4F6]">
              File Details
            </h4>
            <dl className="divide-y divide-[#E6E6E6] dark:divide-[#2A2D34] text-sm">
              {[
                ['File Name', file.name],
                ['Type', file.extension.toUpperCase()],
                ['Size', formatBytes(file.size)],
                ['Pages', String(file.pageCount)],
                ['Folder', currentFolder?.name || 'Created PDFs'],
                ['Created', formatDateShort(file.createdAt)],
                ['Status', file.status.charAt(0).toUpperCase() + file.status.slice(1)],
                ['Protection', file.password ? 'Password Protected' : 'None'],
                ...(file.metadata?.author ? [['Author', file.metadata.author]] : []),
                ...(file.metadata?.subject ? [['Subject', file.metadata.subject]] : []),
              ].map(([k, v]) => (
                <div key={k} className="py-2.5 flex items-center justify-between gap-4">
                  <dt className="text-[#777777] dark:text-[#9CA3AF] shrink-0">{k}</dt>
                  <dd className="text-[#202124] dark:text-[#F3F4F6] font-medium text-right truncate tabular-nums">
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 min-h-[44px] rounded-xl bg-[#202124] dark:bg-[#F3F4F6] text-white dark:text-[#111215] text-sm font-medium cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {subModal === 'confirmDelete' && (
          <div className="p-5 space-y-4">
            <h4 className="text-base font-semibold text-[#202124] dark:text-[#F3F4F6]">
              Delete this file?
            </h4>
            <p className="text-sm text-[#777777] dark:text-[#9CA3AF] leading-relaxed">
              <span className="font-medium text-[#202124] dark:text-[#F3F4F6]">{file.name}</span> will be
              removed from local storage. You can briefly undo this action from the notification bar.
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSubModal('menu')}
                className="px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-medium text-[#777777] hover:bg-[#F5F5F7] dark:hover:bg-[#24272E] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDelete(file);
                  onClose();
                }}
                className="px-5 py-2.5 min-h-[44px] rounded-xl bg-[#E50920] hover:bg-[#B81024] text-white text-sm font-medium cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
