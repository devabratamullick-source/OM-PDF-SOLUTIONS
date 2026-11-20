import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pdfmaker.converter',
  appName: 'PDF Maker',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    AdMob: {
      appId: 'ca-app-pub-3940256099942544~3347511713',
    },
  },
};

export default config;
