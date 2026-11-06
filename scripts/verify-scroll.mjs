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

// Get total scrollable height
const totalScroll = await page.evaluate(
  () => document.documentElement.scrollHeight - window.innerHeight,
);
console.log(`Total scrollable height: ${totalScroll}px`);

// s = progress * 1.5, progress = scrollY / totalScroll
// So scrollY = (s / 1.5) * totalScroll
const sValues = [0, 0.2, 0.5, 0.7, 1.0];

async function takeShot(label, scrollY) {
  console.log(`\n--- ${label} (scrollY=${scrollY}) ---`);
  await page.evaluate((y) => window.scrollTo(0, y), scrollY);
  await page.waitForTimeout(2000);
  const path = resolve(shotsDir, `scroll-${label}.png`);
  await page.screenshot({ path, fullPage: false });
  console.log(`Saved: ${path}`);
}

// WAKE mode shots at each s value
for (const s of sValues) {
  const scrollY = Math.round((s / 1.5) * totalScroll);
  await takeShot(`wake-s${s.toFixed(1)}`, scrollY);
}

// Scroll back to top
await takeShot("wake-return", 0);

// Switch to DREAM mode
console.log("\nSwitching to DREAM...");
await page.click('text=DREAM', { timeout: 5000 }).catch(() => {
  console.log("DREAM button not found, trying alternate selector");
});
await page.waitForTimeout(3000);

// DREAM mode shots
for (const s of sValues) {
  const scrollY = Math.round((s / 1.5) * totalScroll);
  await takeShot(`dream-s${s.toFixed(1)}`, scrollY);
}

// Scroll back to top in dream
await takeShot("dream-return", 0);

// FPS check
await page.evaluate((y) => window.scrollTo(0, 0), 0);
await page.waitForTimeout(1000);
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
console.log(`\nFPS: ${fps}`);

if (errors.length > 0) {
  console.log("\n--- Page errors ---");
  errors.forEach((e) => console.log(e));
}

await browser.close();
console.log("\nDone.");
