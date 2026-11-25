#!/usr/bin/env node
// THE VOID: every attack input lands a kill.
//
//   node scripts/verify/void-input.mjs [--url=http://localhost:3000]
//
// From a cold load (no prior focus, no prior click), one drifter is put
// 20 px from the gem (through the __void test hook; the rest are parked
// far off so the room never clears), and each input path is fired the
// way a person or an automated run does it:
//   - a mouse CLICK on the drifter (down + up in one go, no hold)
//   - a J TAP (keydown + keyup in one go), facing the drifter
//   - a held J, and a held mouse button
//   - clicks in every region of the screen (corners, edges, the
//     letterbox), each must register an attack
// Each kill path asserts the drifter died and the kill counted.
// Edge (Chromium), 1280x720.
import { chromium } from "playwright";

const BASE = process.argv.find((a) => a.startsWith("--url="))?.slice(6) ?? "http://localhost:3000";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto(`${BASE}/?nopreload=1&mode=dream&dream=void`, { waitUntil: "load" });
await page.waitForFunction(() => window.__void?.count?.() > 30, null, { timeout: 30000 });
// Past the wave's arrival telegraphs
await page.waitForTimeout(1500);

let failures = 0;
const check = (ok, msg) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`);
  if (!ok) failures++;
};

/** One live drifter at (dx, dy) from the gem; the rest parked far off, still arriving. */
const stage = (dx, dy, face) =>
  page.evaluate(([dx, dy, face]) => {
    const w = window.__void.world, p = w.player;
    w.enemies.forEach((d, i) => {
      if (i === 0) Object.assign(d, { alive: true, x: p.x + dx, y: p.y + dy, arrive: 0, flash: 0, vx: 0, vy: 0 });
      else if (i === 1) Object.assign(d, { alive: true, x: -400, y: -400, arrive: 1e9 });
      else d.alive = false;
    });
    p.invuln = 5; // nothing hurts the gem during the test
    if (face) { p.faceX = face[0]; p.faceY = face[1]; }
    p.atkCd = 0;
    return { kills: w.kills, x: p.x + dx, y: p.y + dy - 6 };
  }, [dx, dy, face]);
const target = () => page.evaluate(() => window.__void.world.enemies[0].alive);
const kills = () => page.evaluate(() => window.__void.world.kills);
/** Logical -> CSS px through the game's own view. */
const toScreen = (lx, ly) =>
  page.evaluate(([lx, ly]) => {
    const c = document.querySelector(".archive-root canvas");
    const r = c.getBoundingClientRect(), k = r.width / c.width, v = window.__void.view;
    return [r.left + (v.dx + lx * v.s) * k, r.top + (v.dy + ly * v.s) * k];
  }, [lx, ly]);

// 1. Mouse click (instant down + up), aimed at the drifter
let s = await stage(20, 0, null);
let [cx, cy] = await toScreen(s.x, s.y);
await page.mouse.click(cx, cy);
await page.waitForTimeout(250);
check(!(await target()) && (await kills()) === s.kills + 1, "a mouse CLICK on a drifter kills it");

// 2. J tap, facing it (left this time)
s = await stage(-20, 0, [-1, 0]);
await page.keyboard.press("KeyJ");
await page.waitForTimeout(250);
check(!(await target()) && (await kills()) === s.kills + 1, "a J TAP kills a drifter it faces");

// 3. Held J and held mouse
s = await stage(0, 18, [0, 1]);
await page.keyboard.down("KeyJ");
await page.waitForTimeout(120);
await page.keyboard.up("KeyJ");
await page.waitForTimeout(150);
check(!(await target()), "a held J kills");
s = await stage(0, -18, null);
[cx, cy] = await toScreen(s.x, s.y);
await page.mouse.move(cx, cy);
await page.mouse.down();
await page.waitForTimeout(120);
await page.mouse.up();
await page.waitForTimeout(150);
check(!(await target()), "a held mouse button kills");

// 4. A click anywhere on screen registers an attack (aimed there)
const spots = [[0.02, 0.02], [0.5, 0.02], [0.98, 0.5], [0.5, 0.98], [0.02, 0.98], [0.3, 0.6]];
let registered = 0;
for (const [fx, fy] of spots) {
  await page.evaluate(() => { window.__void.world.player.atkCd = 0; window.__void.world.player.atkAge = 99; });
  await page.mouse.click(1280 * fx, 720 * fy);
  await page.waitForTimeout(60);
  if (await page.evaluate(() => window.__void.world.player.atkAge < 0.5)) registered++;
}
check(registered === spots.length, `clicks register everywhere on screen (${registered}/${spots.length}, incl. corners and letterbox)`);

// 5. Clicks faster than the cooldown are buffered, not dropped, and keep
// their aim: the gem faces AWAY from the drifter, so only the click's own
// aim can hit it (a buffered click once fell back to the facing)
s = await stage(20, 0, [-1, 0]);
await page.evaluate(() => { window.__void.world.player.atkCd = 0.1; });
[cx, cy] = await toScreen(s.x, s.y);
await page.mouse.click(cx, cy);
await page.waitForTimeout(300);
check(!(await target()), "a click during the last 0.1 s of cooldown still attacks when it ends");

await browser.close();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
