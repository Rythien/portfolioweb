#!/usr/bin/env node
/**
 * A scripted run at seal 0's shield wall, recorded to video.
 *
 *   node scripts/shot/fight.mjs [--url=http://localhost:3000] [--out=shots/fight]
 *
 * The pilot plays by the rules: it arrives empty, rearms by flying to the
 * real motes in the fight's band (three per pulse), predicts the next
 * opening from the live window and facet angles (window inside +/-60% of
 * its half-width at the pulse's arrival), flies to where it will be if it
 * can get there in time, leads the facet and fires. It moves at 7 u/s like
 * fightSim's competent player, but steers by placing the camera directly.
 * It logs every hit kind, every wait and the GAME time to free (the
 * recording runs slower than live: headless Firefox renders slowly and a
 * long frame advances the game by at most 1/20 s).
 */
import { firefox } from "playwright";
import { mkdirSync, readdirSync, renameSync } from "fs";
import { resolve } from "path";

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = arg("url", "http://localhost:3000");
const out = resolve(arg("out", "shots/fight"));
mkdirSync(out, { recursive: true });

const browser = await firefox.launch({ headless: true, firefoxUserPrefs: { "webgl.force-enabled": true } });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: out, size: { width: 1280, height: 720 } } });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("pageerror:", e.message));
const t0wall = Date.now();
await page.goto(`${base}/?nopreload=1&mode=dream&archiveat=0`, { waitUntil: "load", timeout: 120000 });
await page.waitForFunction(() => window.__archiveTargets?.[0] && window.__archiveGap?.[0] && window.__archiveMotes, null, { timeout: 120000 });
const glassAt = await page.evaluate(() => window.__sealGlassReadyAt ?? null);
await page.waitForFunction(() => window.__sealGlassReadyAt, null, { timeout: 60000 }).catch(() => {});
console.log(`seal glass linked ${glassAt ? "before" : "after"} the scene was ready; curtain lifted at ${((await page.evaluate(() => window.__sealGlassReadyAt)) / 1000).toFixed(1)} s page time`);
await page.waitForTimeout(800);

const result = await page.evaluate(async () => {
  const W = window;
  const SPEED = 18, FLY = 7, RING = 16;
  const f = W.__archiveFlight;
  const T = () => W.__archiveT();
  const frame = () => new Promise((r) => requestAnimationFrame(r));
  const seal = () => W.__archiveTargets[0];
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const facetAz = () => {
    const tg = seal();
    const c = Math.cos(tg.rotY), s = Math.sin(tg.rotY);
    return Math.atan2(-tg.facet[0] * s + tg.facet[2] * c, tg.facet[0] * c + tg.facet[2] * s);
  };
  const facetR = () => Math.hypot(seal().facet[0], seal().facet[2]);
  const look = (p) => {
    f.yaw = Math.atan2(-(p[0] - f.px), -(p[2] - f.pz));
    f.pitch = Math.atan2(p[1] - f.py, Math.hypot(p[0] - f.px, p[2] - f.pz));
  };
  /** Glide straight to p at FLY u/s, facing `face` (or the way it goes). */
  const glide = async (p, face) => {
    for (;;) {
      await frame();
      const d = [p[0] - f.px, p[1] - f.py, p[2] - f.pz];
      const l = Math.hypot(...d);
      const step = FLY / 60;
      f.vx = f.vy = f.vz = 0;
      if (l <= step) {
        f.px = p[0]; f.py = p[1]; f.pz = p[2];
        look(face ?? seal().center);
        return;
      }
      f.px += (d[0] / l) * step; f.py += (d[1] / l) * step; f.pz += (d[2] / l) * step;
      look(face ?? p);
    }
  };
  const log = [];
  const tStart = T();
  // Arrive empty: whatever charge there was is spent
  W.__archiveRecharge = undefined;
  for (let hit = 0; hit < 3; ) {
    // 1. Rearm from the band
    const r0 = T();
    while (W.__archiveCharge() < 3) {
      const c = seal().center;
      let best = null, bd = Infinity;
      for (const m of W.__archiveMotes) {
        if (!m.alive || Math.hypot(m.pos[0] - c[0], m.pos[2] - c[2]) > 34) continue;
        const d = Math.hypot(m.pos[0] - f.px, m.pos[1] - f.py, m.pos[2] - f.pz);
        if (d < bd) [bd, best] = [d, m];
      }
      if (!best) { await frame(); continue; }
      await glide([...best.pos]);
      await frame();
    }
    const rearm = T() - r0;
    // 2. The next opening it can reach: facet and window both at azimuth a
    //    when the pulse arrives
    const ph = W.__archiveGap[0].phase;
    const w0 = T();
    let plan = null;
    for (let k = 1; k < 400 && !plan; k++) {
      const fire = T() + k * 0.05;
      const travel = (RING - facetR()) / SPEED;
      const arrive = fire + travel;
      const fa = facetAz() - ph.spin * (arrive - T());
      const ga = W.__archiveGap[0].az + ph.sweep * (arrive - T());
      if (Math.abs(wrap(fa - ga)) > ph.halfAz * 0.6) continue;
      const c = seal().center;
      const spot = [c[0] + Math.cos(fa) * RING, c[1] + 1, c[2] + Math.sin(fa) * RING];
      const reach = Math.hypot(spot[0] - f.px, spot[1] - f.py, spot[2] - f.pz) / FLY + 0.3;
      if (reach < k * 0.05) plan = { fire, spot, fa };
    }
    if (!plan) { log.push("no reachable opening"); break; }
    await glide(plan.spot, seal().center);
    while (T() < plan.fire) await frame();
    // 3. Lead: aim where the facet will be on arrival, and fire
    const c = seal().center;
    const travel = Math.hypot(c[0] - f.px, c[2] - f.pz) / SPEED;
    const a = facetAz() - ph.spin * travel;
    look([c[0] + Math.cos(a) * facetR(), c[1] + seal().facet[1], c[2] + Math.sin(a) * facetR()]);
    await frame();
    const before = (W.__archiveHits ?? []).length;
    W.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", key: " ", bubbles: true }));
    W.dispatchEvent(new KeyboardEvent("keyup", { code: "Space", key: " ", bubbles: true }));
    while ((W.__archiveHits ?? []).length === before) await frame();
    const kind = W.__archiveHits[W.__archiveHits.length - 1];
    log.push({ kind, rearm: +rearm.toFixed(2), wait: +(T() - w0).toFixed(2), at: +(T() - tStart).toFixed(2) });
    if (kind === "facet") hit++;
    // Back off from the ring while the next charge is gathered
  }
  return { log, seconds: T() - tStart, hits: W.__archiveHits };
});
for (const l of result.log) console.log(" ", typeof l === "string" ? l : `${l.kind.padEnd(6)} rearm ${l.rearm}s  wait+fly ${l.wait}s  at ${l.at}s`);
console.log(`freed in ${result.seconds.toFixed(1)} s of game time (all hits: ${result.hits.join(", ")})`);
await page.waitForTimeout(5000);
await ctx.close();
await browser.close();
const vid = readdirSync(out).filter((f) => f.endsWith(".webm") && f !== "fight.webm").pop();
if (vid) renameSync(resolve(out, vid), resolve(out, "fight.webm"));
console.log(`video: ${resolve(out, "fight.webm")} (${((Date.now() - t0wall) / 1000).toFixed(0)} s wall)`);
