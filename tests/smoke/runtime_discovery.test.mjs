import assert from 'assert';
import { sanitizeJobId } from '../../server/runtime/pipeline_discovery.mjs';

console.log('--- SMOKE TEST: runtime_discovery.mjs ---');

// Test Case 1: Simple ID
assert.strictEqual(sanitizeJobId('job-123'), 'job-123', 'Simple ID failed');

// Test Case 2: Path-style ID (Verify replacement)
assert.strictEqual(sanitizeJobId('comfy/job-456'), 'comfy__job-456', 'Forward slash replacement failed');
assert.strictEqual(sanitizeJobId('comfy\\job-789'), 'comfy__job-789', 'Backslash replacement failed');

// Test Case 3: Mixed characters
assert.strictEqual(sanitizeJobId('rb:123/456'), 'rb__123__456', 'Mixed separator replacement failed');

console.log('PASS: sanitizeJobId logic verified.');
