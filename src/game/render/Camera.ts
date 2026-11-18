import type { Container } from 'pixi.js';
import type { Rect } from '../core/playArea';

/** Free space (screen px) kept between the play area and the edges of the board view. */
const PADDING = 8;

/**
 * Maps world (board) coordinates to screen coordinates: screen = world * scale + offset.
 *
 * The base view shows a given area as large as fits, centred, and is refitted whenever that area
 * or the view size (resize, rotation) changes. Everything visible in the base view is the play
 * area. If zooming is enabled, the view can be zoomed in from there and moved around, but never
 * zoomed out beyond the base view or moved past the play area.
 */
export class Camera {
  scale = 1;
  x = 0;
  y = 0;
  private area: Rect = { x: 0, y: 0, width: 1, height: 1 };
  private viewWidth = 1;
  private viewHeight = 1;
  private baseScale = 1;
  private baseX = 0;
  private baseY = 0;
  private maxScale = Infinity;
  private zoomEnabled = false;

  constructor(
    private readonly world: Container,
    private readonly onChange: () => void,
  ) {}

  /** The area that is shown as large as possible in the base view. */
  setArea(area: Rect): void {
    this.area = area;
    this.refit();
  }

  setViewSize(width: number, height: number): void {
    this.viewWidth = Math.max(1, width);
    this.viewHeight = Math.max(1, height);
    this.refit();
  }

  /** The largest zoom (screen px per world unit); never less than the base view's. */
  setMaxScale(maxScale: number): void {
    this.maxScale = maxScale;
    this.place(this.scale, this.x, this.y);
  }

  get zoomable(): boolean {
    return this.zoomEnabled;
  }

  /** Switching zoom off returns to the base view. */
  setZoomEnabled(enabled: boolean): void {
    this.zoomEnabled = enabled;
    if (!enabled) this.place(this.baseScale, this.baseX, this.baseY);
  }

  /** The play area: everything visible in the base view, minus the padding (world units). */
  playArea(): Rect {
    const pad = this.padding();
    return {
      x: (pad - this.baseX) / this.baseScale,
      y: (pad - this.baseY) / this.baseScale,
      width: (this.viewWidth - 2 * pad) / this.baseScale,
      height: (this.viewHeight - 2 * pad) / this.baseScale,
    };
  }

  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return { x: (sx - this.x) / this.scale, y: (sy - this.y) / this.scale };
  }

  panBy(dx: number, dy: number): void {
    if (this.zoomEnabled) this.place(this.scale, this.x + dx, this.y + dy);
  }

  /** Zooms so that the world point under screen point (sx, sy) stays there. */
  zoomAt(sx: number, sy: number, newScale: number): void {
    const w = this.screenToWorld(sx, sy);
    this.placeAt(w.x, w.y, newScale, sx, sy);
  }

  /** Sets the zoom and puts world point (wx, wy) at screen point (sx, sy). */
  placeAt(wx: number, wy: number, newScale: number, sx: number, sy: number): void {
    if (!this.zoomEnabled) return;
    const s = this.clampScale(newScale);
    this.place(s, sx - wx * s, sy - wy * s);
  }

  private padding(): number {
    return Math.min(PADDING, this.viewWidth / 4, this.viewHeight / 4);
  }

  private clampScale(s: number): number {
    return Math.max(this.baseScale, Math.min(Math.max(this.baseScale, this.maxScale), s));
  }

  /** Recomputes the base view, keeping the current zoom and the world point in the centre. */
  private refit(): void {
    const factor = this.scale / this.baseScale;
    const centre = this.screenToWorld(this.viewWidth / 2, this.viewHeight / 2);
    const a = this.area;
    const pad = this.padding();
    this.baseScale = Math.max(
      1e-6,
      Math.min((this.viewWidth - 2 * pad) / a.width, (this.viewHeight - 2 * pad) / a.height),
    );
    this.baseX = (this.viewWidth - a.width * this.baseScale) / 2 - a.x * this.baseScale;
    this.baseY = (this.viewHeight - a.height * this.baseScale) / 2 - a.y * this.baseScale;
    if (!this.zoomEnabled || !(factor > 1.001)) {
      this.place(this.baseScale, this.baseX, this.baseY);
      return;
    }
    const s = this.clampScale(this.baseScale * factor);
    this.place(s, this.viewWidth / 2 - centre.x * s, this.viewHeight / 2 - centre.y * s);
  }

  /** Applies a transform, keeping the view inside the base view (so inside the play area). */
  private place(scale: number, x: number, y: number): void {
    scale = this.zoomEnabled ? this.clampScale(scale) : this.baseScale;
    // World rectangle shown by the base view; the zoomed view must stay within it.
    const left = -this.baseX / this.baseScale;
    const top = -this.baseY / this.baseScale;
    const right = left + this.viewWidth / this.baseScale;
    const bottom = top + this.viewHeight / this.baseScale;
    this.scale = scale;
    this.x = Math.min(-left * scale, Math.max(this.viewWidth - right * scale, x));
    this.y = Math.min(-top * scale, Math.max(this.viewHeight - bottom * scale, y));
    this.world.scale.set(this.scale);
    this.world.position.set(this.x, this.y);
    this.onChange();
  }
}
