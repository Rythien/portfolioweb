import puppeteer from 'puppeteer-core';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '..', 'docs');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

async function scrollToWorks(page) {
  // Use hash navigation to scroll to works
  const worksY = await page.evaluate(() => {
    const el = document.querySelector('#works');
    if (!el) return 0;
    return el.getBoundingClientRect().top + window.scrollY;
  });
  console.log('  Works Y offset:', worksY);
  // Force scroll past Lenis
  await page.evaluate((y) => {
    window.scrollTo({ top: y, behavior: 'instant' });
    // Also try to force Lenis scroll
    document.documentElement.scrollTop = y;
  }, worksY);
  await new Promise(r => setTimeout(r, 2000));
}

async function run() {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
  });

  const widths = [375, 768, 1440];

  for (const w of widths) {
    // WAKE mode
    const pw = await browser.newPage();
    await pw.evaluateOnNewDocument(() => { localStorage.removeItem('searon-mode'); });
    await pw.setViewport({ width: w, height: 900 });
    await pw.goto('http://localhost:3000?nopreload=1', { waitUntil: 'domcontentloaded', timeout: 12000 });
    await new Promise(r => setTimeout(r, 3000));
    await scrollToWorks(pw);
    await pw.screenshot({ path: path.join(outDir, `p4-wake-works-${w}.png`) });
    console.log(`Saved p4-wake-works-${w}.png`);
    await pw.close();

    // DREAM mode
    const pd = await browser.newPage();
    await pd.evaluateOnNewDocument(() => { localStorage.setItem('searon-mode', 'dream'); });
    await pd.setViewport({ width: w, height: 900 });
    await pd.goto('http://localhost:3000?mode=dream&nopreload=1', { waitUntil: 'domcontentloaded', timeout: 12000 });
    await new Promise(r => setTimeout(r, 4000));

    // Check what mode we're in
    const mode = await pd.evaluate(() => document.documentElement.dataset.mode);
    console.log(`  Dream page mode: ${mode}`);

    await scrollToWorks(pd);

    // Check scroll position
    const scrollY = await pd.evaluate(() => window.scrollY);
    console.log(`  scrollY after scroll: ${scrollY}`);

    await pd.screenshot({ path: path.join(outDir, `p4-dream-works-${w}.png`) });
    console.log(`Saved p4-dream-works-${w}.png`);
    await pd.close();
  }

  await browser.close();
  console.log('Done!');
}

run().catch(e => { console.error(e); process.exit(1); });
