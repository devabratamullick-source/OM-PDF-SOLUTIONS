import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  ArrowLeft,
  Search,
  Bookmark,
  MoreVertical,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Moon,
  Sun,
  Printer,
  Share2,
  Download,
  PanelLeft,
  X,
  Lock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { PdfFileRecord } from '../types/pdf';
import {
  printPdfBuffer,
  searchPdfText,
  shareOrDownloadFile,
  triggerFileDownload,
} from '../services/pdfEngine';

interface PdfViewerModalProps {
  file: PdfFileRecord | null;
  onClose: () => void;
  onToggleBookmark: (fileId: string, pageNumber: number) => void;
}

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({
  file,
  onClose,
  onToggleBookmark,
}) => {
  const [unlocked, setUnlocked] = useState(false);
  const [passwordAttempt, setPasswordAttempt] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1.15);
  const [fitMode, setFitMode] = useState<'width' | 'page' | 'custom'>('width');
  const [darkReading, setDarkReading] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showThumbs, setShowThumbs] = useState(true);
  const [showMore, setShowMore] = useState(false);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatches, setSearchMatches] = useState<{ pageNumber: number; snippet: string }[]>([]);
  const [searching, setSearching] = useState(false);

  const [renderedPages, setRenderedPages] = useState<string[]>([]);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!file) return;
    setUnlocked(!file.password);
    setPasswordAttempt('');
    setPasswordError(false);
    setCurrentPage(1);
    setSearchOpen(false);
    setSearchQuery('');
    setSearchMatches([]);
    setShowMore(false);
  }, [file?.id]);

  useEffect(() => {
    if (!file || !unlocked) return;
    if (file.extension.toLowerCase() !== 'pdf') return;

    let cancelled = false;
    setLoading(true);

    async function renderAll() {
      try {
        const copy = new Uint8Array(file!.data).slice();
        const pdf = await pdfjsLib.getDocument({ data: copy }).promise;
        if (cancelled) {
          await pdf.cleanup();
          return;
        }
        setNumPages(pdf.numPages);

        const pagesImgs: string[] = [];
        const thumbImgs: string[] = [];

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const vp = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(vp.width));
          canvas.height = Math.max(1, Math.round(vp.height));
          const ctx = canvas.getContext('2d')!;
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise;
          pagesImgs.push(canvas.toDataURL('image/jpeg', 0.88));

          // Thumbnail
          const tvp = page.getViewport({ scale: 0.25 });
          const tCanvas = document.createElement('canvas');
          tCanvas.width = Math.max(1, Math.round(tvp.width));
          tCanvas.height = Math.max(1, Math.round(tvp.height));
          const tCtx = tCanvas.getContext('2d')!;
          tCtx.fillStyle = '#FFFFFF';
          tCtx.fillRect(0, 0, tCanvas.width, tCanvas.height);
          await page.render({ canvasContext: tCtx, viewport: tvp, canvas: tCanvas }).promise;
          thumbImgs.push(tCanvas.toDataURL('image/jpeg', 0.72));
        }

        if (!cancelled) {
          setRenderedPages(pagesImgs);
          setThumbnails(thumbImgs);
        }
        await pdf.cleanup();
      } catch {
        if (!cancelled) setRenderedPages([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    renderAll();
    return () => {
      cancelled = true;
    };
  }, [file?.id, unlocked]);

  if (!file) return null;

  const bookmarks = file.bookmarks || [];
  const isBookmarked = bookmarks.includes(currentPage);

  const jumpToPage = (pageNum: number) => {
    const clamped = Math.max(1, Math.min(numPages || 1, pageNum));
    setCurrentPage(clamped);
    const el = pageRefs.current[clamped];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchMatches([]);
      return;
    }
    setSearching(true);
    try {
      const results = await searchPdfText(file.data, searchQuery);
      setSearchMatches(results);
      if (results[0]) jumpToPage(results[0].pageNumber);
    } finally {
      setSearching(false);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement && containerRef.current) {
      containerRef.current.requestFullscreen?.().catch(() => {});
      setFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setFullscreen(false);
    }
  };

  // Password gate for protected PDFs
  if (!unlocked) {
    return (
      <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white dark:bg-[#1A1C20] rounded-2xl border border-[#E6E6E6] dark:border-[#2A2D34] p-6 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#E50920]/10 text-[#E50920] flex items-center justify-center">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#202124] dark:text-[#F3F4F6]">
              Password Protected PDF
            </h2>
            <p className="text-xs text-[#777777] dark:text-[#9CA3AF] mt-1">
              Enter the password to open <span className="font-semibold">{file.name}</span>.
            </p>
          </div>
          <input
            type="password"
            value={passwordAttempt}
            onChange={(e) => {
              setPasswordAttempt(e.target.value);
              setPasswordError(false);
            }}
            placeholder="Enter password"
            autoFocus
            className="w-full h-11 px-3.5 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] border border-[#E6E6E6] dark:border-[#343842] text-sm"
          />
          {passwordError && (
            <p className="text-xs text-[#E50920]">Incorrect password. Please try again.</p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 min-h-[42px] rounded-xl text-sm text-[#777777] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (passwordAttempt === file.password) setUnlocked(true);
                else setPasswordError(true);
              }}
              className="px-5 py-2 min-h-[42px] rounded-xl bg-[#E50920] text-white text-sm font-semibold cursor-pointer"
            >
              Unlock
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-50 flex flex-col ${
        darkReading ? 'bg-[#111215] text-white' : 'bg-[#ECEEF2] dark:bg-[#111215] text-[#202124] dark:text-[#F3F4F6]'
      }`}
    >
      {/* Top Toolbar */}
      <header className="h-14 shrink-0 bg-white dark:bg-[#1A1C20] border-b border-[#E6E6E6] dark:border-[#2A2D34] px-3 sm:px-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back"
            className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center hover:bg-[#F5F5F7] dark:hover:bg-[#24272E] cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-sm font-bold truncate">{file.name}</h2>
        </div>

        <div className="flex items-center gap-1 shrink-0 relative">
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            aria-label="Search text"
            className={`min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center cursor-pointer ${
              searchOpen ? 'bg-[#E50920]/10 text-[#E50920]' : 'hover:bg-[#F5F5F7] dark:hover:bg-[#24272E]'
            }`}
          >
            <Search className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => onToggleBookmark(file.id, currentPage)}
            aria-label="Bookmark current page"
            className={`min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center cursor-pointer ${
              isBookmarked ? 'text-[#E50920] bg-[#E50920]/10' : 'hover:bg-[#F5F5F7] dark:hover:bg-[#24272E]'
            }`}
          >
            <Bookmark className={`w-5 h-5 ${isBookmarked ? 'fill-current' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            aria-label="More options"
            className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center hover:bg-[#F5F5F7] dark:hover:bg-[#24272E] cursor-pointer"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {showMore && (
            <div className="absolute right-0 top-12 w-52 bg-white dark:bg-[#1A1C20] rounded-2xl border border-[#E6E6E6] dark:border-[#2A2D34] shadow-xl p-1.5 z-40">
              <button
                type="button"
                onClick={() => {
                  setDarkReading((v) => !v);
                  setShowMore(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-[#F5F5F7] dark:hover:bg-[#24272E] cursor-pointer"
              >
                {darkReading ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                <span>{darkReading ? 'Light Reading Mode' : 'Dark Reading Mode'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  shareOrDownloadFile(file.data, file.name, file.mimeType);
                  setShowMore(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-[#F5F5F7] dark:hover:bg-[#24272E] cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>Share</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  printPdfBuffer(file.data);
                  setShowMore(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-[#F5F5F7] dark:hover:bg-[#24272E] cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerFileDownload(file.data, file.name, file.mimeType);
                  setShowMore(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-[#F5F5F7] dark:hover:bg-[#24272E] cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Search Bar Drawer */}
      {searchOpen && (
        <div className="bg-white dark:bg-[#1A1C20] border-b border-[#E6E6E6] dark:border-[#2A2D34] px-4 py-2.5 space-y-2">
          <form onSubmit={handleSearch} className="flex items-center gap-2 max-w-xl mx-auto">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search text inside this PDF..."
              autoFocus
              className="flex-1 h-10 px-3.5 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] text-sm focus:outline-none"
            />
            <button
              type="submit"
              className="px-4 h-10 rounded-xl bg-[#E50920] text-white text-xs font-semibold cursor-pointer"
            >
              {searching ? 'Searching...' : 'Find'}
            </button>
            <button
              type="button"
              onClick={() => setSearchOpen(false)}
              className="p-2 text-[#777777] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </form>
          {searchMatches.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto max-w-3xl mx-auto pb-1">
              {searchMatches.map((m, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => jumpToPage(m.pageNumber)}
                  className="px-3 py-1.5 rounded-lg bg-[#F5F5F7] dark:bg-[#24272E] hover:bg-[#E50920]/10 text-xs whitespace-nowrap cursor-pointer"
                >
                  <strong className="text-[#E50920]">P{m.pageNumber}:</strong> {m.snippet.slice(0, 42)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Reader Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Thumbnails Sidebar */}
        {showThumbs && thumbnails.length > 0 && (
          <aside className="hidden sm:flex flex-col w-44 shrink-0 bg-white dark:bg-[#1A1C20] border-r border-[#E6E6E6] dark:border-[#2A2D34] overflow-y-auto p-3 space-y-3">
            {thumbnails.map((thumb, idx) => {
              const pNum = idx + 1;
              const marked = bookmarks.includes(pNum);
              return (
                <button
                  key={pNum}
                  type="button"
                  onClick={() => jumpToPage(pNum)}
                  className={`w-full p-1.5 rounded-xl border transition-colors cursor-pointer ${
                    currentPage === pNum
                      ? 'border-[#E50920] bg-[#E50920]/8'
                      : 'border-transparent hover:bg-[#F5F5F7] dark:hover:bg-[#24272E]'
                  }`}
                >
                  <img src={thumb} alt={`Page ${pNum}`} className="w-full rounded shadow-xs" />
                  <div className="flex items-center justify-center gap-1 mt-1 text-[11px] font-medium tabular-nums">
                    <span>Page {pNum}</span>
                    {marked && <Bookmark className="w-3 h-3 text-[#E50920] fill-current" />}
                  </div>
                </button>
              );
            })}
          </aside>
        )}

        {/* Smooth-scrolling PDF Canvas Pages */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6">
          {file.extension.toLowerCase() !== 'pdf' ? (
            <div className="max-w-md mx-auto bg-white dark:bg-[#1A1C20] rounded-2xl p-8 text-center space-y-4 mt-12">
              <p className="text-sm font-semibold">
                {file.name} is a .{file.extension.toUpperCase()} document.
              </p>
              <button
                type="button"
                onClick={() => triggerFileDownload(file.data, file.name, file.mimeType)}
                className="px-5 py-2.5 rounded-xl bg-[#E50920] text-white text-sm font-semibold cursor-pointer"
              >
                Download File
              </button>
            </div>
          ) : loading ? (
            <div className="text-center py-20 text-sm text-[#777777]">Rendering PDF pages...</div>
          ) : (
            renderedPages.map((imgUrl, idx) => {
              const pNum = idx + 1;
              return (
                <div
                  key={pNum}
                  ref={(el) => {
                    pageRefs.current[pNum] = el;
                  }}
                  onClick={() => setCurrentPage(pNum)}
                  className="mx-auto transition-all flex flex-col items-center"
                  style={{
                    width:
                      fitMode === 'width'
                        ? 'min(100%, 840px)'
                        : fitMode === 'page'
                        ? 'min(100%, 540px)'
                        : `${Math.round(720 * zoom)}px`,
                  }}
                >
                  <img
                    src={imgUrl}
                    alt={`Page ${pNum}`}
                    className={`w-full rounded-lg shadow-md border border-black/10 ${
                      darkReading ? 'invert hue-rotate-180 brightness-90 contrast-95' : ''
                    }`}
                  />
                  <span className="text-[11px] text-[#777777] mt-2 tabular-nums">
                    Page {pNum} of {numPages}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Bottom Reader Controls Bar */}
      <footer className="h-14 shrink-0 bg-white dark:bg-[#1A1C20] border-t border-[#E6E6E6] dark:border-[#2A2D34] px-3 sm:px-5 flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowThumbs((v) => !v)}
            className="hidden sm:inline-flex min-w-[38px] min-h-[38px] rounded-xl items-center justify-center hover:bg-[#F5F5F7] dark:hover:bg-[#24272E] cursor-pointer"
            title="Toggle page thumbnails"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => jumpToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="min-w-[38px] min-h-[38px] rounded-xl flex items-center justify-center disabled:opacity-35 hover:bg-[#F5F5F7] dark:hover:bg-[#24272E] cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-semibold tabular-nums whitespace-nowrap px-1">
            {currentPage} / {numPages || file.pageCount}
          </span>
          <button
            type="button"
            onClick={() => jumpToPage(currentPage + 1)}
            disabled={currentPage >= numPages}
            className="min-w-[38px] min-h-[38px] rounded-xl flex items-center justify-center disabled:opacity-35 hover:bg-[#F5F5F7] dark:hover:bg-[#24272E] cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setFitMode('custom');
              setZoom((z) => Math.max(0.5, Number((z - 0.15).toFixed(2))));
            }}
            aria-label="Zoom out"
            className="min-w-[38px] min-h-[38px] rounded-xl flex items-center justify-center hover:bg-[#F5F5F7] dark:hover:bg-[#24272E] cursor-pointer"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono tabular-nums w-12 text-center">
            {fitMode === 'width' ? 'Fit W' : fitMode === 'page' ? 'Fit P' : `${Math.round(zoom * 100)}%`}
          </span>
          <button
            type="button"
            onClick={() => {
              setFitMode('custom');
              setZoom((z) => Math.min(2.4, Number((z + 0.15).toFixed(2))));
            }}
            aria-label="Zoom in"
            className="min-w-[38px] min-h-[38px] rounded-xl flex items-center justify-center hover:bg-[#F5F5F7] dark:hover:bg-[#24272E] cursor-pointer"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setFitMode(fitMode === 'width' ? 'page' : 'width')}
            className="px-2.5 h-9 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] text-xs font-semibold whitespace-nowrap cursor-pointer"
          >
            {fitMode === 'width' ? 'Fit Page' : 'Fit Width'}
          </button>

          <button
            type="button"
            onClick={() => setDarkReading((v) => !v)}
            aria-label="Toggle dark reading mode"
            className={`min-w-[38px] min-h-[38px] rounded-xl flex items-center justify-center cursor-pointer ${
              darkReading ? 'bg-[#E50920] text-white' : 'hover:bg-[#F5F5F7] dark:hover:bg-[#24272E]'
            }`}
          >
            {darkReading ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label="Fullscreen"
            className="min-w-[38px] min-h-[38px] rounded-xl flex items-center justify-center hover:bg-[#F5F5F7] dark:hover:bg-[#24272E] cursor-pointer"
          >
            {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </footer>
    </div>
  );
};
