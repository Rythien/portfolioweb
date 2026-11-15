/**
 * Draws one frame from engine state. Everything is drawn at logical
 * resolution into an offscreen canvas, then upscaled to the display
 * canvas with image smoothing off, so pixels stay hard at any size.
 */
import { WORLD_W, TUNING, type GameEvent, type GameState } from "./engine.ts";
import { ICE_THICKNESS, type Shard } from "./entities.ts";
import { PALETTE, hexToRgb } from "./palette.ts";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}

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
  particles: Particle[];
  /** Cosmetic randomness (shake, chip spread); never touches the sim. */
  rand: () => number;
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
  let seed = 0x2545f491;
  const rand = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return ((seed >>> 0) % 100000) / 100000;
  };
  return { display, dctx, buf, ctx, w, h, reducedMotion, trail: [], particles: [], rand };
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

/** Small whole crystal: the extra life. */
let _life: HTMLCanvasElement | null = null;
function lifeSprite(): HTMLCanvasElement {
  if (_life) return _life;
  _life = sprite(
    ["..#..", ".#h#.", "#hoh#", "#hoh#", ".#h#.", "..#.."],
    { "#": PALETTE.highlight, h: PALETTE.ice, o: PALETTE.glow },
  );
  return _life;
}

/**
 * Shards are rasterised per pixel (no anti-aliasing) into a cached
 * sprite: facets shaded from a top-left light, a 1 px rim that is red
 * when the shard can hurt.
 */
const shardCache = new WeakMap<Shard, HTMLCanvasElement>();
function inPoly(px: number, py: number, v: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = v.length - 1; i < v.length; j = i++) {
    const [xi, yi] = v[i];
    const [xj, yj] = v[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const ICE_LO = hexToRgb(PALETTE.iceShade);
const ICE_MID = hexToRgb(PALETTE.ice);
const ICE_HI = hexToRgb(PALETTE.highlight);
function shardSprite(sh: Shard): HTMLCanvasElement {
  const hit = shardCache.get(sh);
  if (hit) return hit;
  const w = Math.ceil(sh.w) + 2;
  const h = Math.ceil(sh.h) + 2;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = c.getContext("2d")!;
  const img = x.createImageData(w, h);
  const ox = w / 2;
  const oy = h / 2;
  const inside = (i: number, j: number) => i >= 0 && j >= 0 && i < w && j < h && inPoly(i + 0.5 - ox, j + 0.5 - oy, sh.verts);
  const n = sh.verts.length;
  const danger = hexToRgb(PALETTE.danger);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      if (!inside(i, j)) continue;
      const edge = !inside(i - 1, j) || !inside(i + 1, j) || !inside(i, j - 1) || !inside(i, j + 1);
      let col: number[];
      if (edge) col = danger;
      else {
        // Facet = which fan triangle from the centre this pixel is in
        const a = Math.atan2(j + 0.5 - oy, i + 0.5 - ox);
        const facet = Math.floor(((a + Math.PI) / (Math.PI * 2)) * n) % n;
        const mid = ((facet + 0.5) / n) * Math.PI * 2 - Math.PI;
        const lit = 0.5 + 0.5 * Math.cos(mid - (-Math.PI * 3) / 4);
        const lo = lit < 0.5 ? ICE_LO : ICE_MID;
        const hi = lit < 0.5 ? ICE_MID : ICE_HI;
        const t = lit < 0.5 ? lit * 2 : (lit - 0.5) * 2;
        col = lo.map((v, k) => Math.round(v + (hi[k] - v) * t));
      }
      const o = (j * w + i) * 4;
      img.data[o] = col[0];
      img.data[o + 1] = col[1];
      img.data[o + 2] = col[2];
      img.data[o + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  shardCache.set(sh, c);
  return c;
}

/* ── Particles (cosmetic, world space) ───────────────────── */

function burst(v: View, x: number, y: number, count: number, spreadX: number, colors: string[], up = 1): void {
  for (let i = 0; i < count; i++) {
    const r = v.rand;
    v.particles.push({
      x: x + (r() - 0.5) * spreadX,
      y,
      vx: (r() - 0.5) * 220,
      vy: -60 * up - r() * 160 * up,
      life: 0,
      max: 0.45 + r() * 0.35,
      color: colors[Math.floor(r() * colors.length)],
      size: r() < 0.3 ? 2 : 1,
    });
  }
  if (v.particles.length > 240) v.particles.splice(0, v.particles.length - 240);
}

/** Turn engine events into particles. */
export function applyEvents(v: View, events: GameEvent[]): void {
  const r = v.rand;
  for (const e of events) {
    if (e.type === "shatter" || e.type === "break") {
      const n = 8 + Math.floor(r() * 7);
      burst(v, e.x, e.y, n, 48, [PALETTE.ice, PALETTE.highlight, PALETTE.iceShade]);
    } else if (e.type === "crack") {
      burst(v, e.x, e.y, 4, 10, [PALETTE.ice, PALETTE.highlight]);
    } else if (e.type === "shardBreak") {
      burst(v, e.x, e.y, 8 + Math.floor(r() * 7), e.w * 0.6, [PALETTE.ice, PALETTE.danger, PALETTE.highlight]);
    } else if (e.type === "mote") {
      burst(v, e.x, e.y, 6, 4, [PALETTE.glow, PALETTE.highlight], 0.5);
    } else if (e.type === "life") {
      burst(v, e.x, e.y, 10, 6, [PALETTE.highlight, PALETTE.glow, PALETTE.ice], 0.7);
    }
  }
}

function drawParticles(v: View, camY: number, dt: number): void {
  const { ctx } = v;
  const keep: Particle[] = [];
  for (const p of v.particles) {
    p.life += dt;
    if (p.life >= p.max) continue;
    p.vy += 600 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    ctx.globalAlpha = 1 - p.life / p.max;
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x), Math.round(p.y - camY), p.size, p.size);
    keep.push(p);
  }
  ctx.globalAlpha = 1;
  v.particles = keep;
}

/* ── World ─────────────────────────────────────────────────── */

function drawRows(v: View, s: GameState, camY: number): void {
  const { ctx, h } = v;
  for (const row of s.rows) {
    if (row.broken) continue;
    const sy = row.y - camY;
    if (sy < -40 || sy > h + 40) continue;
    if (row.kind === "ice") {
      const gL = Math.round(row.gapX - row.gapW / 2);
      const gR = Math.round(row.gapX + row.gapW / 2);
      const top = Math.round(sy - ICE_THICKNESS / 2);
      for (const [x0, x1] of [[0, gL], [gR, WORLD_W]]) {
        if (x1 <= x0) continue;
        ctx.fillStyle = PALETTE.ice;
        ctx.globalAlpha = 0.82;
        ctx.fillRect(x0, top + 1, x1 - x0, ICE_THICKNESS - 2);
        ctx.globalAlpha = 1;
        ctx.fillStyle = PALETTE.highlight;
        ctx.fillRect(x0, top, x1 - x0, 1);
        ctx.fillStyle = PALETTE.iceShade;
        ctx.fillRect(x0, top + ICE_THICKNESS - 1, x1 - x0, 1);
        // Frost specks so the bar reads as thin ice, not a wall
        ctx.fillStyle = PALETTE.highlight;
        for (let x = x0 + ((row.id * 7) % 9); x < x1; x += 9) ctx.fillRect(x, top + 2, 1, 1);
        // Gap lips: a brighter pixel either side of the passage
        ctx.fillStyle = PALETTE.gem;
        ctx.fillRect(x0 === 0 ? x1 - 1 : x0, top, 1, ICE_THICKNESS);
      }
      if (row.cracks > 0 && row.crackX >= 0) {
        ctx.fillStyle = PALETTE.bgTop;
        const cx = Math.round(row.crackX);
        const zig = [[0, 0], [1, 1], [2, 2], [1, 3], [3, 4], [-1, 2], [-2, 3], [-3, 1], [-4, 4]];
        for (const [dx, dy] of zig) ctx.fillRect(cx + dx, top + dy, 1, 1);
      }
    } else {
      for (const sh of row.shards) {
        if (sh.broken) continue;
        const spr = shardSprite(sh);
        ctx.drawImage(spr, Math.round(sh.x - spr.width / 2), Math.round(sh.y - camY - spr.height / 2));
      }
    }
  }
}

function drawDrifts(v: View, s: GameState, camY: number, alpha: number): void {
  const { ctx, h } = v;
  for (const d of s.drifts) {
    if (d.gone) continue;
    const sy = Math.round(d.y - camY);
    if (sy < -8 || sy > h + 8) continue;
    // Interpolate along this step's drift so chips glide smoothly
    const x = Math.round(d.x - d.vx * STEP_HINT * (1 - alpha));
    const r = Math.floor(d.size / 2);
    ctx.globalAlpha = d.harmful ? 1 : 0.5;
    ctx.fillStyle = PALETTE.ice;
    ctx.fillRect(x - r, sy, d.size, 1);
    ctx.fillRect(x, sy - r, 1, d.size);
    if (d.harmful) {
      ctx.fillStyle = PALETTE.danger;
      ctx.fillRect(x, sy, 1, 1);
    }
  }
  ctx.globalAlpha = 1;
}
const STEP_HINT = 1 / 120;

function drawPickups(v: View, s: GameState, camY: number): void {
  const { ctx, h } = v;
  for (const pk of s.pickups) {
    if (pk.taken) continue;
    const bob = v.reducedMotion ? 0 : Math.round(Math.sin(s.time * 4 + pk.id) * 1.5);
    const x = Math.round(pk.x);
    const y = Math.round(pk.y - camY) + bob;
    if (y < -10 || y > h + 10) continue;
    if (pk.kind === "mote") {
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = PALETTE.glow;
      ctx.fillRect(x - 2, y - 2, 5, 5);
      ctx.globalAlpha = 1;
      ctx.fillRect(x - 1, y, 3, 1);
      ctx.fillRect(x, y - 1, 1, 3);
      ctx.fillStyle = PALETTE.gem;
      ctx.fillRect(x, y, 1, 1);
    } else {
      const spr = lifeSprite();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = PALETTE.glow;
      ctx.fillRect(x - 4, y - 4, 9, 9);
      ctx.globalAlpha = 1;
      ctx.drawImage(spr, x - 2, y - 3);
    }
  }
}

/* ── Frame ─────────────────────────────────────────────────── */

export function renderFrame(v: View, s: GameState, alpha: number, dt: number): void {
  const { ctx, w, h } = v;
  let camY = lerp(s.prev.camY, s.camY, alpha);
  // Screen shake: decaying, cosmetic, off under reduced motion
  let shakeX = 0;
  if (s.shake > 0 && !v.reducedMotion) {
    const amp = 3 * (s.shake / TUNING.shakeTime);
    shakeX = Math.round((v.rand() - 0.5) * 2 * amp);
    camY += Math.round((v.rand() - 0.5) * 2 * amp);
  }

  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, PALETTE.bgTop);
  g.addColorStop(1, PALETTE.bgBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.translate(shakeX, 0);
  drawRows(v, s, camY);
  drawDrifts(v, s, camY, alpha);
  drawPickups(v, s, camY);
  drawParticles(v, camY, dt);

  const gx = lerp(s.prev.x, s.gem.x, alpha);
  const gy = lerp(s.prev.y, s.gem.y, alpha) - camY;
  drawTrail(v, s, gx, gy + camY, camY);
  // Damage flicker at 3 Hz: within the WCAG 2.3.1 three-flash limit
  const hidden = s.hitInvuln > 0 && Math.floor(s.hitInvuln * 6) % 2 === 1;
  if (!hidden && !s.over) drawGem(ctx, s, gx, gy);
  drawCooldownRing(ctx, s, gx, gy);
  ctx.restore();

  if (s.flash > 0) {
    ctx.globalAlpha = 0.28 * (s.flash / TUNING.flashTime);
    ctx.fillStyle = PALETTE.danger;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }

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
