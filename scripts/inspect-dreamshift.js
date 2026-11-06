const puppeteer = require('puppeteer-core');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function inspectDreamShift() {
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('https://daikifujita.com', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 4000));

  const details = await page.evaluate(() => {
    const el = document.querySelector('[data-framer-name*="DreamShift"]');
    if (!el) return { found: false };
    
    return {
      found: true,
      html: el.innerHTML,
      outerHTML: el.outerHTML,
      rect: el.getBoundingClientRect(),
      style: {
        position: window.getComputedStyle(el).position,
        bottom: window.getComputedStyle(el).bottom,
        left: window.getComputedStyle(el).left,
        transform: window.getComputedStyle(el).transform,
      }
    };
  });

  console.log(JSON.stringify(details, null, 2));
  await browser.close();
}

inspectDreamShift().catch(console.error);
