# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: operator_behavior.spec.ts >> DirectorOS Operator Behavior Validation >> 1. Failure → Recovery Flow
- Location: e2e\operator_behavior.spec.ts:9:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=/Open command console for dry-run recovery/i')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('text=/Open command console for dry-run recovery/i')

```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test.describe('DirectorOS Operator Behavior Validation', () => {
  4   | 
  5   |   test.beforeEach(async ({ page }) => {
  6   |     test.setTimeout(60000);
  7   |   });
  8   | 
  9   |   test('1. Failure → Recovery Flow', async ({ page }) => {
  10  |     const jobId = 'fail_job_001';
  11  |     const shotId = 'SHOT_FAIL_TEST';
  12  | 
  13  |     // Seed localStorage before navigation
  14  |     await page.addInitScript(({ jobId, shotId }) => {
  15  |       const job = {
  16  |         id: jobId,
  17  |         sceneId: 'scene_01',
  18  |         shotId: shotId,
  19  |         engine: 'cinematic',
  20  |         state: 'failed',
  21  |         progress: 0,
  22  |         createdAt: Date.now(),
  23  |         updatedAt: Date.now(),
  24  |         bridgeJob: {
  25  |           id: jobId,
  26  |           sceneId: 'scene_01',
  27  |           engine: 'cinematic',
  28  |           payload: {
  29  |             prompt: 'A cinematic shot',
  30  |             routeContext: { activeRoute: 'cinematic', strategy: 'standard' },
  31  |             outputType: 'video'
  32  |           }
  33  |         },
  34  |         error: 'Runtime bridge submission failed'
  35  |       };
  36  |       window.localStorage.setItem('directoros.renderJobs.v1', JSON.stringify([job]));
  37  |     }, { jobId, shotId });
  38  | 
  39  |     await page.goto('/');
  40  |     await page.waitForSelector('text=Initializing Control Room...', { state: 'detached', timeout: 30000 });
  41  | 
  42  |     // Navigate to Live Runs
  43  |     await page.click('button:has-text("Live Runs")');
  44  |     
  45  |     // Check if failed job appears
  46  |     const jobCard = page.locator('button').filter({ hasText: shotId });
  47  |     await expect(jobCard).toBeVisible({ timeout: 10000 });
  48  |     await expect(jobCard).toContainText('Stalled');
  49  | 
  50  |     // Step 2: Check for retry affordance
  51  |     await jobCard.click();
  52  |     // Actual text found in App.tsx:4746
> 53  |     await expect(page.locator('text=/Open command console for dry-run recovery/i')).toBeVisible();
      |                                                                                     ^ Error: expect(locator).toBeVisible() failed
  54  | 
  55  |     // Step 3: Verify retry action remains visually dominant
  56  |     await page.click('button:has-text("Console")');
  57  |     const retryBtn = page.locator('button:has-text("recovery")');
  58  |     await expect(retryBtn).toBeVisible();
  59  |     
  60  |     await retryBtn.click();
  61  |     await expect(page.locator('text=/Recovery initialized for selected stalled job/i')).toBeVisible();
  62  |   });
  63  | 
  64  |   test('2. Decision Speed Under Pressure', async ({ page }) => {
  65  |     const jobId = 'pressure_job';
  66  |     const shotId = 'SHOT_PRESSURE';
  67  | 
  68  |     await page.addInitScript(({ jobId, shotId }) => {
  69  |       const job = {
  70  |         id: jobId,
  71  |         sceneId: 'scene_01',
  72  |         shotId: shotId,
  73  |         engine: 'cinematic',
  74  |         state: 'running',
  75  |         progress: 50,
  76  |         createdAt: Date.now(),
  77  |         updatedAt: Date.now(),
  78  |         bridgeJob: {
  79  |           id: jobId,
  80  |           sceneId: 'scene_01',
  81  |           engine: 'cinematic',
  82  |           payload: {
  83  |             prompt: 'Pressure test',
  84  |             routeContext: { activeRoute: 'cinematic', strategy: 'standard' },
  85  |             outputType: 'video'
  86  |           }
  87  |         }
  88  |       };
  89  |       window.localStorage.setItem('directoros.renderJobs.v1', JSON.stringify([job]));
  90  |     }, { jobId, shotId });
  91  | 
  92  |     await page.goto('/');
  93  |     await page.waitForSelector('text=Initializing Control Room...', { state: 'detached' });
  94  | 
  95  |     await page.click('button:has-text("Live Runs")');
  96  |     const jobCard = page.locator('button').filter({ hasText: shotId });
  97  |     await jobCard.click();
  98  | 
  99  |     // Verification of tab switching stability
  100 |     await page.click('button:has-text("Workspace")');
  101 |     await expect(page.locator('text=/Review Inbox/i')).toBeVisible();
  102 |     
  103 |     await page.click('button:has-text("Live Runs")');
  104 |     await expect(jobCard).toBeVisible();
  105 |   });
  106 | 
  107 |   test('3. Multi-job / Multi-state Coherence', async ({ page }) => {
  108 |     const mockJobs = [
  109 |       { id: 'j1', shotId: 'S1', state: 'running', progress: 45, engine: 'cinematic', createdAt: Date.now(), updatedAt: Date.now(), bridgeJob: { id: 'j1', sceneId: 's1', engine: 'cinematic', payload: { outputType: 'video', routeContext: { activeRoute: 'cinematic' } } } },
  110 |       { id: 'j2', shotId: 'S2', state: 'queued', progress: 0, engine: 'cinematic', createdAt: Date.now(), updatedAt: Date.now(), bridgeJob: { id: 'j2', sceneId: 's1', engine: 'cinematic', payload: { outputType: 'video', routeContext: { activeRoute: 'cinematic' } } } },
  111 |       { id: 'j3', shotId: 'S3', state: 'failed', progress: 10, error: 'OOM', engine: 'cinematic', createdAt: Date.now(), updatedAt: Date.now(), bridgeJob: { id: 'j3', sceneId: 's1', engine: 'cinematic', payload: { outputType: 'video', routeContext: { activeRoute: 'cinematic' } } } },
  112 |     ];
  113 | 
  114 |     await page.addInitScript((jobs) => {
  115 |       window.localStorage.setItem('directoros.renderJobs.v1', JSON.stringify(jobs));
  116 |     }, mockJobs);
  117 | 
  118 |     await page.goto('/');
  119 |     await page.waitForSelector('text=Initializing Control Room...', { state: 'detached' });
  120 | 
  121 |     await page.click('button:has-text("Live Runs")');
  122 | 
  123 |     // Verify jobs are present
  124 |     await expect(page.locator('button').filter({ hasText: 'S1' })).toBeVisible();
  125 |     await expect(page.locator('button').filter({ hasText: 'S3' })).toBeVisible();
  126 |     await expect(page.locator('button').filter({ hasText: 'S3' })).toContainText('Stalled');
  127 | 
  128 |     // Selection check
  129 |     await page.locator('button').filter({ hasText: 'S3' }).click();
  130 |     await expect(page.locator('text=/Inspector/i')).toBeVisible();
  131 |   });
  132 | 
  133 | });
  134 | 
```