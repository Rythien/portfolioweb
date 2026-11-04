const puppeteer = require("puppeteer-core");
const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

async function test() {
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: "new",
    args: ["--no-sandbox", "--disable-gpu"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto("http://localhost:3000/?nopreload=1", { waitUntil: "networkidle0" });

  const getDetails = async (scrollY) => {
    return await page.evaluate((y) => {
      window.scrollTo(0, y);
      const elements = [
        document.getElementById("hero"),
        document.getElementById("about"),
        document.querySelector(".pin-spacer:has(#journey)") || document.getElementById("journey"),
        document.getElementById("journey"),
        document.getElementById("process"),
        document.getElementById("focus"),
        document.querySelector(".pin-spacer:has(#projects)") || document.getElementById("projects"),
        document.getElementById("projects"),
      ];
      return elements.filter(Boolean).map((el) => {
        const r = el.getBoundingClientRect();
        return {
          id: el.id || el.className,
          top: Math.round(r.top),
          bottom: Math.round(r.bottom),
          height: Math.round(r.height),
          position: window.getComputedStyle(el).position,
          zIndex: window.getComputedStyle(el).zIndex,
        };
      });
    }, scrollY);
  };

  console.log("AT Y=0:", await getDetails(0));
  await new Promise((r) => setTimeout(r, 600));

  console.log("AT Y=2500:", await getDetails(2500));
  await new Promise((r) => setTimeout(r, 600));

  console.log("AT Y=4500:", await getDetails(4500));

  await browser.close();
}

test();
