import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  buildFreeBoard, checkFreePickInvariant, entryState, latestResults,
  recordSummary, trackerEntryMatchesCard, countsTowardRecord,
} from '../src/lib/free-board.js';

// 2026-09-26 19:45 ET — the production state this contract was written against.
const NOW = new Date('2026-09-26T23:45:00Z');

function entry(over) {
  return {
    sport: 'NHL', period_start: '2026-09-26', slot: 1, result: 'PENDING', result_at: null,
    published_at: '2026-09-26T17:15:39Z', evidence: {}, snapshot: {}, ...over,
    public_key: over.public_key || `${over.sport || 'NHL'}:${over.selection}:${over.period_start || '2026-09-26'}`,
  };
}

function trackerOf(entries) {
  const by = {};
  for (const sport of ['MLB', 'NFL', 'UFC', 'WNBA', 'NHL', 'NBA']) {
    const rows = entries.filter((e) => e.sport === sport && e.evidence?.suppressed !== true && countsTowardRecord(e));
    by[sport] = {
      wins: rows.filter((e) => e.result === 'WIN').length,
      losses: rows.filter((e) => e.result === 'LOSS').length,
      pushes: rows.filter((e) => e.result === 'PUSH').length,
      pending: rows.filter((e) => e.result === 'PENDING').length,
    };
  }
  const all = entries.filter((e) => e.evidence?.suppressed !== true && countsTowardRecord(e));
  return {
    ok: true,
    generated_at: NOW.toISOString(),
    record: {
      wins: all.filter((e) => e.result === 'WIN').length,
      losses: all.filter((e) => e.result === 'LOSS').length,
      pushes: 0,
      pending: all.filter((e) => e.result === 'PENDING').length,
    },
    by_sport: by,
    entries,
  };
}

const NHL_CAR = entry({ sport: 'NHL', selection: 'CAR', matchup: 'CAR @ NSH', event_start_at: '2026-09-26T19:00:00Z', result: 'WIN', result_at: '2026-09-26T21:29:58Z', score: 'CAR 6 · NSH 0', snapshot: { game_id: 2026010053, pick_team: 'CAR', preseason: true } });
const NHL_BUF = entry({ sport: 'NHL', slot: 2, selection: 'BUF', matchup: 'PIT @ BUF', event_start_at: '2026-09-26T19:00:00Z', result: 'LOSS', result_at: '2026-09-26T21:40:58Z', score: 'PIT 3 · BUF 1', snapshot: { game_id: 2026010055, pick_team: 'BUF', preseason: true } });
const WNBA_MIN = entry({ sport: 'WNBA', period_start: '2026-09-27', selection: 'Minnesota Lynx', opponent: 'New York Liberty', event_start_at: '2026-09-27T18:00:00Z', snapshot: { phase: 'PRE_LOCK', game_id: '401918014', model_probability: 0.64, edge_pts: -6.8 } });
const UFC_PEREZ = entry({ sport: 'UFC', period_start: '2026-09-20', selection: 'Ailin Perez', opponent: 'Norma Dumont', snapshot: { slot: 'BEST_BET', event_date: '2026-09-26', lifecycle: 'PROVISIONAL' } });
const NFL_VALIDATION = entry({ sport: 'NFL', period_start: '2026-09-27', selection: 'BUF -7', event_start_at: '2026-09-27T17:00:00Z', snapshot: { publication_scope: 'tracking', scope_label: 'PBE VALIDATION SIGNAL', market: 'spread' } });
const MLB_STALE = entry({ sport: 'MLB', period_start: '2026-09-22', selection: 'Pete Alonso', snapshot: { game_date: '2026-09-22', phase: 'early_bird' } });

test('settled picks leave the current board and the live count', () => {
  const board = buildFreeBoard(trackerOf([NHL_CAR, NHL_BUF, WNBA_MIN, UFC_PEREZ]), NOW);
  assert.deepEqual(board.current.map((r) => r.entry.selection).sort(), ['Ailin Perez', 'Minnesota Lynx']);
  assert.equal(board.counts.settledToday, 2);
  assert.equal(board.bySport.nhl.current.length, 0);
  assert.equal(board.bySport.nhl.settledToday.length, 2);
});

test('visible NHL results equal NHL tracker results', () => {
  const tracker = trackerOf([NHL_CAR, NHL_BUF]);
  const board = buildFreeBoard(tracker, NOW);
  const visible = board.bySport.nhl.settledToday;
  const wins = visible.filter((e) => e.result === 'WIN').length;
  const losses = visible.filter((e) => e.result === 'LOSS').length;
  assert.deepEqual([wins, losses], [tracker.by_sport.NHL.wins, tracker.by_sport.NHL.losses]);
});

test('validation signals never render as a current free pick', () => {
  const board = buildFreeBoard(trackerOf([NFL_VALIDATION]), NOW);
  assert.equal(board.current.length, 0);
  assert.equal(board.excluded[0].reason, 'non_pick_output');
});

test('state machine: PRE-LOCK, LOCKED, IN PLAY, AWAITING', () => {
  assert.equal(entryState(WNBA_MIN, NOW), 'PRE-LOCK');
  assert.equal(entryState(UFC_PEREZ, NOW, { lifecycle: 'LOCKED' }), 'LOCKED');
  const started = entry({ sport: 'NHL', selection: 'COL', event_start_at: '2026-09-26T22:00:00Z', snapshot: { pick_team: 'COL' } });
  assert.equal(entryState(started, NOW), 'IN PLAY');
  assert.equal(entryState(MLB_STALE, NOW), 'AWAITING');
  assert.equal(entryState(NHL_CAR, NOW), 'SETTLED');
});

test('stale pending picks are not current but still pending in the record', () => {
  const tracker = trackerOf([MLB_STALE]);
  const board = buildFreeBoard(tracker, NOW);
  assert.equal(board.current.length, 0);
  assert.equal(board.awaiting.length, 1);
  assert.equal(recordSummary(tracker).pending, 1);
});

test('latest results: global order by result_at, max 2 per sport, max 6', () => {
  const mlb = [1, 2, 3, 4].map((i) => entry({ sport: 'MLB', selection: `MLB ${i}`, result: 'WIN', result_at: `2026-09-26T23:4${i}:00Z` }));
  const rows = [...mlb, NHL_CAR, NHL_BUF,
    entry({ sport: 'WNBA', selection: 'W1', result: 'LOSS', result_at: '2026-09-25T02:00:00Z' }),
    entry({ sport: 'UFC', selection: 'U1', result: 'WIN', result_at: '2026-09-20T02:00:00Z' }),
    entry({ sport: 'NFL', selection: 'N1', result: 'WIN', result_at: '2026-09-21T02:00:00Z' })];
  const out = latestResults(trackerOf(rows));
  assert.equal(out.length, 6);
  assert.ok(out.filter((e) => e.sport === 'MLB').length <= 2);
  assert.deepEqual(out.slice(0, 2).map((e) => e.selection), ['MLB 4', 'MLB 3']);
  assert.ok(new Set(out.map((e) => e.sport)).size >= 4);
});

test('invariant: every displayed card maps to exactly one ledger entry', () => {
  const tracker = trackerOf([WNBA_MIN, UFC_PEREZ]);
  const board = buildFreeBoard(tracker, NOW);
  const displayed = board.current.map(({ entry: e }) => ({ public_key: e.public_key, sport: e.sport, label: e.selection }));
  assert.equal(checkFreePickInvariant({ displayed, tracker, board }).pass, true);

  const phantom = [...displayed, { public_key: 'NHL:not-in-ledger', sport: 'NHL', label: 'CAR' }];
  const res = checkFreePickInvariant({ displayed: phantom, tracker, board });
  assert.equal(res.pass, false);
  assert.match(res.failures.join('\n'), /0 ledger entries/);
});

test('invariant: a stale by_sport aggregate fails', () => {
  const tracker = trackerOf([NHL_CAR, NHL_BUF]);
  tracker.by_sport.NHL = { wins: 2, losses: 0, pushes: 0, pending: 0 };
  const res = checkFreePickInvariant({ displayed: [], tracker, board: buildFreeBoard(tracker, NOW) });
  assert.equal(res.pass, false);
  assert.match(res.failures.join('\n'), /nhl aggregate 2-0/);
});

test('invariant: feed picks missing from the ledger are reported, non-picks are blocked', () => {
  const tracker = trackerOf([]);
  const res = checkFreePickInvariant({
    displayed: [], tracker, board: buildFreeBoard(tracker, NOW),
    feedItems: [
      { sport: 'nhl', label: 'CAR', recorded: false, nonPick: false },
      { sport: 'nfl', label: 'BUF -7', recorded: false, nonPick: true },
    ],
  });
  assert.deepEqual(res.unrecorded.map((x) => x.label), ['CAR']);
  assert.deepEqual(res.blockedNonPicks.map((x) => x.label), ['BUF -7']);
});

test('feed/ledger matching is gated by game id', () => {
  assert.equal(trackerEntryMatchesCard(NHL_CAR, { sport: 'nhl', gameId: 2026010053, title: 'CAR' }), true);
  assert.equal(trackerEntryMatchesCard(NHL_CAR, { sport: 'nhl', gameId: 2026019999, title: 'CAR' }), false);
});

test('page hierarchy and neutral language', () => {
  const src = readFileSync(new URL('../src/pages/odds.js', import.meta.url), 'utf8');
  const board = src.slice(src.indexOf('function renderBoard()'));
  const order = ['fp-current', 'renderRecord(tracker)', 'renderLatestResults(tracker)'].map((s) => board.indexOf(s));
  assert.ok(order.every((i) => i > 0) && order[0] < order[1] && order[1] < order[2], 'current picks render before the record');
  assert.doesNotMatch(src, /CALLED IT|FREE PICK RESULT|VALIDATION SIGNAL'/);
  assert.doesNotMatch(src, /renderComingSport|free-board-truth/);
});

test('tracker captures NHL with a first-party origin and blocks non-pick output', () => {
  const src = readFileSync(new URL('../supabase/functions/free-picks-tracker/index.ts', import.meta.url), 'utf8');
  assert.match(src, /nhl\/picks\/free-sample", FIRST_PARTY\)/);
  assert.match(src, /preseason\?date=\$\{today\}`, FIRST_PARTY\)/);
  assert.match(src, /isNonPickOutput\(item\.snapshot\)/);
});

test('a rechecked old pick with a fresh result_at is not "settled today"', () => {
  const old = entry({ sport: 'MLB', period_start: '2026-09-22', selection: 'Yordan Alvarez', result: 'WIN', result_at: '2026-09-26T23:45:01Z', snapshot: { game_date: '2026-09-22' } });
  const board = buildFreeBoard(trackerOf([old, NHL_CAR]), NOW);
  assert.equal(board.counts.settledToday, 1);
  assert.deepEqual(latestResults(trackerOf([old, NHL_CAR])).map((e) => e.selection), ['CAR', 'Yordan Alvarez']);
});

// The two historical NFL validation rows, exactly as they sit in the ledger.
const NFL_DAL = entry({ sport: 'NFL', period_start: '2026-09-20', selection: 'DAL -4', matchup: 'WSH @ DAL', result: 'WIN', result_at: '2026-09-20T23:46:08Z', snapshot: { publication_scope: 'tracking', scope_label: 'PBE VALIDATION SIGNAL', market: 'spread' } });
const NFL_ARI = entry({ sport: 'NFL', period_start: '2026-09-20', slot: 2, selection: 'ARI ML', matchup: 'SEA @ ARI', result: 'LOSS', result_at: '2026-09-20T23:31:23Z', snapshot: { publication_scope: 'tracking', scope_label: 'PBE VALIDATION SIGNAL', market: 'moneyline' } });

test('validation rows stay in entries but never touch the Free Picks record', () => {
  const tracker = trackerOf([NFL_DAL, NFL_ARI, NHL_CAR, NHL_BUF]);
  assert.equal(tracker.entries.length, 4, 'history keeps the validation rows');
  assert.deepEqual([tracker.record.wins, tracker.record.losses], [1, 1]);
  assert.deepEqual([tracker.by_sport.NFL.wins, tracker.by_sport.NFL.losses], [0, 0]);
  const res = checkFreePickInvariant({ displayed: [], tracker, board: buildFreeBoard(tracker, NOW) });
  assert.equal(res.pass, true, res.failures.join('; '));
});

test('an aggregate that still counts validation rows fails the invariant', () => {
  const tracker = trackerOf([NFL_DAL, NFL_ARI]);
  tracker.by_sport.NFL = { wins: 1, losses: 1, pushes: 0, pending: 0 };
  tracker.record = { wins: 1, losses: 1, pushes: 0, pending: 0 };
  const res = checkFreePickInvariant({ displayed: [], tracker, board: buildFreeBoard(tracker, NOW) });
  assert.equal(res.pass, false);
  assert.match(res.failures.join('\n'), /nfl aggregate 1-1/);
  assert.match(res.failures.join('\n'), /global record 1-1/);
});

test('validation rows never render as current picks or latest results', () => {
  const tracker = trackerOf([NFL_DAL, NFL_ARI, NFL_VALIDATION, NHL_CAR]);
  const board = buildFreeBoard(tracker, NOW);
  assert.ok(board.current.every(({ entry: e }) => e.sport !== 'NFL'));
  assert.ok(board.settledToday.every((e) => e.sport !== 'NFL'));
  assert.deepEqual(latestResults(tracker).map((e) => e.selection), ['CAR']);
});

test('server record_class is honoured, withdrawn picks still count as free picks', () => {
  assert.equal(countsTowardRecord({ record_class: 'legacy_validation_signal', counts_toward_record: false, snapshot: {} }), false);
  assert.equal(countsTowardRecord({ record_class: 'withdrawn', counts_toward_record: false, result: 'VOID', snapshot: {} }), true);
  assert.equal(countsTowardRecord({ record_class: 'free_pick', counts_toward_record: true, snapshot: {} }), true);
});

test('tracker derives the record from publicPickEntries and freezes UFC before capture', () => {
  const src = readFileSync(new URL('../supabase/functions/free-picks-tracker/index.ts', import.meta.url), 'utf8');
  assert.match(src, /const publicPickEntries = entries\.filter\(\(e:any\) => !isNonPickOutput\(e\.snapshot \|\| e\)\);/);
  assert.match(src, /const counted = publicPickEntries\.filter/);
  assert.match(src, /const sportEntries = publicPickEntries\.filter/);
  assert.match(src, /frozen:String\(p\.lifecycle \|\| ""\)\.toUpperCase\(\) === "LOCKED"/);
  assert.match(src, /withdrawn_reason:reason/);
  assert.doesNotMatch(src, /\.delete\(|method:"DELETE"/, 'the tracker never deletes receipts');
});
