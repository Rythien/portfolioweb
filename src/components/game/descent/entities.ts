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
