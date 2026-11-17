#!/usr/bin/env node
/**
 * Hero at a frozen pose, for before/after comparisons of the crystal's
 * look (lighting, material): every load renders the same rotation, logo
 * and marquee (crystalfreeze), so two runs differ only by the change.
 *
 *   node scripts/shot/hero-pose.mjs <label> [--url=http://localhost:3000]
 *        [--freeze=2] [--modes=wake,dream] [--widths=1440,390]
 *
 * Writes shots/hero-pose/<label>-<mode>-<width>.png (viewport) and
 * <label>-<mode>-<width>-crop.png (the crystal's projected box + margin).
 */
import { firefox } from "playwright";
import { mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const label = process.argv[2] ?? "pose";
const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = arg("url", "http://localhost:3000");
const freeze = arg("freeze", "2");
const modes = arg("modes", "wake,dream").split(",");
const widths = arg("widths", "1440,390").split(",").map(Number);
const outDir = resolve(__dirname, "..", "..", "shots", "hero-pose");
mkdirSync(outDir, { recursive: true });

const browser = await firefox.launch({ headless: true, firefoxUserPrefs: { "webgl.force-enabled": true } });
for (const mode of modes) {
  for (const w of widths) {
    const h = w < 768 ? 844 : 900;
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    // Mouse parked in the corner: the crystal tilts toward the cursor
    await page.mouse.move(w - 1, h - 1);
    await page.goto(`${base}/?nopreload=1&noarchive=1&mode=${mode}&crystalfreeze=${freeze}`, { waitUntil: "load", timeout: 120000 });
    await page.mouse.move(w - 1, h - 1);
    await page.waitForFunction(() => window.__crystalBox?.(), null, { timeout: 60000 });
    await page.waitForTimeout(8000);
    await page.screenshot({ path: resolve(outDir, `${label}-${mode}-${w}.png`) });
    const b = await page.evaluate(() => window.__crystalBox());
    const m = 40;
    const clip = {
      x: Math.max(0, Math.round(b.left - m)),
      y: Math.max(0, Math.round(b.top - m)),
    };
    clip.width = Math.min(w - clip.x, Math.round(b.right - b.left + 2 * m));
    clip.height = Math.min(h - clip.y, Math.round(b.bottom - b.top + 2 * m));
    await page.screenshot({ path: resolve(outDir, `${label}-${mode}-${w}-crop.png`), clip });
    console.log(`  ${label}-${mode}-${w} (crop ${JSON.stringify(clip)})`);
    await page.close();
  }
}
await browser.close();
