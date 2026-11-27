#!/usr/bin/env node
// Upper vs lower glass tone (Firefox, dev server on :3000). Logo hidden
// (crystallogo=0); two pure-glass patches inside the crystal, above and
// below the marquee band, at several frozen poses. Passes when, per pose,
// mean L* of the two patches is within 3 and both read cool (b* < 0, i.e.
// bluer than neutral).
// Usage: node scripts/verify/glass-tone.mjs [mode=wake] [freezes=0,2,4,6,8]
import { firefox } from "playwright";
import sharp from "sharp";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { launch, session } from "../_browser.mjs";

const shots = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "shots");
const BASE = process.env.BASE ?? "http://localhost:3000";
const mode = process.argv[2] ?? "wake";
const freezes = (process.argv[3] ?? "0,2,4,6,8").split(",");
const CLIP = { x: 470, y: 110, width: 780, height: 680 };
// Patches in CLIP coordinates: inside the silhouette at every pose, clear
// of the headline band (y ~ 260-455) and the logo
const PATCH = {
  upper: { x: 250, y: 140, w: 200, h: 70 },
  lower: { x: 250, y: 475, w: 200, h: 60 },
};
const MAX_DL = 3;

const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function lab(r, g, b) {
  const R = lin(r / 255), G = lin(g / 255), B = lin(b / 255);
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const Y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
async function patchLab(file, p) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let L = 0, A = 0, B = 0, n = 0;
  for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) {
    const i = (y * info.width + x) * 3;
    const [l, a, b] = lab(data[i], data[i + 1], data[i + 2]);
    L += l; A += a; B += b; n++;
  }
  return [L / n, A / n, B / n];
}

await session(async () => {
  const browser = await launch(firefox, {
    firefoxUserPrefs: { "webgl.force-enabled": true, "webgl.disabled": false },
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  let fails = 0;
  for (const freeze of freezes) {
    const page = await ctx.newPage();
    await page.goto(`${BASE}/?nopreload=1&noarchive=1&mode=${mode}&crystalfreeze=${freeze}&crystallogo=0${process.env.EXTRA_QUERY ? "&" + process.env.EXTRA_QUERY : ""}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(9000);
    const file = resolve(shots, `glass-tone-${mode}-${freeze}.png`);
    await page.screenshot({ path: file, clip: CLIP });
    await page.close();
    const u = await patchLab(file, PATCH.upper);
    const l = await patchLab(file, PATCH.lower);
    const dL = Math.abs(u[0] - l[0]);
    const ok = dL <= MAX_DL && u[2] < 0 && l[2] < 0;
    if (!ok) fails++;
    const f = (v) => `L* ${v[0].toFixed(1)} a* ${v[1].toFixed(1)} b* ${v[2].toFixed(1)}`;
    console.log(`${ok ? "PASS" : "FAIL"}  ${mode.toUpperCase()} @${freeze}s: upper ${f(u)} | lower ${f(l)} | dL* ${dL.toFixed(1)} (need <= ${MAX_DL}, both b* < 0)`);
  }
  return fails ? 1 : 0;
});
