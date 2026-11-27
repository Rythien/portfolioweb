#!/usr/bin/env node
// The hero crystal's value range, measured: L* histogram of the glass's
// own pixels (WAKE and DREAM, 1440x900, frozen pose).
//
//   node scripts/verify/crystal-values.mjs [--url=http://localhost:3000] [--freeze=2] [--wait=16]
//
// The glass's exact silhouette comes from a crystalview=matte frame (every
// crystal glass fragment flat magenta); the same pose is then loaded as it
// really looks and every pixel inside that silhouette is converted to L*.
// Edge pixels (antialiased into the page) are dropped by eroding the mask
// 2 px. Passes when, in each mode:
//   - the range spans L* <= 10 (p0.5) to L* >= 95 (p99.5)
//   - a real dark population: >= 15% of the glass below L* 30
// A frosted ball sits almost entirely between 70 and 95 and fails both.
// Edge (Chromium): headless Firefox can hand screenshots a stale WebGL frame.
import { chromium } from "playwright";
import sharp from "sharp";
import { launch, session } from "../_browser.mjs";

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const BASE = arg("url", "http://localhost:3000");
const FREEZE = arg("freeze", "2");
const WAIT = Number(arg("wait", "16")) * 1000;

const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function Lstar(r, g, b) {
  const Y = 0.2126 * lin(r / 255) + 0.7152 * lin(g / 255) + 0.0722 * lin(b / 255);
  return Y > 216 / 24389 ? 116 * Math.cbrt(Y) - 16 : (24389 / 27) * Y;
}

async function frame(browser, mode, extra) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/?nopreload=1&noarchive=1&mode=${mode}&crystalfreeze=${FREEZE}${extra}`, { waitUntil: "load" });
  await p.mouse.move(1439, 899);
  await p.waitForTimeout(WAIT);
  const png = await p.screenshot();
  await ctx.close();
  return sharp(png).raw().toBuffer({ resolveWithObject: true });
}

await session(async () => {
  const browser = await launch(chromium, { channel: "msedge" });
  let ok = true;
  for (const mode of ["wake", "dream"]) {
    const m = await frame(browser, mode, "&crystalview=matte");
    const f = await frame(browser, mode, "");
    const { width: W, height: H, channels: C } = m.info;
    const raw = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) {
      const r = m.data[i * C], g = m.data[i * C + 1], b = m.data[i * C + 2];
      raw[i] = r > 200 && g < 60 && b > 200 ? 1 : 0;
    }
    // Erode 2 px: keep only pixels whose 5x5 neighbourhood is all glass
    const L = [];
    for (let y = 2; y < H - 2; y++)
      for (let x = 2; x < W - 2; x++) {
        if (!raw[y * W + x]) continue;
        let all = true;
        for (let dy = -2; dy <= 2 && all; dy++) for (let dx = -2; dx <= 2; dx++) if (!raw[(y + dy) * W + x + dx]) { all = false; break; }
        if (!all) continue;
        const i = (y * W + x) * C;
        L.push(Lstar(f.data[i], f.data[i + 1], f.data[i + 2]));
      }
    if (L.length < 5000) {
      console.log(`FAIL  ${mode}: only ${L.length} glass pixels found (matte view missing?)`);
      ok = false;
      continue;
    }
    L.sort((a, b) => a - b);
    const pct = (q) => L[Math.min(L.length - 1, Math.floor(q * L.length))];
    const share = (lo, hi) => L.filter((v) => v >= lo && v < hi).length / L.length;
    const bins = Array.from({ length: 10 }, (_, k) => share(k * 10, k === 9 ? 101 : k * 10 + 10));
    const lo = pct(0.005), hi = pct(0.995), dark = share(0, 30);
    const pass = lo <= 10 && hi >= 95 && dark >= 0.15;
    ok &&= pass;
    console.log(
      `${pass ? "PASS" : "FAIL"}  ${mode}: ${L.length} px; p0.5 ${lo.toFixed(1)} p5 ${pct(0.05).toFixed(1)} p50 ${pct(0.5).toFixed(1)} p95 ${pct(0.95).toFixed(1)} p99.5 ${hi.toFixed(1)}; below L*30 ${(dark * 100).toFixed(1)}%, 70-95 ${(share(70, 95) * 100).toFixed(1)}%`,
    );
    console.log(`      ${bins.map((s, k) => `${k * 10}-${k * 10 + 10}: ${(s * 100).toFixed(1).padStart(4)}%`).join("  ")}`);
  }
  return ok ? 0 : 1;
});
