import { LanguageCode, ToolId } from '../types/pdf';

export interface ToolDescriptor {
  id: ToolId;
  title: string;
  description: string;
  color: string;
  bgTint: string;
  category: 'create' | 'convert' | 'organize' | 'optimize';
  featuredOnHome: boolean;
}

export const ALL_TOOLS: ToolDescriptor[] = [
  {
    id: 'images-to-pdf',
    title: 'Images to PDF',
    description: 'Turn JPG, PNG & WEBP photos into a PDF',
    color: '#E50920',
    bgTint: 'rgba(229, 9, 32, 0.10)',
    category: 'create',
    featuredOnHome: true,
  },
  {
    id: 'camera-to-pdf',
    title: 'Camera to PDF',
    description: 'Capture pages directly with your camera',
    color: '#2563EB',
    bgTint: 'rgba(37, 99, 235, 0.10)',
    category: 'create',
    featuredOnHome: true,
  },
  {
    id: 'documents-to-pdf',
    title: 'Documents to PDF',
    description: 'Import Word, Excel, PPT & TXT files',
    color: '#0D9488',
    bgTint: 'rgba(13, 148, 136, 0.10)',
    category: 'create',
    featuredOnHome: true,
  },
  {
    id: 'scan-document',
    title: 'Scan Document',
    description: 'Auto edge-detect, crop & remove shadows',
    color: '#7C3AED',
    bgTint: 'rgba(124, 58, 237, 0.10)',
    category: 'create',
    featuredOnHome: true,
  },
  {
    id: 'merge-pdf',
    title: 'Merge PDF',
    description: 'Combine multiple PDFs into one file',
    color: '#EA580C',
    bgTint: 'rgba(234, 88, 12, 0.10)',
    category: 'organize',
    featuredOnHome: true,
  },
  {
    id: 'split-pdf',
    title: 'Split PDF',
    description: 'Split by pages, ranges, or fixed groups',
    color: '#DB2777',
    bgTint: 'rgba(219, 39, 119, 0.10)',
    category: 'organize',
    featuredOnHome: true,
  },
  {
    id: 'compress-pdf',
    title: 'Compress PDF',
    description: 'Reduce file size with quality control',
    color: '#25A55B',
    bgTint: 'rgba(37, 165, 91, 0.10)',
    category: 'optimize',
    featuredOnHome: true,
  },
  {
    id: 'pdf-to-images',
    title: 'PDF to Images',
    description: 'Export PDF pages as PNG or JPG',
    color: '#D97706',
    bgTint: 'rgba(217, 119, 6, 0.10)',
    category: 'convert',
    featuredOnHome: true,
  },
  {
    id: 'pdf-to-word',
    title: 'PDF to Word',
    description: 'Extract PDF content into a .docx file',
    color: '#1D4ED8',
    bgTint: 'rgba(29, 78, 216, 0.10)',
    category: 'convert',
    featuredOnHome: true,
  },
  {
    id: 'word-to-pdf',
    title: 'Word to PDF',
    description: 'Convert DOC & DOCX documents to PDF',
    color: '#2B579A',
    bgTint: 'rgba(43, 87, 154, 0.10)',
    category: 'convert',
    featuredOnHome: true,
  },
  {
    id: 'excel-to-pdf',
    title: 'Excel to PDF',
    description: 'Convert XLS & XLSX sheets into PDF tables',
    color: '#1E7145',
    bgTint: 'rgba(30, 113, 69, 0.10)',
    category: 'convert',
    featuredOnHome: true,
  },
  {
    id: 'ppt-to-pdf',
    title: 'PPT to PDF',
    description: 'Convert PowerPoint slides into PDF',
    color: '#C2410C',
    bgTint: 'rgba(194, 65, 12, 0.10)',
    category: 'convert',
    featuredOnHome: true,
  },
  {
    id: 'rotate-pdf',
    title: 'Rotate PDF',
    description: 'Rotate individual or all pages 90°, 180°, 270°',
    color: '#0284C7',
    bgTint: 'rgba(2, 132, 199, 0.10)',
    category: 'organize',
    featuredOnHome: false,
  },
  {
    id: 'extract-pages',
    title: 'Extract Pages',
    description: 'Pick specific pages to save as a new PDF',
    color: '#9333EA',
    bgTint: 'rgba(147, 51, 234, 0.10)',
    category: 'organize',
    featuredOnHome: false,
  },
  {
    id: 'reorder-pages',
    title: 'Reorder Pages',
    description: 'Drag and drop PDF pages into a new order',
    color: '#4F46E5',
    bgTint: 'rgba(79, 70, 229, 0.10)',
    category: 'organize',
    featuredOnHome: false,
  },
  {
    id: 'watermark-pdf',
    title: 'Watermark PDF',
    description: 'Stamp custom text or logo across pages',
    color: '#B81024',
    bgTint: 'rgba(184, 16, 36, 0.10)',
    category: 'optimize',
    featuredOnHome: false,
  },
];

export const HOME_QUICK_ACTIONS = ALL_TOOLS.filter((t) => t.featuredOnHome);

export const UI_STRINGS: Record<
  LanguageCode,
  {
    home: string;
    tools: string;
    myFiles: string;
    history: string;
    settings: string;
    quickActions: string;
    recentFiles: string;
    seeAll: string;
    createPdf: string;
    searchPlaceholder: string;
  }
> = {
  en: {
    home: 'Home',
    tools: 'Tools',
    myFiles: 'My Files',
    history: 'History',
    settings: 'Settings',
    quickActions: 'Quick Actions',
    recentFiles: 'Recent Files',
    seeAll: 'See All',
    createPdf: 'Create PDF',
    searchPlaceholder: 'Search PDFs, types, dates, or folders...',
  },
  es: {
    home: 'Inicio',
    tools: 'Herramientas',
    myFiles: 'Mis Archivos',
    history: 'Historial',
    settings: 'Ajustes',
    quickActions: 'Acciones Rápidas',
    recentFiles: 'Archivos Recientes',
    seeAll: 'Ver Todo',
    createPdf: 'Crear PDF',
    searchPlaceholder: 'Buscar PDF, tipos, fechas o carpetas...',
  },
  fr: {
    home: 'Accueil',
    tools: 'Outils',
    myFiles: 'Mes Fichiers',
    history: 'Historique',
    settings: 'Paramètres',
    quickActions: 'Actions Rapides',
    recentFiles: 'Fichiers Récents',
    seeAll: 'Tout Voir',
    createPdf: 'Créer un PDF',
    searchPlaceholder: 'Rechercher des PDF, types, dates...',
  },
  de: {
    home: 'Start',
    tools: 'Werkzeuge',
    myFiles: 'Meine Dateien',
    history: 'Verlauf',
    settings: 'Einstellungen',
    quickActions: 'Schnellaktionen',
    recentFiles: 'Zuletzt verwendet',
    seeAll: 'Alle anzeigen',
    createPdf: 'PDF erstellen',
    searchPlaceholder: 'PDFs, Typen, Daten oder Ordner suchen...',
  },
  hi: {
    home: 'होम',
    tools: 'टूल्स',
    myFiles: 'मेरी फ़ाइलें',
    history: 'इतिहास',
    settings: 'सेटिंग्स',
    quickActions: 'त्वरित कार्य',
    recentFiles: 'हाल की फ़ाइलें',
    seeAll: 'सभी देखें',
    createPdf: 'PDF बनाएं',
    searchPlaceholder: 'PDF, प्रकार, दिनांक या फ़ोल्डर खोजें...',
  },
};
