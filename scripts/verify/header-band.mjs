#!/usr/bin/env node
/**
 * No page content may be legible through the header.
 *
 *   node scripts/verify/header-band.mjs [--url=http://localhost:3000]
 *        [--widths=1440,390] [--modes=wake,dream] [--step=0.33]
 *
 * Scrolls the whole page in steps of `step` viewports (from 41px, where
 * the backdrop switches on, to the bottom). At each stop it screenshots the
 * header band (the nav row, plus the section strip below lg) and blanks
 * out the header's and strip's own items. Every remaining pixel must match
 * its column's median within TOL: the band is flat page colour, except the
 * grid overlay's vertical rules, which are constant down a column. Copy
 * showing through would vary down the column and fail. Exit code 1 on any
 * failure; failing bands are saved to shots/header-band/.
 */
import { firefox } from "playwright";
import sharp from "sharp";
import { mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = arg("url", "http://localhost:3000");
const widths = arg("widths", "1440,390").split(",").map(Number);
const modes = arg("modes", "wake,dream").split(",");
const stepVh = Number(arg("step", "0.33"));
const TOL = 10;
/** Pixels over TOL allowed per band (antialiasing at masked item edges). */
const MAX_BAD = 12;
const outDir = resolve(__dirname, "..", "..", "shots", "header-band");
mkdirSync(outDir, { recursive: true });

const browser = await firefox.launch({
  headless: true,
  firefoxUserPrefs: { "webgl.force-enabled": true },
});

let failures = 0;
for (const mode of modes) {
  for (const w of widths) {
    const h = w < 768 ? 844 : 900;
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    const q = `nopreload=1&mode=${mode}${mode === "dream" ? "&noarchive=1" : ""}`;
    await page.goto(`${base}/?${q}`, { waitUntil: "load", timeout: 120000 });
    await page.mouse.move(w / 2, h - 4);
    await page.waitForTimeout(3000);

    // The solid part of the backdrop: nav row on desktop, nav + strip below lg
    // (107, not 108, below lg: the bottom row is the strip's own 1px rule)
    const band = w >= 1024 ? 64 : 107;
    const max = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    let checked = 0;
    for (let y = 41; y <= max; y += Math.round(h * stepVh)) {
      await page.evaluate((y) => window.scrollTo(0, y), y);
      await page.waitForTimeout(450);
      // The header's own items and the strip's label/line are allowed
      const holes = await page.evaluate((band) => {
        const sel = "header a, header button, header nav, header [aria-live], [data-rail-strip] > *";
        return [...document.querySelectorAll(sel)]
          .map((el) => el.getBoundingClientRect())
          .filter((r) => r.width > 0 && r.top < band)
          .map((r) => [r.left - 6, r.top - 6, r.right + 6, r.bottom + 6].map(Math.round));
      }, band);
      const png = await page.screenshot({ clip: { x: 0, y: 0, width: w, height: band } });
      const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const inHole = (x, yy) => holes.some(([l, t, r, b]) => x >= l && x <= r && yy >= t && yy <= b);
      let bad = 0;
      let worst = 0;
      for (let x = 0; x < info.width; x++) {
        const col = [];
        for (let yy = 0; yy < info.height; yy++) {
          if (inHole(x, yy)) continue;
          const i = (yy * info.width + x) * 3;
          col.push([data[i], data[i + 1], data[i + 2]]);
        }
        if (col.length < 4) continue;
        const med = [0, 1, 2].map((c) => col.map((p) => p[c]).sort((a, b) => a - b)[col.length >> 1]);
        for (const p of col) {
          const d = Math.max(Math.abs(p[0] - med[0]), Math.abs(p[1] - med[1]), Math.abs(p[2] - med[2]));
          if (d > worst) worst = d;
          if (d > TOL) bad++;
        }
      }
      checked++;
      if (bad > MAX_BAD) {
        failures++;
        const file = resolve(outDir, `fail-${mode}-${w}-${y}.png`);
        await sharp(png).toFile(file);
        console.log(`✗ ${mode} ${w}px y=${y}: ${bad} px differ from their column (worst ${worst})  ${file}`);
      }
    }
    console.log(`${failures ? "…" : "✓"} ${mode} ${w}px: ${checked} scroll positions checked`);
    await ctx.close();
  }
}
await browser.close();
console.log(failures ? `\nFAIL: content legible through the header at ${failures} position(s)` : "\nPASS: nothing shows through the header band");
process.exit(failures ? 1 : 0);
