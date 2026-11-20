import React, { useState } from 'react';
import {
  Moon,
  Globe,
  FileText,
  Folder,
  Lock,
  Shield,
  Trash2,
  HardDrive,
  Star,
  Share2,
  HelpCircle,
  Info,
  ChevronRight,
  X,
  Check,
  Smartphone,
} from 'lucide-react';
import { ADMOB_TEST_IDS, admobService } from '../services/admobService';
import {
  AppSettings,
  FolderRecord,
  ImageQualityOption,
  LanguageCode,
  OrientationOption,
  PageSizeOption,
} from '../types/pdf';
import { formatBytes } from '../storage/db';

interface SettingsScreenProps {
  settings: AppSettings;
  folders: FolderRecord[];
  storageTotalBytes: number;
  fileCount: number;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onClearCache: () => void;
  onOpenStorageFolders: () => void;
  onNotify: (msg: string) => void;
  bannerEnabled: boolean;
  onToggleBanner: (enabled: boolean) => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  settings,
  folders,
  storageTotalBytes,
  fileCount,
  onUpdateSettings,
  onClearCache,
  onOpenStorageFolders,
  onNotify,
  bannerEnabled,
  onToggleBanner,
}) => {
  const [modal, setModal] = useState<'none' | 'pin' | 'rate' | 'help' | 'about'>('none');
  const [pinDraft, setPinDraft] = useState(settings.appLockPin || '');
  const [rating, setRating] = useState(5);

  const handleShareApp = async () => {
    const shareText = 'PDF Maker — Create, scan, merge, split, and convert PDFs completely offline.';
    if (navigator.share) {
      try {
        await navigator.share({ title: 'PDF Maker', text: shareText, url: window.location.href });
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(`${shareText} ${window.location.href}`);
      onNotify('App link copied to clipboard');
    } catch {
      onNotify('Share link ready');
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-4xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-[#202124] dark:text-[#F3F4F6]">
          Settings
        </h1>
        <p className="text-xs text-[#777777] dark:text-[#9CA3AF] mt-0.5">
          Customize appearance, default PDF output, privacy, and local storage
        </p>
      </div>

      {/* Appearance & Language */}
      <section className="bg-white dark:bg-[#1A1C20] rounded-2xl border border-[#E6E6E6] dark:border-[#2A2D34] divide-y divide-[#E6E6E6] dark:divide-[#2A2D34] overflow-hidden">
        <div className="px-5 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] flex items-center justify-center text-[#E50920]">
              <Moon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#202124] dark:text-[#F3F4F6]">Dark Mode</p>
              <p className="text-xs text-[#777777] dark:text-[#9CA3AF]">
                Switch between light and dark interface themes
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.darkMode}
            onClick={() => onUpdateSettings({ darkMode: !settings.darkMode })}
            className={`w-12 h-7 rounded-full transition-colors p-0.5 cursor-pointer shrink-0 ${
              settings.darkMode ? 'bg-[#E50920]' : 'bg-[#D1D5DB] dark:bg-[#3A3F4B]'
            }`}
          >
            <span
              className={`block w-6 h-6 rounded-full bg-white shadow transition-transform ${
                settings.darkMode ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="px-5 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] flex items-center justify-center text-blue-600">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#202124] dark:text-[#F3F4F6]">Language</p>
              <p className="text-xs text-[#777777] dark:text-[#9CA3AF]">Interface display language</p>
            </div>
          </div>
          <select
            value={settings.language}
            onChange={(e) => onUpdateSettings({ language: e.target.value as LanguageCode })}
            className="h-10 px-3 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] border border-[#E6E6E6] dark:border-[#343842] text-sm"
          >
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="fr">Français</option>
            <option value="de">Deutsch</option>
            <option value="hi">हिन्दी</option>
          </select>
        </div>
      </section>

      {/* PDF Defaults */}
      <section className="bg-white dark:bg-[#1A1C20] rounded-2xl border border-[#E6E6E6] dark:border-[#2A2D34] p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <FileText className="w-4 h-4 text-[#E50920]" />
          <h2 className="text-sm font-bold text-[#202124] dark:text-[#F3F4F6]">
            PDF Creation Defaults
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#777777] mb-1">Default Page Size</label>
            <select
              value={settings.defaultPageSize}
              onChange={(e) =>
                onUpdateSettings({ defaultPageSize: e.target.value as PageSizeOption })
              }
              className="w-full h-11 px-3 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] border border-[#E6E6E6] dark:border-[#343842] text-sm"
            >
              <option value="A4">A4</option>
              <option value="A3">A3</option>
              <option value="A5">A5</option>
              <option value="Letter">Letter</option>
              <option value="Legal">Legal</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#777777] mb-1">
              Default Orientation
            </label>
            <select
              value={settings.defaultOrientation}
              onChange={(e) =>
                onUpdateSettings({ defaultOrientation: e.target.value as OrientationOption })
              }
              className="w-full h-11 px-3 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] border border-[#E6E6E6] dark:border-[#343842] text-sm"
            >
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
              <option value="auto">Auto</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#777777] mb-1">
              Default PDF Quality
            </label>
            <select
              value={settings.defaultQuality}
              onChange={(e) =>
                onUpdateSettings({ defaultQuality: e.target.value as ImageQualityOption })
              }
              className="w-full h-11 px-3 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] border border-[#E6E6E6] dark:border-[#343842] text-sm"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="ultra">Ultra HD</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#777777] mb-1">
              Default Storage Folder
            </label>
            <select
              value={settings.defaultFolderId}
              onChange={(e) => onUpdateSettings({ defaultFolderId: e.target.value })}
              className="w-full h-11 px-3 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] border border-[#E6E6E6] dark:border-[#343842] text-sm"
            >
              {folders.map((fl) => (
                <option key={fl.id} value={fl.id}>
                  {fl.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#777777] mb-1">
              File Naming Prefix
            </label>
            <input
              type="text"
              value={settings.fileNamingPrefix}
              onChange={(e) => onUpdateSettings({ fileNamingPrefix: e.target.value })}
              placeholder="My Document"
              className="w-full h-11 px-3.5 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] border border-[#E6E6E6] dark:border-[#343842] text-sm"
            />
          </div>

          <div className="flex flex-col justify-center gap-2.5 pt-2">
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="text-sm text-[#202124] dark:text-[#F3F4F6]">Auto Save to Library</span>
              <input
                type="checkbox"
                checked={settings.autoSave}
                onChange={(e) => onUpdateSettings({ autoSave: e.target.checked })}
                className="w-5 h-5 accent-[#E50920]"
              />
            </label>
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="text-sm text-[#202124] dark:text-[#F3F4F6]">
                Append Date to File Names
              </span>
              <input
                type="checkbox"
                checked={settings.appendDateToName}
                onChange={(e) => onUpdateSettings({ appendDateToName: e.target.checked })}
                className="w-5 h-5 accent-[#E50920]"
              />
            </label>
          </div>
        </div>
      </section>

      {/* Security, Privacy & Storage */}
      <section className="bg-white dark:bg-[#1A1C20] rounded-2xl border border-[#E6E6E6] dark:border-[#2A2D34] divide-y divide-[#E6E6E6] dark:divide-[#2A2D34] overflow-hidden">
        <button
          type="button"
          onClick={() => {
            setPinDraft(settings.appLockPin || '');
            setModal('pin');
          }}
          className="w-full px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-[#F5F5F7]/70 dark:hover:bg-[#24272E]/60 text-left cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] flex items-center justify-center text-[#E50920]">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#202124] dark:text-[#F3F4F6]">App Lock</p>
              <p className="text-xs text-[#777777] dark:text-[#9CA3AF]">
                {settings.appLockEnabled ? '4-digit PIN protection active' : 'Protect your PDF library with a PIN'}
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[#777777]" />
        </button>

        <div className="px-5 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] flex items-center justify-center text-[#25A55B]">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#202124] dark:text-[#F3F4F6]">
                Privacy Mode (Hide Thumbnails)
              </p>
              <p className="text-xs text-[#777777] dark:text-[#9CA3AF]">
                Mask PDF cover previews in Recent & My Files lists
              </p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.hideThumbnailsInRecents}
            onChange={(e) => onUpdateSettings({ hideThumbnailsInRecents: e.target.checked })}
            className="w-5 h-5 accent-[#E50920] cursor-pointer"
          />
        </div>

        <button
          type="button"
          onClick={onOpenStorageFolders}
          className="w-full px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-[#F5F5F7]/70 dark:hover:bg-[#24272E]/60 text-left cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] flex items-center justify-center text-amber-600">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#202124] dark:text-[#F3F4F6]">
                Storage Management
              </p>
              <p className="text-xs text-[#777777] dark:text-[#9CA3AF] tabular-nums">
                {formatBytes(storageTotalBytes)} across {fileCount} files & {folders.length} folders
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[#777777]" />
        </button>

        <button
          type="button"
          onClick={onClearCache}
          className="w-full px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-[#F5F5F7]/70 dark:hover:bg-[#24272E]/60 text-left cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] flex items-center justify-center text-[#777777]">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#202124] dark:text-[#F3F4F6]">Clear Cache</p>
              <p className="text-xs text-[#777777] dark:text-[#9CA3AF]">
                Remove completed task logs and temporary buffers
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[#777777]" />
        </button>
      </section>

      {/* AdMob Test Ads & Android APK / AAB */}
      <section className="bg-white dark:bg-[#1A1C20] rounded-2xl border border-[#E6E6E6] dark:border-[#2A2D34] p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Smartphone className="w-4 h-4 text-[#E50920]" />
            <div>
              <h2 className="text-sm font-bold text-[#202124] dark:text-[#F3F4F6]">
                Google AdMob Test Ads & Android Build
              </h2>
              <p className="text-xs text-[#777777] dark:text-[#9CA3AF]">
                Configured with Google official Android test ad unit IDs for APK & AAB builds
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 py-1">
          <div>
            <p className="text-sm font-medium text-[#202124] dark:text-[#F3F4F6]">
              Adaptive Banner Test Ad
            </p>
            <p className="text-xs text-[#777777] dark:text-[#9CA3AF] font-mono">
              {ADMOB_TEST_IDS.banner}
            </p>
          </div>
          <input
            type="checkbox"
            checked={bannerEnabled}
            onChange={(e) => onToggleBanner(e.target.checked)}
            className="w-5 h-5 accent-[#E50920] cursor-pointer"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => admobService.showInterstitial(true)}
            className="px-4 py-2.5 min-h-[44px] rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] hover:bg-[#EAEAEF] dark:hover:bg-[#2E323B] text-xs font-semibold text-[#202124] dark:text-[#F3F4F6] cursor-pointer"
          >
            Test Interstitial Ad
          </button>
          <button
            type="button"
            onClick={() => admobService.showRewardedAd()}
            className="px-4 py-2.5 min-h-[44px] rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] hover:bg-[#EAEAEF] dark:hover:bg-[#2E323B] text-xs font-semibold text-[#202124] dark:text-[#F3F4F6] cursor-pointer"
          >
            Test Rewarded Video Ad
          </button>
        </div>

        <div className="p-3.5 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] space-y-1 text-[11px] font-mono text-[#777777] dark:text-[#9CA3AF]">
          <p className="truncate">Package: com.pdfmaker.converter</p>
          <p className="truncate">App ID: {ADMOB_TEST_IDS.appId}</p>
          <p className="truncate">Interstitial: {ADMOB_TEST_IDS.interstitial}</p>
          <p className="truncate">Rewarded: {ADMOB_TEST_IDS.rewarded}</p>
        </div>
      </section>

      {/* Support & App Info */}
      <section className="bg-white dark:bg-[#1A1C20] rounded-2xl border border-[#E6E6E6] dark:border-[#2A2D34] divide-y divide-[#E6E6E6] dark:divide-[#2A2D34] overflow-hidden">
        {[
          { icon: Star, color: '#D97706', label: 'Rate App', desc: 'Share your feedback', onClick: () => setModal('rate') },
          { icon: Share2, color: '#2563EB', label: 'Share App', desc: 'Send PDF Maker to colleagues', onClick: handleShareApp },
          { icon: HelpCircle, color: '#0D9488', label: 'Help & Support', desc: 'Offline workflows & quick guide', onClick: () => setModal('help') },
          { icon: Info, color: '#777777', label: 'About App', desc: 'PDF Maker Offline Utility · 100% Local Processing', onClick: () => setModal('about') },
        ].map((row) => {
          const Icon = row.icon;
          return (
            <button
              key={row.label}
              type="button"
              onClick={row.onClick}
              className="w-full px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-[#F5F5F7]/70 dark:hover:bg-[#24272E]/60 text-left cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] flex items-center justify-center"
                  style={{ color: row.color }}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#202124] dark:text-[#F3F4F6]">
                    {row.label}
                  </p>
                  <p className="text-xs text-[#777777] dark:text-[#9CA3AF]">{row.desc}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#777777]" />
            </button>
          );
        })}
      </section>

      {/* App Lock PIN Modal */}
      {modal === 'pin' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          onClick={() => setModal('none')}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-[#1A1C20] rounded-2xl border border-[#E6E6E6] dark:border-[#2A2D34] p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#202124] dark:text-[#F3F4F6]">
                Configure App Lock
              </h3>
              <button type="button" onClick={() => setModal('none')} className="p-1 text-[#777777] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-[#777777] dark:text-[#9CA3AF]">
              Set a 4-digit PIN to lock your offline PDF workspace.
            </p>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pinDraft}
              onChange={(e) => setPinDraft(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="Enter 4-digit PIN"
              className="w-full h-12 px-4 text-center tracking-[0.5em] font-mono text-lg rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] border border-[#E6E6E6] dark:border-[#343842]"
            />
            <div className="flex items-center justify-between pt-1">
              {settings.appLockEnabled ? (
                <button
                  type="button"
                  onClick={() => {
                    onUpdateSettings({ appLockEnabled: false, appLockPin: '' });
                    onNotify('App Lock disabled');
                    setModal('none');
                  }}
                  className="text-xs font-semibold text-[#E50920] cursor-pointer"
                >
                  Disable Lock
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                disabled={pinDraft.length !== 4}
                onClick={() => {
                  onUpdateSettings({ appLockEnabled: true, appLockPin: pinDraft });
                  onNotify('App Lock enabled');
                  setModal('none');
                }}
                className="px-5 py-2.5 rounded-xl bg-[#E50920] disabled:opacity-40 text-white text-sm font-semibold cursor-pointer"
              >
                Save PIN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rate App Modal */}
      {modal === 'rate' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          onClick={() => setModal('none')}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-[#1A1C20] rounded-2xl border border-[#E6E6E6] dark:border-[#2A2D34] p-6 text-center space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-[#202124] dark:text-[#F3F4F6]">
              Rate PDF Maker
            </h3>
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  className="p-1.5 cursor-pointer"
                >
                  <Star
                    className={`w-7 h-7 ${
                      n <= rating ? 'text-amber-500 fill-amber-500' : 'text-[#D1D5DB]'
                    }`}
                  />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                onNotify(`Thank you for rating PDF Maker ${rating}/5!`);
                setModal('none');
              }}
              className="w-full py-2.5 min-h-[44px] rounded-xl bg-[#E50920] text-white text-sm font-semibold cursor-pointer"
            >
              Submit Rating
            </button>
          </div>
        </div>
      )}

      {/* Help & Support Modal */}
      {modal === 'help' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          onClick={() => setModal('none')}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-[#1A1C20] rounded-2xl border border-[#E6E6E6] dark:border-[#2A2D34] p-6 space-y-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#202124] dark:text-[#F3F4F6]">
                Help & Offline Guide
              </h3>
              <button type="button" onClick={() => setModal('none')} className="p-1 text-[#777777] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-sm text-[#777777] dark:text-[#9CA3AF]">
              <div>
                <p className="font-semibold text-[#202124] dark:text-[#F3F4F6]">100% Offline Processing</p>
                <p className="text-xs mt-0.5 leading-relaxed">
                  Every PDF creation, scan, merge, split, compression, watermark, and Word/Excel/PPT conversion runs inside your device browser with zero cloud uploads.
                </p>
              </div>
              <div>
                <p className="font-semibold text-[#202124] dark:text-[#F3F4F6]">Where are my files stored?</p>
                <p className="text-xs mt-0.5 leading-relaxed">
                  All generated PDFs and folders persist locally in IndexedDB so they remain available across restarts.
                </p>
              </div>
              <div>
                <p className="font-semibold text-[#202124] dark:text-[#F3F4F6]">Camera Scanning Tips</p>
                <p className="text-xs mt-0.5 leading-relaxed">
                  Use Document mode with Shadow Removal enabled for crisp receipts, contracts, and study notes.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setModal('none')}
              className="w-full py-2.5 rounded-xl bg-[#202124] dark:bg-[#F3F4F6] text-white dark:text-[#111215] text-sm font-semibold cursor-pointer"
            >
              Got It
            </button>
          </div>
        </div>
      )}

      {/* About Modal */}
      {modal === 'about' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          onClick={() => setModal('none')}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-[#1A1C20] rounded-2xl border border-[#E6E6E6] dark:border-[#2A2D34] p-6 text-center space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-2xl bg-[#E50920] text-white mx-auto flex items-center justify-center font-display font-extrabold text-lg">
              PDF
            </div>
            <h3 className="text-lg font-bold text-[#202124] dark:text-[#F3F4F6]">PDF Maker</h3>
            <p className="text-xs text-[#777777] dark:text-[#9CA3AF] leading-relaxed">
              All-in-one offline PDF Maker, Document Scanner, and PDF Converter with local IndexedDB library storage.
            </p>
            <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[#25A55B]">
              <Check className="w-4 h-4" />
              <span>Offline Engine Ready</span>
            </div>
            <button
              type="button"
              onClick={() => setModal('none')}
              className="w-full mt-2 py-2.5 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] text-sm font-semibold cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
