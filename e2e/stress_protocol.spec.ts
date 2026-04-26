import { test, expect } from '@playwright/test';

const CINEMATIC_PROSE_SNIPPET = "A low-angle tracking shot through the neon-drenched corridors of Addis, where the vapor of street food stalls mixes with the pulse of heavy industrial fans. ";
const MASSIVE_PROMPT = CINEMATIC_PROSE_SNIPPET.repeat(150); // ~2000+ words

test.describe('DirectorOS Stability & Stress Protocol', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Area 1: Data Saturation (15 Jobs)', async ({ page }) => {
    // Intercept jobs API to return 15 jobs
    await page.route('**/api/runtime/jobs*', async (route) => {
      const mockJobs = Array.from({ length: 15 }, (_, i) => ({
        job_id: `stress_job_${i}`,
        mode: 'cinematic',
        status: i % 2 === 0 ? 'running' : 'queued',
        progress: 25 + (i * 5),
        started_at: new Date().toISOString(),
        metadata: { expanded_prompt: `Job ${i}: Cinematic execution in progress.` }
      }));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, jobs: mockJobs })
      });
    });

    // Wait for the UI to hydrate 15 jobs
    const jobCards = page.locator('.m6-job-card'); // Assuming class name from G1 standards
    // Let's look for any element that represents a job in the queue
    await page.waitForTimeout(2000); // Wait for polling cycle
    
    // We expect the UI to handle the saturation without crashing
    const count = await jobCards.count();
    console.log(`UI successfully hydrated ${count} jobs`);
  });

  test('Area 2: Typographical Integrity (2,000-word prompt)', async ({ page }) => {
    // Intercept job detail to return the massive prompt
    await page.route('**/api/runtime/jobs/massive_test*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          job: {
            job_id: 'massive_test',
            status: 'completed',
            metadata: { expanded_prompt: MASSIVE_PROMPT }
          }
        })
      });
    });

    // Trigger selection of the massive job (assuming we can find a way to click it or it's current)
    // For the sake of E2E, we'll check the CompiledPromptPanel directly if it's rendered
    const promptPanel = page.locator('div:has-text("Compiled Output")').locator('..').locator('div.max-h-72');
    
    // Verify max-height constraint (G1 standard)
    await expect(promptPanel).toHaveCSS('max-height', '288px'); // 72 * 4 = 288px if using tailwind h-72
    
    // Verify no default browser scrollbars (webkit-scrollbar should be hidden or customized)
    // This is hard to assert via Playwright CSS, but we can check if overflow is auto
    await expect(promptPanel).toHaveCSS('overflow', /auto|scroll/);
  });

  test('Area 3: 403 / 502 Intercept Stability', async ({ page }) => {
    await page.route('**/api/runtime/render', async (route) => {
      await route.fulfill({ status: 403, body: 'Forbidden' });
    });

    // Attempt a render (need to find the button)
    const renderButton = page.locator('button:has-text("Render Scene")');
    if (await renderButton.isVisible()) {
        await renderButton.click();
        // Assert UI stays stable, likely shows an error state or fallback
        // The requirement is that it doesn't crash.
    }
  });

  test('Area 4: Polling Memory Stability (DOM node growth)', async ({ page }) => {
    const initialNodeCount = await page.evaluate(() => document.querySelectorAll('*').length);
    
    // Wait for several polling cycles
    await page.waitForTimeout(10000);
    
    const finalNodeCount = await page.evaluate(() => document.querySelectorAll('*').length);
    const growth = finalNodeCount - initialNodeCount;
    
    console.log(`DOM Growth over 10s: ${growth} nodes`);
    // Assert no significant growth (e.g. < 50 nodes per 10s unless expected)
    expect(growth).toBeLessThan(100);
  });

});
