#!/usr/bin/env node
// Interleaved A/B frame rate: awake hero and the Archive, per build.
// Firefox headless (software WebGL: compare builds, not absolute GPU
// numbers). Each run gets a fresh context: 1440x900 at DPR 2 (so the
// DPR caps apply), same URL, same waits. Rounds interleave the builds so
// machine load hits all of them alike. Reports, per scene, the run with
// the lowest median frame time (best of N).
//   node scripts/perf/ab.mjs <label=url> [label=url ...] [--rounds=3] [--no-archive=label,...]
import { firefox } from "playwright";
import { launch, session } from "../_browser.mjs";

const args = process.argv.slice(2);
const rounds = Number(args.find((a) => a.startsWith("--rounds="))?.split("=")[1] ?? 3);
const noArchive = (args.find((a) => a.startsWith("--no-archive="))?.split("=")[1] ?? "").split(",");
const builds = args.filter((a) => !a.startsWith("--")).map((a) => {
  const [label, url] = a.split("=");
  return { label, url };
});

const SCENES = [
  { name: "hero", q: "/?nopreload=1&noarchive=1&mode=wake", ready: null, wait: 10000, canvas: ".fixed.inset-0.z-0.pointer-events-none canvas" },
  { name: "archive-spawn", q: "/?nopreload=1&mode=dream", ready: "archive", wait: 4000, canvas: ".archive-canvas canvas" },
  { name: "archive-seal0", q: "/?nopreload=1&mode=dream&archiveat=0", ready: "archive", wait: 4000, canvas: ".archive-canvas canvas" },
];

// Each frame ends with a 1x1 readPixels on the scene's own WebGL context:
// it waits for everything submitted so far, so the frame interval is the
// real render cost (headless has no vsync and GL calls are asynchronous,
// so a plain rAF rate measures command submission, not rendering).
const rate = (page, sel) => page.evaluate((sel) => new Promise((res) => {
  const c = [...document.querySelectorAll(sel)].sort((a, b) => b.width * b.height - a.width * a.height)[0];
  const gl = c && (c.getContext("webgl2") || c.getContext("webgl"));
  const px = new Uint8Array(4);
  let n = 0; const t0 = performance.now(); let last = t0; const dts = [];
  const f = () => {
    if (gl) gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const now = performance.now();
    n++; dts.push(now - last); last = now;
    if (now - t0 < 8000) requestAnimationFrame(f);
    else {
      dts.sort((a, b) => a - b);
      res({ fps: (n * 1000) / (now - t0), med: dts[Math.floor(dts.length / 2)], p95: dts[Math.floor(dts.length * 0.95)], synced: !!gl });
    }
  };
  requestAnimationFrame(f);
}), sel);

await session(async () => {
  const browser = await launch(firefox, { firefoxUserPrefs: { "webgl.force-enabled": true, "webgl.disabled": false, "privacy.reduceTimerPrecision": false } });
  const results = {};
  for (let r = 0; r < rounds; r++) {
    for (const scene of SCENES) {
      for (const b of builds) {
        if (scene.ready === "archive" && noArchive.includes(b.label)) continue;
        const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
        const page = await ctx.newPage();
        // Same saved state for every run: no Archive progress, hint seen
        await page.goto(`${b.url}/?nopreload=1&noarchive=1`, { waitUntil: "domcontentloaded" });
        await page.evaluate(() => localStorage.setItem("archive-progress-v1", JSON.stringify({ freed: [], recovered: [], hintSeen: true })));
        await page.goto(b.url + scene.q, { waitUntil: "domcontentloaded" });
        if (scene.ready === "archive") await page.waitForFunction(() => (window.__archiveFrames ?? 0) > 30, null, { timeout: 60000 });
        await page.waitForTimeout(scene.wait);
        const m = await rate(page, scene.canvas);
        const dpr = await page.evaluate((sel) => {
          const c = [...document.querySelectorAll(sel)].sort((a, b) => b.width * b.height - a.width * a.height)[0];
          return c ? (c.width / c.clientWidth).toFixed(2) : "?";
        }, scene.canvas);
        const key = `${scene.name}|${b.label}`;
        (results[key] ??= []).push(m);
        console.log(`round ${r + 1}  ${scene.name.padEnd(14)} ${b.label.padEnd(12)} ${m.fps.toFixed(1)} fps  median ${m.med.toFixed(1)} ms  p95 ${m.p95.toFixed(1)} ms  DPR ${dpr}${m.synced ? "" : "  (NO GL SYNC)"}`);
        await ctx.close();
      }
    }
  }
  console.log("\nbest of", rounds);
  for (const [key, ms] of Object.entries(results)) {
    // Best run = lowest median frame time (robust to a load spike mid-run)
    const best = ms.reduce((a, b) => (b.med < a.med ? b : a));
    console.log(`${key.padEnd(28)} median frame ${best.med.toFixed(2)} ms = ${(1000 / best.med).toFixed(1)} fps (p95 ${best.p95.toFixed(1)} ms)   all medians: ${ms.map((m) => m.med.toFixed(2)).join(", ")}`);
  }
});
