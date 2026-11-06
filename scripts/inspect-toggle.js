const puppeteer = require('puppeteer-core');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function inspectToggle() {
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('https://daikifujita.com', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 4000));

  const toggleDetails = await page.evaluate(() => {
    // Search for any element mentioning WAKE, DREAM, MODE, or bottom-floating elements
    const elements = Array.from(document.querySelectorAll('*'));
    const candidates = [];

    elements.forEach(el => {
      const text = el.innerText ? el.innerText.trim() : '';
      if (text.includes('WAKE') || text.includes('DREAM') || text.includes('Wake') || text.includes('Dream')) {
        const style = window.getComputedStyle(el);
        if (el.children.length <= 5) {
          candidates.push({
            tagName: el.tagName,
            className: el.className,
            id: el.id,
            text: text,
            position: style.position,
            bottom: style.bottom,
            zIndex: style.zIndex,
            html: el.outerHTML.slice(0, 300)
          });
        }
      }
    });

    // Also look specifically for fixed elements at bottom of viewport
    const bottomFixed = elements.filter(el => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return (style.position === 'fixed' || style.position === 'sticky') && rect.bottom > 800 && rect.width > 0 && rect.height > 0;
    }).map(el => ({
      tagName: el.tagName,
      className: el.className,
      id: el.id,
      text: el.innerText ? el.innerText.trim().slice(0, 100) : '',
      rect: el.getBoundingClientRect(),
      html: el.outerHTML.slice(0, 300)
    }));

    return {
      candidates: candidates.slice(0, 15),
      bottomFixed: bottomFixed.slice(0, 15)
    };
  });

  console.log(JSON.stringify(toggleDetails, null, 2));
  await browser.close();
}

inspectToggle().catch(console.error);
