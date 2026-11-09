export interface PieceState {
  /** Index into PuzzleState.pieces; equals row * cols + col. */
  id: number;
  col: number;
  row: number;
  /** Position of the piece cell's top-left corner in board coordinates (image pixels). */
  x: number;
  y: number;
  /** Id of the group this piece belongs to. Pieces in one group always move together. */
  group: number;
  /** Locked pieces sit in their final place on the board and can no longer be moved. */
  locked: boolean;
}

export interface PuzzleConfig {
  imageId: string;
  imageWidth: number;
  imageHeight: number;
  cols: number;
  rows: number;
  seed: number;
}

export interface PuzzleState extends PuzzleConfig {
  pieceWidth: number;
  pieceHeight: number;
  pieces: PieceState[];
  /** group id → ids of member pieces. */
  groups: Map<number, number[]>;
  elapsedMs: number;
}

/** Creates a puzzle with every piece in its own group at its solved position. */
export function createPuzzle(config: PuzzleConfig): PuzzleState {
  const pieceWidth = config.imageWidth / config.cols;
  const pieceHeight = config.imageHeight / config.rows;
  const pieces: PieceState[] = [];
  const groups = new Map<number, number[]>();
  for (let row = 0; row < config.rows; row++) {
    for (let col = 0; col < config.cols; col++) {
      const id = row * config.cols + col;
      pieces.push({
        id,
        col,
        row,
        x: col * pieceWidth,
        y: row * pieceHeight,
        group: id,
        locked: false,
      });
      groups.set(id, [id]);
    }
  }
  return { ...config, pieceWidth, pieceHeight, pieces, groups, elapsedMs: 0 };
}

export function solvedPosition(state: PuzzleState, piece: PieceState): { x: number; y: number } {
  return { x: piece.col * state.pieceWidth, y: piece.row * state.pieceHeight };
}

export function groupPieces(state: PuzzleState, groupId: number): PieceState[] {
  const ids = state.groups.get(groupId);
  if (!ids) throw new Error(`Unknown group ${groupId}`);
  return ids.map((id) => state.pieces[id]);
}

export function isGroupLocked(state: PuzzleState, groupId: number): boolean {
  return state.pieces[state.groups.get(groupId)![0]].locked;
}

export function moveGroup(state: PuzzleState, groupId: number, dx: number, dy: number): void {
  for (const p of groupPieces(state, groupId)) {
    p.x += dx;
    p.y += dy;
  }
}

/** Merges group `b` into group `a` (or vice versa – the larger group survives). Returns the surviving id. */
export function mergeGroups(state: PuzzleState, a: number, b: number): number {
  if (a === b) return a;
  const ga = state.groups.get(a)!;
  const gb = state.groups.get(b)!;
  const [keep, drop, keepIds, dropIds] = ga.length >= gb.length ? [a, b, ga, gb] : [b, a, gb, ga];
  const locked = isGroupLocked(state, a) || isGroupLocked(state, b);
  for (const id of dropIds) {
    state.pieces[id].group = keep;
    keepIds.push(id);
  }
  state.groups.delete(drop);
  if (locked) for (const id of keepIds) state.pieces[id].locked = true;
  return keep;
}

export function lockGroup(state: PuzzleState, groupId: number): void {
  for (const p of groupPieces(state, groupId)) p.locked = true;
}

export function lockedCount(state: PuzzleState): number {
  let n = 0;
  for (const p of state.pieces) if (p.locked) n++;
  return n;
}

export function isComplete(state: PuzzleState): boolean {
  return state.pieces.every((p) => p.locked);
}

/** Ids of the (up to four) pieces that border the given piece in the solved image. */
export function neighbourIds(state: PuzzleState, piece: PieceState): number[] {
  const out: number[] = [];
  const { col, row } = piece;
  if (col > 0) out.push(piece.id - 1);
  if (col < state.cols - 1) out.push(piece.id + 1);
  if (row > 0) out.push(piece.id - state.cols);
  if (row < state.rows - 1) out.push(piece.id + state.cols);
  return out;
}
