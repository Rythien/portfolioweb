const puppeteer = require('puppeteer-core');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function diagnose() {
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('https://daikifujita.com', { waitUntil: 'networkidle2', timeout: 30000 });
  
  await page.screenshot({ path: 'step1-initial.png' });
  console.log('Saved step1-initial.png');

  // Let's see what is under the mouse cursor at center (720, 450)
  const centerEl = await page.evaluate(() => {
    const el = document.elementFromPoint(720, 450);
    return {
      tag: el ? el.tagName : null,
      class: el ? el.className : null,
      id: el ? el.id : null,
      text: el ? el.innerText : null
    };
  });
  console.log('Center element:', centerEl);

  // Click center
  await page.mouse.click(720, 450);
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'step2-after-click.png' });
  console.log('Saved step2-after-click.png');

  // Check center again
  const centerEl2 = await page.evaluate(() => {
    const el = document.elementFromPoint(720, 450);
    return {
      tag: el ? el.tagName : null,
      class: el ? el.className : null,
      id: el ? el.id : null,
      text: el ? el.innerText : null
    };
  });
  console.log('Center element 2:', centerEl2);

  await browser.close();
}

diagnose().catch(console.error);
