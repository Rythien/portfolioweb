/**
 * Archive rules: motes, charge, the pulse and what it hits. Pure (no
 * three.js, no DOM) so it runs under plain node for tests; the scene feeds
 * it positions and applies what it returns.
 */

export type V3 = [number, number, number];

/* ── Tuning ───────────────────────────────────────────────────── */

export const MOTES = {
  /** Free motes scattered through the void. */
  free: 36,
  /** Extra motes clustered around each seal (denser near seals). */
  perSeal: 22,
  /** Void radius for the free ones. */
  voidRadius: 50,
  /** Cluster shell around a seal: inner / outer radius. */
  near: [6, 14] as [number, number],
  /** Pulled toward you inside this distance (only while not fully charged). */
  magnet: 4.5,
  /** Collected inside this distance. */
  collect: 1.4,
  /** Seconds before a collected mote drifts back in at its home. */
  respawn: 12,
};

export const PULSE = {
  /** Units per second: slow enough that distance matters and a moving
   * target has to be led (about 0.8 s across a 15-unit approach). */
  speed: 18,
  /** It fizzles out after this far. */
  range: 90,
  /** Collision sampling step along the path. */
  step: 0.25,
  /** Pulse radius for shard hits. */
  radius: 0.35,
  /** A hit counts on the lit facet within this angle of its centre (rad).
   * Neighbouring dodecahedron facets are ~63° apart, so 26° is the facet. */
  facetCone: (26 * Math.PI) / 180,
};

export const CHARGE_FULL = 3;
export const HITS_TO_FREE = 3;

/** A facet hit on a seal: it cracks, or (the third) frees the project. */
export function resolveFacetHit(s: { hits: number; freed: boolean }): "crack" | "freed" | "none" {
  if (s.freed || s.hits >= HITS_TO_FREE) return "none";
  s.hits += 1;
  if (s.hits >= HITS_TO_FREE) {
    s.freed = true;
    return "freed";
  }
  return "crack";
}

/* ── Freeing and the ending (seconds) ─────────────────────────── */

export const FREE = {
  /** The glass bursts over this long. */
  burst: 0.55,
  /** Shards fly out, slowing to a drift (exponential, this time constant). */
  flyTau: 0.9,
  /** How far out the orbiting shards end up, as a multiple of their ring. */
  flyOut: 1.55,
  /** The panel blooms over this long, starting a beat into the burst. */
  bloomDelay: 0.25,
  bloom: 1.6,
  /** Panel size (world units, width); it floats where the seal stood. */
  panelWidth: 13,
  /** Floating into the panel: the camera comes within this of its centre
   * (the panel always faces you, so distance is the test). */
  touchRadius: 4.6,
};

export const ENDING = {
  /** The ending starts this long after the last seal is freed, or at once
   * when the visitor floats into that last panel. */
  wait: 9,
  /** In front of the visitor, where the crystal reassembles. */
  distance: 9,
  /** Shards converge over [0, converge]. */
  converge: 2.8,
  /** The intact crystal grows in over [converge - 0.4, converge + 0.8]. */
  form: 1.2,
  /** Fog lifts to pale violet over [1.5, 1.5 + lift]. */
  lift: 4,
  /** "The archive is yours." appears at this time. */
  line: 4.2,
  /** Then the visitor wakes, at Contact. */
  exit: 10,
};

/** True once the ending should begin. */
export function endingDue(allFreed: boolean, lastFreedAt: number, lastTouched: boolean, t: number): boolean {
  return allFreed && (lastTouched || t - lastFreedAt >= ENDING.wait);
}

/* ── Seeded randomness ────────────────────────────────────────── */

function lcg(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function randomDir(rnd: () => number): V3 {
  const th = Math.acos(2 * rnd() - 1);
  const ph = rnd() * Math.PI * 2;
  return [Math.sin(th) * Math.cos(ph), Math.cos(th) * 0.7, Math.sin(th) * Math.sin(ph)];
}

/* ── Motes ────────────────────────────────────────────────────── */

export interface Mote {
  /** Where it drifts around. */
  home: V3;
  /** Current position. */
  pos: V3;
  phase: number;
  alive: boolean;
  /** Game time it comes back (when not alive). */
  respawnAt: number;
  /** 0..1 fade-in after (re)spawning. */
  fade: number;
}

export function createMotes(seals: V3[], seed = 2024): Mote[] {
  const rnd = lcg(seed);
  const out: Mote[] = [];
  const add = (home: V3) => out.push({ home, pos: [...home] as V3, phase: rnd() * Math.PI * 2, alive: true, respawnAt: 0, fade: 1 });
  for (let i = 0; i < MOTES.free; i++) {
    const d = randomDir(rnd);
    const r = MOTES.voidRadius * Math.cbrt(rnd());
    add([d[0] * r, d[1] * r, d[2] * r]);
  }
  for (const c of seals) {
    for (let i = 0; i < MOTES.perSeal; i++) {
      const d = randomDir(rnd);
      const r = MOTES.near[0] + rnd() * (MOTES.near[1] - MOTES.near[0]);
      add([c[0] + d[0] * r, c[1] + d[1] * r, c[2] + d[2] * r]);
    }
  }
  return out;
}

const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/**
 * Drift, pull and collect. Returns how many motes were collected this
 * step (never more than the charge still missing: a full charge leaves
 * motes where they are, nothing is wasted).
 */
export function stepMotes(motes: Mote[], t: number, dt: number, player: V3, charge: number, still = false): number {
  let collected = 0;
  const room = CHARGE_FULL - charge;
  for (const m of motes) {
    if (!m.alive) {
      if (t >= m.respawnAt) {
        m.alive = true;
        m.fade = 0;
        m.pos = [...m.home] as V3;
      }
      continue;
    }
    m.fade = Math.min(1, m.fade + dt / 1.2);
    // Slow drift around home (none under reduced motion)
    const a = still ? 0 : 1;
    const target: V3 = [
      m.home[0] + Math.sin(t * 0.21 + m.phase) * 0.9 * a,
      m.home[1] + Math.sin(t * 0.17 + m.phase * 1.7) * 0.6 * a,
      m.home[2] + Math.cos(t * 0.19 + m.phase) * 0.9 * a,
    ];
    const d = dist(m.pos, player);
    if (room - collected > 0 && d < MOTES.magnet) {
      // Pulled in: the closer, the faster
      const k = 1 - Math.exp(-dt * (2 + 10 * (1 - d / MOTES.magnet)));
      for (let i = 0; i < 3; i++) m.pos[i] += (player[i] - m.pos[i]) * k;
    } else {
      const k = 1 - Math.exp(-dt * 1.5);
      for (let i = 0; i < 3; i++) m.pos[i] += (target[i] - m.pos[i]) * k;
    }
    if (room - collected > 0 && dist(m.pos, player) < MOTES.collect) {
      m.alive = false;
      m.respawnAt = t + MOTES.respawn;
      collected++;
    }
  }
  return collected;
}

/* ── Pulse ────────────────────────────────────────────────────── */

export interface Pulse {
  pos: V3;
  dir: V3;
  travelled: number;
}

/** Everything a pulse can hit at one seal, in world space. */
export interface SealTarget {
  center: V3;
  /** Body rotation about Y (the seal only turns about its vertical axis). */
  rotY: number;
  /** Body ellipsoid half-axes (x, y, z). */
  radii: V3;
  /** Lit facet centre in body space (unrotated, relative to the centre). */
  facet: V3;
  /** Orbiting shards: world centre + hit radius. */
  shards: { p: V3; r: number }[];
  /** Freed seals no longer take hits. */
  freed: boolean;
}

export type HitKind = "facet" | "body" | "shard" | "fizzle";

export interface Hit {
  kind: HitKind;
  /** Seal index (not for fizzle). */
  seal: number;
  /** World position of the impact. */
  at: V3;
  /** For body/facet: impact direction in body space (unit), for cracks. */
  local?: V3;
}

export function releasePulse(origin: V3, dir: V3): Pulse {
  const l = Math.hypot(...dir) || 1;
  return { pos: [...origin] as V3, dir: [dir[0] / l, dir[1] / l, dir[2] / l], travelled: 0 };
}

/** Advance the pulse; returns a hit when it ends (and the pulse is spent). */
export function stepPulse(p: Pulse, dt: number, seals: SealTarget[]): Hit | null {
  let remaining = PULSE.speed * dt;
  while (remaining > 0) {
    const s = Math.min(PULSE.step, remaining);
    remaining -= s;
    for (let i = 0; i < 3; i++) p.pos[i] += p.dir[i] * s;
    p.travelled += s;
    for (let si = 0; si < seals.length; si++) {
      const t = seals[si];
      if (t.freed) continue;
      // Shards first: they guard the seal
      for (const sh of t.shards) {
        if (dist(p.pos, sh.p) < sh.r + PULSE.radius) return { kind: "shard", seal: si, at: [...p.pos] as V3 };
      }
      // Body: point inside the ellipsoid, in body space
      const dx = p.pos[0] - t.center[0], dy = p.pos[1] - t.center[1], dz = p.pos[2] - t.center[2];
      const c = Math.cos(-t.rotY), sn = Math.sin(-t.rotY);
      const lx = dx * c + dz * sn, lz = -dx * sn + dz * c, ly = dy;
      const e = (lx / t.radii[0]) ** 2 + (ly / t.radii[1]) ** 2 + (lz / t.radii[2]) ** 2;
      if (e <= 1) {
        const ll = Math.hypot(lx, ly, lz) || 1;
        const local: V3 = [lx / ll, ly / ll, lz / ll];
        const fl = Math.hypot(...t.facet) || 1;
        const cos = (local[0] * t.facet[0] + local[1] * t.facet[1] + local[2] * t.facet[2]) / fl;
        const kind: HitKind = Math.acos(Math.max(-1, Math.min(1, cos))) <= PULSE.facetCone ? "facet" : "body";
        return { kind, seal: si, at: [...p.pos] as V3, local };
      }
    }
    if (p.travelled >= PULSE.range) return { kind: "fizzle", seal: -1, at: [...p.pos] as V3 };
  }
  return null;
}

/* ── The shield wall ──────────────────────────────────────────── */

const DEG = Math.PI / 180;

/**
 * A fighting seal hides inside a closed cage of shards with one window in
 * it. The cage turns about the seal's vertical axis, so the window sweeps
 * round, and the seal turns with it: the lit facet always looks out
 * through the window. Shards are on a sphere, in rows of latitude,
 * alternate rows staggered so no pulse fits between three neighbours.
 */
export const WALL = {
  /** Cage radius (world units from the seal centre). */
  radius: 6.2,
  /** Arc between neighbouring shard centres, along a row and between rows. */
  spacing: 1.5,
  /** Shard scale; its hit radius is scale x SHARD_HIT like any shard. */
  shardScale: 0.55,
  /** Per phase: the window's half-width (azimuth) and half-height
   * (latitude), and how fast the cage turns (rad/s). */
  phases: [{ halfAz: 26 * DEG, halfLat: 30 * DEG, sweep: 0.22 }],
  /** Facets on the seal's equator (they can look out through the window),
   * lit in this order, one per hit. */
  facets: [2, 7, 9, 3],
};

/** A shard's hit radius per unit of scale (shared with the orbiters). */
export const SHARD_HIT = 1.15;

/** One place in the cage: latitude, and azimuth from the window's centre. */
export interface WallSlot {
  lat: number;
  az: number;
}

/** Every place in the cage (the window is cut out per phase, wallSlotOpen). */
export function wallSlots(): WallSlot[] {
  const step = WALL.spacing / WALL.radius;
  const rows = Math.floor(Math.PI / 2 / step);
  const out: WallSlot[] = [];
  for (let k = -rows; k <= rows; k++) {
    const lat = k * step;
    const n = Math.max(3, Math.round((2 * Math.PI * WALL.radius * Math.cos(lat)) / WALL.spacing));
    const off = (Math.abs(k) % 2) * 0.5;
    for (let i = 0; i < n; i++) out.push({ lat, az: ((i + off) / n) * 2 * Math.PI - Math.PI });
  }
  return out;
}

export type WallPhase = (typeof WALL.phases)[number];

/** Inside the window: no shard there. */
export function wallSlotOpen(s: WallSlot, ph: WallPhase): boolean {
  return Math.abs(s.az) < ph.halfAz && Math.abs(s.lat) < ph.halfLat;
}

/** The window's world azimuth at game time t: angle in the x-z plane,
 * atan2(z, x). */
export function gapAzimuth(ph: WallPhase, t: number, offset = 0): number {
  return offset + ph.sweep * t;
}

/** World offset (from the seal centre) of a cage slot when the window
 * looks along gapAz; `radius` lets the freed cage fly out. */
export function wallShardOffset(s: WallSlot, gapAz: number, out: V3, radius = WALL.radius): V3 {
  const a = s.az + gapAz;
  out[0] = radius * Math.cos(s.lat) * Math.cos(a);
  out[1] = radius * Math.sin(s.lat);
  out[2] = radius * Math.cos(s.lat) * Math.sin(a);
  return out;
}

/**
 * The body's rotation about Y that turns a facet (body space) to look
 * along world azimuth gapAz. Three's Y rotation by r maps a body-space
 * azimuth p to p - r.
 */
export function bodyRotForGap(facet: V3, gapAz: number): number {
  return Math.atan2(facet[2], facet[0]) - gapAz;
}

/**
 * The next lit facet after a hit: a different one, not a neighbour of the
 * last (so each hit asks you to move), chosen deterministically.
 */
export function nextFacet(current: number, hits: number, facetCount = 12): number {
  const order = [6, 3, 9, 1, 7, 4, 10, 2, 8, 5, 11, 0];
  for (let k = 0; k < facetCount; k++) {
    const f = order[(hits * 5 + current + k) % facetCount];
    if (f !== current && Math.abs(f - current) > 1) return f;
  }
  return (current + 6) % facetCount;
}
