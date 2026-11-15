#!/usr/bin/env node
// The ending (Firefox, dev server on :3000). Two seals arrive freed (saved
// progress); freeing the third and floating into its panel starts it:
// shards converge, the crystal forms, the fog lifts, the line appears,
// then the visitor wakes at Contact.
// Shots: shots/end-converge.png, end-form.png, end-line.png
import { firefox } from "playwright";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const shots = resolve(dirname(fileURLToPath(import.meta.url)), "..", "shots");
const BASE = process.env.BASE ?? "http://localhost:3000";
const browser = await firefox.launch({ headless: true, firefoxUserPrefs: { "webgl.force-enabled": true } });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`); if (!ok) fails++; };

await page.goto(`${BASE}/?nopreload=1&mode=dream&noarchive=1`, { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.setItem("archive-progress-v1", JSON.stringify({ freed: ["4c-iced-coffee", "kinetic-archive"], recovered: [], hintSeen: true })));
await page.goto(`${BASE}/?nopreload=1&mode=dream&archiveaim=0&archivecharge=3&archivefreeze=1`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(9000);
await page.locator(".archive-stage").focus();
check((await page.locator(".archive-count").innerText().catch(() => "")).includes("2"), "HUD counts the two saved seals");
for (let k = 0; k < 3; k++) {
  await page.evaluate(() => { window.__archiveAim(0); window.__archiveRecharge(); });
  await page.waitForTimeout(400);
  await page.keyboard.press("Space");
  await page.waitForFunction((n) => (window.__archiveHits ?? []).length >= n, k + 1, { timeout: 5000 });
  await page.waitForTimeout(400);
}
await page.waitForTimeout(2500);
// Float into the last panel: the ending starts at once
await page.evaluate(() => { const f = window.__archiveFlight; f.px = 2; f.py = 3; f.pz = -22; f.vx = f.vy = f.vz = 0; });
await page.waitForTimeout(1600);
await page.screenshot({ path: resolve(shots, "end-converge.png") });
await page.waitForTimeout(2000);
await page.screenshot({ path: resolve(shots, "end-form.png") });
await page.waitForTimeout(3000);
await page.screenshot({ path: resolve(shots, "end-line.png") });
check((await page.locator(".archive-end").innerText()) === "The archive is yours.", "the line appears");
await page.waitForFunction(() => document.documentElement.dataset.mode === "wake", null, { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(2500);
const where = await page.evaluate(() => {
  const c = document.getElementById("contact").getBoundingClientRect();
  return { mode: document.documentElement.dataset.mode, top: c.top, path: location.pathname };
});
check(where.mode === "wake" && where.path === "/", `wakes on the home page (${where.mode}, ${where.path})`);
check(Math.abs(where.top) < 120, `at Contact (its top ${where.top.toFixed(0)} px from the viewport top)`);
check(errors.length === 0, `no console errors${errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""}`);
await browser.close();
process.exit(fails ? 1 : 0);
