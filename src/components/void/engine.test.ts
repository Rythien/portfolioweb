import { test } from "node:test";
import assert from "node:assert/strict";
import { TUNE, createWorld, iceAt, isInvulnerable, step, type Input, type World } from "./engine.ts";

const DT = 1 / 120;
const idle = (): Input => ({ mx: 0, my: 0, dash: false, attack: false, aimX: 0, aimY: 0 });

/** A world with no drifters (so nothing interferes). */
function empty(seed = 1): World {
  const w = createWorld(seed);
  for (const d of w.drifters) d.alive = false;
  w.spawnClock = -1e9; // no waves
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
  const d = w.drifters[0];
  Object.assign(d, { alive: true, x: w.player.x + dx, y: w.player.y + dy, arrive: 0, vx: 0, vy: 0 });
  return d;
}

test("an attack kills a drifter in front, never one behind, and lands with a 60 ms hit-stop", () => {
  const w = empty();
  w.player.faceX = 1;
  w.player.faceY = 0;
  const front = oneDrifterAt(w, 22, 0);
  const back = w.drifters[1];
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
