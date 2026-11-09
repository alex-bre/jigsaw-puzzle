import { createRng, range } from './rng';

export interface Point {
  x: number;
  y: number;
}

/** Shape parameters of one inner edge (a tab on one side, a blank on the other). */
export interface EdgeShape {
  /** Which side the tab bulges to: +1 = along the edge normal, -1 = opposite. */
  flip: 1 | -1;
  /** Tab size relative to the edge length. */
  t: number;
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
}

/**
 * Describes how an image is cut into pieces. All geometry is in image pixels;
 * the solved puzzle occupies (0,0) – (cols*pieceWidth, rows*pieceHeight).
 */
export interface Cut {
  cols: number;
  rows: number;
  pieceWidth: number;
  pieceHeight: number;
  /** horizontal[r][c]: edge between row r and r+1, below column c. */
  horizontal: EdgeShape[][];
  /** vertical[r][c]: edge between column c and c+1, in row r. */
  vertical: EdgeShape[][];
}

/**
 * An edge is a chain of three cubic Bézier curves, stored as 10 points:
 * p0, (c1, c2, p3), (c4, c5, p6), (c7, c8, p9).
 */
export type EdgePoints = Point[];

/** Four edges of a piece outline in clockwise order (top, right, bottom, left). */
export type Outline = [EdgePoints, EdgePoints, EdgePoints, EdgePoints];

const TAB_SIZE = 0.1;
const JITTER = 0.04;

/**
 * How far a tab can stick out beyond the piece cell, relative to min(pieceWidth, pieceHeight).
 * The max bulge with TAB_SIZE + jitter is ~0.3; a little extra for safety.
 */
export const TAB_EXTENT = 0.33;

function randomEdge(rng: () => number): EdgeShape {
  return {
    flip: rng() < 0.5 ? 1 : -1,
    t: range(rng, TAB_SIZE * 0.9, TAB_SIZE * 1.1),
    a: range(rng, -JITTER, JITTER),
    b: range(rng, -JITTER, JITTER),
    c: range(rng, -JITTER, JITTER),
    d: range(rng, -JITTER, JITTER),
    e: range(rng, -JITTER, JITTER),
  };
}

export function createCut(
  cols: number,
  rows: number,
  imageWidth: number,
  imageHeight: number,
  seed: number,
): Cut {
  const rng = createRng(seed);
  const horizontal: EdgeShape[][] = [];
  for (let r = 0; r < rows - 1; r++) {
    horizontal.push(Array.from({ length: cols }, () => randomEdge(rng)));
  }
  const vertical: EdgeShape[][] = [];
  for (let r = 0; r < rows; r++) {
    vertical.push(Array.from({ length: cols - 1 }, () => randomEdge(rng)));
  }
  return {
    cols,
    rows,
    pieceWidth: imageWidth / cols,
    pieceHeight: imageHeight / rows,
    horizontal,
    vertical,
  };
}

/**
 * Builds the 10 control points of an edge from `from` to `to`. A null shape gives a straight edge.
 * `depth` scales how far the tab bulges (defaults to the edge length).
 */
export function edgePoints(
  from: Point,
  to: Point,
  shape: EdgeShape | null,
  depth?: number,
): EdgePoints {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (!shape) {
    return Array.from({ length: 10 }, (_, i) => ({
      x: from.x + (dx * i) / 9,
      y: from.y + (dy * i) / 9,
    }));
  }
  // Normal (rotated 90° clockwise in screen coords), scaled to `depth`.
  const len = Math.hypot(dx, dy) || 1;
  const scale = ((depth ?? len) / len) * shape.flip;
  const nx = -dy * scale;
  const ny = dx * scale;
  const p = (u: number, v: number): Point => ({
    x: from.x + dx * u + nx * v,
    y: from.y + dy * u + ny * v,
  });
  const { t, a, b, c, d, e } = shape;
  return [
    p(0, 0),
    p(0.2, a),
    p(0.5 + b + d, -t + c),
    p(0.5 - t + b, t + c),
    p(0.5 - 2 * t + b - d, 3 * t + c),
    p(0.5 + 2 * t + b - d, 3 * t + c),
    p(0.5 + t + b, t + c),
    p(0.5 + b + d, -t + c),
    p(0.8, e),
    p(1, 0),
  ];
}

/**
 * Outline of piece (col,row) in piece-local coordinates: (0,0) is the top-left corner
 * of the piece's cell, the cell spans (pieceWidth, pieceHeight). Tabs may extend outside.
 */
export function pieceOutline(cut: Cut, col: number, row: number): Outline {
  const w = cut.pieceWidth;
  const h = cut.pieceHeight;
  const ox = col * w;
  const oy = row * h;
  const corner = (c: number, r: number): Point => ({ x: c * w - ox, y: r * h - oy });
  // Tab depth follows the shorter side so tabs never eat too deep into non-square pieces.
  const depth = Math.min(w, h);

  const topShape = row > 0 ? cut.horizontal[row - 1][col] : null;
  const bottomShape = row < cut.rows - 1 ? cut.horizontal[row][col] : null;
  const leftShape = col > 0 ? cut.vertical[row][col - 1] : null;
  const rightShape = col < cut.cols - 1 ? cut.vertical[row][col] : null;

  // Edges are always generated in their canonical direction (left→right, top→bottom),
  // so both neighbouring pieces get the exact same curve; then reversed where needed.
  const top = edgePoints(corner(col, row), corner(col + 1, row), topShape, depth);
  const right = edgePoints(corner(col + 1, row), corner(col + 1, row + 1), rightShape, depth);
  const bottom = edgePoints(
    corner(col, row + 1),
    corner(col + 1, row + 1),
    bottomShape,
    depth,
  ).reverse();
  const left = edgePoints(corner(col, row), corner(col, row + 1), leftShape, depth).reverse();
  return [top, right, bottom, left];
}

function cubic(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

function isStraight(edge: EdgePoints): boolean {
  const [p0, p9] = [edge[0], edge[9]];
  const dx = p9.x - p0.x;
  const dy = p9.y - p0.y;
  const len = Math.hypot(dx, dy) || 1;
  return edge.every((p) => Math.abs((p.x - p0.x) * dy - (p.y - p0.y) * dx) / len < 1e-6);
}

/** Flattens an outline into a closed polygon (flat [x0,y0,x1,y1,...] array), e.g. for hit testing. */
export function outlinePolygon(outline: Outline, samplesPerCurve = 6): number[] {
  const out: number[] = [];
  for (const edge of outline) {
    out.push(edge[0].x, edge[0].y);
    if (isStraight(edge)) continue;
    for (let seg = 0; seg < 3; seg++) {
      const [p0, p1, p2, p3] = [
        edge[seg * 3],
        edge[seg * 3 + 1],
        edge[seg * 3 + 2],
        edge[seg * 3 + 3],
      ];
      for (let i = 1; i <= samplesPerCurve; i++) {
        // Skip the last point of the last curve; it is the next edge's first point.
        if (seg === 2 && i === samplesPerCurve) break;
        const p = cubic(p0, p1, p2, p3, i / samplesPerCurve);
        out.push(p.x, p.y);
      }
    }
  }
  return out;
}

/** Minimal subset of CanvasRenderingContext2D / Path2D used to trace an outline. */
export interface PathSink {
  moveTo(x: number, y: number): void;
  bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): void;
  closePath(): void;
}

export function traceOutline(sink: PathSink, outline: Outline, dx = 0, dy = 0): void {
  sink.moveTo(outline[0][0].x + dx, outline[0][0].y + dy);
  for (const edge of outline) {
    for (let seg = 0; seg < 3; seg++) {
      const c1 = edge[seg * 3 + 1];
      const c2 = edge[seg * 3 + 2];
      const p = edge[seg * 3 + 3];
      sink.bezierCurveTo(c1.x + dx, c1.y + dy, c2.x + dx, c2.y + dy, p.x + dx, p.y + dy);
    }
  }
  sink.closePath();
}

/** Point-in-polygon test (even-odd rule) for a flat polygon array. */
export function polygonContains(poly: number[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
    const xi = poly[i];
    const yi = poly[i + 1];
    const xj = poly[j];
    const yj = poly[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
