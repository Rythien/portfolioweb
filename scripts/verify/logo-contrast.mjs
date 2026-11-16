#!/usr/bin/env node
// Hero logo legibility by pixel sampling (Firefox, dev server on :3000).
// Renders the same frozen pose twice: as it looks, and with the logo and
// its contour painted flat magenta (crystallogo=matte). The magenta pixels
// are the logo's exact refracted silhouette (an on/off difference is not:
// where the logo sits over dark type it barely differs from the glass).
// A shape is read by its EDGE, not by its average brightness against the
// average behind it (chasing a face-vs-background mean is what turned the
// logo into a grey blot). So, in the logo-on frame, every pixel on the
// footprint's outline is paired: 2 px inside vs 2 px outside along the
// outline's normal. Passes when, in WAKE and DREAM:
//   - median |L*(inside) - L*(outside)| over all pairs >= 30
//   - at least 80% of pairs differ by more than 20 L*
//   - the logo is not flat: L* spread (p90 - p10) across its face >= 12
// Usage: node scripts/verify/logo-contrast.mjs [freezeSeconds,...=0,2,4,6,8]
// Every pose (freeze time) must pass in both modes.
import { firefox } from "playwright";
import sharp from "sharp";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const shots = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "shots");
const BASE = process.env.BASE ?? "http://localhost:3000";
const freezes = (process.argv[2] ?? "0,2,4,6,8").split(",");
const CLIP = { x: 470, y: 110, width: 780, height: 680 };
const MIN_EDGE_MEDIAN = 30;
const MIN_EDGE_SHARE = 0.8;
const EDGE_PAIR_DL = 20;
const EDGE_OFFSET = Number(process.env.EDGE_OFFSET ?? 2);
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
/** Key-colour pixels of the matte frame (logo + contour, through the glass). */
async function magenta(file) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const m = new Uint8Array(info.width * info.height);
  for (let i = 0; i < m.length; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    m[i] = r > 150 && b > 150 && g < 110 && r - g > 90 ? 1 : 0;
  }
  return m;
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
/**
 * Edge pairs: for each outline pixel (in the mask, a 4-neighbour out),
 * the outward normal is the mean direction to the non-mask pixels within
 * 3 px; sample L at +-EDGE_OFFSET along it. Pairs whose inside sample is
 * not in the mask, or outside sample is, are skipped (thin strokes, holes).
 */
function edgePairs(L, mask, w, h) {
  const at = (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? mask[y * w + x] : 0);
  const out = [];
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    if (!mask[y * w + x]) continue;
    if (at(x - 1, y) && at(x + 1, y) && at(x, y - 1) && at(x, y + 1)) continue;
    let nx = 0, ny = 0;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (!at(x + dx, y + dy)) { nx += dx; ny += dy; }
    const len = Math.hypot(nx, ny);
    if (len < 1e-6) continue;
    nx /= len; ny /= len;
    const ix = Math.round(x - nx * EDGE_OFFSET), iy = Math.round(y - ny * EDGE_OFFSET);
    const ox = Math.round(x + nx * EDGE_OFFSET), oy = Math.round(y + ny * EDGE_OFFSET);
    if (ox < 0 || oy < 0 || ox >= w || oy >= h) continue;
    if (!at(ix, iy) || at(ox, oy)) continue;
    out.push(Math.abs(L[iy * w + ix] - L[oy * w + ox]));
  }
  return out.sort((a, b) => a - b);
}
const pct = (arr, p) => arr[Math.min(arr.length - 1, Math.floor(p * arr.length))];

const browser = await firefox.launch({
  headless: true,
  firefoxUserPrefs: { "webgl.force-enabled": true, "webgl.disabled": false },
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
let fails = 0;
for (const freeze of freezes) for (const mode of ["wake", "dream"]) {
  const files = {};
  for (const logo of ["on", "matte"]) {
    const page = await ctx.newPage();
    const q = `nopreload=1&noarchive=1&mode=${mode}&crystalfreeze=${freeze}${logo === "matte" ? "&crystallogo=matte" : ""}`;
    await page.goto(`${BASE}/?${q}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(9000);
    files[logo] = resolve(shots, `logo-contrast-${mode}-${freeze}-${logo}.png`);
    await page.screenshot({ path: files[logo], clip: CLIP });
    await page.close();
  }
  const A = await lmap(files.on);
  const mask = close(await magenta(files.matte), CLIP.width, CLIP.height, 2);
  const logoL = [];
  for (let i = 0; i < A.length; i++) if (mask[i]) logoL.push(A[i]);
  logoL.sort((a, b) => a - b);
  const n = logoL.length;
  const spread = n ? pct(logoL, 0.9) - pct(logoL, 0.1) : 0;
  const edges = edgePairs(A, mask, CLIP.width, CLIP.height);
  const edgeMed = edges.length ? pct(edges, 0.5) : 0;
  const share = edges.length ? edges.filter((d) => d > EDGE_PAIR_DL).length / edges.length : 0;
  const ok = n > 2000 && edges.length > 200 && edgeMed >= MIN_EDGE_MEDIAN && share >= MIN_EDGE_SHARE && spread >= MIN_SPREAD;
  if (!ok) fails++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${mode.toUpperCase()} @${freeze}s: ${edges.length} edge pairs, median |dL*| ${edgeMed.toFixed(1)} (need >= ${MIN_EDGE_MEDIAN}), ` +
      `${(share * 100).toFixed(0)}% over ${EDGE_PAIR_DL} (need >= ${MIN_EDGE_SHARE * 100}%); ` +
      `L* across face p10 ${pct(logoL, 0.1)?.toFixed(1)} / p50 ${pct(logoL, 0.5)?.toFixed(1)} / p90 ${pct(logoL, 0.9)?.toFixed(1)}, spread ${spread.toFixed(1)} (need >= ${MIN_SPREAD})`,
  );
}
await browser.close();
process.exit(fails ? 1 : 0);
