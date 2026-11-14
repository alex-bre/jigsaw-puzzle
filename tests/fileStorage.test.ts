import { describe, expect, it } from 'vitest';
import { Repository } from '../src/data/repository';
import { fileName, FileStorage, type FileBackend } from '../src/platform/storage';

/** In-memory file system; `failOn` makes the next matching operation throw (a "crash"). */
class FakeFiles implements FileBackend {
  readonly files = new Map<string, { data: string; binary: boolean }>();
  failOn: ((op: string, path: string) => boolean) | null = null;

  private check(op: string, path: string): void {
    if (this.failOn?.(op, path)) {
      this.failOn = null;
      throw new Error(`crash during ${op} ${path}`);
    }
  }

  async read(path: string, binary: boolean): Promise<string | undefined> {
    const file = this.files.get(path);
    if (file && file.binary !== binary) throw new Error(`wrong encoding for ${path}`);
    return file?.data;
  }

  async write(path: string, data: string, binary: boolean): Promise<void> {
    this.check('write', path);
    this.files.set(path, { data, binary });
  }

  async remove(path: string): Promise<void> {
    this.files.delete(path);
  }

  async rename(from: string, to: string): Promise<void> {
    this.check('rename', from);
    const file = this.files.get(from);
    if (!file) throw new Error(`missing ${from}`);
    this.files.set(to, file);
    this.files.delete(from);
  }
}

describe('file storage (Android)', () => {
  it('stores, reads and removes JSON values', async () => {
    const files = new FakeFiles();
    const store = new FileStorage(files);
    expect(await store.get('stats')).toBeUndefined();
    await store.set('stats', { lynx: { solved: 2, best: { 24: 1000 } } });
    expect(await store.get('stats')).toEqual({ lynx: { solved: 2, best: { 24: 1000 } } });
    await store.set('stats', { other: 1 });
    expect(await store.get('stats')).toEqual({ other: 1 });
    await store.remove('stats');
    expect(await store.get('stats')).toBeUndefined();
    expect(files.files.size).toBe(0);
  });

  it('maps keys to safe, distinct file names', () => {
    expect(fileName('save:photo-abc-1')).toBe('save_3aphoto-abc-1');
    expect(fileName('a/b')).not.toBe(fileName('a_b'));
    expect(fileName('a_b')).toBe('a_5fb');
    expect(fileName('../x')).not.toContain('/');
  });

  it('round-trips Blobs byte for byte, with their type', async () => {
    const files = new FakeFiles();
    const store = new FileStorage(files);
    const bytes = new Uint8Array(100_000).map((_, i) => (i * 7919) % 256);
    await store.set('photo:p1', new Blob([bytes], { type: 'image/jpeg' }));
    const blob = await store.get<Blob>('photo:p1');
    expect(blob).toBeInstanceOf(Blob);
    expect(blob!.type).toBe('image/jpeg');
    expect(new Uint8Array(await blob!.arrayBuffer())).toEqual(bytes);

    // Replacing a Blob with plain data removes the binary file.
    await store.set('photo:p1', 'gone');
    expect(await store.get('photo:p1')).toBe('gone');
    expect([...files.files.keys()].some((p) => p.endsWith('.bin'))).toBe(false);
  });

  it('keeps the previous value when the app dies while writing', async () => {
    const files = new FakeFiles();
    const store = new FileStorage(files);
    await store.set('saves', [{ pictureId: 'lynx' }]);
    files.failOn = (op) => op === 'write';
    await expect(store.set('saves', [{ pictureId: 'new' }])).rejects.toThrow();
    expect(await store.get('saves')).toEqual([{ pictureId: 'lynx' }]);
  });

  it('recovers a finished write when the app died before the rename', async () => {
    const files = new FakeFiles();
    const store = new FileStorage(files);
    files.failOn = (op) => op === 'rename';
    await expect(store.set('saves', [{ pictureId: 'lynx' }])).rejects.toThrow();
    expect(await store.get('saves')).toEqual([{ pictureId: 'lynx' }]);
  });

  it('ignores a damaged file instead of failing', async () => {
    const files = new FakeFiles();
    const store = new FileStorage(files);
    files.files.set('store/settings.json', { data: '{"lang', binary: false });
    expect(await store.get('settings')).toBeUndefined();
  });

  it('works as the repository backend, surviving a "restart"', async () => {
    const files = new FakeFiles();
    const repo = new Repository(new FileStorage(files));
    await repo.recordCompletion('lynx', 24, 5000);
    const photo = await repo.addPhoto(new Blob(['jpeg'], { type: 'image/jpeg' }), 4, 3, 'thumb');

    // A new app start reads the same files.
    const again = new Repository(new FileStorage(files));
    expect((await again.loadStats()).lynx.best[24]).toBe(5000);
    expect((await again.listPhotos()).map((p) => p.id)).toEqual([photo.id]);
    expect(await (await again.photoBlob(photo.id))!.text()).toBe('jpeg');
  });
});
