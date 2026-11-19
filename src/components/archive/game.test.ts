import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CHARGE_FULL, ENDING, HITS_TO_FREE, MOTES, PULSE, SHARD_HIT, WALL, bodyRot, createMotes, endingDue, facetAzimuth, gapAzimuth, nextFacet,
  releasePulse, resolveFacetHit, stepMotes, stepPulse, wallShardOffset, wallSlotOpen, wallSlots,
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

/* ── Shield wall ──────────────────────────────────────────────── */

const RADII: V3 = [2.94, 3.59, 2.94];
/** An equatorial facet in body space, as on the real seals. */
const EQ_FACET: V3 = [2.9, 0.05, 0.4];

/** Body rotation that turns EQ_FACET to look along world azimuth az. */
const rotFor = (az: number) => Math.atan2(EQ_FACET[2], EQ_FACET[0]) - az;

/** A walled seal at the origin, window along gapAz, facet along facetAz. */
function walled(gapAz: number, phase = 0, facetAz = gapAz): SealTarget {
  const ph = WALL.phases[phase];
  const shards = wallSlots()
    .filter((s) => !wallSlotOpen(s, ph))
    .map((s) => ({ p: wallShardOffset(s, gapAz, [0, 0, 0]), r: WALL.shardScale * SHARD_HIT }));
  return { center: [0, 0, 0], rotY: rotFor(facetAz), radii: RADII, facet: EQ_FACET, shards, freed: false };
}

/** The facet's world position on a walled seal (body turns about Y). */
function facetWorld(t: SealTarget): V3 {
  const c = Math.cos(t.rotY), s = Math.sin(t.rotY);
  return [t.facet[0] * c + t.facet[2] * s, t.facet[1], -t.facet[0] * s + t.facet[2] * c];
}

test("the pulse is a projectile: about 18 units/s, so a long shot takes time", () => {
  assert.ok(PULSE.speed >= 15 && PULSE.speed <= 20);
  const p = releasePulse([0, 0, 0], [0, 0, -1]);
  stepPulse(p, 0.5, []);
  assert.ok(Math.abs(p.travelled - PULSE.speed * 0.5) < 0.3);
});

test("the seal turns on its own clock: its facet is in the window only part of the time", () => {
  const ph = WALL.phases[0];
  let inside = 0;
  const N = 2000;
  for (let i = 0; i < N; i++) {
    const t = (i / N) * 130; // the 10 s and 23 s periods do not line up inside this
    const d = facetAzimuth(EQ_FACET, bodyRot(ph, t)) - gapAzimuth(ph, t);
    if (Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) < ph.halfAz) inside++;
  }
  const share = inside / N;
  // About the window's share of a turn (36 / 360), never always, never never
  assert.ok(share > 0.05 && share < 0.2, `facet in the window ${(share * 100).toFixed(1)}% of the time`);
});

test("the cage is about 90 shards", () => {
  const closed = wallSlots().filter((s) => !wallSlotOpen(s, WALL.phases[0])).length;
  assert.ok(closed >= 80 && closed <= 100, `${closed} shards`);
});

test("a fight's motes lie outside its firing ring, so rearming means leaving it", () => {
  const ms = createMotes([[0, 0, 0]], 3, [true]).slice(MOTES.free);
  for (const m of ms) assert.ok(Math.hypot(m.home[0], m.home[2]) >= 22, `mote at ${Math.hypot(m.home[0], m.home[2]).toFixed(1)}`);
});

test("a pulse through the window cracks the facet", () => {
  for (const gap of [0, 0.9, -2.2]) {
    const t = walled(gap);
    const f = facetWorld(t);
    const out: V3 = [Math.cos(gap) * 16, 0.4, Math.sin(gap) * 16];
    const h = fly(out, [f[0] - out[0], f[1] - out[1], f[2] - out[2]], [t]);
    assert.equal(h?.kind, "facet", `gap ${gap}`);
  }
});

/** First point where the segment o -> a meets the sphere of radius r at the origin. */
function crossing(o: V3, a: V3, r: number): V3 {
  const d: V3 = [a[0] - o[0], a[1] - o[1], a[2] - o[2]];
  const A = d[0] ** 2 + d[1] ** 2 + d[2] ** 2;
  const B = 2 * (o[0] * d[0] + o[1] * d[1] + o[2] * d[2]);
  const C = o[0] ** 2 + o[1] ** 2 + o[2] ** 2 - r * r;
  const k = (-B - Math.sqrt(Math.max(0, B * B - 4 * A * C))) / (2 * A);
  return [o[0] + d[0] * k, o[1] + d[1] * k, o[2] + d[2] * k];
}

test("the cage is closed: a shot that crosses it outside the window never reaches the facet", () => {
  // 600 shots from all round the seal, each aimed at the facet (or near it)
  const gap = 0.7;
  const t = walled(gap);
  const f = facetWorld(t);
  const ph = WALL.phases[0];
  let s = 7;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  let blocked = 0;
  for (let i = 0; i < 600; i++) {
    const lat = Math.asin(2 * rnd() - 1);
    const az = gap + (rnd() * 2 - 1) * Math.PI;
    const o: V3 = [16 * Math.cos(lat) * Math.cos(az), 16 * Math.sin(lat), 16 * Math.cos(lat) * Math.sin(az)];
    const aim: V3 = [f[0] + (rnd() - 0.5), f[1] + (rnd() - 0.5), f[2] + (rnd() - 0.5)];
    // Where the path crosses the cage: a shot through the window (with a
    // margin of one shard spacing) may legitimately land
    const x = crossing(o, aim, WALL.radius);
    const xAz = Math.atan2(Math.sin(Math.atan2(x[2], x[0]) - gap), Math.cos(Math.atan2(x[2], x[0]) - gap));
    const xLat = Math.asin(x[1] / WALL.radius);
    const m = WALL.spacing / WALL.radius;
    if (Math.abs(xAz) < ph.halfAz + m && Math.abs(xLat) < ph.halfLat + m) continue;
    const rel = xAz;
    const h = fly(o, [aim[0] - o[0], aim[1] - o[1], aim[2] - o[2]], [t]);
    assert.notEqual(h?.kind, "facet", `shot crossing the cage at lat ${xLat.toFixed(2)} az ${rel.toFixed(2)} reached the facet`);
    if (h?.kind === "shard") blocked++;
  }
  assert.ok(blocked > 300, `the wall takes most shots (${blocked})`);

});

test("when the window has turned away from the facet, a shot at the facet hits the wall", () => {
  const out: V3 = [16, 0.4, 0];
  // Facet still facing the shooter, window turned 70 deg away
  const after = walled(1.2, 0, 0);
  const f = facetWorld(after);
  const h = fly(out, [f[0] - out[0], f[1] - out[1], f[2] - out[2]], [after]);
  assert.equal(h?.kind, "shard");
});
