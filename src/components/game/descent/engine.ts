/**
 * DESCENT simulation. Pure: no DOM, no React, no timers, no Math.random.
 * The shell calls step() at a fixed 1/120 s and renders between steps
 * with interpolation, so physics never depends on the frame rate.
 *
 * World units are logical pixels; y grows downward (depth).
 * 1 metre = PX_PER_METRE logical pixels.
 */

import {
  buildRow,
  hitsShard,
  passInterval,
  ICE_THICKNESS,
  type Drift,
  type Pickup,
  type Row,
  type RowKind,
} from "./entities.ts";

export const STEP = 1 / 120;
export const PX_PER_METRE = 10;
export const WORLD_W = 320;

/**
 * Feel. Values from the brief first; anything changed by hand after
 * playtesting says so next to it.
 */
export const TUNING = {
  gravity: 900,
  terminal: 820,
  startSpeed: 260,
  steerAccel: 2600,
  maxVx: 420,
  /** Velocity kept per 1/60 s frame with no input. */
  friction: 0.86,
  wallSquashPx: 6,
  wallSquashTime: 0.12,
  /** Pointer steering: desired vx = gap to target x this rate. */
  pointerGain: 9,
  dashSpeed: 1500,
  dashBurst: 0.22,
  dashInvuln: 0.3,
  dashDecay: 0.5,
  dashCooldown: 0.9,
  dashBuffer: 0.12,
  cameraLead: 40,
  /** Reduced motion: every fall speed scaled by this. */
  reducedFallScale: 0.75,
  /** Thin ice bounce keeps this much of the speed (loses 40%). */
  bounceKeep: 0.6,
  lives: 3,
  hitInvuln: 1.0,
  shakeTime: 0.5,
  flashTime: 0.12,
  /** Drift shards turn harmful below this depth (m). */
  driftHarmDepth: 600,
  /** Extra life roughly this often (m). */
  lifeEvery: 400,
} as const;

/** Combo multiplier on metres gained: 1x, 1.5x at 5, 2x at 10, 3x at 20. */
export function comboMultiplier(combo: number): number {
  if (combo >= 20) return 3;
  if (combo >= 10) return 2;
  if (combo >= 5) return 1.5;
  return 1;
}

export interface Input {
  /** Keyboard steer: -1 left, 0 none, 1 right. */
  steer: number;
  /** Pointer target x in world px (mouse / touch drag), or null. */
  targetX: number | null;
  /** Dash pressed since the last step (edge, consumed by step). */
  dash: boolean;
}

export interface GameConfig {
  seed: number;
  /** Visible play height in logical px (568 desktop, taller on phones). */
  viewH: number;
  reducedMotion: boolean;
  /** Test hook: no damage. Never set by the shipped UI. */
  invulnerable?: boolean;
}

export type GameEvent =
  | { type: "start" }
  | { type: "dash"; x: number; y: number }
  | { type: "dashReady" }
  | { type: "wall"; side: -1 | 1 }
  | { type: "crack"; x: number; y: number }
  | { type: "shatter"; x: number; y: number; w: number }
  | { type: "break"; x: number; y: number; w: number }
  | { type: "damage"; x: number; y: number; lives: number }
  | { type: "shardBreak"; x: number; y: number; w: number; h: number }
  | { type: "mote"; x: number; y: number }
  | { type: "life"; x: number; y: number; lives: number }
  | { type: "combo"; combo: number; mult: number }
  | { type: "dead"; score: number; depth: number };

export interface Gem {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

export interface GameState {
  cfg: GameConfig;
  rng: () => number;
  time: number;
  gem: Gem;
  /** Previous step's values, for render interpolation. */
  prev: { x: number; y: number; camY: number };
  /** World y at the top of the view. */
  camY: number;
  /** Smoothed downward camera lead (px). */
  lead: number;
  /** Seconds until dash is available again; never negative. */
  cooldown: number;
  /** A dash pressed early waits this long for the cooldown to end. */
  dashBuffer: number;
  /** Remaining burst time at full dash speed. */
  dashT: number;
  /** Time since the burst ended, while decaying back to terminal. */
  decayT: number;
  /** Remaining dash invulnerability. */
  dashInvuln: number;
  /** Wall squash: remaining time and which wall. */
  squash: { t: number; side: -1 | 0 | 1 };
  /** Fall speeds after reduced-motion scaling. */
  speeds: { gravity: number; terminal: number; start: number; dash: number };
  /** Deepest metres reached; never decreases. */
  depth: number;
  /** Metres gained times the combo multiplier; never decreases. */
  score: number;
  lives: number;
  combo: number;
  /** Damage invulnerability (flicker) remaining. */
  hitInvuln: number;
  shake: number;
  flash: number;
  rows: Row[];
  drifts: Drift[];
  pickups: Pickup[];
  /** World y where the next row goes. */
  nextRowY: number;
  nextId: number;
  /** Depth (m) at which the next extra life may appear. */
  nextLifeAt: number;
  lastRowHadLife: boolean;
  events: GameEvent[];
  over: boolean;
}

/** Spawn parameters; section 4 derives these from depth. */
export interface SpawnParams {
  interval: number;
  gapFrac: number;
  thickShare: number;
  driftSpeed: number;
}

export function spawnParams(_depth: number): SpawnParams {
  return { interval: 1.4, gapFrac: 0.42, thickShare: 0.1, driftSpeed: 15 };
}

/** Mulberry32: small, fast, deterministic. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The gem sits this far down the play area; the world scrolls up. */
export const GEM_SCREEN_FRAC = 0.32;

export function createGame(cfg: GameConfig): GameState {
  const k = cfg.reducedMotion ? TUNING.reducedFallScale : 1;
  const speeds = {
    gravity: TUNING.gravity * k,
    terminal: TUNING.terminal * k,
    start: TUNING.startSpeed * k,
    dash: TUNING.dashSpeed * k,
  };
  const gem: Gem = { x: WORLD_W / 2, y: 0, vx: 0, vy: speeds.start, r: 5 };
  const camY = gem.y - cfg.viewH * GEM_SCREEN_FRAC;
  return {
    cfg,
    rng: seededRandom(cfg.seed),
    time: 0,
    gem,
    prev: { x: gem.x, y: gem.y, camY },
    camY,
    lead: 0,
    cooldown: 0,
    dashBuffer: 0,
    dashT: 0,
    decayT: -1,
    dashInvuln: 0,
    squash: { t: 0, side: 0 },
    speeds,
    depth: 0,
    score: 0,
    lives: TUNING.lives,
    combo: 0,
    hitInvuln: 0,
    shake: 0,
    flash: 0,
    rows: [],
    drifts: [],
    pickups: [],
    // First row a little under a screen below, so the opening is calm
    nextRowY: gem.y + cfg.viewH * 0.9,
    nextId: 1,
    nextLifeAt: TUNING.lifeEvery,
    lastRowHadLife: false,
    events: [{ type: "start" }],
    over: false,
  };
}

/* ── Spawning ─────────────────────────────────────────────── */

function spawnRow(s: GameState): void {
  const p = spawnParams(s.nextRowY / PX_PER_METRE);
  const rng = s.rng;
  const kind: RowKind = rng() < p.thickShare ? "shards" : "ice";
  const gapW = p.gapFrac * WORLD_W;
  const gapX = gapW / 2 + rng() * (WORLD_W - gapW);
  const y = s.nextRowY;
  s.rows.push(buildRow(rng, { id: s.nextId++, y, kind, gapX, gapW, worldW: WORLD_W }));

  // Pickups ride in the gap, a little above the row
  let hadLife = false;
  const depthM = y / PX_PER_METRE;
  if (depthM >= s.nextLifeAt && !s.lastRowHadLife) {
    s.pickups.push({ id: s.nextId++, kind: "life", x: gapX, y: y - 34, taken: false });
    s.nextLifeAt = depthM + TUNING.lifeEvery * (0.85 + rng() * 0.3);
    hadLife = true;
  } else if (rng() < 0.35) {
    s.pickups.push({ id: s.nextId++, kind: "mote", x: gapX + (rng() - 0.5) * gapW * 0.5, y: y - 30, taken: false });
  }
  s.lastRowHadLife = hadLife;

  const spacing = p.interval * Math.max(s.speeds.start, Math.min(s.speeds.terminal, s.gem.vy));
  // Drift chips between rows
  const chips = rng() < 0.6 ? 1 + Math.floor(rng() * 2) : 0;
  for (let i = 0; i < chips; i++) {
    const dir = rng() < 0.5 ? -1 : 1;
    s.drifts.push({
      id: s.nextId++,
      x: rng() * WORLD_W,
      y: y + spacing * (0.3 + rng() * 0.4),
      vx: dir * p.driftSpeed * (0.7 + rng() * 0.6),
      size: 3 + Math.floor(rng() * 3),
      harmful: depthM >= TUNING.driftHarmDepth,
      gone: false,
    });
  }
  s.nextRowY = y + spacing;
}

/* ── Collisions ───────────────────────────────────────────── */

function bumpCombo(s: GameState): void {
  s.combo += 1;
  s.events.push({ type: "combo", combo: s.combo, mult: comboMultiplier(s.combo) });
}

function shielded(s: GameState): boolean {
  return !!s.cfg.invulnerable || s.hitInvuln > 0 || isDashing(s);
}

function takeDamage(s: GameState, x: number, y: number): void {
  if (shielded(s)) return;
  s.lives -= 1;
  s.combo = 0;
  s.hitInvuln = TUNING.hitInvuln;
  s.shake = s.cfg.reducedMotion ? 0 : TUNING.shakeTime;
  s.flash = TUNING.flashTime;
  s.events.push({ type: "damage", x, y, lives: s.lives });
  if (s.lives <= 0) {
    s.over = true;
    s.events.push({ type: "dead", score: Math.floor(s.score), depth: Math.floor(s.depth) });
  }
}

function collide(s: GameState, prevY: number): void {
  const g = s.gem;
  for (const row of s.rows) {
    if (row.broken) continue;
    if (row.kind === "ice") {
      // Swept from above only: the bar is one-way, like thin ice
      const top = row.y - ICE_THICKNESS / 2;
      if (g.vy > 0 && prevY + g.r <= top && g.y + g.r >= top) {
        const [lo, hi] = passInterval(row, g.r);
        if (g.x >= lo && g.x <= hi) continue;
        if (isDashing(s)) {
          row.broken = true;
          bumpCombo(s);
          s.events.push({ type: "shatter", x: g.x, y: row.y, w: WORLD_W });
        } else if (row.cracks >= 1) {
          // Second bounce breaks it: a bar can never hold the gem forever
          row.broken = true;
          s.events.push({ type: "break", x: g.x, y: row.y, w: WORLD_W });
        } else {
          row.cracks += 1;
          row.crackX = g.x;
          g.y = top - g.r;
          g.vy = -g.vy * TUNING.bounceKeep;
          s.dashT = 0;
          s.decayT = -1;
          s.events.push({ type: "crack", x: g.x, y: row.y });
        }
      }
    } else {
      for (const sh of row.shards) {
        if (!hitsShard(sh, g.x, g.y, g.r)) continue;
        if (shielded(s)) continue;
        sh.broken = true;
        s.events.push({ type: "shardBreak", x: sh.x, y: sh.y, w: sh.w, h: sh.h });
        takeDamage(s, g.x, g.y);
        break;
      }
    }
  }
  for (const d of s.drifts) {
    if (d.gone || !d.harmful) continue;
    const r = g.r + d.size / 2;
    if ((d.x - g.x) ** 2 + (d.y - g.y) ** 2 >= r * r) continue;
    if (shielded(s)) continue;
    d.gone = true;
    takeDamage(s, g.x, g.y);
  }
  for (const pk of s.pickups) {
    if (pk.taken) continue;
    const r = g.r + 6;
    if ((pk.x - g.x) ** 2 + (pk.y - g.y) ** 2 > r * r) continue;
    pk.taken = true;
    if (pk.kind === "mote") {
      s.cooldown = 0;
      bumpCombo(s);
      s.events.push({ type: "mote", x: pk.x, y: pk.y });
    } else {
      s.lives = Math.min(TUNING.lives, s.lives + 1);
      s.events.push({ type: "life", x: pk.x, y: pk.y, lives: s.lives });
    }
  }
}

/** True while a dash can break thin ice and ignore damage. */
export function isDashing(s: GameState): boolean {
  return s.dashT > 0 || s.dashInvuln > 0;
}

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

export function step(s: GameState, input: Input, dt: number = STEP): void {
  if (s.over) return;
  s.prev.x = s.gem.x;
  s.prev.y = s.gem.y;
  s.prev.camY = s.camY;
  s.time += dt;
  const g = s.gem;
  const sp = s.speeds;

  /* Dash: buffered press fires the instant the cooldown ends */
  if (input.dash) s.dashBuffer = TUNING.dashBuffer;
  const wasCooling = s.cooldown > 0;
  s.cooldown = Math.max(0, s.cooldown - dt);
  if (wasCooling && s.cooldown === 0) s.events.push({ type: "dashReady" });
  if (s.dashBuffer > 0 && s.cooldown === 0) {
    s.dashBuffer = 0;
    s.dashT = TUNING.dashBurst;
    s.decayT = -1;
    s.dashInvuln = TUNING.dashInvuln;
    s.cooldown = TUNING.dashCooldown;
    s.events.push({ type: "dash", x: g.x, y: g.y });
  }
  s.dashBuffer = Math.max(0, s.dashBuffer - dt);
  s.dashInvuln = Math.max(0, s.dashInvuln - dt);

  /* Vertical */
  if (s.dashT > 0) {
    g.vy = sp.dash;
    s.dashT -= dt;
    if (s.dashT <= 0) {
      s.dashT = 0;
      s.decayT = 0;
    }
  } else if (s.decayT >= 0) {
    s.decayT += dt;
    const t = Math.min(1, s.decayT / TUNING.dashDecay);
    g.vy = sp.dash + (sp.terminal - sp.dash) * easeOutCubic(t);
    if (t >= 1) s.decayT = -1;
  } else {
    g.vy = Math.min(sp.terminal, g.vy + sp.gravity * dt);
  }
  const prevY = g.y;
  g.y += g.vy * dt;

  /* Horizontal: keyboard accelerates; a pointer eases toward its x */
  let accel = 0;
  if (input.steer !== 0) {
    accel = input.steer * TUNING.steerAccel;
  } else if (input.targetX !== null) {
    const desired = Math.max(-TUNING.maxVx, Math.min(TUNING.maxVx, (input.targetX - g.x) * TUNING.pointerGain));
    const dv = desired - g.vx;
    const maxDv = TUNING.steerAccel * dt;
    g.vx += Math.max(-maxDv, Math.min(maxDv, dv));
  }
  if (accel !== 0) {
    g.vx = Math.max(-TUNING.maxVx, Math.min(TUNING.maxVx, g.vx + accel * dt));
  } else if (input.targetX === null) {
    g.vx *= TUNING.friction ** (dt * 60);
    if (Math.abs(g.vx) < 1) g.vx = 0;
  }
  g.x += g.vx * dt;

  /* Walls: hard clamp, short squash */
  const minX = g.r;
  const maxX = WORLD_W - g.r;
  if (g.x < minX || g.x > maxX) {
    const side: -1 | 1 = g.x < minX ? -1 : 1;
    g.x = side < 0 ? minX : maxX;
    if (Math.abs(g.vx) > 60) {
      s.squash = { t: TUNING.wallSquashTime, side };
      s.events.push({ type: "wall", side });
    }
    g.vx = 0;
  }
  if (s.squash.t > 0) s.squash.t = Math.max(0, s.squash.t - dt);

  /* World: drift, spawn ahead, collide, cull behind */
  for (const d of s.drifts) {
    d.x += d.vx * dt;
    if (d.x < 2 || d.x > WORLD_W - 2) d.vx = -d.vx;
  }
  while (s.nextRowY < s.camY + s.cfg.viewH + 160) spawnRow(s);
  collide(s, prevY);
  const cull = s.camY - 80;
  if (s.rows.length && s.rows[0].y < cull) s.rows = s.rows.filter((r) => r.y >= cull);
  if (s.drifts.length > 24) s.drifts = s.drifts.filter((d) => !d.gone && d.y >= cull);
  if (s.pickups.length > 12) s.pickups = s.pickups.filter((pk) => !pk.taken && pk.y >= cull);

  s.hitInvuln = Math.max(0, s.hitInvuln - dt);
  s.shake = Math.max(0, s.shake - dt);
  s.flash = Math.max(0, s.flash - dt);

  /* Camera: lead downward with speed, eased, never snapped */
  const speedT = Math.max(0, Math.min(1, (g.vy - sp.start) / (sp.dash - sp.start)));
  s.lead += (TUNING.cameraLead * speedT - s.lead) * (1 - Math.exp(-6 * dt));
  s.camY = g.y - s.cfg.viewH * GEM_SCREEN_FRAC + s.lead;
  const newDepth = Math.max(s.depth, g.y / PX_PER_METRE);
  s.score += (newDepth - s.depth) * comboMultiplier(s.combo);
  s.depth = newDepth;
}

/** Drain queued events (audio, particles, aria-live). */
export function takeEvents(s: GameState): GameEvent[] {
  const e = s.events;
  s.events = [];
  return e;
}
