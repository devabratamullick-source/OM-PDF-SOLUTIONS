import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  RotateCw,
  Trash2,
  ArrowRight,
  ScanLine,
  Sun,
  Wand2,
  RefreshCw,
  Upload,
  Check,
  Plus,
} from 'lucide-react';
import { CameraFilterMode, ImageItem } from '../types/pdf';
import {
  detectDocumentEdges,
  generateSimulatedScanCapture,
  loadImageElement,
  processImageDataUrl,
  readFileAsDataUrl,
} from '../services/imageProcessor';

interface CameraScannerFlowProps {
  initialMode?: CameraFilterMode;
  onBack: () => void;
  onContinue: (scannedPages: ImageItem[]) => void;
}

const FILTER_MODES: { id: CameraFilterMode; label: string }[] = [
  { id: 'document', label: 'Document' },
  { id: 'color', label: 'Color' },
  { id: 'grayscale', label: 'Grayscale' },
  { id: 'bw', label: 'Black & White' },
];

export const CameraScannerFlow: React.FC<CameraScannerFlowProps> = ({
  initialMode = 'document',
  onBack,
  onContinue,
}) => {
  const [step, setStep] = useState<'capture' | 'review'>('capture');
  const [mode, setMode] = useState<CameraFilterMode>(initialMode);
  const [autoCrop, setAutoCrop] = useState(true);
  const [removeShadows, setRemoveShadows] = useState(true);
  const [pages, setPages] = useState<ImageItem[]>([]);
  const [activeEditId, setActiveEditId] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step !== 'capture') {
      stopCamera();
      return;
    }

    let cancelled = false;
    async function startCamera() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Live camera API unavailable on this browser. You can upload a photo or capture a test scan.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1600 }, height: { ideal: 1200 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraReady(true);
        setCameraError(null);
      } catch {
        if (!cancelled) {
          setCameraError('Camera access was not granted. Use Upload Photo or Capture Sample Page below to scan documents offline.');
          setCameraReady(false);
        }
      }
    }

    startCamera();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [step]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  };

  const addCapturedDataUrl = async (rawDataUrl: string, label: string) => {
    setCapturing(true);
    try {
      const detectedCrop = autoCrop ? await detectDocumentEdges(rawDataUrl) : undefined;
      const processed = await processImageDataUrl(rawDataUrl, {
        rotation: 0,
        crop: detectedCrop,
        filter: mode,
        brightness: mode === 'document' ? 6 : 0,
        contrast: mode === 'document' ? 14 : 0,
        removeShadows,
      });
      const imgEl = await loadImageElement(processed.dataUrl);
      const item: ImageItem = {
        id: crypto.randomUUID(),
        name: label,
        originalDataUrl: rawDataUrl,
        processedDataUrl: processed.dataUrl,
        mimeType: 'image/jpeg',
        size: processed.size,
        width: imgEl.width,
        height: imgEl.height,
        rotation: 0,
        crop: detectedCrop,
        filter: mode,
        brightness: mode === 'document' ? 6 : 0,
        contrast: mode === 'document' ? 14 : 0,
        removeShadows,
        selected: true,
      };
      setPages((prev) => [...prev, item]);
      setActiveEditId(item.id);
    } finally {
      setCapturing(false);
    }
  };

  const handleLiveCapture = async () => {
    if (cameraReady && videoRef.current && videoRef.current.videoWidth > 0) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      await addCapturedDataUrl(dataUrl, `Scan Page ${pages.length + 1}.jpg`);
    } else {
      const sample = generateSimulatedScanCapture(pages.length + 1);
      await addCapturedDataUrl(sample, `Scan Page ${pages.length + 1}.jpg`);
    }
  };

  const handlePhotoUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      const dataUrl = await readFileAsDataUrl(file);
      await addCapturedDataUrl(dataUrl, file.name);
    }
    if (uploadInputRef.current) uploadInputRef.current.value = '';
  };

  const updatePageEnhancements = async (
    id: string,
    patch: Partial<Pick<ImageItem, 'filter' | 'brightness' | 'contrast' | 'removeShadows' | 'rotation' | 'crop'>>
  ) => {
    const target = pages.find((p) => p.id === id);
    if (!target) return;
    const next = { ...target, ...patch };
    const res = await processImageDataUrl(next.originalDataUrl, {
      rotation: next.rotation,
      crop: next.crop,
      filter: next.filter,
      brightness: next.brightness,
      contrast: next.contrast,
      removeShadows: next.removeShadows,
    });
    setPages((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...next, processedDataUrl: res.dataUrl, width: res.width, height: res.height, size: res.size }
          : p
      )
    );
  };

  const movePage = (idx: number, dir: -1 | 1) => {
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= pages.length) return;
    setPages((prev) => {
      const copy = [...prev];
      [copy[idx], copy[nextIdx]] = [copy[nextIdx], copy[idx]];
      return copy;
    });
  };

  const activePage = pages.find((p) => p.id === activeEditId) || pages[pages.length - 1] || null;

  return (
    <div className="space-y-6 pb-24">
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        onChange={(e) => handlePhotoUpload(e.target.files)}
        className="hidden"
      />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onBack();
            }}
            className="min-w-[44px] min-h-[44px] rounded-xl bg-white dark:bg-[#1A1C20] border border-[#E6E6E6] dark:border-[#2A2D34] flex items-center justify-center text-[#202124] dark:text-[#F3F4F6] cursor-pointer"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-[#202124] dark:text-[#F3F4F6]">
              {step === 'capture' ? 'Camera Document Scanner' : 'Review Scanned Pages'}
            </h1>
            <p className="text-xs text-[#777777] dark:text-[#9CA3AF] tabular-nums">
              {pages.length} {pages.length === 1 ? 'page' : 'pages'} captured · Auto edge-detection & perspective crop
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {step === 'capture' && pages.length > 0 && (
            <button
              type="button"
              onClick={() => setStep('review')}
              className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-[#E50920] hover:bg-[#B81024] text-white text-sm font-semibold cursor-pointer whitespace-nowrap"
            >
              <span>Review ({pages.length})</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
          {step === 'review' && (
            <button
              type="button"
              onClick={() => setStep('capture')}
              className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-white dark:bg-[#1A1C20] border border-[#E6E6E6] dark:border-[#2A2D34] text-sm font-medium text-[#202124] dark:text-[#F3F4F6] cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Scan More</span>
            </button>
          )}
        </div>
      </div>

      {step === 'capture' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Viewfinder */}
          <div className="lg:col-span-8 bg-[#111215] rounded-2xl overflow-hidden border border-[#2A2D34] relative">
            <div className="relative aspect-[4/3] sm:aspect-[16/11] flex items-center justify-center overflow-hidden">
              <video
                ref={videoRef}
                playsInline
                muted
                className={`w-full h-full object-cover ${cameraReady ? 'block' : 'hidden'}`}
              />

              {!cameraReady && (
                <div className="p-8 text-center max-w-md space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-white/10 text-white mx-auto flex items-center justify-center">
                    <Camera className="w-8 h-8" />
                  </div>
                  <p className="text-sm text-white/90 leading-relaxed">
                    {cameraError || 'Initializing device camera...'}
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => uploadInputRef.current?.click()}
                      className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-white text-[#111215] text-sm font-semibold cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Upload / Take Photo</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleLiveCapture}
                      className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-[#E50920] hover:bg-[#B81024] text-white text-sm font-semibold cursor-pointer"
                    >
                      <ScanLine className="w-4 h-4" />
                      <span>Capture Sample Document</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Automatic Document Edge Detection Frame */}
              {cameraReady && (
                <div className="absolute inset-6 sm:inset-10 pointer-events-none border-2 border-[#E50920]/80 rounded-xl">
                  <span className="absolute -top-0.5 -left-0.5 w-6 h-6 border-t-4 border-l-4 border-[#E50920] rounded-tl-md" />
                  <span className="absolute -top-0.5 -right-0.5 w-6 h-6 border-t-4 border-r-4 border-[#E50920] rounded-tr-md" />
                  <span className="absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-4 border-l-4 border-[#E50920] rounded-bl-md" />
                  <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-4 border-r-4 border-[#E50920] rounded-br-md" />
                </div>
              )}
            </div>

            {/* Camera Controls Strip */}
            <div className="bg-[#1A1C20] px-4 py-4 border-t border-[#2A2D34] space-y-4">
              {/* Camera Modes */}
              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                {FILTER_MODES.map((fm) => (
                  <button
                    key={fm.id}
                    type="button"
                    onClick={() => setMode(fm.id)}
                    className={`px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                      mode === fm.id
                        ? 'bg-[#E50920] text-white'
                        : 'bg-[#262930] text-gray-300 hover:bg-[#31353E]'
                    }`}
                  >
                    {fm.label}
                  </button>
                ))}
              </div>

              {/* Shutter Row */}
              <div className="flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => uploadInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-3.5 py-2.5 min-h-[44px] rounded-xl bg-[#262930] text-white text-xs font-medium hover:bg-[#31353E] cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span className="hidden sm:inline">Import Photo</span>
                </button>

                <button
                  type="button"
                  disabled={capturing}
                  onClick={handleLiveCapture}
                  className="w-16 h-16 rounded-full bg-white p-1.5 flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
                  aria-label="Capture document page"
                >
                  <span className="w-full h-full rounded-full bg-[#E50920] flex items-center justify-center text-white">
                    <Camera className="w-6 h-6" />
                  </span>
                </button>

                <button
                  type="button"
                  disabled={pages.length === 0}
                  onClick={() => setStep('review')}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-xl bg-[#25A55B] disabled:opacity-35 text-white text-xs font-semibold cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Done ({pages.length})</span>
                </button>
              </div>
            </div>
          </div>

          {/* Scan Options + Captured Queue */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white dark:bg-[#1A1C20] rounded-2xl border border-[#E6E6E6] dark:border-[#2A2D34] p-4 space-y-3.5">
              <h2 className="text-sm font-bold text-[#202124] dark:text-[#F3F4F6]">
                Auto Scan Enhancements
              </h2>
              <label className="flex items-center justify-between gap-3 py-1 cursor-pointer">
                <span className="text-sm text-[#202124] dark:text-[#F3F4F6]">
                  Auto Edge Detection & Crop
                </span>
                <input
                  type="checkbox"
                  checked={autoCrop}
                  onChange={(e) => setAutoCrop(e.target.checked)}
                  className="w-5 h-5 accent-[#E50920]"
                />
              </label>
              <label className="flex items-center justify-between gap-3 py-1 cursor-pointer">
                <span className="text-sm text-[#202124] dark:text-[#F3F4F6]">
                  Remove Paper Shadows
                </span>
                <input
                  type="checkbox"
                  checked={removeShadows}
                  onChange={(e) => setRemoveShadows(e.target.checked)}
                  className="w-5 h-5 accent-[#E50920]"
                />
              </label>
            </div>

            <div className="bg-white dark:bg-[#1A1C20] rounded-2xl border border-[#E6E6E6] dark:border-[#2A2D34] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-[#202124] dark:text-[#F3F4F6]">
                  Captured Pages ({pages.length})
                </h2>
                {pages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setStep('review')}
                    className="text-xs font-semibold text-[#E50920] cursor-pointer"
                  >
                    Edit & Reorder
                  </button>
                )}
              </div>

              {pages.length === 0 ? (
                <p className="text-xs text-[#777777] dark:text-[#9CA3AF] py-6 text-center">
                  Tap the red shutter button to capture your first document page.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {pages.map((p, idx) => (
                    <div
                      key={p.id}
                      className="relative aspect-[3/4] rounded-xl overflow-hidden border border-[#E6E6E6] dark:border-[#343842] bg-[#F5F5F7] dark:bg-[#24272E]"
                    >
                      <img
                        src={p.processedDataUrl}
                        alt={p.name}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/75 text-white text-[10px] font-mono">
                        P{idx + 1}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Review, Enhance, Rearrange, Retake Screen */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Active Page Preview & Enhancement Studio */}
          <div className="lg:col-span-7 bg-white dark:bg-[#1A1C20] rounded-2xl border border-[#E6E6E6] dark:border-[#2A2D34] p-5 space-y-4">
            {activePage ? (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-[#202124] dark:text-[#F3F4F6]">
                    {activePage.name}
                  </h2>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updatePageEnhancements(activePage.id, {
                          rotation: (activePage.rotation + 90) % 360,
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] text-xs font-medium text-[#202124] dark:text-[#F3F4F6] cursor-pointer"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Rotate</span>
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const edges = await detectDocumentEdges(activePage.originalDataUrl);
                        await updatePageEnhancements(activePage.id, { crop: edges });
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] text-xs font-medium text-[#202124] dark:text-[#F3F4F6] cursor-pointer"
                    >
                      <Wand2 className="w-3.5 h-3.5 text-[#E50920]" />
                      <span>Auto-Crop</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPages((prev) => prev.filter((p) => p.id !== activePage.id));
                        setStep('capture');
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] text-xs font-medium text-[#202124] dark:text-[#F3F4F6] cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Retake</span>
                    </button>
                  </div>
                </div>

                <div className="aspect-[3/4] max-h-[440px] mx-auto bg-[#F5F5F7] dark:bg-[#111215] rounded-xl overflow-hidden flex items-center justify-center p-3">
                  <img
                    src={activePage.processedDataUrl}
                    alt={activePage.name}
                    className="max-h-full max-w-full object-contain rounded shadow-sm"
                  />
                </div>

                {/* Filters */}
                <div className="space-y-3 pt-2 border-t border-[#E6E6E6] dark:border-[#2A2D34]">
                  <div className="flex items-center gap-2 flex-wrap">
                    {FILTER_MODES.map((fm) => (
                      <button
                        key={fm.id}
                        type="button"
                        onClick={() => updatePageEnhancements(activePage.id, { filter: fm.id })}
                        className={`px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                          activePage.filter === fm.id
                            ? 'bg-[#E50920] text-white'
                            : 'bg-[#F5F5F7] dark:bg-[#24272E] text-[#202124] dark:text-[#F3F4F6]'
                        }`}
                      >
                        {fm.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="space-y-1.5 text-xs">
                      <span className="flex items-center justify-between text-[#777777] dark:text-[#9CA3AF]">
                        <span className="inline-flex items-center gap-1">
                          <Sun className="w-3.5 h-3.5" /> Brightness
                        </span>
                        <span className="tabular-nums">{activePage.brightness}</span>
                      </span>
                      <input
                        type="range"
                        min={-40}
                        max={40}
                        value={activePage.brightness}
                        onChange={(e) =>
                          updatePageEnhancements(activePage.id, {
                            brightness: Number(e.target.value),
                          })
                        }
                        className="w-full accent-[#E50920]"
                      />
                    </label>

                    <label className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] cursor-pointer">
                      <span className="text-xs font-medium text-[#202124] dark:text-[#F3F4F6]">
                        Remove Shadows
                      </span>
                      <input
                        type="checkbox"
                        checked={activePage.removeShadows}
                        onChange={(e) =>
                          updatePageEnhancements(activePage.id, {
                            removeShadows: e.target.checked,
                          })
                        }
                        className="w-4 h-4 accent-[#E50920]"
                      />
                    </label>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-[#777777] py-12 text-center">No pages captured yet.</p>
            )}
          </div>

          {/* Pages List (Reorder / Delete) */}
          <div className="lg:col-span-5 bg-white dark:bg-[#1A1C20] rounded-2xl border border-[#E6E6E6] dark:border-[#2A2D34] p-4 space-y-3">
            <h2 className="text-sm font-bold text-[#202124] dark:text-[#F3F4F6]">
              All Scanned Pages ({pages.length})
            </h2>
            <div className="space-y-2 max-h-[480px] overflow-y-auto">
              {pages.map((p, idx) => (
                <div
                  key={p.id}
                  onClick={() => setActiveEditId(p.id)}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border transition-colors cursor-pointer ${
                    activePage?.id === p.id
                      ? 'border-[#E50920] bg-[#E50920]/6'
                      : 'border-[#E6E6E6] dark:border-[#2A2D34] hover:bg-[#F5F5F7] dark:hover:bg-[#24272E]'
                  }`}
                >
                  <img
                    src={p.processedDataUrl}
                    alt={p.name}
                    className="w-12 h-16 rounded-lg object-cover bg-[#F5F5F7] shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#202124] dark:text-[#F3F4F6] truncate">
                      Page {idx + 1}
                    </p>
                    <p className="text-xs text-[#777777] dark:text-[#9CA3AF] capitalize">
                      {p.filter} · {p.rotation}°
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        movePage(idx, -1);
                      }}
                      disabled={idx === 0}
                      className="min-w-[34px] min-h-[34px] rounded-lg bg-[#F5F5F7] dark:bg-[#24272E] text-xs font-bold disabled:opacity-30 cursor-pointer"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        movePage(idx, 1);
                      }}
                      disabled={idx === pages.length - 1}
                      className="min-w-[34px] min-h-[34px] rounded-lg bg-[#F5F5F7] dark:bg-[#24272E] text-xs font-bold disabled:opacity-30 cursor-pointer"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPages((prev) => prev.filter((item) => item.id !== p.id));
                      }}
                      className="min-w-[34px] min-h-[34px] rounded-lg text-[#E50920] hover:bg-[#E50920]/10 flex items-center justify-center cursor-pointer"
                      aria-label="Delete page"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sticky Continue Bar */}
      {pages.length > 0 && (
        <div className="fixed bottom-16 lg:bottom-0 left-0 lg:left-64 right-0 z-30 bg-white/95 dark:bg-[#1A1C20]/95 backdrop-blur-md border-t border-[#E6E6E6] dark:border-[#2A2D34] px-4 sm:px-6 py-3">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
            <span className="text-sm font-semibold text-[#202124] dark:text-[#F3F4F6] tabular-nums">
              {pages.length} {pages.length === 1 ? 'scanned page' : 'scanned pages'} ready
            </span>
            <button
              type="button"
              onClick={() => {
                stopCamera();
                onContinue(pages);
              }}
              className="inline-flex items-center gap-2 px-6 py-2.5 min-h-[46px] rounded-xl bg-[#E50920] hover:bg-[#B81024] text-white text-sm font-semibold cursor-pointer whitespace-nowrap"
            >
              <span>Continue to PDF Settings</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
