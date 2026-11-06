const puppeteer = require('puppeteer-core');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function inspect() {
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('https://daikifujita.com', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 4000));

  const info = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button, [role="button"], a')).map(b => ({
      tag: b.tagName,
      id: b.id,
      className: b.className,
      text: b.innerText ? b.innerText.trim() : '',
      rect: b.getBoundingClientRect()
    }));

    const fixed = Array.from(document.querySelectorAll('*')).filter(el => {
      const style = window.getComputedStyle(el);
      return style.position === 'fixed';
    }).map(el => ({
      tag: el.tagName,
      className: typeof el.className === 'string' ? el.className : '',
      id: el.id,
      text: el.innerText ? el.innerText.trim().slice(0, 100) : '',
      rect: el.getBoundingClientRect()
    }));

    // Find main structure
    const allSections = Array.from(document.querySelectorAll('section, main, header, footer, article, [data-section]')).map(el => ({
      tag: el.tagName,
      id: el.id,
      className: typeof el.className === 'string' ? el.className : '',
      rect: el.getBoundingClientRect(),
      textSnippet: el.innerText ? el.innerText.trim().slice(0, 100).replace(/\n/g, ' ') : ''
    }));

    return {
      title: document.title,
      scrollHeight: document.documentElement.scrollHeight,
      fixedElements: fixed,
      buttons: buttons.filter(b => b.text.toLowerCase().includes('wake') || b.text.toLowerCase().includes('dream') || b.text.length < 20),
      sections: allSections
    };
  });

  console.log('Page info:', JSON.stringify(info, null, 2));
  await browser.close();
}

inspect().catch(console.error);
