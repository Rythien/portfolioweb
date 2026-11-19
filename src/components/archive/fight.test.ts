import { test } from "node:test";
import assert from "node:assert/strict";
import { WALL } from "./game.ts";
import { facetAt, opportunities, summarise, timeToFree } from "./fightSim.ts";

/*
 * Phase 1's rhythm, measured by flying real pulses against the moving
 * cage and seal (fightSim.ts). The targets are the design's: an opening
 * every 4-8 s, each long enough to aim for, and a competent player frees
 * the seal in 20-60 s (under 20 is too easy, over 60 a chore).
 */
const setup = { phase: WALL.phases[0], gapOffset: Math.PI / 2, rotOffset: 0 };

test("openings arrive every 4-8 s and last long enough to take", () => {
  const ops = opportunities(setup, facetAt(0), 0, 60);
  const every = summarise(ops.slice(1).map((o, i) => o.start - ops[i].start));
  const lasting = summarise(ops.map((o) => o.end - o.start));
  assert.ok(every.median >= 4 && every.median <= 8, `every ${every.median.toFixed(2)} s`);
  assert.ok(lasting.median >= 0.5, `lasting ${lasting.median.toFixed(2)} s`);
});

test("a competent player frees the seal in 20-60 s", () => {
  const runs = [0, 7.3, 15.1, 22.9].map((t0, i) => timeToFree(setup, t0, i * 1.7, true));
  const s = summarise(runs.map((r) => r.seconds));
  assert.ok(s.median >= 20 && s.median <= 60, `median ${s.median.toFixed(1)} s`);
});
