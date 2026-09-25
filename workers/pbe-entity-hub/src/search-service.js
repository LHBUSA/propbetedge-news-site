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
 * The KV artifacts are rebuilt ONLY by the hub's cron (see runSearchRefresh);
 * a request may bootstrap a MISSING artifact in waitUntil, never a backfill. A failed
 * or implausibly small upstream never overwrites a good artifact.
 */

import { allPlayers, allTeams, SUPPORTED_SPORTS, teamQueryAbbreviations, nhlTricode, playerNameAliases } from '../../../src/entity-graph/entities.js';
import { searchDocs, toResult, parseSearchParams, prepareDoc, MIN_QUERY_LENGTH } from '../../../src/search/rank.js';
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
//
// Two independently cached tiers, so entity search never waits on the story
// archive:
//   entities  bundled dictionary + tools + KV UFC/WNBA artifacts (~1.7 MB)
//   stories   KV month shards of the newsroom corpus (several MB)
// Each tier is parsed once per isolate and kept in memory. After TTL it is
// served stale while a reload runs in ctx.waitUntil (stale-while-revalidate),
// so a warm isolate never re-parses on the request path. A cold isolate waits
// for entities, and for stories only up to STORY_WAIT_MS; if the archive is not
// ready yet the answer is entity-only, flagged partial, and not edge-cached.

const STORY_WAIT_MS = 150;

const tiers = {
  entities: { value: null, loadedAt: 0, pending: null },
  stories: { value: null, loadedAt: 0, pending: null },
};

export function resetSearchCaches() {
  for (const t of Object.values(tiers)) { t.value = null; t.loadedAt = 0; t.pending = null; }
  resultMemo.clear();
}

/** Mark both tiers for background revalidation on the next request. */
function invalidateTiers() {
  for (const t of Object.values(tiers)) t.loadedAt = 0;
}

async function kvJson(env, key) {
  try { return await env.ENTITY_KV.get(key, 'json'); } catch { return null; }
}

async function loadEntityTier(env) {
  const base = staticDocs();
  const [ufc, wnba] = await Promise.all([kvJson(env, KEYS.ufc), kvJson(env, KEYS.wnba)]);
  const docs = [...base.players, ...base.teams, ...base.tools, ...(wnba?.docs || []), ...(ufc?.docs || [])];
  const byHref = new Map();
  for (const d of docs) if (d.type === 'team') byHref.set(d.href, d);
  return {
    docs,
    byHref,
    raw: { ufc: ufc ? { built_at: ufc.built_at } : null, wnba: wnba ? { built_at: wnba.built_at } : null },
    status: {
      dictionary_players: base.players.length,
      teams: base.teams.length + (wnba?.docs || []).filter((d) => d.type === 'team').length,
      tools: base.tools.length,
      wnba: wnba ? { docs: wnba.docs.length, built_at: wnba.built_at } : null,
      ufc: ufc ? { docs: ufc.docs.length, built_at: ufc.built_at } : null,
    },
  };
}

async function loadStoryTier(env) {
  const manifest = await kvJson(env, KEYS.storiesManifest);
  const months = Object.keys(manifest?.months || {});
  const shards = await Promise.all(months.map((m) => kvJson(env, KEYS.storiesShard(m))));
  const rows = new Map();
  for (const shard of shards) for (const row of shard || []) if (Array.isArray(row) && row[0]) rows.set(row[0], row);
  const docs = [...rows.values()].map(storyDoc);
  // Tokenize here, off the request path (this loader runs in waitUntil on a
  // cold isolate), so the first full search does not pay for 8k+ headlines.
  for (const doc of docs) prepareDoc(doc);
  return {
    docs,
    manifest: manifest ? { months: manifest.months, backfill: manifest.backfill, head_refreshed_at: manifest.head_refreshed_at } : null,
    status: {
      docs: docs.length,
      newest_at: manifest?.newest_at || null,
      head_refreshed_at: manifest?.head_refreshed_at || null,
      backfill_complete: Boolean(manifest?.backfill?.complete),
    },
  };
}

function startLoad(tier, loader, now) {
  if (!tier.pending) {
    tier.pending = loader()
      .then((value) => { tier.value = value; tier.loadedAt = now; return value; })
      .finally(() => { tier.pending = null; });
  }
  return tier.pending;
}

/**
 * The tier's value, loading on first use. With `waitMs`, a cold tier waits at
 * most waitMs (then resolves null) and keeps loading in the background.
 */
async function getTier(name, loader, ctx, now, { waitMs = null } = {}) {
  const tier = tiers[name];
  if (tier.value) {
    if (now - tier.loadedAt >= CORPUS_TTL_MS && !tier.pending) {
      const p = startLoad(tier, loader, now).catch(() => null);
      if (ctx?.waitUntil) ctx.waitUntil(p);
    }
    return tier.value;
  }
  const p = startLoad(tier, loader, now);
  if (waitMs == null) return p;
  if (ctx?.waitUntil) ctx.waitUntil(p.catch(() => null));
  let timer;
  const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve(null), waitMs); });
  try {
    return await Promise.race([p.catch(() => null), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export async function loadCorpus(env, { now = Date.now(), ctx = null, storyWaitMs = null } = {}) {
  const [entities, stories] = await Promise.all([
    getTier('entities', () => loadEntityTier(env), ctx, now),
    getTier('stories', () => loadStoryTier(env), ctx, now, { waitMs: storyWaitMs }),
  ]);
  return {
    docs: stories ? [...entities.docs, ...stories.docs] : entities.docs,
    byHref: entities.byHref,
    partial: stories ? null : ['stories'],
    raw: { ...entities.raw, manifest: stories ? stories.manifest : undefined },
    storiesLoaded: Boolean(stories),
    status: { ...entities.status, stories: stories ? stories.status : { docs: 0, loading: true } },
  };
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
  const c = await loadCorpus(env, { now, ctx, storyWaitMs: STORY_WAIT_MS });
  scheduleLazyRefresh(env, ctx, c);

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

  // A cold isolate that answered before the story archive finished loading:
  // correct for entities, but not the full answer, so it is never cached.
  if (c.partial) {
    body.partial = c.partial;
    return { status: 200, body, cacheControl: 'public, max-age=0, s-maxage=5', cache: 'PARTIAL' };
  }

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
//
// The request path does NO refresh work and NO backfill: the scheduled cron
// (runSearchRefresh) owns every rebuild. The only lazy action is a one-time
// bootstrap when an artifact is entirely MISSING (e.g. a fresh KV namespace),
// started in ctx.waitUntil behind a KV lock, so the response is never delayed
// and concurrent requests do not stampede. The archive backfill is never
// started from a request.

function scheduleLazyRefresh(env, ctx, c) {
  if (!ctx?.waitUntil || !env?.ENTITY_KV) return;
  const jobs = [];
  if (!c.raw.ufc) jobs.push(['ufc', () => refreshUfcIndex(env)]);
  if (!c.raw.wnba) jobs.push(['wnba', () => refreshWnbaIndex(env)]);
  if (c.storiesLoaded && !c.raw.manifest) jobs.push(['stories-head', () => refreshStoriesHead(env, { pages: 1 })]);
  for (const [name, job] of jobs) ctx.waitUntil(withLock(env, name, job).catch(() => {}));
}

async function withLock(env, name, job, ttlS = 300) {
  const key = KEYS.lock(name);
  if (await env.ENTITY_KV.get(key)) return { skipped: 'locked' };
  // Held for its TTL (not released on success) so a bootstrap runs at most once
  // per window even before the artifact write has propagated.
  await env.ENTITY_KV.put(key, new Date().toISOString(), { expirationTtl: Math.max(60, ttlS) });
  try {
    const out = await job();
    invalidateTiers();
    await recordRefresh(env, name, out);
    return out;
  } catch (error) {
    await recordRefresh(env, name, { ok: false, error: String(error?.message || error).slice(0, 200) });
    throw error;
  }
}

/** Last lazy-refresh outcome per source, for operators (no secrets, 14-day TTL). */
async function recordRefresh(env, name, result) {
  try {
    await env.ENTITY_KV.put(`report:search:lazy:${name}`, JSON.stringify({ at: new Date().toISOString(), result }), { expirationTtl: 60 * 60 * 24 * 14 });
  } catch { /* reporting must never break a refresh */ }
}

// ─── source refreshers ──────────────────────────────────────────────────────

/**
 * Fetch through a Service Binding when one is configured. Our own Workers on
 * *.sales-fd3.workers.dev answer a same-account workers.dev subrequest with a
 * 404 (measured on the edge), so wnba-api and propbet-news-api are reached via
 * [[services]] bindings; the URL is kept for routing and error messages.
 */
async function fetchText(url, init = {}, service = null) {
  const request = new Request(url, { ...init, headers: { 'User-Agent': 'pbe-entity-hub/search (+https://propbetedge.ai)', ...(init.headers || {}) } });
  const res = service && typeof service.fetch === 'function' ? await service.fetch(request) : await fetch(request);
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
  const payload = JSON.parse(await fetchText(`${WNBA_API}/v1/players`, { headers: { Accept: 'application/json' } }, env.WNBA_API_SERVICE));
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
async function fetchNewsPage(env, page) {
  const text = await fetchText(`${NEWS_API}/news?limit=${NEWS_PAGE_SIZE}&page=${page}`, {
    headers: { Accept: 'application/json', Origin: 'https://propbetedge.ai' },
  }, env.NEWS_API_SERVICE);
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
    const r = await fetchNewsPage(env, page);
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
    const r = await fetchNewsPage(env, page);
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
  invalidateTiers();
  return report;
}
