import { createRng, range, type Rng } from './core/rng';

/**
 * Procedurally painted landscape used as a placeholder picture until the real image
 * catalogue exists (milestone 5). Deterministic per seed; no licensing concerns.
 */
export function createDemoImage(width = 1600, height = 1200, seed = 2026): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const rng = createRng(seed);
  const W = width;
  const H = height;
  const horizon = H * 0.58;

  // Sky
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#1d3b72');
  sky.addColorStop(0.45, '#5a7fc0');
  sky.addColorStop(0.75, '#f2a35e');
  sky.addColorStop(1, '#f7d27a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, horizon);

  // Sun with glow
  const sunX = W * 0.68;
  const sunY = horizon * 0.72;
  const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, W * 0.25);
  glow.addColorStop(0, 'rgba(255,240,190,0.9)');
  glow.addColorStop(0.2, 'rgba(255,210,140,0.45)');
  glow.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, horizon);
  ctx.fillStyle = '#fff3c4';
  circle(ctx, sunX, sunY, W * 0.045);

  // Clouds
  for (let i = 0; i < 9; i++) {
    cloud(
      ctx,
      rng,
      range(rng, -50, W),
      range(rng, H * 0.04, horizon * 0.55),
      range(rng, 0.6, 1.4) * W * 0.06,
    );
  }

  // Hot-air balloons
  const balloonColors = [
    ['#e63946', '#ffd166'],
    ['#2a9d8f', '#f1faee'],
    ['#8e44ad', '#f4a261'],
  ];
  balloonColors.forEach(([a, b], i) => {
    balloon(
      ctx,
      W * (0.14 + i * 0.3) + range(rng, -40, 40),
      H * (0.12 + (i % 2) * 0.12),
      W * (0.035 - i * 0.006),
      a,
      b,
    );
  });

  // Mountain ranges, far to near
  const ranges: [number, string][] = [
    [0.3, '#8a7fb0'],
    [0.42, '#6b6a9e'],
    [0.5, '#4f5d86'],
  ];
  for (const [peakLevel, color] of ranges) {
    mountains(ctx, rng, W, horizon, horizon * peakLevel, color);
  }

  // Lake reflecting the sky
  const lakeTop = horizon;
  const lakeBottom = H * 0.74;
  const lake = ctx.createLinearGradient(0, lakeTop, 0, lakeBottom);
  lake.addColorStop(0, '#e8b46a');
  lake.addColorStop(0.35, '#6f8fc4');
  lake.addColorStop(1, '#2b4d82');
  ctx.fillStyle = lake;
  ctx.fillRect(0, lakeTop, W, lakeBottom - lakeTop);
  ctx.fillStyle = 'rgba(255,240,190,0.5)';
  for (let y = lakeTop + 6; y < lakeBottom; y += 9) {
    const spread = (1 - (y - lakeTop) / (lakeBottom - lakeTop)) * W * 0.08 + 10;
    ctx.fillRect(sunX - spread * range(rng, 0.4, 1), y, spread * range(rng, 0.8, 2), 2.5);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 70; i++) {
    const x = range(rng, 0, W);
    const y = range(rng, lakeTop + 4, lakeBottom - 4);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + range(rng, 20, 80), y);
    ctx.stroke();
  }

  // Sailing boat
  boat(ctx, W * 0.3, H * 0.68, W * 0.05);

  // Meadow
  const meadow = ctx.createLinearGradient(0, lakeBottom - 30, 0, H);
  meadow.addColorStop(0, '#5f9e45');
  meadow.addColorStop(1, '#2f6b2a');
  ctx.fillStyle = meadow;
  ctx.beginPath();
  ctx.moveTo(0, lakeBottom + 10);
  for (let x = 0; x <= W; x += W / 16) {
    ctx.lineTo(x, lakeBottom - 15 + Math.sin(x * 0.006) * 20 + range(rng, -6, 6));
  }
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.fill();

  // House
  house(ctx, W * 0.8, lakeBottom + H * 0.02, W * 0.09);

  // Pine trees on the left
  for (let i = 0; i < 12; i++) {
    const x = range(rng, -20, W * 0.32);
    const s = range(rng, 0.7, 1.3) * H * 0.12;
    pine(ctx, x, lakeBottom + range(rng, 0, H * 0.12) + s * 0.2, s, rng);
  }

  // Flowers
  const flowerColors = ['#ffd23f', '#ff6b6b', '#f8f9fa', '#c77dff', '#ff9f1c', '#4cc9f0'];
  for (let i = 0; i < 520; i++) {
    const y = range(rng, lakeBottom + 20, H);
    const depth = (y - lakeBottom) / (H - lakeBottom);
    const x = range(rng, W * 0.25, W);
    const r = 2 + depth * 7;
    ctx.fillStyle = '#2d5a1f';
    ctx.fillRect(x - 0.75, y, 1.5 + depth * 1.5, r * 2.2);
    ctx.fillStyle = flowerColors[Math.floor(rng() * flowerColors.length)];
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      circle(ctx, x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8, r * 0.6);
    }
    ctx.fillStyle = '#7a4a12';
    circle(ctx, x, y, r * 0.4);
  }

  return canvas;
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function cloud(ctx: CanvasRenderingContext2D, rng: Rng, x: number, y: number, s: number): void {
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (let i = 0; i < 6; i++) {
    circle(
      ctx,
      x + range(rng, -1.6, 1.6) * s,
      y + range(rng, -0.35, 0.35) * s,
      s * range(rng, 0.5, 0.9),
    );
  }
}

function mountains(
  ctx: CanvasRenderingContext2D,
  rng: Rng,
  W: number,
  base: number,
  top: number,
  color: string,
): void {
  // Midpoint displacement ridge.
  let pts = [
    base - range(rng, 0.2, 0.6) * (base - top),
    base - range(rng, 0.2, 0.6) * (base - top),
  ];
  let rough = (base - top) * 0.7;
  for (let it = 0; it < 7; it++) {
    const next: number[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      next.push(pts[i], (pts[i] + pts[i + 1]) / 2 + range(rng, -rough, rough));
    }
    next.push(pts[pts.length - 1]);
    pts = next;
    rough *= 0.55;
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, base);
  pts.forEach((y, i) => ctx.lineTo((i / (pts.length - 1)) * W, Math.max(top, Math.min(base, y))));
  ctx.lineTo(W, base);
  ctx.closePath();
  ctx.fill();
  // Snow caps on the highest points
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  pts.forEach((y, i) => {
    if (y < top + (base - top) * 0.12)
      circle(ctx, (i / (pts.length - 1)) * W, Math.max(top, y) + 4, 5);
  });
}

function balloon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  a: string,
  b: string,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 1.2, 0, 0, Math.PI * 2);
  ctx.clip();
  for (let i = -4; i < 4; i++) {
    ctx.fillStyle = i % 2 === 0 ? a : b;
    ctx.fillRect(x + (i * r) / 2, y - r * 1.3, r / 2, r * 2.6);
  }
  ctx.restore();
  ctx.strokeStyle = '#5a3a1a';
  ctx.lineWidth = Math.max(1, r * 0.04);
  ctx.beginPath();
  ctx.moveTo(x - r * 0.5, y + r * 1.05);
  ctx.lineTo(x - r * 0.2, y + r * 1.55);
  ctx.moveTo(x + r * 0.5, y + r * 1.05);
  ctx.lineTo(x + r * 0.2, y + r * 1.55);
  ctx.stroke();
  ctx.fillStyle = '#8b5a2b';
  ctx.fillRect(x - r * 0.22, y + r * 1.55, r * 0.44, r * 0.3);
}

function boat(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.fillStyle = '#7b3f1d';
  ctx.beginPath();
  ctx.moveTo(x - s, y);
  ctx.lineTo(x + s, y);
  ctx.lineTo(x + s * 0.7, y + s * 0.3);
  ctx.lineTo(x - s * 0.7, y + s * 0.3);
  ctx.fill();
  ctx.fillStyle = '#fdf6e3';
  ctx.beginPath();
  ctx.moveTo(x, y - s * 1.6);
  ctx.lineTo(x, y - s * 0.05);
  ctx.lineTo(x + s * 0.85, y - s * 0.05);
  ctx.fill();
  ctx.fillStyle = '#e63946';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.05, y - s * 1.3);
  ctx.lineTo(x - s * 0.05, y - s * 0.05);
  ctx.lineTo(x - s * 0.7, y - s * 0.05);
  ctx.fill();
}

function house(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.fillStyle = '#f4e1c1';
  ctx.fillRect(x - s / 2, y - s * 0.6, s, s * 0.6);
  ctx.fillStyle = '#b23a2a';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.62, y - s * 0.58);
  ctx.lineTo(x, y - s * 1.05);
  ctx.lineTo(x + s * 0.62, y - s * 0.58);
  ctx.fill();
  ctx.fillStyle = '#5b3a29';
  ctx.fillRect(x - s * 0.1, y - s * 0.32, s * 0.2, s * 0.32);
  ctx.fillStyle = '#7fb8e6';
  ctx.fillRect(x - s * 0.38, y - s * 0.45, s * 0.18, s * 0.15);
  ctx.fillRect(x + s * 0.2, y - s * 0.45, s * 0.18, s * 0.15);
}

function pine(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rng: Rng): void {
  ctx.fillStyle = '#4a2f1b';
  ctx.fillRect(x - s * 0.04, y - s * 0.15, s * 0.08, s * 0.15);
  const g = Math.floor(range(rng, 60, 95));
  ctx.fillStyle = `rgb(20,${g},40)`;
  for (let i = 0; i < 3; i++) {
    const w = s * (0.42 - i * 0.1);
    const ty = y - s * 0.12 - i * s * 0.25;
    ctx.beginPath();
    ctx.moveTo(x - w, ty);
    ctx.lineTo(x, ty - s * 0.45);
    ctx.lineTo(x + w, ty);
    ctx.fill();
  }
}
