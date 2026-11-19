#!/usr/bin/env node
/**
 * Seal fight timing report (archive v2, phase 1).
 *
 *   node scripts/sim/fight-timing.mjs [--shell=10] [--seal=6.5] [--dir=same|against] [--window=36]
 *
 * Defaults are WALL.phases[0]. Prints, for the first facet over 120 s of
 * game time: how often an opening arrives (start to start), how long it
 * lasts and where it is; then time-to-free for a competent player (charged
 * on arrival, and arriving empty) over 24 arrival times and places.
 */
import { WALL } from "../../src/components/archive/game.ts";
import { facetAt, opportunities, summarise, timeToFree } from "../../src/components/archive/fightSim.ts";

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = WALL.phases[0];
const shell = Number(arg("shell", (2 * Math.PI) / base.sweep));
const seal = Number(arg("seal", (2 * Math.PI) / Math.abs(base.spin)));
const dir = arg("dir", base.spin > 0 ? "against" : "same");
const win = Number(arg("window", ((base.halfAz * 2) * 180) / Math.PI));
const phase = { ...base, sweep: (2 * Math.PI) / shell, spin: ((dir === "against" ? 1 : -1) * 2 * Math.PI) / seal, halfAz: ((win / 2) * Math.PI) / 180 };
const setup = { phase, gapOffset: Math.PI / 2, rotOffset: 0 };
const f = (x) => x.toFixed(2);

console.log(`shell ${shell} s/turn, seal ${seal} s/turn (${dir} the sweep), window ${win} deg`);
const ops = opportunities(setup, facetAt(0), 0, 120);
const gaps = ops.slice(1).map((o, i) => o.start - ops[i].start);
const lens = ops.map((o) => o.end - o.start);
const hops = ops.slice(1).map((o, i) => Math.abs(Math.atan2(Math.sin(o.az - ops[i].az), Math.cos(o.az - ops[i].az))) * 180 / Math.PI);
const S = (xs) => { const s = summarise(xs); return `median ${f(s.median)}  p25-p75 ${f(s.p25)}-${f(s.p75)}  min-max ${f(s.min)}-${f(s.max)}`; };
console.log(`openings in 120 s: ${ops.length}`);
if (gaps.length) console.log(`  every (s)    ${S(gaps)}`);
if (lens.length) console.log(`  lasting (s)  ${S(lens)}`);
if (hops.length) console.log(`  moves round  ${S(hops)} deg between consecutive openings`);
for (const charged of [true, false]) {
  const runs = Array.from({ length: 24 }, (_, i) => timeToFree(setup, i * 3.7, i * 0.9, charged));
  const secs = runs.map((r) => r.seconds);
  console.log(`time to free, arriving ${charged ? "charged" : "empty  "}: ${S(secs)}`);
  console.log(`  misses per free: ${f(summarise(runs.map((r) => r.misses)).mean)} (mean)`);
  console.log(`  per hit: rearm ${f(summarise(runs.flatMap((r) => r.rearm)).median)} s, wait for a reachable opening ${f(summarise(runs.flatMap((r) => r.wait)).median)} s (medians)`);
}
