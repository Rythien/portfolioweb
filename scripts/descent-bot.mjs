#!/usr/bin/env node
// Headless playtester for DESCENT. Plays the real engine with a
// human-shaped bot: sees only the screen, re-plans every reaction
// interval, aims with error, steers with keyboard physics.
//   node scripts/descent-bot.mjs [runs] [seed]
import { createGame, step, STEP, takeEvents, TUNING, PX_PER_METRE } from "../src/components/game/descent/engine.ts";
import { passInterval } from "../src/components/game/descent/entities.ts";

export const SKILLS = {
  novice: { reaction: 0.26, noise: 9, dash: false, motes: false },
  decent: { reaction: 0.16, noise: 4, dash: true, motes: true },
};

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function playRun(seed, skill, { maxSeconds = 120, viewH = 568 } = {}) {
  const s = createGame({ seed, viewH, reducedMotion: false });
  const rnd = mulberry(seed ^ 0xabcdef);
  const input = { steer: 0, targetX: null, dash: false };
  let plan = { x: s.gem.x, dash: false };
  let nextThink = 0;
  const m = { firstHit: null, hits15: 0, bounces15: 0, depth15: null, score15: null, band15: 0, dashes: 0, bands: [], deathT: null };

  for (let t = 0; t < maxSeconds && !s.over; t += STEP) {
    if (t >= nextThink) {
      nextThink = t + skill.reaction;
      const g = s.gem;
      // Next unbroken row below the gem, if it is on screen
      const row = s.rows.find((r) => !r.broken && r.y > g.y + g.r && r.y < s.camY + s.cfg.viewH);
      if (row) {
        const [lo, hi] = passInterval(row, g.r);
        let tx = (lo + hi) / 2 + (rnd() - 0.5) * 2 * skill.noise;
        tx = Math.max(lo + 1, Math.min(hi - 1, tx));
        if (skill.motes) {
          const mote = s.pickups.find((p) => !p.taken && p.y > g.y && p.y < row.y && Math.abs(p.x - tx) < 40);
          if (mote) tx = mote.x;
        }
        const timeTo = (row.y - g.y) / Math.max(g.vy, 1);
        const reach = Math.abs(tx - g.x) / TUNING.maxVx + 0.08;
        const willMiss = reach > timeTo;
        plan = { x: tx, dash: skill.dash && row.kind === "ice" && willMiss && s.cooldown === 0 && timeTo < 0.35 };
      } else {
        plan = { x: plan.x, dash: false };
      }
    }
    const g = s.gem;
    const dx = plan.x - g.x;
    // Keyboard steering with braking against momentum
    const stopDist = (g.vx * g.vx) / (2 * TUNING.steerAccel);
    if (Math.abs(dx) < 2.5 && Math.abs(g.vx) < 40) input.steer = 0;
    else if (Math.sign(dx) === Math.sign(g.vx) && stopDist >= Math.abs(dx)) input.steer = -Math.sign(g.vx);
    else input.steer = Math.sign(dx);
    if (plan.dash) {
      input.dash = true;
      plan.dash = false;
      m.dashes++;
    }
    step(s, input, STEP);
    input.dash = false;
    for (const e of takeEvents(s)) {
      if (e.type === "damage") {
        if (m.firstHit === null) m.firstHit = +t.toFixed(2);
        if (t < 15) m.hits15++;
      } else if (e.type === "crack" && t < 15) m.bounces15++;
      else if (e.type === "band") m.bands.push([e.band, +t.toFixed(1)]);
      else if (e.type === "dead") m.deathT = +t.toFixed(1);
    }
    if (m.depth15 === null && t >= 15) {
      m.depth15 = Math.round(s.depth);
      m.score15 = Math.round(s.score);
      m.band15 = s.band;
    }
  }
  return { seed, depth: Math.round(s.depth), score: Math.round(s.score), lives: s.lives, ...m };
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop());
if (isMain) {
  const runs = +(process.argv[2] || 10);
  const seed0 = +(process.argv[3] || 1);
  console.log(`PX_PER_METRE ${PX_PER_METRE}, terminal ${TUNING.terminal}px/s = ${(TUNING.terminal / PX_PER_METRE).toFixed(1)} m/s`);
  for (const [name, skill] of Object.entries(SKILLS)) {
    const res = [];
    for (let i = 0; i < runs; i++) res.push(playRun(seed0 + i * 7919, skill));
    const avg = (k) => (res.reduce((a, r) => a + (r[k] ?? 0), 0) / res.length).toFixed(1);
    const died15 = res.filter((r) => r.deathT !== null && r.deathT < 15).length;
    console.log(`\n${name}: ${runs} runs`);
    console.log(`  first 15 s: hits ${avg("hits15")}, bounces ${avg("bounces15")}, depth ${avg("depth15")} m, band ${avg("band15")}, died ${died15}/${runs}`);
    console.log(`  first hit at ${res.map((r) => r.firstHit ?? "-").join(", ")} s`);
    console.log(`  run end: depth ${avg("depth")} m (score ${avg("score")}), died at ${res.map((r) => r.deathT ?? "alive").join(", ")} s`);
    console.log(`  band changes (run 1): ${res[0].bands.map(([b, t]) => `${b}@${t}s`).join(" ")}`);
  }
}
