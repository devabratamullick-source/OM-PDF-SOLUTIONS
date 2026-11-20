import React, { useEffect, useState } from 'react';
import { X, CheckCircle2, Smartphone } from 'lucide-react';
import { ADMOB_TEST_IDS, WebAdEvent } from '../services/admobService';

interface AdMobWebBannerProps {
  visible: boolean;
  onDismiss: () => void;
}

export const AdMobWebBanner: React.FC<AdMobWebBannerProps> = ({ visible, onDismiss }) => {
  if (!visible) return null;

  return (
    <div className="bg-white dark:bg-[#1A1C20] border border-[#E6E6E6] dark:border-[#2A2D34] rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className="px-1.5 py-0.5 rounded bg-[#25A55B]/15 text-[#25A55B] text-[10px] font-bold uppercase tracking-wide shrink-0">
          Test Ad
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[#202124] dark:text-[#F3F4F6] truncate">
            Google AdMob Adaptive Banner (Android Test Mode)
          </p>
          <p className="text-[11px] font-mono text-[#777777] dark:text-[#9CA3AF] truncate">
            {ADMOB_TEST_IDS.banner}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Hide test ad banner"
        className="min-w-[32px] min-h-[32px] rounded-lg flex items-center justify-center text-[#777777] hover:bg-[#F5F5F7] dark:hover:bg-[#24272E] shrink-0 cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

interface AdMobWebModalProps {
  event: WebAdEvent | null;
  onClose: (rewarded?: boolean) => void;
}

export const AdMobWebModal: React.FC<AdMobWebModalProps> = ({ event, onClose }) => {
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (!event) return;
    setCountdown(event.type === 'rewarded' ? 4 : 2);
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [event]);

  if (!event) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-[#1A1C20] rounded-3xl border border-[#E6E6E6] dark:border-[#2A2D34] overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#202124] text-white">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className="px-2 py-0.5 rounded bg-[#25A55B] text-white text-[10px] uppercase">
              Test Ad
            </span>
            <span>
              {event.type === 'rewarded'
                ? 'AdMob Rewarded Test Ad'
                : 'AdMob Interstitial Test Ad'}
            </span>
          </div>
          <button
            type="button"
            disabled={countdown > 0}
            onClick={() => onClose(event.type === 'rewarded')}
            className="px-3 py-1 rounded-lg bg-white/15 disabled:opacity-50 text-xs font-semibold cursor-pointer tabular-nums"
          >
            {countdown > 0 ? `Close in ${countdown}s` : 'Close'}
          </button>
        </div>

        <div className="p-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#E50920]/10 text-[#E50920] mx-auto flex items-center justify-center">
            {countdown === 0 && event.type === 'rewarded' ? (
              <CheckCircle2 className="w-7 h-7 text-[#25A55B]" />
            ) : (
              <Smartphone className="w-7 h-7" />
            )}
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-[#202124] dark:text-[#F3F4F6]">
              Google Mobile Ads — Test Placement
            </h3>
            <p className="text-xs text-[#777777] dark:text-[#9CA3AF] leading-relaxed">
              This is a browser preview of your native Android AdMob{' '}
              {event.type === 'rewarded' ? 'Rewarded Video' : 'Interstitial'} ad. Inside the compiled
              APK/AAB, Google Play Services renders the live test creative automatically.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] font-mono text-[11px] text-[#202124] dark:text-[#F3F4F6] break-all">
            Unit ID: {event.adUnitId}
          </div>
          <button
            type="button"
            disabled={countdown > 0}
            onClick={() => onClose(event.type === 'rewarded')}
            className="w-full py-3 min-h-[46px] rounded-xl bg-[#E50920] hover:bg-[#B81024] disabled:opacity-45 text-white text-sm font-semibold cursor-pointer"
          >
            {countdown > 0
              ? `Please wait (${countdown}s)...`
              : event.type === 'rewarded'
              ? 'Claim Test Reward & Continue'
              : 'Continue to App'}
          </button>
        </div>
      </div>
    </div>
  );
};
