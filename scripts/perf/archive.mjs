#!/usr/bin/env node
// Archive frame rate (Firefox headless, software WebGL: a warning light,
// not a GPU verdict). Loads straight into DREAM, waits for the Archive,
// then measures the rAF rate for 5 s at spawn and parked at seal 0.
// Usage: node scripts/perf/archive.mjs [label]
import { firefox } from "playwright";
const BASE = process.env.BASE ?? "http://localhost:3000";
const label = process.argv[2] ?? "";
// Optional: slugs to arrive freed (saved progress), comma separated
const freed = (process.argv[3] ?? "").split(",").filter(Boolean);
const browser = await firefox.launch({ headless: true, firefoxUserPrefs: { "webgl.force-enabled": true, "webgl.disabled": false } });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const rate = (page) => page.evaluate(() => new Promise((res) => {
  let n = 0; const t0 = performance.now(); let worst = 0; let last = t0;
  const f = (now) => { n++; worst = Math.max(worst, now - last); last = now; if (now - t0 < 5000) requestAnimationFrame(f); else res({ fps: (n * 1000) / (now - t0), worst }); };
  requestAnimationFrame(f);
}));
for (const [name, q] of [["spawn", ""], ["seal0", "&archiveat=0"]]) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}/?nopreload=1&mode=dream&noarchive=1`, { waitUntil: "domcontentloaded" });
  await page.evaluate((freed) => localStorage.setItem("archive-progress-v1", JSON.stringify({ freed, recovered: [], hintSeen: true })), freed);
  await page.goto(`${BASE}/?nopreload=1&mode=dream${q}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => (window.__archiveFrames ?? 0) > 30, null, { timeout: 60000 });
  await page.waitForTimeout(4000);
  const r = await rate(page);
  const dpr = await page.evaluate(() => { const c = document.querySelector(".archive-canvas canvas"); return c ? (c.width / c.clientWidth).toFixed(2) : "?"; });
  console.log(`${label} ${name}: ${r.fps.toFixed(1)} fps, worst frame ${r.worst.toFixed(0)} ms, canvas DPR ${dpr}`);
  await page.close();
}
await browser.close();
