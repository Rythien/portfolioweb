#!/usr/bin/env node
// THE VOID: the gem must read against everything.
//
//   node scripts/verify/void-contrast.mjs [--url=http://localhost:3000] [--out=shots/void]
//
// 1. Palette: the WCAG contrast of the gem against every tile colour and
//    every drifter colour (src/components/void/palette.ts). The gem's edge
//    is its darkest fill OR its 1 px dark outline, whichever separates more,
//    so each background gets max(fill, outline). Reports the worst case.
// 2. Pixels: the real logical frame (480x270, from the __void hook),
//    desaturated, in three spots: open floor, against the lit north rim,
//    and inside a cluster of drifters. The gem's brightest pixel must be
//    the brightest thing on screen. Writes <out>/desaturated.png.
// Edge (Chromium), 1440x900.
import { chromium } from "playwright";
import sharp from "sharp";
import { mkdirSync } from "fs";
import { join } from "path";
import { COLOR, ENEMY_COLORS, GEM_COLORS, TILE_COLORS } from "../../src/components/void/palette.ts";
import { launch, session } from "../_browser.mjs";

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const BASE = arg("url", "http://localhost:3000");
const OUT = arg("out", "shots/void");
mkdirSync(OUT, { recursive: true });

const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * lin(((n >> 16) & 255) / 255) + 0.7152 * lin(((n >> 8) & 255) / 255) + 0.0722 * lin((n & 255) / 255);
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

let failures = 0;
const check = (ok, msg) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`);
  if (!ok) failures++;
};

/* 1. Palette */
const darkestFill = GEM_COLORS.fill[0];
const rows = [];
for (const [group, colors] of [["tile", TILE_COLORS], ["enemy", ENEMY_COLORS]])
  for (const [name, hex] of Object.entries(colors)) {
    const fill = ratio(darkestFill, hex), outline = ratio(GEM_COLORS.outline, hex);
    rows.push({ group, name, hex, fill, outline, edge: Math.max(fill, outline) });
  }
console.log(`gem: darkest fill ${darkestFill}, outline ${GEM_COLORS.outline}, brightest fill ${COLOR.white}`);
for (const r of rows)
  console.log(`  ${r.group.padEnd(5)} ${r.name.padEnd(22)} ${r.hex}  fill ${r.fill.toFixed(2).padStart(5)}:1  outline ${r.outline.toFixed(2).padStart(5)}:1  -> edge ${r.edge.toFixed(2)}:1`);
const worst = rows.reduce((a, b) => (b.edge < a.edge ? b : a));
const worstFill = rows.reduce((a, b) => (b.fill < a.fill ? b : a));
console.log(`worst case: ${worst.edge.toFixed(2)}:1 against ${worst.name} (${worst.hex}); fill alone is weakest against ${worstFill.name} at ${worstFill.fill.toFixed(2)}:1, where the outline carries it`);
check(worst.edge >= 3, `the gem's edge is >= 3:1 against every tile and enemy colour (worst ${worst.edge.toFixed(2)}:1)`);

/* 2. Pixels */
await session(async () => {
  const browser = await launch(chromium, { channel: "msedge" });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await page.goto(`${BASE}/?nopreload=1&mode=dream&dream=void`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__void?.count?.() > 30, null, { timeout: 30000 });

  /** Max desaturated luma inside the gem's box vs everywhere else, in the logical frame. */
  const measure = () =>
    page.evaluate(() => {
      const v = window.__void;
      const p = v.world.player;
      const x = v.off.getContext("2d");
      const { data } = x.getImageData(0, 0, 480, 270);
      const L = (i) => 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      let gem = 0, rest = 0, restAt = "";
      for (let y = 0; y < 270; y++)
        for (let xx = 0; xx < 480; xx++) {
          const i = (y * 480 + xx) * 4;
          const inGem = xx >= p.x - 8 && xx <= p.x + 8 && y >= p.y - 18 && y <= p.y;
          const l = L(i);
          if (inGem) gem = Math.max(gem, l);
          else if (l > rest) { rest = l; restAt = `${xx},${y} rgb(${data[i]},${data[i + 1]},${data[i + 2]})`; }
        }
      const flashing = v.world.enemies.some((d) => d.alive && d.flash > 0) || v.world.player.invuln > 0;
      return { gem, rest, restAt, flashing, hearts: v.world.player.hearts };
    });
  const spot = async (label) => {
    let m = await measure();
    for (let i = 0; i < 20 && m.flashing; i++) { await page.waitForTimeout(50); m = await measure(); }
    check(m.gem > m.rest, `${label}: gem brightest (luma ${m.gem.toFixed(0)} vs next ${m.rest.toFixed(0)} at ${m.restAt})`);
    return m;
  };

  await spot("open floor");
  // Walk north until the ice stops us: the gem against the lit rim
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(1600);
  await page.keyboard.up("KeyW");
  await spot("against the lit north rim");
  // A cluster: six drifters in a ring 14 px round the living gem (closer than
  // they get without touching), then the game's own blur pause holds the frame
  await page.evaluate(() => {
    const w = window.__void.world, p = w.player;
    const ds = w.enemies.filter((d) => d.alive).slice(0, 6);
    ds.forEach((d, i) => {
      const a = (i / ds.length) * Math.PI * 2;
      Object.assign(d, { x: p.x + Math.cos(a) * 14, y: p.y + Math.sin(a) * 11, arrive: 0, flash: 0 });
    });
    p.invuln = 0;
    window.dispatchEvent(new Event("blur"));
  });
  await page.waitForTimeout(150);
  const cluster = await spot("inside a cluster of six drifters");
  const png = await page.screenshot();
  await sharp(png).greyscale().toFile(join(OUT, "desaturated.png"));
  console.log(`wrote ${join(OUT, "desaturated.png")} (hearts at the cluster shot: ${cluster.hearts})`);
  console.log(failures ? `\n${failures} failed` : "\nall passed");
  return failures ? 1 : 0;
});
