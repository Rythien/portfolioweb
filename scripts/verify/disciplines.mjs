#!/usr/bin/env node
/**
 * Disciplines layout: headings never reach their description, rows never
 * touch, and a linked row clears the header.
 *
 *   node scripts/verify/disciplines.mjs [--url=http://localhost:3000]
 *        [--widths=390,768,1024,1280,1440,1920] [--modes=wake,dream]
 *
 * Per row: the heading's glyphs (Range rects, so overflow counts) must end
 * GUTTER px before the description starts when they sit side by side, or
 * end above it when stacked; every cell must sit inside its row; and after
 * scrollIntoView() the row's top must be at or below the header band.
 */
import { firefox } from "playwright";

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = arg("url", "http://localhost:3000");
const widths = arg("widths", "390,768,1024,1280,1440,1920").split(",").map(Number);
const modes = arg("modes", "wake,dream").split(",");
const GUTTER = 24;

const browser = await firefox.launch({ headless: true, firefoxUserPrefs: { "webgl.force-enabled": true } });
let failures = 0;
for (const mode of modes) {
  for (const w of widths) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
    const page = await ctx.newPage();
    const q = `nopreload=1&mode=${mode}${mode === "dream" ? "&noarchive=1" : ""}`;
    await page.goto(`${base}/?${q}`, { waitUntil: "load", timeout: 120000 });
    await page.waitForTimeout(2500);
    // Reveal tweens shift rows by up to 25px; measure the settled layout
    await page.evaluate(() => {
      document.getElementById("disciplines").scrollIntoView();
    });
    await page.waitForTimeout(1500);
    const problems = await page.evaluate(async (GUTTER) => {
      const out = [];
      const rows = [...document.querySelectorAll(".discipline-row")];
      const glyphs = (el) => {
        const r = document.createRange();
        r.selectNodeContents(el);
        const rects = [...r.getClientRects()].filter((x) => x.width > 0);
        return {
          left: Math.min(...rects.map((x) => x.left)),
          right: Math.max(...rects.map((x) => x.right)),
          top: Math.min(...rects.map((x) => x.top)),
          bottom: Math.max(...rects.map((x) => x.bottom)),
        };
      };
      let prevBottom = -Infinity;
      for (const row of rows) {
        const n = row.id;
        const rr = row.getBoundingClientRect();
        const title = glyphs(row.querySelector(".discipline-title"));
        const desc = glyphs(row.querySelector("p"));
        const sideBySide = desc.top < title.bottom && desc.left > title.left + 40;
        if (sideBySide && title.right > desc.left - GUTTER)
          out.push(`${n}: heading ends at ${Math.round(title.right)}, description starts at ${Math.round(desc.left)} (gutter < ${GUTTER})`);
        if (!sideBySide && title.bottom > desc.top)
          out.push(`${n}: stacked heading overlaps its description`);
        for (const [name, g] of [["heading", title], ["description", desc]]) {
          if (g.top < rr.top - 0.5 || g.bottom > rr.bottom + 0.5 || g.right > rr.right + 0.5)
            out.push(`${n}: ${name} spills out of its row`);
        }
        if (rr.top < prevBottom - 0.5) out.push(`${n}: row overlaps the previous one`);
        prevBottom = rr.bottom;
      }
      // Linked rows clear the header (nav 80px, plus the 28px strip below lg)
      const band = window.innerWidth >= 1024 ? 80 : 108;
      for (const row of rows) {
        window.scrollTo(0, 0);
        row.scrollIntoView();
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const top = row.getBoundingClientRect().top;
        if (top < band - 0.5) out.push(`${row.id}: linked row top at ${Math.round(top)}px, under the ${band}px header`);
      }
      return out;
    }, GUTTER);
    for (const p of problems) console.log(`✗ ${mode} ${w}px ${p}`);
    if (!problems.length) console.log(`✓ ${mode} ${w}px`);
    failures += problems.length;
    await ctx.close();
  }
}
await browser.close();
console.log(failures ? `\nFAIL: ${failures} problem(s)` : "\nPASS");
process.exit(failures ? 1 : 0);
