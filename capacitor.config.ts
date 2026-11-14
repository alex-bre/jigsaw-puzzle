import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Permanent once the app is on the Play Store – change it before the first upload if needed.
  appId: 'com.jigsawpuzzle.app',
  appName: 'Jigsaw Puzzle',
  webDir: 'dist',
  android: {
    // Release builds: no remote WebView debugging, no mixed content (we load nothing remote).
    webContentsDebuggingEnabled: false,
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      // Hidden by the app once the first screen is ready (src/platform/device.ts).
      launchAutoHide: false,
      backgroundColor: '#35514a',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    SystemBars: {
      // Edge-to-edge; the CSS pads with env(safe-area-inset-*).
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
      style: 'DARK',
    },
  },
};

export default config;
