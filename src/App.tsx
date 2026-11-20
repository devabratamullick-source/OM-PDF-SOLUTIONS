import React, { useEffect, useState } from 'react';
import {
  Home,
  Wrench,
  FolderOpen,
  History,
  Settings,
  Search,
  Plus,
  FileText,
  Lock,
  Undo2,
  X,
  HardDrive,
} from 'lucide-react';
import {
  AppSettings,
  DEFAULT_APP_SETTINGS,
  DEFAULT_FOLDERS,
  DocumentImportItem,
  FolderRecord,
  ImageItem,
  PdfFileRecord,
  TabId,
  TaskRecord,
  ToolId,
} from './types/pdf';
import { formatBytes, localDb } from './storage/db';
import {
  createStarterSamplePdf,
  printPdfBuffer,
  shareOrDownloadFile,
  triggerFileDownload,
} from './services/pdfEngine';
import { UI_STRINGS } from './constants/tools';
import { HomeScreen } from './components/HomeScreen';
import { ToolsScreen } from './components/ToolsScreen';
import { MyFilesScreen } from './components/MyFilesScreen';
import { TaskHistoryScreen } from './components/TaskHistoryScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { ImageImportFlow } from './components/ImageImportFlow';
import { CameraScannerFlow } from './components/CameraScannerFlow';
import { DocumentImportFlow } from './components/DocumentImportFlow';
import { PdfCreationWorkspace } from './components/PdfCreationWorkspace';
import { PdfToolWorkbench } from './components/PdfToolWorkbench';
import { PdfViewerModal } from './components/PdfViewerModal';
import { FileActionSheet } from './components/FileActionMenu';
import { admobService, WebAdEvent } from './services/admobService';
import { AdMobWebBanner, AdMobWebModal } from './components/AdMobTestOverlay';

type ActiveFlow =
  | { type: 'none' }
  | { type: 'images-import' }
  | { type: 'camera-scan'; mode: 'camera' | 'scan' }
  | { type: 'documents-import'; toolId: ToolId }
  | { type: 'create-workspace'; mode: 'images' | 'documents'; sourceTool: ToolId; images?: ImageItem[]; documents?: DocumentImportItem[] }
  | { type: 'pdf-tool'; toolId: ToolId; initialSelectedIds?: string[] };

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [flow, setFlow] = useState<ActiveFlow>({ type: 'none' });

  const [files, setFiles] = useState<PdfFileRecord[]>([]);
  const [folders, setFolders] = useState<FolderRecord[]>(DEFAULT_FOLDERS);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [hydrated, setHydrated] = useState(false);

  const [viewerFile, setViewerFile] = useState<PdfFileRecord | null>(null);
  const [menuFile, setMenuFile] = useState<PdfFileRecord | null>(null);
  const [filesSearchSeed, setFilesSearchSeed] = useState('');
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);

  // App Lock state
  const [appLocked, setAppLocked] = useState(false);
  const [unlockPin, setUnlockPin] = useState('');
  const [unlockErr, setUnlockErr] = useState(false);

  // AdMob Test Ads state
  const [adBannerEnabled, setAdBannerEnabled] = useState(true);
  const [webAdEvent, setWebAdEvent] = useState<WebAdEvent | null>(null);

  // Toast with optional Undo
  const [toast, setToast] = useState<{
    message: string;
    undoAction?: () => void;
  } | null>(null);

  const showToast = (message: string, undoAction?: () => void) => {
    setToast({ message, undoAction });
  };

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.undoAction ? 5500 : 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  // Apply Dark Mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (settings.darkMode) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [settings.darkMode]);

  // Initialize Capacitor AdMob SDK (native Android) & register web test ad listener
  useEffect(() => {
    admobService.registerWebPreviewListener((evt) => setWebAdEvent(evt));
    admobService.initialize().then(() => {
      if (adBannerEnabled) admobService.showBanner();
    });
    return () => {
      admobService.registerWebPreviewListener(null);
    };
  }, []);

  useEffect(() => {
    if (adBannerEnabled) admobService.showBanner();
    else admobService.hideBanner();
  }, [adBannerEnabled]);

  // Hydrate offline IndexedDB + seed starter sample PDFs on very first launch
  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      const [loadedFolders, loadedFiles, loadedTasks, loadedSettings] = await Promise.all([
        localDb.initFolders(),
        localDb.getFiles(),
        localDb.getTasks(),
        localDb.getSettings(),
      ]);

      if (cancelled) return;
      setFolders(loadedFolders);
      setSettings(loadedSettings);
      if (loadedSettings.appLockEnabled && loadedSettings.appLockPin) {
        setAppLocked(true);
      }

      if (loadedFiles.length === 0 && !loadedSettings.onboardingSeen) {
        // Generate two real, genuine PDFs offline via pdf-lib so Viewer, Merge, Split, Compress, Watermark are testable immediately
        const [welcomePdf, scanSamplePdf] = await Promise.all([
          createStarterSamplePdf(
            'PDF Maker Quick Start Guide',
            'Created offline · Local IndexedDB Library',
            [
              {
                heading: '1. Create PDFs from Images, Camera & Documents',
                paragraphs: [
                  'Welcome to PDF Maker. Every tool inside this application operates directly on your device with zero cloud upload required.',
                  'Import multiple JPG, PNG, or WEBP photos from your gallery, rearrange pages with drag and drop, rotate or crop frames, and customize margins, layout, page numbers, and watermarks.',
                ],
              },
              {
                heading: '2. Built-in PDF Tools & Reader',
                paragraphs: [
                  'Try opening this PDF in the integrated reader to test zoom, text search, page thumbnails, dark reading mode, and bookmarks.',
                  'You can also test Merge PDF, Split PDF, Compress PDF, Rotate PDF, Extract Pages, Reorder Pages, Watermark PDF, PDF to Images, and PDF to Word right away.',
                ],
              },
            ]
          ),
          createStarterSamplePdf(
            'Field Inspection Checklist',
            'Scanned Document Sample · 2 Pages',
            [
              {
                heading: 'Site Inspection Summary',
                paragraphs: [
                  'Reference Number: INSP-2026-1042. All equipment inspections completed and verified offline.',
                  'Use the Split PDF, Compress PDF, or Watermark PDF tools on this multi-page document to verify real offline processing.',
                ],
              },
              {
                heading: 'Approval & Archive Notes',
                paragraphs: [
                  'Stored locally in Scanned Documents folder. Ready for offline sharing, printing, or Word (.docx) extraction.',
                ],
              },
            ]
          ),
        ]);

        const now = Date.now();
        const starter1: PdfFileRecord = {
          id: crypto.randomUUID(),
          name: 'PDF Maker Quick Start Guide.pdf',
          extension: 'pdf',
          category: 'pdf',
          mimeType: 'application/pdf',
          size: welcomePdf.bytes.byteLength,
          pageCount: welcomePdf.pageCount,
          status: 'completed',
          folderId: 'created',
          createdAt: now - 3600000,
          updatedAt: now - 3600000,
          thumbnailDataUrl: welcomePdf.thumbnailDataUrl,
          data: welcomePdf.bytes.buffer.slice(
            welcomePdf.bytes.byteOffset,
            welcomePdf.bytes.byteOffset + welcomePdf.bytes.byteLength
          ) as ArrayBuffer,
          bookmarks: [1],
          sourceTool: 'documents-to-pdf',
        };

        const starter2: PdfFileRecord = {
          id: crypto.randomUUID(),
          name: 'Field Inspection Checklist.pdf',
          extension: 'pdf',
          category: 'pdf',
          mimeType: 'application/pdf',
          size: scanSamplePdf.bytes.byteLength,
          pageCount: scanSamplePdf.pageCount,
          status: 'completed',
          folderId: 'scanned',
          createdAt: now - 1800000,
          updatedAt: now - 1800000,
          thumbnailDataUrl: scanSamplePdf.thumbnailDataUrl,
          data: scanSamplePdf.bytes.buffer.slice(
            scanSamplePdf.bytes.byteOffset,
            scanSamplePdf.bytes.byteOffset + scanSamplePdf.bytes.byteLength
          ) as ArrayBuffer,
          bookmarks: [],
          sourceTool: 'scan-document',
        };

        const starterTask: TaskRecord = {
          id: crypto.randomUUID(),
          taskName: 'Sample Library Setup',
          toolId: 'documents-to-pdf',
          inputFiles: ['Quick Start Template'],
          outputFilename: starter1.name,
          outputFileId: starter1.id,
          startTime: now - 3602000,
          completionTime: now - 3600000,
          progress: 100,
          status: 'completed',
        };

        await Promise.all([
          localDb.saveFile(starter1),
          localDb.saveFile(starter2),
          localDb.saveTask(starterTask),
          localDb.saveSettings({ ...loadedSettings, onboardingSeen: true }),
        ]);

        if (!cancelled) {
          setFiles([starter2, starter1]);
          setTasks([starterTask]);
          setSettings({ ...loadedSettings, onboardingSeen: true });
        }
      } else {
        setFiles(loadedFiles);
        setTasks(loadedTasks);
      }

      if (!cancelled) setHydrated(true);
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const t = UI_STRINGS[settings.language] || UI_STRINGS.en;

  const updateSettings = async (patch: Partial<AppSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    await localDb.saveSettings(next);
  };

  const launchTool = (toolId: ToolId, initialSelectedIds?: string[]) => {
    setQuickCreateOpen(false);
    if (toolId === 'images-to-pdf') {
      setFlow({ type: 'images-import' });
    } else if (toolId === 'camera-to-pdf') {
      setFlow({ type: 'camera-scan', mode: 'camera' });
    } else if (toolId === 'scan-document') {
      setFlow({ type: 'camera-scan', mode: 'scan' });
    } else if (
      toolId === 'documents-to-pdf' ||
      toolId === 'word-to-pdf' ||
      toolId === 'excel-to-pdf' ||
      toolId === 'ppt-to-pdf'
    ) {
      setFlow({ type: 'documents-import', toolId });
    } else {
      setFlow({ type: 'pdf-tool', toolId, initialSelectedIds });
    }
  };

  const handleOpenFile = async (file: PdfFileRecord) => {
    const updated = { ...file, lastOpenedAt: Date.now() };
    setFiles((prev) => prev.map((f) => (f.id === file.id ? updated : f)));
    await localDb.saveFile(updated);
    setViewerFile(updated);
  };

  const handleToggleBookmark = async (fileId: string, pageNumber: number) => {
    const target = files.find((f) => f.id === fileId);
    if (!target) return;
    const existing = target.bookmarks || [];
    const nextBookmarks = existing.includes(pageNumber)
      ? existing.filter((p) => p !== pageNumber)
      : [...existing, pageNumber].sort((a, b) => a - b);
    const updated = { ...target, bookmarks: nextBookmarks };
    setFiles((prev) => prev.map((f) => (f.id === fileId ? updated : f)));
    setViewerFile(updated);
    await localDb.saveFile(updated);
    showToast(
      existing.includes(pageNumber)
        ? `Removed bookmark on page ${pageNumber}`
        : `Bookmarked page ${pageNumber}`
    );
  };

  const handleSaveCreatedFile = async (
    record: PdfFileRecord,
    inputNames: string[],
    taskName?: string
  ) => {
    await localDb.saveFile(record);
    setFiles((prev) => [record, ...prev]);

    const task: TaskRecord = {
      id: crypto.randomUUID(),
      taskName: taskName || 'Create PDF',
      toolId: record.sourceTool || 'images-to-pdf',
      inputFiles: inputNames,
      outputFilename: record.name,
      outputFileId: record.id,
      startTime: Date.now() - 800,
      completionTime: Date.now(),
      progress: 100,
      status: 'completed',
    };
    await localDb.saveTask(task);
    setTasks((prev) => [task, ...prev]);
    // Trigger AdMob Test Interstitial after PDF creation (with 45s cooldown)
    admobService.showInterstitial(false);
  };

  const handleSaveToolOutputs = async (
    outputRecords: PdfFileRecord[],
    taskName: string,
    inputNames: string[],
    toolId: ToolId
  ) => {
    for (const rec of outputRecords) {
      await localDb.saveFile(rec);
    }
    setFiles((prev) => [...outputRecords, ...prev]);

    const task: TaskRecord = {
      id: crypto.randomUUID(),
      taskName,
      toolId,
      inputFiles: inputNames,
      outputFilename:
        outputRecords.length === 1
          ? outputRecords[0].name
          : `${outputRecords.length} files (${outputRecords[0]?.name}...)`,
      outputFileId: outputRecords[0]?.id,
      startTime: Date.now() - 900,
      completionTime: Date.now(),
      progress: 100,
      status: 'completed',
    };
    await localDb.saveTask(task);
    setTasks((prev) => [task, ...prev]);
    // Trigger AdMob Test Interstitial after PDF tool completion (with 45s cooldown)
    admobService.showInterstitial(false);
  };

  // File mutations
  const handleRenameFile = async (file: PdfFileRecord, newName: string) => {
    const updated = { ...file, name: newName, updatedAt: Date.now() };
    setFiles((prev) => prev.map((f) => (f.id === file.id ? updated : f)));
    await localDb.saveFile(updated);
    showToast(`Renamed to ${newName}`);
  };

  const handleMoveFile = async (file: PdfFileRecord, folderId: string) => {
    const updated = { ...file, folderId, updatedAt: Date.now() };
    setFiles((prev) => prev.map((f) => (f.id === file.id ? updated : f)));
    await localDb.saveFile(updated);
    const fName = folders.find((fl) => fl.id === folderId)?.name || 'folder';
    showToast(`Moved to ${fName}`);
  };

  const handleCopyFile = async (file: PdfFileRecord) => {
    const copyName = file.name.replace(/(\.[^.]+)$/, ' (Copy)$1');
    const copy: PdfFileRecord = {
      ...file,
      id: crypto.randomUUID(),
      name: copyName,
      data: file.data.slice(0),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setFiles((prev) => [copy, ...prev]);
    await localDb.saveFile(copy);
    showToast(`Duplicated as ${copyName}`);
  };

  const handleDeleteFile = async (file: PdfFileRecord) => {
    setFiles((prev) => prev.filter((f) => f.id !== file.id));
    await localDb.deleteFile(file.id);
    showToast(`Deleted ${file.name}`, async () => {
      setFiles((prev) => [file, ...prev]);
      await localDb.saveFile(file);
      setToast(null);
    });
  };

  const handleBatchDelete = async (ids: string[]) => {
    const removed = files.filter((f) => ids.includes(f.id));
    setFiles((prev) => prev.filter((f) => !ids.includes(f.id)));
    await localDb.deleteFiles(ids);
    showToast(`Deleted ${removed.length} files`, async () => {
      for (const f of removed) await localDb.saveFile(f);
      setFiles((prev) => [...removed, ...prev]);
      setToast(null);
    });
  };

  const handleBatchMove = async (ids: string[], folderId: string) => {
    const updated = files.map((f) =>
      ids.includes(f.id) ? { ...f, folderId, updatedAt: Date.now() } : f
    );
    setFiles(updated);
    for (const f of updated.filter((item) => ids.includes(item.id))) {
      await localDb.saveFile(f);
    }
    showToast(`Moved ${ids.length} files`);
  };

  const handleShareFile = async (file: PdfFileRecord) => {
    const res = await shareOrDownloadFile(file.data, file.name, file.mimeType);
    showToast(res === 'shared' ? `Shared ${file.name}` : `Downloaded ${file.name}`);
  };

  const handleCreateFolder = async (name: string) => {
    const colors = ['#E50920', '#2563EB', '#0D9488', '#7C3AED', '#D97706', '#25A55B'];
    const folder: FolderRecord = {
      id: crypto.randomUUID(),
      name,
      system: false,
      createdAt: Date.now(),
      color: colors[folders.length % colors.length],
    };
    setFolders((prev) => [...prev, folder]);
    await localDb.saveFolder(folder);
    showToast(`Folder "${name}" created`);
  };

  const handleRenameFolder = async (id: string, name: string) => {
    const target = folders.find((f) => f.id === id);
    if (!target) return;
    const updated = { ...target, name };
    setFolders((prev) => prev.map((f) => (f.id === id ? updated : f)));
    await localDb.saveFolder(updated);
    showToast(`Folder renamed to "${name}"`);
  };

  const handleDeleteFolder = async (id: string) => {
    setFolders((prev) => prev.filter((f) => f.id !== id));
    setFiles((prev) =>
      prev.map((f) => (f.folderId === id ? { ...f, folderId: 'created' } : f))
    );
    await localDb.deleteFolder(id);
    showToast('Folder removed (files moved to Created PDFs)');
  };

  const totalStorageBytes = files.reduce((sum, f) => sum + f.size, 0);

  const navItems: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'home', label: t.home, icon: Home },
    { id: 'tools', label: t.tools, icon: Wrench },
    { id: 'files', label: t.myFiles, icon: FolderOpen },
    { id: 'history', label: t.history, icon: History },
    { id: 'settings', label: t.settings, icon: Settings },
  ];

  // App Lock Gate
  if (appLocked) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] dark:bg-[#111215] flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white dark:bg-[#1A1C20] rounded-3xl border border-[#E6E6E6] dark:border-[#2A2D34] p-7 text-center space-y-5 shadow-lg">
          <div className="w-14 h-14 rounded-2xl bg-[#E50920] text-white mx-auto flex items-center justify-center">
            <Lock className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#202124] dark:text-[#F3F4F6]">PDF Maker Locked</h1>
            <p className="text-xs text-[#777777] dark:text-[#9CA3AF] mt-1">
              Enter your 4-digit PIN to access your offline files
            </p>
          </div>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={unlockPin}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 4);
              setUnlockPin(v);
              setUnlockErr(false);
              if (v.length === 4) {
                if (v === settings.appLockPin) setAppLocked(false);
                else setUnlockErr(true);
              }
            }}
            placeholder="••••"
            autoFocus
            className="w-full h-12 text-center tracking-[0.6em] font-mono text-xl rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] border border-[#E6E6E6] dark:border-[#343842]"
          />
          {unlockErr && <p className="text-xs text-[#E50920]">Incorrect PIN. Try again.</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] dark:bg-[#111215] text-[#202124] dark:text-[#F3F4F6] flex">
      {/* Desktop Left Navigation Rail */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 fixed inset-y-0 left-0 bg-white dark:bg-[#1A1C20] border-r border-[#E6E6E6] dark:border-[#2A2D34] z-30">
        <div className="h-16 px-5 flex items-center gap-3 border-b border-[#E6E6E6] dark:border-[#2A2D34]">
          <div className="w-9 h-9 rounded-xl bg-[#E50920] text-white flex items-center justify-center font-display font-extrabold text-xs tracking-tight shrink-0">
            PDF
          </div>
          <span className="font-display font-bold text-lg tracking-tight text-[#202124] dark:text-[#F3F4F6] whitespace-nowrap">
            PDF Maker
          </span>
        </div>

        <div className="p-4">
          <button
            type="button"
            onClick={() => setQuickCreateOpen(true)}
            className="w-full h-11 rounded-xl bg-[#E50920] hover:bg-[#B81024] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t.createPdf}</span>
          </button>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id && flow.type === 'none';
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setFlow({ type: 'none' });
                  setActiveTab(item.id);
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 min-h-[44px] rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#E50920]/10 text-[#E50920] font-semibold'
                    : 'text-[#777777] dark:text-[#9CA3AF] hover:bg-[#F5F5F7] dark:hover:bg-[#24272E] hover:text-[#202124] dark:hover:text-[#F3F4F6]'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="whitespace-nowrap">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 m-3 rounded-2xl bg-[#F5F5F7] dark:bg-[#24272E] space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1.5 font-semibold text-[#202124] dark:text-[#F3F4F6]">
              <HardDrive className="w-3.5 h-3.5 text-[#E50920]" />
              Local Storage
            </span>
            <span className="font-mono tabular-nums text-[#777777] dark:text-[#9CA3AF]">
              {formatBytes(totalStorageBytes)}
            </span>
          </div>
          <p className="text-[11px] text-[#777777] dark:text-[#9CA3AF] tabular-nums">
            {files.length} {files.length === 1 ? 'file' : 'files'} saved offline
          </p>
        </div>
      </aside>

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Compact Sticky Top Header */}
        <header className="sticky top-0 z-20 h-14 bg-white/95 dark:bg-[#1A1C20]/95 backdrop-blur-md border-b border-[#E6E6E6] dark:border-[#2A2D34] px-4 sm:px-6 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => {
              setFlow({ type: 'none' });
              setActiveTab('home');
            }}
            className="flex items-center gap-2.5 lg:hidden cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-[#E50920] text-white flex items-center justify-center font-display font-extrabold text-[11px]">
              PDF
            </div>
            <span className="font-display font-bold text-base tracking-tight text-[#202124] dark:text-[#F3F4F6] whitespace-nowrap">
              PDF Maker
            </span>
          </button>

          <div className="hidden lg:flex items-center gap-2 text-sm font-semibold text-[#202124] dark:text-[#F3F4F6]">
            {flow.type === 'none'
              ? navItems.find((n) => n.id === activeTab)?.label
              : 'PDF Workspace'}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setFlow({ type: 'none' });
                setFilesSearchSeed('');
                setActiveTab('files');
              }}
              aria-label="Search files"
              className="min-w-[42px] min-h-[42px] rounded-xl flex items-center justify-center text-[#202124] dark:text-[#F3F4F6] hover:bg-[#F5F5F7] dark:hover:bg-[#24272E] transition-colors cursor-pointer"
            >
              <Search className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setFlow({ type: 'none' });
                setActiveTab('settings');
              }}
              aria-label="Settings"
              className="min-w-[42px] min-h-[42px] rounded-xl flex items-center justify-center text-[#202124] dark:text-[#F3F4F6] hover:bg-[#F5F5F7] dark:hover:bg-[#24272E] transition-colors cursor-pointer"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Main Scrollable Viewport */}
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-24 lg:pb-10">
          {!hydrated ? (
            <div className="py-20 text-center text-sm text-[#777777]">
              Loading offline PDF library...
            </div>
          ) : flow.type === 'images-import' ? (
            <ImageImportFlow
              onBack={() => setFlow({ type: 'none' })}
              onContinue={(selectedImages) =>
                setFlow({
                  type: 'create-workspace',
                  mode: 'images',
                  sourceTool: 'images-to-pdf',
                  images: selectedImages,
                })
              }
            />
          ) : flow.type === 'camera-scan' ? (
            <CameraScannerFlow
              initialMode={flow.mode === 'scan' ? 'document' : 'color'}
              onBack={() => setFlow({ type: 'none' })}
              onContinue={(scannedPages) =>
                setFlow({
                  type: 'create-workspace',
                  mode: 'images',
                  sourceTool: flow.mode === 'scan' ? 'scan-document' : 'camera-to-pdf',
                  images: scannedPages,
                })
              }
            />
          ) : flow.type === 'documents-import' ? (
            <DocumentImportFlow
              title={
                flow.toolId === 'word-to-pdf'
                  ? 'Word to PDF'
                  : flow.toolId === 'excel-to-pdf'
                  ? 'Excel to PDF'
                  : flow.toolId === 'ppt-to-pdf'
                  ? 'PowerPoint to PDF'
                  : 'Import Documents'
              }
              acceptOverride={
                flow.toolId === 'word-to-pdf'
                  ? '.doc,.docx'
                  : flow.toolId === 'excel-to-pdf'
                  ? '.xls,.xlsx,.csv'
                  : flow.toolId === 'ppt-to-pdf'
                  ? '.ppt,.pptx'
                  : '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png'
              }
              helperLabel={
                flow.toolId === 'word-to-pdf'
                  ? 'DOC, DOCX'
                  : flow.toolId === 'excel-to-pdf'
                  ? 'XLS, XLSX, CSV'
                  : flow.toolId === 'ppt-to-pdf'
                  ? 'PPT, PPTX'
                  : 'PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, JPG, PNG'
              }
              onBack={() => setFlow({ type: 'none' })}
              onContinue={(selectedDocs) =>
                setFlow({
                  type: 'create-workspace',
                  mode: 'documents',
                  sourceTool: flow.toolId,
                  documents: selectedDocs,
                })
              }
            />
          ) : flow.type === 'create-workspace' ? (
            <PdfCreationWorkspace
              mode={flow.mode}
              sourceTool={flow.sourceTool}
              images={flow.images}
              documents={flow.documents}
              appSettings={settings}
              folders={folders}
              onBack={() => setFlow({ type: 'none' })}
              onCreated={async (rec, inputNames) => {
                await handleSaveCreatedFile(rec, inputNames);
              }}
              onOpenFile={handleOpenFile}
              onCreateAnother={() => setFlow({ type: 'none' })}
            />
          ) : flow.type === 'pdf-tool' ? (
            <PdfToolWorkbench
              toolId={flow.toolId}
              libraryFiles={files}
              initialSelectedIds={flow.initialSelectedIds}
              onBack={() => setFlow({ type: 'none' })}
              onSaveOutputFiles={handleSaveToolOutputs}
              onOpenFile={handleOpenFile}
            />
          ) : activeTab === 'home' ? (
            <HomeScreen
              files={files}
              language={settings.language}
              hideThumbnails={settings.hideThumbnailsInRecents}
              onLaunchTool={launchTool}
              onOpenFile={handleOpenFile}
              onMoreOptions={setMenuFile}
              onSeeAllFiles={() => setActiveTab('files')}
            />
          ) : activeTab === 'tools' ? (
            <ToolsScreen onLaunchTool={launchTool} />
          ) : activeTab === 'files' ? (
            <MyFilesScreen
              files={files}
              folders={folders}
              initialSearch={filesSearchSeed}
              hideThumbnails={settings.hideThumbnailsInRecents}
              onOpenFile={handleOpenFile}
              onMoreOptions={setMenuFile}
              onCreatePdf={() => setQuickCreateOpen(true)}
              onBatchShare={async (selected) => {
                for (const f of selected) {
                  await shareOrDownloadFile(f.data, f.name, f.mimeType);
                }
                showToast(`Exported ${selected.length} files`);
              }}
              onBatchDelete={handleBatchDelete}
              onBatchMove={handleBatchMove}
              onBatchMerge={(ids) => launchTool('merge-pdf', ids)}
              onCreateFolder={handleCreateFolder}
              onRenameFolder={handleRenameFolder}
              onDeleteFolder={handleDeleteFolder}
            />
          ) : activeTab === 'history' ? (
            <TaskHistoryScreen
              tasks={tasks}
              files={files}
              onCancelTask={async (taskId) => {
                const updated = tasks.map((tk) =>
                  tk.id === taskId ? { ...tk, status: 'failed' as const, errorMessage: 'Cancelled by user' } : tk
                );
                setTasks(updated);
                const tObj = updated.find((tk) => tk.id === taskId);
                if (tObj) await localDb.saveTask(tObj);
                showToast('Task cancelled');
              }}
              onRetryTask={(toolId) => launchTool(toolId)}
              onDeleteTask={async (taskId) => {
                setTasks((prev) => prev.filter((tk) => tk.id !== taskId));
                await localDb.deleteTask(taskId);
              }}
              onClearHistory={async () => {
                await localDb.clearCompletedTasks();
                setTasks((prev) => prev.filter((tk) => tk.status === 'processing'));
                showToast('Cleared completed history');
              }}
              onOpenOutputFile={handleOpenFile}
              onCreatePdf={() => setQuickCreateOpen(true)}
            />
          ) : (
            <SettingsScreen
              settings={settings}
              folders={folders}
              storageTotalBytes={totalStorageBytes}
              fileCount={files.length}
              onUpdateSettings={updateSettings}
              onClearCache={async () => {
                await localDb.clearCompletedTasks();
                setTasks((prev) => prev.filter((tk) => tk.status === 'processing'));
                showToast('Cache cleared');
              }}
              onOpenStorageFolders={() => setActiveTab('files')}
              onNotify={showToast}
              bannerEnabled={adBannerEnabled}
              onToggleBanner={(val) => {
                setAdBannerEnabled(val);
                showToast(val ? 'AdMob Test Banner enabled' : 'AdMob Test Banner hidden');
              }}
            />
          )}

          {/* Non-intrusive AdMob Test Banner Preview on Web (Native SDK renders native AdView on Android) */}
          {!admobService.isNativeAndroid() && flow.type === 'none' && (
            <div className="mt-4">
              <AdMobWebBanner
                visible={adBannerEnabled}
                onDismiss={() => setAdBannerEnabled(false)}
              />
            </div>
          )}
        </main>
      </div>

      {/* Mobile Floating Action Button (only when not inside a sub-flow) */}
      {flow.type === 'none' && (
        <button
          type="button"
          onClick={() => setQuickCreateOpen(true)}
          aria-label="Create PDF"
          className="lg:hidden fixed right-4 bottom-20 z-30 w-14 h-14 rounded-2xl bg-[#E50920] hover:bg-[#B81024] text-white shadow-lg shadow-[#E50920]/30 flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {/* Mobile Bottom Navigation Bar (5 Items) */}
      <nav
        aria-label="Primary Navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 h-16 pb-safe bg-white/95 dark:bg-[#1A1C20]/95 backdrop-blur-md border-t border-[#E6E6E6] dark:border-[#2A2D34] grid grid-cols-5 items-center"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id && flow.type === 'none';
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setFlow({ type: 'none' });
                setActiveTab(item.id);
              }}
              className={`flex flex-col items-center justify-center h-full transition-colors cursor-pointer ${
                active ? 'text-[#E50920]' : 'text-[#777777] dark:text-[#9CA3AF]'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[11px] font-medium mt-1 whitespace-nowrap">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Quick Create Bottom Sheet / Modal */}
      {quickCreateOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4"
          onClick={() => setQuickCreateOpen(false)}
        >
          <div
            className="w-full sm:max-w-md bg-white dark:bg-[#1A1C20] rounded-t-3xl sm:rounded-2xl border border-[#E6E6E6] dark:border-[#2A2D34] p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sm:hidden w-10 h-1.5 bg-[#D1D5DB] dark:bg-[#3A3F4B] rounded-full mx-auto" />
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#202124] dark:text-[#F3F4F6]">
                Create New PDF
              </h3>
              <button
                type="button"
                onClick={() => setQuickCreateOpen(false)}
                className="min-w-[38px] min-h-[38px] rounded-xl flex items-center justify-center text-[#777777] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2.5">
              {[
                { id: 'images-to-pdf' as ToolId, title: 'Import Images from Gallery', desc: 'JPG, JPEG, PNG, WEBP with crop & reorder' },
                { id: 'scan-document' as ToolId, title: 'Scan Document with Camera', desc: 'Auto edge detection, filters & shadow removal' },
                { id: 'documents-to-pdf' as ToolId, title: 'Convert Documents to PDF', desc: 'Word, Excel, PowerPoint, TXT & PDF' },
                { id: 'merge-pdf' as ToolId, title: 'Merge Existing PDFs', desc: 'Combine multiple PDFs into one file' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => launchTool(opt.id)}
                  className="flex items-center gap-3.5 p-3.5 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] hover:bg-[#E50920]/8 text-left transition-colors cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#E50920] text-white flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#202124] dark:text-[#F3F4F6]">
                      {opt.title}
                    </p>
                    <p className="text-xs text-[#777777] dark:text-[#9CA3AF]">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* File More Options Sheet */}
      <FileActionSheet
        file={menuFile}
        folders={folders}
        onClose={() => setMenuFile(null)}
        onOpen={handleOpenFile}
        onRename={handleRenameFile}
        onShare={handleShareFile}
        onPrint={(file) => {
          printPdfBuffer(file.data);
          showToast(`Preparing ${file.name} for print`);
        }}
        onMove={handleMoveFile}
        onCopy={handleCopyFile}
        onExport={(file) => {
          triggerFileDownload(file.data, file.name, file.mimeType);
          showToast(`Exported ${file.name}`);
        }}
        onDelete={handleDeleteFile}
      />

      {/* Integrated Offline PDF Viewer */}
      <PdfViewerModal
        file={viewerFile}
        onClose={() => setViewerFile(null)}
        onToggleBookmark={handleToggleBookmark}
      />

      {/* AdMob Web Test Ad Modal (Interstitial / Rewarded Preview) */}
      <AdMobWebModal
        event={webAdEvent}
        onClose={(rewarded) => {
          setWebAdEvent(null);
          if (rewarded) showToast('Test AdMob reward received');
        }}
      />

      {/* Toast Notification with Undo */}
      {toast && (
        <div className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#202124] text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 max-w-[92vw]">
          <span className="text-sm font-medium">{toast.message}</span>
          {toast.undoAction && (
            <button
              type="button"
              onClick={toast.undoAction}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#E50920] text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Undo</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
