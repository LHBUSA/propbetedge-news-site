// tkmln load relief (2026-10-07): browser reads of the free-picks tracker are read-only and cacheable; capture and
// settlement run only on the scheduled cycle; an unchanged row is never rewritten; /odds polls slowly and never
// while the tab is hidden. Exercises the REAL tracker through tests/helpers/tracker-harness.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { installFetch, loadTracker } from './helpers/tracker-harness.mjs';

const T = await loadTracker();
const SRC = readFileSync(new URL('../supabase/functions/free-picks-tracker/index.ts', import.meta.url), 'utf8');
const ODDS = readFileSync(new URL('../src/pages/odds.js', import.meta.url), 'utf8');
const DAY = '2027-04-01';

const featuredRow = (over = {}) => ({
  id: 'f', sport: 'MLB', period_start: DAY, public_key: 'f', source_record_id: 'f', pick_type: 'FEATURED_HR', selection: 'Aaron Judge',
  result: 'PENDING', snapshot: { selection_type: 'featured_player', official_algo: false, mlb_player_id: 592450, game_pk: 777001, game_date: DAY }, ...over,
});
const sched = (state, abstract) => ({ dates: [{ games: [{ gamePk: 777001, status: { detailedState: state, abstractGameState: abstract }, teams: { away: { team: { abbreviation: 'BOS' }, score: 2 }, home: { team: { abbreviation: 'NYY' }, score: 5 } } }] }] });
const box = (pa, hr) => ({ teams: { home: { players: { ID592450: { stats: { batting: { plateAppearances: pa, homeRuns: hr } } } } }, away: { players: {} } } });
const patches = (db) => db.calls.filter((c) => c.method === 'PATCH');

test('an unchanged PENDING row is written once, then never again while nothing changes', async () => {
  const db = installFetch({ rows: [featuredRow()], upstream: { 'https://statsapi.mlb.com/api/v1/schedule': sched('Scheduled', 'Preview') } });
  await T.resolvePending();
  assert.equal(patches(db).length, 1, 'first check records the waiting evidence');
  await T.resolvePending();
  await T.resolvePending();
  assert.equal(patches(db).length, 1, 'rechecks that only move checked_at do not PATCH');
  assert.equal(db.table[0].result, 'PENDING');
});

test('a settled MLB row re-verified with the same verdict is not rewritten; a changed verdict is', async () => {
  const db = installFetch({ rows: [featuredRow()], upstream: { 'https://statsapi.mlb.com/api/v1/schedule': sched('Final', 'Final'), 'https://statsapi.mlb.com/api/v1/game/777001/boxscore': box(4, 1) } });
  await T.resolvePending();
  assert.equal(db.table[0].result, 'WIN');
  const settledAt = db.table[0].result_at;
  const after = patches(db).length;
  await T.resolvePending(); // MLB self-heal recheck of the settled row
  assert.equal(patches(db).length, after, 'same verdict, no write');
  assert.equal(db.table[0].result_at, settledAt);
});

test('patchChanges: checked_at is a heartbeat, timestamps compare by instant, real changes are detected', () => {
  const row = { result: 'PENDING', result_at: '2026-10-01T03:12:00+00:00', score: null, evidence: { provider: 'x', checked_at: '2026-10-01T00:00:00Z', n: 1 } };
  assert.equal(T.patchChanges(row, { evidence: { n: 1, provider: 'x', checked_at: '2026-10-07T00:00:00Z' } }), false);
  assert.equal(T.patchChanges(row, { result_at: '2026-10-01T03:12:00.000Z', score: null, result: 'PENDING' }), false);
  assert.equal(T.patchChanges(row, { result: 'WIN' }), true);
  assert.equal(T.patchChanges(row, { evidence: { provider: 'x', n: 2 } }), true);
  assert.equal(T.patchChanges(row, { score: 'BOS 2 · NYY 5' }), true);
  assert.equal(T.patchChanges({ evidence: null }, { evidence: { provider: 'y' } }), true);
});

test('only one scheduled cycle runs at a time and a second within the gap is throttled', async () => {
  installFetch({ rows: [], upstream: {} });
  const now = Date.now();
  const first = T.startCycle(now);
  const second = T.startCycle(now + 1);
  assert.equal(first.state, 'started');
  assert.equal(second.state, 'in_flight');
  await first.promise;
  assert.equal(T.startCycle(now + 10_000).state, 'throttled');
  const later = T.startCycle(now + 60_000);
  assert.equal(later.state, 'started');
  await later.promise;
});

test('browser GET is read-only and cacheable; only ?cycle=1 captures/resolves', () => {
  const handler = SRC.slice(SRC.indexOf('Deno.serve('));
  assert.ok(handler.length > 0);
  assert.doesNotMatch(handler, /captureCurrent\(|resolvePending\(/, 'the request handler never captures or resolves directly');
  assert.match(handler, /isCycleRequest\(url\)/);
  assert.match(SRC, /searchParams\.get\("cycle"\) === "1"/);
  assert.match(SRC, /const PUBLIC_READ_CACHE = "public, max-age=30, s-maxage=30";/);
  assert.match(handler, /"Cache-Control":PUBLIC_READ_CACHE/);
  // The response payload keeps returning whole ledger rows (shape unchanged).
  assert.match(SRC, /\?period_start=gte\.\$\{EPOCH\}&select=\*&order=period_start\.desc,sport\.asc,slot\.asc/);
});

test('/odds polls the ledger at 60 s (live) / 120 s (idle) and never while hidden', () => {
  assert.doesNotMatch(ODDS, /setInterval\(/);
  assert.doesNotMatch(ODDS, /10 \* 1000/);
  assert.match(ODDS, /const TRACKER_LIVE_INTERVAL_MS = 60 \* 1000;/);
  assert.match(ODDS, /const TRACKER_IDLE_INTERVAL_MS = 120 \* 1000;/);
  assert.match(ODDS, /addEventListener\('visibilitychange', onVisibilityChange\)/);
  assert.match(ODDS, /if \(pageHidden\(\)\) return; \/\/ resumed by visibilitychange/);
});
