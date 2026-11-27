#!/usr/bin/env node
// Visible content and main-thread blocking, on a slow renderer or the GPU.
//
//   node scripts/perf/slow.mjs [base=http://localhost:3100] [--software] [--runs=2]
//
// --software forces Firefox onto WARP (Microsoft Basic Render Driver), the
// software rasteriser: the configuration that exposed the blank hero. Run
// against a production build (`next build && next start -p 3100`).
//
// Scenarios (fresh context each, 1440x900, preloader skipped so the scene
// itself is what is timed):
//   hero         WAKE load. Visible = the headline drawn with its real
//                program AND the composite on screen; crystal = the glass
//                first drawn (stand-in or real). Target: visible < 3 s.
//   dream-load   Straight into DREAM. Void = the Archive's first frame
//                (target < 1 s); Archive = its seal glass first drawn
//                (target < 5 s).
//   dream-click  WAKE load, DREAM clicked 1 s after DOMContentLoaded.
//                Flood start latency (target < 400 ms).
// Every scenario: frame times over 10 s (p50/p95/p99, longest) and the
// longest main-thread block once content is up (target <= 50 ms).
import { firefox } from "playwright";
import { launch, session } from "../_browser.mjs";

const args = process.argv.slice(2);
const BASE = args.find((a) => a.startsWith("http")) ?? "http://localhost:3100";
const software = args.includes("--software");
const runs = Number(args.find((a) => a.startsWith("--runs="))?.split("=")[1] ?? 2);

// rAF intervals (frame times; on a software renderer these also stretch when
// Firefox paces frames behind a slow rasteriser) and a main-thread heartbeat:
// a MessageChannel ping-pong that only stalls when the main thread is busy.
// Its gaps are the true blocks.
const RECORDER = `
window.__frames = []; let __last = performance.now();
const __f = (n) => { window.__frames.push([Math.round(n), +(n - __last).toFixed(1)]); __last = n; requestAnimationFrame(__f); };
requestAnimationFrame(__f);
window.__beats = []; let __bl = performance.now();
const __mc = new MessageChannel();
__mc.port1.onmessage = () => { const n = performance.now(); if (n - __bl > 20) window.__beats.push([Math.round(__bl), Math.round(n - __bl)]); __bl = n; setTimeout(() => __mc.port2.postMessage(0), 10); };
__mc.port2.postMessage(0);
`;

const pct = (a, p) => a[Math.min(a.length - 1, Math.floor(p * a.length))];
function stats(frames, from, to) {
  const d = frames.filter(([t]) => t >= from && t <= to).map(([, dt]) => dt).sort((a, b) => a - b);
  if (!d.length) return { n: 0 };
  return { n: d.length, p50: pct(d, 0.5), p95: pct(d, 0.95), p99: pct(d, 0.99), max: d.at(-1) };
}
/** Longest main-thread block (heartbeat gap) starting in [from, to]. */
function blockAfter(beats, from, to) {
  let m = 0, at = 0;
  for (const [t, d] of beats ?? []) if (t >= from && t <= to && d > m) { m = d; at = t; }
  return { ms: Math.max(0, m - 10), at };
}
/** Longest frame after `from`. */
function longestAfter(frames, from, to) {
  let m = 0, at = 0;
  for (const [t, dt] of frames) if (t - dt >= from && t <= to && dt > m) { m = dt; at = t - dt; }
  return { ms: m, at: Math.round(at) };
}

await session(async () => {
  const browser = await launch(firefox, {
    firefoxUserPrefs: { "webgl.force-enabled": true, "webgl.angle.force-warp": software, "privacy.reduceTimerPrecision": false },
  });
  const page0 = await browser.newPage();
  await page0.goto("about:blank");
  console.log("renderer:", await page0.evaluate(() => {
    const c = document.createElement("canvas").getContext("webgl2");
    return c ? c.getParameter(c.RENDERER) : "none";
  }), software ? "(forced WARP)" : "");
  await page0.close();

  const results = [];
  for (let r = 0; r < runs; r++) {
    // ── hero ──
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await ctx.addInitScript(RECORDER);
      const p = await ctx.newPage();
      await p.goto(`${BASE}/?nopreload=1&mode=wake`, { waitUntil: "domcontentloaded" });
      await p.waitForTimeout(10000);
      const w = await p.evaluate(() => ({
        screen: window.__screenDrawnAt, headline: window.__heroDrawnAt, crystal: window.__crystalDrawnAt,
        profile: window.__gfxProfile?.profile, frames: window.__frames, beats: window.__beats,
      }));
      const visible = Math.max(w.screen ?? Infinity, w.headline ?? Infinity);
      results.push({
        scenario: "hero", profile: w.profile,
        visibleMs: Math.round(visible), crystalMs: Math.round(w.crystal ?? Infinity),
        frames: stats(w.frames, 0, 10000), longestBlockAfterVisible: longestAfter(w.frames, visible, 10000), block: blockAfter(w.beats, visible, 10000),
      });
      await ctx.close();
    }
    // ── dream-load ──
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await ctx.addInitScript(RECORDER);
      const p = await ctx.newPage();
      await p.goto(`${BASE}/?nopreload=1&mode=wake&noarchive=1`, { waitUntil: "domcontentloaded" });
      await p.evaluate(() => localStorage.setItem("archive-progress-v1", JSON.stringify({ freed: [], recovered: [], hintSeen: true })));
      await p.goto(`${BASE}/?nopreload=1&mode=dream`, { waitUntil: "domcontentloaded" });
      await p.waitForTimeout(10000);
      const w = await p.evaluate(() => ({
        void: window.__archiveFirstFrameAt, glass: window.__archiveGlassDrawnAt, frames: window.__frames, beats: window.__beats, profile: window.__gfxProfile?.profile,
      }));
      const voidAt = w.void ?? Infinity;
      results.push({
        scenario: "dream-load", profile: w.profile,
        voidMs: Math.round(voidAt), archiveMs: Math.round(w.glass ?? Infinity),
        frames: stats(w.frames, 0, 10000), longestBlockAfterVoid: longestAfter(w.frames, voidAt, 10000), block: blockAfter(w.beats, voidAt, 10000),
      });
      await ctx.close();
    }
    // ── dream-click ──
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await ctx.addInitScript(RECORDER);
      const p = await ctx.newPage();
      await p.goto(`${BASE}/?nopreload=1&mode=wake&noarchive=1`, { waitUntil: "domcontentloaded" });
      await p.evaluate(() => localStorage.setItem("archive-progress-v1", JSON.stringify({ freed: [], recovered: [], hintSeen: true })));
      await p.goto(`${BASE}/?nopreload=1&mode=wake`, { waitUntil: "domcontentloaded" });
      await p.waitForTimeout(1000);
      const btn = p.getByRole("group", { name: "Site mode" }).getByRole("button", { name: /dream/i });
      await btn.waitFor({ timeout: 20000 });
      const clickAt = await btn.evaluate((el) => { const t = performance.now(); el.click(); return t; });
      await p.waitForTimeout(10000);
      const w = await p.evaluate(() => ({ flood: window.__floodStartedAt, void: window.__archiveFirstFrameAt, frames: window.__frames, beats: window.__beats, profile: window.__gfxProfile?.profile }));
      results.push({
        scenario: "dream-click", profile: w.profile,
        clickAtMs: Math.round(clickAt), floodLatencyMs: w.flood ? Math.round(w.flood - clickAt) : null,
        frames: stats(w.frames, clickAt, clickAt + 10000), longestBlockAfterClick: longestAfter(w.frames, clickAt, clickAt + 10000), block: blockAfter(w.beats, clickAt, clickAt + 10000),
      });
      await ctx.close();
    }
  }

  for (const r of results) {
    const f = r.frames;
    const head = `${r.scenario.padEnd(12)} [${r.profile}]`;
    const fs = f.n ? `frames p50 ${f.p50} p95 ${f.p95} p99 ${f.p99} max ${f.max} ms` : "no frames";
    if (r.scenario === "hero") console.log(`${head} visible ${r.visibleMs} ms, crystal ${r.crystalMs} ms | ${fs} | longest frame after visible ${r.longestBlockAfterVisible.ms} ms | main-thread block ${r.block.ms} ms @${r.block.at}`);
    if (r.scenario === "dream-load") console.log(`${head} void ${r.voidMs} ms, archive ${r.archiveMs} ms | ${fs} | longest frame after void ${r.longestBlockAfterVoid.ms} ms | main-thread block ${r.block.ms} ms @${r.block.at}`);
    if (r.scenario === "dream-click") console.log(`${head} clicked @${r.clickAtMs}, flood +${r.floodLatencyMs} ms | ${fs} | longest frame after click ${r.longestBlockAfterClick.ms} ms | main-thread block ${r.block.ms} ms @${r.block.at}`);
  }
});
