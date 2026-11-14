import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import type { FileBackend } from './storage';

/**
 * FileBackend on the app's private data folder (Android: /data/data/<app>/files). It is never
 * cleared by the system, survives app updates and is only removed when the app is uninstalled.
 */
export const capacitorFiles: FileBackend = {
  async read(path, binary) {
    try {
      const result = await Filesystem.readFile({
        path,
        directory: Directory.Data,
        encoding: binary ? undefined : Encoding.UTF8,
      });
      return typeof result.data === 'string'
        ? result.data
        : binary
          ? await blobBase64(result.data)
          : await result.data.text();
    } catch (err) {
      if (await exists(path)) throw err; // a real read error, not just a missing file
      return undefined;
    }
  },

  async write(path, data, binary) {
    await Filesystem.writeFile({
      path,
      data,
      directory: Directory.Data,
      encoding: binary ? undefined : Encoding.UTF8,
      recursive: true,
    });
  },

  async remove(path) {
    if (!(await exists(path))) return;
    await Filesystem.deleteFile({ path, directory: Directory.Data });
  },

  async rename(from, to) {
    try {
      await Filesystem.rename({ from, to, directory: Directory.Data });
    } catch (err) {
      // Some Android versions refuse to rename onto an existing file: remove it and retry.
      // If the app dies in between, the reader falls back to the finished temp file.
      if (!(await exists(to))) throw err;
      await Filesystem.deleteFile({ path: to, directory: Directory.Data });
      await Filesystem.rename({ from, to, directory: Directory.Data });
    }
  },
};

async function exists(path: string): Promise<boolean> {
  try {
    await Filesystem.stat({ path, directory: Directory.Data });
    return true;
  } catch {
    return false;
  }
}

async function blobBase64(blob: Blob): Promise<string> {
  const url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(blob);
  });
  return url.slice(url.indexOf(',') + 1);
}
