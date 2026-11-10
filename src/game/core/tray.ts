import type { PieceState, PuzzleState } from './model';
import { createRng } from './rng';

/** True for pieces on the outer border of the picture. */
export function isEdgePiece(state: PuzzleState, p: PieceState): boolean {
  return p.col === 0 || p.row === 0 || p.col === state.cols - 1 || p.row === state.rows - 1;
}

/** Puts every loose single piece into the tray, in random order. */
export function fillTray(state: PuzzleState, seed: number): void {
  const rng = createRng(seed ^ 0x5bd1e995);
  const ids = state.pieces
    .filter((p) => !p.locked && state.groups.get(p.group)!.length === 1)
    .map((p) => p.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  for (const id of ids) state.pieces[id].inTray = true;
  state.tray = ids;
}

/** Takes a piece out of the tray and places its cell's top-left corner at (x, y). */
export function takeFromTray(state: PuzzleState, id: number, x: number, y: number): void {
  const index = state.tray.indexOf(id);
  if (index < 0) throw new Error(`Piece ${id} is not in the tray`);
  state.tray.splice(index, 1);
  const p = state.pieces[id];
  p.inTray = false;
  p.x = x;
  p.y = y;
}

/** Only single, loose pieces can go back into the tray. */
export function canReturnToTray(state: PuzzleState, id: number): boolean {
  const p = state.pieces[id];
  return !p.locked && !p.inTray && state.groups.get(p.group)!.length === 1;
}

/** Puts a piece back into the tray, before piece `beforeId` (or at the end if null). */
export function returnToTray(state: PuzzleState, id: number, beforeId: number | null): void {
  if (!canReturnToTray(state, id)) throw new Error(`Piece ${id} cannot go back into the tray`);
  const index = beforeId === null ? -1 : state.tray.indexOf(beforeId);
  if (index < 0) state.tray.push(id);
  else state.tray.splice(index, 0, id);
  state.pieces[id].inTray = true;
}

/** The tray pieces that are currently shown, optionally only edge pieces. */
export function visibleTray(state: PuzzleState, edgesOnly: boolean): number[] {
  return edgesOnly
    ? state.tray.filter((id) => isEdgePiece(state, state.pieces[id]))
    : [...state.tray];
}

/** Sorts the tray: edge pieces first, then by colour (`colorKeys` indexed by piece id). */
export function sortTray(state: PuzzleState, colorKeys: readonly number[]): void {
  state.tray.sort((a, b) => {
    const ea = isEdgePiece(state, state.pieces[a]) ? 0 : 1;
    const eb = isEdgePiece(state, state.pieces[b]) ? 0 : 1;
    return ea - eb || colorKeys[a] - colorKeys[b] || a - b;
  });
}

/**
 * Sort key that groups similar colours: twelve hue families in rainbow order (each sorted
 * dark → light), followed by greys / near-black / near-white sorted by lightness.
 */
export function colorSortKey(r: number, g: number, b: number): number {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (s < 0.18 || l < 0.1 || l > 0.92) return 1200 + l * 99;
  let hue: number;
  if (max === rn) hue = 60 * (((gn - bn) / d + 6) % 6);
  else if (max === gn) hue = 60 * ((bn - rn) / d + 2);
  else hue = 60 * ((rn - gn) / d + 4);
  const family = Math.floor(((hue + 15) % 360) / 30);
  return family * 100 + l * 99;
}
