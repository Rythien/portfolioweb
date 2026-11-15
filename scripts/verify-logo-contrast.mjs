#!/usr/bin/env node
// Hero logo legibility by pixel sampling (Firefox, dev server on :3000).
// Renders the same frozen pose twice, with the hero logo and without it
// (crystallogo=0), so "the glass behind the logo" is measured directly.
// Logo footprint = where the two frames differ, morphologically closed so
// pixels inside the logo that happen to match the glass still count
// against it. Passes when, in WAKE and DREAM:
//   - mean per-pixel |L*(logo) - L*(glass behind)| >= 25 over the footprint
//     (per pixel, because the glass behind holds both black marquee type
//     and pale ice, and a signed mean would cancel)
//   - the logo is not flat: L* spread (p90 - p10) across its face >= 12
// Usage: node scripts/verify-logo-contrast.mjs [freezeSeconds=2]
import { firefox } from "playwright";
import sharp from "sharp";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const shots = resolve(dirname(fileURLToPath(import.meta.url)), "..", "shots");
const BASE = process.env.BASE ?? "http://localhost:3000";
const freeze = process.argv[2] ?? "2";
const CLIP = { x: 470, y: 110, width: 780, height: 680 };
const MIN_DL = 25;
const MIN_SPREAD = 12;

const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function lstar(r, g, b) {
  const y = 0.2126 * lin(r / 255) + 0.7152 * lin(g / 255) + 0.0722 * lin(b / 255);
  return y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : (24389 / 27) * y;
}
async function lmap(file) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const L = new Float32Array(info.width * info.height);
  for (let i = 0; i < L.length; i++) L[i] = lstar(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]);
  return L;
}
/** Binary closing (dilate then erode) with a square of radius r. */
function close(mask, w, h, r) {
  const pass = (src, keep) => {
    const out = new Uint8Array(src.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let hit = !keep;
      for (let dy = -r; dy <= r && hit !== keep; dy++) for (let dx = -r; dx <= r; dx++) {
        const xx = x + dx, yy = y + dy;
        const v = xx >= 0 && yy >= 0 && xx < w && yy < h ? src[yy * w + xx] : 0;
        if (keep ? v : !v) { hit = keep; break; }
      }
      out[y * w + x] = hit ? 1 : 0;
    }
    return out;
  };
  return pass(pass(mask, true), false);
}
const pct = (arr, p) => arr[Math.min(arr.length - 1, Math.floor(p * arr.length))];

const browser = await firefox.launch({
  headless: true,
  firefoxUserPrefs: { "webgl.force-enabled": true, "webgl.disabled": false },
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
let fails = 0;
for (const mode of ["wake", "dream"]) {
  const files = {};
  for (const logo of ["on", "off"]) {
    const page = await ctx.newPage();
    const q = `nopreload=1&noarchive=1&mode=${mode}&crystalfreeze=${freeze}${logo === "off" ? "&crystallogo=0" : ""}`;
    await page.goto(`${BASE}/?${q}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(9000);
    files[logo] = resolve(shots, `logo-contrast-${mode}-${logo}.png`);
    await page.screenshot({ path: files[logo], clip: CLIP });
    await page.close();
  }
  const A = await lmap(files.on);
  const B = await lmap(files.off);
  const raw = new Uint8Array(A.length);
  for (let i = 0; i < A.length; i++) raw[i] = Math.abs(A[i] - B[i]) > 6 ? 1 : 0;
  const mask = close(raw, CLIP.width, CLIP.height, 4);
  const logoL = [];
  let sumD = 0;
  for (let i = 0; i < A.length; i++) {
    if (!mask[i]) continue;
    logoL.push(A[i]);
    sumD += Math.abs(A[i] - B[i]);
  }
  logoL.sort((a, b) => a - b);
  const n = logoL.length;
  const meanD = n ? sumD / n : 0;
  const spread = n ? pct(logoL, 0.9) - pct(logoL, 0.1) : 0;
  const ok = n > 2000 && meanD >= MIN_DL && spread >= MIN_SPREAD;
  if (!ok) fails++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${mode.toUpperCase()}: ${n} logo px, mean |L* logo - glass| = ${meanD.toFixed(1)} (need >= ${MIN_DL}), ` +
      `L* across face p10 ${pct(logoL, 0.1)?.toFixed(1)} / p50 ${pct(logoL, 0.5)?.toFixed(1)} / p90 ${pct(logoL, 0.9)?.toFixed(1)}, spread ${spread.toFixed(1)} (need >= ${MIN_SPREAD})`,
  );
}
await browser.close();
process.exit(fails ? 1 : 0);
