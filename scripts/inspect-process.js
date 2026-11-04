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
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 2000));

  const processInfo = await page.evaluate(() => {
    const el = document.querySelector('#process');
    if (!el) return { error: 'no #process' };
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    const children = Array.from(el.querySelectorAll('*')).map(c => {
      const r = c.getBoundingClientRect();
      const s = window.getComputedStyle(c);
      return {
        tag: c.tagName,
        class: c.className,
        text: c.textContent?.trim().slice(0, 40),
        top: r.top,
        height: r.height,
        opacity: s.opacity,
        visibility: s.visibility,
        overflow: s.overflow
      };
    }).filter(c => c.text && c.text.length > 0);

    return {
      top: rect.top,
      height: rect.height,
      opacity: style.opacity,
      overflow: style.overflow,
      display: style.display,
      sampleChildren: children.slice(0, 15)
    };
  });

  console.log('Process info on initial load:');
  console.log(JSON.stringify(processInfo, null, 2));

  // Now scroll down to where process is
  await page.evaluate(() => {
    document.querySelector('#process')?.scrollIntoView();
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'test-process-view.png' });

  const processInfoScrolled = await page.evaluate(() => {
    const el = document.querySelector('#process');
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      top: rect.top,
      height: rect.height,
      visibleText: el.innerText
    };
  });
  console.log('Process info when scrolled into view:');
  console.log(JSON.stringify(processInfoScrolled, null, 2));

  await browser.close();
})();
