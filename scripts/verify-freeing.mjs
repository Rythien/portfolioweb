#!/usr/bin/env node
// Freeing a project (Firefox, dev server on :3000).
//   node scripts/verify-freeing.mjs [seal=0]
// Three facet hits free the seal: it bursts, the panel blooms; floating
// into the panel marks the project; waking opens its case study; the
// awake page's card carries "Recovered from the dream".
// Shots: shots/free-burst.png, free-bloom.png, free-panel.png
import { firefox } from "playwright";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const shots = resolve(dirname(fileURLToPath(import.meta.url)), "..", "shots");
const seal = Number(process.argv[2] ?? "0");
const BASE = process.env.BASE ?? "http://localhost:3000";
const browser = await firefox.launch({ headless: true, firefoxUserPrefs: { "webgl.force-enabled": true } });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
let fails = 0;
const check = (ok, msg) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`);
  if (!ok) fails++;
};

await page.goto(`${BASE}/?nopreload=1&mode=dream`, { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.removeItem("archive-progress-v1"));
await page.goto(`${BASE}/?nopreload=1&mode=dream&archiveaim=${seal}&archivecharge=3&archivefreeze=1`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(9000);
await page.locator(".archive-stage").focus();

for (let k = 0; k < 3; k++) {
  await page.evaluate((i) => { window.__archiveAim(i); window.__archiveRecharge(); }, seal);
  await page.waitForTimeout(400);
  await page.keyboard.press("Space");
  await page.waitForFunction((n) => (window.__archiveHits ?? []).length >= n, k + 1, { timeout: 5000 });
  if (k === 2) {
    await page.waitForTimeout(120);
    await page.screenshot({ path: resolve(shots, "free-burst.png") });
  } else await page.waitForTimeout(500);
}
const hits = await page.evaluate(() => window.__archiveHits);
check(hits.every((h) => h === "facet"), `three releases all hit the lit facet (${hits.join(", ")})`);
await page.waitForTimeout(1100);
await page.screenshot({ path: resolve(shots, "free-bloom.png") });
await page.waitForTimeout(2500);
await page.screenshot({ path: resolve(shots, "free-panel.png") });
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("archive-progress-v1") ?? "{}"));
check(saved.freed?.length === 1, `freed project saved to localStorage (${JSON.stringify(saved.freed)})`);

// Float into the panel: park the camera at the seal centre
const slug = saved.freed?.[0];
await page.evaluate((i) => {
  const f = window.__archiveFlight;
  const spots = [[2, 3, -24], [-31, -5, 4], [29, 7, 9]];
  const [x, y, z] = spots[i];
  f.px = x; f.py = y; f.pz = z + 2; f.vx = f.vy = f.vz = 0;
}, seal);
await page.waitForTimeout(600);
const after = await page.evaluate(() => JSON.parse(localStorage.getItem("archive-progress-v1") ?? "{}"));
check(after.recovered?.includes(slug), `floating into the panel recovers ${slug}`);

// Wake: the case study opens once the flood has run back
await page.keyboard.press("Escape");
await page.waitForURL(`**/project/${slug}`, { timeout: 15000 }).catch(() => {});
check(page.url().includes(`/project/${slug}`), `waking opens the case study (${page.url()})`);

await page.goto(`${BASE}/?nopreload=1&mode=wake&noarchive=1`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4000);
const marks = await page.locator("#works article", { hasText: "Recovered from the dream" }).count();
check(marks === 1, `one card on the awake page carries the mark (${marks})`);

check(errors.length === 0, `no console errors${errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""}`);
await browser.close();
process.exit(fails ? 1 : 0);
