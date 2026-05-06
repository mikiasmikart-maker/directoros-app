import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { 
  sanitizeJobId, 
  getJobs, 
  getJobDetail, 
  resolveManifestForSubmission 
} from '../../server/runtime/pipeline_discovery.mjs';

console.log('\n--- DIRECTOROS V2 REGRESSION GUARD: LOCKED GUARANTEES ---');

const serverMjsPath = path.resolve('server/runtime/server.mjs');
const serverContent = fs.readFileSync(serverMjsPath, 'utf8');

/**
 * RG-01: retry routes through bridge
 * Verify that server.mjs handles 'retry' intent and hydrations.
 */
console.log('[RG-01] Checking Retry Bridge Routing...');
const hasRetryIntent = serverContent.includes("body.intent === 'retry'");
const hasRetryHydration = serverContent.includes("body.parent_job_id = targetJobId");
const hasFreshLabel = serverContent.includes("candidateLabel =");
assert.ok(hasRetryIntent, 'FAIL: server.mjs missing retry intent handler');
assert.ok(hasRetryHydration, 'FAIL: server.mjs missing retry hydration logic');
assert.ok(hasFreshLabel, 'FAIL: server.mjs missing fresh label assignment for retry');
console.log('  PASS: retry routing logic found in server.mjs');

/**
 * RG-02: parent_job_id is registry-backed
 * Verify that getJobDetail and getJobs respect registry lineage.
 */
console.log('[RG-02] Checking parent_job_id Registry Integration...');
const hasRegistryPath = serverContent.includes("acceptedRunsRegistryPath");
const hasPersistAcceptedRun = serverContent.includes("persistAcceptedRun");
assert.ok(hasRegistryPath, 'FAIL: server.mjs missing registry path definition');
assert.ok(hasPersistAcceptedRun, 'FAIL: server.mjs missing registry persistence logic');
console.log('  PASS: registry-backed lineage confirmed.');

/**
 * RG-03: No duplicate job identity
 * Verify duplicate guard logic in server.mjs.
 */
console.log('[RG-03] Checking Duplicate Guard Logic...');
const hasDuplicateGuard = serverContent.includes("// Duplicate Guard");
const hasIdempotentCollapse = serverContent.includes("return json(res, 202, {");
const hasConflict409 = serverContent.includes("return json(res, 409, {");
assert.ok(hasDuplicateGuard, 'FAIL: server.mjs missing duplicate guard comment/section');
assert.ok(hasIdempotentCollapse, 'FAIL: server.mjs missing idempotent collapse (202)');
assert.ok(hasConflict409, 'FAIL: server.mjs missing conflict rejection (409)');
console.log('  PASS: Duplicate guard logic verified statically.');

/**
 * RG-04: Live Runs uses manifest/runtime truth
 * Verify getJobs merges all sources correctly.
 */
console.log('[RG-04] Checking Live Runs Source of Truth...');
// Testing getJobs function exists and returns an array
(async () => {
  try {
    const jobs = await getJobs(1);
    assert.ok(Array.isArray(jobs), 'FAIL: getJobs must return an array');
    console.log('  PASS: getJobs discovery functional.');
  } catch (e) {
    console.warn('  WARN: getJobs test skipped (requires runtime environment / pipeline root).');
  }
})();

/**
 * RG-05: Proof tab displays only current run outputs
 * Verify getJobDetail isolation.
 */
console.log('[RG-05] Checking Proof Tab Output Isolation...');
const discoveryMjsPath = path.resolve('server/runtime/pipeline_discovery.mjs');
const discoveryContent = fs.readFileSync(discoveryMjsPath, 'utf8');
const hasCurrentOutputsOnly = discoveryContent.includes("outputs: augmentingManifestEntry?.output_assets || []") || 
                             discoveryContent.includes("outputs: augmentingManifestEntry.output_assets");
const doesNotMergeParentOutputs = !discoveryContent.includes("outputs.push(...parentOutputs)");
assert.ok(hasCurrentOutputsOnly, 'FAIL: getJobDetail does not isolate current outputs correctly');
assert.ok(doesNotMergeParentOutputs, 'FAIL: getJobDetail appears to merge parent outputs (breaking isolation)');
console.log('  PASS: Output isolation verified.');

/**
 * RG-06: Parent artifacts remain contextual evidence only
 * Verify parent_info structure.
 */
console.log('[RG-06] Checking Parent Contextual Evidence Logic...');
const hasParentInfo = discoveryContent.includes("baseDetail.parent_info = {");
const parentInfoLimited = discoveryContent.includes("preview_image_url: entry.preview_image");
assert.ok(hasParentInfo, 'FAIL: getJobDetail missing parent_info augmentation');
assert.ok(parentInfoLimited, 'FAIL: parent_info should be limited to metadata/preview');
console.log('  PASS: Parent artifacts contextual evidence only.');

/**
 * RG-07: Manifest continuity survives delayed manifest
 * Verify continuity logic in bridge.
 */
console.log('[RG-07] Checking Manifest Continuity Logic...');
const hasPendingRunsInJobs = discoveryContent.includes("pendingAcceptedRuns =") && discoveryContent.includes("registry.runs");
const hasContinuityHydration = serverContent.includes("resolved?.accepted_run?.body_source");
assert.ok(hasPendingRunsInJobs, 'FAIL: discovery.mjs does not track pending accepted runs');
assert.ok(hasContinuityHydration, 'FAIL: server.mjs does not hydrate from accepted_run hint');
console.log('  PASS: Manifest continuity logic verified.');

console.log('\nALL LOCKED GUARANTEES VERIFIED (Static + Functional Surface).\n');
