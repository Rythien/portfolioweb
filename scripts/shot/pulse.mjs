#!/usr/bin/env node
// Pulse e2e + screenshots (Firefox, dev server on :3000).
//   node scripts/shot/pulse.mjs [seal=0]
// Parks facing the seal's lit facet, fully charged, seals frozen, then:
//   shots/pulse-charged.png  reticle ready (three segments + ring)
//   shots/pulse-flight.png   the pulse travelling
//   shots/pulse-hit.png      the facet hit (ring) and shots/pulse-cracked.png after
// Then fires again from the same spot: the lit facet has moved after the
// hit, so this one lands on the body and must be wasted.
import { firefox } from "playwright";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const shots = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "shots");
const seal = process.argv[2] ?? "0";
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

await page.goto(`${BASE}/?nopreload=1&mode=dream&archiveaim=${seal}&archivecharge=3&archivefreeze=1`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(9000);
await page.locator(".archive-stage").focus();
await page.screenshot({ path: resolve(shots, "pulse-charged.png") });
const ready = await page.evaluate(() => getComputedStyle(document.querySelector(".archive-hud circle[r='16']")).opacity);
check(ready === "1", "reticle shows the pulse ready");

await page.keyboard.press("Space");
await page.waitForTimeout(110);
await page.screenshot({ path: resolve(shots, "pulse-flight.png") });
await page.waitForFunction(() => (window.__archiveHits ?? []).length >= 1, null, { timeout: 5000 });
await page.screenshot({ path: resolve(shots, "pulse-hit.png") });
await page.waitForTimeout(900);
await page.screenshot({ path: resolve(shots, "pulse-cracked.png") });
let hits = await page.evaluate(() => window.__archiveHits);
check(hits[0] === "facet", `first release hits the lit facet (${hits[0]})`);
const drained = await page.evaluate(() => getComputedStyle(document.querySelector(".archive-hud circle[r='16']")).opacity);
check(drained === "0", "release spends the charge");

// Same spot, facet moved: a body hit, wasted
await page.evaluate(() => window.__archiveRecharge());
await page.waitForTimeout(300);
await page.keyboard.press("Space");
await page.waitForFunction(() => (window.__archiveHits ?? []).length >= 2, null, { timeout: 5000 });
await page.waitForTimeout(150);
await page.screenshot({ path: resolve(shots, "pulse-wasted.png") });
hits = await page.evaluate(() => window.__archiveHits);
check(hits[1] === "body" || hits[1] === "shard", `second release, facet moved, is wasted on the ${hits[1]}`);

// Without charge, releasing does nothing
await page.keyboard.press("Space");
await page.waitForTimeout(1500);
hits = await page.evaluate(() => window.__archiveHits);
check(hits.length === 2, "no charge, no pulse");

check(errors.length === 0, `no console errors${errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""}`);
await browser.close();
process.exit(fails ? 1 : 0);
