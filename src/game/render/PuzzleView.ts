import { Container, Graphics, Sprite } from 'pixi.js';
import { polygonContains } from '../core/cut';
import type { PuzzleState } from '../core/model';
import type { PieceGraphics } from './PieceFactory';

const SHADOW_REST = { offset: 0.025, alpha: 0.4 };
const SHADOW_LIFTED = { offset: 0.07, alpha: 0.32 };

class PieceView extends Container {
  readonly shadow: Sprite;
  readonly sprite: Sprite;
  /** Visual offset (for snap animations), added to the model position. */
  animX = 0;
  animY = 0;

  constructor(
    readonly pieceId: number,
    gfx: PieceGraphics,
  ) {
    super();
    this.shadow = new Sprite(gfx.shadows[pieceId]);
    this.shadow.scale.set(1 / gfx.shadowScale);
    this.shadow.position.set(-gfx.pad, -gfx.pad);
    this.sprite = new Sprite(gfx.pieces[pieceId]);
    this.sprite.position.set(-gfx.pad, -gfx.pad);
    this.addChild(this.shadow, this.sprite);
    this.eventMode = 'none';
  }
}

interface Tween {
  ids: number[];
  fromX: number;
  fromY: number;
  start: number;
  duration: number;
}

/** Everything inside the camera-transformed world: board, locked pieces, loose pieces. */
export class PuzzleView {
  readonly world = new Container();
  private readonly boardLayer = new Container();
  private readonly lockedLayer = new Container();
  private readonly looseLayer = new Container();
  private readonly views: PieceView[] = [];
  private readonly pieceSize: number;
  private tweens: Tween[] = [];

  constructor(
    private readonly state: PuzzleState,
    private readonly gfx: PieceGraphics,
  ) {
    this.pieceSize = Math.min(state.pieceWidth, state.pieceHeight);
    this.world.addChild(this.boardLayer, this.lockedLayer, this.looseLayer);
    this.boardLayer.addChild(this.createBoard());

    for (const p of state.pieces) {
      const view = new PieceView(p.id, gfx);
      this.views.push(view);
      this.setElevation(view, false);
    }
    // Add in group order so groups stay contiguous in the draw order.
    for (const ids of state.groups.values()) {
      for (const id of ids) {
        const p = state.pieces[id];
        const view = this.views[id];
        if (p.locked) this.lockView(view);
        else this.looseLayer.addChild(view);
      }
    }
    this.syncAll();
  }

  private createBoard(): Graphics {
    const { imageWidth: w, imageHeight: h } = this.state;
    const r = this.pieceSize * 0.08;
    const frame = this.pieceSize * 0.06;
    const g = new Graphics();
    g.roundRect(-frame, -frame, w + 2 * frame, h + 2 * frame, r + frame).fill({
      color: 0x000000,
      alpha: 0.18,
    });
    g.rect(0, 0, w, h).fill({ color: 0xffffff, alpha: 0.1 });
    // Faint grid helps to judge where pieces belong.
    const line = Math.max(1, this.pieceSize * 0.01);
    for (let c = 1; c < this.state.cols; c++) {
      const x = c * this.state.pieceWidth;
      g.moveTo(x, 0).lineTo(x, h);
    }
    for (let rr = 1; rr < this.state.rows; rr++) {
      const y = rr * this.state.pieceHeight;
      g.moveTo(0, y).lineTo(w, y);
    }
    g.stroke({ color: 0xffffff, alpha: 0.07, width: line });
    return g;
  }

  private setElevation(view: PieceView, lifted: boolean): void {
    const e = lifted ? SHADOW_LIFTED : SHADOW_REST;
    const o = this.pieceSize * e.offset;
    view.shadow.position.set(-this.gfx.pad + o * 0.6, -this.gfx.pad + o);
    view.shadow.alpha = e.alpha;
  }

  private lockView(view: PieceView): void {
    view.shadow.visible = false;
    this.lockedLayer.addChild(view);
  }

  syncAll(): void {
    for (const view of this.views) this.syncView(view);
  }

  syncPieces(ids: Iterable<number>): void {
    for (const id of ids) this.syncView(this.views[id]);
  }

  private syncView(view: PieceView): void {
    const p = this.state.pieces[view.pieceId];
    view.position.set(p.x + view.animX, p.y + view.animY);
  }

  /** Brings a group to the front and gives it a lifted look while dragging. */
  liftGroup(ids: number[]): void {
    for (const id of ids) {
      const view = this.views[id];
      this.looseLayer.addChild(view); // re-adding moves it to the top
      this.setElevation(view, true);
    }
  }

  dropGroup(ids: number[], locked: boolean): void {
    for (const id of ids) {
      const view = this.views[id];
      if (locked) {
        this.lockView(view);
      } else {
        // Keeps a freshly merged group contiguous and on top.
        this.looseLayer.addChild(view);
        this.setElevation(view, false);
      }
    }
  }

  /** Animates pieces from their old visual position (offset by -dx,-dy) to the model position. */
  animateSnap(ids: number[], dx: number, dy: number, now: number): void {
    if (dx === 0 && dy === 0) return;
    this.tweens.push({ ids, fromX: -dx, fromY: -dy, start: now, duration: 140 });
    for (const id of ids) {
      this.views[id].animX = -dx;
      this.views[id].animY = -dy;
    }
    this.syncPieces(ids);
  }

  /** Advances animations. Returns true while anything is still animating. */
  update(now: number): boolean {
    if (this.tweens.length === 0) return false;
    this.tweens = this.tweens.filter((tw) => {
      const t = Math.min(1, (now - tw.start) / tw.duration);
      const k = 1 - (1 - t) ** 3; // ease-out cubic
      for (const id of tw.ids) {
        const view = this.views[id];
        view.animX = tw.fromX * (1 - k);
        view.animY = tw.fromY * (1 - k);
        this.syncView(view);
      }
      return t < 1;
    });
    return this.tweens.length > 0;
  }

  /**
   * Returns the topmost loose piece at a world position. `slop` (world units) allows
   * slightly-off touches to still pick a piece, which matters for large fingers.
   */
  hitTest(wx: number, wy: number, slop: number): number | null {
    const children = this.looseLayer.children as PieceView[];
    for (let i = children.length - 1; i >= 0; i--) {
      const id = children[i].pieceId;
      const p = this.state.pieces[id];
      if (polygonContains(this.gfx.polygons[id], wx - p.x, wy - p.y)) return id;
    }
    // Second pass: nearest piece cell within the slop distance.
    let best: number | null = null;
    let bestDist = slop;
    for (let i = children.length - 1; i >= 0; i--) {
      const id = children[i].pieceId;
      const p = this.state.pieces[id];
      const dx = Math.max(p.x - wx, 0, wx - (p.x + this.state.pieceWidth));
      const dy = Math.max(p.y - wy, 0, wy - (p.y + this.state.pieceHeight));
      const d = Math.hypot(dx, dy);
      if (d < bestDist) {
        bestDist = d;
        best = id;
      }
    }
    return best;
  }

  destroy(): void {
    this.world.destroy({ children: true });
    this.gfx.destroy();
  }
}
