import fs from 'fs';
import path from 'path';
import assert from 'assert';

import { fileURLToPath } from 'url';

console.log('--- UNIT TEST: operationalLanguage.ts ---');

// Use relative path from this file to find the source
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.resolve(__dirname, '../../src/utils/operationalLanguage.ts');
const content = fs.readFileSync(filePath, 'utf8');

const requiredMappings = [
  { key: 'queued', label: 'IDLE' },
  { key: 'preflight', label: 'PRECHECK' },
  { key: 'running', label: 'FLOWING' },
  { key: 'packaging', label: 'SEALING' },
  { key: 'completed', label: 'SEALED' },
  { key: 'failed', label: 'BROKEN' },
  { key: 'cancelled', label: 'CANCELLED' }
];

requiredMappings.forEach(({ key, label }) => {
  assert.ok(content.includes(`'${key}': '${label}'`), `Missing mapping for ${key} -> ${label}`);
});

assert.ok(content.includes("'ACTIVE'"), 'Missing fallback to ACTIVE');

console.log('PASS: All constitutional operational labels verified.');
