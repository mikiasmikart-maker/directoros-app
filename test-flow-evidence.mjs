import { chromium } from '@playwright/test';
import path from 'path';

(async () => {
  console.log('Starting Playwright for evidence gathering...');
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

  page.setViewportSize({ width: 1920, height: 1080 });

  console.log('Navigating to app...');
  await page.goto('http://localhost:5173/');
  
  console.log('Waiting for network/UI...');
  await page.waitForTimeout(3000);

  // Take pre-render screenshot
  await page.screenshot({ path: 'evidence_01_pre_render.png' });
  console.log('Took pre-render screenshot');

  console.log('Looking for Render button...');
  const renderBtn = page.getByText(/RENDER SCENE/i, { exact: false });
  if (await renderBtn.isVisible()) {
    console.log('Clicking Render button...');
    await renderBtn.click();
    
    // Wait a bit to let the job enter "running" state
    await page.waitForTimeout(2000);
    
    // Screenshot 1: Workspace during running
    await page.screenshot({ path: 'evidence_02_workspace_running.png' });
    console.log('Took Workspace running screenshot');

    // Screenshot 2: Live Runs tab
    const liveRunsTab = page.getByText('Live Runs', { exact: true });
    if (await liveRunsTab.isVisible()) {
      await liveRunsTab.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'evidence_03_liveruns_running.png' });
      console.log('Took Live Runs screenshot');
    }

    // Go back to Workspace
    const workspaceTab = page.getByText('Workspace', { exact: true });
    if (await workspaceTab.isVisible()) {
      await workspaceTab.click();
      await page.waitForTimeout(1000);
    }

    // Screenshot 3: Inspector (should be visible in Workspace)
    // Wait for the render to complete or progress significantly
    await page.waitForTimeout(8000);
    await page.screenshot({ path: 'evidence_04_workspace_final.png' });
    console.log('Took Workspace final screenshot');

  } else {
    console.log('Render button not found.');
    await page.screenshot({ path: 'evidence_error_no_btn.png' });
  }

  if (errors.length > 0) {
    console.log('--- ERRORS DETECTED ---');
    errors.forEach(e => console.log(e));
  } else {
    console.log('--- NO ERRORS DETECTED ---');
  }

  await browser.close();
})();
