#!/usr/bin/env node
/**
 * Open Graph crops of the project covers.
 *
 *   npm run gen:og
 *
 * The case-study card (src/app/project/[slug]/opengraph-image.tsx) is
 * drawn with next/og, whose renderer (Satori) cannot decode WebP. For each
 * public/projects/<slug>/cover.webp this writes og-cover.jpg: the WAKE
 * cover cropped to the card's 1200x630, centred, JPEG q82. Committed, like
 * the covers, so a deploy never depends on sharp at build time.
 */
import sharp from "sharp";
import { readdirSync, existsSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "public", "projects");
for (const slug of readdirSync(root)) {
  const src = join(root, slug, "cover.webp");
  if (!existsSync(src)) continue;
  const out = join(root, slug, "og-cover.jpg");
  const info = await sharp(src).resize(1200, 630, { fit: "cover", position: "centre" }).jpeg({ quality: 82, mozjpeg: true }).toFile(out);
  console.log(`${slug}/og-cover.jpg  ${info.width}x${info.height}  ${Math.round(info.size / 1024)} KB`);
}
