const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");

const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

async function verify() {
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: "new",
    args: ["--no-sandbox", "--disable-gpu"],
  });

  const routes = [
    { url: "http://localhost:3000/?nopreload=1", name: "home-desktop", width: 1440, height: 900 },
    { url: "http://localhost:3000/?nopreload=1", name: "home-mobile", width: 375, height: 812, isMobile: true },
    { url: "http://localhost:3000/cv?nopreload=1", name: "cv-desktop", width: 1440, height: 900 },
    { url: "http://localhost:3000/projects?nopreload=1", name: "projects-desktop", width: 1440, height: 900 },
    { url: "http://localhost:3000/project/ecommerce-capstone?nopreload=1", name: "case-study-desktop", width: 1440, height: 900 },
    { url: "http://localhost:3000/lab?nopreload=1", name: "lab-desktop", width: 1440, height: 900 },
  ];

  const errors = [];

  for (const r of routes) {
    const page = await browser.newPage();
    if (r.isMobile) {
      await page.setViewport({ width: r.width, height: r.height, isMobile: true, hasTouch: true });
    } else {
      await page.setViewport({ width: r.width, height: r.height });
    }

    page.on("pageerror", (err) => {
      console.error(`[PAGE ERROR ${r.name}]:`, err.toString());
      errors.push({ route: r.name, error: err.toString() });
    });

    try {
      await page.goto(r.url, { waitUntil: "networkidle0" });
      await new Promise((res) => setTimeout(res, 800));
      const shotPath = `verified-${r.name}.png`;
      await page.screenshot({ path: shotPath });
      console.log(`Saved ${shotPath}`);
    } catch (e) {
      console.error(`Failed ${r.name}:`, e);
      errors.push({ route: r.name, error: e.toString() });
    } finally {
      await page.close();
    }
  }

  await browser.close();

  console.log("Verification finished. Total errors:", errors.length);
  if (errors.length > 0) {
    console.error(JSON.stringify(errors, null, 2));
    process.exit(1);
  }
}

verify();
