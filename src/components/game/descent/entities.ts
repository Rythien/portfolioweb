/**
 * Obstacle and pickup definitions plus the row builders. Pure data and
 * pure functions; the engine decides when a row spawns and with what
 * difficulty parameters.
 */

export type RowKind = "ice" | "shards";

export interface Shard {
  /** Centre, world px. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Polygon in local px around the centre (crystal silhouette). */
  verts: [number, number][];
  broken: boolean;
}

export interface Row {
  id: number;
  kind: RowKind;
  /** World y of the row's centre line. */
  y: number;
  /** The guaranteed passage: centre and width (world px). */
  gapX: number;
  gapW: number;
  /** Thin ice: bounces taken so far; the second bounce breaks it. */
  cracks: number;
  /** Where the first bounce cracked it (world x), or -1. */
  crackX: number;
  broken: boolean;
  shards: Shard[];
}

export interface Drift {
  id: number;
  x: number;
  y: number;
  vx: number;
  size: number;
  /** Damaging (deep) or cosmetic (shallow); fixed at spawn. */
  harmful: boolean;
  gone: boolean;
}

export type PickupKind = "mote" | "life";

export interface Pickup {
  id: number;
  kind: PickupKind;
  x: number;
  y: number;
  taken: boolean;
}

/** Thin ice bar thickness (px). */
export const ICE_THICKNESS = 6;
/** Fraction of the gem radius allowed to overlap the gap edge. */
export const GAP_FORGIVE = 0.5;
/** Neighbouring shards overlap this much so no seam lets the gem through. */
const SHARD_OVERLAP = 7;

export interface RowSpec {
  id: number;
  y: number;
  kind: RowKind;
  gapX: number;
  gapW: number;
  worldW: number;
}

/** Irregular crystal silhouette: 7 jittered points on an ellipse. */
function silhouette(rng: () => number, w: number, h: number): [number, number][] {
  const n = 7;
  const pts: [number, number][] = [];
  const phase = rng() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * Math.PI * 2;
    const k = 0.78 + rng() * 0.22;
    pts.push([Math.round(Math.cos(a) * (w / 2) * k), Math.round(Math.sin(a) * (h / 2) * k)]);
  }
  return pts;
}

/** Fill [from, to] with overlapping shards; the last one ends at `to`. */
function fillShards(rng: () => number, y: number, from: number, to: number, out: Shard[]): void {
  let x = from;
  for (;;) {
    let w = 30 + rng() * 26;
    // Never leave a sliver: the last shard absorbs a short remainder
    if (to - x - w < 18) w = to - x;
    if (w < 8) break;
    const h = 16 + rng() * 12;
    out.push({ x: x + w / 2, y: y + (rng() - 0.5) * 4, w, h, verts: silhouette(rng, w, h), broken: false });
    if (x + w >= to) break;
    x += w - SHARD_OVERLAP;
  }
}

/** Collision growth of a shard's ellipse, as a fraction of the gem radius. */
export const SHARD_GROW = 0.6;

export function buildRow(rng: () => number, spec: RowSpec): Row {
  const row: Row = {
    id: spec.id,
    kind: spec.kind,
    y: spec.y,
    gapX: spec.gapX,
    gapW: spec.gapW,
    cracks: 0,
    crackX: -1,
    broken: false,
    shards: [],
  };
  if (spec.kind === "shards") {
    const gL = spec.gapX - spec.gapW / 2;
    const gR = spec.gapX + spec.gapW / 2;
    // Shards stop short of the gap by their collision growth, so the
    // passage is exactly gapW wide
    const grow = 5 * SHARD_GROW;
    if (gL - grow > 8) fillShards(rng, spec.y, -6, gL - grow, row.shards);
    if (gR + grow < spec.worldW - 8) fillShards(rng, spec.y, gR + grow, spec.worldW + 6, row.shards);
  }
  return row;
}

/** Gap interval as the gem's centre must see it (forgiving edges). */
export function passInterval(row: Row, gemR: number): [number, number] {
  const m = gemR * (1 - GAP_FORGIVE);
  return [row.gapX - row.gapW / 2 + m, row.gapX + row.gapW / 2 - m];
}

/** Ellipse test, the shard grown by the gem radius. */
export function hitsShard(sh: Shard, x: number, y: number, r: number): boolean {
  if (sh.broken) return false;
  const dx = (x - sh.x) / (sh.w / 2 + r * SHARD_GROW);
  const dy = (y - sh.y) / (sh.h / 2 + r * SHARD_GROW);
  return dx * dx + dy * dy < 1;
}

/* ── Difficulty ───────────────────────────────────────────── */

export const BAND_METRES = 250;
/** Difficulty stops rising here so a good run stays playable. */
export const DIFFICULTY_CAP_METRES = 1500;
export const BAND_NAMES = [
  "THE SHALLOWS",
  "COLD LAYER",
  "THE DEEP",
  "NO LIGHT",
  "PRESSURE",
  "BEDROCK",
  "THE FLOOR",
] as const;

export function bandAt(depthM: number): number {
  return Math.max(0, Math.floor(depthM / BAND_METRES));
}

export function bandName(band: number): string {
  return BAND_NAMES[Math.min(band, BAND_NAMES.length - 1)];
}

export interface SpawnParams {
  /** Seconds between rows at the current fall speed. */
  interval: number;
  /** Gap width as a fraction of the play width. */
  gapFrac: number;
  /** Chance a row is thick shards instead of thin ice. */
  thickShare: number;
  driftSpeed: number;
}

/** Stepped per band, clamped at DIFFICULTY_CAP_METRES. */
export function spawnParams(depthM: number): SpawnParams {
  const maxBand = DIFFICULTY_CAP_METRES / BAND_METRES;
  const t = Math.min(bandAt(depthM), maxBand) / maxBand;
  const lerp = (a: number, b: number) => a + (b - a) * t;
  return {
    // Hand-tuned from 1.4 s: at terminal that put rows two screens apart
    // and half the opening frames were empty. 1.15 s still never shows
    // more than one row ahead in the first band.
    interval: lerp(1.15, 0.55),
    gapFrac: lerp(0.42, 0.18),
    thickShare: lerp(0.1, 0.45),
    driftSpeed: lerp(15, 70),
  };
}

/* ── Reachability ─────────────────────────────────────────── */

/** Seconds of the gap-to-gap time spent seeing and reacting. */
export const REACTION_S = 0.15;

/**
 * Furthest sideways distance (px) in time t from a standstill, under
 * the steering acceleration and speed cap.
 */
export function reachDistance(t: number, accel: number, maxV: number): number {
  if (t <= 0) return 0;
  const t1 = maxV / accel;
  if (t <= t1) return 0.5 * accel * t * t;
  return 0.5 * accel * t1 * t1 + maxV * (t - t1);
}

export interface ReachModel {
  accel: number;
  maxV: number;
  /** Fastest the gem falls between rows without choosing to dash. */
  fallSpeed: number;
}

/** Sideways reach between two rows `spacing` px apart. */
export function reachBetween(spacing: number, m: ReachModel): number {
  return reachDistance(spacing / m.fallSpeed - REACTION_S, m.accel, m.maxV);
}

/**
 * True when a gem that passed anywhere through `prev` can make it into
 * `next` (both pass intervals of gem centres) before reaching it.
 */
export function isReachable(prev: [number, number], next: [number, number], spacing: number, m: ReachModel): boolean {
  const r = reachBetween(spacing, m);
  // Worst case: passed prev at its far edge from next
  const worst = Math.max(next[0] - prev[1], prev[0] - next[1], 0);
  return worst <= r + 1e-6;
}

/**
 * Clamp a proposed gap centre so the next row is reachable from the
 * previous one. Pure: the engine and the tests share it.
 */
export function placeGap(
  proposedX: number,
  gapW: number,
  prevPass: [number, number] | null,
  spacing: number,
  m: ReachModel,
  worldW: number,
  gemR: number,
): number {
  const half = gapW / 2;
  let x = Math.max(half, Math.min(worldW - half, proposedX));
  if (!prevPass) return x;
  const r = reachBetween(spacing, m);
  const m2 = gemR * (1 - GAP_FORGIVE);
  // next pass interval = [x - half + m2, x + half - m2] must overlap
  // [prev[0] - r, prev[1] + r], with a pixel to spare
  const lo = prevPass[0] - r - (half - m2) + 1;
  const hi = prevPass[1] + r + (half - m2) - 1;
  x = Math.max(lo, Math.min(hi, x));
  return Math.max(half, Math.min(worldW - half, x));
}
