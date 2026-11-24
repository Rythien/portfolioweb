#!/usr/bin/env node
// When does the hero's real crystal first draw, relative to first paint?
//
//   node scripts/perf/arrival.mjs [base=http://localhost:3100] [--software] [--runs=3]
//
// Firefox (the GPU path, or WARP with --software), 1440x900, fresh context
// per run. Two scenarios: "preload" (first visit: the preloader runs) and
// "direct" (?nopreload=1, a return visit in the same session). Times are
// ms after navigation start, and the crystal ones also after first
// contentful paint:
//   fcp        first contentful paint (the DOM)
//   screen     the WebGL composite first drew for real
//   first      anything of the intact crystal first drew: its stand-in
//              (GlassCrystal's own, or before it scene/warm.ts's) or glass
//   real       the intact crystal first drew with its real glass
//   fade       yes: the glass cross-faded in over the stand-in; no: it was
//              linked before the crystal was first shown
//   handover   the preloader handed the hero over (markIntroDone)
//   marquee    the marquee group first became visible (Marquee.tsx)
//   headline   the marquee first drew real glyphs with its real program
//              (scene/warm.ts; comparable across versions)
import { firefox } from "playwright";

const args = process.argv.slice(2);
const BASE = args.find((a) => a.startsWith("http")) ?? "http://localhost:3100";
const software = args.includes("--software");
const runs = Number(args.find((a) => a.startsWith("--runs="))?.split("=")[1] ?? 3);

const browser = await firefox.launch({
  headless: true,
  firefoxUserPrefs: { "webgl.force-enabled": true, "webgl.angle.force-warp": software, "privacy.reduceTimerPrecision": false },
});

const rows = [];
for (let r = 0; r < runs; r++) {
  for (const scenario of ["preload", "direct"]) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    const q = scenario === "direct" ? "?nopreload=1&mode=wake" : "?mode=wake";
    await p.goto(`${BASE}/${q}`, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.__crystalRealAt !== undefined, null, { timeout: 30000 }).catch(() => {});
    await p.waitForTimeout(500);
    const w = await p.evaluate(() => ({
      fcp: performance.getEntriesByType("paint").find((e) => e.name === "first-contentful-paint")?.startTime,
      screen: window.__screenDrawnAt,
      first: Math.min(window.__crystalStandInAt ?? Infinity, window.__crystalDrawnAt ?? Infinity, window.__crystalRealAt ?? Infinity),
      fade: window.__crystalArrival?.faded,
      real: window.__crystalRealAt,
      handover: window.__introDoneAt,
      marquee: window.__marqueeShownAt,
      headline: window.__heroDrawnAt,
      profile: window.__gfxProfile?.profile,
    }));
    rows.push({ scenario, ...w });
    await ctx.close();
  }
}
await browser.close();

const f = (v) => (v === undefined || !Number.isFinite(v) ? "   -  " : String(Math.round(v)).padStart(6));
console.log(`renderer: ${software ? "WARP (software)" : "GPU"}`);
console.log("scenario  profile   fcp  screen  first   real handover marquee headline fade | real-fcp  real-handover  first-fcp");
for (const w of rows) {
  const d = (a, b) => (a === undefined || b === undefined ? "   -" : String(Math.round(a - b)).padStart(6));
  console.log(`${w.scenario.padEnd(9)} ${String(w.profile).padEnd(7)} ${f(w.fcp)} ${f(w.screen)} ${f(w.first)} ${f(w.real)} ${f(w.handover)} ${f(w.marquee)}   ${f(w.headline)} ${w.fade ? " yes" : "  no"} | ${d(w.real, w.fcp)}   ${d(w.real, w.handover)}       ${d(w.first, w.fcp)}`);
}
