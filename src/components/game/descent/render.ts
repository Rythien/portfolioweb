/**
 * Draws one frame from engine state. Everything is drawn at logical
 * resolution into an offscreen canvas, then upscaled to the display
 * canvas with image smoothing off, so pixels stay hard at any size.
 */
import { WORLD_W, TUNING, bestLineY, comboMultiplier, type GameEvent, type GameState } from "./engine.ts";
import { ICE_THICKNESS, DIFFICULTY_CAP_METRES, type Shard } from "./entities.ts";
import { PALETTE, BAND_TINTS, hexToRgb, mixHex } from "./palette.ts";
import { drawText, textWidth, glyph, GLYPH_W, GLYPH_H } from "./font.ts";

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
  /** Band tint shown, easing toward the current band's (0..n float). */
  bandShown: number;
  /** Band name banner: elapsed seconds, or -1 when hidden. */
  banner: { name: string; t: number };
  /** Cosmetic randomness (shake, chip spread); never touches the sim. */
  rand: () => number;
  /** Pre-rendered layers (built once per view). */
  fog: HTMLCanvasElement[];
  vignette: HTMLCanvasElement;
  fringe: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; mask: HTMLCanvasElement };
  scanlines: HTMLCanvasElement | null;
  /** Phones: the canvas is full-bleed and the X button sits over it. */
  fullBleed: boolean;
  hud: {
    /** Odometer value, easing toward the score. */
    shown: number;
    /** Flash after passing the best line (s remaining). */
    bestFlash: number;
    /** Seconds since death, or -1. */
    deadT: number;
    /** Stored best before this run, for the death screen. */
    best: number;
  };
  /** First-run controls hint: elapsed seconds, or -1 when not shown. */
  controls: number;
}

export interface FrameOptions {
  touch: boolean;
  paused: boolean;
}

/* ── Pre-rendered layers ───────────────────────────────────── */

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Dithered fog tile: soft blobs quantised to pixels with a Bayer matrix. */
function fogTile(w: number, h: number, seed: number, blobs: number, maxA: number, color: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = c.getContext("2d")!;
  let a = seed >>> 0;
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const field = new Float32Array(w * h);
  for (let b = 0; b < blobs; b++) {
    const cx = r() * w;
    const cy = r() * h;
    const rx = 30 + r() * 70;
    const ry = 10 + r() * 26;
    for (let j = 0; j < h; j++) {
      // Wrap vertically so the tile repeats seamlessly
      for (const oy of [-h, 0, h]) {
        const dy = (j - cy - oy) / ry;
        if (Math.abs(dy) > 1) continue;
        for (let i = 0; i < w; i++) {
          const dx = (i - cx) / rx;
          const d = dx * dx + dy * dy;
          if (d < 1) field[j * w + i] += (1 - d) * (1 - d);
        }
      }
    }
  }
  const img = x.createImageData(w, h);
  const [cr, cg, cb] = hexToRgb(color);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const v = Math.min(1, field[j * w + i] * 0.55) * 16;
      if (v > BAYER4[(j % 4) * 4 + (i % 4)] + 0.5) {
        const o = (j * w + i) * 4;
        img.data[o] = cr;
        img.data[o + 1] = cg;
        img.data[o + 2] = cb;
        img.data[o + 3] = Math.round(maxA * 255);
      }
    }
  }
  x.putImageData(img, 0, 0);
  return c;
}

function vignetteLayer(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(w / 2, h * 0.42, Math.min(w, h) * 0.35, w / 2, h * 0.5, Math.max(w, h) * 0.75);
  g.addColorStop(0, "rgba(3,2,20,0)");
  g.addColorStop(1, "rgba(3,2,20,0.55)");
  x.fillStyle = g;
  x.fillRect(0, 0, w, h);
  return c;
}

/** Alpha mask: opaque at the left and right edges, clear by 14% in. */
function edgeMask(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = c.getContext("2d")!;
  const g = x.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, "rgba(0,0,0,1)");
  g.addColorStop(0.14, "rgba(0,0,0,0)");
  g.addColorStop(0.86, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,1)");
  x.fillStyle = g;
  x.fillRect(0, 0, w, h);
  return c;
}

/** Faint scanlines at device resolution (one line every 3 px). */
function scanlineLayer(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = c.getContext("2d")!;
  x.fillStyle = "rgba(0,0,0,0.13)";
  for (let y = 0; y < h; y += 3) x.fillRect(0, y, w, 1);
  return c;
}

/** Desktop: 320x568 portrait. Phones: full-bleed, height from aspect. */
export function logicalSize(cssW: number, cssH: number, fullBleed: boolean): { w: number; h: number } {
  if (!fullBleed) return { w: WORLD_W, h: 568 };
  return { w: WORLD_W, h: Math.round(Math.max(480, Math.min(760, (WORLD_W * cssH) / cssW))) };
}

export function createView(display: HTMLCanvasElement, w: number, h: number, reducedMotion: boolean, fullBleed = false): View {
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
  const fringeCanvas = document.createElement("canvas");
  fringeCanvas.width = w;
  fringeCanvas.height = h;
  return {
    display, dctx, buf, ctx, w, h, reducedMotion,
    trail: [], particles: [], rand,
    bandShown: 0,
    banner: { name: "", t: -1 },
    fog: [
      // Atmosphere must never compete with obstacles: sparse and faint,
      // nearest layer sparsest
      fogTile(w, 256, 11, 4, 0.1, PALETTE.glow),
      fogTile(w, 256, 23, 3, 0.1, PALETTE.gemShade),
      fogTile(w, 256, 37, 2, 0.07, PALETTE.highlight),
    ],
    vignette: vignetteLayer(w, h),
    fringe: { canvas: fringeCanvas, ctx: fringeCanvas.getContext("2d")!, mask: edgeMask(w, h) },
    scanlines: null,
    fullBleed,
    hud: { shown: 0, bestFlash: 0, deadT: -1, best: 0 },
    controls: -1,
  };
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
    v.scanlines = v.reducedMotion ? null : scanlineLayer(bw, bh);
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
    [
      "....###....",
      "...#hhh#...",
      "..#hhhhh#..",
      ".#hhooohh#.",
      "#hhooooohh#",
      "#hoooWoooh#",
      ".#hoooooh#.",
      "..#hoooh#..",
      "...#hoh#...",
      "....#h#....",
      ".....#.....",
    ],
    { "#": PALETTE.gem, h: PALETTE.gemShade, o: PALETTE.gemCore, W: PALETTE.highlight },
  );
  return _gem;
}

/** Dithered halo behind the gem so it reads against any band. */
let _halo: HTMLCanvasElement | null = null;
function haloSprite(): HTMLCanvasElement {
  if (_halo) return _halo;
  const n = 23;
  const c = document.createElement("canvas");
  c.width = n;
  c.height = n;
  const x = c.getContext("2d")!;
  x.fillStyle = PALETTE.glow;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const d = Math.hypot(i - (n - 1) / 2, j - (n - 1) / 2) / ((n - 1) / 2);
      if (d < 1 && (1 - d) * 16 * 0.7 > BAYER4[(j % 4) * 4 + (i % 4)]) x.fillRect(i, j, 1, 1);
    }
  }
  _halo = c;
  return c;
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
    } else if (e.type === "band") {
      v.banner = { name: e.name, t: 0 };
    } else if (e.type === "best") {
      v.hud.bestFlash = 0.6;
    } else if (e.type === "dead") {
      v.hud.deadT = 0;
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

/* ── Background and band banner ──────────────────────────── */

function bandTint(band: number): string {
  const i = Math.max(0, Math.min(BAND_TINTS.length - 1, band));
  const a = BAND_TINTS[Math.floor(i)];
  const b = BAND_TINTS[Math.min(BAND_TINTS.length - 1, Math.floor(i) + 1)];
  return mixHex(a, b, i - Math.floor(i));
}

/** Vertical gradient: shifts per band, darkens with depth. */
function drawBackground(v: View, s: GameState, dt: number): void {
  const { ctx, w, h } = v;
  // Ease the band tint over about a second
  v.bandShown += (s.band - v.bandShown) * (1 - Math.exp(-3 * dt));
  const d = Math.min(1, s.depth / DIFFICULTY_CAP_METRES);
  const top = mixHex(PALETTE.bgTop, PALETTE.bgDeep, d * 0.8);
  const bottom = mixHex(bandTint(v.bandShown), PALETTE.bgDeep, d * 0.5);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

const BANNER_IN = 0.3;
const BANNER_HOLD = 1.4;
const BANNER_OUT = 0.2;

/** Band name: enters decelerating, holds, leaves faster than it came. */
function drawBanner(v: View, dt: number): void {
  const b = v.banner;
  if (b.t < 0) return;
  b.t += dt;
  const total = BANNER_IN + BANNER_HOLD + BANNER_OUT;
  if (b.t >= total) {
    b.t = -1;
    return;
  }
  let a = 1;
  let dy = 0;
  if (b.t < BANNER_IN) {
    const k = b.t / BANNER_IN;
    const e = 1 - (1 - k) ** 3;
    a = e;
    dy = v.reducedMotion ? 0 : Math.round((1 - e) * -4);
  } else if (b.t > BANNER_IN + BANNER_HOLD) {
    const k = (b.t - BANNER_IN - BANNER_HOLD) / BANNER_OUT;
    a = 1 - k * k;
    dy = v.reducedMotion ? 0 : Math.round(k * k * -3);
  }
  const { ctx, w, h } = v;
  const scale = 2;
  const tw = textWidth(b.name, scale, 1);
  const x = Math.round((w - tw) / 2);
  // Above the gem, in space already fallen through: never over what is coming
  const y = Math.round(h * 0.15) + dy;
  ctx.globalAlpha = a * 0.75;
  ctx.fillStyle = PALETTE.bgDeep;
  ctx.fillRect(x - 18, y - 4, tw + 36, 18);
  ctx.globalAlpha = a;
  // Hairlines either side, like a depth marker on a chart
  ctx.fillStyle = PALETTE.glow;
  ctx.fillRect(x - 14, y + 4, 9, 1);
  ctx.fillRect(x + tw + 5, y + 4, 9, 1);
  drawText(ctx, b.name, x, y, PALETTE.highlight, scale, 1);
  ctx.globalAlpha = 1;
}

/* ── HUD ───────────────────────────────────────────────────── */

const HUD_PAD = 8;

/**
 * Odometer: each digit cell scrolls. The lowest digit rolls with the
 * fractional part; a higher digit rolls only while every digit below it
 * is passing 9, like a mechanical counter. Only the last 35% of each
 * step moves, so digits read as settled most of the time.
 */
function drawOdometer(ctx: CanvasRenderingContext2D, value: number, right: number, y: number, scale: number, color: string, roll: boolean): number {
  const v = Math.max(0, value);
  const digits = Math.max(1, Math.floor(v).toString().length);
  const adv = (GLYPH_W + 1) * scale;
  const cellH = GLYPH_H * scale;
  let x = right - digits * adv + scale;
  let carry = roll ? v % 1 : 0;
  const offsets: number[] = [];
  for (let i = 0; i < digits; i++) {
    const place = 10 ** i;
    const d = Math.floor(v / place) % 10;
    const k = carry <= 0.65 ? 0 : (carry - 0.65) / 0.35;
    offsets[i] = k;
    carry = d === 9 ? carry : 0;
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 1, y, digits * adv + 2, cellH);
  ctx.clip();
  ctx.fillStyle = color;
  for (let i = digits - 1; i >= 0; i--) {
    const d = Math.floor(v / 10 ** i) % 10;
    const off = Math.round(offsets[i] * (cellH + scale));
    for (const [digit, dy] of [[d, -off], [(d + 1) % 10, cellH + scale - off]]) {
      if (dy <= -cellH - scale || dy >= cellH + scale) continue;
      const bits = glyph(String(digit));
      for (let b = 0; b < 15; b++) {
        if (bits[b] === "1") ctx.fillRect(x + (b % 3) * scale, y + dy + Math.floor(b / 3) * scale, scale, scale);
      }
    }
    x += adv;
  }
  ctx.restore();
  return digits * adv - scale;
}

/** A life crystal: filled when held, outline when lost. */
function drawLife(ctx: CanvasRenderingContext2D, x: number, y: number, full: boolean): void {
  const rows = ["..#..", ".###.", "#####", "#####", ".###.", "..#.."];
  rows.forEach((r, j) =>
    [...r].forEach((c, i) => {
      if (c !== "#") return;
      const edge = j === 0 || j === rows.length - 1 || i === 0 || i === 4 || r[i - 1] !== "#" || r[i + 1] !== "#";
      if (full) ctx.fillStyle = edge ? PALETTE.highlight : PALETTE.glow;
      else if (edge) ctx.fillStyle = PALETTE.hudDim;
      else return;
      ctx.fillRect(x + i, y + j, 1, 1);
    }),
  );
}

function drawBestLine(v: View, s: GameState, camY: number): void {
  const y = bestLineY(s);
  if (y === null) return;
  const sy = Math.round(y - camY);
  if (sy < -4 || sy > v.h + 4) return;
  const { ctx, w } = v;
  ctx.fillStyle = PALETTE.highlight;
  ctx.globalAlpha = 0.7;
  for (let x = 0; x < w; x += 4) ctx.fillRect(x, sy, 2, 1);
  ctx.globalAlpha = 1;
  const label = "BEST " + Math.floor(s.cfg.best ?? 0) + " M";
  const tw = textWidth(label);
  ctx.fillStyle = PALETTE.bgDeep;
  ctx.fillRect(w - HUD_PAD - tw - 3, sy - 4, tw + 6, 9);
  drawText(ctx, label, w - HUD_PAD - tw, sy - 2, PALETTE.highlight);
}

function drawHud(v: View, s: GameState, dt: number): void {
  const { ctx, w } = v;
  const hud = v.hud;
  // Odometer eases toward the score; reduced motion cuts to it
  hud.shown = v.reducedMotion ? s.score : hud.shown + (s.score - hud.shown) * (1 - Math.exp(-14 * dt));
  if (Math.abs(s.score - hud.shown) < 0.02) hud.shown = s.score;

  // Depth: the one large element. Tabular by construction.
  const scale = 2;
  const digits = Math.max(1, Math.floor(hud.shown).toString().length);
  const width = digits * (GLYPH_W + 1) * scale - scale;
  drawOdometer(ctx, hud.shown, HUD_PAD + width, HUD_PAD, scale, PALETTE.hud, !v.reducedMotion);
  drawText(ctx, "M", HUD_PAD + width + 3, HUD_PAD + GLYPH_H * scale - GLYPH_H, PALETTE.hudDim);

  // Combo under the depth, only above 1x
  const mult = comboMultiplier(s.combo);
  if (mult > 1) {
    const label = "x" + (mult % 1 ? mult.toFixed(1) : String(mult)) + "  " + s.combo;
    drawText(ctx, label, HUD_PAD, HUD_PAD + GLYPH_H * scale + 4, PALETTE.glow);
  }

  // Lives, top right; on phones they sit left of the X button
  const livesRight = v.fullBleed ? w - HUD_PAD - 34 : w - HUD_PAD;
  for (let i = 0; i < TUNING.lives; i++) {
    drawLife(ctx, livesRight - (TUNING.lives - i) * 8 + 3, HUD_PAD + 1, i < s.lives);
  }

  if (hud.bestFlash > 0) {
    hud.bestFlash = Math.max(0, hud.bestFlash - dt);
    const label = "NEW BEST";
    ctx.globalAlpha = Math.min(1, hud.bestFlash / 0.2);
    drawText(ctx, label, Math.round((w - textWidth(label, 2)) / 2), Math.round(v.h * 0.22), PALETTE.highlight, 2);
    ctx.globalAlpha = 1;
  }
}

/** Death screen: depth, best, how to leave or go again. */
function drawDeath(v: View, s: GameState, dt: number, touch: boolean): void {
  const hud = v.hud;
  if (hud.deadT < 0) return;
  hud.deadT += dt;
  const { ctx, w, h } = v;
  const a = v.reducedMotion ? 1 : Math.min(1, hud.deadT / 0.3);
  ctx.globalAlpha = 0.86 * a;
  ctx.fillStyle = PALETTE.bgDeep;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = a;
  const cx = (t: string, sc: number) => Math.round((w - textWidth(t, sc)) / 2);
  let y = Math.round(h * 0.3);
  drawText(ctx, "DEPTH", cx("DEPTH", 1), y, PALETTE.hudDim);
  y += 10;
  const score = Math.floor(s.score) + " M";
  drawText(ctx, score, cx(score, 3), y, PALETTE.highlight, 3);
  y += 26;
  const best = Math.max(hud.best, Math.floor(s.score));
  const bestLabel = s.score > hud.best && hud.best > 0 ? "NEW BEST" : "BEST " + best + " M";
  drawText(ctx, bestLabel, cx(bestLabel, 1), y, s.score > hud.best && hud.best > 0 ? PALETTE.glow : PALETTE.hud);
  y += 30;
  const lines = touch ? ["TAP TO FALL AGAIN", "X TO WAKE"] : ["R TO FALL AGAIN", "ESC TO WAKE"];
  for (const l of lines) {
    drawText(ctx, l, cx(l, 1), y, PALETTE.hud);
    y += 12;
  }
  ctx.globalAlpha = 1;
}

/* ── Controls hint and pause ─────────────────────────────── */

/** Pixel keycap: a 1 px outlined box with a glyph inside. */
function keycap(ctx: CanvasRenderingContext2D, x: number, y: number, label: string): number {
  const w = Math.max(9, textWidth(label) + 6);
  ctx.fillStyle = PALETTE.hudDim;
  ctx.fillRect(x + 1, y, w - 2, 1);
  ctx.fillRect(x + 1, y + 10, w - 2, 1);
  ctx.fillRect(x, y + 1, 1, 9);
  ctx.fillRect(x + w - 1, y + 1, 1, 9);
  ctx.fillStyle = PALETTE.bgDeep;
  ctx.fillRect(x + 1, y + 1, w - 2, 9);
  drawText(ctx, label, x + Math.round((w - textWidth(label)) / 2), y + 3, PALETTE.highlight);
  return w;
}

/** Arrow glyphs (the font has none): 3x5, pointing left or right. */
function arrow(ctx: CanvasRenderingContext2D, x: number, y: number, dir: -1 | 1): void {
  ctx.fillStyle = PALETTE.highlight;
  const rows = dir < 0 ? ["001", "011", "111", "011", "001"] : ["100", "110", "111", "110", "100"];
  rows.forEach((r, j) => [...r].forEach((c, i) => c === "1" && ctx.fillRect(x + i, y + j, 1, 1)));
}

const CONTROLS_SECONDS = 3;

/** Shown for the first 3 s of the first run only. */
function drawControls(v: View, dt: number, touch: boolean): void {
  if (v.controls < 0) return;
  v.controls += dt;
  if (v.controls >= CONTROLS_SECONDS) {
    v.controls = -1;
    return;
  }
  const { ctx, w, h } = v;
  const t = v.controls;
  const a = Math.min(1, t / 0.25, (CONTROLS_SECONDS - t) / 0.3);
  ctx.globalAlpha = a;
  const y0 = Math.round(h * 0.5);
  ctx.globalAlpha = a * 0.8;
  ctx.fillStyle = PALETTE.bgDeep;
  ctx.fillRect(Math.round(w / 2 - 74), y0 - 6, 148, touch ? 34 : 50);
  ctx.globalAlpha = a;
  if (touch) {
    const l1 = "DRAG TO STEER";
    const l2 = "TAP TO DASH";
    drawText(ctx, l1, Math.round((w - textWidth(l1)) / 2), y0 + 2, PALETTE.highlight);
    drawText(ctx, l2, Math.round((w - textWidth(l2)) / 2), y0 + 14, PALETTE.highlight);
  } else {
    let x = Math.round(w / 2 - 66);
    const cap = (label: string) => {
      const cw = keycap(ctx, x, y0, label);
      x += cw + 2;
      return cw;
    };
    const lx = x;
    cap("  ");
    arrow(ctx, lx + 3, y0 + 3, -1);
    const rx = x;
    cap("  ");
    arrow(ctx, rx + 4, y0 + 3, 1);
    x += 2;
    cap("A");
    cap("D");
    drawText(ctx, "STEER", x + 4, y0 + 3, PALETTE.hud);
    x = Math.round(w / 2 - 66);
    const y1 = y0 + 15;
    const sx = x;
    const sw = keycap(ctx, sx, y1, "SPACE");
    x = sx + sw + 2;
    keycap(ctx, x, y1, "  ");
    // Down arrow
    ctx.fillStyle = PALETTE.highlight;
    ["11111", ".111.", "..1.."].forEach((r, j) => [...r].forEach((c, i) => c === "1" && ctx.fillRect(x + 2 + i, y1 + 4 + j, 1, 1)));
    drawText(ctx, "DASH", x + 15, y1 + 3, PALETTE.hud);
    const l3 = "OR MOUSE: MOVE + CLICK";
    drawText(ctx, l3, Math.round((w - textWidth(l3)) / 2), y1 + 17, PALETTE.hudDim);
  }
  ctx.globalAlpha = 1;
}

function drawPaused(v: View, touch: boolean): void {
  const { ctx, w, h } = v;
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = PALETTE.bgDeep;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1;
  const t1 = "PAUSED";
  const t2 = touch ? "TAP TO RESUME" : "P TO RESUME";
  drawText(ctx, t1, Math.round((w - textWidth(t1, 2)) / 2), Math.round(h * 0.42), PALETTE.highlight, 2);
  drawText(ctx, t2, Math.round((w - textWidth(t2)) / 2), Math.round(h * 0.42) + 18, PALETTE.hud);
}

/* ── Frame ─────────────────────────────────────────────────── */

export function renderFrame(v: View, s: GameState, alpha: number, dt: number, opts: FrameOptions): void {
  const { touch } = opts;
  const { ctx, w, h } = v;
  let camY = lerp(s.prev.camY, s.camY, alpha);
  // Screen shake: decaying, cosmetic, off under reduced motion
  let shakeX = 0;
  if (s.shake > 0 && !v.reducedMotion) {
    const amp = 3 * (s.shake / TUNING.shakeTime);
    shakeX = Math.round((v.rand() - 0.5) * 2 * amp);
    camY += Math.round((v.rand() - 0.5) * 2 * amp);
  }

  drawBackground(v, s, dt);
  drawFog(v, camY);

  ctx.save();
  ctx.translate(shakeX, 0);
  drawBestLine(v, s, camY);
  drawRows(v, s, camY);
  drawDrifts(v, s, camY, alpha);
  drawPickups(v, s, camY);
  drawParticles(v, camY, dt);

  const gx = lerp(s.prev.x, s.gem.x, alpha);
  const gy = lerp(s.prev.y, s.gem.y, alpha) - camY;
  drawTrail(v, s, gx, gy + camY, camY);
  // Damage flicker at 3 Hz: within the WCAG 2.3.1 three-flash limit
  const hidden = s.hitInvuln > 0 && Math.floor(s.hitInvuln * 6) % 2 === 1;
  if (!hidden && !s.over) {
    const halo = haloSprite();
    ctx.globalAlpha = 0.35;
    ctx.drawImage(halo, Math.round(gx - halo.width / 2), Math.round(gy - halo.height / 2));
    ctx.globalAlpha = 1;
    drawGem(ctx, s, gx, gy);
  }
  drawCooldownRing(ctx, s, gx, gy);
  ctx.restore();

  ctx.drawImage(v.vignette, 0, 0);
  drawBanner(v, dt);
  drawHud(v, s, dt);

  if (s.flash > 0) {
    ctx.globalAlpha = 0.28 * (s.flash / TUNING.flashTime);
    ctx.fillStyle = PALETTE.danger;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }
  drawControls(v, dt, touch);
  drawDeath(v, s, dt, touch);
  if (opts.paused && !s.over) drawPaused(v, touch);

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

/** Three parallax fog layers at 0.3 / 0.6 / 1.0 of the camera. */
const FOG_RATES = [0.3, 0.6, 1.0];
function drawFog(v: View, camY: number): void {
  const { ctx, h } = v;
  v.fog.forEach((tile, i) => {
    // Reduced motion: no parallax, the fog holds still
    const off = v.reducedMotion ? 0 : (((camY * FOG_RATES[i]) % tile.height) + tile.height) % tile.height;
    for (let y = -off; y < h; y += tile.height) ctx.drawImage(tile, 0, Math.round(y));
  });
}

/** Slight red/cyan fringe at the left and right edges. */
function drawFringe(v: View): void {
  const { ctx, w, h, buf } = v;
  const f = v.fringe;
  for (const [tint, dx] of [["#ff3d7f", -1], ["#3dd8ff", 1]] as const) {
    f.ctx.globalCompositeOperation = "copy";
    f.ctx.drawImage(buf, 0, 0);
    f.ctx.globalCompositeOperation = "multiply";
    f.ctx.fillStyle = tint;
    f.ctx.fillRect(0, 0, w, h);
    f.ctx.globalCompositeOperation = "destination-in";
    f.ctx.drawImage(f.mask, 0, 0);
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.35;
    ctx.drawImage(f.canvas, dx, 0);
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
}

function blit(v: View): void {
  if (!v.reducedMotion) drawFringe(v);
  const { dctx, display, buf } = v;
  dctx.imageSmoothingEnabled = false;
  dctx.drawImage(buf, 0, 0, display.width, display.height);
  if (v.scanlines) dctx.drawImage(v.scanlines, 0, 0);
}
