#!/usr/bin/env node
// THE ARCHIVE e2e (Firefox): DREAM opens the Archive full screen with the
// page suspended, floating works by pointer and keyboard, WAKE restores
// the page at its scroll position. Needs the dev server on :3000.
// Usage: node scripts/verify-archive.mjs [--rm]   (--rm = reduced motion)
import { firefox } from "playwright";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const shots = resolve(dirname(fileURLToPath(import.meta.url)), "..", "shots");
const RM = process.argv.includes("--rm");
const tag = RM ? "-rm" : "";
const BASE = process.env.BASE ?? "http://localhost:3000";

const browser = await firefox.launch({
  headless: true,
  firefoxUserPrefs: { "webgl.force-enabled": true, "webgl.disabled": false },
});
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: RM ? "reduce" : "no-preference",
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

let fails = 0;
const check = (ok, msg) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`);
  if (!ok) fails++;
};

await page.goto(`${BASE}/?nopreload=1&mode=wake`, { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.setItem("searon-mode", "wake"));
await page.waitForTimeout(7000);
await page.mouse.wheel(0, 700);
await page.waitForTimeout(1500);
const scrollBefore = await page.evaluate(() => window.scrollY);
const warmMs = await page.evaluate(() => window.__archiveWarmMs);
check(typeof warmMs === "number", `Archive warmed during WAKE idle (compile + first frame ${warmMs?.toFixed(0)} ms)`);

// Handover timing, measured in the page from the click itself
await page.evaluate(() => {
  const m = (window.__handover = { t0: 0, firstArchiveFrame: null, floodDone: null, fullVisible: null, maxGap: 0, done: false });
  window.addEventListener("click", () => {
    m.t0 = performance.now();
    const frames0 = window.__archiveFrames ?? 0;
    let last = m.t0;
    const f = () => {
      const now = performance.now();
      if (now - last > m.maxGap) { m.maxGap = now - last; m.maxGapAt = last - m.t0; }
      if (now - last > 50) (m.gaps ??= []).push([Math.round(last - m.t0), Math.round(now - last)]);
      last = now;
      if (m.firstArchiveFrame === null && (window.__archiveFrames ?? 0) > frames0) m.firstArchiveFrame = now - m.t0;
      const root = document.querySelector(".archive-root");
      const full = root && getComputedStyle(root).visibility === "visible" && !root.style.clipPath;
      if (m.floodDone === null && window.__archiveOpenedAt > m.t0) m.floodDone = window.__archiveOpenedAt - m.t0;
      if (m.fullVisible === null && full && m.floodDone !== null) m.fullVisible = now - m.t0;
      if (m.fullVisible !== null || now - m.t0 > 10000) { m.done = true; return; }
      requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  }, { capture: true, once: true });
});
await page.getByRole("button", { name: "Switch to dream mode" }).click();
// NOSHOT=1: skip the mid-flood screenshot (it stalls the page and would
// show up as a long frame in the timing)
if (!process.env.NOSHOT) {
  await page.waitForTimeout(RM ? 0 : 300);
  await page.screenshot({ path: resolve(shots, `archive-handover-mid${tag}.png`) });
}
await page.waitForFunction(() => window.__handover.done, null, { timeout: 15000 });
const h = await page.evaluate(() => window.__handover);
console.log(`INFO  handover: first Archive frame ${h.firstArchiveFrame?.toFixed(0)} ms after click, flood done ${h.floodDone?.toFixed(0)} ms, Archive full screen ${h.fullVisible?.toFixed(0)} ms, longest frame ${h.maxGap.toFixed(0)} ms starting ${h.maxGapAt?.toFixed(0)} ms; frames > 50 ms [start, length]: ${JSON.stringify(h.gaps ?? [])}`);
check(h.fullVisible !== null && h.fullVisible - h.floodDone <= 400, `Archive full screen within 400 ms of the flood completing (${(h.fullVisible - h.floodDone).toFixed(0)} ms)`);
check(h.firstArchiveFrame !== null && (RM || h.firstArchiveFrame < h.floodDone), "Archive was already rendering behind the flood");
await page.waitForTimeout(2500);
await page.screenshot({ path: resolve(shots, `archive-float-0${tag}.png`) });

const suspended = await page.evaluate(() => ({
  overflow: document.documentElement.style.overflow,
  headerInert: !!document.querySelector("header")?.closest("[inert]"),
  mainInert: !!document.getElementById("main-content")?.closest("[inert]"),
  pillCovered: document.elementFromPoint(720, 860)?.closest(".archive-root") != null,
  chrome: [...document.querySelectorAll(".archive-root button")].map((b) => b.textContent?.trim()),
}));
check(suspended.overflow === "hidden", "page scroll locked");
check(suspended.headerInert && suspended.mainInert, "header and main are inert");
check(suspended.pillCovered, "Archive covers the viewport (pill not reachable)");
check(suspended.chrome.join(",") === "Wake,?", `only chrome is WAKE and the ? (${suspended.chrome.join(",")})`);
check(await page.locator(".archive-hint").innerText() === "DRIFT TOWARD THE LIGHT", "hint is one line: DRIFT TOWARD THE LIGHT");
await page.getByRole("button", { name: "Show controls" }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: resolve(shots, `archive-controls${tag}.png`) });
check(await page.getByRole("region", { name: "Controls" }).isVisible(), "? opens the control list");
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
check(!(await page.getByRole("region", { name: "Controls" }).isVisible()) && (await page.evaluate(() => document.documentElement.dataset.mode)) === "dream", "Esc closes the list first, without waking");
await page.locator(".archive-stage").focus();

// Frame rate while idle
const fps = await page.evaluate(
  () =>
    new Promise((res) => {
      let n = 0;
      const t0 = performance.now();
      const f = () => {
        n++;
        if (performance.now() - t0 < 3000) requestAnimationFrame(f);
        else res((n * 1000) / (performance.now() - t0));
      };
      requestAnimationFrame(f);
    }),
);
console.log(`INFO  rAF rate ${fps.toFixed(1)} fps (headless software WebGL; not representative of a GPU)`);

// Pointer: hold right of centre, drift and turn
const flight = () => page.evaluate(() => {
  const f = window.__archiveFlight;
  return f && { x: f.px, y: f.py, z: f.pz, yaw: f.yaw, v: Math.hypot(f.vx, f.vy, f.vz) };
});
const f0 = await flight();
await page.mouse.move(980, 420);
await page.mouse.down();
await page.waitForTimeout(2200);
await page.screenshot({ path: resolve(shots, `archive-float-drift${tag}.png`) });
const f1 = await flight();
await page.mouse.up();
await page.waitForTimeout(1200);
const f2 = await flight();
check(f1 && f1.v > 2, `hold drifts forward (speed ${f1?.v.toFixed(2)})`);
check(f1 && f1.yaw < f0.yaw - 0.3, `pointer right of centre turns right (yaw ${f0.yaw.toFixed(2)} -> ${f1?.yaw.toFixed(2)})`);
check(f2 && f2.v > 0.5 && f2.v < f1.v, `release coasts, slowing (speed ${f2?.v.toFixed(2)})`);

// Keyboard: W forward, arrow look
await page.mouse.move(720, 450);
await page.waitForTimeout(2500);
const k0 = await flight();
await page.keyboard.down("KeyW");
await page.keyboard.down("ArrowLeft");
await page.waitForTimeout(1200);
await page.keyboard.up("ArrowLeft");
await page.keyboard.up("KeyW");
const k1 = await flight();
check(k1.yaw > k0.yaw + 0.3, `arrow left turns left (yaw ${k0.yaw.toFixed(2)} -> ${k1.yaw.toFixed(2)})`);
check(k1.v > 1.5, `W thrusts (speed ${k1.v.toFixed(2)})`);
await page.screenshot({ path: resolve(shots, `archive-float-keys${tag}.png`) });

// WAKE: back to the page, where it was
await page.getByRole("button", { name: /^Wake/ }).click();
await page.waitForTimeout(2600);
const back = await page.evaluate(() => ({
  archive: getComputedStyle(document.querySelector(".archive-root")).visibility === "visible",
  mode: document.documentElement.dataset.mode,
  y: window.scrollY,
  overflow: document.documentElement.style.overflow,
  inert: [...document.querySelectorAll("[inert]")].filter((e) => !e.classList.contains("archive-root")).length,
}));
check(!back.archive, "Archive hidden (stays mounted, warm)");
check(back.mode === "wake", `mode is wake (${back.mode})`);
check(Math.abs(back.y - scrollBefore) < 4, `scroll restored (${scrollBefore} -> ${back.y})`);
check(back.overflow === "" && back.inert === 0, "page unlocked, nothing inert");
await page.screenshot({ path: resolve(shots, `archive-woke${tag}.png`) });

check(errors.length === 0, `no console errors${errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""}`);
await browser.close();
process.exit(fails ? 1 : 0);
