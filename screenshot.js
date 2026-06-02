const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({width: 1280, height: 900});
  await page.goto('https://ethan-expert.pages.dev/', {
    waitUntil: 'networkidle2',
    timeout: 30000
  });
  await page.screenshot({
    path: 'C:\\Users\\swags\\Documents\\ethan_expert\\site_screenshot.png',
    fullPage: true
  });
  await browser.close();
  console.log('Screenshot saved successfully.');
})();
