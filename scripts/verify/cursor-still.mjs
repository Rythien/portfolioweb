#!/usr/bin/env node
/**
 * The hero must not move with the cursor. At a frozen pose (crystalfreeze
 * also pins the broken shards' drift), the cursor sweeps the hero and
 * each frame is compared with the first, pixel for pixel.
 *
 *   node scripts/verify/cursor-still.mjs [--url=http://localhost:3000]
 *        [--modes=wake,dream] [--widths=1440,390]
 *
 * Two sweeps per mode and width:
 *  - off: a grid of points around the crystal (it stays whole);
 *  - on: points inside the crystal's hover zone, after it has broken and
 *    settled (the shards used to follow the cursor and drag the
 *    refracted headline with them).
 * Each sample waits for the ink brush trail (TRAIL_DECAY 1.2 s) to fade:
 * the trail is the WAKE/DREAM reveal, painted where the cursor passed, and
 * the two headlines sit in the same place, so nothing moves under it.
 * Ignored in the comparison: a circle around the cursor (the cursor gem,
 * its sparkles and the brush under a resting cursor follow the pointer by
 * design; the DOM cursor is hidden), the header band and the mode pill
 * (magnetic controls, not type), live HH:MM clocks (a minute can roll over
 * mid-run), and any pixel that also changes with the
 * cursor parked (the control, reported as "noise"). Any other changed
 * pixel fails.
 */
import { firefox } from "playwright";
import sharp from "sharp";

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = arg("url", "http://localhost:3000");
const modes = arg("modes", "wake,dream").split(",");
const widths = arg("widths", "1440,390").split(",").map(Number);

const GEM_MASK = 200; // px around the cursor: the gem plus its sparkles, which drift ~100 px above it
const HEADER = 96; // px band at the top
const TOL = 2; // per-channel difference treated as equal
const SETTLE = 6500; // ms: the brush trail fades below TOL

async function raw(page) {
  const buf = await page.screenshot();
  const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

/** Changed pixels outside the masks; returns count and their bounding box. */
function diff(a, b, cursors, skip = [], noise = null) {
  let n = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let y = HEADER; y < a.h; y++) {
    for (let x = 0; x < a.w; x++) {
      if (cursors.some((c) => (x - c.x) ** 2 + (y - c.y) ** 2 < GEM_MASK ** 2)) continue;
      if (skip.some((r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom)) continue;
      if (noise?.[y * a.w + x]) continue;
      const i = (y * a.w + x) * 3;
      if (
        Math.abs(a.data[i] - b.data[i]) > TOL ||
        Math.abs(a.data[i + 1] - b.data[i + 1]) > TOL ||
        Math.abs(a.data[i + 2] - b.data[i + 2]) > TOL
      ) {
        n++;
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      }
    }
  }
  return { n, box: n ? [x0, y0, x1, y1] : null };
}

const browser = await firefox.launch({ headless: true, firefoxUserPrefs: { "webgl.force-enabled": true } });
let failed = 0;
for (const mode of modes) {
  for (const w of widths) {
    const h = w < 768 ? 844 : 900;
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const park = { x: w - 2, y: h - 2 };
    await page.mouse.move(park.x, park.y);
    await page.goto(`${base}/?nopreload=1&noarchive=1&mode=${mode}&crystalfreeze=2`, { waitUntil: "load", timeout: 120000 });
    await page.addStyleTag({ content: ".z-\\[9999\\]{opacity:0!important}" });
    await page.waitForFunction(() => window.__crystalBox?.(), null, { timeout: 60000 });
    await page.waitForTimeout(mode === "dream" ? 15000 : 8000);
    const b = await page.evaluate(() => window.__crystalBox());
    // The floating mode pill is a magnetic control: leave it out
    const pill = await page.evaluate(() => {
      const r = document.querySelector(".mode-pill")?.getBoundingClientRect();
      return r && r.width ? { left: r.left - 90, right: r.right + 90, top: r.top - 90, bottom: r.bottom + 90 } : null;
    });
    // Live HH:MM clocks tick on their own (a minute can roll over mid-run)
    const clocks = await page.evaluate(() =>
      [...document.querySelectorAll("body *")]
        .filter((el) => el.childElementCount === 0 && /^\d\d:\d\d$/.test(el.textContent.trim()))
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.width && r.height)
        .map((r) => ({ left: r.left - 4, right: r.right + 4, top: r.top - 4, bottom: r.bottom + 4 })),
    );
    const skip = [...(pill ? [pill] : []), ...clocks];
    const cx = (b.left + b.right) / 2, cy = (b.top + b.bottom) / 2;
    const hw = (b.right - b.left) / 2, hh = (b.bottom - b.top) / 2;
    const tag = `${mode} ${w}`;

    // Control: the cursor parked, what changes on its own
    await page.mouse.move(park.x, park.y);
    await page.waitForTimeout(SETTLE);
    const ref = await raw(page);
    const noise = new Uint8Array(ref.w * ref.h);
    for (let k = 0; k < 4; k++) {
      await page.waitForTimeout(1500);
      const f = await raw(page);
      for (let j = 0; j < noise.length; j++) {
        const i = j * 3;
        if (Math.abs(f.data[i] - ref.data[i]) > TOL || Math.abs(f.data[i + 1] - ref.data[i + 1]) > TOL || Math.abs(f.data[i + 2] - ref.data[i + 2]) > TOL) noise[j] = 1;
      }
    }
    const noisy = noise.reduce((a, v) => a + v, 0);
    let worst = { n: 0 };
    let points = 0;
    for (const fy of [0.35, 0.6]) {
      for (const fx of [0.05, 0.25, 0.5, 0.75, 0.95]) {
        const p = { x: Math.round(fx * w), y: Math.round(fy * h) };
        if (Math.abs(p.x - cx) < hw * 1.6 && Math.abs(p.y - cy) < hh * 1.6) continue;
        await page.mouse.move(p.x, p.y, { steps: 4 });
        await page.waitForTimeout(SETTLE);
        const d = diff(ref, await raw(page), [park, p], skip, noise);
        points++;
        if (d.n > worst.n) worst = { ...d, at: p };
      }
    }
    const offOk = worst.n === 0;
    console.log(`${offOk ? "PASS" : "FAIL"} ${tag} off-crystal: ${points} cursor points, noise ${noisy} px, ${worst.n} moved px${worst.n ? ` (worst at ${JSON.stringify(worst.at)}, box ${worst.box})` : ""}`);

    // On the crystal: break it, let it settle, then move inside the zone
    const start = { x: Math.round(cx), y: Math.round(cy) };
    await page.mouse.move(start.x, start.y, { steps: 6 });
    await page.waitForTimeout(SETTLE);
    // The break can finish settling late (one shard's cloud repaints once,
    // seconds after the burst, with the cursor still): wait for two equal
    // frames before taking the reference
    let ref2 = await raw(page);
    for (let k = 0; k < 8; k++) {
      await page.waitForTimeout(1500);
      const f = await raw(page);
      const same = diff(ref2, f, [start], skip, noise).n === 0;
      ref2 = f;
      if (same) break;
    }
    worst = { n: 0 };
    const inside = [[-0.3, 0], [0.3, 0], [0, -0.3], [0, 0.3]];
    for (const [ox, oy] of inside) {
      const p = { x: Math.round(cx + ox * hw), y: Math.round(cy + oy * hh) };
      await page.mouse.move(p.x, p.y, { steps: 4 });
      await page.waitForTimeout(SETTLE);
      const d = diff(ref2, await raw(page), [start, p], skip, noise);
      if (d.n > worst.n) worst = { ...d, at: p };
    }
    const broke = await page.evaluate(() => document.body.innerText.includes("BREAK"));
    const onOk = worst.n === 0;
    console.log(`${onOk ? "PASS" : "FAIL"} ${tag} on-crystal: ${inside.length} cursor points, ${worst.n} moved px${worst.n ? ` (worst at ${JSON.stringify(worst.at)}, box ${worst.box})` : ""}${broke ? "" : " [cursor label not seen]"}`);
    if (!offOk || !onOk) failed++;
    await page.close();
  }
}
await browser.close();
process.exit(failed ? 1 : 0);
