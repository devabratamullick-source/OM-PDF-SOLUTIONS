import React, { useRef, useState } from 'react';
import {
  ArrowLeft,
  Plus,
  RotateCw,
  Crop,
  Trash2,
  CheckSquare,
  Square,
  GripVertical,
  ArrowRight,
  ImagePlus,
  X,
  Check,
} from 'lucide-react';
import { CropRect, ImageItem } from '../types/pdf';
import {
  createImageItemFromFile,
  processImageDataUrl,
} from '../services/imageProcessor';
import { formatBytes } from '../storage/db';

interface ImageImportFlowProps {
  initialImages?: ImageItem[];
  onBack: () => void;
  onContinue: (selectedImages: ImageItem[]) => void;
}

export const ImageImportFlow: React.FC<ImageImportFlowProps> = ({
  initialImages = [],
  onBack,
  onContinue,
}) => {
  const [images, setImages] = useState<ImageItem[]>(initialImages);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [croppingItem, setCroppingItem] = useState<ImageItem | null>(null);
  const [cropDraft, setCropDraft] = useState<CropRect>({ x: 0.05, y: 0.05, w: 0.9, h: 0.9 });
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedImages = images.filter((img) => img.selected);
  const allSelected = images.length > 0 && selectedImages.length === images.length;

  const handleFilesAdded = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setBusy(true);
    try {
      const validFiles = Array.from(fileList).filter((f) =>
        /^image\/(jpeg|jpg|png|webp)$/i.test(f.type) ||
        /\.(jpe?g|png|webp)$/i.test(f.name)
      );
      const newItems: ImageItem[] = [];
      for (const file of validFiles) {
        newItems.push(await createImageItemFromFile(file));
      }
      setImages((prev) => [...prev, ...newItems]);
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRotate = async (id: string) => {
    const target = images.find((i) => i.id === id);
    if (!target) return;
    const nextRot = (target.rotation + 90) % 360;
    const res = await processImageDataUrl(target.originalDataUrl, {
      rotation: nextRot,
      crop: target.crop,
      filter: target.filter,
      brightness: target.brightness,
      contrast: target.contrast,
      removeShadows: target.removeShadows,
    });
    setImages((prev) =>
      prev.map((img) =>
        img.id === id
          ? { ...img, rotation: nextRot, processedDataUrl: res.dataUrl, width: res.width, height: res.height }
          : img
      )
    );
  };

  const openCropModal = (item: ImageItem) => {
    setCroppingItem(item);
    setCropDraft(item.crop ?? { x: 0.05, y: 0.05, w: 0.9, h: 0.9 });
  };

  const applyCrop = async () => {
    if (!croppingItem) return;
    const res = await processImageDataUrl(croppingItem.originalDataUrl, {
      rotation: croppingItem.rotation,
      crop: cropDraft,
      filter: croppingItem.filter,
      brightness: croppingItem.brightness,
      contrast: croppingItem.contrast,
      removeShadows: croppingItem.removeShadows,
    });
    setImages((prev) =>
      prev.map((img) =>
        img.id === croppingItem.id
          ? { ...img, crop: cropDraft, processedDataUrl: res.dataUrl, width: res.width, height: res.height }
          : img
      )
    );
    setCroppingItem(null);
  };

  const handleDelete = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  const toggleSelect = (id: string) => {
    setImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, selected: !img.selected } : img))
    );
  };

  const toggleSelectAll = () => {
    const nextVal = !allSelected;
    setImages((prev) => prev.map((img) => ({ ...img, selected: nextVal })));
  };

  const handleDrop = (targetIdx: number) => {
    if (dragIndex === null || dragIndex === targetIdx) {
      setDragIndex(null);
      return;
    }
    setImages((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(dragIndex, 1);
      updated.splice(targetIdx, 0, moved);
      return updated;
    });
    setDragIndex(null);
  };

  const moveItem = (idx: number, dir: -1 | 1) => {
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= images.length) return;
    setImages((prev) => {
      const arr = [...prev];
      [arr[idx], arr[nextIdx]] = [arr[nextIdx], arr[idx]];
      return arr;
    });
  };

  return (
    <div className="space-y-6 pb-24">
      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
        multiple
        onChange={(e) => handleFilesAdded(e.target.files)}
        className="hidden"
      />

      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="min-w-[44px] min-h-[44px] rounded-xl bg-white dark:bg-[#1A1C20] border border-[#E6E6E6] dark:border-[#2A2D34] flex items-center justify-center text-[#202124] dark:text-[#F3F4F6] hover:bg-[#F5F5F7] dark:hover:bg-[#24272E] cursor-pointer"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-[#202124] dark:text-[#F3F4F6]">
              Import Images from Gallery
            </h1>
            <p className="text-xs text-[#777777] dark:text-[#9CA3AF] tabular-nums">
              {selectedImages.length} {selectedImages.length === 1 ? 'image' : 'images'} selected · JPG, JPEG, PNG, WEBP
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {images.length > 0 && (
            <button
              type="button"
              onClick={toggleSelectAll}
              className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[44px] rounded-xl bg-white dark:bg-[#1A1C20] border border-[#E6E6E6] dark:border-[#2A2D34] text-xs sm:text-sm font-medium text-[#202124] dark:text-[#F3F4F6] hover:bg-[#F5F5F7] dark:hover:bg-[#24272E] whitespace-nowrap cursor-pointer"
            >
              {allSelected ? (
                <CheckSquare className="w-4 h-4 text-[#E50920]" />
              ) : (
                <Square className="w-4 h-4 text-[#777777]" />
              )}
              <span>{allSelected ? 'Deselect All' : 'Select All'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-xl bg-[#202124] dark:bg-[#F3F4F6] text-white dark:text-[#111215] text-xs sm:text-sm font-medium whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Images</span>
          </button>
        </div>
      </div>

      {/* Dropzone / Empty Picker */}
      {images.length === 0 ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFilesAdded(e.dataTransfer.files);
          }}
          className="bg-white dark:bg-[#1A1C20] rounded-2xl border-2 border-dashed border-[#E6E6E6] dark:border-[#343842] hover:border-[#E50920]/60 transition-colors p-10 sm:p-14 text-center flex flex-col items-center justify-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-[#E50920]/10 text-[#E50920] flex items-center justify-center mb-4">
            <ImagePlus className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-[#202124] dark:text-[#F3F4F6] mb-1.5">
            Select images from your gallery
          </h2>
          <p className="text-sm text-[#777777] dark:text-[#9CA3AF] max-w-md mb-6">
            Choose multiple JPG, JPEG, PNG, or WEBP photos. Drag and drop them here or tap below to browse your device.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-6 py-3 min-h-[48px] rounded-xl bg-[#E50920] hover:bg-[#B81024] text-white text-sm font-semibold transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{busy ? 'Loading images...' : 'Choose Photos'}</span>
          </button>
        </div>
      ) : (
        <>
          <p className="text-xs text-[#777777] dark:text-[#9CA3AF]">
            Drag cards to rearrange page order, or use rotate and crop tools on each photo.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {images.map((img, idx) => (
              <div
                key={img.id}
                draggable
                onDragStart={() => setDragIndex(idx)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(idx)}
                className={`group bg-white dark:bg-[#1A1C20] rounded-2xl border overflow-hidden transition-all ${
                  img.selected
                    ? 'border-[#E50920] ring-2 ring-[#E50920]/15'
                    : 'border-[#E6E6E6] dark:border-[#2A2D34] opacity-70'
                }`}
              >
                <div className="relative aspect-[3/4] bg-[#F5F5F7] dark:bg-[#24272E] overflow-hidden">
                  <img
                    src={img.processedDataUrl}
                    alt={img.name}
                    className="w-full h-full object-contain p-2"
                  />

                  {/* Top overlay controls */}
                  <div className="absolute top-2 left-2 right-2 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => toggleSelect(img.id)}
                      className="min-w-[36px] min-h-[36px] rounded-lg bg-white/95 dark:bg-[#1A1C20]/95 shadow-xs flex items-center justify-center text-[#202124] dark:text-[#F3F4F6] cursor-pointer"
                      aria-label={img.selected ? 'Deselect image' : 'Select image'}
                    >
                      {img.selected ? (
                        <CheckSquare className="w-4 h-4 text-[#E50920]" />
                      ) : (
                        <Square className="w-4 h-4 text-[#777777]" />
                      )}
                    </button>

                    <span className="px-2 py-0.5 rounded-md bg-[#202124]/80 text-white text-xs font-mono tabular-nums">
                      #{idx + 1}
                    </span>
                  </div>

                  {/* Drag grip */}
                  <div className="absolute bottom-2 left-2 flex items-center gap-1">
                    <span
                      className="p-1.5 rounded-lg bg-white/90 dark:bg-[#1A1C20]/90 text-[#777777] cursor-grab active:cursor-grabbing"
                      title="Drag to reorder"
                    >
                      <GripVertical className="w-4 h-4" />
                    </span>
                    <button
                      type="button"
                      onClick={() => moveItem(idx, -1)}
                      disabled={idx === 0}
                      className="px-2 py-1 rounded-lg bg-white/90 dark:bg-[#1A1C20]/90 text-xs font-medium text-[#202124] dark:text-[#F3F4F6] disabled:opacity-35 cursor-pointer"
                      title="Move earlier"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      onClick={() => moveItem(idx, 1)}
                      disabled={idx === images.length - 1}
                      className="px-2 py-1 rounded-lg bg-white/90 dark:bg-[#1A1C20]/90 text-xs font-medium text-[#202124] dark:text-[#F3F4F6] disabled:opacity-35 cursor-pointer"
                      title="Move later"
                    >
                      →
                    </button>
                  </div>
                </div>

                <div className="p-3 space-y-2.5">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#202124] dark:text-[#F3F4F6] truncate">
                      {img.name}
                    </p>
                    <p className="text-[11px] text-[#777777] dark:text-[#9CA3AF] tabular-nums">
                      {img.width}×{img.height} · {formatBytes(img.size)}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-1 pt-1 border-t border-[#E6E6E6] dark:border-[#2A2D34]">
                    <button
                      type="button"
                      onClick={() => handleRotate(img.id)}
                      className="flex-1 min-h-[38px] rounded-lg flex items-center justify-center gap-1 text-xs font-medium text-[#202124] dark:text-[#F3F4F6] hover:bg-[#F5F5F7] dark:hover:bg-[#24272E] cursor-pointer"
                      title="Rotate 90°"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Rotate</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openCropModal(img)}
                      className="flex-1 min-h-[38px] rounded-lg flex items-center justify-center gap-1 text-xs font-medium text-[#202124] dark:text-[#F3F4F6] hover:bg-[#F5F5F7] dark:hover:bg-[#24272E] cursor-pointer"
                      title="Crop"
                    >
                      <Crop className="w-3.5 h-3.5" />
                      <span>Crop</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(img.id)}
                      className="min-w-[38px] min-h-[38px] rounded-lg flex items-center justify-center text-[#E50920] hover:bg-[#E50920]/10 cursor-pointer"
                      aria-label="Remove image"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Sticky Continue Bar */}
      {images.length > 0 && (
        <div className="fixed bottom-16 lg:bottom-0 left-0 lg:left-64 right-0 z-30 bg-white/95 dark:bg-[#1A1C20]/95 backdrop-blur-md border-t border-[#E6E6E6] dark:border-[#2A2D34] px-4 sm:px-6 py-3">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
            <span className="text-sm font-semibold text-[#202124] dark:text-[#F3F4F6] tabular-nums">
              {selectedImages.length} {selectedImages.length === 1 ? 'image' : 'images'} selected
            </span>
            <button
              type="button"
              disabled={selectedImages.length === 0}
              onClick={() => onContinue(selectedImages)}
              className="inline-flex items-center gap-2 px-6 py-2.5 min-h-[46px] rounded-xl bg-[#E50920] hover:bg-[#B81024] disabled:opacity-45 text-white text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>Continue</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Crop Modal */}
      {croppingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white dark:bg-[#1A1C20] rounded-2xl border border-[#E6E6E6] dark:border-[#2A2D34] overflow-hidden shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E6E6E6] dark:border-[#2A2D34]">
              <h3 className="text-base font-bold text-[#202124] dark:text-[#F3F4F6]">
                Crop Image
              </h3>
              <button
                type="button"
                onClick={() => setCroppingItem(null)}
                className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-[#777777] hover:bg-[#F5F5F7] dark:hover:bg-[#24272E] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="relative bg-[#111215] rounded-xl overflow-hidden flex items-center justify-center max-h-72">
                <div className="relative inline-block">
                  <img
                    src={croppingItem.originalDataUrl}
                    alt="Crop preview"
                    className="max-h-72 w-auto object-contain block"
                  />
                  <div
                    className="absolute border-2 border-[#E50920] bg-[#E50920]/10 pointer-events-none"
                    style={{
                      left: `${cropDraft.x * 100}%`,
                      top: `${cropDraft.y * 100}%`,
                      width: `${cropDraft.w * 100}%`,
                      height: `${cropDraft.h * 100}%`,
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <label className="space-y-1">
                  <span className="text-[#777777] dark:text-[#9CA3AF] flex justify-between">
                    <span>Left margin</span>
                    <span className="tabular-nums">{Math.round(cropDraft.x * 100)}%</span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={40}
                    value={Math.round(cropDraft.x * 100)}
                    onChange={(e) => {
                      const nx = Number(e.target.value) / 100;
                      setCropDraft((c) => ({ ...c, x: nx, w: Math.max(0.2, Math.min(c.w, 1 - nx)) }));
                    }}
                    className="w-full accent-[#E50920]"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[#777777] dark:text-[#9CA3AF] flex justify-between">
                    <span>Top margin</span>
                    <span className="tabular-nums">{Math.round(cropDraft.y * 100)}%</span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={40}
                    value={Math.round(cropDraft.y * 100)}
                    onChange={(e) => {
                      const ny = Number(e.target.value) / 100;
                      setCropDraft((c) => ({ ...c, y: ny, h: Math.max(0.2, Math.min(c.h, 1 - ny)) }));
                    }}
                    className="w-full accent-[#E50920]"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[#777777] dark:text-[#9CA3AF] flex justify-between">
                    <span>Width</span>
                    <span className="tabular-nums">{Math.round(cropDraft.w * 100)}%</span>
                  </span>
                  <input
                    type="range"
                    min={20}
                    max={100 - Math.round(cropDraft.x * 100)}
                    value={Math.round(cropDraft.w * 100)}
                    onChange={(e) => setCropDraft((c) => ({ ...c, w: Number(e.target.value) / 100 }))}
                    className="w-full accent-[#E50920]"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[#777777] dark:text-[#9CA3AF] flex justify-between">
                    <span>Height</span>
                    <span className="tabular-nums">{Math.round(cropDraft.h * 100)}%</span>
                  </span>
                  <input
                    type="range"
                    min={20}
                    max={100 - Math.round(cropDraft.y * 100)}
                    value={Math.round(cropDraft.h * 100)}
                    onChange={(e) => setCropDraft((c) => ({ ...c, h: Number(e.target.value) / 100 }))}
                    className="w-full accent-[#E50920]"
                  />
                </label>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setCropDraft({ x: 0, y: 0, w: 1, h: 1 })}
                  className="text-xs font-medium text-[#777777] hover:text-[#202124] dark:hover:text-[#F3F4F6] cursor-pointer"
                >
                  Reset Full Frame
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCroppingItem(null)}
                    className="px-4 py-2 min-h-[42px] rounded-xl text-sm font-medium text-[#777777] hover:bg-[#F5F5F7] dark:hover:bg-[#24272E] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={applyCrop}
                    className="inline-flex items-center gap-1.5 px-5 py-2 min-h-[42px] rounded-xl bg-[#E50920] hover:bg-[#B81024] text-white text-sm font-semibold cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Apply Crop</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
