#!/usr/bin/env node
// Frame rate in a VISIBLE Firefox window on the real GPU (headless Firefox
// on this machine cannot A/B builds: it pins at its rAF ceiling or falls
// back to software). Opens windows on screen for a few minutes.
//
// Scenes: awake hero at rest, awake hero while wheel-scrolling, Archive at
// spawn, Archive parked facing seal 0 (archiveat=0, the nearest seal).
// Each run: fresh context (same saved state), 1440x900, 8 s of rAF.
// Rounds interleave the builds; reports the best run (highest fps) of N
// per scene and build, with the spread across runs.
// --sync: end every frame with a 1x1 readPixels on the scene's canvas, so
//   the interval includes the finished GPU work (the plain rate pins at
//   Firefox's 200 Hz frame ceiling on a fast GPU). --dpr=2 for a HiDPI load.
//   node scripts/perf/headed.mjs <label=url> [...] [--rounds=3] [--sync] [--dpr=1] [--no-archive=label,...] [--hero-only=label,...]
import { firefox } from "playwright";

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.split("=")[1] ?? d;
const rounds = Number(opt("rounds", 3));
const noArchive = opt("no-archive", "").split(",");
const heroOnly = opt("hero-only", "").split(",");
const sync = args.includes("--sync");
const dpr = Number(opt("dpr", 1));
const builds = args.filter((a) => !a.startsWith("--")).map((a) => {
  const [label, url] = a.split("=");
  return { label, url };
});

const SCENES = [
  { name: "hero-rest", q: "/?nopreload=1&noarchive=1&mode=wake", archive: false, wait: 10000, canvas: ".fixed.inset-0.z-0.pointer-events-none canvas" },
  { name: "hero-scroll", q: "/?nopreload=1&noarchive=1&mode=wake", archive: false, wait: 10000, scroll: true, canvas: ".fixed.inset-0.z-0.pointer-events-none canvas" },
  { name: "archive-spawn", q: "/?nopreload=1&mode=dream", archive: true, wait: 5000, canvas: ".archive-canvas canvas" },
  { name: "archive-seal", q: "/?nopreload=1&mode=dream&archiveat=0", archive: true, wait: 5000, canvas: ".archive-canvas canvas" },
];
const MEASURE_MS = 8000;

const measure = (page, sel) => page.evaluate(([ms, sel, sync]) => new Promise((res) => {
  const c = sync ? document.querySelector(sel) : null;
  const gl = c && (c.getContext("webgl2") || c.getContext("webgl"));
  const px = new Uint8Array(4);
  const dts = []; const t0 = performance.now(); let last = t0;
  const f = () => {
    if (gl) gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const now = performance.now();
    dts.push(now - last); last = now;
    if (now - t0 < ms) requestAnimationFrame(f);
    else {
      const total = now - t0;
      dts.sort((a, b) => a - b);
      res({ fps: (dts.length * 1000) / total, med: dts[Math.floor(dts.length / 2)], p95: dts[Math.floor(dts.length * 0.95)] });
    }
  };
  requestAnimationFrame(f);
}), [MEASURE_MS, sel, sync]);

const browser = await firefox.launch({ headless: false, firefoxUserPrefs: { "privacy.reduceTimerPrecision": false } });
let renderer = "";
const results = {};
for (let r = 0; r < rounds; r++) {
  for (const scene of SCENES) {
    for (const b of builds) {
      if (scene.archive && noArchive.includes(b.label)) continue;
      if (!scene.archive && heroOnly.length && heroOnly[0] && !heroOnly.includes(b.label)) continue;
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: dpr });
      const page = await ctx.newPage();
      await page.goto(`${b.url}/?nopreload=1&noarchive=1`, { waitUntil: "domcontentloaded" });
      await page.evaluate(() => localStorage.setItem("archive-progress-v1", JSON.stringify({ freed: [], recovered: [], hintSeen: true })));
      await page.goto(b.url + scene.q, { waitUntil: "domcontentloaded" });
      if (scene.archive) await page.waitForFunction(() => (window.__archiveFrames ?? 0) > 30, null, { timeout: 60000 });
      await page.waitForTimeout(scene.wait);
      if (!renderer) {
        renderer = await page.evaluate(() => {
          const gl = document.createElement("canvas").getContext("webgl2");
          const e = gl?.getExtension("WEBGL_debug_renderer_info");
          return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl?.getParameter(gl.RENDERER) ?? "none";
        });
        console.log(`renderer: ${renderer}, devicePixelRatio ${await page.evaluate(() => devicePixelRatio)}`);
      }
      let scrolling = false;
      let scroller = null;
      if (scene.scroll) {
        await page.mouse.move(720, 450);
        scrolling = true;
        // Steady wheel input through the whole window: hero -> break -> park
        scroller = (async () => {
          while (scrolling) {
            await page.mouse.wheel(0, 45);
            await page.waitForTimeout(60);
          }
        })();
      }
      const m = await measure(page, scene.canvas);
      scrolling = false;
      await scroller;
      const key = `${scene.name}|${b.label}`;
      (results[key] ??= []).push(m);
      console.log(`round ${r + 1}  ${scene.name.padEnd(14)} ${b.label.padEnd(12)} ${m.fps.toFixed(1)} fps  median ${m.med.toFixed(1)} ms  p95 ${m.p95.toFixed(1)} ms`);
      await ctx.close();
    }
  }
}
await browser.close();
console.log(`\n${sync ? "GPU-synced, " : ""}DPR ${dpr}, best of ${rounds} (spread = min..max fps across runs)`);
for (const [key, ms] of Object.entries(results)) {
  const fps = ms.map((m) => m.fps);
  const best = ms.reduce((a, b) => (b.fps > a.fps ? b : a));
  console.log(`${key.padEnd(26)} ${best.fps.toFixed(1)} fps (p95 frame ${best.p95.toFixed(1)} ms)   spread ${Math.min(...fps).toFixed(1)}..${Math.max(...fps).toFixed(1)}`);
}
