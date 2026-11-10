import { Container, Graphics, Text } from 'pixi.js';
import type { PieceView } from './PuzzleView';

/** Screen rectangle of the tray and the direction it scrolls in. */
export interface TrayRect {
  x: number;
  y: number;
  width: number;
  height: number;
  /** 'x' = horizontal strip at the bottom, 'y' = vertical strip at the side. */
  axis: 'x' | 'y';
}

const PADDING = 10;
const GAP = 8;
/** Piece cell size relative to the slot; the rest is room for tabs. */
const PIECE_IN_SLOT = 0.58;
/** Momentum decay time constant (ms). */
const FLING_TAU = 420;

/**
 * The piece tray: a scrollable strip in screen space (not affected by board zoom) that shows
 * pieces at a constant, comfortably large size.
 */
export class TrayView {
  readonly container = new Container();
  private readonly bg = new Graphics();
  private readonly content = new Container();
  private readonly emptyText: Text;
  private rect: TrayRect = { x: 0, y: 0, width: 1, height: 1, axis: 'x' };
  private items: number[] = [];
  private scroll = 0;
  private velocity = 0;
  private lastUpdate = 0;
  private highlighted = false;

  constructor(
    private readonly views: PieceView[],
    private readonly cellWidth: number,
    private readonly cellHeight: number,
  ) {
    this.emptyText = new Text({
      text: '',
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: 20,
        fontWeight: '600',
        fill: 0xffffff,
        align: 'center',
        wordWrap: true,
        wordWrapWidth: 300,
      },
    });
    this.emptyText.alpha = 0.85;
    this.emptyText.anchor.set(0.5);
    this.container.addChild(this.bg, this.content, this.emptyText);
  }

  private get thickness(): number {
    return this.rect.axis === 'x' ? this.rect.height : this.rect.width;
  }

  private get length(): number {
    return this.rect.axis === 'x' ? this.rect.width : this.rect.height;
  }

  private get slot(): number {
    return Math.max(40, this.thickness - 2 * PADDING);
  }

  private get maxScroll(): number {
    const n = this.items.length;
    const contentLength = 2 * PADDING + n * this.slot + Math.max(0, n - 1) * GAP;
    return Math.max(0, contentLength - this.length);
  }

  setRect(rect: TrayRect): void {
    this.rect = rect;
    this.drawBackground();
    this.emptyText.position.set(rect.x + rect.width / 2, rect.y + rect.height / 2);
    this.emptyText.style.wordWrapWidth = Math.max(80, rect.width - 24);
    this.clampScroll();
    this.layout();
  }

  /** Shows exactly these pieces, in this order. `emptyMessage` is shown when the list is empty. */
  setItems(ids: number[], emptyMessage = ''): void {
    const keep = new Set(ids);
    for (const child of [...this.content.children] as PieceView[]) {
      if (!keep.has(child.pieceId)) this.content.removeChild(child);
    }
    for (const id of ids) {
      const view = this.views[id];
      if (view.parent !== this.content) this.content.addChild(view);
    }
    this.items = ids;
    this.emptyText.text = emptyMessage;
    this.emptyText.visible = ids.length === 0 && emptyMessage !== '';
    this.clampScroll();
    this.layout();
  }

  contains(sx: number, sy: number): boolean {
    const r = this.rect;
    return sx >= r.x && sx <= r.x + r.width && sy >= r.y && sy <= r.y + r.height;
  }

  /** Position along the scroll axis, relative to the start of the first slot. */
  private along(sx: number, sy: number): number {
    const local = this.rect.axis === 'x' ? sx - this.rect.x : sy - this.rect.y;
    return local + this.scroll - PADDING;
  }

  pieceAt(sx: number, sy: number): number | null {
    if (!this.contains(sx, sy)) return null;
    const step = this.slot + GAP;
    const i = Math.floor((this.along(sx, sy) + GAP / 2) / step);
    return i >= 0 && i < this.items.length ? this.items[i] : null;
  }

  /** The visible piece before which a piece dropped at (sx, sy) should be inserted (null = end). */
  insertBeforeAt(sx: number, sy: number): number | null {
    const step = this.slot + GAP;
    const index = Math.floor((this.along(sx, sy) - this.slot / 2) / step) + 1;
    return this.items[Math.max(0, index)] ?? null;
  }

  setHighlight(on: boolean): void {
    if (on === this.highlighted) return;
    this.highlighted = on;
    this.drawBackground();
  }

  /** Scrolls with the finger: `delta` is the finger movement along the axis (screen px). */
  scrollBy(delta: number): void {
    this.velocity = 0;
    this.scroll -= delta;
    this.clampScroll();
    this.layout();
  }

  /** Continues scrolling with momentum. `velocity` is the finger speed in px/ms. */
  fling(velocity: number, now: number): void {
    this.velocity = -velocity;
    this.lastUpdate = now;
  }

  stopFling(): void {
    this.velocity = 0;
  }

  scrollToStart(): void {
    this.velocity = 0;
    this.scroll = 0;
    this.layout();
  }

  /** Advances the momentum scroll. Returns true while still moving. */
  update(now: number): boolean {
    if (this.velocity === 0) return false;
    const dt = Math.min(32, Math.max(0, now - this.lastUpdate));
    this.lastUpdate = now;
    this.scroll += this.velocity * dt;
    this.velocity *= Math.exp(-dt / FLING_TAU);
    const before = this.scroll;
    this.clampScroll();
    if (this.scroll !== before || Math.abs(this.velocity) < 0.02) this.velocity = 0;
    this.layout();
    return this.velocity !== 0;
  }

  private clampScroll(): void {
    this.scroll = Math.max(0, Math.min(this.maxScroll, this.scroll));
  }

  private layout(): void {
    const slot = this.slot;
    const scale = (slot * PIECE_IN_SLOT) / Math.max(this.cellWidth, this.cellHeight);
    const across = this.thickness / 2;
    const w = this.cellWidth * scale;
    const h = this.cellHeight * scale;
    this.items.forEach((id, i) => {
      const view = this.views[id];
      const along = PADDING + i * (slot + GAP) + slot / 2 - this.scroll;
      const visible = along > -slot && along < this.length + slot;
      view.visible = visible;
      if (!visible) return;
      view.scale.set(scale);
      const cx = this.rect.axis === 'x' ? this.rect.x + along : this.rect.x + across;
      const cy = this.rect.axis === 'x' ? this.rect.y + across : this.rect.y + along;
      view.position.set(cx - w / 2, cy - h / 2);
    });
  }

  private drawBackground(): void {
    const r = this.rect;
    const g = this.bg;
    g.clear();
    g.rect(r.x, r.y, r.width, r.height).fill({
      color: this.highlighted ? 0x2e5a4e : 0x1f332e,
      alpha: 0.96,
    });
    // A lighter line on the side facing the board.
    const line = this.highlighted ? 4 : 2;
    const color = this.highlighted ? 0xf2b134 : 0xffffff;
    const alpha = this.highlighted ? 1 : 0.15;
    if (r.axis === 'x') g.rect(r.x, r.y, r.width, line).fill({ color, alpha });
    else g.rect(r.x, r.y, line, r.height).fill({ color, alpha });
  }
}
