import { CanvasSource, Rectangle, Texture } from 'pixi.js';
import { outlinePolygon, pieceOutline, TAB_EXTENT, traceOutline, type Cut } from '../core/cut';

export interface PieceGraphics {
  /** Texture per piece (index = piece id). Covers the cell plus `pad` on every side. */
  pieces: Texture[];
  /** Blurred silhouette per piece, rendered at `shadowScale` resolution. */
  shadows: Texture[];
  shadowScale: number;
  /** Margin around the cell inside each texture, in image pixels. */
  pad: number;
  /** Hit-test polygon per piece in piece-local coordinates (cell top-left = 0,0). */
  polygons: number[][];
  destroy(): void;
}

export type SourceImage = CanvasImageSource & { width: number; height: number };

/** Atlas page size. 2048 is safe on practically every Android GPU. */
const PAGE_SIZE = 2048;
const SHADOW_SCALE = 0.5;

/**
 * Cuts the image into piece textures. Each piece is drawn exactly once (clipped image + bevel)
 * into a few shared atlas pages, so at runtime every piece is a plain sprite and Pixi can
 * batch the whole puzzle into very few draw calls.
 */
export function buildPieceGraphics(image: SourceImage, cut: Cut): PieceGraphics {
  const w = cut.pieceWidth;
  const h = cut.pieceHeight;
  const minSide = Math.min(w, h);
  const blur = Math.max(2, minSide * 0.05);
  const pad = Math.ceil(minSide * TAB_EXTENT + blur + 3);
  const cellW = Math.ceil(w + 2 * pad);
  const cellH = Math.ceil(h + 2 * pad);
  const count = cut.cols * cut.rows;

  const pieceAtlas = new AtlasBuilder(cellW, cellH, count, 1);
  const shadowAtlas = new AtlasBuilder(cellW, cellH, count, SHADOW_SCALE);

  const bevel = Math.max(1.2, minSide * 0.022);
  const polygons: number[][] = [];

  for (let row = 0; row < cut.rows; row++) {
    for (let col = 0; col < cut.cols; col++) {
      const id = row * cut.cols + col;
      const outline = pieceOutline(cut, col, row);
      polygons.push(outlinePolygon(outline));

      // --- Piece ---
      {
        const { ctx, x, y } = pieceAtlas.slot(id);
        ctx.save();
        ctx.translate(x + pad, y + pad); // origin = cell top-left
        const path = new Path2D();
        traceOutline(path, outline);
        ctx.save();
        ctx.clip(path);
        drawImageRegion(ctx, image, col * w - pad, row * h - pad, cellW, cellH, -pad, -pad);
        // Bevel: light inner edge top-left, dark inner edge bottom-right.
        ctx.lineWidth = bevel * 2;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(255,255,255,0.42)';
        ctx.stroke(shifted(outline, bevel * 0.9, bevel * 0.9));
        ctx.strokeStyle = 'rgba(0,0,0,0.38)';
        ctx.stroke(shifted(outline, -bevel * 0.9, -bevel * 0.9));
        ctx.restore();
        // Thin outline so pieces stay distinguishable on similar colours.
        ctx.lineWidth = Math.max(0.8, minSide * 0.006);
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.stroke(path);
        ctx.restore();
      }

      // --- Shadow silhouette (drawn off-slot, only its blurred shadow lands in the slot) ---
      {
        const { ctx, x, y } = shadowAtlas.slot(id);
        const s = SHADOW_SCALE;
        const far = 100000;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, cellW * s, cellH * s);
        ctx.clip();
        ctx.shadowColor = 'rgba(0,0,0,1)';
        ctx.shadowBlur = blur * s;
        ctx.shadowOffsetX = far;
        ctx.translate(x + pad * s - far, y + pad * s);
        ctx.scale(s, s);
        const path = new Path2D();
        traceOutline(path, outline);
        ctx.fillStyle = '#000';
        ctx.fill(path);
        ctx.restore();
      }
    }
  }

  const pieces = pieceAtlas.finish();
  const shadows = shadowAtlas.finish();
  return {
    pieces: pieces.textures,
    shadows: shadows.textures,
    shadowScale: SHADOW_SCALE,
    pad,
    polygons,
    destroy() {
      pieces.destroy();
      shadows.destroy();
    },
  };
}

function shifted(outline: ReturnType<typeof pieceOutline>, dx: number, dy: number): Path2D {
  const p = new Path2D();
  traceOutline(p, outline, dx, dy);
  return p;
}

/** drawImage with a source rect that may extend outside the image (clamped consistently). */
function drawImageRegion(
  ctx: CanvasRenderingContext2D,
  image: SourceImage,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dx: number,
  dy: number,
): void {
  const x0 = Math.max(0, sx);
  const y0 = Math.max(0, sy);
  const x1 = Math.min(image.width, sx + sw);
  const y1 = Math.min(image.height, sy + sh);
  if (x1 <= x0 || y1 <= y0) return;
  ctx.drawImage(image, x0, y0, x1 - x0, y1 - y0, dx + (x0 - sx), dy + (y0 - sy), x1 - x0, y1 - y0);
}

/** Lays out equally sized cells on as few canvas pages as needed. */
class AtlasBuilder {
  private readonly pages: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }[] = [];
  private readonly frames: { page: number; x: number; y: number }[] = [];
  private readonly cw: number;
  private readonly ch: number;
  private readonly perRow: number;
  private readonly perPage: number;

  constructor(
    cellW: number,
    cellH: number,
    private readonly count: number,
    scale: number,
  ) {
    // 1px gutter avoids bleeding between neighbours with linear filtering / mipmaps.
    this.cw = Math.ceil(cellW * scale) + 2;
    this.ch = Math.ceil(cellH * scale) + 2;
    this.perRow = Math.max(1, Math.floor(PAGE_SIZE / this.cw));
    const perCol = Math.max(1, Math.floor(PAGE_SIZE / this.ch));
    this.perPage = this.perRow * perCol;
    const pageCount = Math.ceil(count / this.perPage);
    for (let p = 0; p < pageCount; p++) {
      const inPage = Math.min(this.perPage, count - p * this.perPage);
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(inPage, this.perRow) * this.cw;
      canvas.height = Math.ceil(inPage / this.perRow) * this.ch;
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingQuality = 'high';
      this.pages.push({ canvas, ctx });
    }
  }

  slot(index: number): { ctx: CanvasRenderingContext2D; x: number; y: number } {
    const page = Math.floor(index / this.perPage);
    const i = index % this.perPage;
    const x = (i % this.perRow) * this.cw + 1;
    const y = Math.floor(i / this.perRow) * this.ch + 1;
    this.frames[index] = { page, x, y };
    return { ctx: this.pages[page].ctx, x, y };
  }

  finish(): { textures: Texture[]; destroy(): void } {
    const sources = this.pages.map(
      ({ canvas }) =>
        new CanvasSource({
          resource: canvas,
          autoGenerateMipmaps: true,
          scaleMode: 'linear',
        }),
    );
    const w = this.cw - 2;
    const h = this.ch - 2;
    const textures = Array.from({ length: this.count }, (_, i) => {
      const f = this.frames[i];
      return new Texture({ source: sources[f.page], frame: new Rectangle(f.x, f.y, w, h) });
    });
    return {
      textures,
      destroy: () => {
        for (const t of textures) t.destroy(false);
        for (const s of sources) s.destroy();
        for (const p of this.pages) p.canvas.width = p.canvas.height = 0;
      },
    };
  }
}

/**
 * Average colour of every grid cell as [r, g, b], by letting the browser downscale the image to
 * cols×rows. Reading pixels back forces pending canvas work to finish, so call this lazily.
 */
export function averageColors(
  image: SourceImage,
  cols: number,
  rows: number,
): [number, number, number][] {
  // Downscale in two steps; a single huge downscale can skip pixels in some browsers.
  const mid = document.createElement('canvas');
  mid.width = cols * 8;
  mid.height = rows * 8;
  const midCtx = mid.getContext('2d')!;
  midCtx.imageSmoothingQuality = 'high';
  midCtx.drawImage(image, 0, 0, mid.width, mid.height);
  const small = document.createElement('canvas');
  small.width = cols;
  small.height = rows;
  const ctx = small.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(mid, 0, 0, cols, rows);
  const data = ctx.getImageData(0, 0, cols, rows).data;
  const out: [number, number, number][] = [];
  for (let i = 0; i < cols * rows; i++) out.push([data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]);
  return out;
}
