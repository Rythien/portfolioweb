#!/usr/bin/env node
// Archive audio smoke test (Firefox, dev server on :3000). Headless can't
// listen, so it counts sources started (oscillators + noise buffers) per
// event: with Sound on every event must start some; with Sound off, none.
import { firefox } from "playwright";
const BASE = process.env.BASE ?? "http://localhost:3000";
const browser = await firefox.launch({ headless: true, firefoxUserPrefs: { "webgl.force-enabled": true, "media.autoplay.default": 0 } });
let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`); if (!ok) fails++; };

async function run(sound) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(() => {
    window.__src = 0;
    for (const m of ["createOscillator", "createBufferSource"]) {
      const orig = AudioContext.prototype[m];
      AudioContext.prototype[m] = function (...a) { window.__src++; return orig.apply(this, a); };
    }
  });
  await page.goto(`${BASE}/?nopreload=1&mode=wake`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.removeItem("archive-progress-v1"));
  await page.goto(`${BASE}/?nopreload=1&mode=wake&archivecharge=3&archivefreeze=1`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
  if (sound) await page.locator("header button", { hasText: /sound/i }).first().click();
  await page.getByRole("button", { name: "Switch to dream mode" }).click();
  await page.waitForFunction(() => document.documentElement.classList.contains("archive-open"), null, { timeout: 20000 });
  await page.waitForTimeout(1500);
  await page.locator(".archive-stage").focus();
  const counts = {};
  const delta = async (label, fn) => {
    const a = await page.evaluate(() => window.__src);
    await fn();
    counts[label] = (await page.evaluate(() => window.__src)) - a;
  };
  const fire = async (n, aim) => {
    await page.evaluate((aim) => { if (aim) window.__archiveAim(0); window.__archiveRecharge(); }, aim);
    await page.waitForTimeout(400);
    await page.keyboard.press("Space");
    await page.waitForFunction((n) => (window.__archiveHits ?? []).length >= n, n, { timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(300);
  };
  await delta("crack0", () => fire(1, true));
  // Same spot, the lit facet has moved: this one is wasted on the body
  await delta("thud", () => fire(2, false));
  await delta("crack1", () => fire(3, true));
  await delta("free", () => fire(4, true));
  const first = await page.evaluate(() => window.__archiveHits?.[1]);
  await page.close();
  return { counts, first };
}

const onRun = await run(true);
console.log("INFO  sound on:", JSON.stringify(onRun.counts), "first release:", onRun.first);
check(onRun.counts.thud > 0, `wasted release (${onRun.first}) makes a sound`);
check(onRun.counts.crack0 > 0 && onRun.counts.crack1 > 0, "facet hits crack");
check(onRun.counts.free > onRun.counts.crack0, "freeing adds the bloom on top of the crack");
const offRun = await run(false);
console.log("INFO  sound off:", JSON.stringify(offRun.counts));
check(Object.values(offRun.counts).every((n) => n === 0), "Sound off: no Archive audio at all");
await browser.close();
process.exit(fails ? 1 : 0);
