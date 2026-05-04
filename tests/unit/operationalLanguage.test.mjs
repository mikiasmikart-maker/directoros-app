import fs from 'fs';
import path from 'path';
import assert from 'assert';

console.log('--- UNIT TEST: operationalLanguage.ts ---');

const filePath = path.resolve('src/utils/operationalLanguage.ts');
const content = fs.readFileSync(filePath, 'utf8');

// Guard 1: Verify SEALED mapping
assert.ok(content.includes("'SEALED'"), 'Missing mapping to SEALED');
assert.ok(content.match(/s === 'completed'.*return 'SEALED'/s), 'Logic for SEALED mapping is broken');

// Guard 2: Verify BROKEN mapping
assert.ok(content.includes("'BROKEN'"), 'Missing mapping to BROKEN');
assert.ok(content.match(/s === 'failed'.*return 'BROKEN'/s), 'Logic for BROKEN mapping is broken');

// Guard 3: Verify ACTIVE fallback
assert.ok(content.includes("'ACTIVE'"), 'Missing fallback to ACTIVE');

console.log('PASS: Operational language mappings verified statically.');
