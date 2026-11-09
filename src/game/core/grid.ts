export interface GridSize {
  cols: number;
  rows: number;
}

/** Piece counts offered to the player. The actual count may differ slightly to keep pieces square. */
export const PIECE_COUNTS = [12, 24, 48, 96, 150, 240] as const;

/**
 * Choose a grid for roughly `pieceCount` pieces on an image of the given size,
 * so that the pieces come out as close to square as possible.
 */
export function chooseGrid(pieceCount: number, imageWidth: number, imageHeight: number): GridSize {
  const target = Math.max(2, Math.round(pieceCount));
  let best: GridSize = { cols: 2, rows: 1 };
  let bestScore = Infinity;
  for (let cols = 1; cols <= target; cols++) {
    for (const rows of [Math.floor(target / cols), Math.ceil(target / cols)]) {
      if (rows < 1 || cols * rows < 2) continue;
      const cellAspect = imageWidth / cols / (imageHeight / rows);
      const countError = Math.abs(cols * rows - target) / target;
      const shapeError = Math.abs(Math.log(cellAspect));
      const score = countError * 2 + shapeError;
      if (score < bestScore) {
        bestScore = score;
        best = { cols, rows };
      }
    }
  }
  return best;
}
