# Android APK & AAB Build Guide (with Google AdMob Test Ads)

This project is pre-configured with **Capacitor Android** (`com.pdfmaker.converter`) and **`@capacitor-community/admob`** using Google's official Android **Test Ad IDs**.

## Configured Google AdMob Test IDs

| Type | Google Official Test ID |
| --- | --- |
| Android App ID (`AndroidManifest.xml`) | `ca-app-pub-3940256099942544~3347511713` |
| Banner Test Ad Unit | `ca-app-pub-3940256099942544/6300978111` |
| Interstitial Test Ad Unit | `ca-app-pub-3940256099942544/1033173712` |
| Rewarded Test Ad Unit | `ca-app-pub-3940256099942544/5224354917` |

> Before publishing to Google Play, replace these test IDs in `android/app/src/main/AndroidManifest.xml`, `capacitor.config.ts`, and `src/services/admobService.ts` with your production AdMob IDs.

---

## Option 1: Build APK & AAB Locally (Android Studio or CLI)

### Prerequisites
- Node.js 20+
- JDK 17 (Temurin or Android Studio bundled JBR)
- Android SDK (API 34+)

### Commands

```bash
# 1. Build the web app and sync into the Android project
npm install
npm run android:sync

# 2. Build Debug APK
npm run android:apk
# Output: android/app/build/outputs/apk/debug/app-debug.apk

# 3. Build Release AAB (Google Play Store Bundle)
npm run android:aab
# Output: android/app/build/outputs/bundle/release/app-release.aab
```

Or open the `android/` folder directly in **Android Studio** and select:
- **Build → Build Bundle(s) / APK(s) → Build APK(s)**
- **Build → Generate Signed App Bundle / APK → Android App Bundle (.aab)**

---

## Option 2: Automated Cloud Build (GitHub Actions)

Push this repository to GitHub and run the **Build Android APK & AAB** workflow (`.github/workflows/build-android.yml`) under the **Actions** tab. It automatically installs JDK 17 + Android SDK and produces downloadable `app-debug.apk`, `app-release-unsigned.apk`, and `app-release.aab` artifacts.
