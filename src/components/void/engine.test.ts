import { test } from "node:test";
import assert from "node:assert/strict";
import { Charge, EnemyKind, Spit, TUNE, createWorld, iceAt, isInvulnerable, restart, step, type Input, type World } from "./engine.ts";

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

test("killing the whole wave clears the room", () => {
  const w = createWorld(1);
  for (const d of w.enemies) if (d.alive) Object.assign(d, { x: w.player.x + 20, y: w.player.y, arrive: 0 });
  w.player.faceX = 1;
  w.player.faceY = 0;
  step(w, DT, { ...idle(), attack: true });
  assert.equal(alive(w), 0);
  assert.equal(w.phase, "clear");
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
