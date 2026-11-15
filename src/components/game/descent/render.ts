/**
 * Draws one frame from engine state. Everything is drawn at logical
 * resolution into an offscreen canvas, then upscaled to the display
 * canvas with image smoothing off, so pixels stay hard at any size.
 */
import { WORLD_W, TUNING, type GameState } from "./engine.ts";
import { PALETTE } from "./palette.ts";

export interface View {
  display: HTMLCanvasElement;
  dctx: CanvasRenderingContext2D;
  buf: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** Logical size. */
  w: number;
  h: number;
  reducedMotion: boolean;
  /** Recent interpolated gem positions while dashing (world space). */
  trail: { x: number; y: number }[];
}

/** Desktop: 320x568 portrait. Phones: full-bleed, height from aspect. */
export function logicalSize(cssW: number, cssH: number, fullBleed: boolean): { w: number; h: number } {
  if (!fullBleed) return { w: WORLD_W, h: 568 };
  return { w: WORLD_W, h: Math.round(Math.max(480, Math.min(760, (WORLD_W * cssH) / cssW))) };
}

export function createView(display: HTMLCanvasElement, w: number, h: number, reducedMotion: boolean): View {
  const buf = document.createElement("canvas");
  buf.width = w;
  buf.height = h;
  const ctx = buf.getContext("2d")!;
  const dctx = display.getContext("2d")!;
  return { display, dctx, buf, ctx, w, h, reducedMotion, trail: [] };
}

/** Size the display backing store to its CSS box at device pixels. */
export function fitDisplay(v: View): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const r = v.display.getBoundingClientRect();
  const bw = Math.max(1, Math.round(r.width * dpr));
  const bh = Math.max(1, Math.round(r.height * dpr));
  if (v.display.width !== bw || v.display.height !== bh) {
    v.display.width = bw;
    v.display.height = bh;
  }
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* ── Sprites (built once) ──────────────────────────────────── */

function sprite(rows: string[], colors: Record<string, string>): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = rows[0].length;
  c.height = rows.length;
  const x = c.getContext("2d")!;
  rows.forEach((r, j) =>
    [...r].forEach((ch, i) => {
      const col = colors[ch];
      if (col) {
        x.fillStyle = col;
        x.fillRect(i, j, 1, 1);
      }
    }),
  );
  return c;
}

let _gem: HTMLCanvasElement | null = null;
function gemSprite(): HTMLCanvasElement {
  if (_gem) return _gem;
  _gem = sprite(
    ["...###...", "..#hhh#..", ".#hhhhh#.", "#hhooohh#", "#hoooooh#", ".#hoooh#.", "..#hoh#..", "...#h#...", "....#...."],
    { "#": PALETTE.gem, h: PALETTE.gemShade, o: PALETTE.gemCore },
  );
  return _gem;
}

/* ── Frame ─────────────────────────────────────────────────── */

export function renderFrame(v: View, s: GameState, alpha: number): void {
  const { ctx, w, h } = v;
  const camY = lerp(s.prev.camY, s.camY, alpha);

  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, PALETTE.bgTop);
  g.addColorStop(1, PALETTE.bgBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const gx = lerp(s.prev.x, s.gem.x, alpha);
  const gy = lerp(s.prev.y, s.gem.y, alpha) - camY;
  drawTrail(v, s, gx, gy + camY, camY);
  drawGem(ctx, s, gx, gy);
  drawCooldownRing(ctx, s, gx, gy);

  blit(v);
}

/** Short light trail behind the gem while dashing. */
function drawTrail(v: View, s: GameState, gx: number, wy: number, camY: number): void {
  const dashing = s.dashT > 0 || (s.decayT >= 0 && s.decayT < 0.18);
  if (dashing) {
    v.trail.push({ x: gx, y: wy });
    if (v.trail.length > 9) v.trail.shift();
  } else if (v.trail.length) {
    v.trail.shift();
  }
  const { ctx } = v;
  const n = v.trail.length;
  for (let i = 0; i < n - 1; i++) {
    const a = v.trail[i];
    const k = (i + 1) / n;
    ctx.globalAlpha = 0.55 * k;
    ctx.fillStyle = i > n - 4 ? PALETTE.highlight : PALETTE.glow;
    const wdt = 1 + Math.round(2 * k);
    // World-space points: the gem has fallen past them, so they streak
    // upward behind it
    const b = v.trail[i + 1];
    const y0 = Math.round(a.y - camY);
    ctx.fillRect(Math.round(a.x - wdt / 2), y0, wdt, Math.max(1, Math.round(b.y - a.y)));
  }
  ctx.globalAlpha = 1;
}

/** Gem with wall squash (anchored to the wall) and a dash stretch. */
function drawGem(ctx: CanvasRenderingContext2D, s: GameState, gx: number, gy: number): void {
  const spr = gemSprite();
  let w = spr.width;
  let h = spr.height;
  let x = gx - w / 2;
  if (s.squash.t > 0) {
    const k = s.squash.t / TUNING.wallSquashTime;
    const sq = Math.round(TUNING.wallSquashPx * k);
    w -= sq;
    h += Math.round(sq / 2);
    x = s.squash.side < 0 ? gx - spr.width / 2 : gx + spr.width / 2 - w;
  } else if (s.dashT > 0) {
    w -= 2;
    h += 3;
    x = gx - w / 2;
  }
  ctx.drawImage(spr, Math.round(x), Math.round(gy - h / 2), w, h);
}

/** Dash cooldown as a pixel ring that fills clockwise; gone when ready. */
function drawCooldownRing(ctx: CanvasRenderingContext2D, s: GameState, gx: number, gy: number): void {
  if (s.cooldown <= 0) return;
  const progress = 1 - s.cooldown / TUNING.dashCooldown;
  const N = 28;
  const R = 9;
  for (let i = 0; i < N; i++) {
    const a = -Math.PI / 2 + (i / N) * Math.PI * 2;
    ctx.fillStyle = i / N < progress ? PALETTE.glow : "rgba(143,123,255,0.22)";
    ctx.fillRect(Math.round(gx + Math.cos(a) * R), Math.round(gy + Math.sin(a) * R), 1, 1);
  }
}

function blit(v: View): void {
  const { dctx, display, buf } = v;
  dctx.imageSmoothingEnabled = false;
  dctx.drawImage(buf, 0, 0, display.width, display.height);
}
