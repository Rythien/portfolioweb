#!/usr/bin/env node
// The marquee must look already running on arrival.
//
//   node scripts/shot/marquee-arrival.mjs [base=http://localhost:3100] [--out=dir] [--firefox [--software]]
//
// Edge by default: headless Firefox, while a link is in flight, hands
// screenshots an old composited WebGL frame (a shot 1.2 s in showed the
// line as it was at 0.2 s). --firefox for the project's usual browser.
//
// For 1440x900 and 390x844, with and without the preloader: screenshots of
// the first visible frame (as close as a screenshot can get to it) and of
// the frame 0.5 s later, plus every frame of the first second sampled from
// the page (window.__marqueeSpan, Marquee.tsx). Fails unless, on every
// sampled frame, the tiles cover both viewport edges; the speed is steady
// from the first frame (no easing up); both screenshots carry type at both
// edges of the screen; and the type moved between them.
import { chromium, firefox } from "playwright";
import sharp from "sharp";
import { mkdirSync } from "fs";
import { join } from "path";
import { launch, session } from "../_browser.mjs";

const args = process.argv.slice(2);
const BASE = args.find((a) => a.startsWith("http")) ?? "http://localhost:3100";
const OUT = args.find((a) => a.startsWith("--out="))?.slice(6) ?? "shots/marquee-arrival";
await session(async () => {
  const software = args.includes("--software");
  const useFirefox = args.includes("--firefox");
  mkdirSync(OUT, { recursive: true });

  // Every frame from the first visible one, for 1.2 s
  const SAMPLER = `
window.__spanLog = [];
const __s = (t) => {
  const sp = window.__marqueeSpan;
  if (window.__marqueeShownAt !== undefined && sp && t - window.__marqueeShownAt < 1200) {
    window.__spanLog.push({ t, x0: sp.x0, x1: sp.x1, half: sp.half, speed: sp.speed, fade: sp.fade });
  }
  requestAnimationFrame(__s);
};
requestAnimationFrame(__s);
`;

  /** Ink per column inside the marquee band, from a screenshot. */
  async function inkColumns(buf, band) {
    const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width, height } = info;
    const y0 = Math.max(0, Math.round(band[0] * height));
    const y1 = Math.min(height, Math.round(band[1] * height));
    // Background: the band's brightest decile (the page paper)
    const lum = (i) => 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    const sample = [];
    for (let y = y0; y < y1; y += 4) for (let x = 0; x < width; x += 4) sample.push(lum((y * width + x) * 3));
    sample.sort((a, b) => a - b);
    const paper = sample[Math.floor(sample.length * 0.9)];
    const cols = new Float64Array(width);
    let maxDark = 0;
    for (let x = 0; x < width; x++) {
      let d = 0;
      for (let y = y0; y < y1; y++) d = Math.max(d, paper - lum((y * width + x) * 3));
      cols[x] = d;
      maxDark = Math.max(maxDark, d);
    }
    return { cols, width, paper, maxDark };
  }

  /**
   * Share of columns in [a, b) (fractions of width) that carry ink. The
   * threshold comes from the strip itself (the crystal's shading sets the
   * band's darkest pixel; the first frame's type is 2-3 levels under the
   * paper, 2 in Edge, the first 8-bit steps of a fade from 0; the paper is
   * flat to the level): 1.5 levels, or a
   * third of the strip's 90th percentile. An empty strip shows only the
   * page's 1 px grid rules (~2% of columns).
   */
  function coverage(ink, a, b) {
    const x0 = Math.floor(a * ink.width);
    const x1 = Math.floor(b * ink.width);
    const strip = Array.from(ink.cols.slice(x0, x1)).sort((p, q) => p - q);
    const thr = Math.max(1.5, strip[Math.floor(strip.length * 0.9)] / 3);
    let n = 0;
    for (let x = x0; x < x1; x++) if (ink.cols[x] > thr) n++;
    return n / (x1 - x0);
  }

  /**
   * Leftward shift (px) that best maps A's ink onto B's: B's left third
   * (on phones, where the crystal sits above the line, its left 55%: a
   * third of 390 px was too little of a repeating word pattern) against A
   * from s px further right (Pearson correlation of the column profiles,
   * each normalised, so a faint first frame compares fairly).
   */
  function shiftPx(a, b, maxShift) {
    const w = Math.floor(a.width * (a.width < 800 ? 0.55 : 0.3));
    const z = (v) => {
      const m = v.reduce((p, q) => p + q, 0) / v.length;
      const sd = Math.sqrt(v.reduce((p, q) => p + (q - m) ** 2, 0) / v.length) || 1;
      return v.map((q) => (q - m) / sd);
    };
    const pb = z(Array.from(b.cols.slice(0, w)));
    let best = 0;
    let bestScore = -Infinity;
    for (let s = 0; s <= Math.min(maxShift, a.width - w); s++) {
      const pa = z(Array.from(a.cols.slice(s, s + w)));
      let score = 0;
      for (let x = 0; x < w; x++) score += pa[x] * pb[x];
      if (score > bestScore) {
        bestScore = score;
        best = s;
      }
    }
    return { px: best, r: bestScore / w };
  }

  const browser = useFirefox
    ? await launch(firefox, {
        firefoxUserPrefs: { "webgl.force-enabled": true, "webgl.angle.force-warp": software, "privacy.reduceTimerPrecision": false },
      })
    : await launch(chromium, { channel: "msedge" });

  const views = [
    { name: "1440", viewport: { width: 1440, height: 900 }, band: [0.5 - 0.15, 0.5 + 0.15] },
    // Phones: the headline sits below the midline (marqueeLayout MOBILE_TEXT_Y)
    { name: "390", viewport: { width: 390, height: 844 }, band: [0.5785 - 0.09, 0.5785 + 0.09], isMobile: true, hasTouch: true },
  ];
  let failed = 0;
  const check = (ok, what) => {
    console.log(`  ${ok ? "ok  " : "FAIL"} ${what}`);
    if (!ok) failed++;
  };

  for (const v of views) {
    for (const scenario of ["direct", "preload"]) {
      const ctx = await browser.newContext({ viewport: v.viewport, isMobile: v.isMobile, hasTouch: v.hasTouch });
      await ctx.addInitScript(SAMPLER);
      const p = await ctx.newPage();
      const q = scenario === "direct" ? "?nopreload=1&mode=wake" : "?mode=wake";
      await p.goto(`${BASE}/${q}`, { waitUntil: "domcontentloaded" });
      await p.waitForFunction(() => window.__marqueeShownAt !== undefined, null, { timeout: 30000, polling: "raf" });
      const a = await p.screenshot();
      const aAt = await p.evaluate(() => performance.now() - window.__marqueeShownAt);
      await p.waitForTimeout(500 - aAt > 0 ? 500 : 0);
      const b = await p.screenshot();
      const bAt = await p.evaluate(() => performance.now() - window.__marqueeShownAt);
      await p.waitForTimeout(Math.max(0, 1300 - bAt));
      const log = await p.evaluate(() => window.__spanLog);
      await ctx.close();

      const tag = `${v.name}-${scenario}`;
      await sharp(a).toFile(join(OUT, `${tag}-first.png`));
      await sharp(b).toFile(join(OUT, `${tag}-plus500.png`));
      console.log(`${tag}: first shot +${Math.round(aAt)} ms after the first visible frame, second +${Math.round(bAt)} ms`);

      // Every frame: both edges covered
      const bad = log.filter((f) => !(f.x0 <= -f.half && f.x1 >= f.half));
      if (bad.length) console.log("  uncovered frames:", JSON.stringify(bad.slice(0, 3)));
      const fps = log.length > 1 ? (log.length - 1) / ((log.at(-1).t - log[0].t) / 1000) : 0;
      check(log.length >= 3 && bad.length === 0, `tiles span both edges on all ${log.length} frames of the first 1.2 s (${fps.toFixed(0)} fps) (first frame: ${log[0] ? `${log[0].x0.toFixed(2)}..${log[0].x1.toFixed(2)} vs ±${log[0].half.toFixed(2)}` : "-"})`);
      // Steady speed: the first frame's speed is the last frame's (no easing up)
      const v0 = log[0]?.speed ?? NaN;
      const vMin = Math.min(...log.map((f) => f.speed));
      const vMax = Math.max(...log.map((f) => f.speed));
      check(Math.abs(vMin / vMax - 1) < 0.01 && v0 > 0, `speed steady from the first frame: ${v0.toFixed(3)} units/s, range ${vMin.toFixed(3)}..${vMax.toFixed(3)} over ${log.length} frames`);
      check(log[0] && log[0].fade < 0.35, `first frame is the start of the fade (fade ${log[0]?.fade.toFixed(2)})`);

      // Screenshots: ink at both edges, and the type moved
      const ia = await inkColumns(a, v.band);
      const ib = await inkColumns(b, v.band);
      const edges = (ink) => [coverage(ink, 0, 0.12), coverage(ink, 0.88, 1)];
      const [al, ar] = edges(ia);
      const [bl, br] = edges(ib);
      check(al > 0.3 && ar > 0.3, `first shot: type at both edges (left ${(al * 100).toFixed(0)}%, right ${(ar * 100).toFixed(0)}% of columns; darkest ${ia.maxDark.toFixed(0)})`);
      check(bl > 0.3 && br > 0.3, `+0.5 s shot: type at both edges (left ${(bl * 100).toFixed(0)}%, right ${(br * 100).toFixed(0)}% of columns; darkest ${ib.maxDark.toFixed(0)})`);
      // Expected: the line's speed over the time between the two shots
      const pxPerUnit = v.viewport.width / (2 * log[0].half);
      const expected = v0 * ((bAt - aAt) / 1000) * pxPerUnit;
      const sh = shiftPx(ia, ib, Math.ceil(expected * 2 + 20));
      check(sh.px > 0 && Math.abs(sh.px - expected) <= Math.max(8, expected * 0.35), `type advanced between the shots: ${sh.px} px leftward (expected ~${expected.toFixed(0)} px from the line's speed; r ${sh.r.toFixed(2)})`);
    }
  }
  console.log(failed ? `\n${failed} check(s) failed` : "\nall checks passed");
  return failed ? 1 : 0;
});
