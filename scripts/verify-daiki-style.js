const puppeteer = require('puppeteer-core');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function testAll() {
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu']
  });

  const viewports = [
    { name: 'desktop-1440', width: 1440, height: 900, isMobile: false },
    { name: 'tablet-768', width: 768, height: 1024, isMobile: false },
    { name: 'mobile-375', width: 375, height: 812, isMobile: true },
  ];

  const results = {};

  for (const vp of viewports) {
    const page = await browser.newPage();
    await page.setViewport({ width: vp.width, height: vp.height, isMobile: vp.isMobile });

    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => {
      errors.push(err.toString());
    });

    await page.goto('http://localhost:3000/?nopreload=1', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 2000));

    // Capture hero
    await page.screenshot({ path: `screenshot-${vp.name}-hero.png` });

    // Scroll to works
    await page.evaluate(() => {
      document.querySelector('#works')?.scrollIntoView({ behavior: 'instant' });
    });
    await new Promise(r => setTimeout(r, 800));
    await page.screenshot({ path: `screenshot-${vp.name}-works.png` });

    // Scroll to contact & footer
    await page.evaluate(() => {
      document.querySelector('#contact')?.scrollIntoView({ behavior: 'instant' });
    });
    await new Promise(r => setTimeout(r, 800));
    await page.screenshot({ path: `screenshot-${vp.name}-contact.png` });

    // Element checks
    const checks = await page.evaluate(() => {
      const header = !!document.querySelector('header');
      const about = !!document.querySelector('#about');
      const disciplines = document.querySelectorAll('.discipline-row').length;
      const works = document.querySelectorAll('.work-block').length;
      const dreamMode = !!document.querySelector('#dream-mode');
      const recognition = document.querySelectorAll('.recognition-row').length;
      const contact = !!document.querySelector('#contact');
      const footer = !!document.querySelector('footer');

      return {
        header,
        about,
        disciplinesCount: disciplines,
        worksCount: works,
        hasDreamMode: dreamMode,
        recognitionCount: recognition,
        hasContact: contact,
        hasFooter: footer,
      };
    });

    results[vp.name] = {
      errors,
      checks
    };

    await page.close();
  }

  await browser.close();
  console.log(JSON.stringify(results, null, 2));
}

testAll().catch(e => {
  console.error(e);
  process.exit(1);
});
