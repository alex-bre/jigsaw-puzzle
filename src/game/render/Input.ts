import type { Camera } from './Camera';

/** Callbacks into the game. All coordinates are screen (canvas CSS pixel) coordinates. */
export interface InputHandlers {
  /** Any pointer went down (used e.g. to unlock audio on the first touch). */
  activity(): void;
  inTray(sx: number, sy: number): boolean;
  trayPieceAt(sx: number, sy: number): number | null;
  trayAxis(): 'x' | 'y';
  trayScroll(delta: number): void;
  trayFling(velocity: number): void;
  trayStop(): void;
  /** Start dragging a piece out of the tray. */
  pickFromTray(id: number, sx: number, sy: number): void;
  /** Start dragging the piece on the board at this point; false if there is none. */
  pickFromBoard(sx: number, sy: number): boolean;
  dragMove(sx: number, sy: number): void;
  dragEnd(sx: number, sy: number): void;
}

interface Pointer {
  x: number;
  y: number;
}

/** Movement (px) before a touch in the tray counts as a scroll or a pick-up. */
const TRAY_SLOP = 8;
/** Holding a tray piece this long without moving picks it up. */
const LONG_PRESS_MS = 320;

type Mode =
  | { kind: 'idle' }
  | { kind: 'drag'; pointerId: number }
  | { kind: 'pan'; pointerId: number }
  | { kind: 'pinch'; startDist: number; startScale: number; anchorX: number; anchorY: number }
  | {
      kind: 'tray-pending';
      pointerId: number;
      startX: number;
      startY: number;
      pieceId: number | null;
      timer: number;
    }
  | { kind: 'tray-scroll'; pointerId: number; samples: { t: number; pos: number }[] };

/**
 * Pointer handling on the canvas.
 * Board: one finger on a piece drags it, on empty space pans; two fingers pinch-zoom.
 * Tray: swiping along the tray scrolls it; pulling a piece out of the tray (or holding it)
 * picks it up. Mouse wheel zooms the board or scrolls the tray.
 */
export class Input {
  private readonly pointers = new Map<number, Pointer>();
  private mode: Mode = { kind: 'idle' };

  constructor(
    private readonly el: HTMLElement,
    private readonly camera: Camera,
    private readonly handlers: InputHandlers,
  ) {
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointercancel', this.onUp);
    el.addEventListener('lostpointercapture', this.onUp);
    el.addEventListener('wheel', this.onWheel, { passive: false });
    el.addEventListener('contextmenu', preventDefault);
  }

  destroy(): void {
    this.cancelTimer();
    this.el.removeEventListener('pointerdown', this.onDown);
    this.el.removeEventListener('pointermove', this.onMove);
    this.el.removeEventListener('pointerup', this.onUp);
    this.el.removeEventListener('pointercancel', this.onUp);
    this.el.removeEventListener('lostpointercapture', this.onUp);
    this.el.removeEventListener('wheel', this.onWheel);
    this.el.removeEventListener('contextmenu', preventDefault);
  }

  private local(e: PointerEvent | WheelEvent): Pointer {
    const r = this.el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private cancelTimer(): void {
    if (this.mode.kind === 'tray-pending') clearTimeout(this.mode.timer);
  }

  private onDown = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    this.handlers.activity();
    const p = this.local(e);
    this.pointers.set(e.pointerId, p);
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {
      /* not critical */
    }

    const busy = this.mode.kind === 'drag' || this.mode.kind.startsWith('tray');
    if (busy) return; // ignore extra fingers while dragging a piece or using the tray
    if (this.pointers.size === 1) {
      if (this.handlers.inTray(p.x, p.y)) {
        this.handlers.trayStop();
        const pieceId = this.handlers.trayPieceAt(p.x, p.y);
        const pointerId = e.pointerId;
        const timer = window.setTimeout(() => {
          if (
            this.mode.kind === 'tray-pending' &&
            this.mode.pointerId === pointerId &&
            pieceId !== null
          ) {
            const cur = this.pointers.get(pointerId) ?? p;
            this.startTrayDrag(pointerId, pieceId, cur.x, cur.y);
          }
        }, LONG_PRESS_MS);
        this.mode = { kind: 'tray-pending', pointerId, startX: p.x, startY: p.y, pieceId, timer };
      } else if (this.handlers.pickFromBoard(p.x, p.y)) {
        this.mode = { kind: 'drag', pointerId: e.pointerId };
      } else {
        this.mode = { kind: 'pan', pointerId: e.pointerId };
      }
    } else if (this.pointers.size === 2) {
      this.startPinch();
    }
  };

  private startTrayDrag(pointerId: number, pieceId: number, sx: number, sy: number): void {
    this.cancelTimer();
    this.mode = { kind: 'drag', pointerId };
    this.handlers.pickFromTray(pieceId, sx, sy);
  }

  private startPinch(): void {
    const [a, b] = [...this.pointers.values()];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const anchor = this.camera.screenToWorld(mid.x, mid.y);
    this.mode = {
      kind: 'pinch',
      startDist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      startScale: this.camera.scale,
      anchorX: anchor.x,
      anchorY: anchor.y,
    };
  }

  private onMove = (e: PointerEvent): void => {
    const prev = this.pointers.get(e.pointerId);
    if (!prev) return;
    const p = this.local(e);
    this.pointers.set(e.pointerId, p);
    const mode = this.mode;
    const axis = this.handlers.trayAxis();
    const alongOf = (q: Pointer) => (axis === 'x' ? q.x : q.y);

    if (mode.kind === 'drag' && mode.pointerId === e.pointerId) {
      this.handlers.dragMove(p.x, p.y);
    } else if (mode.kind === 'pan' && mode.pointerId === e.pointerId) {
      this.camera.panBy(p.x - prev.x, p.y - prev.y);
    } else if (mode.kind === 'tray-pending' && mode.pointerId === e.pointerId) {
      const dx = p.x - mode.startX;
      const dy = p.y - mode.startY;
      if (Math.hypot(dx, dy) < TRAY_SLOP) return;
      const along = Math.abs(axis === 'x' ? dx : dy);
      const across = Math.abs(axis === 'x' ? dy : dx);
      if (mode.pieceId !== null && across > along * 0.75) {
        // Pulled out of the tray towards the board.
        this.startTrayDrag(e.pointerId, mode.pieceId, p.x, p.y);
      } else {
        this.cancelTimer();
        this.mode = { kind: 'tray-scroll', pointerId: e.pointerId, samples: [] };
        this.handlers.trayScroll(alongOf(p) - alongOf({ x: mode.startX, y: mode.startY }));
        this.mode.samples.push({ t: e.timeStamp, pos: alongOf(p) });
      }
    } else if (mode.kind === 'tray-scroll' && mode.pointerId === e.pointerId) {
      this.handlers.trayScroll(alongOf(p) - alongOf(prev));
      mode.samples.push({ t: e.timeStamp, pos: alongOf(p) });
      if (mode.samples.length > 6) mode.samples.shift();
    } else if (mode.kind === 'pinch' && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const scale = (mode.startScale * dist) / mode.startDist;
      // Keep the world point that was between the fingers under the fingers.
      this.camera.placeAt(mode.anchorX, mode.anchorY, scale, mid.x, mid.y);
    }
  };

  private onUp = (e: PointerEvent): void => {
    const last = this.pointers.get(e.pointerId);
    if (!last) return;
    this.pointers.delete(e.pointerId);
    const mode = this.mode;
    if (mode.kind === 'drag') {
      if (mode.pointerId === e.pointerId) {
        this.handlers.dragEnd(last.x, last.y);
        this.mode = { kind: 'idle' };
      }
    } else if (mode.kind === 'tray-pending' && mode.pointerId === e.pointerId) {
      this.cancelTimer();
      this.mode = { kind: 'idle' };
    } else if (mode.kind === 'tray-scroll' && mode.pointerId === e.pointerId) {
      this.handlers.trayFling(flingVelocity(mode.samples, e.timeStamp));
      this.mode = { kind: 'idle' };
    } else if (mode.kind === 'pinch') {
      // One finger left: continue as a pan with it.
      const remaining = [...this.pointers.keys()];
      this.mode =
        remaining.length > 0 ? { kind: 'pan', pointerId: remaining[0] } : { kind: 'idle' };
    } else if (mode.kind === 'pan' && mode.pointerId === e.pointerId) {
      this.mode = { kind: 'idle' };
    }
    if (this.pointers.size === 0 && this.mode.kind !== 'idle') {
      this.cancelTimer();
      this.mode = { kind: 'idle' };
    }
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const p = this.local(e);
    const unit = e.deltaMode === 1 ? 30 : 1;
    if (this.handlers.inTray(p.x, p.y)) {
      const delta = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * unit;
      this.handlers.trayScroll(-delta);
      return;
    }
    const factor = Math.exp(-e.deltaY * unit * 0.0015);
    this.camera.zoomAt(p.x, p.y, this.camera.scale * factor);
  };
}

/** Finger speed (px/ms) over the last ~100 ms of a scroll gesture; 0 if the finger rested. */
function flingVelocity(samples: { t: number; pos: number }[], upTime: number): number {
  if (samples.length < 2) return 0;
  const last = samples[samples.length - 1];
  if (upTime - last.t > 80) return 0;
  const first = samples.find((s) => last.t - s.t <= 100) ?? samples[0];
  const dt = last.t - first.t;
  return dt > 0 ? (last.pos - first.pos) / dt : 0;
}

function preventDefault(e: Event): void {
  e.preventDefault();
}
