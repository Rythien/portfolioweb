/**
 * THE VOID: the rules. The player (the pixel gem), move / dash / attack,
 * and the enemies: DRIFTERS and CHARGERS. Pure (no DOM): the shell feeds it
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
  /** A hit that does not kill: a white flash and a shove. */
  hit: { flash: 0.08, shove: 7 },
  /** ONE fixed wave per room, cleared to finish it (no trickle). */
  spawn: { wave: 8, minDist: 80 },
} as const;

/** Enemy kinds (plain object: node's type stripping has no enums). */
export const EnemyKind = { Drifter: 0, Charger: 1 } as const;
export type EnemyKind = (typeof EnemyKind)[keyof typeof EnemyKind];
export const ENEMY_NAMES = ["drifter", "charger"] as const;
export type EnemyName = (typeof ENEMY_NAMES)[number];

/** A wave: how many of each kind. */
export type Wave = Partial<Record<EnemyName, number>>;

/** Charger states. */
export const Charge = { Walk: 0, Windup: 1, Dash: 2, Recover: 3 } as const;

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
}

/**
 * One screen: a chipped island with two void pits inside it. Edges are
 * ragged (seeded), so the void is a shape to play around, not a frame.
 */
export function buildRoom(seed = 1): Room {
  const r = rng(seed);
  const ice = new Uint8Array(COLS * ROWS);
  const cx = COLS / 2, cy = ROWS / 2 + 0.5;
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) {
      // A rounded rectangle, its edge bitten by noise
      // ~40 x 20 tiles: narrow enough that 3x fits a 1280-wide screen
      const dx = Math.max(0, Math.abs(x + 0.5 - cx) - 13) / 5;
      const dy = Math.max(0, Math.abs(y + 0.5 - cy) - 5.5) / 3.6;
      const d = Math.hypot(dx, dy);
      if (d < 0.75 + 0.5 * r()) ice[y * COLS + x] = 1;
    }
  // Two pits: void to dash across the corners of, never through
  const pit = (px: number, py: number, w: number, h: number) => {
    for (let y = py; y < py + h; y++) for (let x = px; x < px + w; x++) ice[y * COLS + x] = 0;
  };
  pit(14, 9, 3, 3);
  pit(31, 15, 4, 2);
  // Keep the outer rows/columns void (the island floats; its cliffs hang below)
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) if (x < 3 || y < 3 || x >= COLS - 3 || y >= ROWS - 3) ice[y * COLS + x] = 0;
  return { ice, spawnX: VIEW.w / 2, spawnY: VIEW.h / 2 + 20 };
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
 * and the shell shows YOU WOKE (R falls again, Escape wakes). "clear":
 * the wave is cleared. Nothing ever leaves the gem gone in "play".
 */
export type Phase = "play" | "dead" | "clear";

export const TRAIL = 6;
export const MAX_ENEMIES = 40;
export const MAX_PARTICLES = 320;

export interface World {
  room: Room;
  t: number;
  player: Player;
  enemies: Enemy[];
  /** The wave each room (re)starts with. */
  wave: Wave;
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
  /** The room this run reached (step 1 has one). */
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

export function createWorld(seed = 1, reduced = false, wave: Wave = { drifter: TUNE.spawn.wave }): World {
  const room = buildRoom(seed);
  const w: World = {
    room,
    t: 0,
    player: freshPlayer(room),
    enemies: Array.from({ length: MAX_ENEMIES }, (): Enemy => ({
      alive: false, kind: EnemyKind.Drifter, hp: 1, x: 0, y: 0, vx: 0, vy: 0, arrive: 0, flash: 0, phase: 0,
      state: 0, t: 0, ax: 0, ay: 0, cool: 0,
    })),
    wave,
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
  resetTrail(w);
  spawnWave(w, w.wave);
  return w;
}

function resetTrail(w: World): void {
  for (let i = 0; i < TRAIL; i++) {
    w.trail[i * 2] = w.player.x;
    w.trail[i * 2 + 1] = w.player.y;
  }
}

/** R ("fall again"): a fresh run of the room, same world objects (no allocation churn). */
export function restart(w: World): void {
  Object.assign(w.player, freshPlayer(w.room));
  for (const d of w.enemies) d.alive = false;
  for (const q of w.particles) q.alive = false;
  w.phase = "play";
  w.endT = 0;
  w.hitStop = 0;
  w.shake = 0;
  w.kills = 0;
  w.hits = 0;
  resetTrail(w);
  spawnWave(w, w.wave);
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
      d.hp = kind === EnemyKind.Charger ? TUNE.charger.hp : 1;
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
  // The wave is the room: the last one down clears it
  if (!w.enemies.some((o) => o.alive)) {
    w.phase = "clear";
    w.endT = 0;
  }
  // Chips: ice and energy, flung outward, slowed by friction
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

  stepEnemies(w, dt);
  stepParticles(w, dt);
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
    const radius = d.kind === EnemyKind.Charger ? TUNE.charger.radius : TUNE.drifter.radius;
    if (dist > TUNE.attack.range + radius) continue;
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
  if (connected) w.hitStop = TUNE.feel.hitStop;
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
