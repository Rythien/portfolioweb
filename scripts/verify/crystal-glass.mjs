#!/usr/bin/env node
/**
 * The crystal is glass at every size: the text behind it is measurably
 * bent but still there, at hero scale and at parked scale. Opaque fails.
 *
 *   node scripts/verify/crystal-glass.mjs [--url=http://localhost:3000]
 *        [--widths=1440] [--modes=wake,dream]
 *
 * The parked crystal has nothing of its own behind it (the copy sits above
 * the canvas), so both sizes are compared over the same thing: the hero
 * headline, frozen (crystalfreeze). Parked scale is the hero scale x 0.45,
 * the measured parked/hero radius at 1440 (128 / 288 px), forced with
 * crystalscale. On phones there is nothing behind the crystal to compare:
 * it sits above the headline (crystal-phone.mjs checks that) and sits out
 * About onward, so phones are not run by default. A phone width can still
 * be passed; its box is inset 5% there (15% on
 * desktop). Each size is captured twice, with the crystal and with
 * crystalview=hidden, and compared on luma:
 *
 *   present    contrast through the glass >= 35% of the bare text's
 *              contrast (stddev of luma; opaque putty flattens it)
 *   distorted  mean |with - without| >= 4/255 (the glass is really there)
 *
 * The bare text must itself have contrast (stddev >= 12), or the run is
 * invalid. Prints window.__crystalGlass (radius px, frost / cloud / blur
 * factors) for each size.
 */
import { firefox } from "playwright";
import sharp from "sharp";
import { launch, session } from "../_browser.mjs";

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = arg("url", "http://localhost:3000");
const widths = arg("widths", "1440").split(",").map(Number);
const modes = arg("modes", "wake,dream").split(",");
const PARKED_RATIO = 0.45;
const MIN_PRESENT = 0.35;
const MIN_DISTORT = 4;
const MIN_TEXT = 12;

await session(async () => {
  const browser = await launch(firefox, { firefoxUserPrefs: { "webgl.force-enabled": true } });
  let failures = 0;
  const check = (ok, msg) => {
    console.log(`${ok ? "✓" : "✗"} ${msg}`);
    if (!ok) failures++;
  };

  const luma = async (png) => {
    const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const out = new Float64Array(info.width * info.height);
    for (let i = 0; i < out.length; i++) out[i] = 0.2126 * data[i * 3] + 0.7152 * data[i * 3 + 1] + 0.0722 * data[i * 3 + 2];
    return out;
  };
  const std = (a) => {
    let m = 0;
    for (const v of a) m += v;
    m /= a.length;
    let s = 0;
    for (const v of a) s += (v - m) ** 2;
    return Math.sqrt(s / a.length);
  };
  const meanAbsDiff = (a, b) => {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
    return s / a.length;
  };

  async function capture(w, h, mode, extra, clip, inset = 0.15) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const q = `nopreload=1&crystalfreeze=2&mode=${mode}${mode === "dream" ? "&noarchive=1" : ""}${extra}`;
    await page.goto(`${base}/?${q}`, { waitUntil: "load", timeout: 120000 });
    await page.mouse.move(w - 2, h - 2);
    await page.waitForFunction(() => typeof window.__crystalBox === "function", null, { timeout: 60000 });
    await page.waitForTimeout(3500);
    const info = await page.evaluate(() => ({ box: window.__crystalBox(), glass: window.__crystalGlass }));
    let region = clip;
    if (!region && info.box) {
      const bw = info.box.right - info.box.left, bh = info.box.bottom - info.box.top;
      region = {
        x: Math.round(info.box.left + bw * inset),
        y: Math.round(info.box.top + bh * inset),
        width: Math.round(bw * (1 - 2 * inset)),
        height: Math.round(bh * (1 - 2 * inset)),
      };
    }
    const png = region ? await page.screenshot({ clip: region }) : null;
    await page.close();
    return { png, region, glass: info.glass };
  }

  for (const w of widths) {
    for (const mode of modes) {
      const h = w < 768 ? 844 : 900;
      // Hero scale, read from the page itself
      const probe = await capture(w, h, mode, "", { x: 0, y: 0, width: 1, height: 1 });
      const heroScale = probe.glass?.scale;
      if (!heroScale) {
        check(false, `${w} ${mode}: no crystal to measure`);
        continue;
      }
      const phone = w < 768;
      const sizes = phone ? [["hero", heroScale]] : [["hero", heroScale], ["parked", heroScale * PARKED_RATIO]];
      for (const [name, scale] of sizes) {
        const extra = `&crystalscale=${scale.toFixed(4)}`;
        const withC = await capture(w, h, mode, extra, null, phone ? 0.05 : 0.15);
        if (!withC.png) {
          check(false, `${w} ${mode} ${name}: crystal not on screen`);
          continue;
        }
        const without = await capture(w, h, mode, `${extra}&crystalview=hidden`, withC.region);
        const a = await luma(withC.png);
        const b = await luma(without.png);
        const through = std(a), bare = std(b), diff = meanAbsDiff(a, b);
        const g = withC.glass;
        const tag = `${w} ${mode} ${name} (radius ${g.radiusPx}px, frost ${g.frost.toFixed(2)} cloud ${g.cloud.toFixed(2)} blur ${g.blur.toFixed(2)})`;
        check(
          bare >= MIN_TEXT && through >= MIN_PRESENT * bare && diff >= MIN_DISTORT,
          `${tag}: text contrast ${bare.toFixed(1)} bare, ${through.toFixed(1)} through the glass (${((100 * through) / bare).toFixed(0)}%), distortion ${diff.toFixed(1)}`
        );
      }
    }
  }
  console.log(failures ? `\nFAIL: ${failures}` : "\nPASS");
  return failures ? 1 : 0;
});
