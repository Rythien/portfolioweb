#!/usr/bin/env node
/**
 * Section shots for the WAKE page layout fixes, at 1440 and 390, in WAKE
 * and DREAM (noarchive=1 keeps the DREAM page visible).
 *
 *   node scripts/shot/wake-fixes.mjs <label> [--url=http://localhost:3000] [--only=works]
 *
 * Writes shots/wake-fixes/<label>-<mode>-<width>-<stop>.png. Each stop
 * scrolls so a section edge sits just under the header, which is where
 * header collisions show.
 */
import { firefox } from "playwright";
import { mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const label = process.argv[2] ?? "shot";
const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = arg("url", "http://localhost:3000");
const only = arg("only", "");
const outDir = resolve(__dirname, "..", "..", "shots", "wake-fixes");
mkdirSync(outDir, { recursive: true });

// [name, selector, offset from the element's top to put at the viewport top]
const STOPS = [
  ["about", "#about", -40],
  ["disciplines-a", "#disciplines", 60],
  ["disciplines-b", "#disciplines .discipline-row:nth-child(3)", -60],
  ["disciplines-end", "#disciplines .discipline-row:last-child", "end"],
  ["works", "#works article:nth-child(1) .work-panel-wrap", -140],
  ["works-2", "#works article:nth-child(2) .work-panel-wrap", -140],
  ["recognition", "#recognition", 40],
  ["contact", "#contact", -40],
  ["footer", "footer", "end"],
];

const browser = await firefox.launch({
  headless: true,
  firefoxUserPrefs: { "webgl.force-enabled": true },
});

for (const mode of ["wake", "dream"]) {
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    const q = `nopreload=1&mode=${mode}${mode === "dream" ? "&noarchive=1" : ""}`;
    await page.goto(`${base}/?${q}`, { waitUntil: "load", timeout: 120000 });
    await page.mouse.move(w - 3, h / 2);
    await page.waitForTimeout(5000);
    for (const [name, sel, off] of STOPS) {
      if (only && !name.startsWith(only)) continue;
      const y = await page.evaluate(([sel, off]) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const top = r.top + window.scrollY;
        if (off === "end") return Math.round(top + r.height - window.innerHeight + 20);
        return Math.round(top + off);
      }, [sel, off]);
      if (y == null) {
        console.log(`  ${name}: no ${sel}`);
        continue;
      }
      // Step there so scroll-triggered reveals and the crystal pose settle
      await page.evaluate((y) => {
        const l = window.__lenis;
        if (l) l.scrollTo(y, { immediate: true });
        else window.scrollTo(0, y);
      }, y);
      await page.waitForTimeout(1800);
      const file = resolve(outDir, `${label}-${mode}-${w}-${name}.png`);
      await page.screenshot({ path: file });
      console.log(`  ${file}`);
    }
    await ctx.close();
  }
}
await browser.close();
