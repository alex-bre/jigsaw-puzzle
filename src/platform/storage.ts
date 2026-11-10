import { createStore, del, get, set, type UseStore } from 'idb-keyval';

/**
 * Small async key-value store for everything the app keeps on the device. Values are
 * structured-clonable data (plain objects, arrays, strings, numbers) or Blobs.
 *
 * Web: IndexedDB. Android (milestone 7) gets its own implementation of this interface
 * (Capacitor Preferences / Filesystem), so nothing else in the app has to change.
 */
export interface AppStorage {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
}

export class IndexedDbStorage implements AppStorage {
  private readonly store: UseStore;

  constructor(dbName = 'jigsaw-puzzle', storeName = 'data') {
    this.store = createStore(dbName, storeName);
  }

  get<T>(key: string): Promise<T | undefined> {
    return get<T>(key, this.store);
  }

  set(key: string, value: unknown): Promise<void> {
    return set(key, value, this.store);
  }

  remove(key: string): Promise<void> {
    return del(key, this.store);
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

/** The best storage available on this device. */
export async function createStorage(): Promise<AppStorage> {
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
