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
