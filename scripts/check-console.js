const puppeteer = require('puppeteer-core');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu']
  });
  const page = await browser.newPage();
  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => consoleLogs.push(`[PAGEERROR] ${err.toString()}`));

  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 4000));

  await page.screenshot({ path: 'test-badge-check.png' });

  const portalInfo = await page.evaluate(() => {
    const portal = document.querySelector('nextjs-portal');
    if (!portal || !portal.shadowRoot) return { status: 'no portal' };
    const root = portal.shadowRoot;
    const badge = root.querySelector('[data-next-badge]');
    const isError = badge ? badge.getAttribute('data-error') : null;
    const allElements = Array.from(root.querySelectorAll('*')).map(el => `${el.tagName}[${Array.from(el.attributes).map(a => `${a.name}="${a.value}"`).join(' ')}]: ${el.textContent?.trim().slice(0, 100)}`);
    return {
      status: 'found',
      badgeHtml: badge ? badge.outerHTML : null,
      isError,
      elements: allElements.filter(e => !e.startsWith('STYLE'))
    };
  });

  console.log('--- CONSOLE LOGS ---');
  console.log(consoleLogs.join('\n'));
  console.log('--- PORTAL ELEMENTS ---');
  console.log(JSON.stringify(portalInfo, null, 2));

  await browser.close();
})();
