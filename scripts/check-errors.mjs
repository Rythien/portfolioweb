import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function run() {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  page.on('pageerror', err => {
    errors.push(err.message);
  });

  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000?mode=dream&nopreload=1', { waitUntil: 'domcontentloaded', timeout: 10000 });
  await new Promise(r => setTimeout(r, 4000));

  console.log('Errors found:', errors.length);
  for (const e of errors) {
    console.log(' -', e.substring(0, 200));
  }

  await browser.close();
}

run().catch(e => { console.error(e); process.exit(1); });
