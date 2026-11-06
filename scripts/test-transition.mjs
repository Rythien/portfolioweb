import puppeteer from 'puppeteer-core';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '..', 'docs');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function run() {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000?nopreload=1', { waitUntil: 'domcontentloaded', timeout: 10000 });
  await new Promise(r => setTimeout(r, 3000));

  // Screenshot WAKE mode
  await page.screenshot({ path: path.join(outDir, 'wake-1440.png') });
  console.log('Saved wake-1440.png');

  // Check initial mode
  const initialMode = await page.evaluate(() => document.documentElement.dataset.mode);
  console.log('Initial mode:', initialMode);

  // Click the DREAM button in the pill
  const dreamBtn = await page.$('button[aria-label*="Switch to dream"]');
  if (dreamBtn) {
    const box = await dreamBtn.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      console.log('Clicked DREAM toggle at', box.x + box.width / 2, box.y + box.height / 2);
    }
  } else {
    console.log('Could not find DREAM toggle button');
  }

  // Wait for transition
  await new Promise(r => setTimeout(r, 2500));

  const afterMode = await page.evaluate(() => document.documentElement.dataset.mode);
  console.log('After toggle mode:', afterMode);

  // Screenshot DREAM mode
  await page.screenshot({ path: path.join(outDir, 'dream-1440.png') });
  console.log('Saved dream-1440.png');

  // Test persistence via URL param
  const page2 = await browser.newPage();
  await page2.setViewport({ width: 1440, height: 900 });
  await page2.goto('http://localhost:3000?mode=dream&nopreload=1', { waitUntil: 'domcontentloaded', timeout: 10000 });
  await new Promise(r => setTimeout(r, 3000));
  const urlMode = await page2.evaluate(() => document.documentElement.dataset.mode);
  console.log('URL param mode=dream result:', urlMode);
  await page2.screenshot({ path: path.join(outDir, 'dream-url-1440.png') });
  console.log('Saved dream-url-1440.png');

  // Test 375px mobile
  const page3 = await browser.newPage();
  await page3.setViewport({ width: 375, height: 812 });
  await page3.goto('http://localhost:3000?mode=dream&nopreload=1', { waitUntil: 'domcontentloaded', timeout: 10000 });
  await new Promise(r => setTimeout(r, 3000));
  await page3.screenshot({ path: path.join(outDir, 'dream-375.png') });
  console.log('Saved dream-375.png');

  await browser.close();
}

run().catch(e => { console.error(e); process.exit(1); });
