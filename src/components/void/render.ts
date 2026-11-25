/**
 * THE VOID, step 1: drawing. Everything is drawn at the logical 480 x 270
 * into an offscreen canvas; the shell scales it up by an integer with
 * smoothing off. All art is made here in code: sprites from pixel maps,
 * the island from the room's tiles. Built once; nothing is allocated per
 * frame.
 *
 * Palette (palette.ts): a dark void, a dark dithered violet floor, pale
 * ice only as lit accents (north rims, cliff lips, icicles), violet
 * enemies outlined dark, and the gem, white, the brightest thing there.
 */
import {
  COLS, Charge, EnemyKind, Kind, ROWS, Spit, TILE, TRAIL, TUNE, VIEW, iceAt, isDashing, shakeOffset, transitionVeil,
  type Enemy, type Room, type World,
} from "./engine";
import { COLOR } from "./palette";

export { COLOR };

/** Particle palette, indexed by Particle.color (3, white, is only the gem's own shatter). */
const PARTICLE = [COLOR.ice0, COLOR.ice1, COLOR.energy1, COLOR.white] as const;

/* ── Sprites from pixel maps ───────────────────────────────────── */

function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/** A sprite from rows of characters; `.` is transparent. */
function sprite(rows: string[], key: Record<string, string>): HTMLCanvasElement {
  const c = canvas(rows[0].length, rows.length);
  const x = c.getContext("2d")!;
  rows.forEach((row, j) =>
    [...row].forEach((ch, i) => {
      if (ch === ".") return;
      x.fillStyle = key[ch];
      x.fillRect(i, j, 1, 1);
    }),
  );
  return c;
}

/** The same shape in one flat colour (flash, afterimage). */
function silhouette(src: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const c = canvas(src.width, src.height);
  const x = c.getContext("2d")!;
  x.drawImage(src, 0, 0);
  x.globalCompositeOperation = "source-in";
  x.fillStyle = color;
  x.fillRect(0, 0, c.width, c.height);
  return c;
}

// White, lit from the top left (W), pale ice facets below (a, c), inside a
// dark 1 px outline that separates it from any tile
const GEM = [
  ".....OO.....",
  "....OWWO....",
  "...OWWWaO...",
  "..OWWWWaaO..",
  ".OWWWWWaaaO.",
  "OWWWWWWaaaaO",
  "OaaaaaaccccO",
  ".OaaaaacccO.",
  "..OaaaaccO..",
  "...OaaacO...",
  "....OacO....",
  ".....OO.....",
];
const DRIFTER = [
  "...OOOOO...",
  "..OvvvvvO..",
  ".OvhvvvvsO.",
  "OvhvvvvvvsO",
  "OvvpppvvvsO",
  "OvvpPpvvvsO",
  "OvvpppvvssO",
  "OvvvvvvvssO",
  ".OvvvvvssO.",
  "..OsssssO..",
  "...OOOOO...",
];
// Wider, horned, two danger eyes: reads apart from the round drifter by shape
const CHARGER = [
  "..O.......O..",
  ".OiO.....OiO.",
  ".OvvOOOOOvvO.",
  "OvvvvvvvvvvvO",
  "OvhhvvvvvvvsO",
  "OvhpPvvvPpvsO",
  "OvvppvvvppvsO",
  "OvvvvvvvvvssO",
  "OsvvvvvvvvssO",
  ".OssvvvvvssO.",
  "..OsssssssO..",
  "...OOOOOOO...",
];
// Tall, a round mouth (m / M) that glows danger red in its tell
const SPITTER = [
  "....OOO....",
  "...OvvvO...",
  "..OvhvvsO..",
  ".OvhvvvvsO.",
  ".OvvmmmvsO.",
  "OvvmMMMmvsO",
  "OvvmMMMmvsO",
  ".OvvmmmvsO.",
  ".OvvvvvvsO.",
  "..OvsvssO..",
  "..OsO.OsO..",
  "...O...O...",
];
// The bolt: violet, a pale core
const BOLT = [
  ".vVv.",
  "vVWVv",
  "VWWWV",
  "vVWVv",
  ".vVv.",
];
const HEART = [
  ".hh.hh.",
  "hHHhhhh",
  "hHhhhhh",
  ".hhhhh.",
  "..hhh..",
  "...h...",
];

export interface Atlas {
  gem: HTMLCanvasElement;
  gemGlow: HTMLCanvasElement;
  gemGhost: HTMLCanvasElement;
  drifter: HTMLCanvasElement;
  drifterFlash: HTMLCanvasElement;
  charger: HTMLCanvasElement;
  chargerFlash: HTMLCanvasElement;
  /** The windup tint: the charger in danger red. */
  chargerTell: HTMLCanvasElement;
  chargerGhost: HTMLCanvasElement;
  spitter: HTMLCanvasElement;
  spitterFlash: HTMLCanvasElement;
  /** The tell: the mouth lit. */
  spitterTell: HTMLCanvasElement;
  bolt: HTMLCanvasElement;
  heart: HTMLCanvasElement;
  heartEmpty: HTMLCanvasElement;
  shadow: HTMLCanvasElement;
  island: HTMLCanvasElement;
  sky: HTMLCanvasElement;
}

export function buildAtlas(room: Room): Atlas {
  const gem = sprite(GEM, { O: COLOR.void0, W: COLOR.white, a: COLOR.ice1, c: COLOR.ice0 });
  // Violet body, shaded, a dark outline; the danger eye is the read
  const drifter = sprite(DRIFTER, {
    O: COLOR.void0, v: COLOR.energy1, s: COLOR.energy0, h: COLOR.energy1, p: COLOR.danger, P: COLOR.dangerHot,
  });
  const charger = sprite(CHARGER, {
    O: COLOR.void0, v: COLOR.energy1, s: COLOR.energy0, h: COLOR.ice0, i: COLOR.ice0, p: COLOR.danger, P: COLOR.dangerHot,
  });
  const spitterKey = { O: COLOR.void0, v: COLOR.energy1, s: COLOR.energy0, h: COLOR.ice0, m: COLOR.energy0, M: COLOR.deep };
  const spitter = sprite(SPITTER, spitterKey);
  const spitterTell = sprite(SPITTER, { ...spitterKey, m: COLOR.danger, M: COLOR.dangerHot });
  const heart = sprite(HEART, { h: COLOR.danger, H: COLOR.dangerHot });
  const shadow = canvas(12, 4);
  {
    const x = shadow.getContext("2d")!;
    x.fillStyle = COLOR.void0;
    // A pixel ellipse: 6 / 10 / 10 / 6 wide
    [[3, 6], [1, 10], [1, 10], [3, 6]].forEach(([o, w], j) => x.fillRect(o, j, w, 1));
  }
  return {
    gem,
    gemGlow: buildGlow(),
    gemGhost: silhouette(gem, COLOR.energy1),
    drifter,
    drifterFlash: silhouette(drifter, COLOR.white),
    charger,
    chargerFlash: silhouette(charger, COLOR.white),
    chargerTell: silhouette(charger, COLOR.danger),
    chargerGhost: silhouette(charger, COLOR.energy1),
    spitter,
    spitterFlash: silhouette(spitter, COLOR.white),
    spitterTell,
    bolt: sprite(BOLT, { v: COLOR.energy0, V: COLOR.energy1, W: COLOR.ice1 }),
    heart,
    heartEmpty: silhouette(heart, COLOR.energy0),
    shadow,
    island: buildIsland(room),
    sky: buildSky(),
  };
}

/** The void: flat, the darkest value on screen (no smooth gradient: pixels only). */
function buildSky(): HTMLCanvasElement {
  const c = canvas(VIEW.w, VIEW.h);
  const x = c.getContext("2d")!;
  x.fillStyle = COLOR.void0;
  x.fillRect(0, 0, VIEW.w, VIEW.h);
  return c;
}

/** The gem's faint glow: soft pixel rings of energy violet, drawn behind it. */
function buildGlow(): HTMLCanvasElement {
  const c = canvas(24, 24);
  const x = c.getContext("2d")!;
  x.fillStyle = COLOR.energy1;
  for (let j = 0; j < 24; j++)
    for (let i = 0; i < 24; i++) {
      const d = Math.hypot(i + 0.5 - 12, (j + 0.5 - 12) * 1.15);
      const a = d < 7 ? 0.38 : d < 9.5 ? 0.2 : d < 11.5 ? 0.08 : 0;
      if (!a) continue;
      x.globalAlpha = a;
      x.fillRect(i, j, 1, 1);
    }
  return c;
}

/** 4x4 ordered (Bayer) dither thresholds, 0..15. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Smooth 2D value noise in [0, 1], the floor's dither field. */
function noise2(x: number, y: number, k: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, k), b = hash(ix + 1, iy, k), c = hash(ix, iy + 1, k), d = hash(ix + 1, iy + 1, k);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

/** Seeded hash for the island's static detail. */
function hash(i: number, j: number, k: number): number {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(k, 1440662683);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** A new room: its island is pre-rendered once, here. */
export function rebuildIsland(A: Atlas, room: Room): void {
  A.island = buildIsland(room);
}

/**
 * The island, three-quarter view: a DARK violet top face, two tones
 * ordered-dithered over a slow noise field (texture, not a gradient), with
 * sparse specks and hairline cracks; pale ice only where light catches: a
 * lit north rim, the cliff's top lip and the icicle tips. Below every
 * south edge, a cliff of violet strata over the void.
 */
function buildIsland(room: Room): HTMLCanvasElement {
  // Written as pixels into one ImageData: one fillRect per pixel took
  // ~30 ms and dropped a frame on every room change
  const c = canvas(VIEW.w, VIEW.h);
  const x = c.getContext("2d")!;
  const img = x.createImageData(VIEW.w, VIEW.h);
  const px32 = new Uint32Array(img.data.buffer);
  const rgba = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return ((255 << 24) | ((n & 255) << 16) | (n & 0xff00) | ((n >> 16) & 255)) >>> 0; // little-endian ABGR
  };
  const K = {
    ice0: rgba(COLOR.ice0), ice1: rgba(COLOR.ice1), energy0: rgba(COLOR.energy0), energy1: rgba(COLOR.energy1),
    deep: rgba(COLOR.deep), floorA: rgba(COLOR.floorA), floorB: rgba(COLOR.floorB),
  };
  const put = (X: number, Y: number, v: number) => {
    if (X >= 0 && Y >= 0 && X < VIEW.w && Y < VIEW.h) px32[Y * VIEW.w + X] = v;
  };
  const ice = (i: number, j: number) => i >= 0 && j >= 0 && i < COLS && j < ROWS && room.ice[j * COLS + i] === 1;
  // Cliffs first (they hang below the top faces)
  for (let j = 0; j < ROWS; j++)
    for (let i = 0; i < COLS; i++) {
      if (!ice(i, j) || ice(i, j + 1)) continue;
      const y0 = (j + 1) * TILE;
      for (let px = 0; px < TILE; px++) {
        const X = i * TILE + px;
        const drop = 8 + Math.floor(hash(X, j, 1) * 4) + (hash(X >> 1, j, 2) > 0.8 ? 4 : 0);
        for (let py = 0; py < drop; py++) {
          let v = py === 0 ? K.ice0 : py < 4 ? K.energy0 : K.deep;
          if (py >= 2 && hash(X, py, j) > 0.93) v = K.energy1; // a glint in the strata
          if (py === drop - 1 && drop >= 12) v = K.ice0; // an icicle tip catching light
          put(X, y0 + py, v);
        }
      }
    }
  // Top faces
  for (let j = 0; j < ROWS; j++)
    for (let i = 0; i < COLS; i++) {
      if (!ice(i, j)) continue;
      const X = i * TILE, Y = j * TILE;
      for (let py = 0; py < TILE; py++)
        for (let px = 0; px < TILE; px++) {
          const gx = X + px, gy = Y + py;
          // Two floor tones dithered over a slow field: patches, not a ramp
          const field = noise2(gx / 22, gy / 16, 5) * 0.8 + noise2(gx / 7, gy / 6, 6) * 0.2;
          let v = field * 16 > BAYER[(gx & 3) + (gy & 3) * 4] + 0.5 ? K.floorB : K.floorA;
          if (hash(gx, gy, 7) > 0.985) v = K.energy0;
          put(gx, gy, v);
        }
      // Rims: lit ice to the north (the accent), violet at the sides
      if (!ice(i, j - 1)) for (let k = 0; k < TILE; k++) put(X + k, Y, K.ice1);
      if (!ice(i - 1, j)) for (let k = 0; k < TILE; k++) put(X, Y + k, K.energy1);
      if (!ice(i + 1, j)) for (let k = 0; k < TILE; k++) put(X + TILE - 1, Y + k, K.energy1);
    }
  // A few long hairline cracks across the floor
  for (let n = 0; n < 7; n++) {
    let cx = 40 + hash(n, 1, 9) * 400, cy = 40 + hash(n, 2, 9) * 190;
    let a = hash(n, 3, 9) * Math.PI * 2;
    for (let s = 0; s < 26; s++) {
      if (ice(Math.floor(cx / TILE), Math.floor(cy / TILE))) put(Math.round(cx), Math.round(cy), K.energy0);
      a += (hash(n, s, 4) - 0.5) * 0.9;
      cx += Math.cos(a);
      cy += Math.sin(a) * 0.6;
    }
  }
  x.putImageData(img, 0, 0);
  return c;
}

/* ── Per-frame drawing ─────────────────────────────────────────── */

/** Ambient motes in the void (the third motion layer). Render-owned. */
const MOTES = 46;
export interface Ambient {
  mx: Float32Array;
  my: Float32Array;
  ms: Float32Array;
  /** Draw order, reused every frame: 0 = the gem, k + 1 = drifter k. */
  order: Int16Array;
  depth: Float32Array;
  shake: { x: number; y: number };
  /** The cooldown ring's "ready" blink. */
  wasCooling: boolean;
  readyBlink: number;
}

export function createAmbient(): Ambient {
  const mx = new Float32Array(MOTES), my = new Float32Array(MOTES), ms = new Float32Array(MOTES);
  for (let i = 0; i < MOTES; i++) {
    mx[i] = hash(i, 1, 3) * VIEW.w;
    my[i] = hash(i, 2, 3) * VIEW.h;
    ms[i] = 2 + hash(i, 3, 3) * 6;
  }
  return {
    mx, my, ms, order: new Int16Array(64), depth: new Float32Array(64),
    shake: { x: 0, y: 0 }, wasCooling: false, readyBlink: 0,
  };
}

/** Plots a ring of single pixels (strokes would antialias into mush). */
function pixelRing(x: CanvasRenderingContext2D, cx: number, cy: number, r: number, from: number, to: number) {
  const n = Math.max(8, Math.ceil(r * 2 * Math.PI * ((to - from) / (Math.PI * 2))));
  for (let k = 0; k <= n; k++) {
    const a = from + ((to - from) * k) / n;
    x.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.75), 1, 1);
  }
}

const easeOut = (k: number) => 1 - (1 - k) * (1 - k) * (1 - k);

/**
 * `hud` is the top-left of the logical frame that is actually on screen
 * (the shell may crop empty void at the edges): the hearts sit there.
 */
export function drawWorld(
  x: CanvasRenderingContext2D, w: World, A: Atlas, amb: Ambient, dt: number, hud: { x: number; y: number },
): void {
  const p = w.player;
  x.imageSmoothingEnabled = false;
  x.globalAlpha = 1;
  x.drawImage(A.sky, 0, 0);

  // Ambient motes rise slowly through the void (still under reduced motion)
  x.fillStyle = COLOR.energy0;
  for (let i = 0; i < MOTES; i++) {
    if (!w.reduced) {
      amb.my[i] -= amb.ms[i] * dt;
      if (amb.my[i] < -2) amb.my[i] = VIEW.h + 2;
    }
    x.fillStyle = i % 4 === 0 ? COLOR.energy1 : COLOR.energy0;
    x.fillRect(Math.round(amb.mx[i]), Math.round(amb.my[i]), 1, 1);
  }

  shakeOffset(w, amb.shake);
  x.save();
  x.translate(amb.shake.x, amb.shake.y);
  x.drawImage(A.island, 0, 0);
  drawDoor(x, w);

  // Telegraphs: a danger ring contracting onto where a drifter will be
  x.fillStyle = COLOR.danger;
  const tele = TUNE.drifter.telegraph * (w.reduced ? 1.5 : 1);
  for (const d of w.enemies) {
    if (!d.alive || d.arrive <= 0) continue;
    const k = Math.min(1, d.arrive / tele);
    x.globalAlpha = 0.35 + 0.65 * (1 - k);
    pixelRing(x, d.x, d.y, 3 + k * 14, 0, Math.PI * 2);
    x.fillRect(Math.round(d.x), Math.round(d.y), 1, 1);
  }
  x.globalAlpha = 1;

  // Shadows under everything standing
  for (const d of w.enemies) if (d.alive && d.arrive <= 0) x.drawImage(A.shadow, Math.round(d.x - 6), Math.round(d.y - 1));

  // Charger telegraph: while it winds up, a dotted danger line shows the
  // exact path of its charge (locked; cut where the void will stop it)
  x.fillStyle = COLOR.danger;
  for (const d of w.enemies) {
    if (!d.alive || d.kind !== EnemyKind.Charger || d.state !== Charge.Windup) continue;
    const total = TUNE.charger.windup * (w.reduced ? 1.5 : 1);
    const k = 1 - Math.max(0, d.t) / total;
    const len = TUNE.charger.chargeSpeed * TUNE.charger.chargeTime * (w.reduced ? 0.75 : 1);
    x.globalAlpha = 0.45 + 0.55 * k;
    for (let s = 8; s < len; s += 4) {
      const px = d.x + d.ax * s, py = d.y + d.ay * s;
      if (!iceAt(w.room, px, py)) break;
      x.fillRect(Math.round(px), Math.round(py - 4), 1, 1);
    }
  }
  x.globalAlpha = 1;

  // Spitter telegraph: rings swelling round its mouth, and a short dotted
  // aim line (locked) toward where the bolt will go
  for (const d of w.enemies) {
    if (!d.alive || d.kind !== EnemyKind.Spitter || d.state !== Spit.Windup) continue;
    const total = TUNE.spitter.windup * (w.reduced ? 1.5 : 1);
    const k = 1 - Math.max(0, d.t) / total;
    x.fillStyle = COLOR.danger;
    x.globalAlpha = 0.5 + 0.5 * k;
    pixelRing(x, d.x, d.y - 7, 4 + k * 5, 0, Math.PI * 2);
    for (let s = 10; s < 34; s += 4) x.fillRect(Math.round(d.x + d.ax * s), Math.round(d.y - 7 + d.ay * s), 1, 1);
  }
  x.globalAlpha = 1;
  if (w.phase !== "dead") x.drawImage(A.shadow, Math.round(p.x - 6), Math.round(p.y - 1));

  // Trail: fading diamonds at the gem's recent positions; afterimages in a dash
  const dashing = isDashing(p);
  for (let n = 1; n < TRAIL; n++) {
    const idx = (w.trailHead - n + TRAIL) % TRAIL;
    const tx = w.trail[idx * 2], ty = w.trail[idx * 2 + 1];
    if (Math.abs(tx - p.x) + Math.abs(ty - p.y) < 1.5) continue;
    x.globalAlpha = (1 - n / TRAIL) * (dashing ? 0.55 : 0.4);
    if (dashing) x.drawImage(A.gemGhost, Math.round(tx - 6), Math.round(ty - 14));
    else {
      x.fillStyle = COLOR.energy1;
      x.fillRect(Math.round(tx) - 1, Math.round(ty) - 8, 3, 1);
      x.fillRect(Math.round(tx), Math.round(ty) - 9, 1, 3);
    }
  }
  x.globalAlpha = 1;

  // Y-sorted bodies (insertion sort into reused arrays: no allocation)
  let n = 0;
  amb.order[n] = 0;
  amb.depth[n++] = p.y;
  for (let k = 0; k < w.enemies.length; k++) {
    const d = w.enemies[k];
    if (!d.alive || d.arrive > 0) continue;
    let j = n++;
    while (j > 0 && amb.depth[j - 1] > d.y) {
      amb.order[j] = amb.order[j - 1];
      amb.depth[j] = amb.depth[j - 1];
      j--;
    }
    amb.order[j] = k + 1;
    amb.depth[j] = d.y;
  }
  for (let j = 0; j < n; j++) {
    const o = amb.order[j];
    if (o === 0) drawGem(x, w, A);
    else drawEnemy(x, w, A, w.enemies[o - 1]);
  }

  // Bolts, over everything on the ground (they fly), each with a short trail
  for (const b of w.bolts) {
    if (!b.alive) continue;
    const l = Math.hypot(b.vx, b.vy) || 1;
    x.fillStyle = COLOR.energy1;
    x.globalAlpha = 0.5;
    x.fillRect(Math.round(b.x - (b.vx / l) * 4), Math.round(b.y - (b.vy / l) * 4), 1, 1);
    x.globalAlpha = 0.25;
    x.fillRect(Math.round(b.x - (b.vx / l) * 7), Math.round(b.y - (b.vy / l) * 7), 1, 1);
    x.globalAlpha = 1;
    x.drawImage(A.bolt, Math.round(b.x - 2.5), Math.round(b.y - 2.5));
  }

  // The attack burst: a crescent of points sweeping out, ease-out
  if (p.atkAge < TUNE.attack.show) {
    const k = p.atkAge / TUNE.attack.show;
    const r = 8 + easeOut(k) * (TUNE.attack.range - 8);
    const base = Math.atan2(p.atkY, p.atkX);
    x.globalAlpha = 1 - k * k;
    x.fillStyle = COLOR.ice1;
    const half = TUNE.attack.halfAngle;
    for (let s = 0; s <= 12; s++) {
      const a = base - half + (2 * half * s) / 12;
      x.fillRect(Math.round(p.x + Math.cos(a) * r), Math.round(p.y - 6 + Math.sin(a) * r), 1, 1);
      if (s % 3 === 0) x.fillRect(Math.round(p.x + Math.cos(a) * (r - 3)), Math.round(p.y - 6 + Math.sin(a) * (r - 3)), 1, 1);
    }
    x.globalAlpha = 1;
  }

  // Particles: shards streak along their flight, chips tumble
  for (const q of w.particles) {
    if (!q.alive) continue;
    const k = q.life / q.max;
    x.globalAlpha = q.kind === Kind.Shard ? k : Math.min(1, k * 1.6);
    x.fillStyle = PARTICLE[q.color];
    if (q.kind === Kind.Shard) {
      x.fillRect(Math.round(q.x), Math.round(q.y), 1, 1);
      x.fillRect(Math.round(q.x - q.vx * 0.012), Math.round(q.y - q.vy * 0.012), 1, 1);
    } else {
      const s = k > 0.5 ? 2 : 1;
      x.fillRect(Math.round(q.x), Math.round(q.y), s, s);
    }
  }
  x.globalAlpha = 1;

  // Dash cooldown: a ring filling round the gem's feet, a blink when ready
  const cooling = p.dashCd > 0;
  if (amb.wasCooling && !cooling) amb.readyBlink = 0.08;
  amb.wasCooling = cooling;
  amb.readyBlink = Math.max(0, amb.readyBlink - dt);
  if (w.phase === "play" && (cooling || amb.readyBlink > 0)) {
    const k = cooling ? 1 - p.dashCd / TUNE.dash.cooldown : 1;
    x.fillStyle = cooling ? COLOR.energy1 : COLOR.ice1;
    x.globalAlpha = cooling ? 0.85 : 1;
    pixelRing(x, p.x, p.y, 9, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2);
    x.globalAlpha = 1;
  }

  x.restore();

  // Through a doorway: the screen fades to the void and back
  const veil = transitionVeil(w);
  if (veil > 0) {
    x.globalAlpha = veil;
    x.fillStyle = COLOR.void0;
    x.fillRect(0, 0, VIEW.w, VIEW.h);
    x.globalAlpha = 1;
  }

  // Over: the arena dims behind the shell's card (death darker than a clear)
  if (w.phase !== "play") {
    x.globalAlpha = Math.min(1, w.endT / TUNE.death.fade) * (w.phase === "dead" ? 0.6 : 0.35);
    x.fillStyle = COLOR.void0;
    x.fillRect(0, 0, VIEW.w, VIEW.h);
    x.globalAlpha = 1;
  }

  // Hearts (screen-fixed)
  for (let i = 0; i < TUNE.hurt.hearts; i++) x.drawImage(i < p.hearts ? A.heart : A.heartEmpty, hud.x + 8 + i * 9, hud.y + 8);
}

/**
 * The doorway on the north rim: a dim arch while the wave lives; once it is
 * cleared, the arch lights in pale ice, the opening shimmers violet and
 * chevrons point through it (still under reduced motion).
 */
function drawDoor(x: CanvasRenderingContext2D, w: World): void {
  const d = w.room.door;
  const open = w.doorOpen;
  const top = d.y - 9;
  // The opening
  for (let py = top + 1; py < d.y + 1; py++)
    for (let px = d.x + 2; px < d.x + d.w - 2; px++) {
      if (!open) x.fillStyle = COLOR.void0;
      else {
        const shimmer = w.reduced ? 0 : Math.floor(w.t * 8);
        x.fillStyle = ((px + py + shimmer) & 3) === 0 ? COLOR.energy1 : COLOR.energy0;
      }
      x.fillRect(px, py, 1, 1);
    }
  // Pillars and lintel
  x.fillStyle = open ? COLOR.ice1 : COLOR.energy0;
  x.fillRect(d.x + 1, top, 1, d.y - top + 1);
  x.fillRect(d.x + d.w - 2, top, 1, d.y - top + 1);
  x.fillRect(d.x + 1, top, d.w - 2, 1);
  if (open) {
    // Chevrons pointing through, stepping upward
    const lift = w.reduced ? 0 : Math.floor(w.t * 6) % 3;
    x.fillStyle = COLOR.ice1;
    const cx = d.x + d.w / 2;
    for (let n = 0; n < 2; n++) {
      const y = d.y + 10 + n * 5 - lift;
      x.fillRect(Math.round(cx - 3), y + 2, 2, 1);
      x.fillRect(Math.round(cx - 1), y, 2, 1);
      x.fillRect(Math.round(cx + 1), y + 2, 2, 1);
    }
  }
}

function drawEnemy(x: CanvasRenderingContext2D, w: World, A: Atlas, d: Enemy): void {
  if (d.kind === EnemyKind.Charger) {
    const X = Math.round(d.x - 6.5), Y = Math.round(d.y - 13);
    if (d.flash > 0) {
      x.drawImage(A.chargerFlash, X, Y);
      return;
    }
    if (d.state === Charge.Windup) {
      // The tell: blinking danger red for the whole windup (steady under reduced motion)
      const on = w.reduced || Math.floor(d.t / 0.06) % 2 === 0;
      x.drawImage(on ? A.chargerTell : A.charger, X, Y);
      return;
    }
    if (d.state === Charge.Dash) {
      // A short violet afterimage trail
      for (let k = 2; k >= 1; k--) {
        x.globalAlpha = 0.25 * k;
        x.drawImage(A.chargerGhost, Math.round(X - d.ax * 7 * k), Math.round(Y - d.ay * 7 * k));
      }
      x.globalAlpha = 1;
    }
    x.drawImage(A.charger, X, Y);
    return;
  }
  if (d.kind === EnemyKind.Spitter) {
    const X = Math.round(d.x - 5.5), Y = Math.round(d.y - 13);
    x.drawImage(d.flash > 0 ? A.spitterFlash : d.state === Spit.Windup ? A.spitterTell : A.spitter, X, Y);
    return;
  }
  const bob = Math.round(Math.sin(d.phase * 1.7) * 1.5);
  x.drawImage(d.flash > 0 ? A.drifterFlash : A.drifter, Math.round(d.x - 5.5), Math.round(d.y - 14 + bob));
}

function drawGem(x: CanvasRenderingContext2D, w: World, A: Atlas): void {
  const p = w.player;
  // Dead: the gem has shattered into chips (engine die()); the card takes over
  if (w.phase === "dead") return;
  // Hurt: blink through the invulnerability
  if (p.invuln > 0 && Math.floor(p.invuln * 18) % 2 === 1) return;
  const bob = isDashing(p) ? 0 : Math.round(Math.sin(w.t * 5) * 1);
  if (p.squash > 0) {
    // Squash on dash start: stretched along the dash, thinned across it
    const k = p.squash / TUNE.dash.squashTime;
    const along = 1 + (TUNE.dash.squash[0] - 1) * k;
    const across = 1 + (TUNE.dash.squash[1] - 1) * k;
    const horiz = Math.abs(p.dashX) >= Math.abs(p.dashY);
    const sw = Math.round(12 * (horiz ? along : across));
    const sh = Math.round(12 * (horiz ? across : along));
    x.drawImage(A.gemGlow, Math.round(p.x - 12), Math.round(p.y - 2 - sh / 2 - 12));
    x.drawImage(A.gem, Math.round(p.x - sw / 2), Math.round(p.y - 2 - sh), sw, sh);
    return;
  }
  x.drawImage(A.gemGlow, Math.round(p.x - 12), Math.round(p.y - 20 + bob));
  x.drawImage(A.gem, Math.round(p.x - 6), Math.round(p.y - 14 + bob));
}
