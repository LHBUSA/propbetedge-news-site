/**
 * scripts/hub-backfill.mjs
 *
 * Drives the pbe-entity-hub admin refresh endpoint across the dictionary in
 * bounded slices and aggregates the per-slice reports into one coverage table.
 *
 * It does not ingest anything itself — the Worker owns ingestion, so the
 * numbers reported here are the numbers the cron will produce.
 *
 * The admin token is read from a file or the environment and is never printed.
 *
 * Usage:
 *   node scripts/hub-backfill.mjs --sports nhl,mlb,nba --token-file <path>
 *   node scripts/hub-backfill.mjs --sports nfl --kind player
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HUB = process.env.HUB_URL || 'https://pbe-entity-hub.sales-fd3.workers.dev';

const args = parse(process.argv.slice(2));
const TOKEN = args.token
  || (args.tokenFile ? readFileSync(args.tokenFile, 'utf8').trim() : '')
  || process.env.HUB_ADMIN_TOKEN
  || '';

if (!TOKEN) {
  console.error('No admin token. Pass --token-file <path> or set HUB_ADMIN_TOKEN.');
  process.exit(1);
}

const SPORTS = (args.sports || 'nhl,mlb,nba,nfl').split(',').map((s) => s.trim()).filter(Boolean);
const KINDS = args.kind ? [args.kind] : ['team', 'player'];
const SLICE = Number(args.slice) || 50;

const COUNTERS = [
  'attempted', 'written', 'unchanged', 'invalid', 'upstream_failed',
  'preserved_last_known_good', 'full', 'partial', 'identity_only',
];

async function health() {
  const res = await fetch(`${HUB}/v1/health`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`health ${res.status}`);
  return res.json();
}

async function refreshSlice(sport, kind, offset, limit) {
  const url = `${HUB}/v1/admin/refresh?sport=${sport}&kind=${kind}&offset=${offset}&limit=${limit}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'X-Hub-Admin-Token': TOKEN, Accept: 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`refresh ${res.status} ${text.slice(0, 120)}`);
  }
  return res.json();
}

function blank() {
  return Object.fromEntries(COUNTERS.map((c) => [c, 0]));
}

async function main() {
  const info = await health();
  console.log(`hub ${info.service} ${info.schema_version} | NFL team data: ${info.nfl_team_data}\n`);

  const totals = {};
  const problems = [];

  for (const sport of SPORTS) {
    const counts = info.dictionary?.[sport];
    if (!counts) { console.log(`skip ${sport}: not in dictionary`); continue; }
    totals[sport] = { team: blank(), player: blank(), dictionary: counts };

    for (const kind of KINDS) {
      const target = kind === 'team' ? counts.teams : counts.players;
      let offset = 0;
      while (offset < target) {
        const limit = Math.min(SLICE, target - offset);
        let report;
        try {
          report = await refreshSlice(sport, kind, offset, limit);
        } catch (error) {
          console.log(`  ${sport}/${kind} @${offset} FAILED: ${error.message}`);
          problems.push({ sport, kind, offset, error: String(error.message).slice(0, 160) });
          offset += limit;
          continue;
        }
        for (const counter of COUNTERS) totals[sport][kind][counter] += report[counter] || 0;
        for (const p of report.problems || []) problems.push({ sport, kind, ...p });
        offset += limit;
        process.stdout.write(`\r  ${sport}/${kind}: ${offset}/${target}   `);
      }
      process.stdout.write('\n');
    }
  }

  report(totals, problems);
}

function report(totals, problems) {
  console.log('\n═══ pbe-entity-hub backfill coverage ═══\n');
  const head = ['sport', 'kind', 'dict', 'attempt', 'written', 'unchg', 'full', 'partial', 'ident', 'invalid', 'upstream', 'kept'];
  console.log(head.map((h, i) => h.padEnd(i < 2 ? 7 : 8)).join(''));

  for (const [sport, kinds] of Object.entries(totals)) {
    for (const kind of ['team', 'player']) {
      const c = kinds[kind];
      if (!c.attempted) continue;
      const dict = kind === 'team' ? kinds.dictionary.teams : kinds.dictionary.players;
      console.log([
        sport, kind, dict, c.attempted, c.written, c.unchanged,
        c.full, c.partial, c.identity_only, c.invalid, c.upstream_failed,
        c.preserved_last_known_good,
      ].map((v, i) => String(v).padEnd(i < 2 ? 7 : 8)).join(''));
    }
  }

  console.log('\n── reconciliation ──');
  for (const [sport, kinds] of Object.entries(totals)) {
    for (const kind of ['team', 'player']) {
      const c = kinds[kind];
      if (!c.attempted) continue;
      const accounted = c.written + c.unchanged + c.invalid + c.upstream_failed;
      const ok = accounted === c.attempted;
      console.log(`${ok ? 'OK  ' : 'GAP '} ${sport}/${kind}: attempted ${c.attempted} = written ${c.written} + unchanged ${c.unchanged} + invalid ${c.invalid} + upstream_failed ${c.upstream_failed} (${accounted})`);
    }
  }

  if (problems.length) {
    console.log(`\n── problems (${problems.length}) ──`);
    const byReason = {};
    for (const p of problems) byReason[p.reason || p.error] = (byReason[p.reason || p.error] || 0) + 1;
    for (const [reason, count] of Object.entries(byReason).sort((a, b) => b[1] - a[1]).slice(0, 15)) {
      console.log(`  ${String(count).padStart(5)}  ${reason}`);
    }
  }

  mkdirSync(resolve(ROOT, 'reports'), { recursive: true });
  const file = resolve(ROOT, 'reports/hub-backfill.json');
  writeFileSync(file, JSON.stringify({
    hub: HUB, finished_at: new Date().toISOString(), totals, problems: problems.slice(0, 200),
  }, null, 2));
  console.log(`\nreport → ${file}\n`);
}

function parse(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (argv[i].startsWith('--')) out[key] = argv[i + 1]?.startsWith('--') ? true : argv[++i];
  }
  return out;
}

main().catch((error) => { console.error(error); process.exit(1); });
