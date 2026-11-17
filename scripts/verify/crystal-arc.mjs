#!/usr/bin/env node
/**
 * The hero -> parked crystal move, measured frame by frame.
 *
 *   node scripts/verify/crystal-arc.mjs [--url=http://localhost:3000]
 *        [--mode=wake] [--seconds=4.5] [--json=out.json]
 *
 * Scrolls with real wheel events (through Lenis, as a visitor does) at a
 * steady pace from the hero to Disciplines, then holds still for 2 s.
 * Every animation frame it records the crystal's projected box
 * (window.__crystalBox) and, when the build has it, the pose
 * (window.__crystalPose: x, y, scale, rotY, u).
 *
 * Reports, from the box alone (so it also runs on older builds):
 *   lurch: peak acceleration of the box centre and of its width, in
 *          px/s^2 after light smoothing; lower is a smoother arc.
 * And from the pose, when present (fails on a miss):
 *   order: position reaches half its travel before scale does, and the
 *          spin settles last;
 *   landing: after the scroll stops, position overshoots its resting
 *          value by < 1% of its travel, scale by <= 4% (target ~3%).
 */
import { firefox } from "playwright";
import { writeFileSync } from "fs";

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = arg("url", "http://localhost:3000");
const mode = arg("mode", "wake");
const seconds = Number(arg("seconds", "4.5"));
const jsonOut = arg("json", "");
/** --reduced: prefers-reduced-motion. Then the crystal must never be seen
 * travelling: whenever it is more than faintly visible it sits exactly at
 * the hero pose or the parked pose. */
const reduced = process.argv.includes("--reduced");

const browser = await firefox.launch({ headless: true, firefoxUserPrefs: { "webgl.force-enabled": true } });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: reduced ? "reduce" : "no-preference" });
await page.goto(`${base}/?nopreload=1&mode=${mode}${mode === "dream" ? "&noarchive=1" : ""}${process.env.EXTRA_QUERY ? "&" + process.env.EXTRA_QUERY : ""}`, { waitUntil: "load", timeout: 120000 });
await page.mouse.move(1439, 899);
await page.waitForFunction(() => window.__crystalBox?.(), null, { timeout: 60000 });
await page.waitForTimeout(3500);

const target = await page.evaluate(() => {
  const d = document.getElementById("disciplines").getBoundingClientRect();
  return Math.round(d.top + window.scrollY + 120);
});

await page.evaluate(() => {
  window.__arc = [];
  const t0 = performance.now();
  const tick = () => {
    const b = window.__crystalBox?.();
    const p = window.__crystalPose?.();
    window.__arc.push({
      t: (performance.now() - t0) / 1000,
      y: window.scrollY,
      cx: b ? (b.left + b.right) / 2 : null,
      cy: b ? (b.top + b.bottom) / 2 : null,
      w: b ? b.right - b.left : null,
      px: p?.x, py: p?.y, ps: p?.scale, rot: p?.rotY, u: p?.u, fade: p?.fade,
    });
    if (window.__arcRun) requestAnimationFrame(tick);
  };
  window.__arcRun = true;
  requestAnimationFrame(tick);
});

// Steady wheel: equal ticks at a fixed interval
const TICK_MS = 40;
const ticks = Math.round((seconds * 1000) / TICK_MS);
const step = target / ticks;
const scrollStart = await page.evaluate(() => performance.now());
for (let i = 0; i < ticks; i++) {
  await page.mouse.wheel(0, step);
  await page.waitForTimeout(TICK_MS);
}
const scrollEnd = await page.evaluate(() => performance.now());
await page.waitForTimeout(2000);
const arc = await page.evaluate(() => {
  window.__arcRun = false;
  return window.__arc;
});
const stopT = (scrollEnd - scrollStart) / 1000 + (arc.length ? 0 : 0);
await browser.close();
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(arc));

// ── Analysis ────────────────────────────────────────────────────────
const rows = arc.filter((r) => r.cx !== null);
// Lurch, in the scroll domain (headless frame timing is too uneven for
// time derivatives): the most the crystal moves per px of scroll, over
// any WINDOW px of scroll. A move spread evenly over the segment stays
// low; one that happens in a burst spikes.
const WINDOW = 60;
const perScroll = (key) => {
  let peak = 0;
  let at = 0;
  for (let i = 0, j = 0; i < rows.length; i++) {
    while (j < rows.length && rows[j].y - rows[i].y < WINDOW) j++;
    if (j >= rows.length) break;
    const r = Math.abs(rows[j][key] - rows[i][key]) / (rows[j].y - rows[i].y);
    if (r > peak) { peak = r; at = rows[i].y; }
  }
  return [peak, at];
};
const [lx, lxAt] = perScroll("cx");
const [lw, lwAt] = perScroll("w");
const totalX = Math.abs(rows.at(-1).cx - rows[0].cx);
console.log(`frames ${rows.length} over ${rows.at(-1)?.t.toFixed(2)} s, scrolled to ${rows.at(-1)?.y}px`);
console.log(`lurch: centre moves up to ${lx.toFixed(2)} px per px of scroll (at ${Math.round(lxAt)}px), width ${lw.toFixed(2)} (at ${Math.round(lwAt)}px); total x travel ${Math.round(totalX)} px`);

let failures = 0;
const posed = rows.filter((r) => typeof r.px === "number");
if (reduced) {
  // Only two poses may ever be seen: hero (first) and parked (last). The
  // copy clamp may still shrink it, so compare position only, while visible
  const hero = posed[0];
  const parked = posed.at(-1);
  const seen = posed.filter((r) => r.fade > 0.15);
  const between = seen.filter((r) => Math.abs(r.px - hero.px) > 0.01 && Math.abs(r.px - parked.px) > 0.01);
  const spins = new Set(posed.map((r) => r.rot.toFixed(3))).size;
  console.log(`reduced: ${seen.length} visible frames, ${between.length} between the two poses; ${spins} distinct rotation(s)`);
  if (between.length) { failures++; console.log(`✗ the crystal is seen travelling (e.g. x ${between[0].px.toFixed(2)} at ${Math.round(between[0].y)}px)`); }
  if (spins > 1) { failures++; console.log("✗ the crystal spins under reduced motion"); }
  const dipped = posed.some((r) => r.fade < 0.05) && posed.at(-1).fade > 0.9;
  if (!dipped) { failures++; console.log("✗ expected a fade out and back in around the swap"); }
  console.log(failures ? `\nFAIL: ${failures}` : "\nPASS");
  process.exit(failures ? 1 : 0);
}
if (posed.length) {
  const first = posed[0];
  const last = posed.at(-1);
  const half = (key) => {
    const a = first[key], b = last[key];
    const mid = (a + b) / 2;
    const i = posed.findIndex((r) => (b > a ? r[key] >= mid : r[key] <= mid));
    return i < 0 ? null : posed[i].t;
  };
  const tX = half("px");
  const tS = half("ps");
  // Spin settled: |d rot / dt| under 0.02 rad/s from then on
  let tRot = null;
  for (let i = posed.length - 2; i > 0; i--) {
    const v = Math.abs((posed[i + 1].rot - posed[i].rot) / Math.max(1e-3, posed[i + 1].t - posed[i].t));
    if (v > 0.02) { tRot = posed[i + 1].t; break; }
  }
  console.log(`order: position half-way at ${tX?.toFixed(2)} s, scale at ${tS?.toFixed(2)} s, spin settled at ${tRot?.toFixed(2)} s`);
  if (!(tX !== null && tS !== null && tX < tS)) { failures++; console.log("✗ position should lead scale"); }
  if (!(tRot !== null && tS !== null && tRot > tS)) { failures++; console.log("✗ the spin should settle last"); }

  // Landing, from when the scroll stopped
  const after = posed.filter((r) => r.t >= stopT);
  const settled = last;
  const travel = (key) => Math.abs(settled[key] - first[key]) || 1;
  const over = (key) => {
    const dir = Math.sign(settled[key] - first[key]);
    let worst = 0;
    for (const r of after) worst = Math.max(worst, dir * (r[key] - settled[key]));
    return worst / travel(key);
  };
  const ox = over("px");
  const os = over("ps");
  console.log(`landing: position overshoot ${(ox * 100).toFixed(2)}% of travel, scale ${(os * 100).toFixed(2)}%`);
  if (ox > 0.01) { failures++; console.log("✗ position overshoots"); }
  if (os > 0.04) { failures++; console.log("✗ scale overshoots more than ~3%"); }
  const off = (((settled.rot - 0.3) % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2);
  const restErr = Math.min(off, Math.PI / 2 - off);
  console.log(`rest: rotY ${settled.rot.toFixed(3)} rad, ${restErr.toFixed(3)} rad from a resting angle (0.3 + k pi/2)`);
  if (restErr > 0.02) { failures++; console.log("✗ the crystal should come to rest on a resting angle"); }
} else {
  console.log("(no __crystalPose in this build: box metrics only)");
}
console.log(failures ? `\nFAIL: ${failures}` : "\nPASS");
process.exit(failures ? 1 : 0);
