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
let deaths = 0, clears = 0, rooms = 0, lastRoom = 0, wonAt = 0;
let sealFrom = null;
const sealTimes = [];
const TRACE = args.includes("--trace");
let lastHearts = 3;
while (Date.now() - t0 < SECONDS * 1000) {
  if (!still && Date.now() - t0 > SECONDS * 500) {
    still = true;
    await page.screenshot({ path: join(OUT, NAME + "-still.png") });
  }
  const s = await page.evaluate(() => {
    const w = window.__void.world;
    const p = w.player;
    // [x, y, kind, state, ax, ay]
    const ds = w.enemies.filter((d) => d.alive && d.arrive <= 0).map((d) => [d.x, d.y, d.kind, d.state, d.ax, d.ay]);
    const bs = w.bolts.filter((b) => b.alive).map((b) => [b.x, b.y, b.vx, b.vy]);
    const sl = w.seal;
    const seal = sl.state === 0 || sl.state === 7 ? null : { x: sl.x, y: sl.y, state: sl.state, rings: w.rings.filter((q) => q.alive).map((q) => [q.r, q.gapA, q.spin]) };
    return { x: p.x, y: p.y, cd: p.dashCd, ds, bs, phase: w.phase, hearts: p.hearts, open: w.doorOpen, room: w.roomIndex, moving: w.transition >= 0,
      seal, sealState: sl.state, t: w.t };
  });
  if (s.room !== lastRoom) { if (s.room > lastRoom) rooms++; lastRoom = s.room; }
  // The run cleared (or lost): fall again (R), so the take keeps playing.
  // A death is reported, not hidden, then R as well
  // Won: the run is over and the page wakes at Contact; just watch it
  if (s.phase === "won") {
    if (!wonAt) { wonAt = Date.now(); clears++; }
    await hold(new Set());
    if (mouseDown) { await page.mouse.up(); mouseDown = false; }
    await page.waitForTimeout(100);
    continue;
  }
  if (s.phase !== "play") {
    deaths++;
    await hold(new Set());
    if (mouseDown) { await page.mouse.up(); mouseDown = false; }
    await page.waitForTimeout(700); // let the card show on camera
    await page.keyboard.press("KeyR");
    continue;
  }
  if (TRACE && s.hearts < lastHearts && s.seal) {
    const sx0 = s.seal.x, sy0 = s.seal.y - 8, pd = Math.hypot(s.x - sx0, s.y - 6 - sy0);
    const near = s.bs.map(([bx, by]) => Math.hypot(bx - s.x, by - s.y + 6)).sort((a, b) => a - b)[0];
    console.log(`hurt: seal state ${s.seal.state}, gem ${pd.toFixed(0)} px from it, rings ${JSON.stringify(s.seal.rings.map(([r, g]) => [Math.round(r), +g.toFixed(2)]))}, nearest bolt ${near?.toFixed(0) ?? "-"} px, dash cd ${s.cd.toFixed(2)}`);
  }
  lastHearts = s.hearts;
  const want = new Set();
  if (s.moving) { await hold(want); await page.waitForTimeout(40); continue; }
  // Seal timing: from its rising to its freeing, in game time
  if (s.phase !== "play") sealFrom = null; // a death: that attempt does not count
  if (s.sealState === 1 && sealFrom === null) sealFrom = s.t;
  if (s.sealState === 7 && sealFrom !== null) { sealTimes.push(s.t - sealFrom); sealFrom = null; }
  if (s.seal) {
    const sx = s.seal.x, sy = s.seal.y - 8;
    const gx = s.x - sx, gy = s.y - 6 - sy, pd = Math.hypot(gx, gy);
    // A ring about to sweep over us outside its gap: dash through it, or back off
    let sting = false;
    for (const [rr, gapA] of s.seal.rings) {
      let da = Math.atan2(gy, gx) - gapA;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      if (rr < pd + 2 && pd - rr < 11 && Math.abs(da) > 0.95 / 2 - 0.08) sting = true;
    }
    if (sting) {
      // Dash ready: INWARD through the band (it travels outward, and is then
      // behind us). Cooling: outrun it outward (95 vs 34 px/s), cross later
      const inward = s.cd === 0 ? 1 : -1;
      if (gx * inward > 3) want.add("KeyA"); else if (gx * inward < -3) want.add("KeyD");
      if (gy * inward > 3) want.add("KeyW"); else if (gy * inward < -3) want.add("KeyS");
      await hold(want);
      if (s.cd === 0) await page.keyboard.press("Space");
      if (mouseDown) { await page.mouse.up(); mouseDown = false; }
      await page.waitForTimeout(30);
      continue;
    }
  }
  // Wave cleared, the doorway open: walk to it (a path over the ice tiles)
  if (s.open && s.ds.length === 0) {
    if (mouseDown) { await page.mouse.up(); mouseDown = false; }
    const step = await page.evaluate(() => {
      const w = window.__void.world, p = w.player, room = w.room, COLS = 48, ROWS = 27, T = 10;
      const start = Math.floor(p.y / T) * COLS + Math.floor(p.x / T);
      const goal = (room.door.y / T) * COLS + room.door.x / T;
      const prev = new Int32Array(COLS * ROWS).fill(-1);
      const q = [start]; prev[start] = start;
      while (q.length) { const k = q.shift(); if (k === goal || k === goal + 1) { let n = k; while (prev[n] !== start && n !== start) n = prev[n]; return { tx: (n % COLS) * T + 5, ty: Math.floor(n / COLS) * T + 5, gx: room.door.x + room.door.w / 2, gy: room.door.y + 4 }; }
        for (const n of [k - 1, k + 1, k - COLS, k + COLS]) if (n >= 0 && n < COLS * ROWS && room.ice[n] && prev[n] < 0) { prev[n] = k; q.push(n); } }
      return null; });
    if (step) {
      const near = Math.hypot(step.gx - s.x, step.gy - s.y) < 14;
      const tx = near ? step.gx : step.tx, ty = near ? step.gy : step.ty;
      if (tx - s.x > 2) want.add("KeyD"); else if (tx - s.x < -2) want.add("KeyA");
      if (ty - s.y > 2) want.add("KeyS"); else if (ty - s.y < -2) want.add("KeyW");
    }
    await hold(want);
    await page.waitForTimeout(40);
    continue;
  }
  // A charger winding up or charging along a line through us: get off the
  // line sideways (dash if it is ready). Its tell (0.4 s) is the warning
  let threat = null;
  for (const [x, y, kind, state, ax, ay] of s.ds) {
    if (kind !== 1 || (state !== 1 && state !== 2)) continue;
    const along = (s.x - x) * ax + (s.y - y) * ay;
    const perp = Math.abs((s.x - x) * ay - (s.y - y) * ax);
    if (along > -4 && along < 150 && perp < 14) threat = [ax, ay, (s.x - x) * ay - (s.y - y) * ax];
  }
  // A bolt about to hit: dash THROUGH it (toward where it came from), or sidestep
  for (const [bx, by, vx, vy] of s.bs) {
    const l = Math.hypot(vx, vy) || 1, ux = vx / l, uy = vy / l;
    const along = (s.x - bx) * ux + (s.y - 6 - by) * uy;
    const perp = Math.abs((s.x - bx) * uy - (s.y - 6 - by) * ux);
    if (along > 0 && along < 26 && perp < 9) { threat = s.cd === 0 ? [-uy, ux, 0, -ux, -uy] : [ux, uy, perp]; break; }
  }
  if (threat && threat.length === 5) {
    // Into the bolt: the dash's i-frames carry the gem through it
    const [, , , tx, ty] = threat;
    if (tx > 0.3) want.add("KeyD"); else if (tx < -0.3) want.add("KeyA");
    if (ty > 0.3) want.add("KeyS"); else if (ty < -0.3) want.add("KeyW");
    await hold(want);
    await page.keyboard.press("Space");
    if (mouseDown) { await page.mouse.up(); mouseDown = false; }
    await page.waitForTimeout(40);
    continue;
  }
  if (threat) {
    const [ax, ay, side] = threat;
    // Perpendicular to its line, on the side we already stand
    const px = side >= 0 ? ay : -ay, py = side >= 0 ? -ax : ax;
    if (px > 0.3) want.add("KeyD"); else if (px < -0.3) want.add("KeyA");
    if (py > 0.3) want.add("KeyS"); else if (py < -0.3) want.add("KeyW");
    await hold(want);
    if (s.cd === 0) await page.keyboard.press("Space");
    if (mouseDown) { await page.mouse.up(); mouseDown = false; }
    await page.waitForTimeout(40);
    continue;
  }
  // Its window: once the fan's bolts are past our post, close to the edge of
  // reach (~30 px; the burst reaches ~43) and hit; never into the muzzle
  const fanOut = s.seal && s.bs.some(([bx, by]) => Math.hypot(bx - s.seal.x, by - (s.seal.y - 8)) < 70);
  // Posts round the seal on the side we already stand (never through its body)
  const around = (d) => {
    const ax = s.x - s.seal.x, ay = s.y - (s.seal.y - 2);
    const l = Math.hypot(ax, ay) || 1;
    return [s.seal.x + (ax / l) * d, s.seal.y - 2 + (ay / l) * d];
  };
  if (s.seal && s.seal.state === 5 && !fanOut) {
    const [tx, ty] = around(28);
    if (tx - s.x > 3) want.add("KeyD"); else if (tx - s.x < -3) want.add("KeyA");
    if (ty - s.y > 3) want.add("KeyS"); else if (ty - s.y < -3) want.add("KeyW");
    await hold(want);
    await page.mouse.move(sx(s.seal.x), sy(s.seal.y - 10));
    if (Math.hypot(tx - s.x, ty - s.y) < 16) { await page.mouse.down(); await page.mouse.up(); }
    await page.waitForTimeout(30);
    continue;
  }
  if (s.seal && s.ds.length === 0) {
    // A post ~60 px out: a ring gives over a second's notice, the fan room to read.
    // With a ring coming, circle the post to where its GAP will be when it
    // arrives (gap angle + spin x arrival time): it passes us through the gap
    let [tx, ty] = around(58);
    const gx0 = s.x - s.seal.x, gy0 = s.y - 6 - (s.seal.y - 8), pd0 = Math.hypot(gx0, gy0);
    let next = null;
    for (const [rr, gapA, spin] of s.seal.rings) if (rr < pd0 && (!next || rr > next[0])) next = [rr, gapA, spin];
    if (next) {
      const ta = next[1] + next[2] * Math.max(0, (pd0 - next[0]) / 34);
      tx = s.seal.x + Math.cos(ta) * 58;
      ty = s.seal.y - 2 + Math.sin(ta) * 58;
    }
    if (tx - s.x > 4) want.add("KeyD"); else if (tx - s.x < -4) want.add("KeyA");
    if (ty - s.y > 4) want.add("KeyS"); else if (ty - s.y < -4) want.add("KeyW");
    await hold(want);
    if (mouseDown) { await page.mouse.up(); mouseDown = false; }
    await page.waitForTimeout(30);
    continue;
  }
  let near = null, nd = 1e9;
  for (const [x, y, kind, state] of s.ds) {
    // A recovering charger is the opening: go for it first
    const d = Math.hypot(x - s.x, y - s.y) - (kind === 1 && state === 3 ? 40 : 0);
    if (d < nd) { nd = d; near = [x, y]; }
  }
  if (near) nd = Math.hypot(near[0] - s.x, near[1] - s.y);
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
if (video) renameSync(await video.path(), join(OUT, NAME + ".webm"));
rmSync(tmp, { recursive: true, force: true });
await browser.close();
const r = (x) => x?.toFixed(1);
console.log(VIDEO ? `recorded ${SECONDS}s -> ${join(OUT, NAME + ".webm")}` : `played ${SECONDS}s (no video)`);
console.log(`frame interval (game + browser compositing): ${stats.frames} frames, ${r(stats.fps)} fps sustained; p50 ${r(stats.p50)} ms, p95 ${r(stats.p95)}, p99 ${r(stats.p99)}, max ${r(stats.max)}; ${stats.over20} over 20 ms`);
console.log(`game work per frame (rules + draw + blit): p50 ${stats.w50.toFixed(2)} ms, p95 ${stats.w95.toFixed(2)}, p99 ${stats.w99.toFixed(2)}, max ${stats.wmax.toFixed(2)}`);
console.log(`doorways walked through ${rooms}, runs cleared ${clears}, deaths ${deaths}, kills this run ${stats.kills}, hearts left ${stats.hearts}`);
if (sealTimes.length) console.log(`seals freed ${sealTimes.length}: ${sealTimes.map((t) => t.toFixed(1) + " s").join(", ")} (game time, rising to freed)`);
