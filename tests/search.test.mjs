/**
 * tests/search.test.mjs — PropBetEdge network search.
 *
 * Deterministic: the corpus is the bundled entity dictionary plus captured
 * fixtures (tests/fixtures/search/*), a fixed clock, and a stubbed fetch for
 * the Worker. No live network.
 *
 * Run: node --test --test-concurrency=1 tests/search.test.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  searchDocs, toResult, groupResults, parseSearchParams, damerauLevenshtein, normalizeQuery,
} from '../src/search/rank.js';
import { TOOL_DOCS, EMPTY_STATE, dictionaryTeamDocs, wnbaTeamDocs } from '../src/search/destinations.js';
import {
  ufcDocsFromSitemaps, wnbaDocsFromApi, compactStory, storyDoc, fighterNameFromSlug, eventTitleFromSlug,
} from '../src/search/documents.js';
import { createSearchController, latencyBucket } from '../src/search/client.js';
import { TEAMS } from '../src/entity-graph/dictionary.js';
import { filterPublicArticles } from '../news-integrity.js';
import worker from '../workers/pbe-entity-hub/src/index.js';
import {
  staticDocs, resetSearchCaches, KEYS, refreshWnbaIndex, refreshStoriesHead, NEWS_API,
} from '../workers/pbe-entity-hub/src/search-service.js';
import { resultLabel } from '../src/search-palette.js';

const NOW = Date.parse('2026-09-24T23:30:00Z');
const fixture = (name) => JSON.parse(fs.readFileSync(new URL(`./fixtures/search/${name}`, import.meta.url), 'utf8'));
const UFC_URLS = fixture('ufc-sitemap-urls.json');
const WNBA = fixture('wnba-players.json');
const NEWS = fixture('news-articles.json');

// A synthetic story whose headline STARTS with a player's name — the case a
// crude prefix ranker gets wrong. Clearly synthetic; never served anywhere.
const SYNTHETIC_JUDGE_STORY = {
  id: 'fixture-judge-headline', sport: 'mlb', category: 'general', slug: 'fixture-aaron-judge-headline',
  title: 'Aaron Judge Launches No. 50 as Yankees Tighten Wild Card Grip', summary: '', body: '',
  author: 'PropBetEdge Editorial Team', published_at: '2026-09-24T20:00:00+00:00',
  url: 'https://propbetedge.ai/news/mlb/fixture-aaron-judge-headline', take: { players: ['Aaron Judge'], teams: ['NYY'] },
};

function storyRows(articles) {
  return filterPublicArticles(articles).map(compactStory).filter(Boolean);
}

function buildCorpus() {
  const s = staticDocs();
  const ufc = ufcDocsFromSitemaps(UFC_URLS, { now: NOW });
  const wnba = wnbaDocsFromApi(WNBA);
  const stories = storyRows([...NEWS.articles, SYNTHETIC_JUDGE_STORY]).map(storyDoc);
  const docs = [...s.players, ...s.teams, ...s.tools, ...wnba, ...ufc, ...stories];
  const teams = new Map(docs.filter((d) => d.type === 'team').map((d) => [d.href, d]));
  const related = (d) => (d.type === 'player' && d.teamHref && teams.get(d.teamHref) ? [teams.get(d.teamHref)] : []);
  return { docs, related };
}

const CORPUS = buildCorpus();
const search = (q, opts = {}) => searchDocs(CORPUS.docs, q, { now: NOW, related: CORPUS.related, ...opts }).map(toResult);
const top = (q, opts) => search(q, opts)[0];

// ─── players ─────────────────────────────────────────────────────────────────

test('player search actually searches canonical players (MLB, NFL, NBA, NHL, WNBA, UFC)', () => {
  assert.equal(top('Aaron Judge').type, 'player');
  assert.equal(top('Aaron Judge').title, 'Aaron Judge');
  assert.equal(top('Aaron Judge').href, '/player/mlb/592450');
  assert.equal(top('Aaron Judge').subtitle, 'New York Yankees · RF');
  assert.match(top('Aaron Judge').image, /^https:\/\/img\.mlbstatic\.com\//);
  assert.equal(top('Patrick Mahomes').href, '/player/nfl/3139477');
  assert.equal(top('Connor McDavid').href, '/player/nhl/8478402');
  assert.equal(top('Shohei Ohtani').href, '/player/mlb/660271');
  assert.equal(top('Caitlin Clark').href, 'https://wnba.propbetedge.ai/players/4433403');
  assert.equal(top('Alexandre Pantoja').href, 'https://ufc.propbetedge.ai/fighters/alexandre-pantoja-2560746');
});

test('"Judge" and "aaron judg" still find Aaron Judge first', () => {
  assert.equal(top('Judge').title, 'Aaron Judge');
  assert.equal(top('aaron judg').title, 'Aaron Judge');
  assert.equal(top('AARON   JUDGE').title, 'Aaron Judge');
});

test('exact player beats a story whose headline starts with his name; his team and stories follow', () => {
  const results = search('Aaron Judge');
  assert.equal(results[0].type, 'player');
  assert.equal(results[1].type, 'team');
  assert.equal(results[1].title, 'New York Yankees');
  const storyIndex = results.findIndex((r) => r.type === 'story' && r.title.startsWith('Aaron Judge Launches'));
  assert.ok(storyIndex > 1, 'the Judge headline should still be listed, below the entities');
  assert.ok(results.some((r) => r.type === 'story' && /Judge's Wild Card/.test(r.title)), 'tagged story is related');
});

test('typo tolerance: McDvaid, Mahome, Ohtnai', () => {
  assert.equal(top('McDvaid').title, 'Connor McDavid');
  assert.equal(top('Mahome').title, 'Patrick Mahomes');
  assert.equal(top('Ohtnai').title, 'Shohei Ohtani');
  assert.equal(top('aaron jugde').title, 'Aaron Judge');
});

test('accent folding and punctuation: A\'ja Wilson / aja wilson', () => {
  assert.equal(top("A'ja Wilson").title, "A'ja Wilson");
  assert.equal(top('aja wilson').title, "A'ja Wilson");
  assert.equal(normalizeQuery('José Aldo'), 'jose aldo');
});

// ─── teams ───────────────────────────────────────────────────────────────────

test('team abbreviations, cities and nicknames resolve (NYY, MIN, Twins)', () => {
  assert.equal(top('NYY').title, 'New York Yankees');
  assert.equal(top('NYY').type, 'team');
  assert.equal(top('Yankees').title, 'New York Yankees');
  assert.equal(top('Twins').title, 'Minnesota Twins');
  assert.equal(top('Minnesota Twins').href, '/team/mlb/minnesota-twins');
  const min = search('MIN').filter((r) => r.type === 'team');
  assert.equal(min[0].title, 'Minnesota Twins');
  assert.deepEqual(
    new Set(min.slice(0, 5).map((r) => r.title)),
    new Set(['Minnesota Twins', 'Minnesota Vikings', 'Minnesota Timberwolves', 'Minnesota Lynx', 'Minnesota Wild']),
  );
  assert.equal(top('lynx').href, 'https://wnba.propbetedge.ai/teams/8');
  // identity-system aliases: newsroom tagger spelling + NHL tricode
  assert.equal(top('KCR').title, 'Kansas City Royals');
  assert.equal(top('TBL').title, 'Tampa Bay Lightning');
});

// ─── tools ───────────────────────────────────────────────────────────────────

test('Fight Simulator resolves directly to https://ufc.propbetedge.ai/simulator', () => {
  for (const q of ['Fight Simulator', 'fight sim', 'simulator']) {
    const r = top(q);
    assert.equal(r.type, 'tool', q);
    assert.equal(r.href, 'https://ufc.propbetedge.ai/simulator', q);
  }
  assert.equal(top('Fight Simulator').subtitle, 'UFC INTELLIGENCE · LABS');
});

test('tools: HR Targets, UFC rankings, injuries, standings, PBE Picks, PBEcast, Fight DNA', () => {
  assert.equal(top('HR Targets').href, 'https://mlb.propbetedge.ai/hr-picks');
  assert.equal(top('UFC rankings').href, 'https://ufc.propbetedge.ai/rankings');
  assert.equal(top('injuries').type, 'tool');
  assert.equal(top('standings').href, '/standings/mlb');
  assert.equal(top('nfl injuries').href, 'https://nfl.propbetedge.ai/#injuries');
  assert.equal(top('Fight DNA').href, 'https://ufc.propbetedge.ai/learn/fight-dna');
  assert.ok(search('PBE Picks').filter((r) => r.type === 'tool').length >= 5);
  assert.equal(top('pbecast').href, '/games');
  assert.equal(top('UFC').title, 'UFC Intelligence');
});

test('every tool destination is a verified, well-formed URL (hash routes where paths 404)', () => {
  const ids = new Set();
  for (const d of TOOL_DOCS) {
    assert.ok(!ids.has(d.id), `duplicate tool id ${d.id}`);
    ids.add(d.id);
    assert.ok(d.href.startsWith('/') || /^https:\/\/(mlb|nfl|nba|wnba|nhl|ufc)\.propbetedge\.ai(\/|$)/.test(d.href), d.href);
    if (/^https:\/\/(nfl|nba|nhl)\./.test(d.href) && d.href.replace(/^https:\/\/[^/]+/, '').length > 1) {
      assert.match(d.href, /\/#/, `${d.href} must use the hash route`);
    }
    assert.ok(d.label, `${d.id} has a display label`);
  }
  assert.ok(!TOOL_DOCS.some((d) => /ufc\.propbetedge\.ai\/(fight-dna|track-record)$/.test(d.href)), 'UFC /fight-dna and /track-record 404');
  assert.deepEqual(EMPTY_STATE.live.map((d) => d.title), ['MLB', 'NFL', 'NBA', 'WNBA', 'NHL', 'UFC']);
  assert.deepEqual(EMPTY_STATE.popular.map((d) => d.title), ['PBE Picks', 'PBEcast', 'Fight Simulator', 'HR Targets', 'Fight DNA']);
});

// ─── UFC events & fights ─────────────────────────────────────────────────────

test('UFC slugs become readable names and event titles', () => {
  assert.equal(fighterNameFromSlug('alexandre-pantoja-2560746'), 'Alexandre Pantoja');
  assert.equal(fighterNameFromSlug('sheldon-westcott-ec2d13a87d3d9541'), 'Sheldon Westcott');
  assert.equal(fighterNameFromSlug('conor-mcgregor-3022677'), 'Conor McGregor');
  assert.equal(eventTitleFromSlug('ufc-320-ankalaev-vs-pereira-2').title, 'UFC 320: Ankalaev vs Pereira 2');
  assert.equal(eventTitleFromSlug('ufc-fight-night-lewis-vs-dos-santos').title, 'UFC Fight Night: Lewis vs dos Santos');
  assert.equal(eventTitleFromSlug('ufc-335').title, 'UFC 335');
});

test('"UFC 320", "Pantoja", "Pantoja Van", "UFC Pantoja" lead with the fight intelligence pages', () => {
  const u320 = top('UFC 320');
  assert.equal(u320.type, 'event');
  assert.equal(u320.href, 'https://ufc.propbetedge.ai/events/ufc-320-ankalaev-vs-pereira-2-2025-10-04');
  assert.equal(top('Pantoja').title, 'Alexandre Pantoja');
  assert.equal(top('UFC Pantoja').title, 'Alexandre Pantoja');
  const pv = search('Pantoja Van');
  assert.equal(pv[0].type, 'event');
  assert.match(pv[0].title, /Van/);
  assert.match(pv[0].title, /Pantoja/);
  assert.ok(pv.slice(0, 3).some((r) => r.kind === 'fight' && /\/fights\/joshua-van-vs-alexandre-pantoja-ufc-331/.test(r.href)));
});

// ─── news corpus ─────────────────────────────────────────────────────────────

test('old articles stay searchable by their exact headline', () => {
  const old = NEWS.articles.find((a) => a.published_at.startsWith('2026-05-07'));
  assert.ok(old, 'fixture has a May story');
  const r = top(old.title);
  assert.equal(r.type, 'story');
  assert.equal(r.title, old.title);
  assert.equal(r.href, `/news/mlb/${old.slug}`);
  // and by a distinctive phrase from it
  const duran = NEWS.articles.find((a) => /Ezequiel Duran/.test(a.title));
  assert.ok(search('Duran Texas lineup').some((x) => x.type === 'story' && x.title === duran.title));
  assert.ok(search('prop sheets duran').some((x) => x.type === 'story' && x.title === duran.title));
  assert.equal(top(duran.title).title, duran.title);
});

test('story rows are compact and honour the publication policy', () => {
  const row = compactStory(NEWS.articles[0]);
  assert.equal(row.length, 8);
  assert.ok(JSON.stringify(row).length < 600);
  const doc = storyDoc(row);
  assert.equal(doc.type, 'story');
  assert.ok(doc.href.startsWith('/news/mlb/'));
});

// ─── grouping and params ─────────────────────────────────────────────────────

test('grouping: only non-empty groups, ordered by their best result', () => {
  const groups = groupResults(search('Aaron Judge'));
  assert.deepEqual(groups.map((g) => g.key), ['player', 'team', 'story']);
  assert.ok(groups.every((g) => g.items.length > 0));
  assert.equal(groupResults(search('Fight Simulator'))[0].key, 'tool');
  assert.deepEqual(groupResults([]), []);
});

test('parseSearchParams clamps limit and validates sport/type', () => {
  const p = (o) => parseSearchParams(new URLSearchParams(o));
  assert.equal(p({ q: 'x', limit: '0' }).limit, 20);
  assert.equal(p({ q: 'x', limit: '500' }).limit, 50);
  assert.equal(p({ q: 'x', limit: '3' }).limit, 3);
  assert.equal(p({ q: 'x', limit: 'abc' }).limit, 20);
  assert.equal(p({ q: 'x', sport: 'NFL' }).sport, 'nfl');
  assert.equal(p({ q: 'x', sport: 'cricket' }).sport, null);
  assert.deepEqual(p({ q: 'x', type: 'team,player,bogus' }).types, ['player', 'team']);
  assert.equal(damerauLevenshtein('mcdvaid', 'mcdavid'), 1);
  assert.equal(damerauLevenshtein('ohtnai', 'ohtani'), 1);
  assert.equal(damerauLevenshtein('abcdef', 'uvwxyz', 2), 3);
});

// ─── Worker: /v1/search ──────────────────────────────────────────────────────

function fakeKv(seed = {}) {
  const store = new Map(Object.entries(seed).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]));
  return {
    store,
    async get(key, type) {
      if (!store.has(key)) return null;
      const v = store.get(key);
      return type === 'json' ? JSON.parse(v) : v;
    },
    async put(key, value) { store.set(key, String(value)); },
    async delete(key) { store.delete(key); },
    async list({ prefix = '' } = {}) { return { keys: [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }; },
  };
}

function seededEnv() {
  const ufc = ufcDocsFromSitemaps(UFC_URLS, { now: NOW });
  const wnba = wnbaDocsFromApi(WNBA);
  const rows = storyRows([...NEWS.articles, SYNTHETIC_JUDGE_STORY]);
  const byMonth = {};
  for (const r of rows) (byMonth[r[4].slice(0, 7)] ||= []).push(r);
  const fresh = new Date().toISOString();
  const seed = {
    [KEYS.ufc]: { built_at: fresh, docs: ufc },
    [KEYS.wnba]: { built_at: fresh, docs: wnba },
    [KEYS.storiesManifest]: {
      months: Object.fromEntries(Object.entries(byMonth).map(([m, v]) => [m, v.length])),
      head_refreshed_at: fresh, backfill: { complete: true, completed_at: fresh },
    },
  };
  for (const [m, v] of Object.entries(byMonth)) seed[KEYS.storiesShard(m)] = v;
  return { ENTITY_KV: fakeKv(seed) };
}

function ctxStub() {
  const jobs = [];
  return { jobs, waitUntil: (p) => jobs.push(Promise.resolve(p).catch(() => {})) };
}

async function call(path, { env = seededEnv(), origin = 'https://propbetedge.ai', ctx = ctxStub() } = {}) {
  const res = await worker.fetch(new Request(`https://pbe-entity-hub.sales-fd3.workers.dev${path}`, { headers: origin ? { Origin: origin } : {} }), env, ctx);
  const body = await res.json();
  return { res, body, env, ctx };
}

test('worker: /v1/search contract, caching headers and CORS', async () => {
  resetSearchCaches();
  const { res, body } = await call('/v1/search?q=aaron%20judge&limit=20');
  assert.equal(res.status, 200);
  assert.equal(body.query, 'aaron judge');
  assert.ok(Array.isArray(body.results));
  const first = body.results[0];
  for (const key of ['type', 'sport', 'id', 'title', 'subtitle', 'href', 'image', 'score']) assert.ok(key in first, `result has ${key}`);
  assert.deepEqual(
    { type: first.type, sport: first.sport, id: first.id, title: first.title, subtitle: first.subtitle, href: first.href },
    { type: 'player', sport: 'mlb', id: '592450', title: 'Aaron Judge', subtitle: 'New York Yankees · RF', href: '/player/mlb/592450' },
  );
  assert.ok(first.score > 0.95 && first.score <= 1);
  assert.match(res.headers.get('Cache-Control'), /public/);
  assert.match(res.headers.get('Cache-Control'), /s-maxage=\d+/);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://propbetedge.ai');
  assert.match(res.headers.get('Vary'), /Origin/);

  const denied = await call('/v1/search?q=aaron%20judge', { origin: 'https://evil.example' });
  assert.equal(denied.res.headers.get('Access-Control-Allow-Origin'), null);
  const preview = await call('/v1/search?q=nyy', { origin: 'https://propbetedge-news-site-abc123-justins-projects-ad4f4bb7.vercel.app' });
  assert.equal(preview.res.headers.get('Access-Control-Allow-Origin'), 'https://propbetedge-news-site-abc123-justins-projects-ad4f4bb7.vercel.app');
});

test('worker: identical queries are served from the result cache', async () => {
  resetSearchCaches();
  const env = seededEnv();
  const a = await call('/v1/search?q=Yankees', { env });
  const b = await call('/v1/search?q=%20yankees%20', { env });
  assert.equal(a.res.headers.get('X-PBE-Search-Cache'), 'MISS');
  assert.equal(b.res.headers.get('X-PBE-Search-Cache'), 'MEMO', 'normalized key: case and whitespace do not matter');
  assert.deepEqual(a.body.results, b.body.results);
});

test('worker: sport and type filters, limit bounds', async () => {
  resetSearchCaches();
  const nfl = await call('/v1/search?q=MIN&sport=nfl');
  assert.ok(nfl.body.results.length > 0);
  assert.ok(nfl.body.results.every((r) => r.sport === 'nfl'));
  assert.equal(nfl.body.results[0].title, 'Minnesota Vikings');

  const teams = await call('/v1/search?q=minnesota&type=team');
  assert.ok(teams.body.results.every((r) => r.type === 'team'));

  const small = await call('/v1/search?q=pbe%20picks&limit=2');
  assert.equal(small.body.results.length, 2);
  const big = await call('/v1/search?q=ufc&limit=999');
  assert.equal(big.body.limit, 50);
  assert.ok(big.body.results.length <= 50);
});

test('worker: empty and too-short queries return an empty, cacheable answer', async () => {
  resetSearchCaches();
  for (const q of ['', 'a', '%20%20', '%F0%9F%8F%88']) {
    const { res, body } = await call(`/v1/search?q=${q}`);
    assert.equal(res.status, 200);
    assert.equal(body.count, 0);
    assert.deepEqual(body.results, []);
    assert.equal(body.reason, 'query_too_short');
    assert.match(res.headers.get('Cache-Control'), /max-age=\d+/);
  }
});

test('worker: KV corpus serves UFC events, WNBA and the old-story archive', async () => {
  resetSearchCaches();
  const u = await call('/v1/search?q=UFC%20320');
  assert.equal(u.body.results[0].href, 'https://ufc.propbetedge.ai/events/ufc-320-ankalaev-vs-pereira-2-2025-10-04');
  const old = NEWS.articles.find((a) => a.published_at.startsWith('2026-05-07'));
  const s = await call(`/v1/search?q=${encodeURIComponent(old.title)}`);
  assert.equal(s.body.results[0].type, 'story');
  assert.equal(s.body.results[0].title, old.title);
  const w = await call('/v1/search?q=caitlin%20clark');
  assert.equal(w.body.results[0].href, 'https://wnba.propbetedge.ai/players/4433403');
});

test('worker: a cold KV still answers from the bundled corpus and schedules a lazy rebuild', async () => {
  resetSearchCaches();
  const env = { ENTITY_KV: fakeKv() };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('offline in tests'); };
  try {
    const { body, ctx } = await call('/v1/search?q=fight%20simulator', { env });
    assert.equal(body.results[0].href, 'https://ufc.propbetedge.ai/simulator');
    assert.ok(ctx.jobs.length >= 3, 'ufc, wnba and stories rebuilds are scheduled');
    await Promise.all(ctx.jobs);
    assert.equal(env.ENTITY_KV.store.has(KEYS.ufc), false, 'a failed upstream writes nothing');
    assert.ok(![...env.ENTITY_KV.store.keys()].some((k) => k.startsWith('search:v2:lock:')), 'locks are released');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('refresh: an implausibly small upstream never overwrites a good artifact', async () => {
  const good = { built_at: '2026-09-24T00:00:00Z', docs: [{ type: 'player', sport: 'wnba', id: '1', title: 'Kept', href: 'x' }] };
  const env = { ENTITY_KV: fakeKv({ [KEYS.wnba]: good }) };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify(WNBA), { status: 200 });
  try {
    const out = await refreshWnbaIndex(env);
    assert.equal(out.ok, false);
    assert.equal(out.reason, 'implausible_roster');
    assert.deepEqual(await env.ENTITY_KV.get(KEYS.wnba, 'json'), good);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('refresh: newsroom pages are merged into month shards through the publication policy', async () => {
  const env = { ENTITY_KV: fakeKv() };
  const realFetch = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async () => { throw new Error('global fetch must not be used when a service binding exists'); };
  env.NEWS_API_SERVICE = {
    fetch: async (request) => {
      seen.push({ url: request.url, origin: request.headers.get('Origin') });
      return new Response(JSON.stringify({ page: 1, totalPages: 1, hasMore: false, articles: NEWS.articles }), { status: 200 });
    },
  };
  try {
    const out = await refreshStoriesHead(env, { pages: 2 });
    assert.equal(out.ok, true);
    assert.equal(seen.length, 1, 'stops when hasMore is false');
    assert.ok(seen[0].url.startsWith(`${NEWS_API}/news?limit=50&page=1`));
    assert.equal(seen[0].origin, 'https://propbetedge.ai');
    const manifest = await env.ENTITY_KV.get(KEYS.storiesManifest, 'json');
    assert.ok(manifest.months['2026-05'] >= 2);
    assert.ok(manifest.months['2026-09'] >= 2);
    const again = await refreshStoriesHead(env, { pages: 1 });
    assert.equal(again.added, 0, 'dedupe by id');
  } finally {
    globalThis.fetch = realFetch;
  }
});

// ─── client controller ───────────────────────────────────────────────────────

const LOCAL = [...TOOL_DOCS, ...dictionaryTeamDocs(TEAMS), ...wnbaTeamDocs()];

function deferred() {
  let resolve; let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function jsonResponse(body) {
  return { ok: true, status: 200, json: async () => body };
}

test('client: a stale, slower response can never overwrite a newer query', async () => {
  const pending = [];
  const states = [];
  const ctl = createSearchController({
    apiBase: 'https://hub.test',
    localDocs: () => LOCAL,
    onState: (s) => states.push(s),
    fetchImpl: (url, init) => { const d = deferred(); pending.push({ url, init, d }); return d.promise; },
  });
  const first = ctl.run('aaron');
  const second = ctl.run('aaron judge');
  assert.equal(pending.length, 2);
  assert.equal(pending[0].init.signal.aborted, true, 'older request is aborted');
  pending[1].d.resolve(jsonResponse({ results: [{ type: 'player', title: 'Aaron Judge', href: '/player/mlb/592450' }] }));
  await second;
  // The old request resolves late (as if abort were ignored) — it must be dropped.
  pending[0].d.resolve(jsonResponse({ results: [{ type: 'player', title: 'Aaron Nola', href: '/player/mlb/605400' }] }));
  await first;
  const final = states.filter((s) => s.status === 'ready').at(-1);
  assert.equal(final.normalized, 'aaron judge');
  assert.equal(final.results[0].title, 'Aaron Judge');
  assert.ok(!states.some((s) => s.status === 'ready' && s.results[0]?.title === 'Aaron Nola'));
});

test('client: search-service failure leaves static navigation usable', async () => {
  const states = [];
  const ctl = createSearchController({
    apiBase: 'https://hub.test',
    localDocs: () => LOCAL,
    onState: (s) => states.push(s),
    fetchImpl: async () => { throw new TypeError('Failed to fetch'); },
  });
  await ctl.run('fight simulator');
  const fb = states.at(-1);
  assert.equal(fb.status, 'fallback');
  assert.equal(fb.results[0].href, 'https://ufc.propbetedge.ai/simulator');
  assert.equal(ctl.serviceDown, true);

  await ctl.run('NYY');
  const teams = states.at(-1);
  assert.equal(teams.status, 'fallback', 'cool-down skips the network');
  assert.equal(teams.results[0].title, 'New York Yankees');
  assert.equal(teams.results[0].href, '/team/mlb/new-york-yankees');

  const http = [];
  const ctl2 = createSearchController({ localDocs: () => LOCAL, onState: (s) => http.push(s), fetchImpl: async () => ({ ok: false, status: 404, json: async () => ({}) }) });
  await ctl2.run('standings');
  assert.equal(http.at(-1).status, 'fallback');
  assert.equal(http.at(-1).results[0].href, '/standings/mlb');
});

test('client: timeouts fall back; LRU serves repeats; short queries never hit the network', async () => {
  let calls = 0;
  const states = [];
  const ctl = createSearchController({
    localDocs: () => LOCAL,
    onState: (s) => states.push(s),
    timeoutMs: 10,
    fetchImpl: (url, init) => new Promise((resolve, reject) => {
      calls += 1;
      init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    }),
  });
  await ctl.run('hr targets');
  assert.equal(states.at(-1).status, 'fallback');
  assert.equal(states.at(-1).results[0].href, 'https://mlb.propbetedge.ai/hr-picks');

  let hits = 0;
  const cached = [];
  const ctl2 = createSearchController({ localDocs: () => LOCAL, onState: (s) => cached.push(s), fetchImpl: async () => { hits += 1; return jsonResponse({ results: [{ type: 'team', title: 'New York Yankees', href: '/team/mlb/new-york-yankees' }] }); } });
  await ctl2.run('Yankees');
  await ctl2.run('yankees ');
  assert.equal(hits, 1);
  assert.equal(cached.at(-1).source, 'cache');

  const before = hits;
  await ctl2.run('y');
  assert.equal(hits, before);
  assert.equal(cached.at(-1).status, 'idle');
});

test('client: keystrokes are debounced into one request', async () => {
  let hits = 0;
  const ctl = createSearchController({ localDocs: () => LOCAL, debounceMs: 15, fetchImpl: async () => { hits += 1; return jsonResponse({ results: [] }); } });
  ctl.setQuery('ma');
  ctl.setQuery('mah');
  ctl.setQuery('maho');
  await ctl.setQuery('mahomes');
  assert.equal(hits, 1);
  assert.equal(latencyBucket(50), '<100ms');
  assert.equal(latencyBucket(2500), '>1s');
});

// ─── palette copy + accessibility contract ───────────────────────────────────

test('palette: copy, ARIA combobox/listbox semantics and keyboard contract', () => {
  const src = fs.readFileSync(new URL('../src/search-palette.js', import.meta.url), 'utf8');
  assert.ok(src.includes('placeholder="Search players, teams, fights, stories and intelligence…"'));
  assert.ok(src.includes('>PropBetEdge Search<'));
  assert.ok(src.includes('Across every sport and intelligence product'));
  assert.ok(!src.includes('PBE NETWORK SEARCH'));
  assert.ok(src.includes('Live intelligence: MLB · NFL · NBA · WNBA · NHL · UFC'));
  for (const needle of ['role="dialog"', 'aria-modal="true"', 'role="combobox"', 'aria-controls="${LISTBOX_ID}"', 'role="listbox"', 'role="option"', 'role="group"', 'aria-activedescendant', 'aria-selected', 'aria-live="polite"']) {
    assert.ok(src.includes(needle), `palette uses ${needle}`);
  }
  for (const key of ["'Escape'", "'Tab'", "'ArrowDown'", "'ArrowUp'", "'Enter'", "event.key === '/'", "=== 'k'"]) {
    assert.ok(src.includes(key), `palette handles ${key}`);
  }
  assert.ok(src.includes('trapFocus'), 'focus is trapped in the dialog');
  assert.ok(src.includes('lastFocused'), 'focus is restored on close');
  assert.ok(src.includes("'site_search'") && src.includes("'site_search_result_open'"), 'analytics events kept + added');
  assert.ok(!/api\.newsAll\(/.test(src), 'no client-side newsroom download');
});

test('palette: result lines make the type obvious', () => {
  const now = Date.parse('2026-09-24T22:00:00Z');
  assert.deepEqual(resultLabel({ type: 'player', sport: 'mlb', subtitle: 'New York Yankees · OF' }, now), { kicker: 'MLB PLAYER', detail: 'New York Yankees · OF' });
  assert.equal(resultLabel({ type: 'player', sport: 'ufc', subtitle: 'Fighter profile · Fight DNA' }, now).kicker, 'UFC FIGHTER');
  assert.equal(resultLabel({ type: 'team', sport: 'mlb' }, now).kicker, 'MLB TEAM');
  assert.equal(resultLabel({ type: 'event', kind: 'event', sport: 'ufc', date: '2026-10-04T00:00:00Z' }, now).kicker, 'UFC EVENT · Oct 4');
  assert.equal(resultLabel({ type: 'event', kind: 'event', sport: 'ufc', date: '2025-10-04T00:00:00Z' }, now).kicker, 'UFC EVENT · Oct 4, 2025');
  assert.equal(resultLabel({ type: 'tool', sport: 'ufc', label: 'UFC INTELLIGENCE · LABS' }, now).kicker, 'UFC INTELLIGENCE · LABS');
  assert.equal(resultLabel({ type: 'story', sport: 'mlb', date: '2026-09-24T20:00:00Z' }, now).kicker, 'MLB NEWS · 2h ago');
});
