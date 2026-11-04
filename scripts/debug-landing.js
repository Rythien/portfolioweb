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

    await page.goto("http://localhost:3000/?nopreload=1", { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 1200));

    await page.screenshot({ path: "test-desktop-hero-fixed.png" });

    // Scroll to Journey
    await page.evaluate(() => {
      document.getElementById("journey")?.scrollIntoView();
    });
    await new Promise((r) => setTimeout(r, 1000));
    await page.screenshot({ path: "test-desktop-journey-fixed.png" });

    console.log("Desktop screenshots saved!");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await browser.close();
  }
}

run();
