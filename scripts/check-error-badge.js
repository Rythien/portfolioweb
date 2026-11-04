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

  // Capture all console messages
  const logs = [];
  page.on('console', msg => logs.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', err => logs.push({ type: 'pageerror', text: err.message }));

  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 4000));

  // Check for actual Next.js error toast specifically
  const badgeInfo = await page.evaluate(() => {
    // The Next.js dev overlay portal
    const portal = document.querySelector('nextjs-portal');
    const toast = document.querySelector('[data-nextjs-toast]');
    const devError = document.querySelector('[data-nextjs-dialog]');
    const errorBadge = document.querySelector('button[aria-label*="error" i], button[aria-label*="issue" i]');
    
    return {
      hasPortal: !!portal,
      hasToast: !!toast,
      hasDialog: !!devError,
      hasErrorBadge: !!errorBadge,
      portalHTML: portal ? portal.innerHTML.slice(0, 300) : null,
    };
  });

  console.log('Badge/error detection:');
  console.log(JSON.stringify(badgeInfo, null, 2));

  console.log('\nAll console logs:');
  logs.forEach(l => console.log(`[${l.type}] ${l.text}`));

  await page.screenshot({ path: 'test-badge-check.png', fullPage: false });
  await browser.close();
})();
