import { test, expect } from '@playwright/test';

test.describe('DirectorOS Operator Behavior Validation', () => {

  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
  });

  test('1. Failure → Recovery Flow', async ({ page }) => {
    const jobId = 'fail_job_001';
    const shotId = 'SHOT_FAIL_TEST';

    // Seed localStorage before navigation
    await page.addInitScript(({ jobId, shotId }) => {
      const job = {
        id: jobId,
        sceneId: 'scene_01',
        shotId: shotId,
        engine: 'cinematic',
        state: 'failed',
        progress: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        bridgeJob: {
          id: jobId,
          sceneId: 'scene_01',
          engine: 'cinematic',
          payload: {
            prompt: 'A cinematic shot',
            routeContext: { activeRoute: 'cinematic', strategy: 'standard' },
            outputType: 'video'
          }
        },
        error: 'Runtime bridge submission failed'
      };
      window.localStorage.setItem('directoros.renderJobs.v1', JSON.stringify([job]));
    }, { jobId, shotId });

    await page.goto('/');
    await page.waitForSelector('text=Initializing Control Room...', { state: 'detached', timeout: 30000 });

    // Navigate to Live Runs
    await page.click('button:has-text("Live Runs")');
    
    // Check if failed job appears
    const jobCard = page.locator('button').filter({ hasText: shotId });
    await expect(jobCard).toBeVisible({ timeout: 10000 });
    await expect(jobCard).toContainText('Stalled');

    // Step 2: Check for retry affordance
    await jobCard.click();
    // Actual text found in App.tsx:4746
    await expect(page.locator('text=/Open command console for dry-run recovery/i')).toBeVisible();

    // Step 3: Verify retry action remains visually dominant
    await page.click('button:has-text("Console")');
    const retryBtn = page.locator('button:has-text("recovery")');
    await expect(retryBtn).toBeVisible();
    
    await retryBtn.click();
    await expect(page.locator('text=/Recovery initialized for selected stalled job/i')).toBeVisible();
  });

  test('2. Decision Speed Under Pressure', async ({ page }) => {
    const jobId = 'pressure_job';
    const shotId = 'SHOT_PRESSURE';

    await page.addInitScript(({ jobId, shotId }) => {
      const job = {
        id: jobId,
        sceneId: 'scene_01',
        shotId: shotId,
        engine: 'cinematic',
        state: 'running',
        progress: 50,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        bridgeJob: {
          id: jobId,
          sceneId: 'scene_01',
          engine: 'cinematic',
          payload: {
            prompt: 'Pressure test',
            routeContext: { activeRoute: 'cinematic', strategy: 'standard' },
            outputType: 'video'
          }
        }
      };
      window.localStorage.setItem('directoros.renderJobs.v1', JSON.stringify([job]));
    }, { jobId, shotId });

    await page.goto('/');
    await page.waitForSelector('text=Initializing Control Room...', { state: 'detached' });

    await page.click('button:has-text("Live Runs")');
    const jobCard = page.locator('button').filter({ hasText: shotId });
    await jobCard.click();

    // Verification of tab switching stability
    await page.click('button:has-text("Workspace")');
    await expect(page.locator('text=/Review Inbox/i')).toBeVisible();
    
    await page.click('button:has-text("Live Runs")');
    await expect(jobCard).toBeVisible();
  });

  test('3. Multi-job / Multi-state Coherence', async ({ page }) => {
    const mockJobs = [
      { id: 'j1', shotId: 'S1', state: 'running', progress: 45, engine: 'cinematic', createdAt: Date.now(), updatedAt: Date.now(), bridgeJob: { id: 'j1', sceneId: 's1', engine: 'cinematic', payload: { outputType: 'video', routeContext: { activeRoute: 'cinematic' } } } },
      { id: 'j2', shotId: 'S2', state: 'queued', progress: 0, engine: 'cinematic', createdAt: Date.now(), updatedAt: Date.now(), bridgeJob: { id: 'j2', sceneId: 's1', engine: 'cinematic', payload: { outputType: 'video', routeContext: { activeRoute: 'cinematic' } } } },
      { id: 'j3', shotId: 'S3', state: 'failed', progress: 10, error: 'OOM', engine: 'cinematic', createdAt: Date.now(), updatedAt: Date.now(), bridgeJob: { id: 'j3', sceneId: 's1', engine: 'cinematic', payload: { outputType: 'video', routeContext: { activeRoute: 'cinematic' } } } },
    ];

    await page.addInitScript((jobs) => {
      window.localStorage.setItem('directoros.renderJobs.v1', JSON.stringify(jobs));
    }, mockJobs);

    await page.goto('/');
    await page.waitForSelector('text=Initializing Control Room...', { state: 'detached' });

    await page.click('button:has-text("Live Runs")');

    // Verify jobs are present
    await expect(page.locator('button').filter({ hasText: 'S1' })).toBeVisible();
    await expect(page.locator('button').filter({ hasText: 'S3' })).toBeVisible();
    await expect(page.locator('button').filter({ hasText: 'S3' })).toContainText('Stalled');

    // Selection check
    await page.locator('button').filter({ hasText: 'S3' }).click();
    await expect(page.locator('text=/Inspector/i')).toBeVisible();
  });

});
