import { describe, expect, it } from 'vitest';
import { createRng } from '../src/game/core/rng';
import { chooseGrid, PIECE_COUNTS } from '../src/game/core/grid';
import { createCut, outlinePolygon, pieceOutline, polygonContains } from '../src/game/core/cut';
import {
  createPuzzle,
  isComplete,
  mergeGroups,
  moveGroup,
  type PuzzleState,
} from '../src/game/core/model';
import { dropGroup, findSnap } from '../src/game/core/snap';
import { computePlayArea, scatterPieces } from '../src/game/core/scatter';
import { deserializePuzzle, serializePuzzle } from '../src/game/core/serialize';

function puzzle(cols = 4, rows = 3): PuzzleState {
  return createPuzzle({
    imageId: 'test',
    imageWidth: cols * 100,
    imageHeight: rows * 100,
    cols,
    rows,
    seed: 42,
  });
}

describe('rng', () => {
  it('is deterministic per seed', () => {
    const a = createRng(123);
    const b = createRng(123);
    const c = createRng(124);
    const seqA = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(seqA);
    expect([c(), c(), c()]).not.toEqual(seqA);
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('chooseGrid', () => {
  it('gives near-square pieces close to the requested count', () => {
    for (const n of PIECE_COUNTS) {
      for (const [w, h] of [
        [1600, 1200],
        [1200, 1600],
        [2000, 1000],
        [1000, 1000],
      ]) {
        const { cols, rows } = chooseGrid(n, w, h);
        expect(Math.abs(cols * rows - n) / n).toBeLessThan(0.2);
        const aspect = w / cols / (h / rows);
        expect(aspect).toBeGreaterThan(0.7);
        expect(aspect).toBeLessThan(1.55);
      }
    }
  });

  it('picks 8x6 for 48 pieces on a 4:3 image', () => {
    expect(chooseGrid(48, 1600, 1200)).toEqual({ cols: 8, rows: 6 });
  });
});

describe('cut', () => {
  const cut = createCut(5, 4, 500, 400, 7);

  it('is deterministic per seed', () => {
    expect(createCut(5, 4, 500, 400, 7)).toEqual(cut);
    expect(createCut(5, 4, 500, 400, 8)).not.toEqual(cut);
  });

  it('neighbouring pieces share exactly the same edge curve', () => {
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const right = pieceOutline(cut, c, r)[1].map((p) => ({
          x: p.x + c * 100,
          y: p.y + r * 100,
        }));
        const left = pieceOutline(cut, c + 1, r)[3].map((p) => ({
          x: p.x + (c + 1) * 100,
          y: p.y + r * 100,
        }));
        const reversed = [...left].reverse();
        right.forEach((p, i) => {
          expect(p.x).toBeCloseTo(reversed[i].x, 9);
          expect(p.y).toBeCloseTo(reversed[i].y, 9);
        });
      }
    }
  });

  it('border edges are straight and inner edges have a tab or a blank', () => {
    const corner = pieceOutline(cut, 0, 0);
    expect(corner[0].every((p) => p.y === 0)).toBe(true); // top
    expect(corner[3].every((p) => p.x === 0)).toBe(true); // left
    expect(corner[1].some((p) => Math.abs(p.x - 100) > 10)).toBe(true); // right has a tab/blank
  });

  it('outline polygon contains the cell centre and not far-away points', () => {
    const poly = outlinePolygon(pieceOutline(cut, 2, 2));
    expect(polygonContains(poly, 50, 50)).toBe(true);
    expect(polygonContains(poly, -60, 50)).toBe(false);
    expect(polygonContains(poly, 50, 170)).toBe(false);
  });
});

describe('snapping', () => {
  it('locks a piece dropped near its solved position', () => {
    const s = puzzle();
    moveGroup(s, 5, 300, 300); // far away
    moveGroup(s, 5, -290, -295); // now 10/5 px off
    const res = dropGroup(s, 5, 20);
    expect(res.locked).toBe(true);
    expect(s.pieces[5].x).toBe(100);
    expect(s.pieces[5].y).toBe(100);
  });

  it('does not snap beyond the tolerance', () => {
    const s = puzzle();
    moveGroup(s, 5, 500, 500);
    expect(findSnap(s, 5, 20)).toBeNull();
    const res = dropGroup(s, 5, 20);
    expect(res.snapped).toBe(false);
    expect(s.pieces[5].x).toBe(600);
  });

  it('joins neighbouring loose pieces into a group away from the board', () => {
    const s = puzzle();
    for (const p of s.pieces) moveGroup(s, p.group, 1000 + p.id * 300, 1000);
    // Put piece 1 roughly right of piece 0.
    const p0 = s.pieces[0];
    moveGroup(s, 1, p0.x + 100 + 8 - s.pieces[1].x, p0.y - 6 - s.pieces[1].y);
    const res = dropGroup(s, 1, 20);
    expect(res.snapped).toBe(true);
    expect(res.locked).toBe(false);
    expect(s.pieces[0].group).toBe(s.pieces[1].group);
    expect(s.pieces[1].x - s.pieces[0].x).toBeCloseTo(100);
    expect(s.pieces[1].y - s.pieces[0].y).toBeCloseTo(0);
    // The group moves as one.
    moveGroup(s, s.pieces[0].group, 50, 50);
    expect(s.pieces[1].x - s.pieces[0].x).toBeCloseTo(100);
  });

  it('a group joining a locked piece becomes locked', () => {
    const s = puzzle();
    for (const p of s.pieces) moveGroup(s, p.group, 2000 + p.id * 300, 0);
    // Lock piece 0 at its place.
    moveGroup(s, 0, -s.pieces[0].x, -s.pieces[0].y);
    dropGroup(s, 0, 1);
    expect(s.pieces[0].locked).toBe(true);
    // Group pieces 1 and 2 together somewhere else.
    moveGroup(s, 2, s.pieces[1].x + 100 - s.pieces[2].x, s.pieces[1].y - s.pieces[2].y);
    const g = dropGroup(s, 2, 1).groupId;
    expect(s.pieces[1].group).toBe(s.pieces[2].group);
    // Drop the group near piece 0 → locks both.
    moveGroup(s, g, 100 + 5 - s.pieces[1].x, -4 - s.pieces[1].y);
    const res = dropGroup(s, g, 20);
    expect(res.locked).toBe(true);
    expect(s.pieces[1].locked && s.pieces[2].locked).toBe(true);
    expect(s.pieces[2].x).toBe(200);
  });

  it('cascades merges with groups that become exactly aligned', () => {
    const s = puzzle(3, 1);
    for (const p of s.pieces) moveGroup(s, p.group, 1000, 1000);
    // Pieces 0 and 2 stay aligned (only their solved spacing apart); piece 1 is away.
    moveGroup(s, 1, 500, 500);
    const res = dropGroup(s, 1, 30);
    expect(res.snapped).toBe(false);
    moveGroup(s, 1, -500 + 3, -500 + 2);
    const res2 = dropGroup(s, 1, 30);
    expect(res2.merged).toBe(2);
    expect(s.groups.size).toBe(1);
  });

  it('merging keeps groups consistent', () => {
    const s = puzzle();
    const id = mergeGroups(s, 0, 1);
    expect(s.groups.get(id)!.sort()).toEqual([0, 1]);
    expect(s.groups.size).toBe(11);
  });

  it('detects completion', () => {
    const s = puzzle(2, 2);
    for (const p of s.pieces) dropGroup(s, p.group, 1);
    expect(isComplete(s)).toBe(true);
  });
});

describe('scatter', () => {
  it('places all pieces inside the area and off the board', () => {
    for (const aspect of [0.5, 1, 1.8]) {
      const s = createPuzzle({
        imageId: 'x',
        imageWidth: 1600,
        imageHeight: 1200,
        cols: 8,
        rows: 6,
        seed: 1,
      });
      const area = computePlayArea(s, aspect);
      scatterPieces(s, area, 99);
      for (const p of s.pieces) {
        expect(p.x).toBeGreaterThanOrEqual(area.x);
        expect(p.y).toBeGreaterThanOrEqual(area.y);
        expect(p.x + s.pieceWidth).toBeLessThanOrEqual(area.x + area.width);
        expect(p.y + s.pieceHeight).toBeLessThanOrEqual(area.y + area.height);
        const onBoard =
          p.x + s.pieceWidth > 0 && p.x < 1600 && p.y + s.pieceHeight > 0 && p.y < 1200;
        expect(onBoard).toBe(false);
      }
    }
  });
});

describe('serialization', () => {
  it('round-trips the puzzle state', () => {
    const s = puzzle();
    scatterPieces(s, computePlayArea(s, 1), 5);
    mergeGroups(s, 0, 1);
    s.pieces[11].x = 300;
    s.pieces[11].y = 200;
    dropGroup(s, 11, 1);
    s.elapsedMs = 12345;
    const json = JSON.parse(JSON.stringify(serializePuzzle(s)));
    const r = deserializePuzzle(json);
    expect(r.groups).toEqual(s.groups);
    expect(r.elapsedMs).toBe(12345);
    r.pieces.forEach((p, i) => {
      expect(p.x).toBeCloseTo(s.pieces[i].x, 1);
      expect(p.locked).toBe(s.pieces[i].locked);
      expect(p.group).toBe(s.pieces[i].group);
    });
  });

  it('rejects invalid or unknown data', () => {
    expect(() => deserializePuzzle(null)).toThrow();
    expect(() => deserializePuzzle({ version: 99 })).toThrow();
    const save = serializePuzzle(puzzle());
    save.pieces.pop();
    expect(() => deserializePuzzle(save)).toThrow();
  });
});
