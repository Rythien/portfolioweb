const puppeteer = require('puppeteer-core');
const path = require('path');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function run() {
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu']
  });

  const results = {};

  for (const viewport of [
    { width: 1440, height: 900, name: '1440' },
    { width: 375, height: 812, name: '375' }
  ]) {
    const page = await browser.newPage();
    await page.setViewport({ width: viewport.width, height: viewport.height });

    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 3000));

    // Take screenshot at top
    await page.screenshot({ path: `test-top-${viewport.name}.png`, fullPage: false });

    // Check process section
    const processInfo = await page.evaluate(() => {
      const el = document.querySelector('#process');
      if (!el) return { error: 'not found' };
      const steps = el.querySelectorAll('[data-cursor="Step"]');
      const stepData = Array.from(steps).map(s => ({
        text: s.querySelector('.md\\:col-span-4')?.textContent?.trim() || s.textContent?.trim().slice(0, 30),
        visible: s.getBoundingClientRect().height > 0
      }));
      return {
        found: true,
        stepsCount: steps.length,
        steps: stepData
      };
    });

    // Check Impact section - verify no bordered boxes
    const impactInfo = await page.evaluate(() => {
      const el = document.querySelector('#results');
      if (!el) return { error: 'not found' };
      const borderedBoxes = el.querySelectorAll('.border.bg-white\\/\\[0\\.015\\]');
      const hairlineCols = el.querySelectorAll('.divide-y, .divide-x');
      return {
        borderedBoxes: borderedBoxes.length,
        hairlineDividers: hairlineCols.length
      };
    });

    // Check Contact section - verify no bordered box
    const contactInfo = await page.evaluate(() => {
      const el = document.querySelector('#contact');
      if (!el) return { error: 'not found' };
      const rightCol = el.querySelector('.divide-y');
      return {
        hasHairlineDividers: !!rightCol
      };
    });

    // Check Lab blurb
    const labInfo = await page.evaluate(() => {
      const el = document.querySelector('#lab');
      if (!el) return { error: 'not found' };
      const p = el.querySelector('p');
      return { blurb: p?.textContent?.trim() };
    });

    // Check globe section
    const journeyInfo = await page.evaluate(() => {
      const el = document.querySelector('#journey');
      if (!el) return { error: 'not found' };
      const globe = el.querySelector('pre');
      return {
        globeFound: !!globe,
        globeText: globe?.textContent?.slice(0, 80)
      };
    });

    // Check for Next.js error badge
    const errorBadge = await page.evaluate(() => {
      const badge = document.querySelector('[data-nextjs-toast], nextjs-portal');
      return !!badge;
    });

    // Scroll to process section and screenshot
    await page.evaluate(() => {
      document.querySelector('#process')?.scrollIntoView({ behavior: 'instant' });
    });
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: `test-process-${viewport.name}.png`, fullPage: false });

    // Scroll to results section
    await page.evaluate(() => {
      document.querySelector('#results')?.scrollIntoView({ behavior: 'instant' });
    });
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: `test-results-${viewport.name}.png`, fullPage: false });

    // Scroll to contact section
    await page.evaluate(() => {
      document.querySelector('#contact')?.scrollIntoView({ behavior: 'instant' });
    });
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: `test-contact-${viewport.name}.png`, fullPage: false });

    results[viewport.name] = {
      consoleErrors,
      processInfo,
      impactInfo,
      contactInfo,
      labInfo,
      journeyInfo,
      errorBadge
    };

    await page.close();
  }

  await browser.close();
  console.log(JSON.stringify(results, null, 2));
}

run().catch(e => { console.error(e); process.exit(1); });
