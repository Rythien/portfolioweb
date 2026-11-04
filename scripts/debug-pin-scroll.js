const puppeteer = require("puppeteer-core");
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

    // Check positions from Y=1500 to Y=12000 in steps of 500
    const scrollPositions = [
      1500, 2000, 2200, 2500, 3000, 3500, 4000, 4500,
      5000, 6000, 7000, 8000, 9000, 10000, 11000, 12000
    ];

    for (const y of scrollPositions) {
      const info = await page.evaluate((scrollY) => {
        window.scrollTo(0, scrollY);
        const journey = document.getElementById("journey");
        const projects = document.getElementById("projects");
        const jRect = journey ? journey.getBoundingClientRect() : null;
        const pRect = projects ? projects.getBoundingClientRect() : null;

        return {
          scrollY,
          journey: jRect
            ? {
                top: Math.round(jRect.top),
                bottom: Math.round(jRect.bottom),
                height: Math.round(jRect.height),
                style: journey.getAttribute("style"),
                parentTag: journey.parentElement.tagName,
                parentClass: journey.parentElement.className,
                parentStyle: journey.parentElement.getAttribute("style"),
              }
            : null,
          projects: pRect
            ? {
                top: Math.round(pRect.top),
                bottom: Math.round(pRect.bottom),
                height: Math.round(pRect.height),
                style: projects.getAttribute("style"),
                parentTag: projects.parentElement.tagName,
                parentClass: projects.parentElement.className,
                parentStyle: projects.parentElement.getAttribute("style"),
              }
            : null,
        };
      }, y);

      console.log(`Scroll Y=${y}:`, JSON.stringify(info, null, 2));

      // Take screenshot if in journey or projects zone
      if ([2200, 2600, 3200, 4000, 9000, 10000, 11500].includes(y)) {
        await page.screenshot({ path: `debug-scroll-${y}.png` });
      }
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await browser.close();
  }
}

run();
