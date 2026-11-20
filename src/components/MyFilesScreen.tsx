import React, { useMemo, useState } from 'react';
import {
  Search,
  SlidersHorizontal,
  LayoutGrid,
  List,
  MoreVertical,
  FileText,
  Folder,
  FolderPlus,
  CheckSquare,
  Square,
  Trash2,
  Share2,
  FolderInput,
  Layers,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  Lock,
  Edit3,
  HardDrive,
} from 'lucide-react';
import {
  DateFilterOption,
  FileCategory,
  FileStatus,
  FilterState,
  FolderRecord,
  PdfFileRecord,
  SortOption,
} from '../types/pdf';
import { formatBytes, formatDateShort } from '../storage/db';
import { EmptyState } from './EmptyState';

interface MyFilesScreenProps {
  files: PdfFileRecord[];
  folders: FolderRecord[];
  initialSearch?: string;
  hideThumbnails: boolean;
  onOpenFile: (file: PdfFileRecord) => void;
  onMoreOptions: (file: PdfFileRecord) => void;
  onCreatePdf: () => void;
  onBatchShare: (files: PdfFileRecord[]) => void;
  onBatchDelete: (ids: string[]) => void;
  onBatchMove: (ids: string[], folderId: string) => void;
  onBatchMerge: (ids: string[]) => void;
  onCreateFolder: (name: string) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
}

type SegmentTab = 'all' | 'recent' | 'completed' | 'processing' | 'failed' | 'folders';

export const MyFilesScreen: React.FC<MyFilesScreenProps> = ({
  files,
  folders,
  initialSearch = '',
  hideThumbnails,
  onOpenFile,
  onMoreOptions,
  onCreatePdf,
  onBatchShare,
  onBatchDelete,
  onBatchMove,
  onBatchMerge,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
}) => {
  const [segment, setSegment] = useState<SegmentTab>('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectMode, setSelectMode] = useState(false);

  const [filters, setFilters] = useState<FilterState>({
    search: initialSearch,
    fileType: 'all',
    status: 'all',
    dateFilter: 'all',
    customDateStart: '',
    customDateEnd: '',
    sortBy: 'newest',
    folderId: 'all',
  });

  // Modals for folder management and batch actions
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [folderNameDraft, setFolderNameDraft] = useState('');
  const [renamingFolder, setRenamingFolder] = useState<FolderRecord | null>(null);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [batchMoveOpen, setBatchMoveOpen] = useState(false);
  const [batchTargetFolder, setBatchTargetFolder] = useState('created');

  // Storage analytics
  const storageStats = useMemo(() => {
    let total = 0;
    let pdf = 0;
    let image = 0;
    let document = 0;
    for (const f of files) {
      total += f.size;
      if (f.category === 'pdf') pdf += f.size;
      else if (f.category === 'image') image += f.size;
      else document += f.size;
    }
    return { total, pdf, image, document };
  }, [files]);

  const activeFilterTags = useMemo(() => {
    const tags: { key: string; label: string; clear: () => void }[] = [];
    if (filters.fileType !== 'all') {
      tags.push({
        key: 'type',
        label: `Type: ${filters.fileType}`,
        clear: () => setFilters((f) => ({ ...f, fileType: 'all' })),
      });
    }
    if (filters.status !== 'all') {
      tags.push({
        key: 'status',
        label: `Status: ${filters.status}`,
        clear: () => setFilters((f) => ({ ...f, status: 'all' })),
      });
    }
    if (filters.dateFilter !== 'all') {
      tags.push({
        key: 'date',
        label: `Date: ${filters.dateFilter}`,
        clear: () =>
          setFilters((f) => ({ ...f, dateFilter: 'all', customDateStart: '', customDateEnd: '' })),
      });
    }
    if (filters.folderId !== 'all') {
      const fName = folders.find((fl) => fl.id === filters.folderId)?.name || filters.folderId;
      tags.push({
        key: 'folder',
        label: `Folder: ${fName}`,
        clear: () => setFilters((f) => ({ ...f, folderId: 'all' })),
      });
    }
    return tags;
  }, [filters, folders]);

  const clearAllFilters = () => {
    setFilters({
      search: '',
      fileType: 'all',
      status: 'all',
      dateFilter: 'all',
      customDateStart: '',
      customDateEnd: '',
      sortBy: 'newest',
      folderId: 'all',
    });
  };

  const filteredFiles = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 86400000;
    const folderMap = new Map(folders.map((fl) => [fl.id, fl.name.toLowerCase()]));

    const result = files.filter((file) => {
      // Segment tab filter
      if (segment === 'completed' && file.status !== 'completed') return false;
      if (segment === 'processing' && file.status !== 'processing') return false;
      if (segment === 'failed' && file.status !== 'failed') return false;

      // Combinable filters
      if (filters.fileType !== 'all' && file.category !== filters.fileType) return false;
      if (filters.status !== 'all' && file.status !== filters.status) return false;
      if (filters.folderId !== 'all' && file.folderId !== filters.folderId) return false;

      // Date filter
      if (filters.dateFilter === 'today' && file.createdAt < startOfToday) return false;
      if (
        filters.dateFilter === 'yesterday' &&
        (file.createdAt < startOfYesterday || file.createdAt >= startOfToday)
      ) {
        return false;
      }
      if (filters.dateFilter === 'last7' && file.createdAt < Date.now() - 7 * 86400000) return false;
      if (filters.dateFilter === 'last30' && file.createdAt < Date.now() - 30 * 86400000) return false;
      if (filters.dateFilter === 'thisMonth') {
        const d = new Date(file.createdAt);
        if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false;
      }
      if (filters.dateFilter === 'custom') {
        if (filters.customDateStart) {
          const s = new Date(filters.customDateStart).getTime();
          if (file.createdAt < s) return false;
        }
        if (filters.customDateEnd) {
          const e = new Date(filters.customDateEnd).getTime() + 86400000;
          if (file.createdAt > e) return false;
        }
      }

      // Search across name, extension/type, formatted date, category, folder
      const q = filters.search.trim().toLowerCase();
      if (q) {
        const dateStr = formatDateShort(file.createdAt).toLowerCase();
        const isoDate = new Date(file.createdAt).toISOString().slice(0, 10);
        const folderName = folderMap.get(file.folderId) || '';
        const haystack = `${file.name} ${file.extension} ${file.category} ${dateStr} ${isoDate} ${folderName}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });

    // Sort
    result.sort((a, b) => {
      if (segment === 'recent' && filters.sortBy === 'newest') {
        return (b.lastOpenedAt || b.createdAt) - (a.lastOpenedAt || a.createdAt);
      }
      switch (filters.sortBy) {
        case 'oldest':
          return a.createdAt - b.createdAt;
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'largest':
          return b.size - a.size;
        case 'smallest':
          return a.size - b.size;
        case 'newest':
        default:
          return b.createdAt - a.createdAt;
      }
    });

    return result;
  }, [files, folders, segment, filters]);

  const toggleSelectId = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectedFiles = files.filter((f) => selectedIds.includes(f.id));
  const selectedPdfCount = selectedFiles.filter((f) => f.extension === 'pdf').length;

  return (
    <div className="space-y-5 pb-24">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#202124] dark:text-[#F3F4F6]">
            My Files
          </h1>
          <p className="text-xs text-[#777777] dark:text-[#9CA3AF] tabular-nums mt-0.5">
            {filteredFiles.length} {filteredFiles.length === 1 ? 'result' : 'results'} · {formatBytes(storageStats.total)} used locally
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setSelectMode((v) => !v);
              setSelectedIds([]);
            }}
            className={`px-3.5 py-2 min-h-[42px] rounded-xl text-xs sm:text-sm font-medium border transition-colors cursor-pointer whitespace-nowrap ${
              selectMode
                ? 'bg-[#202124] dark:bg-[#F3F4F6] text-white dark:text-[#111215] border-transparent'
                : 'bg-white dark:bg-[#1A1C20] border-[#E6E6E6] dark:border-[#2A2D34] text-[#202124] dark:text-[#F3F4F6]'
            }`}
          >
            {selectMode ? 'Done Selecting' : 'Select'}
          </button>

          <div className="flex items-center p-1 rounded-xl bg-white dark:bg-[#1A1C20] border border-[#E6E6E6] dark:border-[#2A2D34]">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              aria-label="List view"
              className={`min-w-[36px] min-h-[34px] rounded-lg flex items-center justify-center cursor-pointer ${
                viewMode === 'list' ? 'bg-[#E50920] text-white' : 'text-[#777777]'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              aria-label="Grid view"
              className={`min-w-[36px] min-h-[34px] rounded-lg flex items-center justify-center cursor-pointer ${
                viewMode === 'grid' ? 'bg-[#E50920] text-white' : 'text-[#777777]'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Segmented Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {(
          [
            { id: 'all', label: `All (${files.length})` },
            { id: 'recent', label: 'Recent' },
            { id: 'completed', label: `Completed (${files.filter((f) => f.status === 'completed').length})` },
            { id: 'processing', label: 'Processing' },
            { id: 'failed', label: 'Failed' },
            { id: 'folders', label: `Folders (${folders.length})` },
          ] as { id: SegmentTab; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSegment(tab.id)}
            className={`px-4 py-2 min-h-[40px] rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              segment === tab.id
                ? 'bg-[#E50920] text-white'
                : 'bg-white dark:bg-[#1A1C20] text-[#202124] dark:text-[#F3F4F6] border border-[#E6E6E6] dark:border-[#2A2D34] hover:bg-[#F5F5F7] dark:hover:bg-[#24272E]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Folders & Storage Management Tab */}
      {segment === 'folders' ? (
        <div className="space-y-6">
          {/* Storage Breakdown Card */}
          <div className="bg-white dark:bg-[#1A1C20] rounded-2xl border border-[#E6E6E6] dark:border-[#2A2D34] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <HardDrive className="w-5 h-5 text-[#E50920]" />
                <h2 className="text-sm font-bold text-[#202124] dark:text-[#F3F4F6]">
                  Local Offline Storage
                </h2>
              </div>
              <span className="text-sm font-bold text-[#202124] dark:text-[#F3F4F6] tabular-nums">
                {formatBytes(storageStats.total)}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E]">
                <p className="text-xs text-[#777777] dark:text-[#9CA3AF]">PDF Storage</p>
                <p className="text-sm font-bold text-[#E50920] tabular-nums mt-0.5">
                  {formatBytes(storageStats.pdf)}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E]">
                <p className="text-xs text-[#777777] dark:text-[#9CA3AF]">Image Storage</p>
                <p className="text-sm font-bold text-blue-600 tabular-nums mt-0.5">
                  {formatBytes(storageStats.image)}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E]">
                <p className="text-xs text-[#777777] dark:text-[#9CA3AF]">Document Storage</p>
                <p className="text-sm font-bold text-[#25A55B] tabular-nums mt-0.5">
                  {formatBytes(storageStats.document)}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#202124] dark:text-[#F3F4F6]">
              Storage Folders
            </h2>
            <button
              type="button"
              onClick={() => {
                setFolderNameDraft('');
                setNewFolderOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 min-h-[42px] rounded-xl bg-[#E50920] hover:bg-[#B81024] text-white text-xs sm:text-sm font-semibold cursor-pointer"
            >
              <FolderPlus className="w-4 h-4" />
              <span>New Folder</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {folders.map((folder) => {
              const count = files.filter((f) => f.folderId === folder.id).length;
              const size = files
                .filter((f) => f.folderId === folder.id)
                .reduce((acc, f) => acc + f.size, 0);
              return (
                <div
                  key={folder.id}
                  className="bg-white dark:bg-[#1A1C20] rounded-2xl border border-[#E6E6E6] dark:border-[#2A2D34] p-4 flex items-center justify-between gap-3 hover:border-[#E50920]/40 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setFilters((f) => ({ ...f, folderId: folder.id }));
                      setSegment('all');
                    }}
                    className="flex items-center gap-3.5 flex-1 min-w-0 text-left cursor-pointer"
                  >
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${folder.color}16`, color: folder.color }}
                    >
                      <Folder className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#202124] dark:text-[#F3F4F6] truncate">
                        {folder.name}
                      </p>
                      <p className="text-xs text-[#777777] dark:text-[#9CA3AF] tabular-nums mt-0.5">
                        {count} {count === 1 ? 'file' : 'files'} · {formatBytes(size)}
                      </p>
                    </div>
                  </button>

                  {!folder.system && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setRenamingFolder(folder);
                          setFolderNameDraft(folder.name);
                        }}
                        className="min-w-[36px] min-h-[36px] rounded-lg text-[#777777] hover:bg-[#F5F5F7] dark:hover:bg-[#24272E] flex items-center justify-center cursor-pointer"
                        aria-label="Rename folder"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteFolder(folder.id)}
                        className="min-w-[36px] min-h-[36px] rounded-lg text-[#E50920] hover:bg-[#E50920]/10 flex items-center justify-center cursor-pointer"
                        aria-label="Delete folder"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          {/* Search + Filter + Sort Bar */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#777777] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                  placeholder="Search by file name, type, date, or folder..."
                  className="w-full h-11 pl-10 pr-9 rounded-xl bg-white dark:bg-[#1A1C20] border border-[#E6E6E6] dark:border-[#2A2D34] text-sm text-[#202124] dark:text-[#F3F4F6] placeholder:text-[#777777] focus:outline-none focus:border-[#E50920]"
                />
                {filters.search && (
                  <button
                    type="button"
                    onClick={() => setFilters((f) => ({ ...f, search: '' }))}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#777777] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowFilters((v) => !v)}
                  className={`inline-flex items-center gap-2 px-4 h-11 rounded-xl border text-sm font-medium cursor-pointer whitespace-nowrap ${
                    showFilters || activeFilterTags.length > 0
                      ? 'border-[#E50920] bg-[#E50920]/8 text-[#E50920]'
                      : 'bg-white dark:bg-[#1A1C20] border-[#E6E6E6] dark:border-[#2A2D34] text-[#202124] dark:text-[#F3F4F6]'
                  }`}
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  <span>Filters{activeFilterTags.length > 0 ? ` (${activeFilterTags.length})` : ''}</span>
                </button>

                <select
                  value={filters.sortBy}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, sortBy: e.target.value as SortOption }))
                  }
                  aria-label="Sort files"
                  className="h-11 px-3 rounded-xl bg-white dark:bg-[#1A1C20] border border-[#E6E6E6] dark:border-[#2A2D34] text-sm text-[#202124] dark:text-[#F3F4F6]"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="name-asc">Name A–Z</option>
                  <option value="name-desc">Name Z–A</option>
                  <option value="largest">Largest First</option>
                  <option value="smallest">Smallest First</option>
                </select>
              </div>
            </div>

            {/* Expandable Combinable Filter Drawer */}
            {showFilters && (
              <div className="bg-white dark:bg-[#1A1C20] rounded-2xl border border-[#E6E6E6] dark:border-[#2A2D34] p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#777777] mb-1">File Type</label>
                  <select
                    value={filters.fileType}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, fileType: e.target.value as 'all' | FileCategory }))
                    }
                    className="w-full h-10 px-3 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] border border-[#E6E6E6] dark:border-[#343842] text-xs sm:text-sm"
                  >
                    <option value="all">All Files</option>
                    <option value="pdf">PDF</option>
                    <option value="image">Images</option>
                    <option value="document">Documents</option>
                    <option value="word">Word</option>
                    <option value="excel">Excel</option>
                    <option value="powerpoint">PowerPoint</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#777777] mb-1">Status</label>
                  <select
                    value={filters.status}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, status: e.target.value as 'all' | FileStatus }))
                    }
                    className="w-full h-10 px-3 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] border border-[#E6E6E6] dark:border-[#343842] text-xs sm:text-sm"
                  >
                    <option value="all">All</option>
                    <option value="completed">Completed</option>
                    <option value="processing">Processing</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#777777] mb-1">Date</label>
                  <select
                    value={filters.dateFilter}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, dateFilter: e.target.value as DateFilterOption }))
                    }
                    className="w-full h-10 px-3 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] border border-[#E6E6E6] dark:border-[#343842] text-xs sm:text-sm"
                  >
                    <option value="all">Any Date</option>
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="last7">Last 7 Days</option>
                    <option value="last30">Last 30 Days</option>
                    <option value="thisMonth">This Month</option>
                    <option value="custom">Custom Date Range</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#777777] mb-1">Folder</label>
                  <select
                    value={filters.folderId}
                    onChange={(e) => setFilters((f) => ({ ...f, folderId: e.target.value }))}
                    className="w-full h-10 px-3 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] border border-[#E6E6E6] dark:border-[#343842] text-xs sm:text-sm"
                  >
                    <option value="all">All Folders</option>
                    {folders.map((fl) => (
                      <option key={fl.id} value={fl.id}>
                        {fl.name}
                      </option>
                    ))}
                  </select>
                </div>

                {filters.dateFilter === 'custom' && (
                  <div className="sm:col-span-2 lg:col-span-4 grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-xs text-[#777777] mb-1">Start Date</label>
                      <input
                        type="date"
                        value={filters.customDateStart}
                        onChange={(e) =>
                          setFilters((f) => ({ ...f, customDateStart: e.target.value }))
                        }
                        className="w-full h-10 px-3 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] border border-[#E6E6E6] dark:border-[#343842] text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#777777] mb-1">End Date</label>
                      <input
                        type="date"
                        value={filters.customDateEnd}
                        onChange={(e) =>
                          setFilters((f) => ({ ...f, customDateEnd: e.target.value }))
                        }
                        className="w-full h-10 px-3 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] border border-[#E6E6E6] dark:border-[#343842] text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Active Filters Bar */}
            {(activeFilterTags.length > 0 || filters.search) && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[#777777] dark:text-[#9CA3AF] tabular-nums">
                    Showing {filteredFiles.length} {filteredFiles.length === 1 ? 'file' : 'files'}
                  </span>
                  {activeFilterTags.map((tag) => (
                    <button
                      key={tag.key}
                      type="button"
                      onClick={tag.clear}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-[#1A1C20] border border-[#E6E6E6] dark:border-[#2A2D34] text-[#202124] dark:text-[#F3F4F6] hover:border-[#E50920] cursor-pointer"
                    >
                      <span>{tag.label}</span>
                      <X className="w-3 h-3 text-[#777777]" />
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="font-semibold text-[#E50920] hover:underline cursor-pointer"
                >
                  Clear All Filters
                </button>
              </div>
            )}
          </div>

          {/* File List or Grid */}
          {filteredFiles.length === 0 ? (
            <EmptyState
              title={files.length === 0 ? 'No PDF files yet' : 'No matching files found'}
              description={
                files.length === 0
                  ? 'Create your first PDF from images, documents, or camera scans.'
                  : 'Try clearing one of your active filters or search terms.'
              }
              actionLabel={files.length === 0 ? 'Create PDF' : 'Clear All Filters'}
              onAction={files.length === 0 ? onCreatePdf : clearAllFilters}
            />
          ) : viewMode === 'list' ? (
            <div className="bg-white dark:bg-[#1A1C20] rounded-2xl border border-[#E6E6E6] dark:border-[#2A2D34] divide-y divide-[#E6E6E6] dark:divide-[#2A2D34] overflow-hidden">
              {filteredFiles.map((file) => {
                const isSelected = selectedIds.includes(file.id);
                const folderName = folders.find((fl) => fl.id === file.folderId)?.name || 'Created PDFs';
                return (
                  <div
                    key={file.id}
                    className={`flex items-center gap-3 px-4 py-3.5 transition-colors ${
                      isSelected
                        ? 'bg-[#E50920]/6'
                        : 'hover:bg-[#F5F5F7]/70 dark:hover:bg-[#24272E]/60'
                    }`}
                  >
                    {selectMode && (
                      <button
                        type="button"
                        onClick={() => toggleSelectId(file.id)}
                        className="min-w-[40px] min-h-[40px] flex items-center justify-center cursor-pointer"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-[#E50920]" />
                        ) : (
                          <Square className="w-5 h-5 text-[#777777]" />
                        )}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => (selectMode ? toggleSelectId(file.id) : onOpenFile(file))}
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
                          {file.password && <Lock className="w-3.5 h-3.5 text-[#E50920] shrink-0" />}
                          <p className="text-sm font-semibold text-[#202124] dark:text-[#F3F4F6] truncate">
                            {file.name}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#777777] dark:text-[#9CA3AF] mt-1 tabular-nums">
                          <span>{file.extension.toUpperCase()}</span>
                          <span aria-hidden="true">·</span>
                          <span>{formatBytes(file.size)}</span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {file.pageCount} {file.pageCount === 1 ? 'page' : 'pages'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{formatDateShort(file.createdAt)}</span>
                          <span aria-hidden="true">·</span>
                          <span>{folderName}</span>
                          <span aria-hidden="true">·</span>
                          {file.status === 'completed' && (
                            <span className="inline-flex items-center gap-1 font-medium text-[#25A55B]">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                            </span>
                          )}
                          {file.status === 'processing' && (
                            <span className="inline-flex items-center gap-1 font-medium text-amber-600">
                              <Clock className="w-3.5 h-3.5" /> Processing
                            </span>
                          )}
                          {file.status === 'failed' && (
                            <span className="inline-flex items-center gap-1 font-medium text-[#E50920]">
                              <AlertCircle className="w-3.5 h-3.5" /> Failed
                            </span>
                          )}
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => onMoreOptions(file)}
                      aria-label={`More options for ${file.name}`}
                      className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-[#777777] hover:bg-[#F5F5F7] dark:hover:bg-[#2E323B] cursor-pointer shrink-0"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredFiles.map((file) => {
                const isSelected = selectedIds.includes(file.id);
                return (
                  <div
                    key={file.id}
                    className={`bg-white dark:bg-[#1A1C20] rounded-2xl border overflow-hidden transition-all ${
                      isSelected
                        ? 'border-[#E50920] ring-2 ring-[#E50920]/15'
                        : 'border-[#E6E6E6] dark:border-[#2A2D34]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => (selectMode ? toggleSelectId(file.id) : onOpenFile(file))}
                      className="w-full aspect-[4/5] bg-[#F5F5F7] dark:bg-[#24272E] relative flex items-center justify-center overflow-hidden cursor-pointer"
                    >
                      {file.thumbnailDataUrl && !hideThumbnails ? (
                        <img
                          src={file.thumbnailDataUrl}
                          alt={file.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <FileText className="w-10 h-10 text-[#E50920]" />
                      )}
                      {selectMode && (
                        <span className="absolute top-2.5 left-2.5 w-7 h-7 rounded-lg bg-white dark:bg-[#1A1C20] shadow flex items-center justify-center">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-[#E50920]" />
                          ) : (
                            <Square className="w-4 h-4 text-[#777777]" />
                          )}
                        </span>
                      )}
                    </button>
                    <div className="p-3 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#202124] dark:text-[#F3F4F6] truncate">
                          {file.name}
                        </p>
                        <p className="text-[11px] text-[#777777] dark:text-[#9CA3AF] tabular-nums mt-0.5">
                          {formatBytes(file.size)} · {file.pageCount}p
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onMoreOptions(file)}
                        className="min-w-[34px] min-h-[34px] rounded-lg flex items-center justify-center text-[#777777] hover:bg-[#F5F5F7] dark:hover:bg-[#24272E] cursor-pointer shrink-0"
                        aria-label="More options"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Multi-Select Bottom Bar */}
      {selectMode && selectedIds.length > 0 && (
        <div className="fixed bottom-16 lg:bottom-0 left-0 lg:left-64 right-0 z-30 bg-[#202124] text-white px-4 sm:px-6 py-3 shadow-lg">
          <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-semibold tabular-nums">
              {selectedIds.length} selected
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onBatchShare(selectedFiles)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl bg-white/12 hover:bg-white/20 text-xs font-semibold cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share</span>
              </button>
              <button
                type="button"
                onClick={() => setBatchMoveOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl bg-white/12 hover:bg-white/20 text-xs font-semibold cursor-pointer"
              >
                <FolderInput className="w-3.5 h-3.5" />
                <span>Move</span>
              </button>
              {selectedPdfCount >= 2 && (
                <button
                  type="button"
                  onClick={() => {
                    onBatchMerge(
                      selectedFiles.filter((f) => f.extension === 'pdf').map((f) => f.id)
                    );
                    setSelectMode(false);
                    setSelectedIds([]);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl bg-[#25A55B] hover:bg-[#1f8d4d] text-xs font-semibold cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Merge PDFs ({selectedPdfCount})</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setBatchDeleteOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl bg-[#E50920] hover:bg-[#B81024] text-xs font-semibold cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Delete Confirmation Dialog */}
      {batchDeleteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          onClick={() => setBatchDeleteOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-[#1A1C20] rounded-2xl border border-[#E6E6E6] dark:border-[#2A2D34] p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-[#202124] dark:text-[#F3F4F6]">
              Delete {selectedIds.length} files?
            </h3>
            <p className="text-sm text-[#777777] dark:text-[#9CA3AF]">
              The selected files will be permanently removed from local storage.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setBatchDeleteOpen(false)}
                className="px-4 py-2 min-h-[42px] rounded-xl text-sm text-[#777777] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onBatchDelete(selectedIds);
                  setSelectedIds([]);
                  setSelectMode(false);
                  setBatchDeleteOpen(false);
                }}
                className="px-5 py-2 min-h-[42px] rounded-xl bg-[#E50920] text-white text-sm font-semibold cursor-pointer"
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Move Modal */}
      {batchMoveOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          onClick={() => setBatchMoveOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-[#1A1C20] rounded-2xl border border-[#E6E6E6] dark:border-[#2A2D34] p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-[#202124] dark:text-[#F3F4F6]">
              Move {selectedIds.length} files to folder
            </h3>
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {folders.map((fl) => (
                <button
                  key={fl.id}
                  type="button"
                  onClick={() => setBatchTargetFolder(fl.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-sm text-left cursor-pointer ${
                    batchTargetFolder === fl.id
                      ? 'border-[#E50920] bg-[#E50920]/8 font-semibold'
                      : 'border-[#E6E6E6] dark:border-[#2A2D34]'
                  }`}
                >
                  <Folder className="w-4 h-4" style={{ color: fl.color }} />
                  <span>{fl.name}</span>
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setBatchMoveOpen(false)}
                className="px-4 py-2 min-h-[42px] rounded-xl text-sm text-[#777777] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onBatchMove(selectedIds, batchTargetFolder);
                  setSelectedIds([]);
                  setSelectMode(false);
                  setBatchMoveOpen(false);
                }}
                className="px-5 py-2 min-h-[42px] rounded-xl bg-[#E50920] text-white text-sm font-semibold cursor-pointer"
              >
                Move Files
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Rename Folder Modal */}
      {(newFolderOpen || renamingFolder) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          onClick={() => {
            setNewFolderOpen(false);
            setRenamingFolder(null);
          }}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-[#1A1C20] rounded-2xl border border-[#E6E6E6] dark:border-[#2A2D34] p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-[#202124] dark:text-[#F3F4F6]">
              {renamingFolder ? 'Rename Folder' : 'Create New Folder'}
            </h3>
            <input
              type="text"
              value={folderNameDraft}
              onChange={(e) => setFolderNameDraft(e.target.value)}
              placeholder="e.g. Receipts 2026"
              autoFocus
              className="w-full h-11 px-3.5 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] border border-[#E6E6E6] dark:border-[#343842] text-sm"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setNewFolderOpen(false);
                  setRenamingFolder(null);
                }}
                className="px-4 py-2 min-h-[42px] rounded-xl text-sm text-[#777777] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const name = folderNameDraft.trim();
                  if (!name) return;
                  if (renamingFolder) onRenameFolder(renamingFolder.id, name);
                  else onCreateFolder(name);
                  setNewFolderOpen(false);
                  setRenamingFolder(null);
                }}
                className="px-5 py-2 min-h-[42px] rounded-xl bg-[#E50920] text-white text-sm font-semibold cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
