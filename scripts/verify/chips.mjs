#!/usr/bin/env node
/**
 * Fragments stay in the hero: no crystal shard and no Debris chip may be
 * visible anywhere outside it.
 *
 *   node scripts/verify/chips.mjs [--url=http://localhost:3000] [--modes=wake,dream] [--widths=1440,390]
 *
 * Hooks: window.__crystalShards (shards drawn this frame, GlassCrystal) and
 * window.__debrisVisibility (Debris chip opacity). Steps down the page in
 * half-screens to the footer; at every step where the hero no longer
 * covers the viewport, the pointer is parked on the crystal (trying to
 * break it) and both hooks must read zero. Control at 1440: hovering the
 * crystal in the hero must still break it.
 */
import { firefox } from "playwright";

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = arg("url", "http://localhost:3000");
const modes = arg("modes", "wake,dream").split(",");
const widths = arg("widths", "1440,390").split(",").map(Number);

const browser = await firefox.launch({ headless: true, firefoxUserPrefs: { "webgl.force-enabled": true } });
let failures = 0;
const check = (ok, msg) => {
  console.log(`${ok ? "✓" : "✗"} ${msg}`);
  if (!ok) failures++;
};
const read = (page) =>
  page.evaluate(() => ({
    shards: window.__crystalShards ?? 0,
    debris: window.__debrisVisibility ?? 0,
  }));

for (const width of widths) {
  for (const mode of modes) {
    const height = width < 768 ? 844 : 900;
    const page = await browser.newPage({ viewport: { width, height } });
    const q = `nopreload=1&mode=${mode}${mode === "dream" ? "&noarchive=1" : ""}`;
    await page.goto(`${base}/?${q}`, { waitUntil: "load", timeout: 120000 });
    await page.waitForFunction(() => typeof window.__crystalBox === "function" && window.__crystalBox(), null, { timeout: 60000 });
    await page.waitForTimeout(2500);
    const tag = `${width} ${mode}`;

    if (width >= 768) {
      const b = await page.evaluate(() => window.__crystalBox());
      await page.mouse.move((b.left + b.right) / 2, (b.top + b.bottom) / 2, { steps: 8 });
      await page.waitForTimeout(1800);
      const h = await read(page);
      check(h.shards > 0 || h.debris > 0.5, `${tag}: control, hero hover breaks it (shards ${h.shards}, debris ${h.debris.toFixed(2)})`);
      await page.mouse.move(width - 3, height / 2);
      await page.waitForTimeout(1500);
    }

    const total = await page.evaluate(() => document.documentElement.scrollHeight);
    let worst = { at: -1, shards: 0, debris: 0 };
    let samples = 0;
    for (let y = 0; y <= total; y += Math.round(height / 2)) {
      await page.evaluate((y) => window.scrollTo(0, y), y);
      await page.waitForTimeout(450);
      const heroOut = await page.evaluate(() => document.getElementById("top").getBoundingClientRect().bottom < innerHeight * 0.15);
      if (!heroOut) continue;
      // Try to break whatever crystal is still on screen
      const b = await page.evaluate(() => (window.__crystalBox ? window.__crystalBox() : null));
      if (b && b.right > b.left) {
        await page.mouse.move((b.left + b.right) / 2, (b.top + b.bottom) / 2, { steps: 3 });
      }
      await page.waitForTimeout(900);
      const r = await read(page);
      samples++;
      if (r.shards > worst.shards || r.debris > worst.debris) worst = { at: y, ...r };
    }
    check(
      worst.shards === 0 && worst.debris < 0.01,
      `${tag}: outside the hero over ${samples} positions: shards ${worst.shards}, debris ${worst.debris.toFixed(3)}${worst.at >= 0 ? ` (worst at y=${worst.at})` : ""}`
    );
    await page.close();
  }
}
await browser.close();
console.log(failures ? `\nFAIL: ${failures}` : "\nPASS");
process.exit(failures ? 1 : 0);
