import {
  groupPieces,
  isGroupLocked,
  lockGroup,
  mergeGroups,
  moveGroup,
  neighbourIds,
  solvedPosition,
  type PuzzleState,
} from './model';

/** Distance (board units) under which two things count as exactly aligned. */
const ALIGN_EPSILON = 0.5;

export interface SnapCandidate {
  kind: 'board' | 'neighbour';
  /** Offset to apply to the dropped group. */
  dx: number;
  dy: number;
  distance: number;
}

export interface DropResult {
  /** Offset that was applied to the dropped group (0,0 if nothing snapped). */
  dx: number;
  dy: number;
  /** Id of the group after all merges. */
  groupId: number;
  snapped: boolean;
  /** True if the group (now) sits locked in its final place on the board. */
  locked: boolean;
  /** Number of other groups that were joined. */
  merged: number;
}

/** Finds the closest snap target for a group within `tolerance` (board units), or null. */
export function findSnap(
  state: PuzzleState,
  groupId: number,
  tolerance: number,
): SnapCandidate | null {
  let best: SnapCandidate | null = null;
  const consider = (kind: SnapCandidate['kind'], dx: number, dy: number) => {
    const distance = Math.hypot(dx, dy);
    if (distance > tolerance) return;
    // Prefer board snaps on (near) ties – they are the most satisfying.
    if (!best || distance < best.distance - (kind === 'board' ? -ALIGN_EPSILON : ALIGN_EPSILON)) {
      best = { kind, dx, dy, distance };
    }
  };

  const pieces = groupPieces(state, groupId);
  // All pieces in a group are consistently placed, so one piece decides the board snap.
  const first = pieces[0];
  const solved = solvedPosition(state, first);
  consider('board', solved.x - first.x, solved.y - first.y);

  for (const p of pieces) {
    for (const nid of neighbourIds(state, p)) {
      const q = state.pieces[nid];
      if (q.group === groupId) continue;
      const targetX = q.x + (p.col - q.col) * state.pieceWidth;
      const targetY = q.y + (p.row - q.row) * state.pieceHeight;
      consider('neighbour', targetX - p.x, targetY - p.y);
    }
  }
  return best;
}

/**
 * Merges every group that is now exactly aligned with `groupId` and locks the group
 * if it sits at its solved position. Repeats until nothing changes.
 */
function settle(state: PuzzleState, groupId: number): { groupId: number; merged: number } {
  let merged = 0;
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of groupPieces(state, groupId)) {
      for (const nid of neighbourIds(state, p)) {
        const q = state.pieces[nid];
        if (q.group === groupId) continue;
        const ex = q.x + (p.col - q.col) * state.pieceWidth - p.x;
        const ey = q.y + (p.row - q.row) * state.pieceHeight - p.y;
        if (Math.hypot(ex, ey) <= ALIGN_EPSILON) {
          // Locked pieces never move; align the loose group exactly with them.
          if (!isGroupLocked(state, groupId) && q.locked) moveGroup(state, groupId, ex, ey);
          else if (!q.locked) moveGroup(state, q.group, -ex, -ey);
          groupId = mergeGroups(state, groupId, q.group);
          merged++;
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }
  if (!isGroupLocked(state, groupId)) {
    const first = groupPieces(state, groupId)[0];
    const solved = solvedPosition(state, first);
    if (Math.hypot(solved.x - first.x, solved.y - first.y) <= ALIGN_EPSILON) {
      moveGroup(state, groupId, solved.x - first.x, solved.y - first.y);
      lockGroup(state, groupId);
    }
  }
  return { groupId, merged };
}

/** Call when the player releases a group: snaps it to the board or a neighbour if close enough. */
export function dropGroup(state: PuzzleState, groupId: number, tolerance: number): DropResult {
  if (isGroupLocked(state, groupId)) {
    return { dx: 0, dy: 0, groupId, snapped: false, locked: true, merged: 0 };
  }
  const snap = findSnap(state, groupId, tolerance);
  if (snap) moveGroup(state, groupId, snap.dx, snap.dy);
  const settled = settle(state, groupId);
  return {
    dx: snap?.dx ?? 0,
    dy: snap?.dy ?? 0,
    groupId: settled.groupId,
    snapped: snap !== null || settled.merged > 0,
    locked: isGroupLocked(state, settled.groupId),
    merged: settled.merged,
  };
}
