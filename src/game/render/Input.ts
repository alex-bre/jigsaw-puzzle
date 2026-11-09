import type { Camera } from './Camera';

export interface InputHandlers {
  /** Return true if a draggable piece is at the world point (and start dragging it). */
  dragStart(wx: number, wy: number): boolean;
  dragMove(wx: number, wy: number): void;
  dragEnd(): void;
}

interface Pointer {
  x: number;
  y: number;
}

type Mode =
  | { kind: 'idle' }
  | { kind: 'drag'; pointerId: number }
  | { kind: 'pan'; pointerId: number }
  | { kind: 'pinch'; startDist: number; startScale: number; anchorX: number; anchorY: number };

/**
 * Pointer handling on the canvas: one finger on a piece drags it, one finger on empty space
 * pans, two fingers pinch-zoom and pan, the mouse wheel zooms.
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

  private onDown = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    const p = this.local(e);
    this.pointers.set(e.pointerId, p);
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {
      /* not critical */
    }

    if (this.mode.kind === 'drag') return; // ignore extra fingers while dragging a piece
    if (this.pointers.size === 1) {
      const w = this.camera.screenToWorld(p.x, p.y);
      this.mode = this.handlers.dragStart(w.x, w.y)
        ? { kind: 'drag', pointerId: e.pointerId }
        : { kind: 'pan', pointerId: e.pointerId };
    } else if (this.pointers.size === 2) {
      this.startPinch();
    }
  };

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

    if (mode.kind === 'drag' && mode.pointerId === e.pointerId) {
      const w = this.camera.screenToWorld(p.x, p.y);
      this.handlers.dragMove(w.x, w.y);
    } else if (mode.kind === 'pan' && mode.pointerId === e.pointerId) {
      this.camera.panBy(p.x - prev.x, p.y - prev.y);
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
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.delete(e.pointerId);
    const mode = this.mode;
    if (mode.kind === 'drag') {
      if (mode.pointerId === e.pointerId) {
        this.handlers.dragEnd();
        this.mode = { kind: 'idle' };
      }
    } else if (mode.kind === 'pinch') {
      // One finger left: continue as a pan with it.
      const remaining = [...this.pointers.keys()];
      this.mode =
        remaining.length > 0 ? { kind: 'pan', pointerId: remaining[0] } : { kind: 'idle' };
    } else if (mode.kind === 'pan' && mode.pointerId === e.pointerId) {
      this.mode = { kind: 'idle' };
    }
    if (this.pointers.size === 0 && this.mode.kind !== 'drag') this.mode = { kind: 'idle' };
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const p = this.local(e);
    const factor = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015));
    this.camera.zoomAt(p.x, p.y, this.camera.scale * factor);
  };
}

function preventDefault(e: Event): void {
  e.preventDefault();
}
