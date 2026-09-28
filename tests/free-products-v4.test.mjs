// Free products 2026-09-28: MLB Featured Player (NOT an Algo pick) + NFL Free TD Targets.
// Exercises the REAL tracker (supabase/functions/free-picks-tracker/index.ts) and the board contract.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { installFetch, loadTracker } from './helpers/tracker-harness.mjs';
import {
  buildFreeBoard, checkFreePickInvariant, countsTowardRecord, isFeaturedPlayer, isTdTarget, latestResults,
  namespacedRecord, productLabel, selectionType,
} from '../src/lib/free-board.js';

const T = await loadTracker();
const MLB_URL = 'https://mlb.propbetedge.ai/api/free-featured-player';
const NFL_URL = 'https://nfl.propbetedge.ai/api/pbe-touchdown-targets';
const DAY = '2027-04-01'; // future slate so "before first pitch / kickoff" holds whenever the suite runs
const START = `${DAY}T23:05:00Z`;

const featuredPayload = (over = {}) => ({
  contract: 'pbe-mlb-free-featured-player-v1', product_version: 'mlb-free-featured-player/1.0.0', game_date: DAY,
  official_algo: false, selection_type: 'featured_player', generated_at: `${DAY}T12:00:00Z`, rule: { id: 'featured_player_editorial_v1' },
  official_picks_url: 'https://mlb.propbetedge.ai/hr-picks',
  featured: {
    featured_id: `MLB-FEATURED:${DAY}:592450`, selection_type: 'featured_player', selection_source: 'free_editorial_selector', official_algo: false,
    player_id: 592450, player_name: 'Aaron Judge', team: 'New York Yankees', team_abbr: 'NYY', opponent: 'Boston Red Sox', opponent_abbr: 'BOS',
    home_away: 'home', game_pk: 777001, game_start: START, game_status: 'Scheduled', pregame: true,
    insights: [{ kind: 'season', label: '2026 season', value: '40 HR · 1.000 OPS in 600 PA' }], ...over,
  },
});
const target = (id, player, over = {}) => ({
  target_id: id, selection_type: 'td_target', free: true, official: true, publication_scope: 'official', market: 'player_anytime_td',
  player_id: `p-${player}`, player_name: player, position: 'RB', team: 'KC', opponent: 'LV', home_away: 'home', game_id: 'g1',
  kickoff_ts: `${DAY}T20:25:00Z`, slate_date: DAY, model_version: 'pbe-td-hazard-v1', issued_at: `${DAY}T12:00:00Z`, insights: [], ...over,
});
const tdPayload = (targets, over = {}) => ({
  contract: 'pbe-nfl-free-td-targets-v1', product_version: 'nfl-free-td-targets/1.0.0', slate_date: DAY, max_targets: 2,
  count: targets.length, targets, eligibility: { gate_open: true }, ...over,
});
const quiet = { 'https://ufc.propbetedge.ai': {}, 'https://wnba-api.propbetedge.ai': {}, 'https://nhl-api.propbetedge.ai': {} };

// Legacy rows exactly as the v3 tracker stored them (no selection_type in the snapshot).
const LEGACY_MLB = { id: 'legacy-mlb', sport: 'MLB', cadence: 'daily', period_start: '2026-09-22', slot: 1, public_key: 'MLB:2026-09-22:x:HR', pick_type: 'HR', selection: 'Pete Alonso', result: 'WIN', snapshot: { mlb_player_id: 624413, game_date: '2026-09-22', hr_probability: 0.21 }, published_at: '2026-09-22T15:00:00Z' };
const LEGACY_NFL = { id: 'legacy-nfl', sport: 'NFL', cadence: 'weekly', period_start: '2026-09-20', slot: 1, public_key: 'NFL:2026:2:x:BUF -3', pick_type: 'spread', selection: 'BUF -3', result: 'LOSS', event_start_at: '2026-09-21T17:00:00Z', snapshot: { market: 'spread', selection: 'BUF -3' }, published_at: '2026-09-20T15:00:00Z' };

async function capture(upstream, rows = []) {
  const db = installFetch({ rows, upstream: { ...quiet, ...upstream } });
  const report = await T.captureCurrent();
  const payload = await T.responsePayload(report);
  return { db, report, payload };
}

test('MLB: a Featured Player is captured with ZERO Algo picks, structurally non-Algo, one per day', async () => {
  const { db, payload } = await capture({ [MLB_URL]: featuredPayload(), [NFL_URL]: tdPayload([]) });
  const rows = db.table.filter((r) => r.sport === 'MLB');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].pick_type, 'FEATURED_HR');
  assert.equal(rows[0].snapshot.selection_type, 'featured_player');
  assert.equal(rows[0].snapshot.selection_source, 'free_editorial_selector');
  assert.equal(rows[0].snapshot.official_algo, false);
  assert.equal(rows[0].snapshot.record_namespace, 'free_featured_player_record');
  for (const k of ['hr_probability', 'score', 'model_score', 'probability']) assert.ok(!(k in rows[0].snapshot), k);
  const e = payload.entries.find((x) => x.sport === 'MLB');
  assert.equal(e.record_class, 'free_featured_player');
  assert.equal(e.counts_toward_record, true, 'owner 2026-09-27: a published Featured Player counts toward the overall free record');
  assert.equal(e.official_algo, false);
  assert.equal(payload.contract, 'pbe-free-picks-tracker-v4');
  // A second, different featured payload the same day never adds a second row.
  const again = installFetch({ rows: db.table, upstream: { ...quiet, [MLB_URL]: featuredPayload({ featured_id: `MLB-FEATURED:${DAY}:1`, player_id: 1, player_name: 'Other' }), [NFL_URL]: tdPayload([]) } });
  await T.captureCurrent();
  assert.equal(again.table.filter((r) => r.sport === 'MLB').length, 1);
});

test('MLB: an Algo-shaped or post-first-pitch or pre-boundary payload is never captured as the free pick', async () => {
  const algoShaped = featuredPayload(); algoShaped.featured.official_algo = true;
  const started = featuredPayload({ pregame: false });
  const early = { ...featuredPayload(), game_date: '2026-09-27' };
  const retired = { contract: 'pbe-mlb-free-hr-v1', picks: [{ id: 'x', player_name: 'Algo Guy', mlb_player_id: 1, hr_probability: 0.3 }] };
  for (const body of [algoShaped, started, early, retired]) {
    const { db } = await capture({ [MLB_URL]: body, [NFL_URL]: tdPayload([]) });
    assert.equal(db.table.filter((r) => r.sport === 'MLB').length, 0, JSON.stringify(body).slice(0, 80));
  }
});

test('Featured grading: its own record AND the overall free record move; legacy Algo-era namespace never does', async () => {
  const featuredWin = { id: 'f1', sport: 'MLB', cadence: 'daily', period_start: DAY, slot: 1, public_key: `MLB-FEATURED:${DAY}:592450`, source_record_id: `MLB-FEATURED:${DAY}:592450`, pick_type: 'FEATURED_HR', selection: 'Aaron Judge', result: 'WIN', snapshot: { selection_type: 'featured_player', official_algo: false, record_namespace: 'free_featured_player_record', mlb_player_id: 592450, game_date: DAY }, published_at: `${DAY}T12:00:00Z` };
  installFetch({ rows: [LEGACY_MLB, LEGACY_NFL] });
  const before = await T.responsePayload({});
  installFetch({ rows: [LEGACY_MLB, LEGACY_NFL, featuredWin] });
  const after = await T.responsePayload({});
  assert.equal(after.record.wins, before.record.wins + 1, 'overall free-picks record takes the featured HIT');
  assert.equal(after.records.free_featured_player_record.lifetime.wins, 1);
  assert.deepEqual(after.records.legacy.mlb_algo_free_picks, before.records.legacy.mlb_algo_free_picks, 'legacy Algo-era namespace unchanged');
  installFetch({ rows: [{ ...LEGACY_MLB, result: 'LOSS' }, LEGACY_NFL, featuredWin] });
  const flipped = await T.responsePayload({});
  assert.deepEqual(flipped.records.free_featured_player_record, after.records.free_featured_player_record, 'Algo-era rows never move the featured record');
});

test('historical Algo free picks and NFL team picks stay labelled with the product that generated them', async () => {
  installFetch({ rows: [LEGACY_MLB, LEGACY_NFL] });
  const p = await T.responsePayload({});
  const mlb = p.entries.find((e) => e.id === 'legacy-mlb');
  const nfl = p.entries.find((e) => e.id === 'legacy-nfl');
  assert.equal(mlb.selection_type, 'algo');
  assert.equal(mlb.official_algo, true);
  assert.equal(mlb.product_version, 'mlb-free-algo/legacy');
  assert.equal(mlb.counts_toward_record, true);
  assert.equal(nfl.selection_type, 'team_pick');
  assert.equal(nfl.product_version, 'nfl-free-team-picks/legacy');
  assert.deepEqual(p.records.legacy.nfl_team_picks.lifetime, { wins: 0, losses: 1, pushes: 0, voids: 0, pending: 0, hit_rate: 0 });
  assert.equal(p.records.free_td_target_record.lifetime.losses, 0, 'team picks never enter the TD Target record');
  assert.equal(p.products.boundary, '2026-09-28');
  // Frontend derives the same labels for a v3 payload.
  assert.equal(selectionType(LEGACY_MLB), 'algo');
  assert.match(productLabel(LEGACY_MLB), /LEGACY/);
  assert.equal(selectionType(LEGACY_NFL), 'team_pick');
});

test('same player can be the Featured Player and an Algo pick without double counting', async () => {
  const algoSameDay = { ...LEGACY_MLB, id: 'algo-same', period_start: DAY, public_key: `MLB:${DAY}:592450:HR`, source_record_id: 'uuid-1', snapshot: { mlb_player_id: 592450, game_date: DAY }, result: 'WIN' };
  const featured = { id: 'f-same', sport: 'MLB', period_start: DAY, slot: 2, public_key: `MLB-FEATURED:${DAY}:592450`, source_record_id: `MLB-FEATURED:${DAY}:592450`, pick_type: 'FEATURED_HR', selection: 'Aaron Judge', result: 'WIN', snapshot: { selection_type: 'featured_player', official_algo: false, mlb_player_id: 592450, game_date: DAY } };
  installFetch({ rows: [algoSameDay, featured] });
  const p = await T.responsePayload({});
  assert.equal(p.entries.length, 2, 'distinct identities (pick_type differs), neither collapses into the other');
  assert.equal(p.record.wins, 2, 'two genuinely published free picks -> the overall record counts each exactly once');
  assert.equal(p.records.free_featured_player_record.lifetime.wins, 1, 'featured record counts only the featured row');
  assert.equal(p.records.legacy.mlb_algo_free_picks.lifetime.wins, 1, 'Algo-sourced namespace counts only the Algo row');
  assert.notEqual(T.stableIdentity('MLB', algoSameDay), T.stableIdentity('MLB', featured));
});

test('NFL: max two official TD Targets per slate; tracking targets and duplicates never captured', async () => {
  const three = [target('t1', 'Isiah Pacheco'), target('t2', 'Travis Kelce', { position: 'TE' }), target('t3', 'Marvin Harrison Jr.', { position: 'WR', team: 'ARI', game_id: 'g2' })];
  const { db, payload } = await capture({ [MLB_URL]: {}, [NFL_URL]: tdPayload(three) });
  const nfl = db.table.filter((r) => r.sport === 'NFL');
  assert.equal(nfl.length, 2);
  assert.deepEqual(nfl.map((r) => r.public_key), ['NFL-TD:t1', 'NFL-TD:t2']);
  assert.ok(nfl.every((r) => r.snapshot.selection_type === 'td_target' && r.snapshot.official === true && r.snapshot.free === true));
  assert.ok(nfl.every((r) => r.cadence === 'daily' && r.period_start === DAY));
  assert.equal(payload.records.free_td_target_record.lifetime.pending, 2);

  // Owner decision (1.1.0): a PRIMARY tracking target is free-eligible, stored with its true scope.
  const tracking = [target('t9', 'Tracked Guy', { publication_scope: 'tracking', official: false })];
  const t2 = await capture({ [MLB_URL]: {}, [NFL_URL]: tdPayload(tracking) });
  const tr = t2.db.table.filter((r) => r.sport === 'NFL');
  assert.equal(tr.length, 1, 'tracking primary target is a free pick');
  assert.equal(tr[0].snapshot.official, false);
  assert.equal(tr[0].snapshot.publication_scope, 'tracking');
  const trEntry = t2.payload.entries.find((e) => e.sport === 'NFL');
  assert.equal(trEntry.official, false, 'never presented as official');
  assert.equal(trEntry.record_class, 'free_pick');
  // Mislabelled (tracking claimed official) or non-free scopes are refused, never repaired.
  for (const bad of [
    target('m1', 'Mislabel', { publication_scope: 'tracking', official: true }),
    target('m2', 'Validation', { publication_scope: 'validation', official: false }),
    target('m3', 'Shadow', { publication_scope: 'shadow', official: false }),
    target('m4', 'NotFree', { publication_scope: 'tracking', official: false, free: false }),
  ]) {
    const r = await capture({ [MLB_URL]: {}, [NFL_URL]: tdPayload([bad]) });
    assert.equal(r.db.table.filter((x) => x.sport === 'NFL').length, 0, bad.player_name);
  }

  const dup = [target('t1', 'Isiah Pacheco'), target('t1b', 'Isiah Pacheco')];
  const t3 = await capture({ [MLB_URL]: {}, [NFL_URL]: tdPayload(dup) });
  assert.equal(t3.db.table.filter((r) => r.sport === 'NFL').length, 1, 'same player + game only once');
});

test('NFL: one qualifying target -> one row; zero -> zero (no threshold lowering, no manufacturing)', async () => {
  const one = await capture({ [MLB_URL]: {}, [NFL_URL]: tdPayload([target('solo', "Ja'Marr Chase")]) });
  assert.equal(one.db.table.filter((r) => r.sport === 'NFL').length, 1);
  const zero = await capture({ [MLB_URL]: {}, [NFL_URL]: tdPayload([], { eligibility: { gate_open: false, reason: 'td_publication_gated' } }) });
  assert.equal(zero.db.table.filter((r) => r.sport === 'NFL').length, 0);
  const team = await capture({ [MLB_URL]: {}, [NFL_URL]: { contract: 'pbe-free-sample-v1', picks: [{ selection: 'KC -3', market: 'spread', kickoff_ts: `${DAY}T20:25:00Z` }] } });
  assert.equal(team.db.table.filter((r) => r.sport === 'NFL').length, 0, 'team picks are no longer captured');
});

test('board: featured card renders, stays out of the free-picks record, invariant passes; legacy rows keep labels', () => {
  const featured = { sport: 'MLB', period_start: DAY, public_key: 'F', selection: 'Aaron Judge', result: 'PENDING', event_start_at: START, record_class: 'free_featured_player', counts_toward_record: false, selection_type: 'featured_player', snapshot: { selection_type: 'featured_player', game_date: DAY, official_algo: false } };
  const td = { sport: 'NFL', period_start: DAY, public_key: 'NFL-TD:t1', selection: 'Isiah Pacheco', result: 'WIN', event_start_at: `${DAY}T20:25:00Z`, selection_type: 'td_target', snapshot: { selection_type: 'td_target' } };
  const tracker = {
    ok: true, record: { wins: 1, losses: 0, pushes: 0, pending: 0 },
    by_sport: { MLB: { wins: 0, losses: 0, pushes: 0, pending: 0 }, NFL: { wins: 1, losses: 0, pushes: 0, pending: 0 } },
    records: { free_featured_player_record: { lifetime: { wins: 0, losses: 0, pending: 1 } }, free_td_target_record: { lifetime: { wins: 1, losses: 0, pending: 0 } } },
    entries: [featured, td],
  };
  const now = new Date(`${DAY}T15:00:00Z`);
  const board = buildFreeBoard(tracker, now);
  assert.equal(board.current.length, 1);
  assert.equal(board.current[0].entry.public_key, 'F');
  assert.equal(countsTowardRecord(featured), false);
  assert.equal(isFeaturedPlayer(featured), true);
  assert.equal(isTdTarget(td), true);
  const inv = checkFreePickInvariant({ displayed: [{ public_key: 'F', sport: 'mlb', label: 'Aaron Judge' }], tracker, board });
  assert.equal(inv.pass, true, inv.failures.join('; '));
  assert.equal(namespacedRecord(tracker, 'free_td_target_record').record, '1–0');
  const settled = { ...featured, result: 'WIN', result_at: `${DAY}T23:59:00Z` };
  assert.equal(latestResults({ ...tracker, entries: [settled, td] }).length, 2, 'featured receipts show (labelled) in Latest Results');
});

test('pages: stale free-Algo / team-pick copy removed; CTAs point at official Algo Picks and the TD board', () => {
  const odds = readFileSync(new URL('../src/pages/odds.js', import.meta.url), 'utf8');
  const header = readFileSync(new URL('../src/components/header.js', import.meta.url), 'utf8');
  const history = readFileSync(new URL('../src/pages/free-picks-history.js', import.meta.url), 'utf8');
  assert.ok(!/free-hr-sample|pbe-picks\?view=free-sample/.test(odds + header), 'no retired free feeds');
  assert.ok(!/No MLB HR pick currently qualifies/.test(odds));
  assert.ok(odds.includes("See today's official Algo Picks →"));
  assert.ok(odds.includes('Unlock all TD Targets →'));
  assert.ok(odds.includes('MLB · FREE PLAYER PICK'));
  assert.ok(odds.includes('NFL · FREE TD TARGET'));
  assert.ok(odds.includes('No qualified free TD targets yet'));
  assert.ok(history.includes('FEATURED PLAYER · NOT AN ALGO PICK'));
  const retired = readFileSync(new URL('../api/mlb-hr-sample.js', import.meta.url), 'utf8');
  assert.ok(!/rest\/v1\/picks|hr_prob_today/.test(retired), 'legacy propbetedge.ai MLB HR sample no longer reads Algo picks');
});

test('featured grading: HR -> HIT, batted without HR -> MISS, no PA -> VOID, postponed -> stays PENDING', async () => {
  const row = (id) => ({ id, sport: 'MLB', period_start: DAY, public_key: id, source_record_id: id, pick_type: 'FEATURED_HR', selection: 'Aaron Judge', result: 'PENDING', snapshot: { selection_type: 'featured_player', official_algo: false, mlb_player_id: 592450, game_pk: 777001, game_date: DAY } });
  const sched = (state, abstract = 'Final') => ({ dates: [{ games: [{ gamePk: 777001, status: { detailedState: state, abstractGameState: abstract }, teams: { away: { team: { abbreviation: 'BOS' }, score: 2 }, home: { team: { abbreviation: 'NYY' }, score: 5 } } }] }] });
  const box = (pa, hr) => ({ teams: { home: { players: { ID592450: { stats: { batting: { plateAppearances: pa, homeRuns: hr } } } } }, away: { players: {} } } });
  const cases = [['Final', box(4, 1), 'WIN'], ['Final', box(4, 0), 'LOSS'], ['Final', box(0, 0), 'VOID'], ['Postponed', box(0, 0), 'PENDING']];
  for (const [state, b, want] of cases) {
    const db = installFetch({ rows: [row('f')], upstream: { 'https://statsapi.mlb.com/api/v1/schedule': sched(state, state === 'Final' ? 'Final' : 'Preview'), 'https://statsapi.mlb.com/api/v1/game/777001/boxscore': b } });
    await T.resolvePending();
    assert.equal(db.table[0].result, want, state);
    assert.equal(db.table[0].evidence.record_namespace, 'free_featured_player_record');
    assert.ok(!db.calls.some((c) => /mlb-v2|picks\?|rest\/v1\/picks/.test(c.url)), 'featured grading never reads Algo sources');
  }
});

test('free TD Target settles ONLY from the canonical TD grade (no second grader); replaced-before-kickoff = withdrawn', async () => {
  const row = { id: 'td', sport: 'NFL', period_start: DAY, public_key: 'NFL-TD:t1', source_record_id: 't1', pick_type: 'TD_TARGET', selection: 'Isiah Pacheco', result: 'PENDING', snapshot: { selection_type: 'td_target', target_id: 't1', official: true } };
  const PICKS = 'https://sb.test/rest/v1/nfl_prop_picks';
  const cases = [
    [{ status: 'graded', grade: { result: 'win', final_value: 1, graded_at: `${DAY}T23:59:00Z` } }, 'WIN', false],
    [{ status: 'graded', grade: { result: 'loss', final_value: 0, graded_at: `${DAY}T23:59:00Z` } }, 'LOSS', false],
    [{ status: 'graded', grade: [{ result: 'void', final_value: null, graded_at: `${DAY}T23:59:00Z`, settlement_note: { participation: 'box_score_reported_did_not_play' } }] }, 'VOID', false],
    [{ status: 'open', grade: null }, 'PENDING', false],
    [{ status: 'superseded', grade: null }, 'VOID', true],
  ];
  for (const [pick, want, withdrawn] of cases) {
    const db = installFetch({ rows: [{ ...row }], upstream: { [PICKS]: [{ id: 't1', publication_scope: 'official', ...pick }] } });
    await T.resolvePending();
    assert.equal(db.table[0].result, want, JSON.stringify(pick));
    assert.equal(db.table[0].evidence.withdrawn === true, withdrawn);
    assert.equal(db.table[0].evidence.provider, 'nfl_prop_pick_grades');
    const writes = db.calls.filter((c) => c.method !== 'GET' && !c.url.includes('pbe_free_pick_tracker'));
    assert.deepEqual(writes, [], 'the tracker never writes to TD grade/pick tables');
  }
});


test('tracking free TD grades land in the Free TD Target record (by_scope.tracking), never as official; legacy NFL validation rows stay excluded', async () => {
  const trackingWin = { id: 'tw', sport: 'NFL', cadence: 'daily', period_start: DAY, public_key: 'NFL-TD:tw', source_record_id: 'tw', pick_type: 'TD_TARGET', selection: 'Tracked Guy', result: 'WIN', event_start_at: `${DAY}T20:25:00Z`, snapshot: { selection_type: 'td_target', free: true, official: false, publication_scope: 'tracking', target_id: 'tw', game_id: 'g1', player_id: 'p1' } };
  const officialLoss = { ...trackingWin, id: 'ol', public_key: 'NFL-TD:ol', source_record_id: 'ol', selection: 'Official Guy', result: 'LOSS', snapshot: { ...trackingWin.snapshot, official: true, publication_scope: 'official', target_id: 'ol', player_id: 'p2' } };
  const legacyValidation = { id: 'lv', sport: 'NFL', cadence: 'weekly', period_start: '2026-09-20', public_key: 'NFL:lv', pick_type: 'spread', selection: 'DAL -4', result: 'WIN', event_start_at: '2026-09-21T17:00:00Z', snapshot: { publication_scope: 'tracking', scope_label: 'PBE VALIDATION SIGNAL', market: 'spread' } };
  installFetch({ rows: [trackingWin, officialLoss, legacyValidation] });
  const p = await T.responsePayload({});
  const td = p.records.free_td_target_record;
  assert.deepEqual([td.lifetime.wins, td.lifetime.losses], [1, 1]);
  assert.deepEqual([td.by_scope.tracking.wins, td.by_scope.tracking.losses], [1, 0]);
  assert.deepEqual([td.by_scope.official.wins, td.by_scope.official.losses], [0, 1], 'official scope only counts official rows');
  assert.equal(p.entries.find((e) => e.id === 'tw').official, false);
  assert.equal(p.entries.find((e) => e.id === 'ol').official, true);
  assert.equal(p.entries.find((e) => e.id === 'lv').record_class, 'legacy_validation_signal', 'legacy validation signals unchanged');
  assert.equal(p.records.legacy.nfl_team_picks.lifetime.wins, 0);
  assert.equal(p.products.NFL.after.product_version, 'nfl-free-td-targets/1.1.0');
});

test('owner rule: a tracking free TD result moves the OVERALL free-picks record and the tracking TD record, never official scope', async () => {
  const snap = { selection_type: 'td_target', free: true, official: false, publication_scope: 'tracking', target_id: 'adams', game_id: 'g-den', player_id: '00-0031381' };
  const adams = (result) => ({ id: 'adams', sport: 'NFL', cadence: 'daily', period_start: '2026-09-27', public_key: 'NFL-TD:adams', source_record_id: 'adams', pick_type: 'TD_TARGET', selection: 'Davante Adams', result, event_start_at: '2026-09-28T00:20:00Z', snapshot: { ...snap } });
  const out = {};
  for (const r of ['PENDING', 'WIN', 'LOSS']) {
    const db = installFetch({ rows: [LEGACY_MLB, adams(r)] });
    out[r] = await T.responsePayload({});
    assert.ok(!db.calls.some((c) => c.method !== 'GET'), 'reading the record never writes anything');
  }
  // visible free pick, counts toward the overall record
  const e = out.WIN.entries.find((x) => x.id === 'adams');
  assert.equal(e.record_class, 'free_pick');
  assert.equal(e.counts_toward_record, true);
  assert.equal(e.official, false);
  assert.equal(e.snapshot.publication_scope, 'tracking');
  assert.equal(out.WIN.record.wins, out.PENDING.record.wins + 1, 'overall free-picks record: +1 win');
  assert.equal(out.LOSS.record.losses, out.PENDING.record.losses + 1, 'overall free-picks record: +1 loss');
  assert.equal(out.WIN.by_sport.NFL.wins, 1);
  // tracking TD record moves; official scope never does
  assert.equal(out.WIN.records.free_td_target_record.by_scope.tracking.wins, 1);
  assert.equal(out.LOSS.records.free_td_target_record.by_scope.tracking.losses, 1);
  for (const r of ['PENDING', 'WIN', 'LOSS']) {
    assert.deepEqual(out[r].records.free_td_target_record.by_scope.official, { wins: 0, losses: 0, pushes: 0, voids: 0, pending: 0, hit_rate: null });
  }
  // other namespaces untouched
  assert.deepEqual(out.WIN.records.legacy.mlb_algo_free_picks, out.PENDING.records.legacy.mlb_algo_free_picks);
  assert.deepEqual(out.WIN.records.free_featured_player_record, out.PENDING.records.free_featured_player_record);
});


/* ---- Owner 2026-09-27: MLB Featured Player counts toward the OVERALL free record (never any Algo record) ---- */
const featuredRow = (result, id = 'fx') => ({ id, sport: 'MLB', cadence: 'daily', period_start: DAY, public_key: `MLB-FEATURED:${DAY}:${id}`, source_record_id: `MLB-FEATURED:${DAY}:${id}`, pick_type: 'FEATURED_HR', selection: 'Aaron Judge', result, snapshot: { selection_type: 'featured_player', selection_source: 'free_editorial_selector', official_algo: false, record_namespace: 'free_featured_player_record', mlb_player_id: 592450, game_date: DAY, game_pk: 777001 }, published_at: `${DAY}T12:00:00Z` });
const ALGO_HOSTS = /mlb-v2-api|mlb\.propbetedge\.ai\/api|rest\/v1\/(picks|mlb_v2)|rlfyavnhbngwbldebrid/;

for (const [n, result, field] of [[1, 'WIN', 'wins'], [2, 'LOSS', 'losses']]) {
  test(`${n}. Featured Player ${result} increments BOTH the Featured Player record and the overall Free Picks record`, async () => {
    installFetch({ rows: [LEGACY_MLB, LEGACY_NFL, featuredRow('PENDING')] });
    const before = await T.responsePayload({});
    installFetch({ rows: [LEGACY_MLB, LEGACY_NFL, featuredRow(result)] });
    const after = await T.responsePayload({});
    assert.equal(after.records.free_featured_player_record.lifetime[field], before.records.free_featured_player_record.lifetime[field] + 1);
    assert.equal(after.record[field], before.record[field] + 1);
    assert.equal(after.records.free_picks_record[field], before.records.free_picks_record[field] + 1);
    assert.equal(after.by_sport.MLB[field], before.by_sport.MLB[field] + 1);
    const e = after.entries.find((x) => x.id === 'fx');
    assert.equal(e.record_class, 'free_featured_player');
    assert.equal(e.counts_toward_record, true);
    assert.equal(e.official_algo, false);
    assert.equal(e.selection_type, 'featured_player');
  });
}

test('3. a Featured Player result never touches any Algo / Game Best / .290 record: no Algo source is read or written', async () => {
  for (const result of ['WIN', 'LOSS']) {
    installFetch({ rows: [LEGACY_MLB, featuredRow('PENDING')] });
    const before = await T.responsePayload({});
    const db = installFetch({ rows: [LEGACY_MLB, featuredRow(result)] });
    const after = await T.responsePayload({});
    assert.deepEqual(after.records.legacy.mlb_algo_free_picks, before.records.legacy.mlb_algo_free_picks, 'Algo-sourced free namespace unchanged');
    assert.ok(!db.calls.some((c) => ALGO_HOSTS.test(c.url)), 'the record read never touches the MLB V2 ledger / Algo / Game Best / .290 sources');
    const grading = installFetch({ rows: [{ ...featuredRow('PENDING'), id: 'g' }], upstream: {
      'https://statsapi.mlb.com/api/v1/schedule': { dates: [{ games: [{ gamePk: 777001, status: { detailedState: 'Final', abstractGameState: 'Final' }, teams: { away: { team: {}, score: 1 }, home: { team: {}, score: 2 } } }] }] },
      'https://statsapi.mlb.com/api/v1/game/777001/boxscore': { teams: { home: { players: { ID592450: { stats: { batting: { plateAppearances: 4, homeRuns: result === 'WIN' ? 1 : 0 } } } } }, away: { players: {} } } },
    } });
    await T.resolvePending();
    assert.equal(grading.table[0].result, result);
    assert.ok(!grading.calls.some((c) => ALGO_HOSTS.test(c.url)), 'featured grading reads only MLB Stats API + the free ledger');
    assert.ok(grading.calls.filter((c) => c.method !== 'GET').every((c) => c.url.includes('pbe_free_pick_tracker')), 'the only write is the free ledger row itself');
  }
});

test('4. NFL tracking and official free TD behaviour is unchanged by the MLB rule', async () => {
  const snap = { selection_type: 'td_target', free: true, official: false, publication_scope: 'tracking', target_id: 'a', game_id: 'g', player_id: 'p' };
  const trk = { id: 'trk', sport: 'NFL', period_start: DAY, public_key: 'NFL-TD:a', source_record_id: 'a', pick_type: 'TD_TARGET', selection: 'T', result: 'WIN', event_start_at: `${DAY}T20:00:00Z`, snapshot: snap };
  const off = { ...trk, id: 'off', public_key: 'NFL-TD:b', source_record_id: 'b', selection: 'O', result: 'LOSS', snapshot: { ...snap, official: true, publication_scope: 'official', target_id: 'b', player_id: 'q' } };
  installFetch({ rows: [trk, off, featuredRow('WIN')] });
  const p = await T.responsePayload({});
  assert.deepEqual([p.by_sport.NFL.wins, p.by_sport.NFL.losses], [1, 1]);
  assert.deepEqual([p.records.free_td_target_record.by_scope.tracking.wins, p.records.free_td_target_record.by_scope.official.losses], [1, 1]);
  assert.equal(p.entries.find((e) => e.id === 'trk').official, false);
  assert.equal(p.entries.find((e) => e.id === 'off').official, true);
  assert.equal(p.records.free_td_target_record.lifetime.wins, 1, 'the featured MLB row never enters the TD record');
});

test('5. historical MLB Algo free picks keep their original source/type alongside Featured Player rows', async () => {
  installFetch({ rows: [LEGACY_MLB, featuredRow('WIN')] });
  const p = await T.responsePayload({});
  const legacy = p.entries.find((e) => e.id === 'legacy-mlb');
  const feat = p.entries.find((e) => e.id === 'fx');
  assert.deepEqual([legacy.selection_type, legacy.selection_source, legacy.official_algo, legacy.product_version, legacy.record_class], ['algo', 'official_algo_free_sample', true, 'mlb-free-algo/legacy', 'free_pick']);
  assert.deepEqual([feat.selection_type, feat.selection_source, feat.official_algo, feat.record_class], ['featured_player', 'free_editorial_selector', false, 'free_featured_player']);
  assert.equal(p.records.legacy.mlb_algo_free_picks.lifetime.wins, 1);
  assert.equal(p.records.free_featured_player_record.lifetime.wins, 1);
  assert.equal(p.by_sport.MLB.wins, 2, 'both genuinely published products are in the MLB free total, still distinguishable');
});

test('6. reading the records creates no writes', async () => {
  const db = installFetch({ rows: [LEGACY_MLB, LEGACY_NFL, featuredRow('WIN'), featuredRow('LOSS', 'fy')] });
  const snapshot = JSON.stringify(db.table);
  await T.responsePayload({});
  assert.ok(db.calls.every((c) => c.method === 'GET'));
  assert.equal(JSON.stringify(db.table), snapshot);
});
