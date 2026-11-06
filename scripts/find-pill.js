const puppeteer = require('puppeteer-core');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function findPill() {
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('https://daikifujita.com', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));
  const enterBtn = await page.$('.ds-penter');
  if (enterBtn) {
    await enterBtn.click();
    await new Promise(r => setTimeout(r, 3000));
  }

  const matches = await page.evaluate(() => {
    // Look for all elements that have text matching wake or dream, case insensitive
    const all = Array.from(document.querySelectorAll('*'));
    return all.filter(el => {
      const t = el.innerText || '';
      return /wake/i.test(t) && /dream/i.test(t);
    }).map(el => ({
      tag: el.tagName,
      className: el.className,
      id: el.id,
      rect: el.getBoundingClientRect(),
      text: el.innerText.slice(0, 150),
      html: el.outerHTML.slice(0, 250)
    }));
  });

  console.log('Matches:', JSON.stringify(matches, null, 2));

  // Also let's inspect what happens if we click "ENTER THE DREAM" or check all fixed elements
  const allFixed = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('*')).filter(el => {
      const style = window.getComputedStyle(el);
      return style.position === 'fixed' && el.offsetWidth > 0;
    }).map(el => ({
      tag: el.tagName,
      className: el.className,
      id: el.id,
      text: (el.innerText || '').slice(0, 80),
      rect: el.getBoundingClientRect()
    }));
  });

  console.log('All fixed:', JSON.stringify(allFixed, null, 2));

  await browser.close();
}

findPill().catch(console.error);
