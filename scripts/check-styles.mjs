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

  // Check computed styles on first page
  const page1 = await browser.newPage();
  await page1.setViewport({ width: 1440, height: 900 });
  await page1.goto('http://localhost:3000?nopreload=1', { waitUntil: 'domcontentloaded', timeout: 10000 });
  await new Promise(r => setTimeout(r, 3000));

  const result = await page1.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;
    const cs = getComputedStyle(body);
    const csHtml = getComputedStyle(html);
    return {
      dataMode: html.dataset.mode,
      htmlBg: csHtml.backgroundColor,
      bodyBg: cs.backgroundColor,
      bodyColor: cs.color,
      tSurface: csHtml.getPropertyValue('--t-surface').trim(),
      tInk: csHtml.getPropertyValue('--t-ink').trim(),
      colorSurface: csHtml.getPropertyValue('--color-surface').trim(),
      colorInk: csHtml.getPropertyValue('--color-ink').trim(),
    };
  });
  console.log('Computed styles:', JSON.stringify(result, null, 2));

  // Screenshot 1440
  await page1.screenshot({ path: path.join(outDir, 'screenshot-1440.png'), fullPage: false });
  console.log('Saved 1440');
  await page1.close();

  await browser.close();
}

run().catch(e => { console.error(e); process.exit(1); });
