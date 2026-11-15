// Unit tests for the DESCENT engine. Run: npm run test:descent
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  step,
  takeEvents,
  comboMultiplier,
  reachModel,
  STEP,
  TUNING,
  type GameState,
  type Input,
} from "./engine.ts";
import { isReachable, passInterval, type Row } from "./entities.ts";

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random but plausible input: held steer, occasional dash taps. */
function randomInput(r: () => number, input: Input): Input {
  if (r() < 0.04) input.steer = Math.floor(r() * 3) - 1;
  input.dash = r() < 0.02;
  return input;
}

function playAndCollectRows(seed: number, seconds: number, reducedMotion = false): { s: GameState; rows: Row[] } {
  const s = createGame({ seed, viewH: 568, reducedMotion, invulnerable: true });
  const r = rng(seed * 31 + 7);
  const input: Input = { steer: 0, targetX: null, dash: false };
  const seen = new Map<number, Row>();
  for (let t = 0; t < seconds; t += STEP) {
    step(s, randomInput(r, input));
    for (const row of s.rows) seen.set(row.id, row);
  }
  return { s, rows: [...seen.values()].sort((a, b) => a.y - b.y) };
}

test("every generated row has a gap reachable from the previous one", () => {
  let pairs = 0;
  for (const reduced of [false, true]) {
    for (let seed = 1; seed <= 30; seed++) {
      // 100 s reaches past the 1500 m difficulty cap
      const { s, rows } = playAndCollectRows(seed, 100, reduced);
      assert.ok(rows.length > 40, `seed ${seed}: too few rows (${rows.length})`);
      for (let i = 1; i < rows.length; i++) {
        const prev = passInterval(rows[i - 1], s.gem.r);
        const next = passInterval(rows[i], s.gem.r);
        assert.ok(next[1] - next[0] > 0, `seed ${seed} row ${rows[i].id}: gap narrower than the gem`);
        assert.ok(
          isReachable(prev, next, rows[i].y - rows[i - 1].y, reachModel(s)),
          `seed ${seed} (reduced ${reduced}): row ${rows[i].id} unreachable from row ${rows[i - 1].id}`,
        );
        pairs++;
      }
    }
  }
  assert.ok(pairs > 3000, `checked ${pairs} pairs`);
});

test("dash cooldown never goes negative", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const s = createGame({ seed, viewH: 568, reducedMotion: false, invulnerable: true });
    const r = rng(seed);
    const input: Input = { steer: 0, targetX: null, dash: false };
    for (let t = 0; t < 30; t += STEP) {
      input.dash = r() < 0.3; // mash
      step(s, input);
      assert.ok(s.cooldown >= 0, `seed ${seed} t ${t.toFixed(3)}: cooldown ${s.cooldown}`);
      assert.ok(s.cooldown <= TUNING.dashCooldown + 1e-9);
    }
  }
});

test("combo resets on damage", () => {
  let checked = 0;
  for (let seed = 1; seed <= 40 && checked < 10; seed++) {
    const s = createGame({ seed, viewH: 568, reducedMotion: false, startDepth: 1300 });
    for (let t = 0; t < 60 && !s.over; t += STEP) {
      // Build a combo artificially, then let the gem fall into trouble
      if (s.hitInvuln === 0) s.combo = 12;
      step(s, { steer: 0, targetX: null, dash: false });
      for (const e of takeEvents(s)) {
        if (e.type === "damage") {
          assert.equal(s.combo, 0, `seed ${seed}: combo ${s.combo} after damage`);
          assert.equal(comboMultiplier(s.combo), 1);
          checked++;
        }
      }
    }
  }
  assert.ok(checked >= 10, `only saw ${checked} damage events`);
});

test("depth never decreases, even when thin ice bounces the gem up", () => {
  let bounces = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const s = createGame({ seed, viewH: 568, reducedMotion: false, invulnerable: true });
    let last = s.depth;
    let lastScore = s.score;
    for (let t = 0; t < 40; t += STEP) {
      step(s, { steer: 0, targetX: null, dash: false });
      for (const e of takeEvents(s)) if (e.type === "crack") bounces++;
      assert.ok(s.depth >= last, `seed ${seed}: depth ${s.depth} < ${last}`);
      assert.ok(s.score >= lastScore, `seed ${seed}: score went down`);
      last = s.depth;
      lastScore = s.score;
    }
  }
  assert.ok(bounces > 0, "no bounce happened, so the test proved nothing");
});

test("combo multiplier thresholds: 1x, 1.5x at 5, 2x at 10, 3x at 20", () => {
  assert.deepEqual([0, 4, 5, 9, 10, 19, 20, 50].map(comboMultiplier), [1, 1, 1.5, 1.5, 2, 2, 3, 3]);
});

test("a dash pressed within 120 ms of the cooldown ending fires the instant it ends", () => {
  const s = createGame({ seed: 1, viewH: 568, reducedMotion: false, invulnerable: true });
  const idle: Input = { steer: 0, targetX: null, dash: false };
  step(s, { ...idle, dash: true });
  while (s.cooldown > 0.1) step(s, idle);
  step(s, { ...idle, dash: true });
  let steps = 0;
  while (s.dashT === 0 && steps < 30) {
    step(s, idle);
    steps++;
  }
  assert.ok(s.dashT > 0, "buffered dash never fired");
  assert.ok(steps * STEP <= 0.1 + STEP, `fired ${(steps * STEP * 1000).toFixed(0)} ms later`);
});
