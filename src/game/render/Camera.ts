import type { Container } from 'pixi.js';
import type { Rect } from '../core/playArea';

/**
 * Maps world (board) coordinates to screen coordinates: screen = world * scale + offset.
 * Keeps the play area on screen and the zoom within sensible limits.
 */
export class Camera {
  scale = 1;
  x = 0;
  y = 0;
  viewWidth = 1;
  viewHeight = 1;
  private bounds: Rect = { x: 0, y: 0, width: 1, height: 1 };
  private minScale = 0.01;
  private maxScale = 10;

  constructor(
    private readonly world: Container,
    private readonly onChange: () => void,
  ) {}

  /** Area that must stay reachable, and the largest sensible zoom (world units per screen px). */
  configure(bounds: Rect, maxScale: number): void {
    this.bounds = bounds;
    this.maxScale = maxScale;
    this.updateMinScale();
  }

  setViewSize(width: number, height: number): void {
    // Keep the world point in the centre of the view fixed across resizes / rotations.
    const cx = (this.viewWidth / 2 - this.x) / this.scale;
    const cy = (this.viewHeight / 2 - this.y) / this.scale;
    this.viewWidth = Math.max(1, width);
    this.viewHeight = Math.max(1, height);
    this.updateMinScale();
    this.scale = clamp(this.scale, this.minScale, this.maxScale);
    this.x = this.viewWidth / 2 - cx * this.scale;
    this.y = this.viewHeight / 2 - cy * this.scale;
    this.apply();
  }

  fitRect(rect: Rect, padding: number): void {
    const s = Math.min(
      (this.viewWidth - 2 * padding) / rect.width,
      (this.viewHeight - 2 * padding) / rect.height,
    );
    this.scale = clamp(s, this.minScale, this.maxScale);
    this.x = (this.viewWidth - rect.width * this.scale) / 2 - rect.x * this.scale;
    this.y = (this.viewHeight - rect.height * this.scale) / 2 - rect.y * this.scale;
    this.apply();
  }

  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return { x: (sx - this.x) / this.scale, y: (sy - this.y) / this.scale };
  }

  panBy(dx: number, dy: number): void {
    this.x += dx;
    this.y += dy;
    this.apply();
  }

  /** Zooms so that the world point under screen point (sx, sy) stays there. */
  zoomAt(sx: number, sy: number, newScale: number): void {
    const w = this.screenToWorld(sx, sy);
    this.placeAt(w.x, w.y, newScale, sx, sy);
  }

  /** Sets the zoom and puts world point (wx, wy) at screen point (sx, sy). */
  placeAt(wx: number, wy: number, newScale: number, sx: number, sy: number): void {
    this.scale = clamp(newScale, this.minScale, this.maxScale);
    this.x = sx - wx * this.scale;
    this.y = sy - wy * this.scale;
    this.apply();
  }

  private updateMinScale(): void {
    const fitScale = Math.min(
      this.viewWidth / this.bounds.width,
      this.viewHeight / this.bounds.height,
    );
    this.minScale = Math.min(fitScale * 0.9, this.maxScale);
  }

  /** Never let the play area leave the screen entirely. */
  private clampPosition(): void {
    const b = this.bounds;
    const margin = 0.25; // fraction of the view that the area must keep covering
    const left = b.x * this.scale + this.x;
    const right = (b.x + b.width) * this.scale + this.x;
    const top = b.y * this.scale + this.y;
    const bottom = (b.y + b.height) * this.scale + this.y;
    const mx = this.viewWidth * margin;
    const my = this.viewHeight * margin;
    if (right < mx) this.x += mx - right;
    if (left > this.viewWidth - mx) this.x -= left - (this.viewWidth - mx);
    if (bottom < my) this.y += my - bottom;
    if (top > this.viewHeight - my) this.y -= top - (this.viewHeight - my);
  }

  private apply(): void {
    this.clampPosition();
    this.world.scale.set(this.scale);
    this.world.position.set(this.x, this.y);
    this.onChange();
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
