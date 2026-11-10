/**
 * Builds the picture catalogue from content/images.json:
 *  - downloads each original once into .cache/images/ (not committed),
 *  - writes public/images/<id>.webp (max 2048 px) and public/images/thumbs/<id>.webp,
 *  - writes src/content/catalog.json (what the app and the Credits screen read).
 *
 * Only add pictures whose licence allows use in an app without restrictions
 * (CC0 / public domain); record author, licence and source page for each one.
 *
 * Run: npm run images
 */
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

interface Localized {
  en: string;
  de: string;
}

interface ManifestImage {
  id: string;
  category: string;
  title: Localized;
  /** Direct URL of the (possibly pre-scaled) original. */
  download: string;
  sourcePage: string;
  author: string;
  license: string;
  licenseUrl: string;
}

interface Manifest {
  categories: { id: string; title: Localized }[];
  images: ManifestImage[];
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, '.cache', 'images');
const OUT = join(ROOT, 'public', 'images');
const THUMBS = join(OUT, 'thumbs');
const CATALOG = join(ROOT, 'src', 'content', 'catalog.json');
const MAX_SIDE = 2048;
const THUMB = { width: 480, height: 360 };
const USER_AGENT = 'jigsaw-puzzle-build/0.1 (offline jigsaw app; image build script)';
const ALLOWED_LICENSES = /^(CC0|Public domain|PDM)/i;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function download(url: string, target: string): Promise<void> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (res.ok) {
      await writeFile(target, Buffer.from(await res.arrayBuffer()));
      return;
    }
    if (res.status !== 429 && res.status < 500) throw new Error(`${url}: HTTP ${res.status}`);
    const wait = Number(res.headers.get('retry-after')) * 1000 || 10_000 * (attempt + 1);
    console.warn(`  HTTP ${res.status}, retrying in ${wait / 1000}s`);
    await sleep(wait);
  }
  throw new Error(`${url}: giving up`);
}

function validate(manifest: Manifest): void {
  const ids = new Set<string>();
  const categories = new Set(manifest.categories.map((c) => c.id));
  for (const img of manifest.images) {
    if (!/^[a-z0-9-]+$/.test(img.id)) throw new Error(`Bad id "${img.id}" (use a-z, 0-9, -)`);
    if (ids.has(img.id)) throw new Error(`Duplicate id "${img.id}"`);
    ids.add(img.id);
    if (!categories.has(img.category))
      throw new Error(`${img.id}: unknown category ${img.category}`);
    if (!ALLOWED_LICENSES.test(img.license))
      throw new Error(`${img.id}: licence "${img.license}" not allowed`);
    for (const key of ['download', 'sourcePage', 'author', 'licenseUrl'] as const) {
      if (!img[key]) throw new Error(`${img.id}: missing ${key}`);
    }
  }
}

async function main(): Promise<void> {
  const manifest = JSON.parse(
    await readFile(join(ROOT, 'content', 'images.json'), 'utf8'),
  ) as Manifest;
  validate(manifest);
  await mkdir(CACHE, { recursive: true });
  await mkdir(THUMBS, { recursive: true });

  const images = [];
  for (const img of manifest.images) {
    const original = join(CACHE, `${img.id}.orig`);
    if (!existsSync(original)) {
      console.log(`↓ ${img.id}`);
      await download(img.download, original);
      await sleep(1000); // be polite to the image host
    }
    const out = join(OUT, `${img.id}.webp`);
    const info = await sharp(original)
      .rotate()
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(out);
    await sharp(original)
      .rotate()
      .resize({ ...THUMB, fit: 'cover' })
      .webp({ quality: 72 })
      .toFile(join(THUMBS, `${img.id}.webp`));
    console.log(`✓ ${img.id} ${info.width}×${info.height} ${(info.size / 1024).toFixed(0)} KB`);
    const { download: _download, ...rest } = img;
    images.push({ ...rest, width: info.width, height: info.height });
  }

  // Remove outputs of pictures that are no longer in the manifest.
  const keep = new Set(manifest.images.map((i) => `${i.id}.webp`));
  for (const dir of [OUT, THUMBS]) {
    for (const file of await readdir(dir)) {
      if (file.endsWith('.webp') && !keep.has(file)) await rm(join(dir, file));
    }
  }

  await writeFile(
    CATALOG,
    JSON.stringify({ categories: manifest.categories, images }, null, 2) + '\n',
  );
  console.log(`Wrote ${images.length} pictures to ${CATALOG}`);
}

await main();
