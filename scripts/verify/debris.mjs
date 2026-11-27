#!/usr/bin/env node
/**
 * Debris chips live in the hero only.
 *
 *   node scripts/verify/debris.mjs [--url=http://localhost:3000] [--modes=wake,dream]
 *
 * At 1440: hovering the hero crystal breaks it and the chips must show
 * (window.__debrisVisibility > 0.5); then at Works (where the crystal
 * breaks on scroll), mid-Works and Contact they must be gone (< 0.01).
 */
import { firefox } from "playwright";
import { launch, session } from "../_browser.mjs";

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = arg("url", "http://localhost:3000");
const modes = arg("modes", "wake,dream").split(",");

await session(async () => {
  const browser = await launch(firefox, { firefoxUserPrefs: { "webgl.force-enabled": true } });
  let failures = 0;
  const check = (ok, msg) => {
    console.log(`${ok ? "✓" : "✗"} ${msg}`);
    if (!ok) failures++;
  };
  for (const mode of modes) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const q = `nopreload=1&mode=${mode}${mode === "dream" ? "&noarchive=1" : ""}`;
    await page.goto(`${base}/?${q}`, { waitUntil: "load", timeout: 120000 });
    await page.waitForFunction(() => typeof window.__crystalBox === "function" && window.__crystalBox(), null, { timeout: 60000 });
    await page.waitForTimeout(2500);
    // Hover the crystal's centre to break it
    const b = await page.evaluate(() => window.__crystalBox());
    await page.mouse.move((b.left + b.right) / 2, (b.top + b.bottom) / 2, { steps: 8 });
    await page.waitForTimeout(2000);
    const hero = await page.evaluate(() => window.__debrisVisibility ?? 0);
    check(hero > 0.5, `${mode}: hero, crystal hovered: chips at ${hero.toFixed(2)}`);
    await page.mouse.move(1437, 450);

    for (const [name, sel, at] of [
      ["Works start", "#works", 0],
      ["mid-Works", "#works", 0.5],
      ["Contact", "#contact", 0],
    ]) {
      await page.evaluate(([sel, at]) => {
        const r = document.querySelector(sel).getBoundingClientRect();
        window.scrollTo(0, r.top + window.scrollY + r.height * at);
      }, [sel, at]);
      await page.waitForTimeout(2200);
      const v = await page.evaluate(() => window.__debrisVisibility ?? 0);
      check(v < 0.01, `${mode}: ${name}: chips at ${v.toFixed(3)}`);
    }
    await page.close();
  }
  console.log(failures ? `\nFAIL: ${failures}` : "\nPASS");
  return failures ? 1 : 0;
});
