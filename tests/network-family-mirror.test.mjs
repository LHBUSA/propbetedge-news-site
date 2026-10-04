// src/network/family.js must equal the vendored canonical src/network/family.json, and no module may use JSON
// import attributes (the Vercel Edge middleware bundler cannot parse them; 2aa63c9 failed to build on exactly that).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import FAMILY_JS from '../src/network/family.js';

test('family.js mirror == family.json (regenerate with node scripts/build-family-mirror.mjs)', () => {
  const json = JSON.parse(fs.readFileSync(new URL('../src/network/family.json', import.meta.url), 'utf8'));
  assert.deepEqual(JSON.parse(JSON.stringify(FAMILY_JS)), json);
});

test('no module imports JSON with import attributes', () => {
  const srcFiles = fs.readdirSync(new URL('../src', import.meta.url), { recursive: true })
    .filter((f) => f.endsWith('.js'))
    .map((f) => `src/${String(f).split('\\').join('/')}`);
  const importWithJson = /^\s*import[^\n]*with \{ type: ['"]json['"] \}/m;
  for (const f of ['middleware.js', ...srcFiles]) {
    assert.doesNotMatch(fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'), importWithJson, f);
  }
});
