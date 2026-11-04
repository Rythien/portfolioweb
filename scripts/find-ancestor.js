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
  await new Promise((r) => setTimeout(r, 1000));

  const ancestorInfo = await page.evaluate(() => {
    const el = document.getElementById("journey");
    const ancestors = [];
    let curr = el ? el.parentElement : null;
    while (curr) {
      const cs = window.getComputedStyle(curr);
      ancestors.push({
        tag: curr.tagName,
        id: curr.id,
        className: curr.className,
        transform: cs.transform,
        filter: cs.filter,
        perspective: cs.perspective,
        contain: cs.contain,
        backdropFilter: cs.backdropFilter,
        willChange: cs.willChange,
      });
      curr = curr.parentElement;
    }
    return ancestors;
  });

  console.log("ANCESTORS OF JOURNEY:", JSON.stringify(ancestorInfo, null, 2));

  await browser.close();
}

run();
