#!/usr/bin/env node
// THE VOID: the boon card is keyboard-operable, in the game's pixel style,
// and pauses the run while it is open.
//
//   node scripts/verify/void-boons.mjs [--url=http://localhost:3100]
//
// Opens DREAM (room 1), puts an offer on the world through the __void hook
// (the rules that make offers are covered by engine.test.ts; this is about
// the card), then checks: the card shows, named for the freed project, with
// focus on its first boon; the run is paused (game time frozen, held keys
// do not move the gem); arrows move focus and wrap; Enter, Space and the
// digit keys each take the right boon; taking one closes the card, resumes
// the run and gives focus back to the stage; square corners, monospace.
// Edge (Chromium), 1440x900.
import { chromium } from "playwright";
import { launch, session } from "../_browser.mjs";

await session(async () => {
  const BASE = process.argv.find((a) => a.startsWith("--url="))?.slice(6) ?? "http://localhost:3100";
  const browser = await launch(chromium, { channel: "msedge" });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  page.on("pageerror", (e) => console.log(`page error: ${e.message}`));
  await page.goto(`${BASE}/?nopreload=1&mode=dream`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__void?.count?.() > 30, null, { timeout: 30000 });

  let failures = 0;
  const check = (ok, msg) => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`);
    if (!ok) failures++;
  };
  const offer = (ids) => page.evaluate((ids) => {
    const w = window.__void.world;
    w.player.invuln = 9999; // the drifters must not end the run while we look
    w.offer = ids;
  }, ids);
  const state = () => page.evaluate(() => {
    const w = window.__void.world;
    const card = [...document.querySelectorAll('.archive-root [role="dialog"]')].find((d) => /gifts/i.test(d.textContent));
    const buttons = card ? [...card.querySelectorAll("button")] : [];
    const a = document.activeElement;
    return {
      t: w.t,
      x: w.player.x,
      boons: [...w.boons],
      hearts: w.player.hearts,
      offer: w.offer ? [...w.offer] : null,
      card: card ? card.textContent : null,
      focus: buttons.indexOf(a),
      stageFocused: a?.getAttribute("role") === "application",
      names: buttons.map((b) => b.textContent),
      radius: card ? [card.firstElementChild, ...buttons].map((el) => getComputedStyle(el).borderRadius) : [],
      font: buttons[0] ? getComputedStyle(buttons[0]).fontFamily : "",
    };
  });

  // 1. The card opens on the offer, focus on its first boon
  await offer(["wide", "dash", "heart"]);
  await page.waitForTimeout(300);
  let s = await state();
  const project = /Freed · (.+?)Take/.exec(s.card ?? "")?.[1]?.trim();
  check(!!s.card, `the card shows ("${s.card?.slice(0, 80)}")`);
  check(!!project && s.names.length === 3 && s.names.every((n) => n.includes(project)), `each boon is named for the freed project (${project}): ${s.names.map((n) => n.slice(0, 40)).join(" | ")}`);
  check(s.focus === 0, `focus on the first boon (${s.focus})`);
  check(s.radius.length === 4 && s.radius.every((r) => r === "0px"), `square corners, panel and buttons (${s.radius.join(", ")})`);
  check(/mono/i.test(s.font), `monospace (${s.font.slice(0, 40)})`);

  // 2. Paused: game time frozen, a held key does not move the gem
  const t0 = s.t, x0 = s.x;
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(800);
  await page.keyboard.up("KeyD");
  s = await state();
  check(s.t === t0 && s.x === x0, `paused: game time ${t0.toFixed(3)} -> ${s.t.toFixed(3)}, gem x ${x0.toFixed(1)} -> ${s.x.toFixed(1)}`);

  // 3. Arrows move focus and wrap
  await page.keyboard.press("ArrowRight");
  const r1 = (await state()).focus;
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  const r2 = (await state()).focus;
  check(r1 === 1 && r2 === 2, `ArrowRight -> ${r1}, ArrowLeft x2 wraps -> ${r2}`);

  // 4. Enter takes the focused boon (the third: heart)
  await page.keyboard.press("Enter");
  await page.waitForTimeout(250);
  s = await state();
  check(s.boons.join() === "heart" && s.hearts === 4, `Enter took the focused boon (${s.boons.join()}, hearts ${s.hearts})`);
  check(!s.card && s.offer === null, "the card closes");
  check(s.stageFocused, "focus returns to the game");
  const t1 = s.t;
  await page.waitForTimeout(400);
  check((await state()).t > t1, "the run resumes");

  // 5. A digit takes that boon
  await offer(["quick", "pierce", "shield"]);
  await page.waitForTimeout(300);
  await page.keyboard.press("Digit2");
  await page.waitForTimeout(250);
  s = await state();
  check(s.boons.join() === "heart,pierce" && !s.card, `2 took the second (${s.boons.join()})`);

  // 6. Space presses the focused one (the first)
  await offer(["wide", "dash", "frost"]);
  await page.waitForTimeout(300);
  await page.keyboard.press("Space");
  await page.waitForTimeout(250);
  s = await state();
  check(s.boons.join() === "heart,pierce,wide" && !s.card, `Space took the focused first (${s.boons.join()})`);

  console.log(failures ? `\n${failures} failed` : "\nall passed");
  return failures ? 1 : 0;
});
