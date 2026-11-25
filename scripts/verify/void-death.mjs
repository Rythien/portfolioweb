#!/usr/bin/env node
// THE VOID: death is a state with a way on and a way out.
//
//   node scripts/verify/void-death.mjs [--url=http://localhost:3000]
//
// Stands still in the room until the drifters take every heart, then
// checks: the run is "dead", the arena is frozen, the YOU WOKE card shows
// with the room reached; R falls again (full hearts, a fresh wave of 8);
// a second death, then Escape, wakes (the page comes back). All along it
// samples that the player is never left with no gem AND no card.
// Edge (Chromium), 1440x900.
import { chromium } from "playwright";

const BASE = process.argv.find((a) => a.startsWith("--url="))?.slice(6) ?? "http://localhost:3000";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.goto(`${BASE}/?nopreload=1&mode=dream&dream=void`, { waitUntil: "load" });
await page.waitForFunction(() => window.__void?.count?.() > 30, null, { timeout: 30000 });

let failures = 0;
const check = (ok, msg) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`);
  if (!ok) failures++;
};
const state = () =>
  page.evaluate(() => {
    const w = window.__void.world;
    const card = [...document.querySelectorAll('.archive-root [role="dialog"]')][0];
    return {
      phase: w.phase,
      hearts: w.player.hearts,
      alive: w.enemies.filter((d) => d.alive).length,
      pos: w.enemies.filter((d) => d.alive).map((d) => `${d.x.toFixed(2)},${d.y.toFixed(2)}`).join(" "),
      card: card ? { text: card.textContent, opacity: Number(getComputedStyle(card).opacity) } : null,
    };
  });

/** Waits for death, sampling the "never stranded" rule every 100 ms. */
async function waitForDeath(label) {
  let stranded = 0;
  for (let i = 0; i < 400; i++) {
    const s = await state();
    // Stranded: no gem in play AND no visible way out
    if (s.phase !== "play" && i > 0 && !(s.card && s.card.opacity > 0.5)) {
      // allowed only during the 0.5 s fade before the card
      const t = await page.evaluate(() => window.__void.world.endT);
      if (t > 0.9) stranded++;
    }
    if (s.phase === "dead") {
      await page.waitForTimeout(900); // fade + card
      return { s: await state(), stranded };
    }
    await page.waitForTimeout(100);
  }
  return { s: await state(), stranded, timeout: true };
}

// 1. Stand still: the wave closes in and takes every heart
const first = await waitForDeath("first");
check(!first.timeout, `the drifters end the run (${first.timeout ? "never died in 40 s" : "died"})`);
check(first.s.phase === "dead" && first.s.hearts <= 0, `phase dead, hearts ${first.s.hearts}`);
check(first.s.card && first.s.card.opacity > 0.95 && /you woke/i.test(first.s.card.text) && /room 1 reached/i.test(first.s.card.text),
  `YOU WOKE card shown: "${first.s.card?.text}" at opacity ${first.s.card?.opacity}`);
const pos0 = first.s.pos;
await page.waitForTimeout(1500);
check((await state()).pos === pos0, "the arena is frozen after death (no drifter moved in 1.5 s)");
check(first.stranded === 0, `never stranded: ${first.stranded} samples with no gem and no card`);

// 2. R falls again
await page.keyboard.press("KeyR");
await page.waitForTimeout(200);
let s = await state();
check(s.phase === "play" && s.hearts === 3 && s.alive === 8, `R: phase ${s.phase}, hearts ${s.hearts}, ${s.alive} drifters`);
check(!s.card, "the card is gone in play");

// 3. Die again, then Escape wakes
const second = await waitForDeath("second");
check(second.s.phase === "dead", "a second run also ends in the card");
check(second.stranded === 0, `never stranded on the second run either (${second.stranded})`);
await page.keyboard.press("Escape");
await page.waitForTimeout(2500);
const woke = await page.evaluate(() => ({
  open: document.documentElement.classList.contains("archive-open"),
  hidden: document.querySelector(".archive-root")?.getAttribute("aria-hidden"),
}));
check(!woke.open && woke.hidden === "true", `Escape wakes (archive-open ${woke.open}, root aria-hidden ${woke.hidden})`);

await browser.close();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
