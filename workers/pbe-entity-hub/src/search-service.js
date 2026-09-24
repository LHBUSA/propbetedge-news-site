/**
 * pbe-entity-hub — network search service.
 *
 *   GET /v1/search?q=<query>&limit=20[&sport=mlb|nfl|nba|wnba|nhl|ufc][&type=player,team,event,tool,story]
 *
 * One small JSON answer per query, ranked at the edge by src/search/rank.js.
 * The browser never downloads the index.
 *
 * Corpus (compact search documents, never page snapshots):
 *   players + teams, MLB/NFL/NBA/NHL  bundled entity dictionary (no I/O)
 *   tools / products                  src/search/destinations.js (verified URLs)
 *   WNBA players + teams              KV search:v2:wnba      <- wnba-api /v1/players
 *   UFC fighters / events / bouts     KV search:v2:ufc       <- ufc.propbetedge.ai sitemaps
 *   news stories (full corpus)        KV search:v2:stories:* <- propbet-news-api /news, paged
 *
 * The KV artifacts are rebuilt by the hub's existing cron (see runSearchRefresh)
 * and, if one is missing, lazily in waitUntil behind a short KV lock. A failed
 * or implausibly small upstream never overwrites a good artifact.
 */

import { allPlayers, allTeams, SUPPORTED_SPORTS, teamQueryAbbreviations, nhlTricode, playerNameAliases } from '../../../src/entity-graph/entities.js';
import { searchDocs, toResult, parseSearchParams, MIN_QUERY_LENGTH } from '../../../src/search/rank.js';
import { TOOL_DOCS, teamDoc } from '../../../src/search/destinations.js';
import {
  dictionaryPlayerDocs, wnbaDocsFromApi, ufcDocsFromSitemaps, locsFromSitemap, compactStory, storyDoc,
} from '../../../src/search/documents.js';
import { filterPublicArticles } from '../../../news-integrity.js';

export const SEARCH_SCHEMA = 'pbe-search/1';
export const NEWS_API = 'https://propbet-news-api.sales-fd3.workers.dev';
export const WNBA_API = 'https://wnba-api.sales-fd3.workers.dev';
export const UFC_SITE = 'https://ufc.propbetedge.ai';

export const KEYS = Object.freeze({
  ufc: 'search:v2:ufc',
  wnba: 'search:v2:wnba',
  storiesManifest: 'search:v2:stories:manifest',
  storiesShard: (month) => `search:v2:stories:${month}`,
  lock: (name) => `search:v2:lock:${name}`,
});

const NEWS_PAGE_SIZE = 50;             // the news API's own cap
const CORPUS_TTL_MS = 5 * 60 * 1000;   // isolate memory
const SOURCE_STALE_MS = 12 * 3600 * 1000;
const STORIES_HEAD_STALE_MS = 30 * 60 * 1000;
const BACKFILL_RESTART_MS = 7 * 24 * 3600 * 1000;
const RESULT_MEMO_MAX = 400;

// ─── static corpus (bundled, built once per isolate) ────────────────────────

let staticCorpus = null;

export function staticDocs() {
  if (staticCorpus) return staticCorpus;
  const players = [];
  const teams = [];
  for (const sport of SUPPORTED_SPORTS) {
    players.push(...dictionaryPlayerDocs(allPlayers(sport), playerNameAliases));
    for (const t of allTeams(sport)) {
      const extra = teamQueryAbbreviations(sport, t.abbr).filter((a) => a !== t.abbr);
      if (sport === 'nhl') extra.push(nhlTricode(t.abbr));
      teams.push(teamDoc({
        sport, id: t.id, name: t.name, location: t.location, nickname: t.nickname, abbr: t.abbr,
        href: t.path, logo: t.logo_url, extraAliases: [...new Set(extra)].filter((a) => a && a !== t.abbr),
      }));
    }
  }
  staticCorpus = { players, teams, tools: TOOL_DOCS };
  return staticCorpus;
}

// ─── corpus loading ─────────────────────────────────────────────────────────

let corpus = null;

export function resetSearchCaches() {
  corpus = null;
  resultMemo.clear();
}

async function kvJson(env, key) {
  try { return await env.ENTITY_KV.get(key, 'json'); } catch { return null; }
}

export async function loadCorpus(env, { now = Date.now() } = {}) {
  if (corpus && now - corpus.loadedAt < CORPUS_TTL_MS) return corpus;
  const base = staticDocs();
  const [ufc, wnba, manifest] = await Promise.all([
    kvJson(env, KEYS.ufc),
    kvJson(env, KEYS.wnba),
    kvJson(env, KEYS.storiesManifest),
  ]);
  const months = Object.keys(manifest?.months || {});
  const shards = await Promise.all(months.map((m) => kvJson(env, KEYS.storiesShard(m))));
  const storyRows = new Map();
  for (const shard of shards) for (const row of shard || []) if (Array.isArray(row) && row[0]) storyRows.set(row[0], row);
  const stories = [...storyRows.values()].map(storyDoc);

  const docs = [
    ...base.players,
    ...base.teams,
    ...base.tools,
    ...(wnba?.docs || []),
    ...(ufc?.docs || []),
    ...stories,
  ];
  const byHref = new Map();
  for (const d of docs) if (d.type === 'team') byHref.set(d.href, d);

  corpus = {
    loadedAt: now,
    docs,
    byHref,
    status: {
      dictionary_players: base.players.length,
      teams: base.teams.length + (wnba?.docs || []).filter((d) => d.type === 'team').length,
      tools: base.tools.length,
      wnba: wnba ? { docs: wnba.docs.length, built_at: wnba.built_at } : null,
      ufc: ufc ? { docs: ufc.docs.length, built_at: ufc.built_at } : null,
      stories: {
        docs: stories.length,
        newest_at: manifest?.newest_at || null,
        head_refreshed_at: manifest?.head_refreshed_at || null,
        backfill_complete: Boolean(manifest?.backfill?.complete),
      },
    },
    raw: { ufc, wnba, manifest },
  };
  return corpus;
}

function relatedFor(c) {
  return (doc) => {
    if (doc.type !== 'player' || !doc.teamHref) return [];
    const team = c.byHref.get(doc.teamHref);
    return team ? [team] : [];
  };
}

// ─── the route ──────────────────────────────────────────────────────────────

const resultMemo = new Map();

function memoGet(key) {
  const hit = resultMemo.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > 60_000) { resultMemo.delete(key); return null; }
  resultMemo.delete(key);
  resultMemo.set(key, hit);
  return hit.body;
}

function memoSet(key, body) {
  resultMemo.set(key, { at: Date.now(), body });
  while (resultMemo.size > RESULT_MEMO_MAX) resultMemo.delete(resultMemo.keys().next().value);
}

export function searchCacheKey({ q, limit, sport, types }) {
  const p = new URLSearchParams({ q, limit: String(limit), sport: sport || '', type: types.join(',') });
  return `https://pbe-entity-hub.search.internal/v1/search?${p.toString()}`;
}

export const SEARCH_CACHE_CONTROL = 'public, max-age=60, s-maxage=300, stale-while-revalidate=600';

/**
 * Returns { status, body, cacheControl, cache }. The caller adds CORS (it
 * varies by Origin, so it never goes into the shared cache).
 */
export async function handleSearch(url, env, ctx, { now = Date.now() } = {}) {
  const params = parseSearchParams(url.searchParams);
  if (params.q.length < MIN_QUERY_LENGTH) {
    return {
      status: 200,
      cacheControl: 'public, max-age=300, s-maxage=3600',
      cache: 'SKIP',
      body: { ok: true, schema: SEARCH_SCHEMA, query: params.raw.trim(), normalized: params.q, count: 0, results: [], reason: 'query_too_short', min_length: MIN_QUERY_LENGTH },
    };
  }

  const key = searchCacheKey(params);
  const memo = memoGet(key);
  if (memo) return { status: 200, body: memo, cacheControl: SEARCH_CACHE_CONTROL, cache: 'MEMO' };

  const edgeCache = typeof caches !== 'undefined' ? caches.default : null;
  if (edgeCache) {
    try {
      const hit = await edgeCache.match(key);
      if (hit) {
        const body = await hit.json();
        memoSet(key, body);
        return { status: 200, body, cacheControl: SEARCH_CACHE_CONTROL, cache: 'HIT' };
      }
    } catch { /* cache is an optimisation only */ }
  }

  const started = Date.now();
  const c = await loadCorpus(env, { now });
  scheduleLazyRefresh(env, ctx, c, now);

  const ranked = searchDocs(c.docs, params.q, {
    limit: params.limit,
    sport: params.sport,
    types: params.types,
    // Rounded to the hour so identical queries rank identically for the life
    // of a cache entry.
    now: Math.floor(now / 3_600_000) * 3_600_000,
    related: relatedFor(c),
  });
  const results = ranked.map(toResult);
  const body = {
    ok: true,
    schema: SEARCH_SCHEMA,
    query: params.raw.trim(),
    normalized: params.q,
    sport: params.sport,
    type: params.types.length ? params.types : null,
    limit: params.limit,
    count: results.length,
    results,
    sources: c.status,
    took_ms: Date.now() - started,
    generated_at: new Date(now).toISOString(),
  };

  memoSet(key, body);
  if (edgeCache && ctx?.waitUntil) {
    const stored = new Response(JSON.stringify(body), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': SEARCH_CACHE_CONTROL },
    });
    ctx.waitUntil(edgeCache.put(key, stored).catch(() => {}));
  }
  return { status: 200, body, cacheControl: SEARCH_CACHE_CONTROL, cache: 'MISS' };
}

// ─── lazy refresh ───────────────────────────────────────────────────────────

function scheduleLazyRefresh(env, ctx, c, now) {
  if (!ctx?.waitUntil || !env?.ENTITY_KV) return;
  const stale = (builtAt, ms) => !builtAt || now - Date.parse(builtAt) > ms;
  const jobs = [];
  if (stale(c.raw.ufc?.built_at, SOURCE_STALE_MS)) jobs.push(['ufc', () => refreshUfcIndex(env)]);
  if (stale(c.raw.wnba?.built_at, SOURCE_STALE_MS)) jobs.push(['wnba', () => refreshWnbaIndex(env)]);
  const m = c.raw.manifest;
  if (!m || stale(m.head_refreshed_at, STORIES_HEAD_STALE_MS)) jobs.push(['stories-head', () => refreshStoriesHead(env, { pages: 2 })]);
  if (!m?.backfill?.complete) jobs.push(['stories-backfill', () => backfillStories(env, { pages: 6 })]);
  for (const [name, job] of jobs) ctx.waitUntil(withLock(env, name, job).catch(() => {}));
}

async function withLock(env, name, job, ttlS = 90) {
  const key = KEYS.lock(name);
  if (await env.ENTITY_KV.get(key)) return { skipped: 'locked' };
  await env.ENTITY_KV.put(key, new Date().toISOString(), { expirationTtl: Math.max(60, ttlS) });
  try {
    const out = await job();
    corpus = null; // next request re-reads the refreshed artifact
    return out;
  } finally {
    await env.ENTITY_KV.delete(key).catch(() => {});
  }
}

// ─── source refreshers ──────────────────────────────────────────────────────

async function fetchText(url, init = {}) {
  const res = await fetch(url, { ...init, headers: { 'User-Agent': 'pbe-entity-hub/search (+https://propbetedge.ai)', ...(init.headers || {}) } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

/** UFC: the site's own sitemaps are the canonical URL list by construction. */
export async function refreshUfcIndex(env, { now = Date.now() } = {}) {
  const index = await fetchText(`${UFC_SITE}/sitemap.xml`);
  const children = locsFromSitemap(index).filter((u) => u.startsWith(`${UFC_SITE}/sitemaps/`));
  const pick = (re) => children.filter((u) => re.test(u));
  const [fighterXml, eventXml, fightXml] = await Promise.all([
    Promise.all(pick(/\/fighters-\d+\.xml$/).map((u) => fetchText(u))),
    Promise.all(pick(/\/events\.xml$/).map((u) => fetchText(u))),
    Promise.all(pick(/\/fights-\d+\.xml$/).map((u) => fetchText(u))),
  ]);
  const fighters = fighterXml.flatMap(locsFromSitemap);
  const events = eventXml.flatMap(locsFromSitemap);
  const fights = fightXml.flatMap(locsFromSitemap);
  const docs = ufcDocsFromSitemaps({ fighters, events, fights }, { now });

  const counts = { fighters: docs.filter((d) => d.type === 'player').length, events: docs.filter((d) => d.kind === 'event').length, fights: docs.filter((d) => d.kind === 'fight').length };
  // Plausibility gate: a truncated sitemap must not replace a good index.
  if (counts.fighters < 500 || counts.events < 100) return { ok: false, reason: 'implausible_sitemap', counts };
  await env.ENTITY_KV.put(KEYS.ufc, JSON.stringify({ built_at: new Date(now).toISOString(), source: `${UFC_SITE}/sitemap.xml`, counts, docs }));
  return { ok: true, counts };
}

/** WNBA: our own wnba-api Worker, the same source wnba.propbetedge.ai renders. */
export async function refreshWnbaIndex(env, { now = Date.now() } = {}) {
  const payload = JSON.parse(await fetchText(`${WNBA_API}/v1/players`, { headers: { Accept: 'application/json' } }));
  if (!payload?.ok) return { ok: false, reason: 'upstream_not_ok' };
  const docs = wnbaDocsFromApi(payload);
  const counts = { players: docs.filter((d) => d.type === 'player').length, teams: docs.filter((d) => d.type === 'team').length };
  if (counts.players < 50 || counts.teams < 10) return { ok: false, reason: 'implausible_roster', counts };
  await env.ENTITY_KV.put(KEYS.wnba, JSON.stringify({ built_at: new Date(now).toISOString(), source: `${WNBA_API}/v1/players`, counts, docs }));
  return { ok: true, counts };
}

/**
 * One page of the newsroom corpus, through the same publication policy the
 * site applies (reattributed bylines, integrity gate), so search can never
 * surface a story the site itself would withhold.
 *
 * The news API admits our own properties by Origin; this Worker IS one of
 * them, and it only reads the public listing the site already renders.
 */
async function fetchNewsPage(page) {
  const text = await fetchText(`${NEWS_API}/news?limit=${NEWS_PAGE_SIZE}&page=${page}`, {
    headers: { Accept: 'application/json', Origin: 'https://propbetedge.ai' },
  });
  const data = JSON.parse(text);
  const articles = Array.isArray(data?.articles) ? data.articles : [];
  const rows = filterPublicArticles(articles).map(compactStory).filter(Boolean);
  return { rows, raw: articles.length, totalPages: Number(data?.totalPages) || null, hasMore: Boolean(data?.hasMore) };
}

function monthOf(row) {
  const iso = String(row[4] || '');
  return /^\d{4}-\d{2}/.test(iso) ? iso.slice(0, 7) : 'undated';
}

export async function mergeStoryRows(env, rows, manifestPatch = {}) {
  const manifest = (await kvJson(env, KEYS.storiesManifest)) || { months: {}, backfill: { next_page: 1, complete: false } };
  const byMonth = new Map();
  for (const row of rows) {
    const m = monthOf(row);
    if (!byMonth.has(m)) byMonth.set(m, []);
    byMonth.get(m).push(row);
  }
  let added = 0;
  for (const [month, incoming] of byMonth) {
    const existing = (await kvJson(env, KEYS.storiesShard(month))) || [];
    const map = new Map(existing.map((r) => [r[0], r]));
    for (const row of incoming) {
      if (!map.has(row[0])) added += 1;
      map.set(row[0], row);
    }
    const merged = [...map.values()].sort((a, b) => String(b[4] || '').localeCompare(String(a[4] || '')));
    await env.ENTITY_KV.put(KEYS.storiesShard(month), JSON.stringify(merged));
    manifest.months[month] = merged.length;
  }
  const newest = rows.reduce((acc, r) => (r[4] && (!acc || r[4] > acc) ? r[4] : acc), manifest.newest_at || null);
  const next = { ...manifest, ...manifestPatch, newest_at: newest, updated_at: new Date().toISOString() };
  if (manifestPatch.backfill) next.backfill = { ...manifest.backfill, ...manifestPatch.backfill };
  await env.ENTITY_KV.put(KEYS.storiesManifest, JSON.stringify(next));
  return { added, months: [...byMonth.keys()], manifest: next };
}

/** Newest stories: every tick, so a just-published story is searchable within the hour. */
export async function refreshStoriesHead(env, { pages = 2 } = {}) {
  const rows = [];
  let totalPages = null;
  for (let page = 1; page <= pages; page++) {
    const r = await fetchNewsPage(page);
    rows.push(...r.rows);
    totalPages = r.totalPages ?? totalPages;
    if (!r.hasMore) break;
  }
  if (!rows.length) return { ok: false, reason: 'empty_head' };
  const out = await mergeStoryRows(env, rows, { head_refreshed_at: new Date().toISOString(), total_pages: totalPages });
  return { ok: true, fetched: rows.length, added: out.added };
}

/**
 * Walk the archive a bounded number of pages per invocation, cursor in the
 * manifest. Offset paging shifts as new stories publish; that only causes
 * re-reads (deduped by id), never gaps. Restarts weekly to pick up edits.
 */
export async function backfillStories(env, { pages = 10, now = Date.now() } = {}) {
  const manifest = (await kvJson(env, KEYS.storiesManifest)) || { months: {}, backfill: { next_page: 1, complete: false } };
  let backfill = manifest.backfill || { next_page: 1, complete: false };
  if (backfill.complete) {
    if (backfill.completed_at && now - Date.parse(backfill.completed_at) < BACKFILL_RESTART_MS) return { ok: true, skipped: 'complete' };
    backfill = { next_page: 1, complete: false, started_at: new Date(now).toISOString() };
  }
  const rows = [];
  let page = Number(backfill.next_page) || 1;
  let totalPages = backfill.total_pages || null;
  let complete = false;
  for (let i = 0; i < pages; i++, page++) {
    const r = await fetchNewsPage(page);
    rows.push(...r.rows);
    totalPages = r.totalPages ?? totalPages;
    if (!r.hasMore || !r.raw) { complete = true; page += 1; break; }
  }
  const patch = {
    backfill: {
      next_page: complete ? 1 : page,
      total_pages: totalPages,
      complete,
      started_at: backfill.started_at || new Date(now).toISOString(),
      ...(complete ? { completed_at: new Date(now).toISOString() } : {}),
    },
  };
  const out = await mergeStoryRows(env, rows, patch);
  return { ok: true, fetched: rows.length, added: out.added, next_page: patch.backfill.next_page, complete };
}

/**
 * Cron hook. Runs on every hub tick (four per hour, staggered by sport).
 * Independent of the entity refresh: a news API outage cannot stall it.
 */
export async function runSearchRefresh(event, env) {
  const at = new Date(event.scheduledTime);
  const minute = at.getUTCMinutes();
  const hour = at.getUTCHours();
  const report = {};
  const attempt = async (name, fn) => {
    try { report[name] = await fn(); } catch (error) { report[name] = { ok: false, error: String(error?.message || error).slice(0, 140) }; }
  };
  await attempt('stories_head', () => refreshStoriesHead(env, { pages: 2 }));
  await attempt('stories_backfill', () => backfillStories(env, { pages: 10 }));
  if (minute === 0 && hour % 6 === 0) await attempt('ufc', () => refreshUfcIndex(env));
  if (minute === 30 && hour % 6 === 0) await attempt('wnba', () => refreshWnbaIndex(env));
  await env.ENTITY_KV.put('report:search:last', JSON.stringify({ at: new Date().toISOString(), report }), { expirationTtl: 60 * 60 * 24 * 14 });
  corpus = null;
  return report;
}
