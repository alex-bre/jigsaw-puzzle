/**
 * Draws the app icon and splash screen sources into assets/ (a cream puzzle piece on the felt
 * background). `npm run android:icons` then turns them into all Android sizes with
 * @capacitor/assets.
 *
 * Run: npm run android:icons
 */
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'assets');

const FELT = '#35514a';
const FELT_LIGHT = '#43665d';

/** One classic piece (two tabs, one blank) in a 120×120 box, centred. */
const PIECE =
  'M30 35H50C50 28 45 26 45 20C45 13 52 9 60 9C68 9 75 13 75 20C75 26 70 28 70 35H90V55' +
  'C97 55 99 50 105 50C112 50 116 57 116 65C116 73 112 80 105 80C99 80 97 75 90 75V95H30V75' +
  'C37 75 39 80 45 80C52 80 56 73 56 65C56 57 52 50 45 50C39 50 37 55 30 55Z';

function pieceSvg(size: number, scale: number): string {
  // Piece bounds are x 30–116, y 9–95; move its centre (73, 52) to the middle.
  const s = (size / 120) * scale;
  const offset = size / 2;
  return `
    <defs>
      <linearGradient id="face" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#fbf0d9"/>
        <stop offset="1" stop-color="#ead2a4"/>
      </linearGradient>
      <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="2.5" stdDeviation="2.5" flood-color="#000" flood-opacity="0.35"/>
      </filter>
    </defs>
    <g transform="translate(${offset} ${offset}) scale(${s}) rotate(-8) translate(-73 -52)">
      <path d="${PIECE}" fill="url(#face)" stroke="#b98d4f" stroke-width="2.2"
            stroke-linejoin="round" filter="url(#shadow)"/>
    </g>`;
}

function svg(size: number, body: string): Buffer {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`,
  );
}

function background(size: number): string {
  return `
    <defs>
      <radialGradient id="bg" cx="0.5" cy="0.4" r="0.75">
        <stop offset="0" stop-color="${FELT_LIGHT}"/>
        <stop offset="1" stop-color="${FELT}"/>
      </radialGradient>
    </defs>
    <rect width="${size}" height="${size}" fill="url(#bg)"/>`;
}

async function png(name: string, image: Buffer): Promise<void> {
  await sharp(image).png().toFile(join(out, name));
  console.log(`assets/${name}`);
}

await mkdir(out, { recursive: true });
// Legacy icon (Android < 8): full square artwork.
await png('icon-only.png', svg(1024, background(1024) + pieceSvg(1024, 0.95)));
// Adaptive icon: the launcher crops to a circle/squircle of ~66 % – keep the piece inside it.
await png('icon-foreground.png', svg(1024, pieceSvg(1024, 0.62)));
await png('icon-background.png', svg(1024, background(1024)));
// Splash: small piece in the middle of the felt (the same in light and dark mode).
const splash = svg(2732, background(2732) + pieceSvg(2732, 0.28));
await png('splash.png', splash);
await png('splash-dark.png', splash);
