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
/** Easing time constant (ms) of the animated scroll started by the arrow buttons. */
const STEP_TAU = 90;
/** Length (along the axis) of the arrow-button zone at each end; only shown when it overflows. */
const BUTTON = 44;
const BUTTON_RADIUS = 17;
/** Length of the fade over pieces that continue past the visible part, in strips. */
const FADE = 36;
const FADE_STEPS = 12;
/** Scrollbar thickness and its distance from the outer edge (away from the board). */
const BAR = 4;
const BAR_EDGE = 6;
const BAR_MIN = 28;

/**
 * The piece tray: a scrollable strip in screen space (not affected by board zoom) that shows
 * pieces at a constant, comfortably large size. When the pieces do not fit, arrow buttons at
 * both ends, fades at the cut-off edges and a scrollbar show that (and how far) it scrolls.
 */
export class TrayView {
  readonly container = new Container();
  private readonly bg = new Graphics();
  private readonly content = new Container();
  /** Fades, arrow buttons, scrollbar and edge line, drawn above the pieces. */
  private readonly chrome = new Graphics();
  private readonly emptyText: Text;
  private rect: TrayRect = { x: 0, y: 0, width: 1, height: 1, axis: 'x' };
  private items: number[] = [];
  private scroll = 0;
  private velocity = 0;
  /** Where an arrow-button scroll is heading, or null. */
  private target: number | null = null;
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
    this.container.addChild(this.bg, this.content, this.chrome, this.emptyText);
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

  private get contentLength(): number {
    const n = this.items.length;
    return 2 * PADDING + n * this.slot + Math.max(0, n - 1) * GAP;
  }

  /** True when the pieces do not all fit; then the arrow buttons take up both ends. */
  private get overflows(): boolean {
    return this.contentLength > this.length;
  }

  /** Start of the scrolling viewport along the axis, relative to the tray's start. */
  private get offset(): number {
    return this.overflows ? BUTTON : 0;
  }

  private get viewLength(): number {
    return this.overflows ? this.length - 2 * BUTTON : this.length;
  }

  private get maxScroll(): number {
    return Math.max(0, this.contentLength - this.viewLength);
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

  /** Position along the axis, relative to the tray's start. */
  private local(sx: number, sy: number): number {
    return this.rect.axis === 'x' ? sx - this.rect.x : sy - this.rect.y;
  }

  /** Position along the scroll axis, relative to the start of the first slot. */
  private along(sx: number, sy: number): number {
    return this.local(sx, sy) - this.offset + this.scroll - PADDING;
  }

  pieceAt(sx: number, sy: number): number | null {
    if (!this.contains(sx, sy)) return null;
    const local = this.local(sx, sy);
    if (local < this.offset || local > this.offset + this.viewLength) return null;
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

  /** The arrow button at this point: -1 = back, 1 = forward, null = none. */
  buttonAt(sx: number, sy: number): -1 | 1 | null {
    if (!this.overflows || !this.contains(sx, sy)) return null;
    const local = this.local(sx, sy);
    if (local < BUTTON) return -1;
    if (local > this.length - BUTTON) return 1;
    return null;
  }

  /** Smoothly scrolls one page of whole slots back (-1) or forward (1). */
  step(direction: -1 | 1, now: number): void {
    const stride = this.slot + GAP;
    const page = Math.max(1, Math.floor(this.viewLength / stride)) * stride;
    const from = this.target ?? this.scroll;
    const to = Math.round((from + direction * page) / stride) * stride;
    this.velocity = 0;
    this.target = Math.max(0, Math.min(this.maxScroll, to));
    this.lastUpdate = now;
  }

  setHighlight(on: boolean): void {
    if (on === this.highlighted) return;
    this.highlighted = on;
    this.drawBackground();
    this.drawChrome();
  }

  /** Scrolls with the finger: `delta` is the finger movement along the axis (screen px). */
  scrollBy(delta: number): void {
    this.velocity = 0;
    this.target = null;
    this.scroll -= delta;
    this.clampScroll();
    this.layout();
  }

  /** Continues scrolling with momentum. `velocity` is the finger speed in px/ms. */
  fling(velocity: number, now: number): void {
    this.target = null;
    this.velocity = -velocity;
    this.lastUpdate = now;
  }

  stopFling(): void {
    this.velocity = 0;
    this.target = null;
  }

  scrollToStart(): void {
    this.velocity = 0;
    this.target = null;
    this.scroll = 0;
    this.layout();
  }

  /** Advances the momentum scroll. Returns true while still moving. */
  update(now: number): boolean {
    if (this.target !== null) {
      const dt = Math.min(32, Math.max(0, now - this.lastUpdate));
      this.lastUpdate = now;
      this.scroll += (this.target - this.scroll) * (1 - Math.exp(-dt / STEP_TAU));
      if (Math.abs(this.target - this.scroll) < 0.5) {
        this.scroll = this.target;
        this.target = null;
      }
      this.layout();
      return this.target !== null;
    }
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
    if (this.target !== null) this.target = Math.max(0, Math.min(this.maxScroll, this.target));
  }

  private layout(): void {
    const slot = this.slot;
    const scale = (slot * PIECE_IN_SLOT) / Math.max(this.cellWidth, this.cellHeight);
    const across = this.thickness / 2;
    const w = this.cellWidth * scale;
    const h = this.cellHeight * scale;
    const start = this.offset;
    const end = start + this.viewLength;
    this.items.forEach((id, i) => {
      const view = this.views[id];
      const along = start + PADDING + i * (slot + GAP) + slot / 2 - this.scroll;
      const visible = along > start - slot && along < end + slot;
      view.visible = visible;
      if (!visible) return;
      view.scale.set(scale);
      const cx = this.rect.axis === 'x' ? this.rect.x + along : this.rect.x + across;
      const cy = this.rect.axis === 'x' ? this.rect.y + across : this.rect.y + along;
      view.position.set(cx - w / 2, cy - h / 2);
    });
    this.drawChrome();
  }

  private get bgColor(): number {
    return this.highlighted ? 0x2e5a4e : 0x1f332e;
  }

  private drawBackground(): void {
    const r = this.rect;
    this.bg.clear();
    this.bg.rect(r.x, r.y, r.width, r.height).fill({ color: this.bgColor, alpha: 0.96 });
  }

  /** Everything drawn above the pieces; depends on the scroll position. */
  private drawChrome(): void {
    const r = this.rect;
    const g = this.chrome;
    const horizontal = r.axis === 'x';
    const thickness = this.thickness;
    const color = this.bgColor;
    /** A rectangle given along/across the tray (across 0 = the side facing the board). */
    const box = (along: number, length: number, across: number, width: number, radius = 0) =>
      horizontal
        ? g.roundRect(r.x + along, r.y + across, length, width, radius)
        : g.roundRect(r.x + across, r.y + along, width, length, radius);
    g.clear();

    if (this.overflows) {
      const start = this.offset;
      const end = start + this.viewLength;
      const max = this.maxScroll;

      // Fade out the pieces where more of them continue past the visible part.
      const fadeStart = Math.min(1, this.scroll / FADE);
      const fadeEnd = Math.min(1, (max - this.scroll) / FADE);
      const strip = FADE / FADE_STEPS;
      for (let i = 0; i < FADE_STEPS; i++) {
        const alpha = (1 - i / FADE_STEPS) ** 1.5;
        if (fadeStart > 0) {
          box(start + i * strip, strip, 0, thickness).fill({ color, alpha: alpha * fadeStart });
        }
        if (fadeEnd > 0) {
          box(end - (i + 1) * strip, strip, 0, thickness).fill({ color, alpha: alpha * fadeEnd });
        }
      }

      // Scrollbar along the outer edge: how much is visible and where.
      const track = this.viewLength - 2 * PADDING;
      const thumb = Math.max(BAR_MIN, (track * this.viewLength) / this.contentLength);
      const pos = max > 0 ? (this.scroll / max) * (track - thumb) : 0;
      const across = thickness - BAR_EDGE - BAR;
      box(start + PADDING, track, across, BAR, BAR / 2).fill({ color: 0xffffff, alpha: 0.1 });
      box(start + PADDING + pos, thumb, across, BAR, BAR / 2).fill({
        color: 0xffffff,
        alpha: 0.55,
      });

      // Arrow buttons in their own zones at both ends (they also hide pieces scrolled under).
      for (const direction of [-1, 1] as const) {
        const zone = direction < 0 ? 0 : this.length - BUTTON;
        box(zone, BUTTON, 0, thickness).fill({ color });
        const enabled = direction < 0 ? this.scroll > 0.5 : this.scroll < max - 0.5;
        const ca = zone + BUTTON / 2;
        const cc = thickness / 2;
        const point = (along: number, across: number): [number, number] =>
          horizontal
            ? [r.x + ca + along, r.y + cc + across]
            : [r.x + cc + across, r.y + ca + along];
        g.circle(...point(0, 0), BUTTON_RADIUS).fill({
          color: 0xffffff,
          alpha: enabled ? 0.16 : 0.05,
        });
        const s = 5.5;
        g.moveTo(...point(-direction * s * 0.55, -s))
          .lineTo(...point(direction * s * 0.55, 0))
          .lineTo(...point(-direction * s * 0.55, s))
          .stroke({
            width: 3,
            color: 0xffffff,
            alpha: enabled ? 0.95 : 0.3,
            cap: 'round',
            join: 'round',
          });
      }
    }

    // A lighter line on the side facing the board.
    const line = this.highlighted ? 4 : 2;
    box(0, this.length, 0, line).fill({
      color: this.highlighted ? 0xf2b134 : 0xffffff,
      alpha: this.highlighted ? 1 : 0.15,
    });
  }
}
