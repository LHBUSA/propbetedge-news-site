/**
 * pbe-entity-hub — PropBetEdge cross-sport entity snapshot service.
 *
 * READ PATH  (what a page render touches)
 *   GET /v1/snapshot/player/{sport}/{id}
 *   GET /v1/snapshot/team/{sport}/{slug}
 *   One KV read. No upstream call. No adapter work. A page render is never
 *   responsible for rebuilding a snapshot — that is the whole point of this
 *   service, and it is why Googlebot never waits on five sport backends.
 *
 * WRITE PATH (scheduled, or an explicitly triggered backfill)
 *   adapter fetch -> normalize -> validate -> write ONLY if valid
 *   A failed or empty upstream never overwrites a good snapshot. The previous
 *   value survives and simply ages into STALE, because a slightly old profile
 *   is worth far more than an empty one.
 *
 * The entity dictionary remains the identity spine: every id and slug this
 * service knows about comes from src/entity-graph/dictionary.js. The hub
 * enriches entities; it does not register them.
 */

import { allPlayers, allTeams, SUPPORTED_SPORTS } from '../../../src/entity-graph/entities.js';
import {
  validatePlayerSnapshot, validateTeamSnapshot, completeness, freshnessOf, FRESHNESS,
} from '../../../src/entity-hub/contract.js';
import { refreshPlayer, refreshTeam, teamRefreshTargets } from '../../../src/entity-hub/refresh.js';

const SCHEMA_VERSION = 'pbe-entity-hub/1';
const HUB_ORIGINS = [
  'https://propbetedge.ai',
  'https://www.propbetedge.ai',
];
const PREVIEW_ORIGIN = /^https:\/\/propbetedge-news-site(?:-[a-z0-9-]+)?-justins-projects-ad4f4bb7\.vercel\.app$/;

// ─── keys ────────────────────────────────────────────────────────────────────

export function playerKey(sport, id) { return `player:${sport}:${id}`; }
export function teamKey(sport, slug) { return `team:${sport}:${slug}`; }
export function cursorKey(sport, kind) { return `cursor:${kind}:${sport}`; }
export function reportKey(runId) { return `report:${runId}`; }

// ─── envelope ────────────────────────────────────────────────────────────────

/**
 * Everything stored alongside the snapshot so a row can answer, on its own,
 * where it came from, when, how fresh it is and whether it changed.
 */
export async function envelope(snapshot, { route, sourceIds = [] }) {
  const now = new Date();
  const observedAt = snapshot.source?.observed_at || now.toISOString();
  const ttlS = snapshot.source?.ttl_s ?? 900;
  const staleAfterS = snapshot.source?.stale_after_s ?? 86400;

  return {
    schema_version: SCHEMA_VERSION,
    kind: snapshot.kind,
    sport: snapshot.sport,
    entity_id: snapshot.kind === 'player' ? snapshot.player_id : snapshot.slug,
    source_product: snapshot.source?.product || null,
    source_route: route || null,
    source_ids: sourceIds,
    observed_at: observedAt,
    fetched_at: now.toISOString(),
    refreshed_at: now.toISOString(),
    expires_at: new Date(now.getTime() + ttlS * 1000).toISOString(),
    stale_at: new Date(now.getTime() + staleAfterS * 1000).toISOString(),
    freshness_state: FRESHNESS.CURRENT,
    completeness: completeness(snapshot),
    // Lets a refresh detect a no-op and keep the original refreshed_at, so
    // "last changed" stays meaningful instead of resetting every cron tick.
    source_hash: await hashSnapshot(snapshot),
    snapshot,
  };
}

async function hashSnapshot(snapshot) {
  const stable = JSON.stringify(snapshot, (key, value) => {
    // Timestamps change every fetch and would defeat change detection.
    if (key === 'observed_at' || key === 'refreshed_at') return undefined;
    return value;
  });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(stable));
  return [...new Uint8Array(digest)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Freshness is recomputed on read; a stored row must never claim to be fresh. */
function withLiveFreshness(record) {
  if (!record?.snapshot) return record;
  const state = freshnessOf(record.snapshot.source);
  return { ...record, freshness_state: state };
}

// ─── HTTP ────────────────────────────────────────────────────────────────────

function cors(origin) {
  const allowed = origin && (HUB_ORIGINS.includes(origin) || PREVIEW_ORIGIN.test(origin))
    ? origin
    : HUB_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

function json(body, { status = 200, origin, maxAge = 60 } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${maxAge}, s-maxage=${maxAge}`,
      'X-Content-Type-Options': 'nosniff',
      ...cors(origin),
    },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    if (request.method !== 'GET' && path !== '/v1/admin/refresh') {
      return json({ ok: false, error: 'method_not_allowed' }, { status: 405, origin });
    }

    if (path === '/' || path === '/v1/health') {
      return json({
        ok: true,
        service: 'pbe-entity-hub',
        schema_version: SCHEMA_VERSION,
        sports: SUPPORTED_SPORTS,
        dictionary: Object.fromEntries(SUPPORTED_SPORTS.map((s) => [s, {
          players: allPlayers(s).length,
          teams: allTeams(s).length,
        }])),
        nfl_team_data: env.PROPSPORTS_API_KEY ? 'enabled' : 'awaiting key',
      }, { origin, maxAge: 30 });
    }

    const playerMatch = path.match(/^\/v1\/snapshot\/player\/([a-z]+)\/(\d+)$/);
    if (playerMatch) return readSnapshot(env, playerKey(playerMatch[1], playerMatch[2]), origin);

    const teamMatch = path.match(/^\/v1\/snapshot\/team\/([a-z]+)\/([a-z0-9-]+)$/);
    if (teamMatch) return readSnapshot(env, teamKey(teamMatch[1], teamMatch[2]), origin);

    // Bulk read for the sitemap and search index: identity + completeness only.
    const indexMatch = path.match(/^\/v1\/index\/([a-z]+)$/);
    if (indexMatch) return readIndex(env, indexMatch[1], url, origin);

    if (path === '/v1/admin/refresh') return adminRefresh(request, env, ctx, origin);

    return json({ ok: false, error: 'not_found' }, { status: 404, origin });
  },

  /**
   * Scheduled refresh. Cron expressions are staggered per sport in
   * wrangler.toml; each tick walks a bounded slice of the dictionary and
   * advances a cursor, so a run is never unbounded and a sport is never
   * starved by another sport's failures.
   */
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runScheduledRefresh(event, env));
  },
};

async function readSnapshot(env, key, origin) {
  const raw = await env.ENTITY_KV.get(key, 'json');
  if (!raw) return json({ ok: false, error: 'no_snapshot', key }, { status: 404, origin });
  const record = withLiveFreshness(raw);
  return json({ ok: true, ...record }, {
    origin,
    // A CURRENT snapshot can be cached at the edge; an expired one should be
    // revalidated more eagerly so a recovered backend shows up quickly.
    maxAge: record.freshness_state === FRESHNESS.CURRENT ? 300 : 60,
  });
}

async function readIndex(env, sport, url, origin) {
  if (!SUPPORTED_SPORTS.includes(sport)) {
    return json({ ok: false, error: 'unsupported_sport' }, { status: 400, origin });
  }
  const kind = url.searchParams.get('kind') === 'team' ? 'team' : 'player';
  const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get('limit')) || 1000));
  const cursor = url.searchParams.get('cursor') || undefined;

  const listing = await env.ENTITY_KV.list({ prefix: `${kind}:${sport}:`, limit, cursor });
  return json({
    ok: true,
    sport,
    kind,
    count: listing.keys.length,
    cursor: listing.list_complete ? null : listing.cursor,
    keys: listing.keys.map((k) => k.name.split(':').slice(2).join(':')),
  }, { origin, maxAge: 600 });
}

/**
 * Manual refresh, for the initial backfill and for re-running one sport.
 * Requires the admin token; the token is a Worker secret and is compared in
 * constant time so this endpoint cannot be used as an oracle.
 */
async function adminRefresh(request, env, ctx, origin) {
  const provided = request.headers.get('X-Hub-Admin-Token') || '';
  if (!env.HUB_ADMIN_TOKEN || !timingSafeEqual(provided, env.HUB_ADMIN_TOKEN)) {
    return json({ ok: false, error: 'unauthorized' }, { status: 401, origin });
  }

  const url = new URL(request.url);
  const sport = String(url.searchParams.get('sport') || '').toLowerCase();
  const kind = url.searchParams.get('kind') === 'team' ? 'team' : 'player';
  const limit = Math.min(400, Math.max(1, Number(url.searchParams.get('limit')) || 50));
  const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);

  if (!SUPPORTED_SPORTS.includes(sport)) {
    return json({ ok: false, error: 'unsupported_sport' }, { status: 400, origin });
  }

  const report = await refreshSlice(env, { sport, kind, limit, offset });
  return json({ ok: true, ...report }, { origin, maxAge: 0 });
}

// ─── refresh ─────────────────────────────────────────────────────────────────

const SPORT_BY_MINUTE = { 0: 'nhl', 15: 'mlb', 30: 'nba', 45: 'nfl' };

async function runScheduledRefresh(event, env) {
  const minute = new Date(event.scheduledTime).getUTCMinutes();
  const sport = SPORT_BY_MINUTE[minute] ?? SUPPORTED_SPORTS[minute % SUPPORTED_SPORTS.length];

  // Teams are few and change slowly; refresh them all, then a player slice.
  await refreshSlice(env, { sport, kind: 'team', limit: 40, offset: 0 });

  const cursorRaw = await env.ENTITY_KV.get(cursorKey(sport, 'player'), 'json');
  const offset = Number(cursorRaw?.offset) || 0;
  const slice = await refreshSlice(env, { sport, kind: 'player', limit: 60, offset });

  const total = allPlayers(sport).length;
  const next = offset + slice.attempted >= total ? 0 : offset + slice.attempted;
  await env.ENTITY_KV.put(cursorKey(sport, 'player'), JSON.stringify({
    offset: next, updated_at: new Date().toISOString(), last_run: slice,
  }));
}

/**
 * Refresh a bounded slice. Every outcome is counted — written, unchanged,
 * invalid, upstream failure, preserved — so a backfill report never has an
 * unexplained total.
 */
export async function refreshSlice(env, { sport, kind, limit, offset }) {
  const started = Date.now();
  const targets = kind === 'team'
    ? teamRefreshTargets(sport).slice(offset, offset + limit)
    : allPlayers(sport).slice(offset, offset + limit).map((p) => ({ id: p.id, name: p.name }));

  const counts = {
    attempted: targets.length,
    written: 0,
    unchanged: 0,
    invalid: 0,
    upstream_failed: 0,
    preserved_last_known_good: 0,
    full: 0,
    partial: 0,
    identity_only: 0,
  };
  const problems = [];

  for (const target of targets) {
    const key = kind === 'team' ? teamKey(sport, target.slug) : playerKey(sport, target.id);
    try {
      const result = kind === 'team'
        ? await refreshTeam(sport, target, { env })
        : await refreshPlayer(sport, target.id, { env });

      if (!result?.snapshot) {
        counts.upstream_failed += 1;
        if (await env.ENTITY_KV.get(key)) counts.preserved_last_known_good += 1;
        problems.push({ key, reason: result?.reason || 'no_snapshot' });
        continue;
      }

      const validation = kind === 'team'
        ? validateTeamSnapshot(result.snapshot)
        : validatePlayerSnapshot(result.snapshot);
      if (!validation.ok) {
        counts.invalid += 1;
        if (await env.ENTITY_KV.get(key)) counts.preserved_last_known_good += 1;
        problems.push({ key, reason: validation.problems.join(',') });
        continue;
      }

      const next = await envelope(result.snapshot, { route: result.route, sourceIds: result.sourceIds });
      const existing = await env.ENTITY_KV.get(key, 'json');

      if (existing?.source_hash === next.source_hash) {
        // Nothing changed upstream. Keep the original refreshed_at so "last
        // changed" stays honest, but move the freshness window forward.
        counts.unchanged += 1;
        await env.ENTITY_KV.put(key, JSON.stringify({
          ...existing,
          fetched_at: next.fetched_at,
          expires_at: next.expires_at,
          stale_at: next.stale_at,
          observed_at: next.observed_at,
        }));
      } else {
        counts.written += 1;
        await env.ENTITY_KV.put(key, JSON.stringify(next));
      }
      counts[next.completeness] = (counts[next.completeness] || 0) + 1;
    } catch (error) {
      counts.upstream_failed += 1;
      if (await env.ENTITY_KV.get(key)) counts.preserved_last_known_good += 1;
      problems.push({ key, reason: String(error?.message || error).slice(0, 140) });
    }
  }

  const report = {
    sport,
    kind,
    offset,
    duration_ms: Date.now() - started,
    ...counts,
    problems: problems.slice(0, 40),
    finished_at: new Date().toISOString(),
  };
  await env.ENTITY_KV.put(reportKey(`${sport}:${kind}:${offset}`), JSON.stringify(report), {
    expirationTtl: 60 * 60 * 24 * 14,
  });
  return report;
}

function timingSafeEqual(a, b) {
  const left = new TextEncoder().encode(String(a));
  const right = new TextEncoder().encode(String(b));
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}
