import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SKIP_DIRS = new Set([
  '.git', '.github', '.vercel', 'node_modules', 'dist', 'build', 'coverage',
  'docs', 'api', 'workers', 'server', 'scripts', 'tests', 'test', 'research',
  'history', 'supabase', 'migrations', 'data', 'fixtures', 'shared', 'lib'
]);
const EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.html', '.vue', '.svelte', '.css']);
const FORBIDDEN = [
  /\bMLB Stats API\b/gi,
  /\bThe Odds API\b/gi,
  /\bTHE ODDS API\b/g,
  /\bESPN API\b/gi,
  /\bNBA API\b/gi,
  /\bNHL API\b/gi,
  /\bWNBA API\b/gi
];

function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.well-known') continue;
    const full = path.join(dir, entry.name);
    const rel = path.relative(ROOT, full).replaceAll('\\', '/');
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(full, out);
      continue;
    }
    if (EXTENSIONS.has(path.extname(entry.name).toLowerCase())) out.push({ full, rel });
  }
  return out;
}

const violations = [];
for (const file of walk(ROOT)) {
  const raw = fs.readFileSync(file.full, 'utf8');
  const text = stripComments(raw);
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const pattern of FORBIDDEN) {
      pattern.lastIndex = 0;
      if (pattern.test(lines[i])) {
        violations.push(`${file.rel}:${i + 1}: ${lines[i].trim().slice(0, 220)}`);
      }
    }
  }
}

const publicLeaderApiDir = path.join(ROOT, 'api');
if (fs.existsSync(publicLeaderApiDir)) {
  for (const entry of fs.readdirSync(publicLeaderApiDir, { withFileTypes: true })) {
    if (!entry.isFile() || !/-leaders\.js$/i.test(entry.name)) continue;
    const full = path.join(publicLeaderApiDir, entry.name);
    const lines = stripComments(fs.readFileSync(full, 'utf8')).split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (/\bsource\s*:\s*['"](?:ESPN|The Odds API|NHL API|MLB Stats API)['"]/i.test(lines[i])) {
        violations.push(`api/${entry.name}:${i + 1}: public leader API exposes upstream source branding`);
      }
    }
  }
}

if (violations.length) {
  console.error('\nUpstream API brand leak detected in consumer-facing source.');
  console.error('Public UI should promote PropSports.PropTechUSA.ai / PropBetEdge, not implementation providers.');
  console.error('Keep legally required attribution and source-rights records in provenance/compliance surfaces.\n');
  for (const v of violations) console.error(` - ${v}`);
  process.exit(1);
}

console.log('PASS source-brand guard: no upstream API labels in consumer-facing source.');
