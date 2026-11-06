import puppeteer from 'puppeteer-core';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function run() {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();
  const warnings = [];
  page.on('console', m => {
    const text = m.text();
    if (text.includes('hydrat') || text.includes('mismatch') || text.includes('didn\'t match')) {
      warnings.push(text);
    }
  });

  await page.setViewport({ width: 1440, height: 900 });
  // Load page fresh — no nopreload, no mode param
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await new Promise(r => setTimeout(r, 6000));

  // Get actual body className after hydration
  const bodyClass = await page.evaluate(() => document.body.className);
  const htmlClass = await page.evaluate(() => document.documentElement.className);
  const htmlDataMode = await page.evaluate(() => document.documentElement.dataset.mode);

  console.log('body.className:', JSON.stringify(bodyClass));
  console.log('html.className:', JSON.stringify(htmlClass));
  console.log('html data-mode:', htmlDataMode);
  console.log('\nHydration warnings:', warnings.length);
  for (const w of warnings) console.log(w.substring(0, 500));

  // Now try with localStorage dream mode set
  const page2 = await browser.newPage();
  const warnings2 = [];
  page2.on('console', m => {
    const text = m.text();
    if (text.includes('hydrat') || text.includes('mismatch') || text.includes('didn\'t match')) {
      warnings2.push(text);
    }
  });
  await page2.evaluateOnNewDocument(() => {
    localStorage.setItem('searon-mode', 'dream');
  });
  await page2.setViewport({ width: 1440, height: 900 });
  await page2.goto('http://localhost:3000?nopreload=1', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await new Promise(r => setTimeout(r, 4000));

  const bodyClass2 = await page2.evaluate(() => document.body.className);
  const htmlDataMode2 = await page2.evaluate(() => document.documentElement.dataset.mode);
  console.log('\n--- With dream localStorage ---');
  console.log('body.className:', JSON.stringify(bodyClass2));
  console.log('html data-mode:', htmlDataMode2);
  console.log('Hydration warnings:', warnings2.length);
  for (const w of warnings2) console.log(w.substring(0, 500));

  await browser.close();
}

run().catch(e => { console.error(e); process.exit(1); });
