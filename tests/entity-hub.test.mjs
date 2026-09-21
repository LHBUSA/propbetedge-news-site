/**
 * tests/entity-hub.test.mjs
 *
 * Entity hub regression tests.
 *
 * The Sidney Crosby and Pittsburgh canaries are here by request: they were the
 * proof that the NHL path worked, so they are now the thing that fails loudly
 * if it stops working.
 *
 * Network-backed on purpose — these assert against the live league products,
 * because a contract that only holds against a fixture is not a contract.
 *
 * Run: node --test --test-concurrency=1 tests/entity-hub.test.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  validatePlayerSnapshot, validateTeamSnapshot, completeness, freshnessOf,
  FRESHNESS, CONTRACT_VERSION,
} from '../src/entity-hub/contract.js';
import { refreshPlayer, refreshTeam, teamRefreshTargets, currentSeason, MLB_TEAM_IDS } from '../src/entity-hub/refresh.js';
import { allTeams, allPlayers } from '../src/entity-graph/entities.js';
import * as nfl from '../src/entity-hub/adapters/nfl.js';
import * as mlbAdapter from '../src/entity-hub/adapters/mlb.js';

// ─── the canaries ────────────────────────────────────────────────────────────

test('canary: Sidney Crosby resolves to a complete NHL player snapshot', async () => {
  const { snapshot } = await refreshPlayer('nhl', '8471675');
  assert.ok(snapshot, 'no snapshot returned');
  assert.deepEqual(validatePlayerSnapshot(snapshot).problems, []);

  assert.equal(snapshot.player_id, '8471675');
  assert.equal(snapshot.name, 'Sidney Crosby');
  assert.equal(snapshot.sport, 'nhl');
  assert.equal(snapshot.canonical_url, 'https://propbetedge.ai/player/nhl/8471675');

  // Identity must join the entity graph, not a slug invented from a feed.
  assert.equal(snapshot.team.slug, 'pittsburgh-penguins');
  assert.equal(snapshot.team.path, '/team/nhl/pittsburgh-penguins');

  assert.equal(completeness(snapshot), 'full');
  assert.ok(snapshot.photo?.startsWith('https://'), 'missing headshot');
  assert.ok(snapshot.stats.season?.stats?.gamesPlayed > 0, 'missing a season line');
  assert.ok(snapshot.stats.career?.stats?.points > 0, 'missing career totals');
  assert.ok(snapshot.bio.birth_date, 'missing birth date');

  // Provenance is not optional.
  assert.equal(snapshot.source.product, 'nhl.propbetedge.ai');
  assert.ok(snapshot.source.source_urls.some((u) => u.includes('api-web.nhle.com')));
  assert.ok(snapshot.source.observed_at);
  assert.equal(freshnessOf(snapshot.source), FRESHNESS.CURRENT);
});

test('canary: Pittsburgh resolves to a complete NHL team snapshot', async () => {
  const target = teamRefreshTargets('nhl').find((t) => t.slug === 'pittsburgh-penguins');
  assert.ok(target, 'Pittsburgh missing from the dictionary');

  const { snapshot } = await refreshTeam('nhl', target);
  assert.ok(snapshot, 'no snapshot returned');
  assert.deepEqual(validateTeamSnapshot(snapshot).problems, []);

  assert.equal(snapshot.slug, 'pittsburgh-penguins');
  assert.equal(snapshot.abbreviation, 'PIT');
  assert.equal(snapshot.canonical_url, 'https://propbetedge.ai/team/nhl/pittsburgh-penguins');
  assert.equal(completeness(snapshot), 'full');

  assert.ok(snapshot.roster.length > 15, `thin roster: ${snapshot.roster.length}`);
  for (const entry of snapshot.roster) {
    assert.match(entry.path, /^\/player\/nhl\/\d+$/, `bad roster path ${entry.path}`);
  }

  assert.ok(Number.isFinite(snapshot.record.wins), 'missing wins');
  assert.equal(snapshot.standings.conference, 'Eastern');
  assert.equal(snapshot.standings.division, 'Metropolitan');
  // Standings carry the provider's own date rather than implying "right now".
  assert.ok(snapshot.standings.as_of, 'standings must say when they were true');
});

// ─── cross-sport contract ────────────────────────────────────────────────────

for (const [sport, playerId] of [['mlb', '670770'], ['nba', '4432737'], ['nfl', '3916387']]) {
  test(`${sport}: player snapshot satisfies the contract`, async () => {
    const { snapshot, reason } = await refreshPlayer(sport, playerId);
    assert.ok(snapshot, `no snapshot: ${reason}`);
    assert.deepEqual(validatePlayerSnapshot(snapshot).problems, []);
    assert.equal(snapshot.contract, CONTRACT_VERSION);
    assert.equal(snapshot.sport, sport);
    assert.equal(snapshot.player_id, playerId);
    assert.equal(snapshot.canonical_url, `https://propbetedge.ai/player/${sport}/${playerId}`);
    assert.ok(snapshot.source.product, 'missing provenance product');
    assert.ok(snapshot.source.observed_at, 'missing observed_at');
    if (snapshot.team) assert.match(snapshot.team.path, new RegExp(`^/team/${sport}/[a-z0-9-]+$`));
  });
}

test('mlb: a pitcher gets pitching stats and a hitter gets hitting stats', async () => {
  const hitter = await refreshPlayer('mlb', '670770');   // TJ Friedl, CF
  const pitcher = await refreshPlayer('mlb', '669373');  // Tarik Skubal, P
  assert.match(hitter.snapshot.stats.season.label, /^Hitting/);
  assert.match(pitcher.snapshot.stats.season.label, /^Pitching/);
  // The two shapes must never be merged into one fake stat line.
  assert.ok('atBats' in hitter.snapshot.stats.season.stats);
  assert.ok('gamesStarted' in pitcher.snapshot.stats.season.stats);
});

test('nfl: the current season is the newest one, not the first in the array', async () => {
  // seasons[] is newest-first and coverage.current_season is an object; reading
  // either naively produced a 2018 rookie line as "this season".
  const { snapshot } = await refreshPlayer('nfl', '3916387');
  assert.equal(snapshot.stats.season.season, String(currentSeason('nfl')));
  const firstGame = snapshot.stats.games[0];
  const lastGame = snapshot.stats.games[snapshot.stats.games.length - 1];
  assert.ok(
    new Date(firstGame.date) >= new Date(lastGame.date),
    'recent games must be newest-first',
  );
});

test('nfl: career history carries its own honesty label', async () => {
  const { snapshot } = await refreshPlayer('nfl', '3916387');
  assert.ok(['TRACKED HISTORY', 'CAREER', 'Career'].some((l) => snapshot.stats.career.label.includes(l)));
  assert.ok(snapshot.special_metrics.history_state, 'history_state must be carried through');
});

test('nba: an empty preseason game log yields a partial profile, not fake zeroes', async () => {
  const { snapshot } = await refreshPlayer('nba', '4432737');
  assert.ok(snapshot);
  if (!snapshot.stats.games.length) {
    assert.equal(snapshot.stats.season, null, 'no games means no invented season line');
    assert.equal(completeness(snapshot), 'partial');
  }
});

// ─── teams across sports ─────────────────────────────────────────────────────

for (const sport of ['nhl', 'mlb', 'nba']) {
  test(`${sport}: first dictionary team builds a valid snapshot with a linked roster`, async () => {
    const target = teamRefreshTargets(sport)[0];
    const { snapshot, reason } = await refreshTeam(sport, target);
    assert.ok(snapshot, `no snapshot: ${reason}`);
    assert.deepEqual(validateTeamSnapshot(snapshot).problems, []);
    assert.equal(snapshot.slug, target.slug);
    assert.ok(snapshot.roster.length > 0, 'expected a roster');
    for (const entry of snapshot.roster.slice(0, 5)) {
      assert.match(entry.path, new RegExp(`^/player/${sport}/\\d+$`));
    }
  });
}

test('nfl teams degrade to identity without the PropSports key, and never throw', async () => {
  const target = teamRefreshTargets('nfl')[0];
  const { snapshot, route } = await refreshTeam('nfl', target, { env: {} });
  assert.ok(snapshot, 'a missing key must not produce a missing snapshot');
  assert.deepEqual(validateTeamSnapshot(snapshot).problems, []);
  assert.equal(completeness(snapshot), 'identity_only');
  assert.match(route, /no_key/);
  assert.equal(snapshot.roster.length, 0);
});

test('the PropSports key is never defaulted or embedded', () => {
  assert.deepEqual(nfl.propsportsHeaders(undefined), { Accept: 'application/json' });
  assert.deepEqual(nfl.propsportsHeaders('abc'), { Accept: 'application/json', 'X-API-Key': 'abc' });
});

// ─── identity spine ──────────────────────────────────────────────────────────

test('every MLB dictionary team maps to a StatsAPI team id', () => {
  const missing = allTeams('mlb').filter((t) => !MLB_TEAM_IDS[t.abbr]).map((t) => t.abbr);
  assert.deepEqual(missing, [], `unmapped MLB teams: ${missing.join(',')}`);
});

test('refresh targets come from the dictionary, not from a feed', () => {
  for (const sport of ['mlb', 'nfl', 'nba', 'nhl']) {
    const targets = teamRefreshTargets(sport);
    assert.equal(targets.length, allTeams(sport).length);
    for (const target of targets) {
      assert.ok(target.slug && target.abbr, `incomplete target in ${sport}`);
    }
    assert.ok(allPlayers(sport).length > 0);
  }
});

test('MLB standings are requested with the hydrate that names the division', () => {
  // Without it, division and league come back as bare {id, link} and 'NL
  // Central' silently becomes null.
  assert.match(mlbAdapter.standingsUrl(2026), /hydrate=division,league/);
});
