import { chromium } from '@playwright/test';

(async () => {
  console.log('Starting Playwright...');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  const errors = [];
  page.on('pageerror', exception => {
    errors.push(`Uncaught exception: "${exception}"`);
  });
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(`Console error: "${msg.text()}"`);
    }
  });

  console.log('Navigating to app...');
  await page.goto('http://localhost:5173/');
  
  console.log('Waiting for network/UI...');
  await page.waitForTimeout(2000);

  console.log('Looking for Render button...');
  const renderBtn = page.getByText(/RENDER SCENE/i, { exact: false });
  if (await renderBtn.isVisible()) {
    console.log('Clicking Render button...');
    await renderBtn.click();
    console.log('Waiting 5s...');
    await page.waitForTimeout(5000);
  } else {
    console.log('Render button not found.');
  }

  if (errors.length > 0) {
    console.log('--- ERRORS DETECTED ---');
    errors.forEach(e => console.log(e));
  } else {
    console.log('--- NO ERRORS DETECTED ---');
  }

  await browser.close();
})();
