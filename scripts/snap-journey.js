const puppeteer = require('puppeteer-core');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 2000));

  const journeyEl = await page.$('#journey');
  if (journeyEl) {
    await journeyEl.scrollIntoView();
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: 'test-desktop-journey-current.png' });
    console.log('Journey screenshot taken');
  } else {
    console.log('Journey element not found');
  }

  await browser.close();
})();
