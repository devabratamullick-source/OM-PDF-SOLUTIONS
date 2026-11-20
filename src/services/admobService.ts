import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  BannerAdOptions,
  BannerAdPosition,
  BannerAdSize,
  AdOptions,
  RewardAdOptions,
} from '@capacitor-community/admob';

/**
 * Official Google AdMob Android Test IDs
 * Safe for development, QA, and test APK/AAB builds without risking AdMob policy violations.
 */
export const ADMOB_TEST_IDS = {
  appId: 'ca-app-pub-3940256099942544~3347511713',
  banner: 'ca-app-pub-3940256099942544/6300978111',
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
  rewarded: 'ca-app-pub-3940256099942544/5224354917',
} as const;

export type WebAdEvent =
  | { type: 'interstitial'; adUnitId: string }
  | { type: 'rewarded'; adUnitId: string };

type WebAdListener = (event: WebAdEvent) => void;

let initialized = false;
let lastInterstitialTs = 0;
let webListener: WebAdListener | null = null;

export const admobService = {
  isNativeAndroid(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  },

  registerWebPreviewListener(listener: WebAdListener | null) {
    webListener = listener;
  },

  async initialize(): Promise<void> {
    if (initialized) return;
    initialized = true;

    if (!this.isNativeAndroid()) return;

    try {
      await AdMob.initialize({
        initializeForTesting: true,
      });
    } catch (err) {
      console.warn('AdMob initialize error:', err);
    }
  },

  async showBanner(): Promise<boolean> {
    if (!this.isNativeAndroid()) return false;
    try {
      await this.initialize();
      const options: BannerAdOptions = {
        adId: ADMOB_TEST_IDS.banner,
        adSize: BannerAdSize.ADAPTIVE_BANNER,
        position: BannerAdPosition.BOTTOM_CENTER,
        margin: 64, // sits cleanly above the 64px mobile bottom navigation bar
        isTesting: true,
      };
      await AdMob.showBanner(options);
      return true;
    } catch (err) {
      console.warn('AdMob showBanner error:', err);
      return false;
    }
  },

  async hideBanner(): Promise<void> {
    if (!this.isNativeAndroid()) return;
    try {
      await AdMob.hideBanner();
    } catch {
      // ignore if not shown
    }
  },

  async showInterstitial(force = false): Promise<boolean> {
    const now = Date.now();
    // Respect a 45-second cooldown unless explicitly triggered from Settings test button
    if (!force && now - lastInterstitialTs < 45000) {
      return false;
    }
    lastInterstitialTs = now;

    if (!this.isNativeAndroid()) {
      webListener?.({ type: 'interstitial', adUnitId: ADMOB_TEST_IDS.interstitial });
      return true;
    }

    try {
      await this.initialize();
      const options: AdOptions = {
        adId: ADMOB_TEST_IDS.interstitial,
        isTesting: true,
      };
      await AdMob.prepareInterstitial(options);
      await AdMob.showInterstitial();
      return true;
    } catch (err) {
      console.warn('AdMob showInterstitial error:', err);
      return false;
    }
  },

  async showRewardedAd(): Promise<boolean> {
    if (!this.isNativeAndroid()) {
      webListener?.({ type: 'rewarded', adUnitId: ADMOB_TEST_IDS.rewarded });
      return true;
    }

    try {
      await this.initialize();
      const options: RewardAdOptions = {
        adId: ADMOB_TEST_IDS.rewarded,
        isTesting: true,
      };
      await AdMob.prepareRewardVideoAd(options);
      await AdMob.showRewardVideoAd();
      return true;
    } catch (err) {
      console.warn('AdMob showRewardedAd error:', err);
      return false;
    }
  },
};
