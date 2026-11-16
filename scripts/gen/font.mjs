#!/usr/bin/env node
// The marquee font, subset. The full Inter Tight Bold (assets/fonts, not
// served) is cut down to the glyphs the 3D headline can use and written as
// WOFF to public/fonts. WOFF, not WOFF2: troika-three-text 0.52 throws on
// WOFF2 ("woff2 fonts not supported") and reads WOFF (zlib) fine.
//
// Every character troika cannot find in this font is fetched from a CDN
// fallback at runtime, so the set is generous: all of Basic Latin (letters,
// digits, ASCII punctuation), no-break space, the middle dot the marquee
// uses as its separator, en and em dash, curly quotes and the ellipsis.
// `npm run gen:font` fails if the headline needs a glyph outside the set.
//   npm run gen:font
import subsetFont from "subset-font";
import { readFile, writeFile } from "fs/promises";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { SITE_DATA } from "../../src/content/site.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC = resolve(root, "assets", "fonts", "inter-tight-bold.ttf");
const OUT = resolve(root, "public", "fonts", "inter-tight-bold-subset.woff");

const chars = [];
for (let c = 0x20; c <= 0x7e; c++) chars.push(String.fromCodePoint(c));
chars.push(" ", "·", "–", "—", "‘", "’", "“", "”", "…");
const text = chars.join("");

// What the marquee and /lab actually draw (Marquee.tsx HEADLINE_TILE)
const h = SITE_DATA.hero;
const used = new Set(`${h.headlineLine1}  ${h.headlineLine2}  ·  `);
const missing = [...used].filter((c) => !text.includes(c));
if (missing.length) {
  console.error(`headline uses glyphs outside the subset: ${missing.map((c) => `U+${c.codePointAt(0).toString(16).toUpperCase()}`).join(", ")}`);
  process.exit(1);
}

const full = await readFile(SRC);
const woff = await subsetFont(full, text, { targetFormat: "woff" });
await writeFile(OUT, woff);
console.log(`${SRC.replace(root, ".")} ${(full.length / 1024).toFixed(1)} KB -> ${OUT.replace(root, ".")} ${(woff.length / 1024).toFixed(1)} KB, ${chars.length} glyphs`);
