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
  /** Units per second. */
  speed: 32,
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
