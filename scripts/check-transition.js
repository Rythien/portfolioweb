const puppeteer = require('puppeteer-core');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function checkTransition() {
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('https://daikifujita.com', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));

  console.log('Clicking enter...');
  await page.click('.ds-penter');
  await new Promise(r => setTimeout(r, 3000));

  const afterEnter = await page.evaluate(() => {
    const dsContainer = document.querySelector('[data-framer-name*="DreamShift"]');
    return {
      dsHtml: dsContainer ? dsContainer.innerHTML.slice(0, 1000) : null,
      dsVisible: dsContainer ? dsContainer.offsetWidth > 0 : false,
      allButtons: Array.from(document.querySelectorAll('button')).map(b => ({
        class: b.className,
        text: b.innerText,
        style: window.getComputedStyle(b).display
      }))
    };
  });

  console.log(JSON.stringify(afterEnter, null, 2));

  // Let's also check if there's any toggle in the footer or elsewhere
  const switchOrPill = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[role="switch"], .ds-toggle, [class*="toggle"], [class*="pill"]')).map(el => ({
      class: el.className,
      text: el.innerText,
      role: el.getAttribute('role'),
      html: el.outerHTML
    }));
  });
  console.log('Switches / Pills:', switchOrPill);

  await browser.close();
}

checkTransition().catch(console.error);
