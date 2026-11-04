const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");

const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

async function main() {
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: "new",
    args: ["--no-sandbox", "--disable-gpu"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto("http://localhost:3000/?nopreload=1", { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 1500));

  const sections = ["hero", "about", "journey", "process", "focus", "skills", "path", "results", "projects", "lab", "contact"];

  for (const sId of sections) {
    await page.evaluate((id) => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "instant", block: "start" });
    }, sId);

    await new Promise((r) => setTimeout(r, 600));

    const outPath = path.resolve(`debug-${sId}.png`);
    await page.screenshot({ path: outPath });
    console.log(`Captured debug-${sId}.png`);
  }

  await browser.close();
}

main().catch(console.error);
