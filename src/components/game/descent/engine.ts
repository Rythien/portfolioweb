/**
 * DESCENT simulation. Pure: no DOM, no React, no timers, no Math.random.
 * The shell calls step() at a fixed 1/120 s and renders between steps
 * with interpolation, so physics never depends on the frame rate.
 *
 * World units are logical pixels; y grows downward (depth).
 * 1 metre = PX_PER_METRE logical pixels.
 */

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
} as const;

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
  | { type: "wall"; side: -1 | 1 };

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
  events: GameEvent[];
  over: boolean;
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
    events: [{ type: "start" }],
    over: false,
  };
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

  /* Camera: lead downward with speed, eased, never snapped */
  const speedT = Math.max(0, Math.min(1, (g.vy - sp.start) / (sp.dash - sp.start)));
  s.lead += (TUNING.cameraLead * speedT - s.lead) * (1 - Math.exp(-6 * dt));
  s.camY = g.y - s.cfg.viewH * GEM_SCREEN_FRAC + s.lead;
  s.depth = Math.max(s.depth, g.y / PX_PER_METRE);
}

/** Drain queued events (audio, particles, aria-live). */
export function takeEvents(s: GameState): GameEvent[] {
  const e = s.events;
  s.events = [];
  return e;
}
