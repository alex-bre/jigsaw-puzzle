import type { PuzzleState } from './model';

export const SAVE_VERSION = 1;

export interface PuzzleSaveV1 {
  version: 1;
  imageId: string;
  imageWidth: number;
  imageHeight: number;
  cols: number;
  rows: number;
  /** Seed of the cut; the piece shapes are regenerated from it. */
  seed: number;
  elapsedMs: number;
  /** Per piece (in id order): [x, y, groupId, locked ? 1 : 0]. */
  pieces: [number, number, number, 0 | 1][];
}

export type PuzzleSave = PuzzleSaveV1;

export function serializePuzzle(state: PuzzleState): PuzzleSave {
  return {
    version: SAVE_VERSION,
    imageId: state.imageId,
    imageWidth: state.imageWidth,
    imageHeight: state.imageHeight,
    cols: state.cols,
    rows: state.rows,
    seed: state.seed,
    elapsedMs: Math.round(state.elapsedMs),
    pieces: state.pieces.map((p) => [round2(p.x), round2(p.y), p.group, p.locked ? 1 : 0]),
  };
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Upgrades older save formats to the current one. Throws on unknown/invalid data. */
export function migrateSave(data: unknown): PuzzleSave {
  if (!data || typeof data !== 'object') throw new Error('Invalid save: not an object');
  const version = (data as { version?: unknown }).version;
  if (version === 1) return data as PuzzleSaveV1;
  throw new Error(`Unsupported save version: ${String(version)}`);
}

export function deserializePuzzle(data: unknown): PuzzleState {
  const save = migrateSave(data);
  const count = save.cols * save.rows;
  if (!Array.isArray(save.pieces) || save.pieces.length !== count) {
    throw new Error('Invalid save: piece count mismatch');
  }
  const pieceWidth = save.imageWidth / save.cols;
  const pieceHeight = save.imageHeight / save.rows;
  const groups = new Map<number, number[]>();
  const pieces = save.pieces.map(([x, y, group, locked], id) => {
    if (!Number.isInteger(group) || group < 0 || group >= count) {
      throw new Error(`Invalid save: bad group id for piece ${id}`);
    }
    const ids = groups.get(group) ?? [];
    ids.push(id);
    groups.set(group, ids);
    return {
      id,
      col: id % save.cols,
      row: Math.floor(id / save.cols),
      x,
      y,
      group,
      locked: locked === 1,
    };
  });
  return {
    imageId: save.imageId,
    imageWidth: save.imageWidth,
    imageHeight: save.imageHeight,
    cols: save.cols,
    rows: save.rows,
    seed: save.seed,
    pieceWidth,
    pieceHeight,
    pieces,
    groups,
    elapsedMs: save.elapsedMs,
  };
}
