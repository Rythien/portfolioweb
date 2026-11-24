#!/usr/bin/env node
// The hero's orbit ring, WAKE and DREAM, at 1440x900.
//
//   node scripts/shot/orbit-ring.mjs <label> [base=http://localhost:3100] [--freeze=2] [--out=shots/orbit-ring]
//
// Edge (headless Firefox can hand screenshots a stale WebGL frame while a
// link is in flight). Frozen (crystalfreeze) so a before and an after pose
// match. Writes <label>-<mode>.png (the viewport) and <label>-<mode>-ring.png
// (a 2x crop around the crystal, where the ring passes), after waiting for
// the real glass (DREAM's links slowly) so the shot is the settled hero.
import { chromium } from "playwright";
import sharp from "sharp";
import { mkdirSync } from "fs";
import { join } from "path";

const args = process.argv.slice(2);
const label = args.find((a) => !a.startsWith("-") && !a.startsWith("http")) ?? "shot";
const BASE = args.find((a) => a.startsWith("http")) ?? "http://localhost:3100";
const freeze = args.find((a) => a.startsWith("--freeze="))?.slice(9) ?? "2";
const OUT = args.find((a) => a.startsWith("--out="))?.slice(6) ?? "shots/orbit-ring";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: "msedge", headless: true });
for (const mode of ["wake", "dream"]) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const q = `?nopreload=1&mode=${mode}${mode === "dream" ? "&noarchive=1" : ""}&crystalfreeze=${freeze}`;
  await p.goto(`${BASE}/${q}`, { waitUntil: "load" });
  await p.mouse.move(1439, 899);
  // The real glass, then a few seconds for the ring's opacity to settle
  await p.waitForFunction(() => window.__crystalBox?.() != null, null, { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(mode === "dream" ? 15000 : 6000);
  const box = await p.evaluate(() => window.__crystalBox?.() ?? null);
  const png = await p.screenshot();
  await ctx.close();
  await sharp(png).toFile(join(OUT, `${label}-${mode}.png`));
  if (box) {
    // The ring is ~2x the crystal's radius: crop 2.4x around its centre
    const cx = (box.left + box.right) / 2;
    const cy = (box.top + box.bottom) / 2;
    const r = Math.max(box.right - box.left, box.bottom - box.top) / 2;
    const half = Math.round(r * 2.4);
    const left = Math.max(0, Math.round(cx - half));
    const top = Math.max(0, Math.round(cy - half * 0.75));
    const width = Math.min(1440 - left, half * 2);
    const height = Math.min(900 - top, Math.round(half * 1.5));
    await sharp(png).extract({ left, top, width, height }).resize(width * 2, height * 2, { kernel: "nearest" }).toFile(join(OUT, `${label}-${mode}-ring.png`));
  }
  console.log(`${label}-${mode}: crystal box ${box ? JSON.stringify(Object.fromEntries(Object.entries(box).map(([k, v]) => [k, Math.round(v)]))) : "none"}`);
}
await browser.close();
