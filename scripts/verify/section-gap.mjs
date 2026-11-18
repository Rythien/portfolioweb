#!/usr/bin/env node
/**
 * Works hands over to Recognition without an empty screen in between.
 *
 *   node scripts/verify/section-gap.mjs [--url=http://localhost:3000]
 *
 * Walks the boundary in 40px steps at 1440 and 390, WAKE and DREAM, and at
 * each step measures the empty band on screen between the lowest Works
 * content and the first Recognition content. The largest must stay at or
 * under 40vh.
 */
import { firefox } from "playwright";

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = arg("url", "http://localhost:3000");
const LIMIT_VH = 40;
let failures = 0;
const browser = await firefox.launch({ headless: true, firefoxUserPrefs: { "webgl.force-enabled": true } });
for (const [w, h, mode] of [[1440, 900, "wake"], [1440, 900, "dream"], [390, 844, "wake"], [390, 844, "dream"]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(`${base}/?nopreload=1&noarchive=1&mode=${mode}`, { waitUntil: "load" });
  await page.waitForTimeout(2500);
  // Walk down in small steps; at each, measure the gap on screen
  const recTop = await page.evaluate(() => document.getElementById("recognition").getBoundingClientRect().top + scrollY);
  let best = null;
  for (let y = recTop - h * 1.6; y <= recTop + 200; y += 40) {
    await page.evaluate((y) => window.scrollTo(0, y), y);
    await page.waitForTimeout(120);
    const g = await page.evaluate(() => {
      const vis = (el) => { const r = el.getBoundingClientRect(); return r.height > 0 && r.bottom > 0 && r.top < innerHeight ? r : null; };
      const works = [...document.querySelectorAll("#works .work-slide p, #works .work-slide a, #works .work-panel-wrap, #works h3")].map(vis).filter(Boolean);
      const rec = [...document.querySelectorAll("#recognition [class*='font-mono'], #recognition .recognition-row")].map(vis).filter(Boolean);
      if (!works.length || !rec.length) return null;
      const wb = Math.max(...works.map((r) => r.bottom));
      const rt = Math.min(...rec.map((r) => r.top));
      return { gap: rt - wb, wb, rt };
    });
    if (g && (!best || g.gap > best.gap)) best = { ...g, y };
  }
  const doc = await page.evaluate(() => {
    const works = document.getElementById("works"), rec = document.getElementById("recognition");
    const cs = (el) => getComputedStyle(el);
    return { worksPadBottom: cs(works).paddingBottom, recPadTop: cs(rec).paddingTop, pinH: document.querySelector(".work-pin").getBoundingClientRect().height };
  });
  const vh = best ? (100 * best.gap) / h : 0;
  const ok = !!best && vh <= LIMIT_VH;
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${w} ${mode}: largest empty band ${best ? Math.round(best.gap) + "px = " + vh.toFixed(0) + "vh" : "never both on screen"} (limit ${LIMIT_VH}vh)`);
  await page.close();
}
await browser.close();
console.log(failures ? `\nFAIL: ${failures}` : "\nPASS");
process.exit(failures ? 1 : 0);
