import type { PuzzleState } from './model';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The area around the board (which spans (0,0) – (imageWidth, imageHeight)) where loose pieces
 * may lie. It is square-ish so it works in portrait and landscape alike.
 */
export function computePlayArea(state: PuzzleState): Rect {
  const bw = state.imageWidth;
  const bh = state.imageHeight;
  const cell = Math.max(state.pieceWidth, state.pieceHeight);
  const margin = Math.max(cell * 1.8, Math.max(bw, bh) * 0.3);
  const side = Math.max(bw, bh) + 2 * margin;
  return { x: (bw - side) / 2, y: (bh - side) / 2, width: side, height: side };
}

/** Bounds of the board plus all pieces lying around on it (tabs included). */
export function contentBounds(state: PuzzleState): Rect {
  const tab = Math.min(state.pieceWidth, state.pieceHeight) * 0.3;
  let x0 = 0;
  let y0 = 0;
  let x1 = state.imageWidth;
  let y1 = state.imageHeight;
  for (const p of state.pieces) {
    if (p.inTray || p.locked) continue;
    x0 = Math.min(x0, p.x - tab);
    y0 = Math.min(y0, p.y - tab);
    x1 = Math.max(x1, p.x + state.pieceWidth + tab);
    y1 = Math.max(y1, p.y + state.pieceHeight + tab);
  }
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}
