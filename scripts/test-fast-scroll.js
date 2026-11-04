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
  await page.goto('http://localhost:3000/?nopreload=1', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 2000));

  // Simulate fast mouse wheel scroll flick:
  for (let i = 0; i < 20; i++) {
    await page.mouse.wheel({ deltaY: 600 });
    await new Promise(r => setTimeout(r, 30));
  }
  await new Promise(r => setTimeout(r, 1000));

  // Check where we landed and what is visible:
  const info = await page.evaluate(() => {
    return {
      scrollY: window.scrollY,
      journeyRect: document.getElementById('journey')?.getBoundingClientRect(),
      processRect: document.getElementById('process')?.getBoundingClientRect(),
      focusRect: document.getElementById('focus')?.getBoundingClientRect(),
    };
  });
  console.log('After fast wheel flick:', JSON.stringify(info, null, 2));

  // Check pin-spacers
  const pinSpacers = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.pin-spacer')).map(ps => ({
      class: ps.className,
      style: ps.getAttribute('style'),
      rect: ps.getBoundingClientRect(),
      childId: ps.firstElementChild?.id
    }));
  });
  console.log('Pin spacers:', JSON.stringify(pinSpacers, null, 2));

  await browser.close();
})();
