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
  | { type: "start" };

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
  const gem: Gem = { x: WORLD_W / 2, y: 0, vx: 0, vy: 260, r: 5 };
  const camY = gem.y - cfg.viewH * GEM_SCREEN_FRAC;
  return {
    cfg,
    rng: seededRandom(cfg.seed),
    time: 0,
    gem,
    prev: { x: gem.x, y: gem.y, camY },
    camY,
    depth: 0,
    events: [{ type: "start" }],
    over: false,
  };
}

export function step(s: GameState, _input: Input, dt: number = STEP): void {
  if (s.over) return;
  s.prev.x = s.gem.x;
  s.prev.y = s.gem.y;
  s.prev.camY = s.camY;
  s.time += dt;

  const g = s.gem;
  g.vy = Math.min(820, g.vy + 900 * dt);
  g.y += g.vy * dt;

  s.camY = g.y - s.cfg.viewH * GEM_SCREEN_FRAC;
  s.depth = Math.max(s.depth, g.y / PX_PER_METRE);
}

/** Drain queued events (audio, particles, aria-live). */
export function takeEvents(s: GameState): GameEvent[] {
  const e = s.events;
  s.events = [];
  return e;
}
