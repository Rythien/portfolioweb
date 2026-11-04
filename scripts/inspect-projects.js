const puppeteer = require('puppeteer-core');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000/?nopreload=1', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 2000));

  await page.evaluate(() => {
    document.getElementById('projects')?.scrollIntoView();
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'test-projects-view-1440.png' });

  const metrics = await page.evaluate(() => {
    const sec = document.getElementById('projects');
    const track = sec?.querySelector('[ref="trackRef"]') || sec?.querySelectorAll('div')[2];
    const firstArticle = sec?.querySelector('article');
    return {
      secRect: sec?.getBoundingClientRect(),
      firstArticleRect: firstArticle?.getBoundingClientRect(),
      trackScrollWidth: track?.scrollWidth,
      windowWidth: window.innerWidth,
    };
  });
  console.log('Projects metrics:', JSON.stringify(metrics, null, 2));

  await browser.close();
})();
