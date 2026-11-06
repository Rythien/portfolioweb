const puppeteer = require('puppeteer-core');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function testEnter() {
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('https://daikifujita.com', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));

  console.log('Checking for enter button...');
  const enterBtn = await page.$('.ds-penter');
  if (enterBtn) {
    console.log('Clicking [Enter] button...');
    await enterBtn.click();
    await new Promise(r => setTimeout(r, 2500));
  }

  const siteInfo = await page.evaluate(() => {
    // Find bottom pill or toggle buttons
    const pills = Array.from(document.querySelectorAll('*')).filter(el => {
      const s = window.getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const txt = (el.innerText || '').trim();
      return (s.position === 'fixed' || s.position === 'sticky') && (txt.includes('WAKE') || txt.includes('DREAM') || txt.includes('Wake') || txt.includes('Dream'));
    }).map(el => ({
      tag: el.tagName,
      className: el.className,
      id: el.id,
      text: el.innerText.trim(),
      rect: el.getBoundingClientRect(),
      style: {
        position: window.getComputedStyle(el).position,
        bottom: window.getComputedStyle(el).bottom,
        left: window.getComputedStyle(el).left,
        right: window.getComputedStyle(el).right,
        background: window.getComputedStyle(el).backgroundColor,
        borderRadius: window.getComputedStyle(el).borderRadius
      }
    }));

    return {
      pills,
      htmlClass: document.documentElement.className,
      bodyClass: document.body.className
    };
  });

  console.log(JSON.stringify(siteInfo, null, 2));
  await page.screenshot({ path: 'test-after-enter.png' });
  await browser.close();
}

testEnter().catch(console.error);
