#!/usr/bin/env node
// THE VOID: the last seal ends the run and wakes the visitor at Contact.
//
//   node scripts/verify/void-end.mjs [--url=http://localhost:3000]
//
// Starts at room 3's seal (?voidroom=3&voidwave=none), brings it to its
// last hit through the __void hook, and lands that hit with a real J press
// in its real window. Then checks: the run is "won"; the card reads ALL
// THREE FREED / WAKING AT CONTACT with no "fall again"; the project is
// recorded freed (localStorage archive-progress-v1, the store the awake page
// reads); and the page wakes on its own, scrolled to #contact.
// Edge (Chromium), 1280x720.
import { chromium } from "playwright";

const BASE = process.argv.find((a) => a.startsWith("--url="))?.slice(6) ?? "http://localhost:3000";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto(`${BASE}/?nopreload=1&mode=dream&dream=void&voidroom=3&voidwave=none`, { waitUntil: "load" });
await page.waitForFunction(() => window.__void?.count?.() > 30, null, { timeout: 30000 });

let failures = 0;
const check = (ok, msg) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`);
  if (!ok) failures++;
};

// Its window (the gem kept safe meanwhile: this checks the ending, not the dodging)
await page.evaluate(() => { window.__void.world.seal.hp = 1; });
await page.waitForFunction(() => {
  const w = window.__void.world;
  w.player.invuln = 9;
  return w.seal.state === 5;
}, null, { timeout: 30000, polling: 16 });
await page.evaluate(() => {
  const w = window.__void.world, p = w.player;
  p.x = w.seal.x; p.y = w.seal.y + 26; p.faceX = 0; p.faceY = -1; p.invuln = 0;
});
await page.keyboard.press("KeyJ");
await page.waitForFunction(() => window.__void.world.seal.state === 7, null, { timeout: 3000 }).catch(() => {});
check(await page.evaluate(() => window.__void.world.seal.state === 7), "a J in the window lands the last hit: the seal is freed");

// The bloom, then the run is won and the card shows
await page.waitForFunction(() => window.__void.world.phase === "won", null, { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(700);
const card = await page.evaluate(() => {
  const c = document.querySelector('.archive-root [role="dialog"]');
  return c ? { text: c.textContent, buttons: c.querySelectorAll("button").length, opacity: Number(getComputedStyle(c).opacity) } : null;
});
check(await page.evaluate(() => window.__void.world.phase === "won"), "freeing room 3's seal wins the run");
check(card && /all three freed/i.test(card.text) && /waking at contact/i.test(card.text) && card.buttons === 0,
  `the card: "${card?.text}" with ${card?.buttons} buttons`);
const slug = await page.evaluate(() => window.__void && JSON.parse(localStorage.getItem("archive-progress-v1") || "{}").freed);
check(Array.isArray(slug) && slug.length >= 1, `the project is recorded freed (archive-progress-v1 freed: ${JSON.stringify(slug)})`);
await page.keyboard.press("KeyR");
check(await page.evaluate(() => window.__void.world.phase === "won"), "R does nothing on a won run");

// It wakes on its own, at Contact
await page.waitForFunction(() => !document.documentElement.classList.contains("archive-open"), null, { timeout: 10000 }).catch(() => {});
await page.waitForTimeout(2500);
const woke = await page.evaluate(() => {
  const c = document.getElementById("contact");
  return {
    open: document.documentElement.classList.contains("archive-open"),
    contactTop: c ? Math.round(c.getBoundingClientRect().top) : null,
  };
});
check(!woke.open && woke.contactTop !== null && Math.abs(woke.contactTop) < 120,
  `woke at Contact (archive-open ${woke.open}, #contact top ${woke.contactTop} px from the viewport top)`);

await browser.close();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
