import { Capacitor } from '@capacitor/core';

/** True inside the Android (later iOS) app, false in a normal browser. */
export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}
