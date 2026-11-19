#!/usr/bin/env node
/**
 * A scripted run at seal 0's shield wall, recorded to video.
 *
 *   node scripts/shot/fight.mjs [--url=http://localhost:3000] [--out=shots/fight]
 *
 * The pilot parks off the window's axis and fires straight at the seal (the
 * wall takes it: the pulse shatters), then flies round to meet the window,
 * leads the moving facet (pulse travel time at PULSE.speed) and fires
 * through it until the seal is free. Charge comes from the test hook
 * (archivecharge=3, __archiveRecharge), so the run shows the fight, not
 * mote collection. Writes <out>/fight.webm and logs every hit kind.
 *
 * Headless Firefox renders slower than real time here; the game clamps a
 * long frame to 1/20 s, so the recording can run slower than live play.
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
await page.goto(`${base}/?nopreload=1&mode=dream&archiveat=0&archivecharge=3`, { waitUntil: "load", timeout: 120000 });
await page.waitForFunction(() => window.__archiveWarmMs && window.__archiveTargets?.[0], null, { timeout: 120000 });
await page.waitForTimeout(1500);

// Page-side helpers: where the facet is (and will be), and a smooth glide
await page.evaluate(() => {
  const W = window;
  const SPEED = 18;
  /** Facet world position now, and its azimuth about the seal. */
  W.__facet = () => {
    const tg = W.__archiveTargets[0];
    const c = Math.cos(tg.rotY), s = Math.sin(tg.rotY);
    const fx = tg.facet[0] * c + tg.facet[2] * s, fz = -tg.facet[0] * s + tg.facet[2] * c;
    return { c: tg.center, r: Math.hypot(fx, fz), y: tg.facet[1], az: Math.atan2(fz, fx) };
  };
  /** Face a world point. */
  W.__look = (p) => {
    const f = W.__archiveFlight;
    f.yaw = Math.atan2(-(p[0] - f.px), -(p[2] - f.pz));
    f.pitch = Math.atan2(p[1] - f.py, Math.hypot(p[0] - f.px, p[2] - f.pz));
  };
  /** Aim where the facet will be when a pulse fired now arrives. */
  W.__lead = (sweep) => {
    const f = W.__archiveFlight;
    const fa = W.__facet();
    let tt = 0;
    let p = [0, 0, 0];
    for (let k = 0; k < 4; k++) {
      const a = fa.az + sweep * tt;
      p = [fa.c[0] + Math.cos(a) * fa.r, fa.c[1] + fa.y, fa.c[2] + Math.sin(a) * fa.r];
      tt = Math.hypot(p[0] - f.px, p[1] - f.py, p[2] - f.pz) / SPEED;
    }
    W.__look(p);
    return tt;
  };
  /** Glide round the seal at distance d to azimuth target (rad), over ms,
   * eased in and out, always facing the seal. Resolves when there. */
  W.__glide = (target, d, ms, lift = 1.5) =>
    new Promise((done) => {
      const f = W.__archiveFlight;
      const c = W.__archiveTargets[0].center;
      const a0 = Math.atan2(f.pz - c[2], f.px - c[0]);
      const d0 = Math.hypot(f.px - c[0], f.pz - c[2]);
      const y0 = f.py;
      let da = target - a0;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      const t0 = performance.now();
      const step = () => {
        const u = Math.min(1, (performance.now() - t0) / ms);
        const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
        const a = a0 + da * e;
        const r = d0 + (d - d0) * e;
        f.px = c[0] + Math.cos(a) * r;
        f.pz = c[2] + Math.sin(a) * r;
        f.py = y0 + (c[1] + lift - y0) * e;
        f.vx = f.vy = f.vz = 0;
        W.__look(c);
        if (u < 1) requestAnimationFrame(step);
        else done();
      };
      step();
    });
});

const hits = () => page.evaluate(() => (window.__archiveHits ?? []).slice());
const fire = async () => {
  await page.keyboard.press("Space");
};
const settle = (ms) => page.waitForTimeout(ms);

// 1. Off the window's axis: a straight shot at the seal hits the wall
const fa = await page.evaluate(() => window.__facet());
await page.evaluate((a) => window.__glide(a, 18, 1200), fa.az + Math.PI * 0.6);
await settle(600);
await page.evaluate(() => window.__look(window.__archiveTargets[0].center));
await fire();
await settle(2200);
console.log("after the straight shot:", await hits());

// 2..4. Meet the window, lead the facet, fire through; repeat until free
for (let shot = 0; shot < 3; shot++) {
  await page.evaluate(() => window.__archiveRecharge?.());
  // Glide to where the window will be in ~3 s, a little ahead of it
  await page.evaluate(() => {
    const fa = window.__facet();
    return window.__glide(fa.az + 0.22 * 3 + 0.12, 16, 3000);
  });
  await settle(500);
  const tt = await page.evaluate(() => window.__lead(0.22));
  await fire();
  await settle(Math.max(1600, tt * 1000 + 1200));
  console.log(`shot ${shot + 1} (travel ${tt.toFixed(2)} s):`, (await hits()).slice(-1)[0]);
}
await settle(4000);
const seal = await page.evaluate(() => ({ hits: window.__archiveHits, t: window.__archiveT() }));
console.log("all hits:", seal.hits.join(", "), "· game time", seal.t.toFixed(1), "s");
await ctx.close();
await browser.close();
const vid = readdirSync(out).filter((f) => f.endsWith(".webm") && f !== "fight.webm").pop();
if (vid) renameSync(resolve(out, vid), resolve(out, "fight.webm"));
console.log(`video: ${resolve(out, "fight.webm")}`);
