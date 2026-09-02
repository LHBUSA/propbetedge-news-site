import fs from 'node:fs';
import path from 'node:path';

const ROOTS = ['src', 'public'];
const ROOT_FILES = ['index.html'];
const BANNED = [
  /Donneal Green/i,
  /donneal-green/i,
];

const TEXT_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.html', '.css', '.json', '.md', '.txt', '.xml', '.svg',
]);

const failures = [];

function scanFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!TEXT_EXTENSIONS.has(ext)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const pattern of BANNED) {
    if (pattern.test(text)) failures.push(`${filePath}: ${pattern}`);
  }
}

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else scanFile(full);
  }
}

for (const root of ROOTS) walk(root);
for (const file of ROOT_FILES) if (fs.existsSync(file)) scanFile(file);

if (failures.length) {
  console.error('Retired contributor reference check failed:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log('Retired contributor reference check: PASS');
