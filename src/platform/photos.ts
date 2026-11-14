import { Camera } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { MAX_IMAGE_SIDE } from '../ui/loadPhoto';

export type PhotoSource = 'gallery' | 'camera';

/**
 * Lets the player choose a photo from the gallery or take a new one (app only; the browser
 * uses a file input). Returns null if the player cancelled.
 */
export async function pickPhoto(source: PhotoSource): Promise<Blob | null> {
  let webPath: string | undefined;
  try {
    if (source === 'camera') {
      const result = await Camera.takePhoto({
        quality: 90,
        targetWidth: MAX_IMAGE_SIDE,
        targetHeight: MAX_IMAGE_SIDE,
        correctOrientation: true,
      });
      webPath = result.webPath ?? (result.uri ? Capacitor.convertFileSrc(result.uri) : undefined);
    } else {
      const { results } = await Camera.chooseFromGallery({ allowMultipleSelection: false });
      const result = results[0];
      webPath = result?.webPath ?? (result?.uri ? Capacitor.convertFileSrc(result.uri) : undefined);
    }
  } catch (err) {
    if (isCancel(err)) return null;
    throw err;
  }
  if (!webPath) return null;
  const response = await fetch(webPath);
  if (!response.ok) throw new Error(`Could not read photo (${response.status})`);
  return response.blob();
}

function isCancel(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /cancel|no picture/i.test(message);
}
