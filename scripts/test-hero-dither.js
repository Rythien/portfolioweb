const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");

const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

async function run() {
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: "new",
    args: ["--no-sandbox", "--disable-gpu"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    page.on("console", (m) => console.log("PAGE LOG:", m.text()));
    page.on("pageerror", (e) => console.error("PAGE ERROR:", e.toString()));

    await page.goto("http://localhost:3000/?nopreload=1", { waitUntil: "domcontentloaded" });
    await new Promise((r) => setTimeout(r, 1500));

    const path1440 = path.resolve(__dirname, "../test-hero-dither-1440.png");
    const path375 = path.resolve(__dirname, "../test-hero-dither-375.png");

    await page.screenshot({ path: path1440 });
    console.log("Saved test-hero-dither-1440.png at", path1440);

    await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
    await new Promise((r) => setTimeout(r, 800));
    await page.screenshot({ path: path375 });
    console.log("Saved test-hero-dither-375.png at", path375);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await browser.close();
  }
}

run();
