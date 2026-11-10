import type { PuzzleSave } from '../game/core/serialize';
import type { AppStorage } from '../platform/storage';
import { DEFAULT_SETTINGS, sanitize, type Settings } from '../settings';

/** One puzzle in progress (there is at most one per picture). */
export interface SaveMeta {
  pictureId: string;
  placed: number;
  total: number;
  updatedAt: number;
}

export interface PictureStats {
  /** How often the picture was solved (any piece count). */
  solved: number;
  /** Best time in ms per piece count. */
  best: Record<number, number>;
}

export type Stats = Record<string, PictureStats>;

/** A photo the player added; the image itself is stored separately as a Blob. */
export interface PhotoMeta {
  id: string;
  /** Running number used for its title ("Photo 3"). */
  n: number;
  width: number;
  height: number;
  /** Small JPEG data URL for lists. */
  thumb: string;
  addedAt: number;
}

const K = {
  settings: 'settings',
  saveIndex: 'saves',
  save: (pictureId: string) => `save:${pictureId}`,
  stats: 'stats',
  photoIndex: 'photos',
  photo: (id: string) => `photo:${id}`,
};

/** Old (milestone 5) settings location, migrated once. */
const LEGACY_SETTINGS_KEY = 'jigsaw.settings.v1';

/**
 * Everything the app stores on the device. All writes go through one queue, so a save that is
 * triggered while another is still running can never interleave with it.
 */
export class Repository {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly store: AppStorage) {}

  private serial<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  // --- Settings ---------------------------------------------------------------

  async loadSettings(): Promise<Settings> {
    const stored = await this.store.get<unknown>(K.settings);
    if (stored !== undefined) return sanitize(stored);
    try {
      const legacy = globalThis.localStorage?.getItem(LEGACY_SETTINGS_KEY);
      if (legacy) {
        const settings = sanitize(JSON.parse(legacy));
        await this.saveSettings(settings);
        globalThis.localStorage.removeItem(LEGACY_SETTINGS_KEY);
        return settings;
      }
    } catch {
      /* ignore broken legacy data */
    }
    return { ...DEFAULT_SETTINGS };
  }

  saveSettings(settings: Settings): Promise<void> {
    return this.serial(() => this.store.set(K.settings, settings));
  }

  // --- Puzzles in progress ----------------------------------------------------

  /** Puzzles in progress, most recently played first. */
  async listSaves(): Promise<SaveMeta[]> {
    const index = (await this.store.get<SaveMeta[]>(K.saveIndex)) ?? [];
    return [...index].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  loadSave(pictureId: string): Promise<PuzzleSave | undefined> {
    return this.store.get<PuzzleSave>(K.save(pictureId));
  }

  storeSave(pictureId: string, save: PuzzleSave, placed: number, total: number): Promise<SaveMeta> {
    return this.serial(async () => {
      const meta: SaveMeta = { pictureId, placed, total, updatedAt: Date.now() };
      // Data first, then the index: a crash in between leaves a harmless orphan, not a dead link.
      await this.store.set(K.save(pictureId), save);
      const index = ((await this.store.get<SaveMeta[]>(K.saveIndex)) ?? []).filter(
        (m) => m.pictureId !== pictureId,
      );
      await this.store.set(K.saveIndex, [...index, meta]);
      return meta;
    });
  }

  deleteSave(pictureId: string): Promise<void> {
    return this.serial(async () => {
      const index = (await this.store.get<SaveMeta[]>(K.saveIndex)) ?? [];
      await this.store.set(
        K.saveIndex,
        index.filter((m) => m.pictureId !== pictureId),
      );
      await this.store.remove(K.save(pictureId));
    });
  }

  // --- Stats ------------------------------------------------------------------

  async loadStats(): Promise<Stats> {
    return (await this.store.get<Stats>(K.stats)) ?? {};
  }

  /**
   * Records a solved puzzle. Returns true if an earlier best time for this picture and piece
   * count was beaten (the very first solve sets the record but is not announced as one).
   */
  recordCompletion(pictureId: string, pieceCount: number, elapsedMs: number): Promise<boolean> {
    return this.serial(async () => {
      const stats = (await this.store.get<Stats>(K.stats)) ?? {};
      const entry = stats[pictureId] ?? { solved: 0, best: {} };
      const previous = entry.best[pieceCount];
      const newBest = previous === undefined || elapsedMs < previous;
      stats[pictureId] = {
        solved: entry.solved + 1,
        best: newBest ? { ...entry.best, [pieceCount]: elapsedMs } : entry.best,
      };
      await this.store.set(K.stats, stats);
      return newBest && previous !== undefined;
    });
  }

  // --- Own photos ---------------------------------------------------------------

  async listPhotos(): Promise<PhotoMeta[]> {
    return (await this.store.get<PhotoMeta[]>(K.photoIndex)) ?? [];
  }

  addPhoto(image: Blob, width: number, height: number, thumb: string): Promise<PhotoMeta> {
    return this.serial(async () => {
      const index = (await this.store.get<PhotoMeta[]>(K.photoIndex)) ?? [];
      const n = index.reduce((max, p) => Math.max(max, p.n), 0) + 1;
      const meta: PhotoMeta = {
        id: `photo-${Date.now().toString(36)}-${n}`,
        n,
        width,
        height,
        thumb,
        addedAt: Date.now(),
      };
      await this.store.set(K.photo(meta.id), image);
      await this.store.set(K.photoIndex, [...index, meta]);
      return meta;
    });
  }

  photoBlob(id: string): Promise<Blob | undefined> {
    return this.store.get<Blob>(K.photo(id));
  }

  /** Deletes a photo together with its puzzle in progress and its stats. */
  async deletePhoto(id: string): Promise<void> {
    await this.deleteSave(id);
    await this.serial(async () => {
      const index = (await this.store.get<PhotoMeta[]>(K.photoIndex)) ?? [];
      await this.store.set(
        K.photoIndex,
        index.filter((p) => p.id !== id),
      );
      await this.store.remove(K.photo(id));
      const stats = (await this.store.get<Stats>(K.stats)) ?? {};
      if (stats[id]) {
        delete stats[id];
        await this.store.set(K.stats, stats);
      }
    });
  }
}
