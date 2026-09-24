/**
 * tests/mlb-player-profile.test.mjs
 *
 * /player/mlb/:id regression suite. Deterministic: every StatsAPI response is
 * a captured real payload under tests/fixtures/mlb-player (2026-09-24).
 *   Luzardo 666200 — pitcher, OAK -> MIA (2021 split + StatsAPI "2 teams" row) -> PHI
 *   Ohtani 660271  — TWP, hitting + pitching, no pitching in 2019/2024
 *   Trout 545361   — 16-season hitter
 *   Kershaw 477132 — retired after 2025 (no 2026 line)
 *   Benge 701807   — 2026 rookie, one MLB season
 */

import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  currentMlbSeason, profileUrl, yearByYearUrl, gameLogUrl, teamsUrl,
  parseProfile, detectGroups, parseYearByYear, seasonsFromHistory, defaultSeason, seasonLine,
  selectedSeasonStat, teamAbbrMap, normalizeOpponent, parseGameLog, shortDate, val, DASH,
  mlbPlayerDescription,
} from '../src/pages/player-mlb-data.js';
import { renderProfileBody, renderHistory, renderGameLogSection } from '../src/pages/player-mlb-view.js';

const fx = (name) => JSON.parse(fs.readFileSync(new URL(`./fixtures/mlb-player/${name}.json`, import.meta.url), 'utf8'));
const src = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const strip = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&middot;|·/g, '·').replace(/\s+/g, ' ');

// ─── Fake browser for the real controller ────────────────────────────────
const FIXTURE_ROUTES = {
  666200: {
    people: 'luzardo-people',
    yby: { pitching: 'luzardo-yby-pitching' },
    log: { 'pitching:2025': 'luzardo-gamelog-pitching-2025', 'pitching:2026': 'luzardo-gamelog-pitching-2026' },
  },
  660271: {
    people: 'ohtani-people',
    yby: { hitting: 'ohtani-yby-hitting', pitching: 'ohtani-yby-pitching' },
    log: { 'hitting:2026': 'ohtani-gamelog-hitting-2026', 'pitching:2026': 'ohtani-gamelog-pitching-2026' },
  },
  477132: {
    people: 'kershaw-people',
    yby: { pitching: 'kershaw-yby-pitching' },
    log: { 'pitching:2025': 'kershaw-gamelog-pitching-2025' },
  },
};

function makeFetch({ fail = () => false } = {}) {
  const calls = [];
  const fn = async (url) => {
    url = String(url);
    calls.push(url);
    const json = (body) => ({ ok: true, status: 200, json: async () => body });
    const nope = (status = 404) => ({ ok: false, status, json: async () => ({}) });
    if (fail(url)) return nope(500);
    let m = url.match(/\/api\/v1\/teams\?sportId=1&season=(\d{4})$/);
    if (m) return fs.existsSync(new URL(`./fixtures/mlb-player/teams-${m[1]}.json`, import.meta.url)) ? json(fx(`teams-${m[1]}`)) : nope();
    m = url.match(/\/api\/v1\/people\/(\d+)\/stats\?stats=yearByYear&group=(hitting|pitching)&sportId=1/);
    if (m) { const f = FIXTURE_ROUTES[m[1]]?.yby[m[2]]; return f ? json(fx(f)) : nope(); }
    m = url.match(/\/api\/v1\/people\/(\d+)\/stats\?stats=gameLog&group=(hitting|pitching)&season=(\d{4})&sportId=1/);
    if (m) { const f = FIXTURE_ROUTES[m[1]]?.log[`${m[2]}:${m[3]}`]; return f ? json(fx(f)) : json({ stats: [{ splits: [] }] }); }
    m = url.match(/\/api\/v1\/people\/(\d+)\?hydrate=/);
    if (m) { const f = FIXTURE_ROUTES[m[1]]?.people; return f ? json(fx(f)) : json({ people: [] }); }
    return nope();
  };
  fn.calls = calls;
  return fn;
}

const flush = async () => { for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r)); };

let mountSeq = 0;
async function mountProfile(id, opts = {}) {
  const href = `https://propbetedge.ai/player/mlb/${id}${opts.search || ''}`;
  globalThis.window = {
    location: { pathname: `/player/mlb/${id}`, href, search: opts.search || '', hash: '' },
    history: {
      state: null,
      replaceState(_s, _t, u) { window.location.href = `https://propbetedge.ai${u}`; },
    },
  };
  globalThis.document = { getElementById: () => null, activeElement: null };
  globalThis.fetch = makeFetch(opts);
  const listeners = {};
  const mount = { innerHTML: '', querySelector: () => null };
  const root = {
    innerHTML: '',
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    querySelector(sel) { return sel === '[data-mlb-body]' ? mount : null; },
  };
  const metas = [];
  // Fresh module instance per mount so the session caches never leak between tests.
  const { renderMlbPlayerPage } = await import(`../src/pages/player-mlb.js?mount=${++mountSeq}`);
  await renderMlbPlayerPage(root, String(id), (m) => metas.push(m));
  await flush();
  return {
    root, mount, metas, calls: globalThis.fetch.calls,
    text: () => strip(mount.innerHTML),
    async chooseSeason(season) {
      for (const fn of listeners.change || []) fn({ target: { matches: (s) => s === '[data-mlb-season]', value: String(season) } });
      await flush();
    },
  };
}

let unhandled = [];
process.on('unhandledRejection', (e) => unhandled.push(e));
// Pin "today" so the default season is deterministic whenever the suite runs.
mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-24T16:00:00Z') });

// ─── URL contract ─────────────────────────────────────────────────────────
test('URL contract: yearByYear, per-season gameLog, teams, profile', () => {
  assert.equal(currentMlbSeason(new Date('2026-09-24T12:00:00Z')), 2026);
  assert.equal(currentMlbSeason(new Date('2027-01-15T12:00:00Z')), 2026);
  assert.match(yearByYearUrl(666200, 'pitching'), /\/people\/666200\/stats\?stats=yearByYear&group=pitching&sportId=1/);
  assert.equal(gameLogUrl(666200, 'pitching', '2025'), 'https://statsapi.mlb.com/api/v1/people/666200/stats?stats=gameLog&group=pitching&season=2025&sportId=1');
  assert.equal(teamsUrl(2019), 'https://statsapi.mlb.com/api/v1/teams?sportId=1&season=2019');
  assert.match(profileUrl(666200, 2026), /type=\[season,career\],season=2026,sportId=1/);
});

test('profile controller requests yearByYear and the current season game log', async () => {
  const p = await mountProfile(666200);
  assert.ok(p.calls.some((u) => /stats\?stats=yearByYear&group=pitching&sportId=1/.test(u)), 'yearByYear not requested');
  assert.ok(p.calls.includes(gameLogUrl('666200', 'pitching', '2026')), 'current-season gameLog not requested');
  assert.ok(!p.calls.some((u) => /yearByYear&group=hitting/.test(u)), 'pure pitcher should not request hitting history');
});

// ─── Career totals ────────────────────────────────────────────────────────
test('career totals come from the StatsAPI career split and render', async () => {
  const career = parseProfile(fx('luzardo-people')).career.pitching;
  assert.ok(career?.era, 'fixture carries career ERA');
  const p = await mountProfile(666200);
  const t = p.text();
  assert.match(t, /CAREER TOTALS/);
  assert.ok(p.mount.innerHTML.includes(`data-mlb-career="pitching"`));
  assert.ok(t.includes(career.era) && t.includes(career.whip) && t.includes(career.inningsPitched), 'career ERA/WHIP/IP missing');
  assert.ok(t.includes(`${career.wins}-${career.losses}`), 'career W-L missing');
});

// ─── Season history ───────────────────────────────────────────────────────
test('multi-season history: every MLB row, newest first, real team per row', () => {
  const trout = parseYearByYear(fx('trout-yby-hitting'), 'hitting');
  assert.equal(trout.length, 16);
  assert.equal(trout[0].season, '2026');
  assert.equal(trout.at(-1).season, '2011');
  const lz = parseYearByYear(fx('luzardo-yby-pitching'), 'pitching');
  assert.deepEqual(lz.map((r) => `${r.season}:${r.teamLabel}`), [
    '2026:PHI', '2025:PHI', '2024:MIA', '2023:MIA', '2022:MIA', '2021:OAK', '2021:MIA', '2021:2 TEAMS', '2020:OAK', '2019:OAK',
  ]);
  const html = renderHistory('pitching', ['pitching'], { status: 'ok', rows: lz }, '2026');
  assert.equal((html.match(/data-mlb-history-row/g) || []).length, 10);
  assert.match(html, /data-season="2019" data-team="OAK"/);
  assert.doesNotMatch(html, /data-season="2019" data-team="PHI"/, 'current team leaked into an old season');
});

test('traded season uses the StatsAPI combined row and never sums', () => {
  const lz = parseYearByYear(fx('luzardo-yby-pitching'), 'pitching');
  const line = seasonLine(lz, '2021');
  assert.equal(line.source, 'yearByYear-total');
  assert.equal(line.stat.era, '6.61');
  assert.deepEqual(line.teams, ['OAK', 'MIA']);
  const noTotal = lz.filter((r) => !r.isTotal);
  assert.equal(seasonLine(noTotal, '2021'), null, 'must not fabricate a combined line');
});

test('only sportId=1 rows survive history parsing', () => {
  const payload = structuredClone(fx('trout-yby-hitting'));
  payload.stats[0].splits.push({ ...payload.stats[0].splits[0], season: '2010', sport: { id: 11 } });
  assert.equal(parseYearByYear(payload, 'hitting').length, 16);
});

test('rookie with one MLB season renders exactly one history row', () => {
  const rows = parseYearByYear(fx('benge-yby-hitting'), 'hitting');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].teamLabel, 'NYM');
  assert.equal((renderHistory('hitting', ['hitting'], { status: 'ok', rows }, '2026').match(/data-mlb-history-row/g) || []).length, 1);
});

// ─── Selected season ──────────────────────────────────────────────────────
test('selecting 2025 shows 2025 stats, 2025 labels and requests the 2025 game log', async () => {
  const p = await mountProfile(666200);
  assert.match(p.text(), /2026 SEASON STATS/);
  assert.match(p.text(), /GAME LOG · 2026 · 29 GAMES/);
  await p.chooseSeason('2025');
  const t = p.text();
  assert.match(t, /2025 SEASON STATS/);
  assert.doesNotMatch(t, /2026 SEASON STATS/);
  assert.ok(p.calls.includes(gameLogUrl('666200', 'pitching', '2025')), '2025 gameLog URL not requested');
  assert.match(t, /RECENT FORM · 2025 · LAST 10 GAMES/);
  assert.match(t, /GAME LOG · 2025 · 32 GAMES/);
  // ribbon values are 2025's own line (ERA 3.92), not 2026's (2.87)
  const ribbon = p.mount.innerHTML.split('data-mlb-ribbon="pitching"')[1].split('</section>')[0];
  assert.match(ribbon, />3\.92</);
  assert.doesNotMatch(ribbon, />2\.87</);
  // career totals stay
  assert.match(t, /CAREER TOTALS/);
  // highlighted history row follows the selection
  assert.match(p.mount.innerHTML, /class="mlb-history-row is-selected" data-mlb-history-row data-season="2025"/);
  // URL reflects the choice without touching the canonical
  assert.match(window.location.href, /\?season=2025$/);
  assert.equal(p.metas[0].canonical, 'https://propbetedge.ai/player/mlb/666200');
  // every 2025 row is dated 2025
  const dates = [...p.mount.innerHTML.matchAll(/data-mlb-gamelog="pitching"[\s\S]*?<\/table>/g)][0][0].match(/data-date="([^"]+)"/g);
  assert.equal(dates.length, 32);
  assert.ok(dates.every((d) => d.includes('"2025-')));
});

test('selectedSeasonStat never substitutes current-season stats for a historical season', () => {
  const profile = parseProfile(fx('luzardo-people'));
  assert.equal(selectedSeasonStat({ history: null, profileSeason: profile.season.pitching, season: '2025', current: 2026 }), null);
  assert.equal(selectedSeasonStat({ history: null, profileSeason: profile.season.pitching, season: '2026', current: 2026 }).source, 'profile-season');
});

test('?season= deep link selects that season on load', async () => {
  const p = await mountProfile(666200, { search: '?season=2023' });
  assert.match(p.text(), /2023 SEASON STATS/);
  assert.ok(p.calls.includes(gameLogUrl('666200', 'pitching', '2023')));
});

test('retired player defaults to his last season with data, labelled with that year', async () => {
  const k = parseYearByYear(fx('kershaw-yby-pitching'), 'pitching');
  assert.equal(defaultSeason({ pitching: k }, 2026), '2025');
  const p = await mountProfile(477132);
  assert.match(p.text(), /2025 SEASON STATS/);
  assert.ok(p.calls.includes(gameLogUrl('477132', 'pitching', '2025')));
  assert.equal((p.mount.innerHTML.match(/data-mlb-history-row/g) || []).length, k.length);
});

// ─── Two-way ──────────────────────────────────────────────────────────────
test('two-way player renders separate hitting and pitching sections, never merged', async () => {
  const prof = parseProfile(fx('ohtani-people'));
  assert.deepEqual(detectGroups(prof), ['hitting', 'pitching']);
  assert.deepEqual(detectGroups(parseProfile(fx('luzardo-people'))), ['pitching']);
  assert.deepEqual(detectGroups(parseProfile(fx('benge-people'))), ['hitting']);
  const p = await mountProfile(660271);
  const html = p.mount.innerHTML;
  const t = p.text();
  assert.match(t, /2026 SEASON STATS · HITTING/);
  assert.match(t, /2026 SEASON STATS · PITCHING/);
  assert.match(t, /SEASON HISTORY · HITTING/);
  assert.match(t, /SEASON HISTORY · PITCHING/);
  const hitHist = html.split('data-mlb-section="history" data-group="hitting"')[1].split('</section>')[0];
  const pitHist = html.split('data-mlb-section="history" data-group="pitching"')[1].split('</section>')[0];
  assert.equal((hitHist.match(/data-mlb-history-row/g) || []).length, 9);
  assert.equal((pitHist.match(/data-mlb-history-row/g) || []).length, 7);
  const cells = (tbl) => [...tbl.matchAll(/<tr class="mlb-history-row[\s\S]*?<\/tr>/g)].map((m) => (m[0].match(/<td/g) || []).length);
  assert.ok(cells(hitHist).every((n) => n === 14), 'hitting rows must have exactly the 14 hitting columns');
  assert.ok(cells(pitHist).every((n) => n === 11), 'pitching rows must have exactly the 11 pitching columns');
  assert.match(hitHist, /<th scope="col">AB<\/th>/);
  assert.doesNotMatch(hitHist, /<th scope="col">ERA<\/th>/);
  assert.match(pitHist, /<th scope="col">ERA<\/th>/);
  assert.doesNotMatch(pitHist, /<th scope="col">AB<\/th>/);
  assert.ok(p.calls.some((u) => /yearByYear&group=hitting/.test(u)) && p.calls.some((u) => /yearByYear&group=pitching/.test(u)));
});

test('two-way season without pitching says so instead of showing zeroes', async () => {
  const p = await mountProfile(660271);
  await p.chooseSeason('2024');
  const t = p.text();
  assert.match(t, /2024 SEASON STATS · PITCHING/);
  assert.match(t, /No MLB pitching statistics recorded for 2024/);
  assert.ok(!p.calls.includes(gameLogUrl('660271', 'pitching', '2024')), 'known-empty season must not be requested');
});

// ─── Opponents ────────────────────────────────────────────────────────────
test('opponent present in the source never normalizes to an em dash', () => {
  const abbrs = teamAbbrMap(fx('teams-2026'));
  const rows = parseGameLog(fx('luzardo-gamelog-pitching-2026'), { season: '2026', abbrs });
  assert.equal(rows.length, 29);
  assert.ok(rows.every((r) => r.opp !== DASH && /^(@|vs) [A-Z]{2,3}$/.test(r.opp)), rows.map((r) => r.opp).join(','));
  const texas = { opponent: { id: 140, name: 'Texas Rangers' }, isHome: false };
  assert.equal(normalizeOpponent(texas, abbrs), '@ TEX');
  assert.equal(normalizeOpponent({ ...texas, isHome: true }, new Map()), 'vs Texas Rangers', 'falls back to the source name, not a dash');
  assert.equal(normalizeOpponent({ opponent: { id: 140, name: 'Texas Rangers', abbreviation: 'TEX' } }, null), 'TEX');
  assert.equal(normalizeOpponent({}, abbrs), DASH);
  // historical abbreviation comes from that season's team list
  assert.equal(teamAbbrMap(fx('teams-2019')).get(133), 'OAK');
  assert.equal(abbrs.get(133), 'ATH');
  const html = renderGameLogSection('pitching', ['pitching'], '2026', { status: 'ok', rows });
  assert.equal((html.match(/<td class="mlb-opp">—<\/td>/g) || []).length, 0);
});

test('game log parsing keeps only the requested season, newest first, deduped', () => {
  const payload = structuredClone(fx('luzardo-gamelog-pitching-2025'));
  payload.stats[0].splits.push({ ...payload.stats[0].splits[0] });
  payload.stats[0].splits.push({ ...payload.stats[0].splits[1], season: '2024', game: { gamePk: 1 } });
  const rows = parseGameLog(payload, { season: '2025', abbrs: teamAbbrMap(fx('teams-2025')) });
  assert.equal(rows.length, 32);
  assert.ok(rows[0].date > rows.at(-1).date);
  assert.equal(shortDate('2025-03-29'), '3/29');
});

// ─── Resilience + honesty ─────────────────────────────────────────────────
test('history failure keeps the current profile (season, career, game log) intact', async () => {
  unhandled = [];
  const p = await mountProfile(666200, { fail: (u) => /yearByYear/.test(u) });
  const t = p.text();
  const cur = parseProfile(fx('luzardo-people')).season.pitching.stat;
  assert.match(t, /2026 SEASON STATS/);
  assert.ok(p.mount.innerHTML.split('data-mlb-ribbon="pitching"')[1].includes(`>${cur.era}<`), 'current season line lost');
  assert.match(t, /CAREER TOTALS/);
  assert.match(t, /Season history unavailable/);
  assert.match(t, /GAME LOG · 2026 · 29 GAMES/);
  assert.equal(unhandled.length, 0);
});

test('a failed game log only blanks that game log', async () => {
  unhandled = [];
  const p = await mountProfile(666200, { fail: (u) => /stats=gameLog/.test(u) && /season=2024/.test(u) });
  await p.chooseSeason('2024');
  const t = p.text();
  assert.match(t, /Game log unavailable for 2024/);
  assert.match(t, /2024 SEASON STATS/);
  assert.match(t, /CAREER TOTALS/);
  assert.match(t, /SEASON HISTORY/);
  assert.equal(unhandled.length, 0);
});

test('teams lookup failure falls back to source names, never dashes', async () => {
  const p = await mountProfile(666200, { fail: (u) => /\/teams\?/.test(u) });
  const log = p.mount.innerHTML.split('data-mlb-gamelog="pitching"')[1].split('</table>')[0];
  const opps = [...log.matchAll(/<td class="mlb-opp">([^<]*)<\/td>/g)].map((m) => m[1]);
  assert.equal(opps.length, 29);
  assert.ok(opps.every((o) => /^(@|vs) [A-Z][A-Za-z.]+( [A-Z][A-Za-z.]+)+$/.test(o)), opps.join(','));
});

test('null is a dash and zero is zero', () => {
  assert.equal(val(0), '0');
  assert.equal(val('0'), '0');
  assert.equal(val(null), DASH);
  assert.equal(val(undefined), DASH);
  const html = renderProfileBody({
    groups: ['pitching'], current: 2026, selected: '2026', seasons: ['2026'],
    history: { pitching: { status: 'ok', rows: [{ season: '2026', teamLabel: 'PHI', isTotal: false, stat: { era: '0.00', saves: 0 } }] } },
    profileSeason: {}, career: { pitching: { era: '3.10' } }, logs: { pitching: { status: 'ok', rows: [] } },
  });
  const ribbon = html.split('data-mlb-ribbon="pitching"')[1].split('</section>')[0];
  assert.match(ribbon, /SV<\/div>\s*<div[^>]*>0</);
  assert.match(ribbon, /WHIP<\/div>\s*<div[^>]*>—</);
  const career = html.split('data-mlb-career="pitching"')[1];
  assert.match(career, /GS<\/div>\s*<div[^>]*>—</, 'missing career value must be a dash, not 0');
});

test('seasons list is distinct and newest first across groups', () => {
  const h = parseYearByYear(fx('ohtani-yby-hitting'), 'hitting');
  const pch = parseYearByYear(fx('ohtani-yby-pitching'), 'pitching');
  assert.deepEqual(seasonsFromHistory({ hitting: h, pitching: pch }), ['2026', '2025', '2024', '2023', '2022', '2021', '2020', '2019', '2018']);
});

// ─── SEO ──────────────────────────────────────────────────────────────────
test('meta description covers career, history, game logs and recent form; canonical stays bare', async () => {
  const d = mlbPlayerDescription('Jesús Luzardo', 'Philadelphia Phillies');
  for (const w of ['career totals', 'season-by-season history', 'game logs', 'recent form', 'PropBetEdge MLB']) assert.ok(d.includes(w), w);
  const p = await mountProfile(666200);
  assert.equal(p.metas[0].description, mlbPlayerDescription('Jesús Luzardo', 'Philadelphia Phillies'));
  assert.equal(p.metas[0].canonical, 'https://propbetedge.ai/player/mlb/666200');
  const mw = src('middleware.js');
  assert.match(mw, /import \{ mlbPlayerDescription \} from '\.\/src\/pages\/player-mlb-data\.js'/);
  assert.match(mw, /sport === 'mlb'\s*\r?\n\s*\? mlbPlayerDescription\(/);
});

test('page order: season -> career -> recent -> history -> game log', async () => {
  const p = await mountProfile(666200);
  const html = p.mount.innerHTML;
  const at = (k) => html.indexOf(`data-mlb-section="${k}"`);
  assert.ok(at('season') < at('career') && at('career') < at('recent') && at('recent') < at('history') && at('history') < at('gamelog'));
  const page = p.root.innerHTML;
  assert.ok(page.indexOf('data-mlb-body') < page.indexOf('RELATED NEWS'));
});
