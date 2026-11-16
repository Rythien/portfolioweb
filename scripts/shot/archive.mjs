#!/usr/bin/env node
// Archive screenshots (Firefox, dev server on :3000).
//   node scripts/shot/archive.mjs <name> [archiveat=<i>|start] [waitMs=9000] [extra query]
// Loads straight into DREAM (the Archive opens at once) and saves
// shots/<name>.png; archiveat=<i> parks the camera in front of seal i.
import { firefox } from "playwright";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const shots = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "shots");
const [name = "archive", at = "start", wait = "9000", extra = ""] = process.argv.slice(2);
const BASE = process.env.BASE ?? "http://localhost:3000";

const browser = await firefox.launch({
  headless: true,
  firefoxUserPrefs: { "webgl.force-enabled": true, "webgl.disabled": false },
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const q = `nopreload=1&mode=dream${at === "start" ? "" : `&archiveat=${at}`}${extra ? "&" + extra : ""}`;
await page.goto(`${BASE}/?${q}`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(Number(wait));
await page.screenshot({ path: resolve(shots, `${name}.png`) });
console.log(`shots/${name}.png`);
if (errors.length) console.log("console errors:", errors.slice(0, 5).join(" | "));
await browser.close();
