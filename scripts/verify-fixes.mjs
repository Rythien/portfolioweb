#!/usr/bin/env node
import { firefox } from "playwright";
import { mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const shotsDir = resolve(__dirname, "..", "shots");
mkdirSync(shotsDir, { recursive: true });

const browser = await firefox.launch({
  headless: true,
  firefoxUserPrefs: {
    "webgl.force-enabled": true,
    "webgl.disabled": false,
    "webgl.enable-webgl2": true,
  },
});

const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  ignoreHTTPSErrors: true,
});

const page = await context.newPage();
const errors = [];
page.on("pageerror", (err) => errors.push(err.message));

console.log("Loading page...");
await page.goto("http://localhost:3000", {
  waitUntil: "domcontentloaded",
  timeout: 30000,
});
await page.waitForTimeout(6000);

const totalScroll = await page.evaluate(
  () => document.documentElement.scrollHeight - window.innerHeight,
);

async function takeShot(label, scrollY) {
  await page.evaluate((y) => window.scrollTo(0, y), scrollY);
  await page.waitForTimeout(2000);
  const path = resolve(shotsDir, `fix-${label}.png`);
  await page.screenshot({ path, fullPage: false });
  console.log(`  ${label}: saved`);
}

async function measureFPS(label) {
  const fps = await page.evaluate(() => {
    return new Promise((resolve) => {
      let frames = 0;
      const start = performance.now();
      function count() {
        frames++;
        if (performance.now() - start < 2000) requestAnimationFrame(count);
        else resolve(Math.round(frames / ((performance.now() - start) / 1000)));
      }
      requestAnimationFrame(count);
    });
  });
  console.log(`  FPS [${label}]: ${fps}`);
  return fps;
}

const midScroll = Math.round(totalScroll * 0.33);
const worksScroll = Math.round(totalScroll * 0.65);

// ── WAKE ──
console.log("\n=== WAKE ===");
await takeShot("wake-intact", 0);
const wFps0 = await measureFPS("wake-scroll0");
await takeShot("wake-mid", midScroll);
const wFpsMid = await measureFPS("wake-mid");
await takeShot("wake-broken", worksScroll);
const wFpsWorks = await measureFPS("wake-works");
await takeShot("wake-return", 0);

// ── Switch to DREAM ──
console.log("\n=== SWITCHING TO DREAM ===");
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(1000);
await page.click('text=DREAM', { timeout: 5000 }).catch(() => {
  console.log("  DREAM button not found");
});
await page.waitForTimeout(3000);

// ── DREAM ──
console.log("\n=== DREAM ===");
await takeShot("dream-intact", 0);
const dFps0 = await measureFPS("dream-scroll0");
await takeShot("dream-mid", midScroll);
const dFpsMid = await measureFPS("dream-mid");
await takeShot("dream-broken", worksScroll);
const dFpsWorks = await measureFPS("dream-works");
await takeShot("dream-return", 0);

console.log("\n=== FPS SUMMARY ===");
console.log(`  Wake:  scroll0=${wFps0}  mid=${wFpsMid}  works=${wFpsWorks}`);
console.log(`  Dream: scroll0=${dFps0}  mid=${dFpsMid}  works=${dFpsWorks}`);

if (errors.length > 0) {
  console.log("\n--- Page errors ---");
  errors.forEach((e) => console.log("  " + e));
}

await browser.close();
console.log("\nDone.");
