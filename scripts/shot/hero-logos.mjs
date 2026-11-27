#!/usr/bin/env node
// Hero logo cycle and shard logos, real time (Firefox, dev server on :3000).
//   node scripts/shot/hero-logos.mjs [wake|dream]
// shots/hero-logo-{0,4,8}s-<mode>.png: the hero at 0 / 4 / 8 s of cycling
// shots/shard-logos-<mode>.png: crystal broken by hovering it
import { firefox } from "playwright";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { launch, session } from "../_browser.mjs";

const shots = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "shots");
const mode = process.argv[2] ?? "wake";
const BASE = process.env.BASE ?? "http://localhost:3000";
const CLIP = { x: 470, y: 110, width: 780, height: 680 };

await session(async () => {
  const browser = await launch(firefox, {
    firefoxUserPrefs: { "webgl.force-enabled": true, "webgl.disabled": false },
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/?nopreload=1&noarchive=1&mode=${mode}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(8000);
  const t0 = Date.now();
  for (const s of [0, 4, 8]) {
    const wait = t0 + s * 1000 - Date.now();
    if (wait > 0) await page.waitForTimeout(wait);
    await page.screenshot({ path: resolve(shots, `hero-logo-${s}s-${mode}.png`), clip: CLIP });
    console.log(`shots/hero-logo-${s}s-${mode}.png`);
  }
  // Broken: hovering the crystal fractures it (hover-break)
  await page.mouse.move(700, 450);
  await page.waitForTimeout(300);
  await page.mouse.move(860, 440, { steps: 8 });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: resolve(shots, `shard-logos-${mode}.png`) });
  console.log(`shots/shard-logos-${mode}.png`);
});
