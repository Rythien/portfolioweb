#!/usr/bin/env node
// THE VOID as DREAM's default, end to end, in Firefox, from a cold load:
// no query string, no saved progress, the real preloader, the real mode pill.
//
//   node scripts/verify/void-run.mjs [--url=http://localhost:3100] [--minutes=8] [--headed] [--trace]
//
// 1. Load cold: nothing of the game is loaded before an interaction.
// 2. Warm-up: the first interaction mounts the game hidden (__void, root
//    hidden, not open) without anyone entering DREAM.
// 3. Enter DREAM from the pill, scrolled down the page: the game's root is
//    clipped to a circle that grows with the flood; once settled the page
//    is suspended (scroll lock, every other body child inert, Lenis
//    stopped, the page's WebGL draws nothing).
// 4. Esc wakes: the page comes back where it was (scroll restored, inert
//    and the lock gone, the scene drawing again).
// 5. DREAM again, and the scripted player (shot/_voidbot.mjs, real keys and
//    mouse) plays all three rooms and frees all three seals; deaths are
//    allowed (fall again) and reported.
// 6. The run is won and wakes at Contact; the three archive projects'
//    Works cards read "Recovered from the dream", and no other card does.
// 7. DREAM once more starts a fresh run (no stuck "waking" card).
import { firefox } from "playwright";
import { createVoidBot } from "../shot/_voidbot.mjs";

const args = process.argv.slice(2);
const BASE = args.find((a) => a.startsWith("--url="))?.slice(6) ?? "http://localhost:3100";
const MINUTES = Number(args.find((a) => a.startsWith("--minutes="))?.slice(10) ?? 8);
const browser = await firefox.launch({ headless: !args.includes("--headed") });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log(`page error: ${e.message}`));

let failures = 0;
const check = (ok, msg) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`);
  if (!ok) failures++;
};
const t = (t0) => `${((Date.now() - t0) / 1000).toFixed(1)} s`;

/** Counts draw calls on the page's own WebGL canvas (the hero scene). */
const watchPageDraws = () => page.evaluate(() => {
  const c = [...document.querySelectorAll("canvas")].find((x) => !x.closest(".archive-root"));
  const gl = c && (c.getContext("webgl2") || c.getContext("webgl"));
  if (!gl) return false;
  if (!window.__pageDraws) {
    window.__pageDraws = 0;
    for (const fn of ["drawArrays", "drawElements"]) {
      const orig = gl[fn].bind(gl);
      gl[fn] = (...a) => { window.__pageDraws++; return orig(...a); };
    }
  }
  return true;
});
const draws = () => page.evaluate(() => window.__pageDraws);
const suspension = () => page.evaluate(() => {
  const html = document.documentElement;
  const others = [...document.body.children].filter((el) => !el.classList.contains("archive-root") && el.tagName !== "SCRIPT");
  return {
    open: html.classList.contains("archive-open"),
    overflow: getComputedStyle(html).overflow,
    inert: others.filter((el) => el.hasAttribute("inert")).length,
    others: others.length,
    lenisStopped: html.classList.contains("lenis-stopped"),
    scrollY: Math.round(window.scrollY),
  };
});

/* ── 1. Cold load ── */
const tLoad = Date.now();
await page.goto(`${BASE}/`, { waitUntil: "load" });
const pill = page.getByRole("button", { name: "Switch to dream mode" });
await page.locator('[aria-label="Loading portfolio"]').waitFor({ state: "detached", timeout: 30000 }).catch(() => {});
await pill.waitFor({ state: "visible", timeout: 30000 });
console.log(`preloader done, pill visible after ${t(tLoad)}`);
const before = await page.evaluate(() => ({ game: !!window.__void, root: !!document.querySelector(".archive-root") }));
check(!before.game && !before.root, `cold load: no game mounted before any interaction (__void ${before.game}, root ${before.root})`);

/* ── 2. Warm-up on the first interaction ── */
await page.mouse.move(400, 300);
await page.mouse.move(420, 320);
const tWarm = Date.now();
const warmed = await page.waitForFunction(() => !!window.__void, null, { timeout: 60000 }).then(() => true, () => false);
const warmState = await page.evaluate(() => {
  const r = document.querySelector(".archive-root");
  return { vis: r && getComputedStyle(r).visibility, open: document.documentElement.classList.contains("archive-open") };
});
check(warmed && warmState.vis === "hidden" && !warmState.open,
  `first interaction warms the game, hidden and asleep, ${t(tWarm)} after it (root ${warmState.vis}, archive-open ${warmState.open})`);

/* ── 3. Enter DREAM, scrolled down: flood-tracked reveal, page suspended ── */
await page.evaluate(() => window.scrollTo(0, 1400));
await page.waitForTimeout(800);
const scrolledTo = await page.evaluate(() => Math.round(window.scrollY));
check(await watchPageDraws(), "found the page's WebGL canvas to watch");
await pill.click();
// The root's clip during the flood: a circle whose radius grows
const radii = [];
const tFlood = Date.now();
while (Date.now() - tFlood < 6000) {
  const f = await page.evaluate(() => {
    const r = document.querySelector(".archive-root");
    const m = /circle\(([\d.]+)px/.exec(r?.style.clipPath ?? "");
    return { r: m ? Number(m[1]) : null, open: document.documentElement.classList.contains("archive-open") };
  });
  if (f.r !== null) radii.push(f.r);
  if (f.open) break;
  await page.waitForTimeout(16);
}
const grows = radii.length >= 3 && radii.every((r, i) => i === 0 || r >= radii[i - 1] - 0.5) && radii.at(-1) > radii[0] * 2;
check(grows, `the game is revealed through a circle that grows with the flood (${radii.length} samples, ${radii[0]?.toFixed(0)} -> ${radii.at(-1)?.toFixed(0)} px)`);
await page.waitForFunction(() => document.documentElement.classList.contains("archive-open"), null, { timeout: 15000 }).catch(() => {});
const clipAfter = await page.evaluate(() => document.querySelector(".archive-root").style.clipPath);
check(clipAfter === "", `settled: the clip is cleared (clipPath "${clipAfter}")`);
let sus = await suspension();
const d0 = await draws();
await page.waitForTimeout(1500);
const d1 = await draws();
check(sus.open && sus.overflow === "hidden" && sus.inert === sus.others && sus.others > 0 && sus.lenisStopped,
  `page suspended: archive-open ${sus.open}, overflow ${sus.overflow}, ${sus.inert}/${sus.others} other body children inert, lenis stopped ${sus.lenisStopped}`);
check(d1 - d0 === 0, `the page's R3F scene is paused (${d1 - d0} WebGL draws in 1.5 s)`);
const focused = await page.evaluate(() => document.activeElement?.getAttribute("role"));
check(focused === "application", `the game's stage has focus (active element role "${focused}")`);

/* ── 4. Esc wakes, back where the visitor was ── */
await page.keyboard.press("Escape");
await page.waitForFunction(() => !document.documentElement.classList.contains("archive-open"), null, { timeout: 5000 }).catch(() => {});
await page.waitForTimeout(2500);
sus = await suspension();
const d2 = await draws();
await page.waitForTimeout(1000);
const d3 = await draws();
check(!sus.open && sus.overflow !== "hidden" && sus.inert === 0 && !sus.lenisStopped,
  `awake: lock gone (overflow ${sus.overflow}), ${sus.inert} inert, lenis stopped ${sus.lenisStopped}`);
check(Math.abs(sus.scrollY - scrolledTo) <= 4, `scroll restored on WAKE (${sus.scrollY} vs ${scrolledTo} before DREAM)`);
check(d3 - d2 > 0, `the page's scene draws again (${d3 - d2} WebGL draws in 1 s)`);

/* ── 5. DREAM again: a whole run ── */
await page.getByRole("button", { name: "Switch to dream mode" }).click();
await page.waitForFunction(() => document.documentElement.classList.contains("archive-open"), null, { timeout: 15000 });
await page.waitForTimeout(300);
const bot = createVoidBot(page, { trace: args.includes("--trace") });
const tRun = Date.now();
let last = null, lastLog = 0, freedAt = [];
while (Date.now() - tRun < MINUTES * 60000) {
  const s = await bot.tick();
  if (!s) break;
  s.freed.forEach((f, i) => { if (f && !freedAt[i]) { freedAt[i] = t(tRun); console.log(`  room ${i + 1}'s seal freed at ${freedAt[i]}`); } });
  if (Date.now() - lastLog > 15000) {
    lastLog = Date.now();
    console.log(`  ${t(tRun)}: room ${s.room + 1}, ${s.ds.length} enemies, seal state ${s.sealState}, hearts ${s.hearts}, deaths ${bot.stats.deaths}`);
  }
  last = s;
  if (s.phase === "won") break;
}
await bot.release();
const st = bot.stats;
console.log(`run: ${t(tRun)}, doorways ${st.rooms}, deaths ${st.deaths}, seals ${st.sealTimes.map((x) => x.toFixed(1) + " s").join(", ") || "-"} (game time, rising to freed)`);
check(last?.phase === "won", `the run is won (phase ${last?.phase}, room ${last ? last.room + 1 : "-"})`);
check(st.rooms >= 2, `played through all three rooms (${st.rooms} doorways walked through)`);
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("archive-progress-v1") || "{}"));
check(saved.freed?.length === 3 && saved.recovered?.length === 3,
  `all three projects freed and recovered (freed ${JSON.stringify(saved.freed)}, recovered ${JSON.stringify(saved.recovered)})`);

/* ── 6. Wakes at Contact; the Works cards are marked ── */
await page.waitForFunction(() => !document.documentElement.classList.contains("archive-open"), null, { timeout: 10000 }).catch(() => {});
await page.waitForTimeout(3000);
const woke = await page.evaluate(() => {
  const c = document.getElementById("contact");
  return { open: document.documentElement.classList.contains("archive-open"), top: c ? Math.round(c.getBoundingClientRect().top) : null, path: location.pathname };
});
check(!woke.open && woke.top !== null && Math.abs(woke.top) < 120 && woke.path === "/",
  `the run ends and wakes at Contact (#contact top ${woke.top} px, path ${woke.path})`);
const cards = await page.evaluate(() => [...document.querySelectorAll("#works article")].map((a) => ({
  slug: a.querySelector('a[href^="/project/"]')?.getAttribute("href")?.split("/").pop() ?? "?",
  marked: /Recovered from the dream/i.test(a.textContent),
})));
const want = new Set(saved.recovered ?? []);
console.log(`  Works cards: ${cards.map((c) => `${c.slug} ${c.marked ? "RECOVERED" : "-"}`).join(", ")}`);
check(cards.filter((c) => c.marked).length === 3 && cards.every((c) => c.marked === want.has(c.slug)),
  `the three freed projects' Works cards read "Recovered from the dream", no other card does`);

/* ── 7. DREAM after a won run: a fresh run, not the old card ── */
if (woke.open) {
  check(false, "DREAM again after the win: skipped, the run never woke");
  await browser.close();
  console.log(`\n${failures} failed`);
  process.exit(1);
}
await page.getByRole("button", { name: "Switch to dream mode" }).click();
await page.waitForFunction(() => document.documentElement.classList.contains("archive-open"), null, { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(800);
const again = await page.evaluate(() => ({
  phase: window.__void.world.phase,
  room: window.__void.world.roomIndex + 1,
  card: !!document.querySelector('.archive-root [role="dialog"]'),
}));
check(again.phase === "play" && !again.card, `DREAM again after the win starts a new run (phase ${again.phase}, room ${again.room}, card ${again.card})`);

await browser.close();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
