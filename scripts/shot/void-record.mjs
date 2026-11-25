#!/usr/bin/env node
// THE VOID: a 20 s recording of real play at 1440x900 (Edge), with frame
// times. A small bot plays through the real input path (keyboard and
// mouse, never the game's internals): it walks toward the nearest
// drifter, clicks to attack it (the mouse aims), and dashes away when one
// gets close. It READS the game's state through the __void hook to decide.
//
//   node scripts/shot/void-record.mjs [base=http://localhost:3100] [--seconds=20] [--out=shots/void]
//
// Writes <out>/step1.webm, <out>/step1-still.png, and prints frame-time
// percentiles, kills and hearts.
import { chromium } from "playwright";
import { mkdirSync, renameSync, rmSync } from "fs";
import { join } from "path";

const args = process.argv.slice(2);
const BASE = args.find((a) => a.startsWith("http")) ?? "http://localhost:3100";
const SECONDS = Number(args.find((a) => a.startsWith("--seconds="))?.slice(10) ?? 20);
const OUT = args.find((a) => a.startsWith("--out="))?.slice(6) ?? "shots/void";
/** --novideo: the same play without recording (frame times without the capture's cost). */
const VIDEO = !args.includes("--novideo");
mkdirSync(OUT, { recursive: true });
const tmp = join(OUT, "_video");
rmSync(tmp, { recursive: true, force: true });

const browser = await chromium.launch({ channel: "msedge", headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  ...(VIDEO ? { recordVideo: { dir: tmp, size: { width: 1440, height: 900 } } } : {}),
});
const page = await ctx.newPage();
await page.goto(`${BASE}/?nopreload=1&mode=dream&dream=void`, { waitUntil: "load" });
await page.waitForFunction(() => window.__void?.count?.() > 30, null, { timeout: 30000 });

// Logical (480x270) -> CSS px, from the canvas's own box (integer scale, letterbox)
const toScreen = await page.evaluate(() => {
  const c = document.querySelector(".archive-root canvas");
  const r = c.getBoundingClientRect();
  const s = Math.max(1, Math.floor(Math.min(r.width / 480, r.height / 270) * 1.02)); // as VoidGame
  return { s, dx: r.left + (r.width - 480 * s) / 2, dy: r.top + (r.height - 270 * s) / 2, w: r.width, h: r.height, buf: c.width + "x" + c.height };
});
console.log(`canvas box ${toScreen.w}x${toScreen.h}, buffer ${toScreen.buf}, scale ${toScreen.s}`);
const sx = (x) => toScreen.dx + x * toScreen.s;
const sy = (y) => toScreen.dy + y * toScreen.s;

const keys = new Set();
async function hold(want) {
  for (const k of keys) if (!want.has(k)) { await page.keyboard.up(k); keys.delete(k); }
  for (const k of want) if (!keys.has(k)) { await page.keyboard.down(k); keys.add(k); }
}

const t0 = Date.now();
let still = false;
let mouseDown = false;
while (Date.now() - t0 < SECONDS * 1000) {
  const s = await page.evaluate(() => {
    const w = window.__void.world;
    const p = w.player;
    const ds = w.drifters.filter((d) => d.alive && d.arrive <= 0).map((d) => [d.x, d.y]);
    return { x: p.x, y: p.y, cd: p.dashCd, ds, down: p.down };
  });
  const want = new Set();
  let near = null, nd = 1e9;
  for (const [x, y] of s.ds) {
    const d = Math.hypot(x - s.x, y - s.y);
    if (d < nd) { nd = d; near = [x, y]; }
  }
  if (near) {
    const dx = near[0] - s.x, dy = near[1] - s.y;
    // Too close: dash away, sideways from it (the i-frames carry us through if not)
    if (nd < 14 && s.cd === 0) {
      want.add(Math.abs(dx) > Math.abs(dy) ? (dy > 0 ? "KeyW" : "KeyS") : dx > 0 ? "KeyA" : "KeyD");
      await hold(want);
      await page.keyboard.press("Space");
    } else {
      // Close in to burst range, keeping a little distance
      if (nd > 22) {
        if (dx > 6) want.add("KeyD"); else if (dx < -6) want.add("KeyA");
        if (dy > 6) want.add("KeyS"); else if (dy < -6) want.add("KeyW");
      }
      // Occasionally dash in on a far one: the dash is the verb to show
      if (nd > 70 && s.cd === 0 && Math.random() < 0.15) {
        await hold(want);
        await page.keyboard.press("Space");
      }
      await hold(want);
      // Attack with the mouse, aimed at it, when in reach
      await page.mouse.move(sx(near[0]), sy(near[1] - 6));
      if (nd < 34 && !mouseDown) { await page.mouse.down(); mouseDown = true; }
      if (nd >= 34 && mouseDown) { await page.mouse.up(); mouseDown = false; }
    }
  } else {
    await hold(want);
    if (mouseDown) { await page.mouse.up(); mouseDown = false; }
  }
  if (!still && Date.now() - t0 > SECONDS * 500) {
    still = true;
    await page.screenshot({ path: join(OUT, "step1-still.png") });
  }
  await page.waitForTimeout(40);
}
await hold(new Set());
if (mouseDown) await page.mouse.up();

const stats = await page.evaluate(() => {
  const v = window.__void;
  const n = Math.min(v.count(), v.frames.length);
  const f = Array.from(v.frames.slice(0, n)).filter((x) => x > 0).sort((a, b) => a - b);
  const wk = Array.from(v.work.slice(0, n)).sort((a, b) => a - b);
  const q = (p) => f[Math.min(f.length - 1, Math.floor(p * f.length))];
  const qw = (p) => wk[Math.min(wk.length - 1, Math.floor(p * wk.length))];
  return {
    frames: f.length, p50: q(0.5), p95: q(0.95), p99: q(0.99), max: f[f.length - 1],
    over20: f.filter((x) => x > 20).length,
    fps: f.length / (f.reduce((a, b) => a + b, 0) / 1000),
    w50: qw(0.5), w95: qw(0.95), w99: qw(0.99), wmax: wk[wk.length - 1],
    kills: v.world.kills, hearts: v.world.player.hearts,
  };
});
const video = VIDEO ? page.video() : null;
await ctx.close();
if (video) renameSync(await video.path(), join(OUT, "step1.webm"));
rmSync(tmp, { recursive: true, force: true });
await browser.close();
const r = (x) => x?.toFixed(1);
console.log(VIDEO ? `recorded ${SECONDS}s -> ${join(OUT, "step1.webm")}` : `played ${SECONDS}s (no video)`);
console.log(`frame interval (game + browser compositing): ${stats.frames} frames, ${r(stats.fps)} fps sustained; p50 ${r(stats.p50)} ms, p95 ${r(stats.p95)}, p99 ${r(stats.p99)}, max ${r(stats.max)}; ${stats.over20} over 20 ms`);
console.log(`game work per frame (rules + draw + blit): p50 ${stats.w50.toFixed(2)} ms, p95 ${stats.w95.toFixed(2)}, p99 ${stats.w99.toFixed(2)}, max ${stats.wmax.toFixed(2)}`);
console.log(`kills ${stats.kills}, hearts left ${stats.hearts}`);
