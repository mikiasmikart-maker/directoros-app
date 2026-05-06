import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert';

/**
 * DIRECTOROS V2 STRESS GUARD - BACKEND REGRESSION TEST
 * 
 * This test simulates non-ideal runtime conditions by mocking the pipeline root.
 * Goal: Verify discovery logic handles failures without fabricating state or identity drift.
 */

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'directoros-stress-'));
process.env.STUDIO_PIPELINE_ROOT = tmpDir;

// Setup directory structure
const outputsRoot = path.join(tmpDir, 'outputs');
const comfyRoot = path.join(outputsRoot, 'comfy');
const registryDir = path.join(outputsRoot, 'runtime');
const stateRoot = path.join(tmpDir, 'state', 'jobs');

fs.mkdirSync(comfyRoot, { recursive: true });
fs.mkdirSync(registryDir, { recursive: true });
fs.mkdirSync(stateRoot, { recursive: true });

const registryPath = path.join(registryDir, 'accepted_runs.json');

// Import discovery AFTER env is set
const { getJobs, getJobDetail, sanitizeJobId } = await import('../../server/runtime/pipeline_discovery.mjs');

console.log('\n--- DIRECTOROS V2 STRESS GUARD: FAILURE SIMULATION ---');
console.log(`Mock Pipeline Root: ${tmpDir}`);

async function runTests() {
  try {
    /**
     * STRESS-01: Delayed Manifest (The Ghost Run)
     * Setup: Accepted run in registry, but no manifest yet.
     */
    console.log('[STRESS-01] Testing Delayed Manifest (Ghost Run)...');
    const ghostJob = {
      job_id: 'ghost_001',
      accepted_at: new Date().toISOString(),
      engine_target: 'sdxl_turbo',
      mode: 'studio_run'
    };
    fs.writeFileSync(registryPath, JSON.stringify({ runs: [ghostJob] }));

    const jobs01 = await getJobs();
    const ghostMatch = jobs01.find(j => j.job_id === 'ghost_001');
    assert.ok(ghostMatch, 'FAIL: Ghost job missing from getJobs');
    assert.strictEqual(ghostMatch.status, 'queued', 'FAIL: Ghost job should be queued');
    assert.strictEqual(ghostMatch.preset, 'pending', 'FAIL: Ghost job should have pending preset');
    console.log('  PASS: Delayed manifest correctly represented as queued/pending.');

    /**
     * STRESS-02: Dead Process Recovery (The Zombie Run)
     * Setup: Accepted run with a PID that doesn't exist.
     */
    console.log('[STRESS-02] Testing Dead Process (Zombie Run)...');
    const zombieJob = {
      job_id: 'zombie_999',
      accepted_at: new Date().toISOString(),
      runtime: { pid: 99999 }, // Unlikely to be alive
      mode: 'studio_run'
    };
    fs.writeFileSync(registryPath, JSON.stringify({ runs: [ghostJob, zombieJob] }));

    const jobs02 = await getJobs();
    const zombieMatch = jobs02.find(j => j.job_id === 'zombie_999');
    assert.ok(zombieMatch, 'FAIL: Zombie job missing');
    assert.strictEqual(zombieMatch.status, 'failed', 'FAIL: Zombie job should be failed');
    assert.ok(zombieMatch.warnings.some(w => w.includes('died')), 'FAIL: Missing warning for dead process');
    console.log('  PASS: Dead process correctly flagged as failed.');

    /**
     * STRESS-03: Duplicate Retry Storm
     * Setup: Multiple entries for same job_id in registry.
     */
    console.log('[STRESS-03] Testing Duplicate Retry Storm...');
    const duplicateJob = {
      job_id: 'storm_id',
      accepted_at: new Date().toISOString(),
      mode: 'studio_run'
    };
    fs.writeFileSync(registryPath, JSON.stringify({ 
      runs: [ghostJob, zombieJob, duplicateJob, { ...duplicateJob, accepted_at: new Date().toISOString() }] 
    }));

    const jobs03 = await getJobs();
    const stormMatches = jobs03.filter(j => j.job_id === 'storm_id');
    assert.strictEqual(stormMatches.length, 1, 'FAIL: Duplicate job identity detected');
    console.log('  PASS: Duplicate retry entries collapsed into single identity.');

    /**
     * STRESS-04: Manifest Continuity (Partial Truth)
     * Setup: Manifest exists but missing optional fields.
     */
    console.log('[STRESS-04] Testing Partial Truth (Minimal Manifest)...');
    const minimalManifest = {
      job_name: 'minimal_job',
      created_at: new Date().toISOString()
      // missing status, family, template, etc.
    };
    const manifestPath = path.join(comfyRoot, 'manifest_20260506_120000.json');
    fs.writeFileSync(manifestPath, JSON.stringify(minimalManifest));

    const jobs04 = await getJobs();
    const minimalMatch = jobs04.find(j => j.job_id === 'minimal_job');
    assert.ok(minimalMatch, 'FAIL: Minimal manifest job missing');
    assert.strictEqual(minimalMatch.status, 'completed', 'FAIL: Should default to completed');
    assert.strictEqual(minimalMatch.preset, 'unknown', 'FAIL: Should default to unknown preset');
    console.log('  PASS: Partial truth handled with safe defaults.');

    console.log('\nALL STRESS GUARANTEES VERIFIED.\n');

  } catch (err) {
    console.error('\n!!! STRESS TEST FAILED !!!');
    console.error(err);
    process.exit(1);
  } finally {
    // Cleanup
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

runTests();
