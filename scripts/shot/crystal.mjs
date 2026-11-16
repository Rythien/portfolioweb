#!/usr/bin/env node
// Crystal finish shots (Firefox, dev server on :3000).
//   node scripts/shot/crystal.mjs <name> [mode=wake|dream] [extra query]
// Writes shots/<name>-intact.png and shots/<name>-shattered.png: the same
// frozen pose, the intact mesh vs the shards laid back together
// (crystalview=assembled), cropped to the crystal at the same zoom.
import { firefox } from "playwright";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const shots = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "shots");
const [name = "crystal", mode = "wake", extra = ""] = process.argv.slice(2);
const BASE = process.env.BASE ?? "http://localhost:3000";
const CLIP = { x: 470, y: 110, width: 780, height: 680 };

const browser = await firefox.launch({
  headless: true,
  firefoxUserPrefs: { "webgl.force-enabled": true, "webgl.disabled": false },
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
for (const view of ["intact", "shattered"]) {
  const page = await ctx.newPage();
  const q = `nopreload=1&noarchive=1&mode=${mode}&crystalfreeze=2${view === "shattered" ? "&crystalview=assembled" : ""}${extra ? "&" + extra : ""}`;
  await page.goto(`${BASE}/?${q}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(9000);
  await page.screenshot({ path: resolve(shots, `${name}-${view}.png`), clip: CLIP });
  console.log(`shots/${name}-${view}.png`);
  await page.close();
}
await browser.close();
