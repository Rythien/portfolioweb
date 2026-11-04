const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");

const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

async function main() {
  console.log("Launching Edge with puppeteer-core...");
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: "new",
    args: ["--no-sandbox", "--disable-gpu"],
  });

  try {
    const page = await browser.newPage();

    // 1. Desktop Screenshot 1440x900
    console.log("Navigating to Journey at 1440x900...");
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
    await page.goto("http://localhost:3000/journey?nopreload=1", {
      waitUntil: "domcontentloaded",
    });

    // Wait for ASCII globe animation frames
    await new Promise((r) => setTimeout(r, 1800));

    const path1440 = path.resolve("screenshot-journey-1440.png");
    await page.screenshot({ path: path1440 });
    console.log("Saved screenshot-journey-1440.png:", fs.statSync(path1440).size, "bytes");

    // 2. Mobile Screenshot 375x812
    console.log("Navigating to Journey at 375x812...");
    await page.setViewport({
      width: 375,
      height: 812,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });

    await new Promise((r) => setTimeout(r, 1500));

    const path375 = path.resolve("screenshot-journey-375.png");
    await page.screenshot({ path: path375 });
    console.log("Saved screenshot-journey-375.png:", fs.statSync(path375).size, "bytes");

  } finally {
    await browser.close();
  }
}

main()
  .then(() => console.log("Screenshots captured successfully!"))
  .catch((e) => console.error(e));
