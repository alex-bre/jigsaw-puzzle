import { App } from '@capacitor/app';
import { SystemBars, SystemBarsStyle } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { SplashScreen } from '@capacitor/splash-screen';
import { isNative } from './native';

/**
 * Device integration: vibration, the Android back button, app pause and the splash screen.
 * In a browser everything falls back to web APIs or does nothing.
 */

/** Short tap when a piece joins a neighbour, a slightly firmer one when it locks into place. */
export function vibrate(locked: boolean): void {
  if (isNative()) {
    void Haptics.impact({ style: locked ? ImpactStyle.Medium : ImpactStyle.Light }).catch(
      () => undefined,
    );
  } else {
    navigator.vibrate?.(locked ? 25 : 12);
  }
}

/** Handles the Android back button. Without a handler Android would just close the WebView. */
export function onBackButton(handler: () => void): void {
  if (!isNative()) return;
  void App.addListener('backButton', handler);
}

/** Called when the app goes to the background (it may be killed afterwards without warning). */
export function onPause(handler: () => void): void {
  if (!isNative()) return;
  void App.addListener('pause', handler);
}

/** Leaves the app (Android back button on the home screen). */
export function exitApp(): void {
  if (isNative()) void App.exitApp();
}

/** Hides the native splash screen once the first screen is ready. */
export function appReady(): void {
  if (!isNative()) return;
  // Light status bar icons on our dark backgrounds.
  void SystemBars.setStyle({ style: SystemBarsStyle.Dark }).catch(() => undefined);
  void SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => undefined);
}
