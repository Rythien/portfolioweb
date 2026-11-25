/**
 * THE VOID: the rules. The player (the pixel gem), move / dash / attack,
 * the enemies: DRIFTERS, CHARGERS and SPITTERS (and their bolts), and
 * each room's SEAL.
 * Pure (no DOM): the shell feeds it
 * input and a frame time, render.ts draws the state, engine.test.ts pins
 * the numbers. Everything lives in pre-allocated pools: nothing is
 * allocated per frame.
 *
 * Space is the logical screen, 480 x 270 px, y down. An entity's (x, y)
 * is its FEET (the three-quarter view's ground point); sprites draw up
 * from there.
 */

export const VIEW = { w: 480, h: 270 } as const;

/** The feel numbers. Everything else is tuned around the dash. */
export const TUNE = {
  move: {
    speed: 95,
    /** Seconds to full speed from rest, and to rest from full: snappy, no slide. */
    accelTime: 0.045,
    decelTime: 0.035,
  },
  dash: {
    time: 0.18,
    /** Mean speed. Speed eases out across the dash: fast start, settle. */
    speed: 420,
    /** Speed at the start and end, as a multiple of the mean (mean of the two = 1). */
    ease: [1.3, 0.7] as [number, number],
    invuln: 0.12,
    cooldown: 0.55,
    /** Squash on dash start: scale along / across the dash, recovering over `squashTime`. */
    squash: [1.35, 0.7] as [number, number],
    squashTime: 0.09,
  },
  attack: {
    cooldown: 0.25,
    /** Reach from the gem's centre, and the half-angle of the burst. */
    range: 30,
    halfAngle: (55 * Math.PI) / 180,
    /** How long the burst draws. */
    show: 0.12,
  },
  hurt: { invuln: 0.8, knockback: 170, knockDecay: 14, hearts: 3 },
  feel: { hitStop: 0.06, shake: 2, shakeTime: 0.12 },
  /** The last heart: a longer hit-stop, then the arena freezes and fades. */
  death: { hitStop: 0.12, fade: 0.5 },
  drifter: {
    speed: 26,
    /** Telegraph before a drifter can move or hurt: a contracting ring. */
    telegraph: 0.6,
    radius: 5,
    wobble: 9,
    /** Push-apart distance between drifters. */
    space: 11,
    flash: 0.05,
  },
  /**
   * CHARGER: walks in, then stops and flashes for `windup` with its line
   * drawn (the line is locked when the flash starts: what you see is where
   * it goes), dashes straight along it, and is open while it recovers.
   * Two hits. It walks on the ice and its charge stops at the void.
   */
  charger: {
    speed: 22,
    hp: 2,
    /** Starts a windup from this far. */
    reach: 95,
    windup: 0.4,
    chargeSpeed: 300,
    chargeTime: 0.45,
    recover: 0.7,
    /** Before it may wind up again. */
    rest: 0.5,
    radius: 6,
  },
  /**
   * SPITTER: keeps its distance (backs off inside `near`, closes beyond
   * `far`, strafes between), and every `every` s stops for a `windup`
   * tell (its mouth glows, its aim drawn and LOCKED), then fires one slow
   * violet bolt. Bolts fly over the void; a dash's i-frames pass through
   * them. Two hits. It walks on the ice.
   */
  spitter: {
    speed: 30,
    hp: 2,
    near: 85,
    far: 135,
    /** Fires only from this close. */
    range: 220,
    every: 2.2,
    windup: 0.5,
    boltSpeed: 70,
    boltLife: 4,
    /** Bolt-to-gem-centre distance that hits. */
    boltHit: 5,
    radius: 6,
  },
  /** A hit that does not kill: a white flash and a shove. */
  hit: { flash: 0.08, shove: 7 },
  /** ONE fixed wave per room, cleared to open its doorway (no trickle). */
  spawn: { wave: 8, minDist: 80 },
  /** Walking through an open doorway: the screen fades to the void and back. */
  door: { fade: 0.4 },
  /**
   * SEAL: each room's mini-boss, after its wave. A loop, every attack
   * told the way the charger and spitter tell theirs:
   *   ring: a danger ring pulses at its base with the gap left clear
   *     (`ringWarn`), then a ring of shards spins outward with that gap
   *     (in the gap, or dashing, it passes you);
   *   fire: it blinks danger and dotted lines show a locked fan (`aimWarn`),
   *     then fires slow bolts along them (dash through them);
   *   recover: its core opens, pale ice (the "hit me" colour) for
   *     `recover`: the one window it can be hit. A hit closes it.
   * Three hits free it. The per-seal pattern is in ROOMS.
   */
  seal: {
    radius: 13,
    hits: 3,
    arrive: 1.0,
    ringWarn: 0.5,
    ringStart: 16,
    ringSpeed: 34,
    ringEnd: 118,
    /** The gap's angular width (rad). */
    gap: 0.95,
    /** Half-thickness of a ring's sting band (px, to the gem's centre). */
    ringHit: 4,
    /** After the last ring leaves: wait until it is this far out before aiming. */
    clearRadius: 70,
    aimWarn: 0.6,
    boltSpeed: 75,
    flinch: 0.3,
    /** The project's cover blooming into the room, before the doorway opens. */
    bloom: 3.0,
  },
} as const;

/** One seal's pattern (ROOMS[i].seal). */
export interface SealPattern {
  /** Rings per cycle, launched `ringEvery` s apart. */
  rings: number;
  ringEvery: number;
  /** Spin (rad/s); `alternate` flips it ring by ring. */
  spin: number;
  alternate: boolean;
  /** Bolts in the fan, and its spread (rad). */
  fan: number;
  spread: number;
  /** The vulnerable window (s). */
  recover: number;
}

/** Seal states. */
export const SealState = { Off: 0, Arrive: 1, RingWarn: 2, Rings: 3, AimWarn: 4, Recover: 5, Flinch: 6, Freed: 7 } as const;

export interface Ring {
  alive: boolean;
  r: number;
  /** The gap's centre angle now, and its spin (rad/s). */
  gapA: number;
  spin: number;
}
export const MAX_RINGS = 6;

export interface Seal {
  state: number;
  t: number;
  x: number;
  y: number;
  hp: number;
  flash: number;
  /** Rings still to launch this cycle, and the gap angle of the next (shown in its warning). */
  ringsLeft: number;
  nextGap: number;
  /** The fan's locked centre angle. */
  aimA: number;
  /** Since it was freed (drives the bloom), or -1. */
  freedT: number;
}

/** Enemy kinds (plain object: node's type stripping has no enums). */
export const EnemyKind = { Drifter: 0, Charger: 1, Spitter: 2 } as const;
export type EnemyKind = (typeof EnemyKind)[keyof typeof EnemyKind];
export const ENEMY_NAMES = ["drifter", "charger", "spitter"] as const;
export type EnemyName = (typeof ENEMY_NAMES)[number];

/** A wave: how many of each kind. */
export type Wave = Partial<Record<EnemyName, number>>;

/** Charger states. */
export const Charge = { Walk: 0, Windup: 1, Dash: 2, Recover: 3 } as const;
/** Spitter states. */
export const Spit = { Move: 0, Windup: 1 } as const;

/** Body radius per kind (for the attack's reach). */
const RADIUS = [TUNE.drifter.radius, TUNE.charger.radius, TUNE.spitter.radius] as const;
/** Hit points per kind. */
const HP = [1, TUNE.charger.hp, TUNE.spitter.hp] as const;

/** Where every room's seal rises: above the spawn, on the ice. */
export const SEAL_SPOT = { x: 240, y: 108 } as const;

/** The gem's collision: feet half-extents (px). */
const FEET = { x: 4, y: 3 } as const;
/** Distance at which an enemy touches the gem. */
const TOUCH = 9;

/* ── Seeded randomness (tests reproduce a run) ─────────────────── */

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── The room: an ice island over the void ─────────────────────── */

export const TILE = 10;
export const COLS = VIEW.w / TILE; // 48
export const ROWS = VIEW.h / TILE; // 27

export interface Room {
  /** 1 = ice, 0 = void; COLS x ROWS, row-major. */
  ice: Uint8Array;
  spawnX: number;
  spawnY: number;
  /** The doorway out: two tiles on the north rim (logical px). */
  door: { x: number; y: number; w: number; h: number };
}

/**
 * The run's rooms, in order: the island's half-size in tiles (its edge
 * then bitten by noise), the void pits inside it (tile x, y, w, h), and
 * the wave that fills it. Later rooms are tighter, and each adds a kind:
 * room 1 drifters only, room 2 adds chargers, room 3 adds spitters.
 */
/** Seal 1: one ring, a 3-bolt fan, a long window. */
const SEAL_1: SealPattern = { rings: 1, ringEvery: 0, spin: 0.9, alternate: false, fan: 3, spread: 0.5, recover: 1.5 };
/** Seal 2: two rings 1.2 s apart spinning opposite ways (their gaps cross), a 5-bolt fan, a shorter window. */
const SEAL_2: SealPattern = { rings: 2, ringEvery: 1.2, spin: 1.3, alternate: true, fan: 5, spread: 0.8, recover: 1.3 };
/** Seal 3: three rings 1.0 s apart, alternating, faster; a 7-bolt fan; the shortest window. */
const SEAL_3: SealPattern = { rings: 3, ringEvery: 1.0, spin: 1.6, alternate: true, fan: 7, spread: 1.1, recover: 1.1 };
export const ROOMS: { half: [number, number]; pits: [number, number, number, number][]; wave: Wave; seal: SealPattern }[] = [
  { half: [13, 5.5], pits: [[14, 9, 3, 3], [31, 15, 4, 2]], wave: { drifter: 8 }, seal: SEAL_1 },
  { half: [13, 5.5], pits: [[12, 8, 3, 2], [19, 16, 2, 3], [29, 9, 4, 2], [33, 16, 3, 2]], wave: { drifter: 6, charger: 3 }, seal: SEAL_2 },
  { half: [11.5, 4.8], pits: [[15, 10, 2, 3], [21, 8, 3, 2], [28, 15, 3, 2], [32, 10, 2, 3]], wave: { drifter: 4, charger: 2, spitter: 3 }, seal: SEAL_3 },
];

/**
 * One screen: a chipped island with void pits inside it. Edges are ragged
 * (seeded), so the void is a shape to play around, not a frame.
 */
export function buildRoom(index = 0): Room {
  const spec = ROOMS[Math.min(index, ROOMS.length - 1)];
  const r = rng(index + 1);
  const ice = new Uint8Array(COLS * ROWS);
  const cx = COLS / 2, cy = ROWS / 2 + 0.5;
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) {
      // A rounded rectangle, its edge bitten by noise; ~40 x 20 tiles at
      // most, so 3x fits a 1280-wide screen
      const dx = Math.max(0, Math.abs(x + 0.5 - cx) - spec.half[0]) / 5;
      const dy = Math.max(0, Math.abs(y + 0.5 - cy) - spec.half[1]) / 3.6;
      const d = Math.hypot(dx, dy);
      if (d < 0.75 + 0.5 * r()) ice[y * COLS + x] = 1;
    }
  // Pits: void to dash across the corners of, never through
  for (const [px, py, w, h] of spec.pits)
    for (let y = py; y < py + h; y++) for (let x = px; x < px + w; x++) ice[y * COLS + x] = 0;
  // Keep the outer rows/columns void (the island floats; its cliffs hang below)
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) if (x < 3 || y < 3 || x >= COLS - 3 || y >= ROWS - 3) ice[y * COLS + x] = 0;
  // The doorway: the pair of north-rim tiles nearest the centre (ice, void above)
  const rimTop = (c: number) => {
    for (let y = 0; y < ROWS; y++) if (ice[y * COLS + c]) return y;
    return -1;
  };
  let door = { x: 0, y: 0, w: 2 * TILE, h: TILE };
  for (let k = 0; k < COLS; k++) {
    const c = Math.floor(COLS / 2) - 1 + (k % 2 ? -(k + 1) >> 1 : k >> 1);
    const t = rimTop(c);
    if (t > 0 && rimTop(c + 1) === t) {
      door = { x: c * TILE, y: t * TILE, w: 2 * TILE, h: TILE };
      break;
    }
  }
  return { ice, spawnX: VIEW.w / 2, spawnY: VIEW.h / 2 + 20, door };
}

/** Cliffs hang this far below a south edge (render.ts draws up to 15). */
export const CLIFF_DROP = 16;

/**
 * The island's extent in logical px (cliffs included): what the shell must
 * keep on screen. Everything outside it is empty void, safe to crop.
 */
export function roomBounds(room: Room): { x0: number; y0: number; x1: number; y1: number } {
  let x0: number = VIEW.w, y0: number = VIEW.h, x1 = 0, y1 = 0;
  for (let j = 0; j < ROWS; j++)
    for (let i = 0; i < COLS; i++) {
      if (!room.ice[j * COLS + i]) continue;
      x0 = Math.min(x0, i * TILE);
      x1 = Math.max(x1, (i + 1) * TILE);
      y0 = Math.min(y0, j * TILE);
      y1 = Math.max(y1, (j + 1) * TILE + CLIFF_DROP);
    }
  return { x0, y0, x1, y1 };
}

export function iceAt(room: Room, x: number, y: number): boolean {
  const c = Math.floor(x / TILE), r = Math.floor(y / TILE);
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return false;
  return room.ice[r * COLS + c] === 1;
}

/** A walker's feet stay on ice (a smaller box than the gem's). */
function standsOnIce(room: Room, x: number, y: number): boolean {
  return iceAt(room, x - 3, y - 2) && iceAt(room, x + 3, y - 2) && iceAt(room, x - 3, y + 2) && iceAt(room, x + 3, y + 2);
}

/** The gem's feet box stands wholly on ice. */
function feetOnIce(room: Room, x: number, y: number): boolean {
  return (
    iceAt(room, x - FEET.x, y - FEET.y) &&
    iceAt(room, x + FEET.x, y - FEET.y) &&
    iceAt(room, x - FEET.x, y + FEET.y) &&
    iceAt(room, x + FEET.x, y + FEET.y)
  );
}

/* ── State ─────────────────────────────────────────────────────── */

export interface Input {
  /** Movement, each axis -1..1 (keyboard: -1, 0 or 1). */
  mx: number;
  my: number;
  /** Dash pressed this frame (an edge, not a hold). */
  dash: boolean;
  /** Attack held (repeats on cooldown). */
  attack: boolean;
  /** Aim for this attack (unit vector), or 0,0 to use the facing. */
  aimX: number;
  aimY: number;
}

export interface Enemy {
  alive: boolean;
  kind: EnemyKind;
  hp: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** > 0: still telegraphing its arrival (cannot move or hurt). */
  arrive: number;
  /** White hit flash. */
  flash: number;
  /** Drifter sway; spitter strafe. */
  phase: number;
  /** Behaviour state (Charge.*) and time left in it. */
  state: number;
  t: number;
  /** A locked direction (the charge line). */
  ax: number;
  ay: number;
  /** Time before it may act again (charger rest). */
  cool: number;
}

/** Particle kinds (a plain object: node's type stripping has no enums). */
export const Kind = { Chip: 0, Shard: 1, Spark: 2 } as const;
export type Kind = (typeof Kind)[keyof typeof Kind];

export interface Particle {
  alive: boolean;
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  /** Palette index (render.ts PALETTE). */
  color: number;
  friction: number;
}

export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  faceX: number;
  faceY: number;
  dashAge: number; // < 0: not dashing
  dashX: number;
  dashY: number;
  dashCd: number;
  atkCd: number;
  /** Time since the last attack (for the burst draw), and its aim. */
  atkAge: number;
  atkX: number;
  atkY: number;
  squash: number;
  hearts: number;
  invuln: number;
  kbX: number;
  kbY: number;
}

/**
 * Where a run stands. "dead": the last heart is gone; the arena is frozen
 * and the shell shows YOU WOKE (R falls again, Escape wakes). "won": room
 * 3's seal is freed, all three projects with it; the shell wakes the
 * visitor at Contact. Nothing ever leaves the gem gone in "play".
 */
export type Phase = "play" | "dead" | "won";

export const TRAIL = 6;
export const MAX_ENEMIES = 40;
export const MAX_BOLTS = 24;

export interface Bolt {
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}
export const MAX_PARTICLES = 320;

export interface World {
  room: Room;
  t: number;
  player: Player;
  enemies: Enemy[];
  bolts: Bolt[];
  /** Test hook: one wave for every room instead of ROOMS' own (or null). */
  waveOverride: Wave | null;
  /** The room this run is in (index into ROOMS). */
  roomIndex: number;
  /** The seal is freed and the doorway is open. */
  doorOpen: boolean;
  seal: Seal;
  rings: Ring[];
  /** Rooms whose seal this run freed (the shell unlocks their projects). */
  freed: boolean[];
  /** < 0: no room change; else seconds into the fade through a doorway. */
  transition: number;
  particles: Particle[];
  /** Ring buffer of past feet positions (x, y pairs), newest at trailHead. */
  trail: Float32Array;
  trailHead: number;
  trailClock: number;
  hitStop: number;
  shake: number;
  phase: Phase;
  /** Seconds in the current phase once it is not "play" (drives the fade). */
  endT: number;
  /** The room this run reached (1-based, for the cards). */
  roomReached: number;
  kills: number;
  hits: number;
  random: () => number;
  /** Reduced motion: slower enemies, longer telegraphs, no shake. */
  reduced: boolean;
}

function freshPlayer(room: Room): Player {
  return {
    x: room.spawnX, y: room.spawnY, vx: 0, vy: 0, faceX: 1, faceY: 0,
    dashAge: -1, dashX: 1, dashY: 0, dashCd: 0, atkCd: 0, atkAge: 99, atkX: 1, atkY: 0,
    squash: 0, hearts: TUNE.hurt.hearts, invuln: 0, kbX: 0, kbY: 0,
  };
}

/** The wave a room starts with. */
export function waveFor(w: World, index: number): Wave {
  return w.waveOverride ?? ROOMS[index].wave;
}

export function createWorld(seed = 1, reduced = false, wave: Wave | null = null, startRoom = 0): World {
  const room = buildRoom(startRoom);
  const w: World = {
    room,
    t: 0,
    player: freshPlayer(room),
    enemies: Array.from({ length: MAX_ENEMIES }, (): Enemy => ({
      alive: false, kind: EnemyKind.Drifter, hp: 1, x: 0, y: 0, vx: 0, vy: 0, arrive: 0, flash: 0, phase: 0,
      state: 0, t: 0, ax: 0, ay: 0, cool: 0,
    })),
    waveOverride: wave,
    roomIndex: 0,
    doorOpen: false,
    seal: { state: SealState.Off, t: 0, x: SEAL_SPOT.x, y: SEAL_SPOT.y, hp: TUNE.seal.hits, flash: 0, ringsLeft: 0, nextGap: 0, aimA: 0, freedT: -1 },
    rings: Array.from({ length: MAX_RINGS }, (): Ring => ({ alive: false, r: 0, gapA: 0, spin: 0 })),
    freed: ROOMS.map(() => false),
    transition: -1,
    bolts: Array.from({ length: MAX_BOLTS }, (): Bolt => ({ alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0 })),
    particles: Array.from({ length: MAX_PARTICLES }, () => ({
      alive: false, kind: Kind.Chip, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, color: 0, friction: 0,
    })),
    trail: new Float32Array(TRAIL * 2),
    trailHead: 0,
    trailClock: 0,
    hitStop: 0,
    shake: 0,
    phase: "play",
    endT: 0,
    roomReached: 1,
    kills: 0,
    hits: 0,
    random: rng(seed * 7919 + 3),
    reduced,
  };
  loadRoom(w, startRoom);
  return w;
}

/** Enter room `index`: its island, the gem at its spawn (hearts kept), its wave. */
export function loadRoom(w: World, index: number): void {
  w.roomIndex = index;
  w.roomReached = Math.max(w.roomReached, index + 1);
  w.room = buildRoom(index);
  const p = w.player;
  p.x = w.room.spawnX;
  p.y = w.room.spawnY;
  p.vx = p.vy = p.kbX = p.kbY = 0;
  p.dashAge = 99;
  for (const d of w.enemies) d.alive = false;
  for (const b of w.bolts) b.alive = false;
  for (const q of w.particles) q.alive = false;
  w.doorOpen = false;
  w.seal.state = SealState.Off;
  w.seal.freedT = -1;
  for (const r of w.rings) r.alive = false;
  resetTrail(w);
  spawnWave(w, waveFor(w, index));
  // An empty wave (a test hook) goes straight to the seal
  if (!w.enemies.some((d) => d.alive)) startSeal(w);
}

/** The wave is down: the room's seal rises. */
function startSeal(w: World): void {
  const s = w.seal;
  s.state = SealState.Arrive;
  s.t = TUNE.seal.arrive * (w.reduced ? 1.5 : 1);
  s.x = SEAL_SPOT.x;
  s.y = SEAL_SPOT.y;
  s.hp = TUNE.seal.hits;
  s.flash = 0;
  s.freedT = -1;
}

/** The pattern of the seal in this room. */
export function sealPattern(w: World): SealPattern {
  return ROOMS[w.roomIndex].seal;
}

/** Is the seal open to a hit right now? */
export function sealOpen(w: World): boolean {
  return w.seal.state === SealState.Recover;
}

function resetTrail(w: World): void {
  for (let i = 0; i < TRAIL; i++) {
    w.trail[i * 2] = w.player.x;
    w.trail[i * 2 + 1] = w.player.y;
  }
}

/**
 * R ("fall again"): a fresh run, same world objects (no allocation churn).
 * `startRoom`: the first room whose project is not yet freed (the shell
 * knows which), so a death never makes you refight what you freed.
 */
export function restart(w: World, startRoom = 0): void {
  w.room = buildRoom(startRoom);
  Object.assign(w.player, freshPlayer(w.room));
  w.phase = "play";
  w.endT = 0;
  w.hitStop = 0;
  w.shake = 0;
  w.kills = 0;
  w.hits = 0;
  w.transition = -1;
  w.roomReached = startRoom + 1;
  w.freed.fill(false);
  loadRoom(w, startRoom);
}

/* ── Helpers ───────────────────────────────────────────────────── */

const approach = (v: number, target: number, step: number) =>
  v < target ? Math.min(target, v + step) : Math.max(target, v - step);

export function isDashing(p: Player): boolean {
  return p.dashAge >= 0 && p.dashAge < TUNE.dash.time;
}

export function isInvulnerable(p: Player): boolean {
  return p.invuln > 0 || (p.dashAge >= 0 && p.dashAge < TUNE.dash.invuln);
}

function emit(w: World, kind: Kind, x: number, y: number, vx: number, vy: number, life: number, color: number, friction: number) {
  for (const q of w.particles) {
    if (q.alive) continue;
    q.alive = true; q.kind = kind; q.x = x; q.y = y; q.vx = vx; q.vy = vy;
    q.life = life; q.max = life; q.color = color; q.friction = friction;
    return;
  }
}

/** Moves the player's feet by (dx, dy), axis by axis, never off the ice. */
function moveOnIce(w: World, dx: number, dy: number): void {
  const p = w.player;
  // Sub-steps so a dash (up to ~9 px a frame) never skips a thin pit edge
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 2));
  const sx = dx / n, sy = dy / n;
  for (let i = 0; i < n; i++) {
    if (sx && feetOnIce(w.room, p.x + sx, p.y)) p.x += sx;
    if (sy && feetOnIce(w.room, p.x, p.y + sy)) p.y += sy;
  }
}

/** Places a wave on the ice, away from the gem, each arriving behind a telegraph ring. */
export function spawnWave(w: World, wave: Wave): void {
  const p = w.player;
  const tele = TUNE.drifter.telegraph * (w.reduced ? 1.5 : 1);
  let placed = 0;
  ENEMY_NAMES.forEach((name, kind) => {
    const count = wave[name] ?? 0;
    for (let n = 0, tries = 0; n < count && tries < 400; tries++) {
      const x = 30 + w.random() * (VIEW.w - 60);
      const y = 30 + w.random() * (VIEW.h - 60);
      if (!standsOnIce(w.room, x, y) || Math.hypot(x - p.x, y - p.y) < TUNE.spawn.minDist) continue;
      const d = w.enemies.find((q) => !q.alive);
      if (!d) return;
      d.alive = true; d.kind = kind as EnemyKind; d.x = x; d.y = y; d.vx = 0; d.vy = 0;
      d.hp = HP[kind];
      d.arrive = tele + placed * 0.08; // a ripple, not a pop
      d.flash = 0; d.phase = w.random() * Math.PI * 2;
      d.state = 0; d.t = 0; d.ax = 0; d.ay = 0; d.cool = 0.4 + w.random() * 0.8;
      placed++;
      n++;
    }
  });
}

function killEnemy(w: World, d: Enemy): void {
  d.alive = false;
  w.kills++;
  // The wave is down: the room's seal rises (it, not the wave, opens the door)
  if (!w.enemies.some((o) => o.alive) && w.seal.state === SealState.Off) startSeal(w);
  // Chips: ice and energy, flung outward, slowed by friction
  // Two-hit kinds burst bigger
  for (let i = 0; i < (d.kind === EnemyKind.Drifter ? 9 : 13); i++) {
    const a = w.random() * Math.PI * 2;
    const s = 60 + w.random() * 90;
    emit(w, Kind.Chip, d.x, d.y - 6, Math.cos(a) * s, Math.sin(a) * s - 20, 0.35 + w.random() * 0.25, i % 3, 7);
  }
  w.shake = Math.max(w.shake, TUNE.feel.shakeTime);
}

function hurt(w: World, fromX: number, fromY: number): void {
  const p = w.player;
  p.hearts--;
  p.invuln = TUNE.hurt.invuln;
  const dx = p.x - fromX, dy = p.y - fromY;
  const l = Math.hypot(dx, dy) || 1;
  p.kbX = (dx / l) * TUNE.hurt.knockback;
  p.kbY = (dy / l) * TUNE.hurt.knockback;
  w.shake = Math.max(w.shake, TUNE.feel.shakeTime * 1.5);
  w.hitStop = TUNE.feel.hitStop;
  if (p.hearts <= 0) die(w);
}

/** The last heart: the gem shatters, the world holds, then freezes. */
function die(w: World): void {
  const p = w.player;
  w.phase = "dead";
  w.endT = 0;
  w.hitStop = TUNE.death.hitStop;
  p.kbX = p.kbY = 0;
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + w.random() * 0.3;
    const s = 50 + w.random() * 110;
    emit(w, Kind.Chip, p.x, p.y - 7, Math.cos(a) * s, Math.sin(a) * s - 25, 0.5 + w.random() * 0.4, i % 2 ? 3 : 1, 5);
  }
}

/* ── The step ──────────────────────────────────────────────────── */

export function step(w: World, dt: number, input: Input): void {
  // Hit-stop freezes the world, chips included: the hit lands
  if (w.hitStop > 0) {
    w.hitStop = Math.max(0, w.hitStop - dt);
    return;
  }
  w.t += dt;
  w.shake = Math.max(0, w.shake - dt);
  const p = w.player;

  // Over (dead or cleared): the arena holds still; only the last chips
  // settle. The shell's card is the way on (R) or out (Escape)
  if (w.phase !== "play") {
    w.endT += dt;
    stepParticles(w, dt);
    return;
  }

  // Through a doorway: the world holds while the screen fades to the void;
  // the next room loads at the darkest point
  if (w.transition >= 0) {
    const half = TUNE.door.fade / 2;
    const before = w.transition;
    w.transition += dt;
    if (before < half && w.transition >= half) loadRoom(w, w.roomIndex + 1);
    if (w.transition >= TUNE.door.fade) w.transition = -1;
    return;
  }

  p.dashCd = Math.max(0, p.dashCd - dt);
  p.atkCd = Math.max(0, p.atkCd - dt);
  p.invuln = Math.max(0, p.invuln - dt);
  p.squash = Math.max(0, p.squash - dt);
  p.atkAge += dt;

  // Facing follows movement
  const ml = Math.hypot(input.mx, input.my);
  const mx = ml > 1 ? input.mx / ml : input.mx;
  const my = ml > 1 ? input.my / ml : input.my;
  if (ml > 0.01) {
    const fl = Math.hypot(mx, my);
    p.faceX = mx / fl;
    p.faceY = my / fl;
  }

  // Dash: the core defensive verb
  if (input.dash && p.dashCd <= 0 && !isDashing(p)) {
    // Along the held direction (the facing just took it), else the facing
    p.dashX = p.faceX;
    p.dashY = p.faceY;
    p.dashAge = 0;
    p.dashCd = TUNE.dash.cooldown;
    p.squash = TUNE.dash.squashTime;
  }

  if (isDashing(p)) {
    const k = p.dashAge / TUNE.dash.time;
    const s = TUNE.dash.speed * (TUNE.dash.ease[0] + (TUNE.dash.ease[1] - TUNE.dash.ease[0]) * k);
    const used = Math.min(dt, TUNE.dash.time - p.dashAge);
    moveOnIce(w, p.dashX * s * used, p.dashY * s * used);
    p.dashAge += dt;
    // Leaves the dash at walking speed in the held direction: no slide
    p.vx = mx * TUNE.move.speed;
    p.vy = my * TUNE.move.speed;
    if (!isDashing(p)) p.dashAge = 99;
  } else {
    const tx = mx * TUNE.move.speed, ty = my * TUNE.move.speed;
    const accel = TUNE.move.speed / TUNE.move.accelTime;
    const decel = TUNE.move.speed / TUNE.move.decelTime;
    p.vx = approach(p.vx, tx, (Math.abs(tx) > Math.abs(p.vx) && Math.sign(tx) === Math.sign(p.vx || tx) ? accel : decel) * dt);
    p.vy = approach(p.vy, ty, (Math.abs(ty) > Math.abs(p.vy) && Math.sign(ty) === Math.sign(p.vy || ty) ? accel : decel) * dt);
    moveOnIce(w, p.vx * dt, p.vy * dt);
  }
  // Knockback rides on top and dies away fast
  if (p.kbX || p.kbY) {
    moveOnIce(w, p.kbX * dt, p.kbY * dt);
    const f = Math.exp(-TUNE.hurt.knockDecay * dt);
    p.kbX *= f;
    p.kbY *= f;
    if (Math.hypot(p.kbX, p.kbY) < 4) p.kbX = p.kbY = 0;
  }

  // Trail: a sample every 20 ms
  w.trailClock += dt;
  if (w.trailClock >= 0.02) {
    w.trailClock = 0;
    w.trailHead = (w.trailHead + 1) % TRAIL;
    w.trail[w.trailHead * 2] = p.x;
    w.trail[w.trailHead * 2 + 1] = p.y;
  }

  // Attack: a shard burst in the facing (or aimed) direction
  if (input.attack && p.atkCd <= 0) attack(w, input);

  // The seal is solid: the gem is pushed out of its body
  const sl = w.seal;
  if (sl.state !== SealState.Off && sl.state !== SealState.Freed) {
    const ox = p.x - sl.x, oy = p.y - sl.y;
    const ol = Math.hypot(ox, oy);
    const min = TUNE.seal.radius + 4;
    if (ol < min) {
      const k = (min - ol) / (ol || 1);
      moveOnIce(w, (ol ? ox : 0) * k, (ol ? oy : 1) * k);
    }
  }

  stepEnemies(w, dt);
  stepSeal(w, dt);
  stepBolts(w, dt);
  stepParticles(w, dt);

  // Walking into the open doorway (its tile row on the north rim) leaves
  const door = w.room.door;
  if (w.doorOpen && w.phase === "play" && p.x > door.x - 1 && p.x < door.x + door.w + 1 && p.y < door.y + door.h) {
    w.transition = 0;
  }
}

/** 0..1: how dark the doorway fade is now (0 = none). */
export function transitionVeil(w: World): number {
  if (w.transition < 0) return 0;
  return 1 - Math.abs(w.transition / (TUNE.door.fade / 2) - 1);
}

function attack(w: World, input: Input): void {
  const p = w.player;
  const al = Math.hypot(input.aimX, input.aimY);
  const ax = al > 0.01 ? input.aimX / al : p.faceX;
  const ay = al > 0.01 ? input.aimY / al : p.faceY;
  if (al > 0.01) {
    p.faceX = ax;
    p.faceY = ay;
  }
  p.atkCd = TUNE.attack.cooldown;
  p.atkAge = 0;
  p.atkX = ax;
  p.atkY = ay;
  // The burst's shards
  const base = Math.atan2(ay, ax);
  for (let i = 0; i < 7; i++) {
    const a = base + (i / 6 - 0.5) * 2 * TUNE.attack.halfAngle * 0.9;
    const s = 230 + w.random() * 60;
    emit(w, Kind.Shard, p.x + ax * 4, p.y - 6 + ay * 4, Math.cos(a) * s, Math.sin(a) * s, TUNE.attack.show, 1, 16);
  }
  // Hits: enemies whose body centre is in the cone and in reach
  const cosHalf = Math.cos(TUNE.attack.halfAngle);
  let connected = false;
  for (const d of w.enemies) {
    if (!d.alive || d.arrive > 0) continue;
    const dx = d.x - p.x, dy = d.y - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist > TUNE.attack.range + RADIUS[d.kind]) continue;
    // Point blank always counts; otherwise it must be in the cone
    if (dist > 8 && (dx * ax + dy * ay) / dist < cosHalf) continue;
    connected = true;
    w.hits++;
    d.hp--;
    if (d.hp <= 0) {
      d.flash = TUNE.drifter.flash;
      killEnemy(w, d);
    } else {
      // Survives: flashes white and is shoved back along the burst
      d.flash = TUNE.hit.flash;
      shove(w, d, ax * TUNE.hit.shove, ay * TUNE.hit.shove);
    }
  }
  // The seal: only while its core is open; otherwise the burst clinks off
  const sl = w.seal;
  if (sl.state !== SealState.Off && sl.state !== SealState.Freed && sl.state !== SealState.Arrive) {
    const dx = sl.x - p.x, dy = sl.y - 8 - (p.y - 6);
    const dist = Math.hypot(dx, dy);
    if (dist <= TUNE.attack.range + TUNE.seal.radius && (dist < 10 || (dx * ax + dy * ay) / dist >= cosHalf)) {
      if (sl.state === SealState.Recover) {
        connected = true;
        w.hits++;
        sl.hp--;
        sl.flash = TUNE.hit.flash;
        w.shake = Math.max(w.shake, TUNE.feel.shakeTime);
        if (sl.hp <= 0) freeSeal(w);
        else {
          // A hit closes the window: one hit per opening
          sl.state = SealState.Flinch;
          sl.t = TUNE.seal.flinch;
        }
      } else {
        // Armoured: a clink of sparks, no damage
        for (let i = 0; i < 4; i++) {
          const a = Math.atan2(-dy, -dx) + (w.random() - 0.5) * 1.4;
          emit(w, Kind.Spark, sl.x - (dx / (dist || 1)) * 10, sl.y - 8 - (dy / (dist || 1)) * 10, Math.cos(a) * 90, Math.sin(a) * 90, 0.18, 1, 10);
        }
      }
    }
  }
  if (connected) w.hitStop = TUNE.feel.hitStop;
}

/** Three hits: the seal shatters, its project is freed; the bloom, then the door. */
function freeSeal(w: World): void {
  const s = w.seal;
  s.state = SealState.Freed;
  s.freedT = 0;
  w.freed[w.roomIndex] = true;
  for (const r of w.rings) r.alive = false;
  for (const b of w.bolts) b.alive = false;
  w.hitStop = TUNE.death.hitStop;
  w.shake = Math.max(w.shake, TUNE.feel.shakeTime * 2);
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + w.random() * 0.2;
    const v = 60 + w.random() * 140;
    emit(w, Kind.Chip, s.x, s.y - 12, Math.cos(a) * v, Math.sin(a) * v - 30, 0.6 + w.random() * 0.5, i % 3, 4);
  }
}

function stepSeal(w: World, dt: number): void {
  const s = w.seal;
  const S = TUNE.seal;
  const P = sealPattern(w);
  const p = w.player;
  const slow = w.reduced ? 0.75 : 1;
  const tell = w.reduced ? 1.5 : 1;
  s.flash = Math.max(0, s.flash - dt);
  // Rings spin outward whatever the seal is doing
  for (const r of w.rings) {
    if (!r.alive) continue;
    r.r += S.ringSpeed * slow * dt;
    r.gapA += r.spin * dt;
    if (r.r > S.ringEnd) {
      r.alive = false;
      continue;
    }
    // The sting: on the ring's band, outside its gap, not dashing
    if (w.phase !== "play" || isInvulnerable(p)) continue;
    const gx = p.x - s.x, gy = p.y - 6 - (s.y - 8);
    if (Math.abs(Math.hypot(gx, gy) - r.r) > S.ringHit) continue;
    let da = Math.atan2(gy, gx) - r.gapA;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    if (Math.abs(da) > S.gap / 2) hurt(w, s.x, s.y - 8);
  }
  if (s.state === SealState.Off) return;
  if (s.state === SealState.Freed) {
    s.freedT += dt;
    if (s.freedT >= S.bloom && !w.doorOpen && w.phase === "play") {
      if (w.roomIndex < ROOMS.length - 1) w.doorOpen = true;
      else {
        // The last seal: the run is won; the shell wakes the visitor at Contact
        w.phase = "won";
        w.endT = 0;
      }
    }
    return;
  }
  s.t -= dt;
  if (s.t > 0) return;
  switch (s.state) {
    case SealState.Arrive:
    case SealState.Flinch:
      // A cycle begins: the first ring's warning, its gap shown
      s.ringsLeft = P.rings;
      s.nextGap = Math.atan2(p.y - 6 - (s.y - 8), p.x - s.x) + Math.PI + (w.random() - 0.5) * 2;
      s.state = SealState.RingWarn;
      s.t = S.ringWarn * tell;
      break;
    case SealState.RingWarn: {
      // Launch the ring the warning showed
      const k = P.rings - s.ringsLeft;
      for (const r of w.rings) {
        if (r.alive) continue;
        r.alive = true;
        r.r = S.ringStart;
        r.gapA = s.nextGap;
        r.spin = P.spin * slow * (P.alternate && k % 2 ? -1 : 1);
        break;
      }
      s.ringsLeft--;
      if (s.ringsLeft > 0) {
        s.nextGap += Math.PI * (0.6 + w.random() * 0.8);
        s.state = SealState.RingWarn;
        s.t = Math.max(S.ringWarn * tell, P.ringEvery);
      } else {
        s.state = SealState.Rings;
        s.t = (S.clearRadius - S.ringStart) / (S.ringSpeed * slow);
      }
      break;
    }
    case SealState.Rings:
      // The fan is aimed (and LOCKED) at the gem now; the lines show it
      s.aimA = Math.atan2(p.y - 6 - (s.y - 8), p.x - s.x);
      s.state = SealState.AimWarn;
      s.t = S.aimWarn * tell;
      break;
    case SealState.AimWarn: {
      for (let k = 0; k < P.fan; k++) {
        const a = s.aimA + (P.fan > 1 ? (k / (P.fan - 1) - 0.5) * P.spread * 2 : 0);
        for (const b of w.bolts) {
          if (b.alive) continue;
          b.alive = true;
          b.x = s.x + Math.cos(a) * 14;
          b.y = s.y - 8 + Math.sin(a) * 14;
          b.vx = Math.cos(a) * S.boltSpeed * slow;
          b.vy = Math.sin(a) * S.boltSpeed * slow;
          b.life = 4 / slow;
          break;
        }
      }
      s.state = SealState.Recover;
      s.t = P.recover * (w.reduced ? 1.25 : 1);
      break;
    }
    case SealState.Recover:
      // The window passed unhit: straight into the next cycle
      s.state = SealState.Flinch;
      s.t = 0;
      break;
  }
}

/** The fan's bolt angles while it aims (for the tell), written into `out`. */
export function sealFan(w: World, out: number[]): number {
  const P = sealPattern(w);
  for (let k = 0; k < P.fan; k++) out[k] = w.seal.aimA + (P.fan > 1 ? (k / (P.fan - 1) - 0.5) * P.spread * 2 : 0);
  return P.fan;
}

/** Moves an enemy; walkers (chargers) never step off the ice. Returns false if blocked. */
function shove(w: World, d: Enemy, dx: number, dy: number): boolean {
  if (d.kind === EnemyKind.Drifter) {
    d.x += dx;
    d.y += dy;
    return true;
  }
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 2));
  const sx = dx / n, sy = dy / n;
  let moved = true;
  for (let i = 0; i < n; i++) {
    const okX = !sx || standsOnIce(w.room, d.x + sx, d.y);
    const okY = !sy || standsOnIce(w.room, d.x, d.y + sy);
    if (okX) d.x += sx;
    if (okY) d.y += sy;
    if (!okX || !okY) moved = false;
  }
  return moved;
}

function stepEnemies(w: World, dt: number): void {
  const p = w.player;
  const slow = w.reduced ? 0.75 : 1;
  const speed = TUNE.drifter.speed * slow;
  for (const d of w.enemies) {
    if (!d.alive) continue;
    d.flash = Math.max(0, d.flash - dt);
    if (d.arrive > 0) {
      d.arrive -= dt;
      continue;
    }
    if (d.kind === EnemyKind.Charger) {
      stepCharger(w, d, dt, slow);
      continue;
    }
    if (d.kind === EnemyKind.Spitter) {
      stepSpitter(w, d, dt, slow);
      continue;
    }
    d.phase += dt * 2.2;
    const dx = p.x - d.x, dy = p.y - d.y;
    const l = Math.hypot(dx, dy) || 1;
    // Toward the gem, with a slow sideways sway (they float, they don't march)
    const sway = Math.sin(d.phase) * TUNE.drifter.wobble;
    let vx = (dx / l) * speed + (-dy / l) * sway;
    let vy = (dy / l) * speed + (dx / l) * sway;
    // Keep apart: a crowd, not a stack
    for (const o of w.enemies) {
      if (o === d || !o.alive || o.arrive > 0) continue;
      const ox = d.x - o.x, oy = d.y - o.y;
      const ol = Math.hypot(ox, oy);
      if (ol > 0 && ol < TUNE.drifter.space) {
        const push = (TUNE.drifter.space - ol) * 6;
        vx += (ox / ol) * push;
        vy += (oy / ol) * push;
      }
    }
    d.vx = vx;
    d.vy = vy;
    d.x += vx * dt;
    d.y += vy * dt;
    // Contact
    if (l < TOUCH && !isInvulnerable(p) && w.phase === "play") {
      hurt(w, d.x, d.y);
      d.x -= (dx / l) * 10;
      d.y -= (dy / l) * 10;
    }
  }
}

function stepCharger(w: World, d: Enemy, dt: number, slow: number): void {
  const p = w.player;
  const C = TUNE.charger;
  const dx = p.x - d.x, dy = p.y - d.y;
  const l = Math.hypot(dx, dy) || 1;
  d.t -= dt;
  d.cool = Math.max(0, d.cool - dt);
  switch (d.state) {
    case Charge.Walk: {
      // Walks in; within reach (and rested) it stops and winds up
      if (l < C.reach && d.cool <= 0) {
        d.state = Charge.Windup;
        // Longer under reduced motion: every telegraph gets more time
        d.t = C.windup * (w.reduced ? 1.5 : 1);
        d.ax = dx / l;
        d.ay = dy / l; // the line is locked NOW: the flash shows where it goes
        d.vx = d.vy = 0;
        break;
      }
      const s = C.speed * slow;
      d.vx = (dx / l) * s;
      d.vy = (dy / l) * s;
      shove(w, d, d.vx * dt, d.vy * dt);
      break;
    }
    case Charge.Windup:
      if (d.t <= 0) {
        d.state = Charge.Dash;
        d.t = C.chargeTime;
      }
      break;
    case Charge.Dash: {
      const s = C.chargeSpeed * slow;
      d.vx = d.ax * s;
      d.vy = d.ay * s;
      // Straight along the locked line; the void stops it dead
      if (!shove(w, d, d.vx * dt, d.vy * dt) || d.t <= 0) {
        d.state = Charge.Recover;
        d.t = C.recover;
        d.vx = d.vy = 0;
      }
      break;
    }
    case Charge.Recover:
      if (d.t <= 0) {
        d.state = Charge.Walk;
        d.cool = C.rest;
      }
      break;
  }
  if (l < TOUCH + 1 && !isInvulnerable(p) && w.phase === "play") {
    hurt(w, d.x, d.y);
    // A charge that connects ends there
    if (d.state === Charge.Dash) {
      d.state = Charge.Recover;
      d.t = C.recover;
    }
  }
}

function stepSpitter(w: World, d: Enemy, dt: number, slow: number): void {
  const p = w.player;
  const S = TUNE.spitter;
  const dx = p.x - d.x, dy = p.y - d.y;
  const l = Math.hypot(dx, dy) || 1;
  d.t -= dt;
  d.cool -= dt;
  d.phase += dt * 0.9;
  if (d.state === Spit.Windup) {
    if (d.t <= 0) {
      // Fire along the line it showed
      for (const b of w.bolts) {
        if (b.alive) continue;
        b.alive = true;
        b.x = d.x + d.ax * 6;
        b.y = d.y - 7 + d.ay * 6;
        b.vx = d.ax * S.boltSpeed * slow;
        b.vy = d.ay * S.boltSpeed * slow;
        b.life = S.boltLife / slow;
        break;
      }
      d.state = Spit.Move;
      d.cool = S.every;
    }
  } else if (d.cool <= 0 && l < S.range) {
    d.state = Spit.Windup;
    d.t = S.windup * (w.reduced ? 1.5 : 1);
    // Aimed at the gem's centre, LOCKED now: the tell shows where it goes
    const cy = p.y - 6 - (d.y - 7);
    const cl = Math.hypot(dx, cy) || 1;
    d.ax = dx / cl;
    d.ay = cy / cl;
    d.vx = d.vy = 0;
  } else {
    // Keep its distance: back off, close in, or strafe
    const s = S.speed * slow;
    const toward = l < S.near ? -1 : l > S.far ? 1 : 0;
    const side = Math.sin(d.phase) >= 0 ? 1 : -1;
    let vx = (dx / l) * toward + (toward ? 0 : (-dy / l) * side);
    let vy = (dy / l) * toward + (toward ? 0 : (dx / l) * side);
    const vl = Math.hypot(vx, vy) || 1;
    vx = (vx / vl) * s;
    vy = (vy / vl) * s;
    d.vx = vx;
    d.vy = vy;
    // Cornered against the void while backing off: slide along instead
    if (!shove(w, d, vx * dt, vy * dt) && toward < 0) shove(w, d, (-dy / l) * side * s * dt, (dx / l) * side * s * dt);
  }
  if (l < TOUCH && !isInvulnerable(p) && w.phase === "play") hurt(w, d.x, d.y);
}

/** Bolts fly straight, over the void too. A dash's i-frames pass through them. */
function stepBolts(w: World, dt: number): void {
  const p = w.player;
  for (const b of w.bolts) {
    if (!b.alive) continue;
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.life <= 0 || b.x < -10 || b.y < -10 || b.x > VIEW.w + 10 || b.y > VIEW.h + 10) {
      b.alive = false;
      continue;
    }
    if (w.phase !== "play" || isInvulnerable(p)) continue;
    if (Math.hypot(b.x - p.x, b.y - (p.y - 6)) < TUNE.spitter.boltHit) {
      b.alive = false;
      hurt(w, b.x - b.vx, b.y - b.vy);
    }
  }
}

function stepParticles(w: World, dt: number): void {
  for (const q of w.particles) {
    if (!q.alive) continue;
    q.life -= dt;
    if (q.life <= 0) {
      q.alive = false;
      continue;
    }
    const f = Math.exp(-q.friction * dt);
    q.vx *= f;
    q.vy *= f;
    q.x += q.vx * dt;
    q.y += q.vy * dt;
  }
}

/** Screen shake offset (logical px) for this frame, written into `out`; zero under reduced motion. */
export function shakeOffset(w: World, out: { x: number; y: number }): void {
  out.x = out.y = 0;
  if (w.reduced || w.shake <= 0) return;
  const a = TUNE.feel.shake * Math.min(1, w.shake / TUNE.feel.shakeTime);
  out.x = Math.round((w.random() * 2 - 1) * a);
  out.y = Math.round((w.random() * 2 - 1) * a);
}
