// Post-build proof (UPSTREAM_BROWSER_DEPENDENCY): no raw data-provider host ships in the built browser bundle.
// Browser data goes through the same-origin gateway (/api/feed) or PropSports, never straight to a provider API.
import fs from 'node:fs';
import path from 'node:path';
import { DATA_HOSTS } from './guard-source-brand.mjs';

const dist = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'dist');
const hits = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(js|mjs|html|css|json)$/.test(e.name)) {
      const m = fs.readFileSync(p, 'utf8').match(new RegExp(DATA_HOSTS.source, 'gi'));
      if (m) hits.push(`${path.relative(dist, p)}: ${[...new Set(m)].join(', ')}`);
    }
  }
})(dist);
if (hits.length) {
  console.error('Raw data-provider hosts found in the built browser bundle:\n' + hits.map((h) => ' - ' + h).join('\n'));
  process.exit(1);
}
console.log('PASS bundle hosts: no raw data-provider host in dist/.');
