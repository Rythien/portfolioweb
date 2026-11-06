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

  const errors = [];
  const consoleMessages = [];

  for (const w of [1440, 768, 375]) {
    const page = await browser.newPage();
    page.on('console', m => consoleMessages.push(`[${w}] ${m.type()}: ${m.text().substring(0, 200)}`));
    page.on('pageerror', e => errors.push(`[${w}] ${e.message.substring(0, 200)}`));
    await page.evaluateOnNewDocument(() => { localStorage.removeItem('searon-mode'); });
    await page.setViewport({ width: w, height: 900 });
    await page.goto('http://localhost:3000?nopreload=1', { waitUntil: 'domcontentloaded', timeout: 12000 });
    await new Promise(r => setTimeout(r, 3000));
    await page.screenshot({ path: path.join(outDir, `hero-wake-${w}.png`) });
    console.log(`Saved hero-wake-${w}.png`);
    await page.close();
  }

  console.log('\n=== Console errors ===');
  for (const e of errors) console.log(e);
  console.log('\n=== Console messages (errors/warnings) ===');
  for (const m of consoleMessages.filter(m => m.includes('error') || m.includes('warn'))) console.log(m);

  await browser.close();
}

run().catch(e => { console.error(e); process.exit(1); });
