import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COLS, Charge, EnemyKind, ROOMS, ROWS, SEAL_SPOT, SealState, Spit, TILE, TUNE, buildRoom, createWorld, iceAt, isInvulnerable, restart, resumesAtSeal, chooseBoon, BOON_IDS, BOONS, maxHearts, dashMax, offerBoons, type BoonId,
  roomBounds, sealPattern, step,
  type Input, type World,
} from "./engine.ts";

const DT = 1 / 120;
const idle = (): Input => ({ mx: 0, my: 0, dash: false, attack: false, aimX: 0, aimY: 0 });

/** A world with no drifters in reach (so nothing interferes). One far-off,
 * still-telegraphing drifter stays alive so the arena never reads as cleared. */
function empty(seed = 1): World {
  const w = createWorld(seed);
  for (const d of w.enemies) d.alive = false;
  Object.assign(w.enemies[w.enemies.length - 1], { alive: true, x: -500, y: -500, arrive: 1e9 });
  return w;
}

function run(w: World, seconds: number, input: Partial<Input> = {}) {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) step(w, DT, { ...idle(), ...input });
}

test("walking reaches 95 px/s within 50 ms and stops within 40 ms: snappy, no slide", () => {
  const w = empty();
  run(w, 0.05, { mx: 1 });
  assert.ok(Math.abs(w.player.vx - TUNE.move.speed) < 1e-6, `vx ${w.player.vx} after 50 ms`);
  const x0 = w.player.x;
  run(w, 0.04);
  assert.equal(w.player.vx, 0);
  assert.ok(w.player.x - x0 < 2.5, `slid ${(w.player.x - x0).toFixed(2)} px after letting go`);
});

test("a dash covers 0.18 s x 420 px/s and its i-frames end at 0.12 s", () => {
  // Leftward: the run from the spawn is clear ice (rightward meets a pit,
  // and the dash correctly stops at its edge)
  const w = empty();
  const x0 = w.player.x;
  step(w, DT, { ...idle(), mx: -1, dash: true });
  run(w, 0.1, { mx: -1 });
  assert.ok(isInvulnerable(w.player), "invulnerable at 0.1 s");
  run(w, 0.03, { mx: -1 });
  assert.ok(!isInvulnerable(w.player), "vulnerable again by 0.13 s");
  run(w, 0.05, { mx: 0 });
  // 420 x 0.18 = 75.6 px of dash, plus a little walking as it ends
  const d = x0 - w.player.x;
  assert.ok(d > 72 && d < 80, `dash covered ${d.toFixed(1)} px`);
});

test("the dash cools down for 0.55 s from its start", () => {
  const w = empty();
  step(w, DT, { ...idle(), mx: 1, dash: true });
  run(w, 0.5);
  step(w, DT, { ...idle(), mx: -1, dash: true });
  assert.ok(w.player.dashAge > TUNE.dash.time, "second dash refused at 0.5 s");
  run(w, 0.05);
  step(w, DT, { ...idle(), mx: -1, dash: true });
  assert.ok(w.player.dashAge >= 0 && w.player.dashAge < TUNE.dash.time, "second dash taken at 0.56 s");
});

test("the gem never leaves the ice, walking or dashing", () => {
  for (const [mx, my] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]]) {
    const w = empty();
    for (let i = 0; i < 40; i++) {
      step(w, DT, { ...idle(), mx, my, dash: i % 8 === 0 });
      run(w, 0.1, { mx, my });
    }
    const p = w.player;
    assert.ok(iceAt(w.room, p.x - 4, p.y - 3) && iceAt(w.room, p.x + 4, p.y + 3), `off the ice heading ${mx},${my}`);
  }
});

function oneDrifterAt(w: World, dx: number, dy: number) {
  const d = w.enemies[0];
  Object.assign(d, { alive: true, x: w.player.x + dx, y: w.player.y + dy, arrive: 0, vx: 0, vy: 0 });
  return d;
}

test("an attack kills a drifter in front, never one behind, and lands with a 60 ms hit-stop", () => {
  const w = empty();
  w.player.faceX = 1;
  w.player.faceY = 0;
  const front = oneDrifterAt(w, 22, 0);
  const back = w.enemies[1];
  Object.assign(back, { alive: true, x: w.player.x - 22, y: w.player.y, arrive: 0 });
  step(w, DT, { ...idle(), attack: true });
  assert.equal(front.alive, false);
  assert.equal(back.alive, true);
  assert.equal(w.hitStop, TUNE.feel.hitStop);
  const t = w.t;
  run(w, 0.05);
  assert.equal(w.t, t, "the world is frozen during hit-stop");
});

test("holding attack repeats every 0.25 s", () => {
  const w = empty();
  let n = 0, last = 99;
  for (let i = 0; i < Math.round(1.0 / DT); i++) {
    step(w, DT, { ...idle(), attack: true });
    if (w.player.atkAge < last) n++;
    last = w.player.atkAge;
  }
  assert.equal(n, 4, `${n} bursts in 1 s`);
});

test("a telegraphing drifter can neither be hit nor hurt", () => {
  const w = empty();
  const d = oneDrifterAt(w, 4, 0);
  d.arrive = 0.3;
  step(w, DT, { ...idle(), attack: true });
  assert.equal(d.alive, true);
  assert.equal(w.player.hearts, TUNE.hurt.hearts);
});

test("touching a drifter costs a heart, then 0.8 s of invulnerability", () => {
  const w = empty();
  oneDrifterAt(w, 5, 0);
  step(w, DT, idle());
  assert.equal(w.player.hearts, TUNE.hurt.hearts - 1);
  oneDrifterAt(w, 5, 0);
  run(w, 0.2);
  assert.equal(w.player.hearts, TUNE.hurt.hearts - 1, "no second hit inside the invulnerability");
});

test("a dash's i-frames pass through a drifter unharmed", () => {
  const w = empty();
  oneDrifterAt(w, 20, 0);
  step(w, DT, { ...idle(), mx: 1, dash: true });
  run(w, 0.1, { mx: 1 });
  assert.equal(w.player.hearts, TUNE.hurt.hearts);
});

const alive = (w: World) => w.enemies.filter((d) => d.alive).length;

test("a room is ONE wave of 8: nobody trickles in, however long you wait", () => {
  const w = createWorld(1);
  assert.equal(alive(w), TUNE.spawn.wave);
  // 20 s of walking and dashing about without attacking
  for (let i = 0; i < 200 && w.phase === "play"; i++) {
    step(w, DT, { ...idle(), mx: i % 40 < 20 ? 1 : -1, dash: i % 10 === 0 });
    run(w, 0.1, { mx: i % 40 < 20 ? 1 : -1 });
  }
  assert.ok(alive(w) <= TUNE.spawn.wave, `${alive(w)} drifters`);
});

test("the last heart ends the run: phase dead, arena frozen, never a running world with no gem", () => {
  const w = createWorld(1);
  w.player.hearts = 1;
  const d = w.enemies.find((q) => q.alive)!;
  Object.assign(d, { x: w.player.x + 5, y: w.player.y, arrive: 0 });
  step(w, DT, idle());
  assert.equal(w.phase, "dead");
  assert.equal(w.hitStop, TUNE.death.hitStop);
  const pos = w.enemies.filter((q) => q.alive).map((q) => q.x + "," + q.y).join(" ");
  run(w, 3);
  assert.equal(w.enemies.filter((q) => q.alive).map((q) => q.x + "," + q.y).join(" "), pos, "drifters moved after death");
  assert.equal(w.phase, "dead", "death is a state, not a timer: it waits for R or Escape");
  assert.ok(w.endT > 2.5);
});

test("R (restart) gives a fresh run: full hearts, a new wave of 8, phase play", () => {
  const w = createWorld(1);
  w.player.hearts = 0;
  w.phase = "dead";
  restart(w);
  assert.equal(w.phase, "play");
  assert.equal(w.player.hearts, TUNE.hurt.hearts);
  assert.equal(alive(w), TUNE.spawn.wave);
  assert.equal(w.kills, 0);
});

/** Kills the whole wave in one burst (all moved in front of the gem). */
function clearWave(w: World) {
  for (const d of w.enemies) if (d.alive) Object.assign(d, { x: w.player.x + 20, y: w.player.y, arrive: 0, hp: 1 });
  w.player.faceX = 1;
  w.player.faceY = 0;
  w.player.atkCd = 0;
  step(w, DT, { ...idle(), attack: true });
  run(w, 0.1);
}
/** Stands the gem just below the seal, facing it. */
function underSeal(w: World) {
  w.player.x = w.seal.x;
  w.player.y = w.seal.y + 22;
  w.player.faceX = 0;
  w.player.faceY = -1;
}
/** Frees the room's seal through three real windows (waiting for each), then the bloom. */
function freeSeal(w: World, take = true) {
  for (let hit = 0; hit < TUNE.seal.hits; hit++) {
    for (let i = 0; i < 4000 && w.seal.state !== SealState.Recover; i++) {
      w.player.invuln = 9; // the test is about the seal's rules, not dodging
      step(w, DT, idle());
    }
    underSeal(w);
    w.player.atkCd = 0;
    step(w, DT, { ...idle(), attack: true });
  }
  w.player.invuln = 0;
  run(w, TUNE.seal.bloom + 0.1);
  // The doorway opens on a boon offer (rooms 1 and 2): take the first
  if (take && w.offer) chooseBoon(w, 0);
}
/** A room done the real way: its wave, then its seal, then the bloom. */
function clearRoom(w: World) {
  clearWave(w);
  freeSeal(w);
}
/** Walks the gem straight up into the doorway from its spawn column. */
function walkToDoor(w: World) {
  const d = w.room.door;
  w.player.x = d.x + d.w / 2;
  w.player.y = d.y + d.h + 12;
  for (let i = 0; i < 60 && w.transition < 0; i++) step(w, DT * 4, { ...idle(), my: -1 });
}

test("clearing a room's wave raises its SEAL, not the door; freeing the seal opens the door after the bloom", () => {
  const w = createWorld(1);
  clearWave(w);
  assert.equal(alive(w), 0);
  assert.equal(w.seal.state, SealState.Arrive, "the seal rises");
  assert.equal(w.doorOpen, false, "the door waits for the seal");
  freeSeal(w);
  assert.equal(w.freed[0], true, "room 1's project is freed");
  assert.equal(w.doorOpen, true);
  assert.equal(w.phase, "play");
});

test("a closed doorway goes nowhere; an open one loads the next room, hearts kept", () => {
  const w = createWorld(1);
  walkToDoor(w);
  run(w, 0.5);
  assert.equal(w.roomIndex, 0, "closed: still room 1");
  clearRoom(w);
  w.player.hearts = 2;
  walkToDoor(w);
  assert.ok(w.transition >= 0, "the fade starts at the door");
  run(w, TUNE.door.fade + 0.05);
  assert.equal(w.roomIndex, 1);
  assert.equal(w.roomReached, 2);
  assert.equal(w.player.hearts, 2, "hearts carry over");
  assert.equal(w.doorOpen, false, "the new room's door is shut");
  assert.ok(alive(w) > 0, "and it has its wave");
});

test("freeing room 3's seal wins the run (no door); R starts again at room 1", () => {
  const w = createWorld(1);
  for (let r = 0; r < ROOMS.length; r++) {
    clearRoom(w);
    if (r < ROOMS.length - 1) {
      walkToDoor(w);
      run(w, TUNE.door.fade + 0.05);
    }
  }
  assert.equal(w.roomIndex, ROOMS.length - 1);
  assert.equal(w.phase, "won");
  assert.equal(w.doorOpen, false, "the last room has no way on: the run is over");
  assert.deepEqual(w.freed, [true, true, true]);
  restart(w, 0, true);
  assert.equal(w.roomIndex, 0);
  assert.equal(w.phase, "play");
  assert.equal(w.player.hearts, TUNE.hurt.hearts);
});

test("the waves mix in: room 1 drifters, room 2 adds chargers, room 3 adds spitters", () => {
  const expect = [[8, 0, 0], [6, 3, 0], [4, 2, 3]];
  const w = createWorld(1);
  for (let r = 0; r < ROOMS.length; r++) {
    const got = [0, 0, 0];
    for (const d of w.enemies) if (d.alive) {
      got[d.kind]++;
      assert.ok(iceAt(w.room, d.x, d.y), "every enemy starts on the ice");
      assert.equal(d.hp, d.kind === EnemyKind.Drifter ? 1 : 2);
    }
    assert.deepEqual(got, expect[r], `room ${r + 1}: drifter, charger, spitter`);
    if (r < ROOMS.length - 1) {
      clearRoom(w);
      walkToDoor(w);
      run(w, TUNE.door.fade + 0.05);
    }
  }
});

test("every room fits 3x on a 1280x720 screen, and its doorway is reachable from the spawn", () => {
  for (let i = 0; i < ROOMS.length; i++) {
    const room = buildRoom(i);
    const b = roomBounds(room);
    assert.ok(b.x1 - b.x0 + 8 <= 1280 / 3 && b.y1 - b.y0 + 8 <= 720 / 3, `room ${i + 1} is ${b.x1 - b.x0}x${b.y1 - b.y0}`);
    assert.ok(iceAt(room, room.spawnX, room.spawnY), `room ${i + 1} spawn on ice`);
    // Flood fill over ice tiles from the spawn
    const seen = new Uint8Array(COLS * ROWS);
    const q = [Math.floor(room.spawnY / TILE) * COLS + Math.floor(room.spawnX / TILE)];
    seen[q[0]] = 1;
    while (q.length) {
      const k = q.pop()!;
      for (const n of [k - 1, k + 1, k - COLS, k + COLS]) if (n >= 0 && n < COLS * ROWS && room.ice[n] && !seen[n]) { seen[n] = 1; q.push(n); }
    }
    const dc = room.door.x / TILE, dr = room.door.y / TILE;
    assert.ok(seen[dr * COLS + dc] && seen[dr * COLS + dc + 1], `room ${i + 1}'s doorway reachable`);
  }
});

/* ── CHARGER ── */

/** One charger at (dx, dy) from the gem, rested and arrived; nothing else near. */
function oneCharger(w: World, dx: number, dy: number) {
  const d = w.enemies[0];
  Object.assign(d, { alive: true, kind: EnemyKind.Charger, hp: TUNE.charger.hp, x: w.player.x + dx, y: w.player.y + dy,
    arrive: 0, state: Charge.Walk, t: 0, cool: 0, vx: 0, vy: 0, flash: 0 });
  return d;
}

test("a charger stops and flashes 0.4 s before it moves, then charges the line it showed", () => {
  const w = empty();
  const d = oneCharger(w, -60, 0);
  step(w, DT, idle());
  assert.equal(d.state, Charge.Windup, "within reach it winds up");
  const x0 = d.x, y0 = d.y;
  // The gem steps aside during the tell
  run(w, 0.35, { my: 1 });
  assert.equal(d.state, Charge.Windup);
  assert.ok(Math.abs(d.x - x0) < 1e-9 && Math.abs(d.y - y0) < 1e-9, "it holds still for the whole tell");
  run(w, 0.15, { my: 1 });
  assert.equal(d.state, Charge.Dash);
  assert.ok(d.x - x0 > 20, `charged ${(d.x - x0).toFixed(1)} px along its line`);
  assert.ok(Math.abs(d.y - y0) < 1e-6, "straight: it did not turn after the gem");
});

test("a charger takes two hits", () => {
  const w = empty();
  const d = oneCharger(w, 20, 0);
  d.state = Charge.Recover;
  d.t = 5;
  w.player.faceX = 1;
  w.player.faceY = 0;
  step(w, DT, { ...idle(), attack: true });
  assert.ok(d.alive && d.hp === 1 && d.flash > 0, "the first hit flashes it, it lives");
  // past the cooldown (the hit-stop freezes the clock for its 60 ms first)
  run(w, TUNE.attack.cooldown + TUNE.feel.hitStop + 0.05);
  // shoved back a little: step in and hit again
  d.x = w.player.x + 20;
  d.y = w.player.y;
  step(w, DT, { ...idle(), attack: true });
  assert.equal(d.alive, false, "the second kills it");
});

test("a charge stops at the void and never leaves the ice", () => {
  const w = empty();
  // Aim one straight at the island's west edge, starting 25 px inside it
  const d = oneCharger(w, 0, 0);
  let edge = w.player.x;
  while (iceAt(w.room, edge - 1, w.player.y)) edge--;
  d.x = edge + 25;
  d.y = w.player.y;
  Object.assign(d, { state: Charge.Dash, t: TUNE.charger.chargeTime, ax: -1, ay: 0 });
  w.player.x = 300; // far away
  run(w, 0.6);
  assert.ok(iceAt(w.room, d.x - 3, d.y) && iceAt(w.room, d.x + 3, d.y), `stopped on the ice at x ${d.x.toFixed(1)}`);
  assert.notEqual(d.state, Charge.Dash);
});

test("a dash's i-frames pass through a charge", () => {
  const w = empty();
  const d = oneCharger(w, -40, 0);
  Object.assign(d, { state: Charge.Dash, t: TUNE.charger.chargeTime, ax: 1, ay: 0 });
  step(w, DT, { ...idle(), mx: -1, dash: true });
  run(w, 0.1, { mx: -1 });
  assert.equal(w.player.hearts, TUNE.hurt.hearts);
});

test("a charge that connects costs a heart", () => {
  const w = empty();
  const d = oneCharger(w, -40, 0);
  Object.assign(d, { state: Charge.Dash, t: TUNE.charger.chargeTime, ax: 1, ay: 0 });
  run(w, 0.2);
  assert.equal(w.player.hearts, TUNE.hurt.hearts - 1);
});

/* ── SPITTER ── */

function oneSpitter(w: World, dx: number, dy: number) {
  const d = w.enemies[0];
  Object.assign(d, { alive: true, kind: EnemyKind.Spitter, hp: TUNE.spitter.hp, x: w.player.x + dx, y: w.player.y + dy,
    arrive: 0, state: Spit.Move, t: 0, cool: 99, vx: 0, vy: 0, flash: 0, phase: 0 });
  return d;
}
const bolts = (w: World) => w.bolts.filter((b) => b.alive);

test("a spitter keeps its distance", () => {
  const w = empty();
  const d = oneSpitter(w, -40, 0);
  run(w, 1.2);
  const l = Math.hypot(d.x - w.player.x, d.y - w.player.y);
  assert.ok(l > 60, `backed off to ${l.toFixed(0)} px`);
});

test("a spitter tells for 0.5 s, then fires one bolt along the line it showed", () => {
  const w = empty();
  const d = oneSpitter(w, -100, 0);
  d.cool = 0;
  step(w, DT, idle());
  assert.equal(d.state, Spit.Windup);
  const ax = d.ax, ay = d.ay;
  run(w, 0.45, { my: 1 }); // the gem moves during the tell
  assert.equal(bolts(w).length, 0, "nothing flies during the tell");
  run(w, 0.1);
  const b = bolts(w);
  assert.equal(b.length, 1, "one bolt");
  const bl = Math.hypot(b[0].vx, b[0].vy);
  assert.ok(Math.abs(b[0].vx / bl - ax) < 1e-6 && Math.abs(b[0].vy / bl - ay) < 1e-6, "along the locked line");
  assert.ok(Math.abs(bl - TUNE.spitter.boltSpeed) < 1e-6, "slow");
});

test("a bolt costs a heart if you stand in it, and a dash passes through it", () => {
  for (const dash of [false, true]) {
    const w = empty();
    const b = w.bolts[0];
    Object.assign(b, { alive: true, x: w.player.x - 30, y: w.player.y - 6, vx: TUNE.spitter.boltSpeed, vy: 0, life: 4 });
    if (dash) step(w, DT, { ...idle(), mx: -1, dash: true });
    run(w, 0.12, dash ? { mx: -1 } : {});
    run(w, 0.5);
    assert.equal(w.player.hearts, TUNE.hurt.hearts - (dash ? 0 : 1), dash ? "dashed through" : "stood in it");
  }
});

test("a spitter takes two hits, and R clears every bolt", () => {
  const w = empty();
  const d = oneSpitter(w, 20, 0);
  w.player.faceX = 1;
  w.player.faceY = 0;
  step(w, DT, { ...idle(), attack: true });
  assert.ok(d.alive && d.hp === 1);
  run(w, TUNE.attack.cooldown + TUNE.feel.hitStop + 0.05);
  d.x = w.player.x + 20;
  d.y = w.player.y;
  step(w, DT, { ...idle(), attack: true });
  assert.equal(d.alive, false);
  Object.assign(w.bolts[3], { alive: true, x: 10, y: 10, vx: 1, vy: 0, life: 4 });
  restart(w);
  assert.equal(bolts(w).length, 0);
});

/* ── SEALS ── */

/** A world straight at room `i`'s seal (no wave), the gem out of harm's way. */
function atSeal(i = 0) {
  const w = createWorld(1, false, {}, i);
  assert.equal(w.seal.state, SealState.Arrive);
  return w;
}
/** Steps until the seal enters `state` (or a time limit), returning the seconds taken. */
function until(w: World, state: number, limit = 20) {
  let t = 0;
  while (w.seal.state !== state && t < limit) {
    w.player.invuln = 9;
    step(w, DT, idle());
    t += DT;
  }
  w.player.invuln = 0;
  return t;
}

test("every room's seal rises on the ice, clear of its pits", () => {
  for (let i = 0; i < ROOMS.length; i++) {
    const room = buildRoom(i);
    for (let a = 0; a < Math.PI * 2; a += 0.3)
      assert.ok(iceAt(room, SEAL_SPOT.x + Math.cos(a) * 14, SEAL_SPOT.y + Math.sin(a) * 6), `room ${i + 1}: the seal stands on ice`);
  }
});

test("a seal's cycle, every attack told: ring warning, ring, aim lines, fan along them, then its window", () => {
  const w = atSeal(0);
  const P = sealPattern(w);
  const arrive = until(w, SealState.RingWarn);
  assert.ok(Math.abs(arrive - TUNE.seal.arrive) < 0.02, `arrival ${arrive.toFixed(2)} s`);
  const gap = w.seal.nextGap;
  const warn = until(w, SealState.Rings);
  assert.ok(warn >= TUNE.seal.ringWarn - 0.02, "the ring is told before it comes");
  const ring = w.rings.find((r) => r.alive)!;
  assert.ok(Math.abs(Math.atan2(Math.sin(ring.gapA - gap), Math.cos(ring.gapA - gap))) < 0.1, "with the gap its warning showed");
  until(w, SealState.AimWarn);
  const aim = w.seal.aimA;
  const bolts0 = w.bolts.filter((b) => b.alive).length;
  const tell = until(w, SealState.Recover);
  assert.ok(tell >= TUNE.seal.aimWarn - 0.02, "the fan is told before it fires");
  const fan = w.bolts.filter((b) => b.alive);
  assert.equal(fan.length - bolts0, P.fan, `${P.fan} bolts`);
  const mid = fan[Math.floor(fan.length / 2)];
  assert.ok(Math.abs(Math.atan2(mid.vy, mid.vx) - aim) < 1e-6, "along the locked lines");
});

test("a seal is armoured outside its window, and takes one hit per window", () => {
  const w = atSeal(0);
  until(w, SealState.RingWarn);
  underSeal(w);
  step(w, DT, { ...idle(), attack: true });
  assert.equal(w.seal.hp, TUNE.seal.hits, "clink: no damage outside the window");
  until(w, SealState.Recover);
  underSeal(w);
  w.player.atkCd = 0;
  step(w, DT, { ...idle(), attack: true });
  run(w, TUNE.attack.cooldown + TUNE.feel.hitStop + 0.02);
  underSeal(w);
  step(w, DT, { ...idle(), attack: true });
  assert.equal(w.seal.hp, TUNE.seal.hits - 1, "one hit, and the window shut");
});

test("three hits free it: its room is marked freed, and nothing hurts after", () => {
  const w = atSeal(0);
  freeSeal(w);
  assert.equal(w.seal.state, SealState.Freed);
  assert.equal(w.freed[0], true);
  assert.equal(w.rings.filter((r) => r.alive).length, 0);
  assert.equal(w.player.hearts, TUNE.hurt.hearts);
});

test("a ring stings on its band, passes you in its gap, and passes a dash", () => {
  for (const where of ["band", "gap", "dash"]) {
    const w = atSeal(0);
    w.seal.state = SealState.Rings;
    w.seal.t = 99;
    const ring = w.rings[0];
    Object.assign(ring, { alive: true, r: 40, spin: 0, gapA: where === "gap" ? Math.PI / 2 : -Math.PI / 2 });
    // The gem straight below the seal, just outside the ring: it sweeps over
    w.player.x = w.seal.x;
    w.player.y = w.seal.y - 8 + 46 + 6;
    if (where === "dash") step(w, DT, { ...idle(), mx: 1, dash: true });
    run(w, 0.3);
    assert.equal(w.player.hearts, TUNE.hurt.hearts - (where === "band" ? 1 : 0), where);
  }
});

test("seal 2: two rings a cycle, spinning opposite ways, and a 5-bolt fan", () => {
  const w = atSeal(1);
  until(w, SealState.Rings);
  const rings = w.rings.filter((r) => r.alive);
  assert.equal(rings.length, 2, "two rings");
  assert.ok(Math.sign(rings[0].spin) === -Math.sign(rings[1].spin), "opposite spins");
  assert.ok(rings[0].r - rings[1].r > 30, "launched apart");
  until(w, SealState.AimWarn);
  until(w, SealState.Recover);
  assert.equal(w.bolts.filter((b) => b.alive).length, 5);
  assert.equal(sealPattern(w).recover, 1.3);
});

test("seal 3: three alternating rings a cycle, a 7-bolt fan, a 1.1 s window", () => {
  const w = atSeal(2);
  until(w, SealState.Rings);
  const rings = w.rings.filter((r) => r.alive);
  assert.equal(rings.length, 3);
  assert.ok(Math.sign(rings[0].spin) !== Math.sign(rings[1].spin) && Math.sign(rings[1].spin) !== Math.sign(rings[2].spin), "alternating");
  until(w, SealState.AimWarn);
  until(w, SealState.Recover);
  assert.equal(w.bolts.filter((b) => b.alive).length, 7);
  assert.equal(sealPattern(w).recover, 1.1);
});

test("R after a death starts at the first unfreed room", () => {
  const w = createWorld(1);
  w.player.hearts = 0;
  w.phase = "dead";
  restart(w, 2);
  assert.equal(w.roomIndex, 2);
  assert.equal(w.roomReached, 3);
  assert.equal(w.phase, "play");
});

test("the checkpoint: a death at a seal falls again at that seal, its wave already cleared", () => {
  const w = createWorld(1, false, null, 2);
  assert.equal(resumesAtSeal(w, 2), false, "no checkpoint before the wave is down");
  clearWave(w);
  assert.equal(alive(w), 0);
  assert.equal(w.seal.state, SealState.Arrive, "the wave is down, the seal rises");
  w.seal.hp = 1; // a hit landed before the death: the seal still starts whole
  w.player.hearts = 0;
  w.phase = "dead";
  assert.equal(resumesAtSeal(w, 2), true);
  restart(w, 2);
  assert.equal(w.roomIndex, 2);
  assert.equal(w.phase, "play");
  assert.equal(w.player.hearts, TUNE.hurt.hearts, "full hearts");
  assert.equal(alive(w), 0, "no wave to refight");
  assert.equal(w.seal.state, SealState.Arrive, "the seal rises again");
  assert.equal(w.seal.hp, TUNE.seal.hits, "its own numbers, unchanged");
  assert.deepEqual(sealPattern(w), ROOMS[2].seal);
  // It holds for every later death in this room
  w.phase = "dead";
  restart(w, 2);
  assert.equal(alive(w), 0);
  assert.equal(w.seal.state, SealState.Arrive);
});

test("the checkpoint is per room: a death before the wave is down refights the wave", () => {
  const w = createWorld(1, false, null, 1);
  w.phase = "dead";
  restart(w, 1);
  assert.ok(alive(w) > 0, "the wave again");
  assert.equal(w.seal.state, SealState.Off);
  // A checkpoint in room 2 does not carry to another start room
  clearWave(w);
  assert.equal(resumesAtSeal(w, 1), true);
  assert.equal(resumesAtSeal(w, 0), false);
  w.phase = "dead";
  restart(w, 0);
  assert.ok(alive(w) > 0, "room 1 has its wave");
});

test("seal 3 eased (1.2 s rings, 1.15 rad gap) and still the hardest of the three", () => {
  const [s1, s2, s3] = ROOMS.map((r) => r.seal);
  assert.equal(s3.ringEvery, 1.2);
  assert.equal(s3.gap, 1.15);
  assert.ok(s3.rings > s2.rings && s2.rings > s1.rings, "most rings");
  assert.ok(s3.spin > s2.spin && s3.fan > s2.fan && s3.recover < s2.recover, "fastest spin, widest fan, shortest window");
  // Its wider gap is what the rule uses: a gem 0.55 rad off the gap's centre
  // (inside 1.15 / 2, outside 0.95 / 2) passes
  const w = atSeal(2);
  until(w, SealState.Rings);
  assert.equal(w.seal.gap, 1.15);
  for (const r of w.rings) r.alive = false;
  const ring = w.rings[0];
  const a = -Math.PI / 2;
  Object.assign(ring, { alive: true, r: 40, spin: 0, gapA: a + 0.55 });
  w.player.invuln = 0;
  w.player.dashAge = 99;
  w.player.x = w.seal.x + Math.cos(a) * 40;
  w.player.y = w.seal.y - 8 + Math.sin(a) * 40;
  const hearts = w.player.hearts;
  step(w, DT, idle());
  assert.equal(w.player.hearts, hearts, "passed in the wider gap");
});

/* ── Boons ─────────────────────────────────────────────────────── */

/** An empty arena (empty()) with these boons taken. */
function withBoons(...ids: BoonId[]): World {
  const w = empty();
  w.boons.push(...ids);
  w.player.hearts = maxHearts(w);
  w.player.dashCharges = dashMax(w);
  return w;
}
/** Places a live, arrived enemy (a drifter unless `kind`). */
function put(w: World, x: number, y: number, kind: number = EnemyKind.Drifter) {
  const d = w.enemies.find((q) => !q.alive)!;
  Object.assign(d, { alive: true, kind, hp: kind === EnemyKind.Drifter ? 1 : 2, x, y, vx: 0, vy: 0, arrive: 0, flash: 0, phase: 0, state: 0, t: 0, ax: 0, ay: 0, cool: 9, slow: 0 });
  return d;
}
/** One attack aimed along (ax, ay). */
function swing(w: World, ax = 1, ay = 0) {
  w.player.atkCd = 0;
  step(w, DT, { ...idle(), attack: true, aimX: ax, aimY: ay });
}

test("boons: a freed seal in room 1 or 2 pauses the run on three different boons; room 3's ends the run instead", () => {
  const w = createWorld(1);
  clearWave(w);
  freeSeal(w, false);
  assert.ok(w.offer, "an offer when the door opens");
  assert.equal(w.offer!.length, 3);
  assert.equal(new Set(w.offer).size, 3, "three different boons");
  for (const id of w.offer!) assert.ok(BOON_IDS.includes(id));
  // Paused: nothing moves while it is open
  const t = w.t, x = w.player.x;
  run(w, 1, { mx: 1 });
  assert.equal(w.t, t);
  assert.equal(w.player.x, x);
  const pick = w.offer![1];
  assert.equal(chooseBoon(w, 1), true);
  assert.deepEqual(w.boons, [pick]);
  assert.equal(w.offer, null);
  run(w, 0.1);
  assert.ok(w.t > t, "running again");
  // Room 3: no offer, the run is won
  const w3 = createWorld(1, false, null, 2);
  clearWave(w3);
  freeSeal(w3, false);
  assert.equal(w3.offer, null);
  assert.equal(w3.phase, "won");
});

test("boons: 6 to 8 in the pool, each with a name and a line; never offered again once taken", () => {
  assert.ok(BOON_IDS.length >= 6 && BOON_IDS.length <= 8, `${BOON_IDS.length} boons`);
  for (const id of BOON_IDS) assert.ok(BOONS[id].title && BOONS[id].text);
  for (let seed = 1; seed <= 20; seed++) {
    const w = createWorld(seed);
    for (let k = 0; k < BOON_IDS.length; k++) {
      offerBoons(w);
      assert.ok(w.offer);
      for (const id of w.offer!) assert.ok(!w.boons.includes(id), `seed ${seed}: ${id} offered again`);
      chooseBoon(w, Math.floor(w.random() * w.offer!.length));
    }
    assert.equal(new Set(w.boons).size, BOON_IDS.length, "no duplicates");
    offerBoons(w);
    assert.equal(w.offer, null, "an empty pool offers nothing");
  }
});

test("boons last through a death (and its checkpoint); a new run starts with none", () => {
  const w = createWorld(1);
  w.boons.push("heart", "dash");
  w.phase = "dead";
  restart(w, 1);
  assert.deepEqual(w.boons, ["heart", "dash"]);
  assert.equal(w.player.hearts, 4, "the fourth heart, refilled");
  assert.equal(w.player.dashCharges, 2);
  restart(w, 0, true);
  assert.deepEqual(w.boons, []);
  assert.equal(w.player.hearts, TUNE.hurt.hearts);
  assert.equal(w.player.dashCharges, 1);
});

test("boon WIDE BURST: reaches 38 px (was 30) and 75 deg either side (was 55)", () => {
  for (const wide of [false, true]) {
    const w = wide ? withBoons("wide") : withBoons();
    const p = w.player;
    const far = put(w, p.x + 35 + TUNE.drifter.radius, p.y); // past 30 + r, inside 38 + r
    const a = (65 * Math.PI) / 180; // outside 55, inside 75
    const side = put(w, p.x + Math.cos(a) * 20, p.y + Math.sin(a) * 20);
    swing(w);
    assert.equal(far.alive, !wide, `far drifter ${wide ? "hit" : "missed"}`);
    assert.equal(side.alive, !wide, `wide-angle drifter ${wide ? "hit" : "missed"}`);
  }
});

test("boon SECOND DASH: two dashes back to back, each charge back after one cooldown", () => {
  for (const two of [false, true]) {
    const w = two ? withBoons("dash") : withBoons();
    const p = w.player;
    step(w, DT, { ...idle(), dash: true, mx: -1 });
    assert.equal(p.dashes, 1);
    run(w, TUNE.dash.time + 0.02, { mx: -1 });
    step(w, DT, { ...idle(), dash: true, mx: 1 });
    assert.equal(p.dashes, two ? 2 : 1, two ? "the second charge" : "on cooldown");
    run(w, TUNE.dash.time + 0.02);
  }
  const w = withBoons("dash");
  const p = w.player;
  step(w, DT, { ...idle(), dash: true, mx: -1 });
  run(w, 0.2);
  step(w, DT, { ...idle(), dash: true, mx: 1 });
  assert.equal(p.dashCharges, 0);
  run(w, TUNE.dash.cooldown * 2 + 0.05);
  assert.equal(p.dashCharges, 2, "both back after two cooldowns");
  assert.equal(p.dashCd, 0);
});

test("boon SHATTER: a kill bursts into its neighbours, and the burst can chain", () => {
  for (const on of [false, true]) {
    const w = on ? withBoons("shatter") : withBoons();
    const p = w.player;
    const hit = put(w, p.x + 25, p.y);
    const near = put(w, p.x + 50, p.y); // beyond the burst (30 + 5), 25 px from the kill
    const chain = put(w, p.x + 75, p.y); // 25 px from `near`, 50 from the kill
    swing(w);
    assert.equal(hit.alive, false);
    assert.equal(near.alive, !on, "the neighbour");
    assert.equal(chain.alive, !on, "the chain");
  }
});

test("boon SLOW WAKE: what a dash passes moves at 45% for 2 s", () => {
  const moved = (on: boolean) => {
    const w = on ? withBoons("frost") : withBoons();
    const p = w.player;
    const d = put(w, p.x - 30, p.y + 20);
    step(w, DT, { ...idle(), dash: true, mx: -1 });
    run(w, TUNE.dash.time);
    if (on) assert.ok(d.slow > 1.5, `slowed (${d.slow.toFixed(2)} s left)`);
    else assert.equal(d.slow, 0);
    w.player.invuln = 9;
    const x = d.x, y = d.y;
    run(w, 0.5);
    return Math.hypot(d.x - x, d.y - y);
  };
  const ratio = moved(true) / moved(false);
  assert.ok(ratio < 0.6, `slowed drifter covers ${(ratio * 100).toFixed(0)}% of the distance`);
});

test("boon FOURTH HEART: one more heart, filled when taken", () => {
  const w = createWorld(1);
  w.player.hearts = 2;
  w.offer = ["heart", "wide", "quick"];
  chooseBoon(w, 0);
  assert.equal(maxHearts(w), 4);
  assert.equal(w.player.hearts, 3, "one heart added now");
});

test("boon QUICK HANDS: attack cooldown 0.16 s (was 0.25)", () => {
  for (const on of [false, true]) {
    const w = on ? withBoons("quick") : withBoons();
    swing(w);
    assert.equal(w.player.atkCd, on ? 0.16 : TUNE.attack.cooldown);
  }
});

test("boon PIERCING SHARD: each attack throws a shard through every enemy in its line", () => {
  for (const on of [false, true]) {
    const w = on ? withBoons("pierce") : withBoons();
    const p = w.player;
    const line = [50, 75, 100].map((dx) => put(w, p.x + dx, p.y));
    swing(w);
    w.player.invuln = 9;
    run(w, 0.45);
    assert.deepEqual(line.map((d) => d.alive), [!on, !on, !on], on ? "all three pierced" : "all out of reach");
  }
  // Each enemy once: a charger (2 hp) in its line takes one hit, not one per frame
  const w = withBoons("pierce");
  const c = put(w, w.player.x + 60, w.player.y, EnemyKind.Charger);
  swing(w);
  run(w, 0.45);
  assert.equal(c.hp, 1);
});

test("boon CLEARING WARD: when a room's wave falls, 3 s of shield", () => {
  const w = createWorld(1);
  w.boons.push("shield");
  clearWave(w);
  assert.equal(w.seal.state, SealState.Arrive);
  assert.ok(w.player.shield > 2.85, `shield ${w.player.shield} s (3 s, less the 0.1 s clearWave runs on)`);
  assert.ok(isInvulnerable(w.player));
  const d = put(w, w.player.x + 3, w.player.y);
  d.arrive = 0;
  const hearts = w.player.hearts;
  run(w, 0.5);
  assert.equal(w.player.hearts, hearts, "a touch does nothing under the shield");
  run(w, 3);
  assert.equal(w.player.shield, 0);
  // Without the boon: no shield
  const v = createWorld(1);
  clearWave(v);
  assert.equal(v.player.shield, 0);
});
