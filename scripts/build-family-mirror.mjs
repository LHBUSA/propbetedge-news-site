// Regenerates src/network/family.js from the vendored canonical src/network/family.json (see that file's header).
import fs from 'node:fs';
const j = JSON.parse(fs.readFileSync(new URL('../src/network/family.json', import.meta.url), 'utf8'));
const header = "// GENERATED from src/network/family.json (the vendored canonical family registry) — do not hand-edit.\n// Exists because the Vercel Edge middleware bundler cannot parse JSON import attributes (`with { type: 'json' }`),\n// while Node requires them; modules shared with middleware import this mirror instead. tests/network-family-mirror\n// fails if it ever differs from family.json. Regenerate: node scripts/build-family-mirror.mjs\n";
fs.writeFileSync(new URL('../src/network/family.js', import.meta.url), `${header}export default Object.freeze(${JSON.stringify(j, null, 2)});\n`);
console.log('family.js regenerated');
