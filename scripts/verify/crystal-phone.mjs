#!/usr/bin/env node
/**
 * On phones the hero crystal sits above the headline, never on it.
 *
 *   node scripts/verify/crystal-phone.mjs [--url=http://localhost:3000]
 *        [--sizes=360x780,390x844,414x896,375x667] [--modes=wake,dream]
 *
 * At the top of the page, settled and frozen (crystalfreeze):
 *
 *   headline  the marquee's glyphs are found from pixels, in a frame with
 *             the crystal hidden (crystalview=hidden): the first row, below
 *             the role label, where ink differs strongly from the paper.
 *             The crystal's on-screen box (window.__crystalBox, every
 *             vertex of the glass projected) must end >= 8px above it.
 *   label     the box must start >= 8px below the role label.
 *   size      its radius must be at least 60px (it has not shrunk away).
 *
 * Prints the box, the band and window.__crystalGlass (the scale-aware glass
 * factors, which are at their reduced values at this size).
 */
import { firefox } from "playwright";
import sharp from "sharp";
import { launch, session } from "../_browser.mjs";

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = arg("url", "http://localhost:3000");
const sizes = arg("sizes", "360x780,390x844,414x896,375x667").split(",").map((s) => s.split("x").map(Number));
const modes = arg("modes", "wake,dream").split(",");
const GAP = 8;
const MIN_R = 60;

await session(async () => {
  const browser = await launch(firefox, { firefoxUserPrefs: { "webgl.force-enabled": true } });
  let failures = 0;
  const check = (ok, msg) => {
    console.log(`${ok ? "✓" : "✗"} ${msg}`);
    if (!ok) failures++;
  };

  const load = async (w, h, q) => {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(`${base}/?nopreload=1&crystalfreeze=2&${q}`, { waitUntil: "load", timeout: 120000 });
    await page.mouse.move(w - 1, h - 1);
    await page.waitForTimeout(4000);
    return page;
  };

  for (const mode of modes) {
    for (const [w, h] of sizes) {
      const mq = `mode=${mode}${mode === "dream" ? "&noarchive=1" : ""}`;
      // Headline glyph rows, with no crystal in front of them
      const bare = await load(w, h, `${mq}&crystalview=hidden`);
      const labelBottom = await bare.evaluate(() => document.querySelector("#top [data-hero-line]").getBoundingClientRect().bottom);
      const png = await bare.screenshot();
      await bare.close();
      const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const lum = (x, y) => {
        const i = (y * info.width + x) * 3;
        return 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      };
      // Paper: the median luma of a row just under the label
      const paperRow = Math.round(labelBottom + 30);
      const row = Array.from({ length: info.width }, (_, x) => lum(x, paperRow)).sort((a, b) => a - b);
      const paper = row[row.length >> 1];
      let glyphTop = -1;
      for (let y = Math.round(labelBottom + 10); y < info.height * 0.9 && glyphTop < 0; y++) {
        let ink = 0;
        for (let x = 0; x < info.width; x++) if (Math.abs(lum(x, y) - paper) > 60) ink++;
        if (ink > info.width * 0.04) glyphTop = y;
      }

      const page = await load(w, h, mq);
      const box = await page.evaluate(() => window.__crystalBox?.());
      const glass = await page.evaluate(() => window.__crystalGlass ?? null);
      await page.close();
      const tag = `${mode} ${w}x${h}`;
      if (!box || glyphTop < 0) {
        check(false, `${tag}: ${!box ? "no crystal box" : "headline not found"}`);
        continue;
      }
      const r = Math.round((box.bottom - box.top) / 2);
      console.log(`  ${tag}: label ends ${Math.round(labelBottom)}, crystal ${Math.round(box.top)}-${Math.round(box.bottom)} (r ${r}px), headline glyphs from ${glyphTop}` +
        (glass ? `; glass radius ${glass.radiusPx} frost ${glass.frost?.toFixed?.(2)} cloud ${glass.cloud?.toFixed?.(2)} blur ${glass.blur?.toFixed?.(2)}` : ""));
      check(box.bottom <= glyphTop - GAP, `${tag}: crystal ends ${Math.round(glyphTop - box.bottom)}px above the headline (need ${GAP})`);
      check(box.top >= labelBottom + GAP, `${tag}: crystal starts ${Math.round(box.top - labelBottom)}px below the role label (need ${GAP})`);
      check(r >= MIN_R, `${tag}: crystal radius ${r}px (need ${MIN_R})`);
    }
  }
  console.log(failures ? `\nFAIL: ${failures}` : "\nPASS");
  return failures ? 1 : 0;
});
