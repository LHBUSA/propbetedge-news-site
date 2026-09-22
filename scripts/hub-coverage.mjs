/**
 * scripts/hub-coverage.mjs
 *
 * Coverage census over what the hub actually STORES, not what a refresh run
 * happened to do. Refresh counters describe a run; this describes the store,
 * which is the number that decides whether a page is worth shipping.
 *
 * Read-only. It never triggers ingestion.
 *
 * Usage:
 *   node scripts/hub-coverage.mjs --token-file <path> [--sports nhl,mlb,nba,nfl]
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HUB = process.env.HUB_URL || 'https://pbe-entity-hub.sales-fd3.workers.dev';

const args = parse(process.argv.slice(2));
const TOKEN = args.token
  || (args.tokenFile ? readFileSync(args.tokenFile, 'utf8').trim() : '')
  || process.env.HUB_ADMIN_TOKEN || '';
if (!TOKEN) { console.error('No admin token.'); process.exit(1); }

const SPORTS = (args.sports || 'mlb,nba,nhl,nfl').split(',').map((s) => s.trim());

async function page(sport, kind, cursor, attempts = 4) {
  const url = new URL(`${HUB}/v1/admin/coverage`);
  url.searchParams.set('sport', sport);
  url.searchParams.set('kind', kind);
  url.searchParams.set('limit', '400');
  if (cursor) url.searchParams.set('cursor', cursor);

  // A census walks thousands of keys over many requests; a single transient
  // ECONNRESET should not discard the whole run.
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'X-Hub-Admin-Token': TOKEN } });
      if (!res.ok) throw new Error(`coverage ${res.status} ${(await res.text()).slice(0, 120)}`);
      return await res.json();
    } catch (error) {
      lastError = error;
      await new Promise((r) => setTimeout(r, 600 * attempt));
    }
  }
  throw lastError;
}

async function census(sport, kind) {
  let cursor;
  let dictionary = 0;
  const totals = {};
  for (;;) {
    const data = await page(sport, kind, cursor);
    dictionary = data.dictionary;
    for (const [k, v] of Object.entries(data.counts)) totals[k] = (totals[k] || 0) + v;
    if (data.list_complete || !data.cursor) break;
    cursor = data.cursor;
  }
  return { dictionary, ...totals };
}

const TEAM_FIELDS = [
  'identity', 'logo', 'roster', 'record', 'standings',
  'recent_results', 'upcoming_schedule', 'recent_form', 'team_stats', 'leaders',
];

const pct = (n, d) => (d ? `${((n / d) * 100).toFixed(1)}%` : '—');

const report = { hub: HUB, generated_at: new Date().toISOString(), sports: {} };

for (const sport of SPORTS) {
  const players = await census(sport, 'player');
  const teams = await census(sport, 'team');
  report.sports[sport] = { players, teams };

  console.log(`\n═══ ${sport.toUpperCase()} ═══`);

  const pd = players.dictionary;
  console.log(`  PLAYERS  dictionary ${pd}   stored ${players.stored}   missing ${pd - players.stored}`);
  console.log(`    full ${players.full}  partial ${players.partial}  identity_only ${players.identity_only}  unsupported ${players.unsupported}  unreadable ${players.unreadable}`);
  console.log(`    photo          ${String(players.photo).padStart(5)}  ${pct(players.photo, players.stored)}`);
  console.log(`    season stats   ${String(players.season_stats).padStart(5)}  ${pct(players.season_stats, players.stored)}`);
  console.log(`    career stats   ${String(players.career_stats).padStart(5)}  ${pct(players.career_stats, players.stored)}`);
  console.log(`    recent games   ${String(players.recent_games).padStart(5)}  ${pct(players.recent_games, players.stored)}`);
  console.log(`    team linked    ${String(players.team_linked).padStart(5)}  ${pct(players.team_linked, players.stored)}`);
  console.log(`    freshness      CURRENT ${players.CURRENT}  STALE ${players.STALE}  EXPIRED ${players.EXPIRED}`);
  const pAcc = players.full + players.partial + players.identity_only + players.unsupported + players.unreadable;
  console.log(`    ${pAcc === players.stored ? 'OK  ' : 'GAP '} stored ${players.stored} = full ${players.full} + partial ${players.partial} + identity_only ${players.identity_only} + unsupported ${players.unsupported} + unreadable ${players.unreadable} (${pAcc})`);
  const missing = players.dictionary - players.stored;
  console.log(`    ${missing === 0 ? 'OK  ' : 'GAP '} dictionary ${players.dictionary} = stored ${players.stored} + not stored ${missing}`);

  const td = teams.dictionary;
  console.log(`  TEAMS    dictionary ${td}   stored ${teams.stored}   missing ${td - teams.stored}`);
  console.log(`    ingestion state: full ${teams.full}  partial ${teams.partial}  identity_only ${teams.identity_only}  unsupported ${teams.unsupported}  unreadable ${teams.unreadable}`);
  console.log('    ── Team Snapshot V1 fields ──');
  for (const field of TEAM_FIELDS) {
    const n = teams[field] ?? 0;
    console.log(`    ${field.padEnd(18)} ${String(n).padStart(4)}/${teams.stored}  ${pct(n, teams.stored)}`);
  }
  console.log(`    ${'PAGE_READY'.padEnd(18)} ${String(teams.page_ready ?? 0).padStart(4)}/${teams.stored}  ${pct(teams.page_ready ?? 0, teams.stored)}`);
  const tAcc = teams.full + teams.partial + teams.identity_only + teams.unsupported + teams.unreadable;
  console.log(`    ${tAcc === teams.stored ? 'OK  ' : 'GAP '} stored ${teams.stored} = full ${teams.full} + partial ${teams.partial} + identity_only ${teams.identity_only} + unsupported ${teams.unsupported} + unreadable ${teams.unreadable} (${tAcc})`);
}

mkdirSync(resolve(ROOT, 'reports'), { recursive: true });
const file = resolve(ROOT, 'reports/hub-coverage.json');
writeFileSync(file, JSON.stringify(report, null, 2));
console.log(`\nreport → ${file}\n`);

function parse(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].replace(/^--/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    out[key] = argv[i + 1]?.startsWith('--') ? true : argv[++i];
  }
  return out;
}
