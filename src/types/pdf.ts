export type TabId = 'home' | 'tools' | 'files' | 'history' | 'settings';

export type ToolId =
  | 'images-to-pdf'
  | 'camera-to-pdf'
  | 'documents-to-pdf'
  | 'scan-document'
  | 'merge-pdf'
  | 'split-pdf'
  | 'compress-pdf'
  | 'pdf-to-images'
  | 'pdf-to-word'
  | 'word-to-pdf'
  | 'excel-to-pdf'
  | 'ppt-to-pdf'
  | 'rotate-pdf'
  | 'extract-pages'
  | 'reorder-pages'
  | 'watermark-pdf';

export type FileStatus = 'completed' | 'processing' | 'failed';

export type FileCategory =
  | 'pdf'
  | 'image'
  | 'document'
  | 'word'
  | 'excel'
  | 'powerpoint';

export interface PdfFileRecord {
  id: string;
  name: string;
  extension: string;
  category: FileCategory;
  mimeType: string;
  size: number;
  pageCount: number;
  status: FileStatus;
  folderId: string;
  createdAt: number;
  updatedAt: number;
  lastOpenedAt?: number;
  thumbnailDataUrl?: string;
  data: ArrayBuffer;
  bookmarks?: number[];
  password?: string;
  sourceTool?: ToolId;
  metadata?: {
    author?: string;
    subject?: string;
    keywords?: string;
  };
}

export interface FolderRecord {
  id: string;
  name: string;
  system: boolean;
  createdAt: number;
  color: string;
}

export interface TaskRecord {
  id: string;
  taskName: string;
  toolId: ToolId;
  inputFiles: string[];
  outputFilename: string;
  outputFileId?: string;
  startTime: number;
  completionTime?: number;
  progress: number;
  status: FileStatus;
  errorMessage?: string;
}

export type CameraFilterMode = 'document' | 'color' | 'grayscale' | 'bw';

export interface CropRect {
  x: number; // 0..1 normalized
  y: number; // 0..1 normalized
  w: number; // 0..1 normalized
  h: number; // 0..1 normalized
}

export interface ImageItem {
  id: string;
  name: string;
  originalDataUrl: string;
  processedDataUrl: string;
  mimeType: string;
  size: number;
  width: number;
  height: number;
  rotation: number; // 0, 90, 180, 270
  crop?: CropRect;
  filter: CameraFilterMode;
  brightness: number; // -50 to 50
  contrast: number; // -50 to 50
  removeShadows: boolean;
  selected: boolean;
}

export interface DocumentImportItem {
  id: string;
  name: string;
  extension: string;
  category: FileCategory;
  mimeType: string;
  size: number;
  file: File;
  previewText?: string;
  previewDataUrl?: string;
  selected: boolean;
  addedAt: number;
}

export type PageSizeOption = 'A4' | 'A3' | 'A5' | 'Letter' | 'Legal' | 'Custom';
export type OrientationOption = 'portrait' | 'landscape' | 'auto';
export type MarginOption = 'none' | 'small' | 'medium' | 'large' | 'custom';
export type ImageFitOption = 'fit' | 'fill' | 'original';
export type ImageQualityOption = 'low' | 'medium' | 'high' | 'ultra';
export type PageLayoutOption = '1' | '2' | '4' | 'custom';

export interface PdfCreationSettings {
  fileName: string;
  pageSize: PageSizeOption;
  customWidthMm: number;
  customHeightMm: number;
  orientation: OrientationOption;
  margins: MarginOption;
  customMarginMm: number;
  imageFit: ImageFitOption;
  imageQuality: ImageQualityOption;
  pageLayout: PageLayoutOption;
  customCols: number;
  customRows: number;
  backgroundColor: string;
  showPageNumbers: boolean;
  headerText: string;
  footerText: string;
  includeDateTime: boolean;
  watermarkText: string;
  watermarkOpacity: number;
  password: string;
  author: string;
  subject: string;
  keywords: string;
  folderId: string;
}

export type DateFilterOption =
  | 'all'
  | 'today'
  | 'yesterday'
  | 'last7'
  | 'last30'
  | 'thisMonth'
  | 'custom';

export type SortOption =
  | 'newest'
  | 'oldest'
  | 'name-asc'
  | 'name-desc'
  | 'largest'
  | 'smallest';

export interface FilterState {
  search: string;
  fileType: 'all' | FileCategory;
  status: 'all' | FileStatus;
  dateFilter: DateFilterOption;
  customDateStart: string;
  customDateEnd: string;
  sortBy: SortOption;
  folderId: string | 'all';
}

export type LanguageCode = 'en' | 'es' | 'fr' | 'de' | 'hi';

export interface AppSettings {
  darkMode: boolean;
  language: LanguageCode;
  defaultPageSize: PageSizeOption;
  defaultOrientation: OrientationOption;
  defaultQuality: ImageQualityOption;
  defaultFolderId: string;
  autoSave: boolean;
  fileNamingPrefix: string;
  appendDateToName: boolean;
  appLockEnabled: boolean;
  appLockPin: string;
  hideThumbnailsInRecents: boolean;
  stripMetadataOnExport: boolean;
  onboardingSeen: boolean;
}

export const DEFAULT_FOLDERS: FolderRecord[] = [
  { id: 'created', name: 'Created PDFs', system: true, createdAt: 1, color: '#E50920' },
  { id: 'scanned', name: 'Scanned Documents', system: true, createdAt: 2, color: '#2563EB' },
  { id: 'converted', name: 'Converted Files', system: true, createdAt: 3, color: '#0D9488' },
  { id: 'merged', name: 'Merged PDFs', system: true, createdAt: 4, color: '#7C3AED' },
  { id: 'compressed', name: 'Compressed PDFs', system: true, createdAt: 5, color: '#D97706' },
  { id: 'shared', name: 'Shared Files', system: true, createdAt: 6, color: '#25A55B' },
];

export const DEFAULT_APP_SETTINGS: AppSettings = {
  darkMode: false,
  language: 'en',
  defaultPageSize: 'A4',
  defaultOrientation: 'portrait',
  defaultQuality: 'high',
  defaultFolderId: 'created',
  autoSave: true,
  fileNamingPrefix: 'My Document',
  appendDateToName: false,
  appLockEnabled: false,
  appLockPin: '',
  hideThumbnailsInRecents: false,
  stripMetadataOnExport: false,
  onboardingSeen: false,
};

export function createDefaultPdfSettings(appSettings: AppSettings): PdfCreationSettings {
  const dateSuffix = appSettings.appendDateToName
    ? ` ${new Date().toISOString().slice(0, 10)}`
    : '';
  return {
    fileName: `${appSettings.fileNamingPrefix || 'My Document'}${dateSuffix}`,
    pageSize: appSettings.defaultPageSize,
    customWidthMm: 210,
    customHeightMm: 297,
    orientation: appSettings.defaultOrientation,
    margins: 'small',
    customMarginMm: 12,
    imageFit: 'fit',
    imageQuality: appSettings.defaultQuality,
    pageLayout: '1',
    customCols: 2,
    customRows: 2,
    backgroundColor: '#FFFFFF',
    showPageNumbers: false,
    headerText: '',
    footerText: '',
    includeDateTime: false,
    watermarkText: '',
    watermarkOpacity: 0.2,
    password: '',
    author: '',
    subject: '',
    keywords: '',
    folderId: appSettings.defaultFolderId || 'created',
  };
}
