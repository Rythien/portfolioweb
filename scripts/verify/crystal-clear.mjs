#!/usr/bin/env node
/**
 * The hero crystal must never cover the About / Disciplines copy.
 *
 *   node scripts/verify/crystal-clear.mjs [--url=http://localhost:3000]
 *        [--widths=1440,1280,1024,390] [--modes=wake,dream] [--steps=10]
 *
 * For each width and mode it scrolls to 10 evenly spaced positions from
 * About entering the viewport to Disciplines leaving it, lets the damped
 * pose settle, and compares the crystal's on-screen bounding box
 * (window.__crystalBox: every vertex of the visible glass projected through
 * the scene camera) with the client rects of every line of text in #about
 * and #disciplines. Any intersection fails, and a screenshot of it is saved
 * to shots/crystal-clear/. Exit code 1 on failure.
 */
import { firefox } from "playwright";
import { mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { launch, session } from "../_browser.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = arg("url", "http://localhost:3000");
const widths = arg("widths", "1440,1280,1024,390").split(",").map(Number);
const modes = arg("modes", "wake,dream").split(",");
const steps = Number(arg("steps", "10"));
const SETTLE_MS = 1600;
const outDir = resolve(__dirname, "..", "..", "shots", "crystal-clear");
mkdirSync(outDir, { recursive: true });

await session(async () => {
  const browser = await launch(firefox, {
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
      // The cursor sits off the copy and does not hover anything
      await page.mouse.move(w - 2, h - 2);
      await page.waitForFunction(() => typeof window.__crystalBox === "function", null, { timeout: 60000 });
      await page.waitForTimeout(3000);

      const [from, to] = await page.evaluate(() => {
        const a = document.getElementById("about").getBoundingClientRect();
        const d = document.getElementById("disciplines").getBoundingClientRect();
        const y = window.scrollY;
        return [a.top + y - window.innerHeight, d.bottom + y];
      });

      let seen = 0;
      for (let i = 0; i < steps; i++) {
        const y = Math.round(from + ((to - from) * (i + 0.5)) / steps);
        await page.evaluate((y) => window.scrollTo(0, y), y);
        await page.waitForTimeout(SETTLE_MS);
        const r = await page.evaluate(() => {
          const box = window.__crystalBox();
          if (!box || box.fade < 0.05) return { box: null, hits: [] };
          const hits = [];
          const vw = window.innerWidth, vh = window.innerHeight;
          for (const root of [document.getElementById("about"), document.getElementById("disciplines")]) {
            const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
            for (let n = walk.nextNode(); n; n = walk.nextNode()) {
              if (!n.textContent.trim()) continue;
              const range = document.createRange();
              range.selectNodeContents(n);
              for (const t of range.getClientRects()) {
                if (t.width < 1 || t.bottom < 0 || t.top > vh || t.right < 0 || t.left > vw) continue;
                const overlap =
                  box.left < t.right && box.right > t.left && box.top < t.bottom && box.bottom > t.top;
                if (overlap) {
                  hits.push({
                    text: n.textContent.trim().slice(0, 40),
                    rect: [t.left, t.top, t.right, t.bottom].map(Math.round),
                  });
                }
              }
            }
          }
          return {
            box: [box.left, box.top, box.right, box.bottom].map(Math.round),
            fade: +box.fade.toFixed(2),
            hits,
          };
        });
        const tag = `${mode} ${w}px step ${i + 1}/${steps} y=${y}`;
        if (!r.box) {
          console.log(`  ${tag}: crystal hidden`);
          continue;
        }
        seen++;
        if (r.hits.length) {
          failures++;
          const file = resolve(outDir, `fail-${mode}-${w}-${i + 1}.png`);
          await page.screenshot({ path: file });
          console.log(`✗ ${tag}: crystal ${JSON.stringify(r.box)} covers ${r.hits.length} text rect(s), e.g. "${r.hits[0].text}" ${JSON.stringify(r.hits[0].rect)}`);
          console.log(`    ${file}`);
        } else {
          console.log(`✓ ${tag}: crystal ${JSON.stringify(r.box)} clear`);
        }
      }
      if (w >= 1024 && seen === 0) {
        // On desktop the crystal parks beside the copy; never seeing it means
        // the probe is broken, not that the layout passed
        failures++;
        console.log(`✗ ${mode} ${w}px: crystal never visible (probe broken?)`);
      }
      await ctx.close();
    }
  }
  console.log(failures ? `\nFAIL: ${failures} overlapping sample(s)` : "\nPASS: the crystal never covers the copy");
  return failures ? 1 : 0;
});
