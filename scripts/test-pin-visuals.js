const puppeteer = require("puppeteer-core");
const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

async function run() {
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: "new",
    args: ["--no-sandbox", "--disable-gpu"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto("http://localhost:3000/?nopreload=1", { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 1200));

  // 1. Test Journey pinning at 2400, 2800, 3200, 3600
  for (const y of [2300, 2700, 3100, 3500, 3900]) {
    await page.evaluate((pos) => window.scrollTo(0, pos), y);
    await new Promise((r) => setTimeout(r, 300));
    await page.screenshot({ path: `pin-journey-${y}.png` });
  }

  // 2. Test Projects pinning
  const projectsY = await page.evaluate(() => {
    const el = document.getElementById("projects");
    const r = el.getBoundingClientRect();
    return window.scrollY + r.top;
  });
  console.log("Projects absolute top:", projectsY);

  for (let offset = 0; offset <= 2000; offset += 500) {
    const y = Math.round(projectsY + offset);
    await page.evaluate((pos) => window.scrollTo(0, pos), y);
    await new Promise((r) => setTimeout(r, 300));
    await page.screenshot({ path: `pin-projects-${offset}.png` });
  }

  console.log("All pin checks complete!");
  await browser.close();
}

run();
