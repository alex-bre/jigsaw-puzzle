import { afterEach, describe, expect, it, vi } from 'vitest';
import { Repository } from '../src/data/repository';
import { createPuzzle } from '../src/game/core/model';
import { serializePuzzle } from '../src/game/core/serialize';
import { fillTray } from '../src/game/core/tray';
import { MemoryStorage } from '../src/platform/storage';
import { DEFAULT_SETTINGS } from '../src/settings';

function save(id: string) {
  const s = createPuzzle({
    imageId: id,
    imageWidth: 400,
    imageHeight: 300,
    cols: 4,
    rows: 3,
    seed: 1,
  });
  fillTray(s, 1);
  return serializePuzzle(s);
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('repository: puzzles in progress', () => {
  it('stores, lists (most recent first), loads and deletes saves', async () => {
    vi.useFakeTimers();
    const repo = new Repository(new MemoryStorage());
    vi.setSystemTime(1000);
    await repo.storeSave('lynx', save('lynx'), 3, 12);
    vi.setSystemTime(2000);
    await repo.storeSave('great-wave', save('great-wave'), 0, 24);
    expect((await repo.listSaves()).map((m) => m.pictureId)).toEqual(['great-wave', 'lynx']);

    vi.setSystemTime(3000);
    await repo.storeSave('lynx', save('lynx'), 5, 12); // update replaces, does not duplicate
    const list = await repo.listSaves();
    expect(list.map((m) => m.pictureId)).toEqual(['lynx', 'great-wave']);
    expect(list[0]).toMatchObject({ placed: 5, total: 12, updatedAt: 3000 });
    expect((await repo.loadSave('lynx'))?.imageId).toBe('lynx');

    await repo.deleteSave('lynx');
    expect((await repo.listSaves()).map((m) => m.pictureId)).toEqual(['great-wave']);
    expect(await repo.loadSave('lynx')).toBeUndefined();
  });

  it('serialises concurrent writes so no update is lost', async () => {
    const repo = new Repository(new MemoryStorage());
    await Promise.all(
      ['a', 'b', 'c', 'd', 'e'].map((id, i) => repo.storeSave(id, save(id), i, 12)),
    );
    expect((await repo.listSaves()).map((m) => m.pictureId).sort()).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
    ]);
  });
});

describe('repository: stats', () => {
  it('counts solves and keeps the best time per piece count', async () => {
    const repo = new Repository(new MemoryStorage());
    expect(await repo.recordCompletion('lynx', 12, 60_000)).toBe(false); // first solve: no "record"
    expect(await repo.recordCompletion('lynx', 12, 70_000)).toBe(false); // slower
    expect(await repo.recordCompletion('lynx', 12, 50_000)).toBe(true); // beaten
    expect(await repo.recordCompletion('lynx', 24, 90_000)).toBe(false); // other count
    expect((await repo.loadStats()).lynx).toEqual({ solved: 4, best: { 12: 50_000, 24: 90_000 } });
  });
});

describe('repository: photos', () => {
  it('adds photos with running numbers and deletes them with their save and stats', async () => {
    const repo = new Repository(new MemoryStorage());
    const a = await repo.addPhoto(new Blob(['a']), 800, 600, 'data:a');
    const b = await repo.addPhoto(new Blob(['b']), 800, 600, 'data:b');
    expect([a.n, b.n]).toEqual([1, 2]);
    expect(a.id).not.toBe(b.id);
    expect(await (await repo.photoBlob(b.id))?.text()).toBe('b');

    await repo.storeSave(a.id, save(a.id), 1, 12);
    await repo.recordCompletion(a.id, 12, 1000);
    await repo.deletePhoto(a.id);
    expect((await repo.listPhotos()).map((p) => p.id)).toEqual([b.id]);
    expect(await repo.photoBlob(a.id)).toBeUndefined();
    expect(await repo.listSaves()).toEqual([]);
    expect((await repo.loadStats())[a.id]).toBeUndefined();

    // Numbers keep counting up after deletions, so titles never repeat.
    expect((await repo.addPhoto(new Blob(['c']), 1, 1, '')).n).toBe(3);
  });
});

describe('repository: settings', () => {
  it('returns defaults when nothing is stored and round-trips settings', async () => {
    const repo = new Repository(new MemoryStorage());
    expect(await repo.loadSettings()).toEqual(DEFAULT_SETTINGS);
    const s = { ...DEFAULT_SETTINGS, language: 'de' as const, sound: false };
    await repo.saveSettings(s);
    expect(await repo.loadSettings()).toEqual(s);
  });

  it('migrates settings from the old localStorage location once', async () => {
    const legacy = new Map([
      ['jigsaw.settings.v1', JSON.stringify({ language: 'en', background: 'night' })],
    ]);
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => legacy.get(k) ?? null,
      removeItem: (k: string) => legacy.delete(k),
    });
    const store = new MemoryStorage();
    const repo = new Repository(store);
    expect(await repo.loadSettings()).toMatchObject({ language: 'en', background: 'night' });
    expect(legacy.size).toBe(0);
    expect(await store.get('settings')).toMatchObject({ language: 'en' });
  });
});
