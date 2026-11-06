#!/usr/bin/env node
import { firefox } from "playwright";
import { writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const shotsDir = resolve(__dirname, "..", "shots");
mkdirSync(shotsDir, { recursive: true });

const [url, name, scrollY] = process.argv.slice(2);
if (!url || !name) {
  console.error("Usage: node scripts/shot.mjs <url> <name> [scrollY]");
  process.exit(1);
}

const headless = process.argv.includes("--headless");

const browser = await firefox.launch({
  headless,
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

const consoleMessages = [];
page.on("console", (msg) => {
  const type = msg.type();
  if (type === "error" || type === "warning") {
    consoleMessages.push(`[${type}] ${msg.text()}`);
  }
});

page.on("pageerror", (err) => {
  consoleMessages.push(`[pageerror] ${err.message}`);
});

console.log(`Navigating to ${url} ...`);
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

// Wait for WebGL canvas to render
const waitMs = parseInt(process.env.SHOT_WAIT || "5000", 10);
console.log(`Waiting ${waitMs}ms for WebGL...`);
await page.waitForTimeout(waitMs);

if (scrollY && Number(scrollY) > 0) {
  console.log(`Scrolling to Y=${scrollY}...`);
  await page.evaluate((y) => window.scrollTo(0, y), Number(scrollY));
  await page.waitForTimeout(1500);
}

const outPath = resolve(shotsDir, `${name}.png`);
await page.screenshot({ path: outPath, fullPage: false });
console.log(`Screenshot saved: ${outPath}`);

if (consoleMessages.length > 0) {
  console.log("\n--- Console errors/warnings ---");
  for (const m of consoleMessages) console.log(m);
} else {
  console.log("No console errors or warnings.");
}

await browser.close();
