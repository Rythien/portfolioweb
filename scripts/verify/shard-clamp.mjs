#!/usr/bin/env node
/**
 * Broken shards never drift over the fixed header: every shard's top edge
 * stays below the header band's bottom edge (the header, plus the section
 * strip below lg).
 *
 *   node scripts/verify/shard-clamp.mjs [--url=http://localhost:3100] [--widths=1440,1024,900] [--seconds=12]
 *
 * WAKE, at the top of the page. The pointer is parked on the crystal to
 * break it, then every shard's top (window.__shardTops, from its real
 * geometry through the portal camera) is sampled for `seconds` while the
 * shards drift. Fails if any sample is above the band's bottom.
 */
import { firefox } from "playwright";
import { launch, session } from "../_browser.mjs";

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = arg("url", "http://localhost:3100");
const widths = arg("widths", "1440,1024,900").split(",").map(Number);
const seconds = Number(arg("seconds", "12"));

await session(async () => {
  const browser = await launch(firefox, { firefoxUserPrefs: { "webgl.force-enabled": true } });
  let failures = 0;
  const check = (ok, msg) => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`);
    if (!ok) failures++;
  };

  for (const width of widths) {
    const height = 900;
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(`${base}/?nopreload=1&mode=wake`, { waitUntil: "load", timeout: 120000 });
    await page.waitForFunction(() => typeof window.__crystalBox === "function" && window.__crystalBox(), null, { timeout: 60000 });
    await page.waitForTimeout(2500);
    const band = await page.evaluate(() => {
      let b = 0;
      for (const el of document.querySelectorAll("header[data-intro], [data-rail-strip]")) {
        const r = el.getBoundingClientRect();
        if (r.height > 0) b = Math.max(b, r.bottom);
      }
      return b;
    });
    const box = await page.evaluate(() => window.__crystalBox());
    await page.mouse.move((box.left + box.right) / 2, (box.top + box.bottom) / 2, { steps: 8 });
    await page.waitForTimeout(1800);

    let samples = 0, shards = 0, highest = Infinity;
    const t0 = Date.now();
    while (Date.now() - t0 < seconds * 1000) {
      // Keep it broken: small moves on the crystal
      await page.mouse.move((box.left + box.right) / 2 + (samples % 2 ? 6 : -6), (box.top + box.bottom) / 2);
      const tops = await page.evaluate(() => window.__shardTops());
      if (tops.length) {
        samples++;
        shards = Math.max(shards, tops.length);
        highest = Math.min(highest, ...tops);
      }
      await page.waitForTimeout(150);
    }
    check(samples > 10, `${width}: the crystal broke (${shards} shards over ${samples} samples)`);
    check(highest >= band, `${width}: highest shard top ${highest.toFixed(1)} px, header band bottom ${band.toFixed(1)} px`);
    await page.close();
  }
  console.log(failures ? `\n${failures} failed` : "\nall passed");
  return failures ? 1 : 0;
});
