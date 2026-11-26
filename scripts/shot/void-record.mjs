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
// percentiles, rooms cleared, deaths and hearts. A cleared room is
// restarted with R so the take keeps playing; a death is counted.
// --size=WxH (default 1280x720).
import { chromium } from "playwright";
import { mkdirSync, renameSync, rmSync } from "fs";
import { join } from "path";
import { createVoidBot } from "./_voidbot.mjs";

const args = process.argv.slice(2);
const BASE = args.find((a) => a.startsWith("http")) ?? "http://localhost:3100";
const SECONDS = Number(args.find((a) => a.startsWith("--seconds="))?.slice(10) ?? 20);
const OUT = args.find((a) => a.startsWith("--out="))?.slice(6) ?? "shots/void";
/** --novideo: the same play without recording (frame times without the capture's cost). */
const VIDEO = !args.includes("--novideo");
/** --size=WxH: the viewport (and video) size. */
const [VW, VH] = (args.find((a) => a.startsWith("--size="))?.slice(7) ?? "1280x720").split("x").map(Number);
/** --wave=charger:4 (the game's ?voidwave test hook): film one enemy type. */
const WAVE = args.find((a) => a.startsWith("--wave="))?.slice(7) ?? "";
/** --room=2: start in that room (the game's ?voidroom test hook). */
const ROOM = args.find((a) => a.startsWith("--room="))?.slice(7) ?? "";
/** --name=step2-charger: output file stem (default step1). */
const NAME = args.find((a) => a.startsWith("--name="))?.slice(7) ?? "step1";
mkdirSync(OUT, { recursive: true });
const tmp = join(OUT, "_video");
rmSync(tmp, { recursive: true, force: true });

const browser = await chromium.launch({ channel: "msedge", headless: true });
const ctx = await browser.newContext({
  viewport: { width: VW, height: VH },
  deviceScaleFactor: 1,
  ...(VIDEO ? { recordVideo: { dir: tmp, size: { width: VW, height: VH } } } : {}),
});
const page = await ctx.newPage();
await page.goto(`${BASE}/?nopreload=1&mode=dream&dream=void${WAVE ? `&voidwave=${WAVE}` : ""}${ROOM ? `&voidroom=${ROOM}` : ""}`, { waitUntil: "load" });
await page.waitForFunction(() => window.__void?.count?.() > 30, null, { timeout: 30000 });

// Logical (480x270) -> CSS px, from the canvas's own box (integer scale, letterbox)
const toScreen = await page.evaluate(() => {
  const c = document.querySelector(".archive-root canvas");
  const r = c.getBoundingClientRect();
  const k = r.width / c.width; // device px -> CSS px
  const v = window.__void.view;
  return { s: v.s * k, dx: r.left + v.dx * k, dy: r.top + v.dy * k, w: r.width, h: r.height, scale: v.s, fill: window.__void.fill() };
});
console.log(`canvas ${toScreen.w}x${toScreen.h}, scale ${toScreen.scale}x, island fills ${(toScreen.fill * 100).toFixed(0)}% of the height`);

const bot = createVoidBot(page, { trace: args.includes("--trace") });
const t0 = Date.now();
let still = false;
while (Date.now() - t0 < SECONDS * 1000) {
  if (!still && Date.now() - t0 > SECONDS * 500) {
    still = true;
    await page.screenshot({ path: join(OUT, NAME + "-still.png") });
  }
  await bot.tick();
}
await bot.release();
const { deaths, rooms, sealTimes } = bot.stats;
const clears = bot.stats.wonAt ? 1 : 0;

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
if (video) renameSync(await video.path(), join(OUT, NAME + ".webm"));
rmSync(tmp, { recursive: true, force: true });
await browser.close();
const r = (x) => x?.toFixed(1);
console.log(VIDEO ? `recorded ${SECONDS}s -> ${join(OUT, NAME + ".webm")}` : `played ${SECONDS}s (no video)`);
console.log(`frame interval (game + browser compositing): ${stats.frames} frames, ${r(stats.fps)} fps sustained; p50 ${r(stats.p50)} ms, p95 ${r(stats.p95)}, p99 ${r(stats.p99)}, max ${r(stats.max)}; ${stats.over20} over 20 ms`);
console.log(`game work per frame (rules + draw + blit): p50 ${stats.w50.toFixed(2)} ms, p95 ${stats.w95.toFixed(2)}, p99 ${stats.w99.toFixed(2)}, max ${stats.wmax.toFixed(2)}`);
console.log(`doorways walked through ${rooms}, runs cleared ${clears}, deaths ${deaths}, kills this run ${stats.kills}, hearts left ${stats.hearts}`);
if (sealTimes.length) console.log(`seals freed ${sealTimes.length}: ${sealTimes.map((t) => t.toFixed(1) + " s").join(", ")} (game time, rising to freed)`);
