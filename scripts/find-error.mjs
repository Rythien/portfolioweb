import puppeteer from 'puppeteer-core';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function run() {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();
  const messages = [];
  page.on('console', m => messages.push(`${m.type()}: ${m.text()}`));
  page.on('pageerror', e => messages.push(`PAGE_ERROR: ${e.message}`));

  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await new Promise(r => setTimeout(r, 6000));

  // Check for Next.js error overlay
  const hasOverlay = await page.evaluate(() => {
    const overlay = document.querySelector('nextjs-portal');
    return overlay ? overlay.shadowRoot?.innerHTML?.substring(0, 500) : null;
  });

  // Check for any error indicators
  const errorBadge = await page.evaluate(() => {
    // Next.js dev error indicator
    const all = document.querySelectorAll('[data-nextjs-errors]');
    return all.length > 0 ? 'Found error badge' : 'No error badge';
  });

  console.log('=== Error badge ===');
  console.log(errorBadge);
  console.log('\n=== Overlay ===');
  console.log(hasOverlay || 'No overlay');
  console.log('\n=== All messages ===');
  for (const m of messages) {
    console.log(m.substring(0, 300));
  }

  await browser.close();
}

run().catch(e => { console.error(e); process.exit(1); });
