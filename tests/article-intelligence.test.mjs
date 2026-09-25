import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildEntityManifest } from '../src/entity-graph/index.js';
import {
  ARTICLE_DATA_ADAPTERS,
  buildArticleIntelligence,
  loadLiveContext,
  renderArticleVisuals,
  renderPlayerContext,
} from '../src/article-visuals.js';
import { extractPublishedEvidence } from '../src/article-intelligence/evidence.js';
import { teamDataFromPayload } from '../src/article-intelligence/team-data.js';
import { adapterFor, mlbIsPitcher, mlbRecentMetric, nflRecentMetric, nhlRecentMetric, winbaMetric } from '../src/article-intelligence/adapters.js';
import { auditIntelligenceHtml, hasQuantitativeBlock } from '../src/article-intelligence/guard.js';
import { resource as pbeIntelResource, pickWinba } from '../api/pbe-intel.js';

const fixture = (name) => JSON.parse(fs.readFileSync(new URL(`./fixtures/article-intelligence/${name}`, import.meta.url), 'utf8'));
const DATA = /Here’s the data\./;
const NOW = Date.parse('2026-09-25T19:00:00Z');

/** The hard product rule, applied to every rendered state in this file. */
function assertTruthful(html, opts = {}) {
  const violations = auditIntelligenceHtml(html, opts);
  assert.deepEqual(violations, [], `integrity violations: ${violations.join(', ')}`);
  if (DATA.test(html)) assert.ok(hasQuantitativeBlock(html), '"Here’s the data." requires a quantitative block');
}

/* ------------------------------------------------------------------ */
/* Patriots regression — the exact production article                  */
/* ------------------------------------------------------------------ */

const patriots = fixture('patriots-right-guard.json');
const patriotsManifest = buildEntityManifest(patriots);
const nflTeam = fixture('team-nfl.json');

test('Patriots: offensive linemen never get a player chart', () => {
  const intel = buildArticleIntelligence(patriots, patriotsManifest);
  assert.equal(intel.expect.player, null, 'no OL/C/G is selected for a skill-position chart');
  const html = renderArticleVisuals(patriots, patriotsManifest);
  assert.match(html, /data-player-id=""/);
  assert.doesNotMatch(html, /data-pbe-player-chart/);
  assertTruthful(html, { manifest: patriotsManifest });
});

test('Patriots: the authoritative OUT relation resolves Michael → Mike Onwenu into ROLE / ROSTER IMPACT', () => {
  const html = renderArticleVisuals(patriots, patriotsManifest);
  assert.match(html, /ROLE \/ ROSTER IMPACT/);
  assert.match(html, /Mike Onwenu/);
  assert.match(html, /OUT \/ IR/);
  assert.match(html, /TEAM CONTEXT/);
  assert.match(html, /New England Patriots/);
});

test('Patriots: markets are labeled story-linked context, never statistics', () => {
  const html = renderArticleVisuals(patriots, patriotsManifest);
  assert.match(html, /MARKETS AFFECTED/);
  assert.match(html, /Tagged by the published story analysis · not a model forecast/);
  const markets = html.match(/data-pbe-markets[\s\S]*?<\/ul>/)[0];
  assert.match(markets, /<li>Rushing Yards<\/li>/);
  assert.match(markets, /<li>Rushing Attempts<\/li>/);
  assert.doesNotMatch(markets, /<strong>|data-pbe-quant/);
  assert.doesNotMatch(html, /MARKET WATCH/);
});

test('Patriots: published career numbers are real evidence with the full sentence', () => {
  const evidence = extractPublishedEvidence(patriots);
  const flat = evidence.flatMap((row) => row.metrics.map((m) => `${m.label}=${m.value}`));
  assert.ok(flat.includes('GAMES=150') && flat.includes('STARTS=105'), flat.join(','));
  assert.ok(flat.includes('STARTS=14'));
  assert.equal(flat.filter((x) => x === 'STARTS=14').length, 1, 'the repeated "14 starts" is one fact, not two');
  assert.ok(!flat.some((x) => /RUSH/.test(x)), 'market names never become observed stats');
  const html = renderArticleVisuals(patriots, patriotsManifest);
  assert.match(html, /PUBLISHED EVIDENCE/);
  assert.match(html, /His 150 combined regular and postseason NFL appearances—105 of them starts—position him/);
  assertTruthful(html, { manifest: patriotsManifest });
});

test('Patriots: with the numbers removed the module is "What changed.", never "Here’s the data."', () => {
  const stripped = {
    ...patriots,
    body_html: '<p>Michael Onwenu will not play football for the New England Patriots until late in 2026 after suffering an ankle injury in Week 2.</p><p>New England will evaluate Greg Van Roten, Ben Brown and Walter Rouse at right guard.</p>',
    body: null,
  };
  const html = renderArticleVisuals(stripped, buildEntityManifest(stripped));
  assert.match(html, /PBE STORY INTELLIGENCE/);
  assert.match(html, /What changed\./);
  assert.doesNotMatch(html, DATA);
  assert.doesNotMatch(html, /data-pbe-quant/);
  assert.match(html, /data-pbe-team-slot/, 'a verified team snapshot may still hydrate');
  assertTruthful(html);
});

test('Patriots: verified team snapshot upgrades the headline and shows real team numbers', () => {
  const stripped = { ...patriots, body_html: '<p>Michael Onwenu will not play for the New England Patriots until late in 2026.</p>', body: null };
  const manifest = buildEntityManifest(stripped);
  const team = teamDataFromPayload(nflTeam, 'nfl', NOW);
  const html = renderArticleVisuals(stripped, manifest, { live: { team, player: null, fetchedAt: '2026-09-25T19:00:00Z' } });
  assert.match(html, /PBE DATA INTELLIGENCE/);
  assert.match(html, DATA);
  assert.match(html, /TEAM SNAPSHOT/);
  assert.match(html, /<span>RECORD<\/span>\s*<strong>1-1<\/strong>/);
  assert.match(html, /<span>DIVISION<\/span>\s*<strong>2nd<\/strong>\s*<small>AFC East<\/small>/);
  assert.match(html, /<span>LAST RESULT<\/span>\s*<strong>W 20-3<\/strong>/);
  assert.match(html, /<span>NEXT GAME<\/span>\s*<strong>@ JAX<\/strong>/);
  assert.match(html, /VERIFIED LIVE CONTEXT/);
  assert.match(html, /LIVE · Sep 25/);
  assertTruthful(html, { hydrated: true, manifest });
});

test('Patriots: failed live hydration leaves a clean contextual module', () => {
  const stripped = { ...patriots, body_html: '<p>Michael Onwenu will not play for the New England Patriots until late in 2026.</p>', body: null };
  const html = renderArticleVisuals(stripped, buildEntityManifest(stripped), { live: { team: null, player: null, fetchedAt: null } });
  assert.match(html, /What changed\./);
  assert.doesNotMatch(html, /VERIFIED LIVE CONTEXT|data-pbe-team-slot|pbe-av-loading|Checking current data/);
  assertTruthful(html, { hydrated: true });
});

/* ------------------------------------------------------------------ */
/* Guard                                                               */
/* ------------------------------------------------------------------ */

test('guard: "Here’s the data." over team/people/market context alone is a violation', () => {
  const fake = `<section data-pbe-article-visuals data-sport="nfl"><h2>Here’s the data.</h2>
    <div class="pbe-av-team-card"><b>New England Patriots</b></div>
    <div class="pbe-av-block pbe-av-focus"><b>Mike Onwenu</b></div>
    <div class="pbe-av-block pbe-av-markets" data-pbe-markets><ul><li>Rushing Yards</li></ul></div></section>`;
  assert.ok(auditIntelligenceHtml(fake).includes('data_headline_without_quantitative_block'));
  assert.ok(auditIntelligenceHtml(fake.replace('</h2>', '</h2><div data-pbe-quant="team"><strong>NaN</strong></div>'))
    .some((v) => v.startsWith('data_headline') || v.startsWith('placeholder_value')));
  assert.ok(auditIntelligenceHtml('<div class="pbe-av-loading"></div>', { hydrated: true }).includes('unresolved_loading_skeleton'));
});

/* ------------------------------------------------------------------ */
/* Sport fixtures                                                      */
/* ------------------------------------------------------------------ */

test('MLB numeric article: hitter line and pitcher line are semantic, role-aware evidence', () => {
  const article = {
    id: 'mlb-numeric', sport: 'mlb', title: 'Judge powers Yankees past Rays',
    body: 'Aaron Judge went 3-for-5 with 2 HR and 4 RBIs. Gerrit Cole struck out eight over six innings with a 96.4 mph fastball. Judge now owns a .912 OPS.',
    take: { impact_score: 4, prop_types: ['hr', 'k_prop'] },
  };
  const manifest = {
    players: [{ id: '592450', name: 'Aaron Judge', position: 'RF', path: '/player/mlb/592450' }],
    teams: [{ id: 'NYY', abbreviation: 'NYY', name: 'New York Yankees', slug: 'new-york-yankees', path: '/team/mlb/new-york-yankees' }],
  };
  const html = renderArticleVisuals(article, manifest);
  assert.match(html, />3-for-5<\/strong>\s*<b>H-AB<\/b>/);
  assert.match(html, />2<\/strong>\s*<b>HR<\/b>/);
  assert.match(html, />8<\/strong>\s*<b>K<\/b>/);
  assert.match(html, />6<\/strong>\s*<b>IP<\/b>/);
  assert.match(html, DATA);
  assertTruthful(html, { manifest });

  assert.equal(mlbIsPitcher(article, 'P'), true);
  assert.equal(mlbIsPitcher(article, 'RF'), false);
  assert.deepEqual(mlbRecentMetric(article, true), ['strikeOuts', 'Strikeouts'], 'pitchers never get an HR chart');
  assert.deepEqual(mlbRecentMetric(article, false), ['homeRuns', 'Home Runs']);
  assert.deepEqual(mlbRecentMetric({ take: { prop_types: ['k_prop'] } }, false), ['hits', 'Hits'], 'a hitter is not charted on strikeouts');
});

test('NFL skill-position article charts the QB and renders a verified current-form card', () => {
  const article = {
    id: 'nfl-qb', sport: 'nfl', title: 'Burrow carves up Baltimore',
    body: 'Joe Burrow completed 24 of 32 passes for 288 yards and 3 touchdowns.',
    take: { impact_score: 4, prop_types: ['passing_yards'] },
  };
  const manifest = {
    players: [{ id: '3915511', name: 'Joe Burrow', position: 'QB', path: '/player/nfl/3915511' }],
    teams: [{ id: 'CIN', abbreviation: 'CIN', name: 'Cincinnati Bengals', path: '/team/nfl/cincinnati-bengals' }],
  };
  const static_ = renderArticleVisuals(article, manifest);
  assert.match(static_, /data-player-id="3915511"/);
  assert.match(static_, />24\/32<\/strong>\s*<b>CMP\/ATT<\/b>/);
  assert.match(static_, />288<\/strong>\s*<b>PASS YDS<\/b>/);
  const player = {
    sport: 'nfl', name: 'Joe Burrow', label: 'Passing Yards', seasonLabel: '2026 season', seasonCurrent: true,
    seasonStats: [['YDS', '512'], ['TD', '4']],
    rows: [{ date: '2026-09-13', opponent: 'vs CLE', value: 224 }, { date: '2026-09-20', opponent: '@ BAL', value: 288 }],
    metricLive: { recentAverage: 256, recentHigh: 288, seasonAverage: 256, seasonGames: 2, baselineAvailable: false, deltaPct: null },
  };
  const html = renderArticleVisuals(article, manifest, { live: { team: null, player, fetchedAt: '2026-09-25T19:00:00Z' } });
  assert.match(html, /VERIFIED CURRENT FORM/);
  assert.match(html, /data-intel-level="3"/);
  assertTruthful(html, { hydrated: true, manifest });
});

test('NFL role awareness: linemen and specialists get no metric; defenders get defensive metrics', () => {
  const article = { take: { prop_types: ['rushing_yards', 'receiving_yards', 'passing_yards'] } };
  for (const pos of ['G', 'C', 'OT', 'OG', 'T', 'OL', 'K', 'P', 'LS']) assert.equal(nflRecentMetric(article, pos), null, pos);
  assert.deepEqual(nflRecentMetric({ take: { prop_types: ['sacks'] } }, 'LB'), ['sacks', 'Sacks']);
  assert.deepEqual(nflRecentMetric({ take: { prop_types: [] } }, 'CB'), ['totalTackles', 'Tackles']);
  assert.equal(ARTICLE_DATA_ADAPTERS.nfl.playerSupports({ id: '1', position: 'G' }), false);
  assert.equal(ARTICLE_DATA_ADAPTERS.nfl.playerSupports({ id: '1', position: 'WR' }), true);
  assert.equal(ARTICLE_DATA_ADAPTERS.nfl.playerSupports({ id: '1', position: 'DE' }), true);
});

test('NBA article: stat line evidence plus PBE WinBA labeled as model data with its version', () => {
  const article = {
    id: 'nba-line', sport: 'nba', title: 'Tatum takes over late',
    body: 'Jayson Tatum finished with 31 points, 8 rebounds and 7 assists in 37 minutes. He made five threes. Boston won by 12 points.',
    take: { impact_score: 3, prop_types: ['points'] },
  };
  const manifest = {
    players: [{ id: '4065648', name: 'Jayson Tatum', position: 'SF', path: '/player/nba/4065648' }],
    teams: [{ id: 'BOS', abbreviation: 'BOS', name: 'Boston Celtics', slug: 'boston-celtics', path: '/team/nba/boston-celtics' }],
  };
  const evidence = extractPublishedEvidence(article).flatMap((r) => r.metrics.map((m) => `${m.label}=${m.value}`));
  assert.ok(evidence.includes('PTS=31') && evidence.includes('REB=8') && evidence.includes('AST=7') && evidence.includes('3PM=5'), evidence.join(','));
  assert.ok(!evidence.includes('PTS=12'), 'a winning margin is not a player stat');

  const model = winbaMetric({ ok: true, winba: { score: 87.4, status: 'QUALIFIED', rank: 2, season: 2026, sample: { games: 24 }, version: 'winba-nba/1.0.0' } });
  assert.deepEqual(model, { label: 'PBE WinBA', value: '87.4', note: '#2 NBA · 2025-26 · 24 GP', version: 'winba-nba/1.0.0' });
  assert.equal(winbaMetric({ ok: true, winba: { score: null, status: 'QUALIFIED' } }), null);
  assert.equal(winbaMetric({ ok: false }), null);

  const card = renderPlayerContext({ sport: 'nba', name: 'Jayson Tatum', label: 'Points', seasonStats: [['PTS', '26.8']], seasonLabel: '2025-26 season', seasonCurrent: false, rows: [], modelMetrics: [model] });
  assert.match(card, /PBE MODEL DATA/);
  assert.match(card, /winba-nba\/1\.0\.0/);
  assert.match(card, /VERIFIED PLAYER DATA/);
  assert.match(card, /Last completed · 2025-26 season/);

  const nbaTeam = teamDataFromPayload(fixture('team-nba.json'), 'nba', NOW);
  assert.equal(nbaTeam, null, 'a 0-0 preseason snapshot is not team data');
});

test('WNBA is inside Article Data Intelligence via the shared basketball adapter', () => {
  const adapter = adapterFor('wnba');
  assert.ok(adapter && adapter.player && adapter.team);
  assert.equal(adapter.intelligenceUrl, 'https://wnba.propbetedge.ai');
  const article = {
    id: 'wnba-line', sport: 'wnba', title: "A'ja Wilson dominates",
    body: "A'ja Wilson scored 34 points with 12 rebounds.",
    take: { impact_score: 3, prop_types: ['points'] },
  };
  const manifest = { players: [{ id: '3149391', name: "A'ja Wilson", position: 'F', path: '/player/wnba/3149391' }], teams: [] };
  const html = renderArticleVisuals(article, manifest);
  assert.match(html, />34<\/strong>\s*<b>PTS<\/b>/);
  assert.match(html, /data-player-id="3149391"/);
  const card = renderPlayerContext({ sport: 'wnba', name: "A'ja Wilson", label: 'Points', seasonStats: [['PTS', '23.4']], rows: [], seasonCurrent: true });
  assert.match(card, /pbe-av-player-card is-wnba/);
  assertTruthful(html, { manifest });
});

test('NHL skater article: skater metrics only', () => {
  const article = {
    id: 'nhl-skater', sport: 'nhl', title: 'Pastrnak buries two',
    body: 'David Pastrnak had 2 goals on 6 shots and logged 21:14 TOI. He blocked 3 shots.',
    take: { impact_score: 3, prop_types: ['shots_on_goal'] },
  };
  const rows = extractPublishedEvidence(article).flatMap((r) => r.metrics.map((m) => `${m.label}=${m.value}`));
  assert.ok(rows.includes('G=2') && rows.includes('SOG=6') && rows.includes('TOI=21:14'), rows.join(','));
  assert.ok(!rows.includes('SOG=3'), 'blocked shots are not shots on goal');
  assert.deepEqual(nhlRecentMetric(article, false), ['shots', 'Shots on Goal']);
  const manifest = { players: [{ id: '8477956', name: 'David Pastrnak', position: 'R', path: '/player/nhl/8477956' }], teams: [] };
  const html = renderArticleVisuals(article, manifest, { live: { team: null, player: { sport: 'nhl', name: 'David Pastrnak', label: 'Shots on Goal', seasonStats: [['G', '2'], ['SOG', '6']], rows: [], seasonCurrent: true }, fetchedAt: 'x' } });
  assertTruthful(html, { hydrated: true, manifest });
});

test('NHL goalie article: goalie metrics, never skater defaults', () => {
  const article = {
    id: 'nhl-goalie', sport: 'nhl', title: 'Swayman stands tall',
    body: 'Jeremy Swayman stopped 27 of 29 shots. He owns a .931 save percentage and a 2.14 GAA.',
    take: { impact_score: 3, prop_types: ['shots_on_goal'] },
  };
  const rows = extractPublishedEvidence(article).flatMap((r) => r.metrics.map((m) => `${m.label}=${m.value}`));
  assert.ok(rows.includes('SV/SA=27/29') && rows.includes('SV%=.931') && rows.includes('GAA=2.14'), rows.join(','));
  assert.ok(!rows.includes('SOG=29'), '"27 of 29 shots" is one save fact, not also a shots stat');
  assert.deepEqual(nhlRecentMetric(article, true), ['saves', 'Saves'], 'a shots_on_goal tag never charts a goalie on shots');
  const manifest = { players: [{ id: '8480280', name: 'Jeremy Swayman', position: 'G', path: '/player/nhl/8480280' }], teams: [] };
  const bad = renderArticleVisuals(article, manifest, { live: { team: null, player: { sport: 'nhl', name: 'Jeremy Swayman', label: 'Shots on Goal', seasonStats: [['SOG', '0']], rows: [], seasonCurrent: true }, fetchedAt: 'x' } });
  assert.ok(auditIntelligenceHtml(bad, { manifest }).includes('goalie_with_skater_metrics'));
  const good = renderArticleVisuals(article, manifest, { live: { team: null, player: { sport: 'nhl', name: 'Jeremy Swayman', label: 'Saves', seasonStats: [['SV%', '.931'], ['GAA', '2.14']], rows: [], seasonCurrent: true }, fetchedAt: 'x' } });
  assertTruthful(good, { hydrated: true, manifest });
});

test('UFC fighter article: published fight evidence renders, and no live adapter guesses', () => {
  assert.equal(adapterFor('ufc'), null, 'no UFC identities in the newsroom graph → no live adapter');
  const article = {
    id: 'ufc-fighter', sport: 'ufc', title: 'Pereira finishes Ankalaev',
    body: 'Alex Pereira improved to 13-3 with the win. He landed 45 significant strikes and stuffed 4 takedowns. He won via TKO at 3:12 of the second round.',
    take: { impact_score: 4, prop_types: [] },
  };
  const rows = extractPublishedEvidence(article).flatMap((r) => r.metrics.map((m) => `${m.label}=${m.value}`));
  assert.ok(rows.includes('RECORD=13-3') && rows.includes('SIG STR=45') && rows.includes('METHOD=TKO') && rows.includes('ROUND=R2') && rows.includes('TIME=3:12'), rows.join(','));
  const html = renderArticleVisuals(article, { players: [], teams: [] });
  assert.match(html, DATA);
  assert.doesNotMatch(html, /data-pbe-player-chart|data-pbe-team-slot/);
  assertTruthful(html);
  assert.equal(extractPublishedEvidence({ sport: 'ufc', body: 'He won by unanimous decision.' }).length, 0, 'a method alone is not numeric evidence');
});

test('source unavailable: adapters fail closed and never throw', async () => {
  const article = { ...patriots, body_html: '<p>Michael Onwenu will not play for the New England Patriots until late in 2026.</p>', body: null };
  const manifest = buildEntityManifest(article);
  const calls = [];
  const live = await loadLiveContext(article, manifest, { base: 'https://example.test', fetch: async (url) => { calls.push(url); throw new Error('offline'); } });
  assert.deepEqual(live.team, null);
  assert.deepEqual(live.player, null);
  assert.ok(calls.some((url) => url.startsWith('https://example.test/api/team-intelligence?sport=nfl&slug=new-england-patriots')));
  const html = renderArticleVisuals(article, manifest, { live });
  assert.doesNotMatch(html, DATA);
  assertTruthful(html, { hydrated: true });

  const non200 = await loadLiveContext(article, manifest, { fetch: async () => ({ ok: false, status: 503, json: async () => ({}) }) });
  assert.equal(non200.team, null);
});

test('empty / thin articles render nothing', () => {
  const teamOnly = { id: 't', sport: 'nfl', title: 'Patriots notebook', body: 'Practice notes.', take: { impact_score: 5, prop_types: [] } };
  assert.equal(renderArticleVisuals(teamOnly, { players: [], teams: [{ id: 'NE', name: 'New England Patriots', slug: 'new-england-patriots' }] }), '');
  assert.equal(renderArticleVisuals({ id: 'x', sport: 'nba', body: '', take: { impact_score: 4 } }, { players: [], teams: [] }), '');
  assert.equal(renderArticleVisuals({ id: 'y', sport: 'nfl', body: '', take: null }, null), '');
});

test('team snapshot contract: season state decides what is shown', () => {
  const nfl = teamDataFromPayload(nflTeam, 'nfl', NOW);
  assert.deepEqual(nfl.metrics.map((m) => m.label), ['RECORD', 'DIVISION', 'STREAK', 'LAST RESULT', 'PTS / GAME']);
  const nhl = teamDataFromPayload(fixture('team-nhl.json'), 'nhl', NOW);
  assert.equal(nhl.metrics[0].label, 'LAST SEASON', 'prior-season record is labeled as last season');
  assert.ok(!nhl.metrics.some((m) => ['STREAK', 'LAST 10', 'LAST RESULT'].includes(m.label)), 'no stale-season form mixed with preseason games');
  const mlb = teamDataFromPayload(fixture('team-mlb.json'), 'mlb', NOW);
  assert.ok(mlb.metrics.some((m) => m.label === 'RUN DIFF'));
  assert.equal(teamDataFromPayload({ ...nflTeam, freshness_state: 'EXPIRED' }, 'nfl', NOW), null);
  assert.equal(teamDataFromPayload({ ok: false }, 'nfl', NOW), null);
  assert.equal(teamDataFromPayload(nflTeam, 'nba', NOW), null, 'a snapshot for another sport is rejected');
});

test('pbe-intel proxy only reads the documented NBA WinBA route', () => {
  assert.equal(pbeIntelResource({ sport: 'nba', kind: 'winba', id: '3112335' }), 'https://nba-intel.sales-fd3.workers.dev/v1/players/3112335');
  assert.throws(() => pbeIntelResource({ sport: 'nba', kind: 'load', id: '1' }));
  assert.throws(() => pbeIntelResource({ sport: 'wnba', kind: 'winba', id: '1' }));
  assert.throws(() => pbeIntelResource({ sport: 'nba', kind: 'winba', id: '../x' }));
  assert.equal(pickWinba({ winba: { score: 'n/a' } }), null);
  assert.equal(pickWinba({ winba: { score: 87.4, status: 'QUALIFIED', rank: 2, season: 2026, sample: { games: 24 }, version: 'v' } }).score, 87.4);
});

test('speculative, projected and line-setting numbers never become evidence', () => {
  const article = {
    id: 'spec', sport: 'nba', title: 'Brunson preview',
    body: 'Brunson is expected to score 30 points. His line is set at 27.5 points. If he plays 38 minutes, the over is live. He is on pace for 2,100 points.',
    take: { impact_score: 3, prop_types: ['points'] },
  };
  assert.deepEqual(extractPublishedEvidence(article), []);
});
