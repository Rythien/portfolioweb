#!/usr/bin/env node
/**
 * The fixed WAKE/DREAM pill never covers a section's last row.
 *
 *   node scripts/verify/pill-clear.mjs [--url=http://localhost:3000]
 *        [--widths=1440,1024] [--modes=wake,dream]
 *
 * The floating pill exists from lg (1024) up; below that the control is
 * docked in the header and pill-cover.mjs checks it.
 *
 * For each content section it scrolls the section's end to the bottom of
 * the viewport and requires the lowest line of text in it to end at least
 * 32px above the pill. Also checks the pill is --pill-h (44px) tall.
 */
import { firefox } from "playwright";

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = arg("url", "http://localhost:3000");
const widths = arg("widths", "1440,1024").split(",").map(Number);
const modes = arg("modes", "wake,dream").split(",");
const SECTIONS = ["about", "disciplines", "works", "contact"];

const browser = await firefox.launch({ headless: true, firefoxUserPrefs: { "webgl.force-enabled": true } });
let failures = 0;
for (const mode of modes) {
  for (const w of widths) {
    const h = w < 768 ? 844 : 900;
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    const q = `nopreload=1&mode=${mode}${mode === "dream" ? "&noarchive=1" : ""}`;
    await page.goto(`${base}/?${q}`, { waitUntil: "load", timeout: 120000 });
    await page.waitForTimeout(2500);
    const out = [];
    for (const id of SECTIONS) {
      await page.evaluate((id) => {
        const r = document.getElementById(id).getBoundingClientRect();
        window.scrollTo(0, r.bottom + window.scrollY - window.innerHeight);
      }, id);
      await page.waitForTimeout(900);
      const m = await page.evaluate((id) => {
        const pill = [...document.querySelectorAll('[aria-label="Site mode"]')].find((e) => e.getClientRects().length).getBoundingClientRect();
        let low = -Infinity;
        const walk = document.createTreeWalker(document.getElementById(id), NodeFilter.SHOW_TEXT);
        for (let n = walk.nextNode(); n; n = walk.nextNode()) {
          if (!n.textContent.trim()) continue;
          const range = document.createRange();
          range.selectNodeContents(n);
          for (const r of range.getClientRects()) if (r.width > 0) low = Math.max(low, r.bottom);
        }
        return { pillTop: pill.top, pillH: pill.height, low };
      }, id);
      const room = m.pillTop - m.low;
      if (Math.abs(m.pillH - 44) > 0.5) out.push(`pill is ${m.pillH}px, not 44px`);
      if (room < 32) out.push(`${id}: last text ends ${Math.round(room)}px above the pill (need 32)`);
      else console.log(`  ${mode} ${w}px ${id}: ${Math.round(room)}px clear of the pill`);
    }
    for (const p of [...new Set(out)]) console.log(`✗ ${mode} ${w}px ${p}`);
    failures += out.length;
    await ctx.close();
  }
}
await browser.close();
console.log(failures ? `\nFAIL: ${failures} problem(s)` : "\nPASS");
process.exit(failures ? 1 : 0);
