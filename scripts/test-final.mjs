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

  // Test 1: Direct load in dream mode via URL param
  console.log('\n=== Test 1: ?mode=dream direct load ===');
  const p1 = await browser.newPage();
  p1.on('console', m => { if (m.type() === 'error') errors.push('T1: ' + m.text().substring(0, 100)); });
  p1.on('pageerror', e => errors.push('T1: ' + e.message.substring(0, 100)));
  await p1.setViewport({ width: 1440, height: 900 });
  await p1.goto('http://localhost:3000?mode=dream&nopreload=1', { waitUntil: 'domcontentloaded', timeout: 10000 });
  await new Promise(r => setTimeout(r, 4000));
  const mode1 = await p1.evaluate(() => document.documentElement.dataset.mode);
  const bg1 = await p1.evaluate(() => getComputedStyle(document.body).backgroundColor);
  console.log('  mode:', mode1, '  body bg:', bg1);
  await p1.screenshot({ path: path.join(outDir, 'final-dream-1440.png') });
  await p1.close();

  // Test 2: Toggle WAKE -> DREAM
  console.log('\n=== Test 2: WAKE -> DREAM toggle ===');
  const p2 = await browser.newPage();
  p2.on('console', m => { if (m.type() === 'error') errors.push('T2: ' + m.text().substring(0, 100)); });
  p2.on('pageerror', e => errors.push('T2: ' + e.message.substring(0, 100)));
  await p2.setViewport({ width: 1440, height: 900 });
  await p2.goto('http://localhost:3000?nopreload=1', { waitUntil: 'domcontentloaded', timeout: 10000 });
  await new Promise(r => setTimeout(r, 3000));

  // Click the toggle
  const btn = await p2.$('button[aria-label*="Switch to dream"]');
  if (btn) {
    const box = await btn.boundingBox();
    if (box) await p2.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  }

  // Wait for transition to complete (1400ms + buffer)
  await new Promise(r => setTimeout(r, 3000));
  const mode2 = await p2.evaluate(() => document.documentElement.dataset.mode);
  const bg2 = await p2.evaluate(() => getComputedStyle(document.body).backgroundColor);
  console.log('  mode:', mode2, '  body bg:', bg2);
  await p2.screenshot({ path: path.join(outDir, 'final-toggled-dream-1440.png') });

  // Test 3: Toggle back DREAM -> WAKE
  console.log('\n=== Test 3: DREAM -> WAKE toggle ===');
  const btn2 = await p2.$('button[aria-label*="Switch to wake"]');
  if (btn2) {
    const box = await btn2.boundingBox();
    if (box) await p2.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  }
  await new Promise(r => setTimeout(r, 3000));
  const mode3 = await p2.evaluate(() => document.documentElement.dataset.mode);
  const bg3 = await p2.evaluate(() => getComputedStyle(document.body).backgroundColor);
  console.log('  mode:', mode3, '  body bg:', bg3);
  await p2.screenshot({ path: path.join(outDir, 'final-toggled-wake-1440.png') });
  await p2.close();

  // Test 4: Persistence via localStorage
  console.log('\n=== Test 4: localStorage persistence ===');
  const p3 = await browser.newPage();
  await p3.setViewport({ width: 1440, height: 900 });
  // Set localStorage before navigating
  await p3.evaluateOnNewDocument(() => {
    localStorage.setItem('searon-mode', 'dream');
  });
  await p3.goto('http://localhost:3000?nopreload=1', { waitUntil: 'domcontentloaded', timeout: 10000 });
  await new Promise(r => setTimeout(r, 3000));
  const mode4 = await p3.evaluate(() => document.documentElement.dataset.mode);
  console.log('  localStorage dream → mode:', mode4);
  await p3.close();

  console.log('\n=== Errors ===');
  console.log(errors.length ? errors.join('\n') : 'None!');

  await browser.close();
}

run().catch(e => { console.error(e); process.exit(1); });
