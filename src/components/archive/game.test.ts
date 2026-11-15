import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CHARGE_FULL, ENDING, HITS_TO_FREE, MOTES, PULSE, createMotes, endingDue, nextFacet, releasePulse, resolveFacetHit, stepMotes, stepPulse,
  type SealTarget, type V3,
} from "./game.ts";

const seals: V3[] = [[2, 3, -24], [-31, -5, 4], [29, 7, 9]];

test("motes are denser near seals than in open void", () => {
  const motes = createMotes(seals);
  assert.equal(motes.length, MOTES.free + MOTES.perSeal * seals.length);
  const near = (p: V3) => seals.some((c) => Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]) < MOTES.near[1]);
  // Density: motes per unit volume within 14 of a seal vs the whole void
  const nNear = motes.filter((m) => near(m.home)).length;
  const volNear = seals.length * (4 / 3) * Math.PI * MOTES.near[1] ** 3;
  const volVoid = (4 / 3) * Math.PI * MOTES.voidRadius ** 3;
  assert.ok(nNear / volNear > 5 * (motes.length / volVoid), "much denser near seals");
});

test("flying through motes collects them, three at most, none wasted", () => {
  const motes = createMotes([], 7);
  // Park the player on three motes in turn
  let charge = 0;
  for (const m of motes.slice(0, 5)) {
    const got = stepMotes(motes, 0, 1 / 60, [...m.pos] as V3, charge);
    charge += got;
  }
  assert.equal(charge, CHARGE_FULL);
  assert.equal(motes.filter((m) => !m.alive).length, CHARGE_FULL, "a full charge leaves the rest alone");
});

test("motes within reach are pulled in", () => {
  const motes = createMotes([], 9).slice(0, 1);
  const m = motes[0];
  const player: V3 = [m.pos[0] + 3.5, m.pos[1], m.pos[2]];
  let got = 0;
  for (let i = 0; i < 120 && !got; i++) got = stepMotes(motes, i / 60, 1 / 60, player, 0);
  assert.equal(got, 1, "pulled in and collected within 2 s");
});

test("collected motes come back", () => {
  const motes = createMotes([], 11).slice(0, 1);
  stepMotes(motes, 0, 1 / 60, [...motes[0].pos] as V3, 0);
  assert.equal(motes[0].alive, false);
  stepMotes(motes, MOTES.respawn + 0.1, 1 / 60, [999, 999, 999], 0);
  assert.equal(motes[0].alive, true);
});

const target = (over: Partial<SealTarget> = {}): SealTarget => ({
  center: [0, 0, -20],
  rotY: 0,
  radii: [3, 3.6, 3],
  facet: [0, 0, 1], // facing the player
  shards: [],
  freed: false,
  ...over,
});

function fly(origin: V3, dir: V3, t: SealTarget[]) {
  const p = releasePulse(origin, dir);
  for (let i = 0; i < 600; i++) {
    const h = stepPulse(p, 1 / 60, t);
    if (h) return h;
  }
  return null;
}

test("a pulse at the lit facet cracks it", () => {
  const h = fly([0, 0, 0], [0, 0, -1], [target()]);
  assert.equal(h?.kind, "facet");
});

test("a pulse at another part of the body is wasted", () => {
  // Lit facet faces away; the hit lands on the near side
  const h = fly([0, 0, 0], [0, 0, -1], [target({ facet: [0, 0, -1] })]);
  assert.equal(h?.kind, "body");
});

test("the facet turns with the seal", () => {
  // Facet on +X in body space; body turned -90° about Y brings it to face +Z
  const h = fly([0, 0, 0], [0, 0, -1], [target({ facet: [1, 0, 0], rotY: -Math.PI / 2 })]);
  assert.equal(h?.kind, "facet");
});

test("an orbiting shard in the way takes the pulse", () => {
  const h = fly([0, 0, 0], [0, 0, -1], [target({ shards: [{ p: [0, 0, -12], r: 0.5 }] })]);
  assert.equal(h?.kind, "shard");
});

test("a miss fizzles out at range; freed seals are not targets", () => {
  assert.equal(fly([0, 0, 0], [0, 1, 0], [target()])?.kind, "fizzle");
  assert.equal(fly([0, 0, 0], [0, 0, -1], [target({ freed: true })])?.kind, "fizzle");
  assert.ok(PULSE.range > 60);
});

test("each hit moves the lit facet somewhere new and not adjacent", () => {
  let f = 0;
  const seen = new Set([f]);
  for (let h = 1; h <= 3; h++) {
    const n = nextFacet(f, h);
    assert.notEqual(n, f);
    assert.ok(Math.abs(n - f) > 1);
    f = n;
    seen.add(f);
  }
  assert.equal(seen.size, 4);
});

test("the third facet hit frees the seal; later hits do nothing", () => {
  const s = { hits: 0, freed: false };
  const out = Array.from({ length: HITS_TO_FREE + 1 }, () => resolveFacetHit(s));
  assert.deepEqual(out, ["crack", "crack", "freed", "none"]);
  assert.equal(s.freed, true);
  assert.equal(s.hits, HITS_TO_FREE);
});

test("the ending waits for all three, then for the last panel or the timeout", () => {
  assert.equal(endingDue(false, 0, true, 100), false, "not before every seal is freed");
  assert.equal(endingDue(true, 10, false, 10 + ENDING.wait - 0.1), false, "waits after the last freeing");
  assert.equal(endingDue(true, 10, true, 10.5), true, "floating into the last panel starts it at once");
  assert.equal(endingDue(true, 10, false, 10 + ENDING.wait), true, "or the wait runs out");
});
