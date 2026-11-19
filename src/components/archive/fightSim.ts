/**
 * Timing model of a seal fight, for tests and tuning (never imported by the
 * scene). Uses the same rules the game plays: fightTargetAt for the cage
 * and the seal, releasePulse / stepPulse for the shot, createMotes for the
 * rearm band. Pure, plain node.
 *
 *   opportunities()  fire times at which a well-placed player can land a
 *                    hit: the player sits on the firing ring where the
 *                    facet will be when the pulse arrives, leads it, and the
 *                    pulse is flown against the moving cage and seal.
 *   timeToFree()     a competent player: flies at a sustained FLY_SPEED,
 *                    reacts in REACTION, rearms from the fight's mote band,
 *                    and takes the earliest opportunity it can reach.
 */
import {
  CHARGE_FULL, MOTES, PULSE, WALL, createMotes, fightTargetAt, releasePulse, stepPulse, wallSlots,
  type SealTarget, type V3, type WallPhase, type WallSlot,
} from "./game.ts";

/** Where the player fires from: this far from the seal centre, this high. */
export const RING = { r: 16, y: 1 };
/** Sustained flight speed (terminal is 8.8 u/s; turns and starts cost some). */
export const FLY_SPEED = 7;
/** Seconds between an opportunity opening and a competent player firing. */
export const REACTION = 0.25;
/** A competent player's timing: the shot goes off up to this far (s)
 * either side of the moment they meant; outside the opening it misses and
 * the charge is spent. */
export const TIMING_ERROR = 0.2;
/** Collect radius in the bot (the game pulls motes in from 4.5 units). */
const REACH = 2.6;
const DT = 1 / 60;

/** Seal 0's equatorial facets in body space: azimuths 90 deg apart is close
 * enough for timing (the real ones are within a few degrees of the equator). */
export function facetAt(k: number): V3 {
  const a = (k * Math.PI) / 2;
  return [2.9 * Math.cos(a), 0, 2.9 * Math.sin(a)];
}

export interface FightSetup {
  phase: WallPhase;
  gapOffset: number;
  rotOffset: number;
}

function makeTarget(slots: WallSlot[], facet: V3): SealTarget {
  return {
    center: [0, 0, 0],
    rotY: 0,
    radii: [2.94, 3.59, 2.94],
    facet,
    shards: slots.map(() => ({ p: [0, 0, 0] as V3, r: 0 })),
    freed: false,
  };
}

/** Facet world position at time t. */
function facetWorld(s: FightSetup, facet: V3, t: number): V3 {
  const r = s.rotOffset + s.phase.spin * t;
  const c = Math.cos(r), sn = Math.sin(r);
  return [facet[0] * c + facet[2] * sn, facet[1], -facet[0] * sn + facet[2] * c];
}

/** Lead: where to aim from `from` at fire time t0 so the pulse meets the facet. */
export function leadAim(s: FightSetup, facet: V3, from: V3, t0: number): { aim: V3; travel: number } {
  let travel = 0;
  let aim = facetWorld(s, facet, t0);
  for (let k = 0; k < 4; k++) {
    aim = facetWorld(s, facet, t0 + travel);
    travel = Math.hypot(aim[0] - from[0], aim[1] - from[1], aim[2] - from[2]) / PULSE.speed;
  }
  return { aim, travel };
}

/** Fly one pulse against the moving cage; true when it lands on the facet. */
export function shotHits(s: FightSetup, slots: WallSlot[], facet: V3, from: V3, aim: V3, t0: number, tg?: SealTarget): boolean {
  const target = tg ?? makeTarget(slots, facet);
  target.facet = facet;
  const p = releasePulse(from, [aim[0] - from[0], aim[1] - from[1], aim[2] - from[2]]);
  for (let t = t0; t < t0 + 3; t += DT) {
    fightTargetAt(target, slots, s.phase, t, s.gapOffset, s.rotOffset);
    const h = stepPulse(p, DT, [target]);
    if (h) return h.kind === "facet";
  }
  return false;
}

/** The best spot on the firing ring for a shot at t0: radially out from where the facet will be. */
export function ringSpot(s: FightSetup, facet: V3, t0: number): V3 {
  const f = facetWorld(s, facet, t0 + (RING.r - 2.9) / PULSE.speed);
  const a = Math.atan2(f[2], f[0]);
  return [Math.cos(a) * RING.r, RING.y, Math.sin(a) * RING.r];
}

export interface Opening {
  /** Fire times [start, end) during which a placed, leading player lands it. */
  start: number;
  end: number;
  /** Where on the ring (azimuth) the player has to be. */
  az: number;
}

/** Every opening for one facet over [t0, t1], sampled every `step` seconds. */
export function opportunities(s: FightSetup, facet: V3, t0: number, t1: number, step = 0.05): Opening[] {
  const slots = wallSlots();
  const tg = makeTarget(slots, facet);
  const out: Opening[] = [];
  let open: Opening | null = null;
  for (let t = t0; t <= t1; t += step) {
    const from = ringSpot(s, facet, t);
    const { aim } = leadAim(s, facet, from, t);
    const ok = shotHits(s, slots, facet, from, aim, t, tg);
    if (ok && !open) open = { start: t, end: t, az: Math.atan2(from[2], from[0]) };
    if (ok && open) open.end = t + step;
    if (!ok && open) {
      out.push(open);
      open = null;
    }
  }
  if (open) out.push(open);
  return out;
}

export interface FreeRun {
  /** Seconds from arriving at the ring to the third hit landing. */
  seconds: number;
  /** Per hit: seconds spent rearming, and waiting / repositioning. */
  rearm: number[];
  wait: number[];
}

/**
 * A competent player frees the seal: arrives on the ring at azimuth a0
 * at game time t0 (charged or not), then rearms and fires, three times.
 */
export function timeToFree(s: FightSetup, t0: number, a0: number, charged = true, hits = 3, seed = 17): FreeRun & { misses: number } {
  let rs = seed;
  const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  const motes = createMotes([[0, 0, 0]], 2024, [true]).slice(MOTES.free);
  const facetSeq = WALL.facets.map((_, k) => facetAt(k));
  let pos: V3 = [Math.cos(a0) * RING.r, RING.y, Math.sin(a0) * RING.r];
  let t = t0;
  let charge = charged ? CHARGE_FULL : 0;
  const run = { seconds: 0, rearm: [] as number[], wait: [] as number[], misses: 0 };
  const moveToward = (to: V3, dt: number) => {
    const d = [to[0] - pos[0], to[1] - pos[1], to[2] - pos[2]];
    const l = Math.hypot(d[0], d[1], d[2]);
    const k = l < 1e-6 ? 0 : Math.min(1, (FLY_SPEED * dt) / l);
    pos = [pos[0] + d[0] * k, pos[1] + d[1] * k, pos[2] + d[2] * k];
  };
  for (let n = 0; n < hits; ) {
    const facet = facetSeq[n % facetSeq.length];
    // Rearm: nearest live mote, again and again, until charged
    const r0 = t;
    while (charge < CHARGE_FULL) {
      for (const m of motes) if (!m.alive && t >= m.respawnAt) m.alive = true;
      let best: (typeof motes)[number] | null = null;
      let bd = Infinity;
      for (const m of motes) {
        if (!m.alive) continue;
        const d = Math.hypot(m.home[0] - pos[0], m.home[1] - pos[1], m.home[2] - pos[2]);
        if (d < bd) [bd, best] = [d, m];
      }
      if (!best) {
        t += 0.1;
        continue;
      }
      moveToward(best.home, 0.05);
      t += 0.05;
      if (Math.hypot(best.home[0] - pos[0], best.home[1] - pos[1], best.home[2] - pos[2]) < REACH) {
        best.alive = false;
        best.respawnAt = t + MOTES.respawn;
        charge++;
      }
    }
    run.rearm.push(t - r0);
    // The earliest opening it can reach and react to
    const w0 = t;
    const ops = opportunities(s, facet, t, t + 40);
    let fired = false;
    for (const o of ops) {
      const spot: V3 = [Math.cos(o.az) * RING.r, RING.y, Math.sin(o.az) * RING.r];
      const travel = Math.hypot(spot[0] - pos[0], spot[1] - pos[1], spot[2] - pos[2]) / FLY_SPEED;
      // Aims for the middle of what is left of the opening, then fires a
      // little early or late
      const meant = Math.max(o.start + REACTION, t + travel);
      if (meant > o.end - 0.05) continue;
      const mid = Math.max(meant, (meant + o.end) / 2 - 0.05);
      const fire = mid + (rnd() * 2 - 1) * TIMING_ERROR;
      // Placed and aimed for the moment it meant
      const from = ringSpot(s, facet, mid);
      const { travel: fly } = leadAim(s, facet, from, mid);
      const fireAim = leadAim(s, facet, from, fire).aim;
      const hit = shotHits(s, wallSlots(), facet, from, fireAim, fire);
      pos = from;
      t = fire + fly;
      fired = true;
      if (hit) n++;
      else run.misses++;
      break;
    }
    if (!fired) t += 40;
    run.wait.push(t - w0);
    charge = 0;
  }
  run.seconds = t - t0;
  return run;
}

/** Summary over many arrivals. */
export function summarise(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { min: s[0], p25: q(0.25), median: q(0.5), p75: q(0.75), max: s[s.length - 1], mean: s.reduce((a, b) => a + b, 0) / s.length };
}
