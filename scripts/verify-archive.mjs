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

await page.getByRole("button", { name: "Switch to dream mode" }).click();
await page.waitForSelector(".archive-root", { timeout: 15000 });
await page.waitForTimeout(3000);
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
check(suspended.chrome.length === 1 && suspended.chrome[0] === "Wake", `only chrome is WAKE (${suspended.chrome.join(",")})`);

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
  archive: !!document.querySelector(".archive-root"),
  mode: document.documentElement.dataset.mode,
  y: window.scrollY,
  overflow: document.documentElement.style.overflow,
  inert: document.querySelectorAll("[inert]").length,
}));
check(!back.archive, "Archive closed");
check(back.mode === "wake", `mode is wake (${back.mode})`);
check(Math.abs(back.y - scrollBefore) < 4, `scroll restored (${scrollBefore} -> ${back.y})`);
check(back.overflow === "" && back.inert === 0, "page unlocked, nothing inert");
await page.screenshot({ path: resolve(shots, `archive-woke${tag}.png`) });

check(errors.length === 0, `no console errors${errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""}`);
await browser.close();
process.exit(fails ? 1 : 0);
