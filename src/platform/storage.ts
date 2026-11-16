import { isNative } from './native';

/**
 * Small async key-value store for everything the app keeps on the device. Values are
 * structured-clonable data (plain objects, arrays, strings, numbers) or Blobs.
 *
 * Web: IndexedDB. Android: files in the app's private data folder (see FileStorage), which
 * the system never evicts and which survive app updates.
 */
export interface AppStorage {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
}

/**
 * Key-value store in one IndexedDB object store, with keys kept apart from the values
 * ("out-of-line"). Database and store names match what the app used before (idb-keyval), so
 * data saved by earlier versions is read as-is.
 */
export class IndexedDbStorage implements AppStorage {
  private db: Promise<IDBDatabase> | null = null;

  constructor(
    private readonly dbName = 'jigsaw-puzzle',
    private readonly storeName = 'data',
  ) {}

  get<T>(key: string): Promise<T | undefined> {
    return this.request<T | undefined>('readonly', (store) => store.get(key));
  }

  async set(key: string, value: unknown): Promise<void> {
    await this.request('readwrite', (store) => store.put(value, key));
  }

  async remove(key: string): Promise<void> {
    await this.request('readwrite', (store) => store.delete(key));
  }

  /** Opens the database once and reuses the connection; reopens it if the browser closed it. */
  private open(): Promise<IDBDatabase> {
    if (!this.db) {
      const opening = new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(this.dbName);
        req.onupgradeneeded = () => req.result.createObjectStore(this.storeName);
        req.onsuccess = () => {
          const db = req.result;
          db.onclose = () => (this.db = null);
          db.onversionchange = () => {
            db.close();
            this.db = null;
          };
          resolve(db);
        };
        req.onerror = () => reject(req.error);
      });
      // A failed open must not be cached; the next call tries again.
      opening.catch(() => (this.db = null));
      this.db = opening;
    }
    return this.db;
  }

  /**
   * Runs one request in its own transaction and resolves once the transaction has completed,
   * i.e. a write is only reported as done when it is actually stored.
   */
  private async request<T>(
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => IDBRequest,
  ): Promise<T> {
    const db = await this.open();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(this.storeName, mode);
      const req = action(tx.objectStore(this.storeName));
      tx.oncomplete = () => resolve(req.result as T);
      tx.onerror = () => reject(tx.error ?? req.error);
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
    });
  }
}

/** Keeps data only in memory: used in tests and as a fallback when IndexedDB is unavailable. */
export class MemoryStorage implements AppStorage {
  private readonly data = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | undefined> {
    return this.data.get(key) as T | undefined;
  }

  async set(key: string, value: unknown): Promise<void> {
    this.data.set(key, structuredClone(value));
  }

  async remove(key: string): Promise<void> {
    this.data.delete(key);
  }
}

/** Minimal file access FileStorage needs. Binary contents are passed as base64 strings. */
export interface FileBackend {
  /** File contents, or undefined if the file does not exist. */
  read(path: string, binary: boolean): Promise<string | undefined>;
  write(path: string, data: string, binary: boolean): Promise<void>;
  /** Deletes a file; does nothing if it does not exist. */
  remove(path: string): Promise<void>;
  /** Moves a file, replacing the target if it exists. */
  rename(from: string, to: string): Promise<void>;
}

/** Marks a JSON file whose value is a Blob stored next to it in a `.bin` file. */
const BLOB_MARKER = '__blob__';

/**
 * Key-value store on top of plain files: one `<key>.json` file per key, Blobs as an extra
 * `<key>.bin` file. Every file is written to a temporary name first and then renamed, so a
 * crash or a killed app never leaves a half-written save behind.
 */
export class FileStorage implements AppStorage {
  constructor(
    private readonly files: FileBackend,
    private readonly dir = 'store',
  ) {}

  async get<T>(key: string): Promise<T | undefined> {
    const text = await this.readSafe(this.path(key, 'json'), false);
    if (text === undefined) return undefined;
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      console.warn(`Stored value "${key}" is damaged and was ignored`);
      return undefined;
    }
    if (isBlobRef(value)) {
      const data = await this.readSafe(this.path(key, 'bin'), true);
      if (data === undefined) return undefined;
      return base64ToBlob(data, value[BLOB_MARKER]) as T;
    }
    return value as T;
  }

  async set(key: string, value: unknown): Promise<void> {
    if (value === undefined) return this.remove(key);
    if (value instanceof Blob) {
      // Image data first, then the small reference: a crash in between keeps the old value.
      await this.writeSafe(this.path(key, 'bin'), await blobToBase64(value), true);
      await this.writeSafe(
        this.path(key, 'json'),
        JSON.stringify({ [BLOB_MARKER]: value.type }),
        false,
      );
      return;
    }
    await this.writeSafe(this.path(key, 'json'), JSON.stringify(value), false);
    await this.files.remove(this.path(key, 'bin')); // in case it used to be a Blob
  }

  async remove(key: string): Promise<void> {
    await this.files.remove(this.path(key, 'json'));
    await this.files.remove(this.path(key, 'json') + '.tmp');
    await this.files.remove(this.path(key, 'bin'));
    await this.files.remove(this.path(key, 'bin') + '.tmp');
  }

  private path(key: string, ext: 'json' | 'bin'): string {
    return `${this.dir}/${fileName(key)}.${ext}`;
  }

  private async writeSafe(path: string, data: string, binary: boolean): Promise<void> {
    const tmp = path + '.tmp';
    await this.files.write(tmp, data, binary);
    await this.files.rename(tmp, path);
  }

  /** Reads a file; falls back to a finished temp file if the app died right before the rename. */
  private async readSafe(path: string, binary: boolean): Promise<string | undefined> {
    return (await this.files.read(path, binary)) ?? (await this.files.read(path + '.tmp', binary));
  }
}

/** Maps any key to a safe, unique file name: letters, digits, '-' and '.' stay, the rest is escaped. */
export function fileName(key: string): string {
  return key.replace(/[^A-Za-z0-9.-]/g, (c) => `_${c.charCodeAt(0).toString(16).padStart(2, '0')}`);
}

function isBlobRef(value: unknown): value is { [BLOB_MARKER]: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>)[BLOB_MARKER] === 'string'
  );
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBlob(data: string, type: string): Blob {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

/** The best storage available on this device. */
export async function createStorage(): Promise<AppStorage> {
  if (isNative()) {
    const { capacitorFiles } = await import('./nativeFiles');
    return new FileStorage(capacitorFiles);
  }
  try {
    const storage = new IndexedDbStorage();
    await storage.get('__probe__'); // fails early in browsers that block IndexedDB
    // Ask the browser not to evict our data under storage pressure (best effort).
    void navigator.storage?.persist?.().catch(() => false);
    return storage;
  } catch (err) {
    console.warn('IndexedDB unavailable, progress will not be kept', err);
    return new MemoryStorage();
  }
}
