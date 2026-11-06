const puppeteer = require('puppeteer-core');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function diagnoseEnter() {
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('https://daikifujita.com', { waitUntil: 'networkidle2', timeout: 30000 });

  // Wait until .ds-pcount text is 100
  console.log('Waiting for loader to reach 100...');
  await page.waitForFunction(() => {
    const el = document.querySelector('.ds-pcount');
    return el && el.innerText.trim() === '100';
  }, { timeout: 15000 });

  console.log('Loader reached 100! Waiting 500ms...');
  await new Promise(r => setTimeout(r, 800));

  console.log('Clicking .ds-penter...');
  await page.click('.ds-penter');

  console.log('Waiting 3s for entrance animation...');
  await new Promise(r => setTimeout(r, 3000));

  await page.screenshot({ path: 'step3-after-enter-100.png' });
  console.log('Saved step3-after-enter-100.png');

  // Check what's on the page now
  const state = await page.evaluate(() => {
    const fixed = Array.from(document.querySelectorAll('*')).filter(el => {
      const s = window.getComputedStyle(el);
      return s.position === 'fixed' && el.offsetHeight > 0 && el.offsetWidth > 0;
    }).map(el => ({
      tag: el.tagName,
      className: el.className,
      text: (el.innerText || '').slice(0, 100),
      rect: el.getBoundingClientRect()
    }));

    return {
      fixed,
      scrollY: window.scrollY,
      htmlClass: document.documentElement.className,
      bodyClass: document.body.className
    };
  });

  console.log('State after enter:', JSON.stringify(state, null, 2));

  await browser.close();
}

diagnoseEnter().catch(console.error);
