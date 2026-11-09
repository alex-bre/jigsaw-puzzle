import type { PuzzleState } from './model';
import { createRng } from './rng';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Computes the play area around the board (which spans (0,0) – (imageWidth, imageHeight)):
 * large enough to lay out all loose pieces next to the board, shaped to match the
 * screen aspect ratio (width / height) where possible.
 */
export function computePlayArea(state: PuzzleState, screenAspect: number): Rect {
  const bw = state.imageWidth;
  const bh = state.imageHeight;
  const cell = Math.max(state.pieceWidth, state.pieceHeight);
  // Room each loose piece gets, including its tabs and some breathing space.
  const footprint = (cell * 1.45) ** 2;
  const needed = bw * bh + state.pieces.length * footprint * 1.15;
  const minW = bw + 2 * cell * 1.2;
  const minH = bh + 2 * cell * 1.2;

  let width = Math.sqrt(needed * screenAspect);
  let height = needed / width;
  if (width < minW) {
    width = minW;
    height = Math.max(minH, needed / width);
  }
  if (height < minH) {
    height = minH;
    width = Math.max(minW, needed / height);
  }
  return { x: (bw - width) / 2, y: (bh - height) / 2, width, height };
}

/**
 * Places all pieces at random, non-overlapping-as-far-as-possible positions inside `area`
 * but outside the board. Uses best-candidate sampling for an even spread.
 */
export function scatterPieces(state: PuzzleState, area: Rect, seed: number): void {
  const rng = createRng(seed ^ 0x9e3779b9);
  const pw = state.pieceWidth;
  const ph = state.pieceHeight;
  const tab = Math.max(pw, ph) * 0.3;
  // Piece cell positions (top-left) must keep the whole piece, tabs included, in the area.
  const minX = area.x + tab;
  const maxX = area.x + area.width - pw - tab;
  const minY = area.y + tab;
  const maxY = area.y + area.height - ph - tab;
  const gap = tab * 0.5;
  const overlapsBoard = (x: number, y: number) =>
    x + pw + gap > 0 &&
    x - gap < state.imageWidth &&
    y + ph + gap > 0 &&
    y - gap < state.imageHeight;

  const order = state.pieces.map((p) => p.id);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  const placed: { x: number; y: number }[] = [];
  for (const id of order) {
    let best: { x: number; y: number } | null = null;
    let bestDist = -1;
    let candidates = 0;
    for (let attempt = 0; attempt < 400 && candidates < 14; attempt++) {
      const x = minX + rng() * Math.max(0, maxX - minX);
      const y = minY + rng() * Math.max(0, maxY - minY);
      if (overlapsBoard(x, y)) continue;
      candidates++;
      let d = Infinity;
      for (const p of placed) d = Math.min(d, (p.x - x) ** 2 + (p.y - y) ** 2);
      if (d > bestDist) {
        bestDist = d;
        best = { x, y };
      }
    }
    // Fallback if the area is too cramped: anywhere in the area.
    best ??= {
      x: minX + rng() * Math.max(0, maxX - minX),
      y: minY + rng() * Math.max(0, maxY - minY),
    };
    placed.push(best);
    const piece = state.pieces[id];
    piece.x = best.x;
    piece.y = best.y;
  }
}
