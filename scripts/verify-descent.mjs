#!/usr/bin/env node
// DESCENT end-to-end check (headless Edge via Playwright).
//   node scripts/verify-descent.mjs [baseUrl]
// Three 60 s runs of simulated input: asserts no page errors, no heap
// growth across runs (CDP GC + heap usage after each run), samples frame
// times, and saves screenshots at ~100 / 500 / 1200 m plus the death
// screen to shots/descent/.
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const BASE = process.argv[2] || "http://localhost:3000";
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "shots", "descent");
mkdirSync(OUT, { recursive: true });
const RUN_SECONDS = 60;
const DEPTH_SHOTS = [100, 500, 1200];

const browser = await chromium.launch({ channel: "msedge", headless: true });
const errors = [];
const watch = (page) => {
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
};

/** In-page bot: steers to the next gap, dashes to break ice it can't make. */
const startBot = () => {
  const h = window.__descent;
  window.__bot = setInterval(() => {
    const s = h.game;
    if (!s || s.over) return;
    const g = s.gem;
    const row = s.rows.find((r) => !r.broken && r.y > g.y + g.r);
    if (!row) { h.input.steer = 0; return; }
    const dx = row.gapX - g.x;
    const stop = (g.vx * g.vx) / (2 * 2600);
    h.input.steer = Math.abs(dx) < 3 ? 0 : Math.sign(dx) === Math.sign(g.vx) && stop >= Math.abs(dx) ? -Math.sign(g.vx) : Math.sign(dx);
    const timeTo = (row.y - g.y) / Math.max(g.vy, 1);
    const inGap = Math.abs(dx) < row.gapW / 2 - 4;
    if (row.kind === "ice" && !inGap && timeTo < 0.25 && s.cooldown === 0) h.input.dash = true;
  }, 1000 / 60);
};

/** Frame-time sampler on rAF. */
const startFps = () => {
  const f = (window.__fps = { frames: 0, t0: performance.now(), last: performance.now(), gaps: [] });
  const tick = (now) => {
    f.frames++;
    f.gaps.push(now - f.last);
    f.last = now;
    f.raf = requestAnimationFrame(tick);
  };
  f.raf = requestAnimationFrame(tick);
};
const readFps = () => {
  const f = window.__fps;
  cancelAnimationFrame(f.raf);
  const secs = (performance.now() - f.t0) / 1000;
  const g = f.gaps.slice(5).sort((a, b) => a - b);
  return {
    avgFps: +(f.frames / secs).toFixed(1),
    p95FrameMs: +g[Math.floor(g.length * 0.95)].toFixed(1),
    maxFrameMs: +g[g.length - 1].toFixed(1),
    over20ms: g.filter((x) => x > 20).length,
    frames: f.frames,
  };
};

async function openGame(page) {
  await page.getByRole("button", { name: /Play DESCENT/ }).focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__descent?.game, null, { timeout: 15000 });
}

const state = (page) =>
  page.evaluate(() => {
    const s = window.__descent.game;
    return { depth: Math.floor(s.depth), score: Math.floor(s.score), over: s.over, lives: s.lives };
  });

// ── Three runs with simulated input ──────────────────────────
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
watch(page);
const cdp = await ctx.newCDPSession(page);
await page.goto(`${BASE}/?nopreload=1&mode=dream&descentdebug=1&descentgod=1&descentseed=21`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.evaluate(() => localStorage.setItem("descent", JSON.stringify({ best: 0, seenControls: true })));
await page.waitForTimeout(9000);

const heap = async () => {
  await cdp.send("HeapProfiler.collectGarbage");
  await page.waitForTimeout(300);
  await cdp.send("HeapProfiler.collectGarbage");
  return (await cdp.send("Runtime.getHeapUsage")).usedSize;
};

const runs = [];
const heapBefore = await heap();
for (let run = 1; run <= 3; run++) {
  await openGame(page);
  await page.evaluate(startBot);
  await page.evaluate(startFps);
  const shots = [];
  const t0 = Date.now();
  let pending = run === 1 ? [...DEPTH_SHOTS] : [];
  // Run 1 keeps going (up to 90 s) until the deepest screenshot is taken
  while (Date.now() - t0 < RUN_SECONDS * 1000 || (pending.length && Date.now() - t0 < 90000)) {
    await page.waitForTimeout(100);
    if (!pending.length) continue;
    const st = await state(page);
    if (st.depth >= pending[0]) {
      const at = pending.shift();
      const file = `depth-${at}m.png`;
      await page.screenshot({ path: resolve(OUT, file) });
      shots.push(`${file} (at ${st.depth} m)`);
    }
  }
  const fps = await page.evaluate(readFps);
  const st = await state(page);
  await page.evaluate(() => clearInterval(window.__bot));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  const restored = await page.evaluate(() => ({
    dialogGone: !document.querySelector('[role="dialog"]'),
    scrollUnlocked: document.documentElement.style.overflow === "",
    noInert: document.querySelectorAll("body > [inert]").length === 0,
  }));
  const used = await heap();
  runs.push({ run, seconds: ((Date.now() - t0) / 1000).toFixed(0), ...st, fps, heapMB: +(used / 1048576).toFixed(2), restored, shots });
  console.log(JSON.stringify(runs[runs.length - 1]));
}

// ── Death screen (damage on) ─────────────────────────────────
const dctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const dpage = await dctx.newPage();
watch(dpage);
await dpage.goto(`${BASE}/?nopreload=1&mode=dream&descentdebug=1&descentseed=3&descentstart=1300`, { waitUntil: "domcontentloaded", timeout: 90000 });
await dpage.evaluate(() => localStorage.setItem("descent", JSON.stringify({ best: 40, seenControls: true })));
await dpage.waitForTimeout(9000);
await openGame(dpage);
await dpage.waitForFunction(() => window.__descent.game.over, null, { timeout: 60000 });
await dpage.waitForTimeout(700);
await dpage.screenshot({ path: resolve(OUT, "death.png") });
const live = await dpage.evaluate(() => document.querySelector('[aria-live="assertive"]')?.textContent);

// ── Verdict ──────────────────────────────────────────────────
const growth = runs[2].heapMB - runs[0].heapMB;
const result = {
  heapBeforeMB: +(heapBefore / 1048576).toFixed(2),
  heapAfterRunsMB: runs.map((r) => r.heapMB),
  heapGrowthRun1to3MB: +growth.toFixed(2),
  deathLive: live,
  errors,
};
console.log(JSON.stringify(result, null, 2));
const failures = [];
if (errors.length) failures.push(`${errors.length} page error(s)`);
if (growth > 3) failures.push(`heap grew ${growth.toFixed(2)} MB from run 1 to run 3`);
for (const r of runs) {
  if (!r.restored.dialogGone || !r.restored.scrollUnlocked || !r.restored.noInert) failures.push(`run ${r.run}: page not restored`);
}
if (runs[0].shots.length < DEPTH_SHOTS.length) failures.push(`only ${runs[0].shots.length} depth screenshots`);
if (!live || !/fall ended/.test(live)) failures.push("death screen not announced");
await browser.close();
if (failures.length) {
  console.error("FAIL:", failures.join("; "));
  process.exit(1);
}
console.log("PASS");
