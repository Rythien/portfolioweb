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

  for (const w of [1440, 768, 375]) {
    // WAKE
    const pw = await browser.newPage();
    pw.on('pageerror', e => errors.push(`wake-${w}: ${e.message.substring(0, 150)}`));
    pw.on('console', m => { if (m.type() === 'error') errors.push(`wake-${w}: ${m.text().substring(0, 150)}`); });
    await pw.evaluateOnNewDocument(() => { localStorage.removeItem('searon-mode'); });
    await pw.setViewport({ width: w, height: 900 });
    await pw.goto('http://localhost:3000?nopreload=1', { waitUntil: 'domcontentloaded', timeout: 12000 });
    await new Promise(r => setTimeout(r, 3000));
    await pw.screenshot({ path: path.join(outDir, `fix-wake-hero-${w}.png`) });
    console.log(`Saved fix-wake-hero-${w}.png`);
    await pw.close();

    // DREAM
    const pd = await browser.newPage();
    pd.on('pageerror', e => errors.push(`dream-${w}: ${e.message.substring(0, 150)}`));
    await pd.evaluateOnNewDocument(() => { localStorage.setItem('searon-mode', 'dream'); });
    await pd.setViewport({ width: w, height: 900 });
    await pd.goto('http://localhost:3000?mode=dream&nopreload=1', { waitUntil: 'domcontentloaded', timeout: 12000 });
    await new Promise(r => setTimeout(r, 4000));
    await pd.screenshot({ path: path.join(outDir, `fix-dream-hero-${w}.png`) });
    console.log(`Saved fix-dream-hero-${w}.png`);
    await pd.close();
  }

  console.log('\n=== Errors ===');
  console.log(errors.length ? errors.join('\n') : 'None');

  await browser.close();
}

run().catch(e => { console.error(e); process.exit(1); });
