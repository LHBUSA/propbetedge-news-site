/**
 * src/entity-hub/adapters/nfl.js
 *
 * NFL adapter — two upstreams, both PropBetEdge-owned:
 *
 *   PLAYER  nfl.propbetedge.ai/api/player-career  (open, no key)
 *           contract `player-career/v1` r1.1 — the richest career history in
 *           the network: per-season lines, a real game log, and an explicit
 *           coverage block that says what it does and does not know.
 *
 *   TEAM    propsports-api /v1/nfl/{teams,standings,team/:id/roster,…}
 *           key-gated. The key lives as a Worker secret and is passed in by
 *           the caller; it is never read from a committed file and never
 *           reaches Vercel or the browser.
 *
 * Without the key the adapter returns player snapshots normally and team
 * snapshots at identity level, so the NFL team hub is thin rather than broken.
 *
 * Ids are ESPN athlete ids — the same ids in the entity dictionary.
 */

import {
  playerSnapshot, teamSnapshot, rosterEntry, statGroup, provenance,
} from '../contract.js';
import { resolveTeam } from '../../entity-graph/entities.js';

export const CAREER_API = 'https://nfl.propbetedge.ai/api/player-career';
export const PROPSPORTS = 'https://propsports-api.sales-fd3.workers.dev';
export const PLAYER_PRODUCT = 'nfl.propbetedge.ai';
export const TEAM_PRODUCT = 'propsports-api';

export function playerUrl(espnId) {
  return `${CAREER_API}?espn_id=${encodeURIComponent(espnId)}`;
}

export function teamsUrl() { return `${PROPSPORTS}/v1/nfl/teams`; }
export function standingsUrl() { return `${PROPSPORTS}/v1/nfl/standings`; }
export function rosterUrl(teamId) { return `${PROPSPORTS}/v1/nfl/team/${teamId}/roster`; }
export function scheduleUrl(teamId) { return `${PROPSPORTS}/v1/nfl/team/${teamId}/schedule`; }

/**
 * Auth header for the key-gated PropSports routes.
 * The key is supplied by the runtime (a Cloudflare Worker secret). It is never
 * defaulted, logged or embedded — an absent key simply means no team data.
 */
export function propsportsHeaders(apiKey) {
  const headers = { Accept: 'application/json' };
  if (apiKey) headers['X-API-Key'] = apiKey;
  return headers;
}

function playerSource(urls, observedAt) {
  return provenance({
    product: PLAYER_PRODUCT,
    source: 'PropBetEdge NFL career history',
    source_urls: urls,
    schema: 'player-career/v1',
    observed_at: observedAt || new Date().toISOString(),
    ttl_s: 1800,
    stale_after_s: 86400,
  });
}

function teamSource(urls, observedAt) {
  return provenance({
    product: TEAM_PRODUCT,
    source: 'PropSports NFL',
    source_urls: urls,
    schema: 'propsports-nfl/v1',
    observed_at: observedAt || new Date().toISOString(),
    ttl_s: 1800,
    stale_after_s: 86400,
  });
}

/**
 * `player-career/v1` -> normalized player snapshot.
 *
 * The contract's own `history_state` (CAREER / TRACKED_HISTORY / ROOKIE) is
 * carried through as the career label rather than being flattened to "career",
 * because TRACKED HISTORY means "everything we track", not "everything he did".
 */
export function normalizePlayer(payload, { espnId, urls = [] } = {}) {
  const p = payload?.player;
  if (!p?.name) return null;
  const id = String(p.espn_id || espnId || '');
  if (!/^\d+$/.test(id)) return null;

  const stats = {};
  const seasons = Array.isArray(payload.seasons) ? payload.seasons : [];

  // coverage.current_season is an OBJECT ({season, available, reason}), and the
  // seasons array is newest-first. Reading it as a number and taking slice(-1)
  // silently produced Lamar Jackson's 2018 rookie line as his current season,
  // so the current season is chosen by max year rather than by array position.
  const currentSeasonYear = payload.coverage?.current_season?.season
    ?? (typeof payload.coverage?.current_season === 'number' ? payload.coverage.current_season : null);

  const regularSeasons = seasons.filter((s) => s.season_type === 'REG');
  const current = regularSeasons.find((s) => s.season === currentSeasonYear)
    || regularSeasons.reduce((best, s) => (!best || s.season > best.season ? s : best), null);
  if (current) {
    stats.season = statGroup({
      label: 'Regular season',
      season: String(current.season),
      stats: stripNulls(current),
      note: current.provisional ? 'Provisional: the season is still in progress.' : null,
    });
  }

  const totals = payload.totals?.regular_season;
  if (totals && Object.keys(totals).length) {
    stats.career = statGroup({
      label: payload.display_label || payload.label || 'Career',
      season: payload.career_span ? `${payload.career_span.from}–${payload.career_span.to}` : null,
      stats: stripNulls(totals),
      note: payload.history_state === 'TRACKED_HISTORY'
        ? 'Tracked history: complete for the seasons PropBetEdge covers.'
        : null,
    });
  }

  const log = Array.isArray(payload.game_log) ? payload.game_log : [];
  if (log.length) {
    // game_log is newest-first; take from the front, do not reverse.
    const recent = log.slice(0, 10);
    stats.games = recent.map((g) => ({
      date: g.date || null,
      opponent: g.opponent || null,
      home_road: g.home === true ? 'home' : g.home === false ? 'road' : null,
      result: g.result || null,
      week: g.week ?? null,
      season: g.season ?? null,
      stats: stripNulls(g.stats || {}),
    }));
    stats.recent = {
      last5: statGroup({ label: 'Last 5 games', stats: aggregate(recent.slice(0, 5).map((g) => g.stats)) }),
      last10: statGroup({ label: 'Last 10 games', stats: aggregate(recent.map((g) => g.stats)) }),
    };
  }

  return playerSnapshot({
    sport: 'nfl',
    player_id: id,
    name: p.name,
    team: teamRef(p.current_team),
    position: p.position || '',
    jersey: null, // not in this contract; not invented
    photo: `https://a.espncdn.com/i/headshots/nfl/players/full/${id}.png`,
    bio: {
      // The career contract is an identity-and-history surface, not a bio one.
      // Height/weight/age stay null rather than being sourced from somewhere
      // this adapter is not allowed to reach.
      experience: payload.career_span?.from ? `Since ${payload.career_span.from}` : null,
    },
    stats,
    status: p.active === false ? { active: false, label: 'Inactive' } : null,
    special_metrics: payload.coverage
      ? {
          history_state: payload.history_state || null,
          seasons_covered: payload.coverage.seasons_covered ?? null,
          complete: payload.coverage.complete ?? null,
        }
      : null,
    source: playerSource(urls.length ? urls : [playerUrl(id)], payload.last_updated),
  });
}

export function normalizeRoster(payload) {
  const rows = Array.isArray(payload?.roster) ? payload.roster
    : Array.isArray(payload?.athletes) ? payload.athletes
      : Array.isArray(payload?.players) ? payload.players : [];
  return rows
    .filter((a) => a?.id && (a.fullName || a.displayName || a.name))
    .map((a) => rosterEntry({
      sport: 'nfl',
      player_id: a.id,
      name: a.fullName || a.displayName || a.name,
      position: a.position?.abbreviation || a.position || '',
      jersey: a.jersey ?? null,
      photo: `https://a.espncdn.com/i/headshots/nfl/players/full/${a.id}.png`,
    }));
}

export function normalizeStandingsRow(payload, espnTeamId) {
  const wanted = String(espnTeamId);
  const rows = Array.isArray(payload?.standings) ? payload.standings
    : Array.isArray(payload?.teams) ? payload.teams : [];
  const row = rows.find((r) => String(r?.team?.id ?? r?.id ?? '') === wanted);
  if (!row) return null;

  const wins = row.wins ?? row.record?.wins ?? null;
  const losses = row.losses ?? row.record?.losses ?? null;
  const ties = row.ties ?? row.record?.ties ?? null;
  return {
    record: {
      wins, losses, ties,
      summary: wins != null && losses != null ? `${wins}-${losses}${ties ? `-${ties}` : ''}` : null,
    },
    standings: {
      conference: row.conference ?? null,
      division: row.division ?? null,
      division_rank: row.division_rank ?? row.playoffSeed ?? null,
      as_of: payload?.fetched_at ?? null,
    },
    recent_form: { streak: row.streak ?? null },
  };
}

export function buildTeam({ slug, rosterPayload = null, standingsPayload = null, espnTeamId = null, urls = [] }) {
  const dictTeam = resolveTeam('nfl', slug);
  if (!dictTeam) return null;
  const standing = standingsPayload && espnTeamId
    ? normalizeStandingsRow(standingsPayload, espnTeamId)
    : null;

  return teamSnapshot({
    sport: 'nfl',
    team_id: dictTeam.id,
    slug: dictTeam.slug,
    name: dictTeam.name,
    abbreviation: dictTeam.abbr,
    logo: dictTeam.logo_url,
    league_context: {
      conference: standing?.standings?.conference ?? null,
      division: standing?.standings?.division ?? null,
    },
    record: standing?.record ?? null,
    standings: standing?.standings ?? null,
    recent_form: standing?.recent_form ?? null,
    roster: rosterPayload ? normalizeRoster(rosterPayload) : [],
    source: teamSource(urls, null),
  });
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function teamRef(abbrev) {
  if (!abbrev) return null;
  const team = resolveTeam('nfl', abbrev);
  if (!team) return null;
  return {
    id: team.abbr,
    slug: team.slug,
    name: team.name,
    abbr: team.abbr,
    logo: team.logo_url,
    path: team.path,
  };
}

/** Drop nulls so a stat card never renders an empty column as a real zero. */
function stripNulls(object) {
  const out = {};
  for (const [key, value] of Object.entries(object || {})) {
    if (value === null || value === undefined) continue;
    if (['season', 'season_type', 'teams', 'provisional'].includes(key)) continue;
    out[key] = value;
  }
  return out;
}

function aggregate(statObjects) {
  const totals = {};
  for (const stat of statObjects) {
    for (const [key, value] of Object.entries(stat || {})) {
      if (typeof value !== 'number') continue;
      // Rate columns cannot be summed; they are recomputed by the page or
      // omitted, never added together.
      if (['cmp_pct', 'ypa', 'ypc', 'ypr', 'rating'].includes(key)) continue;
      totals[key] = Math.round(((totals[key] || 0) + value) * 100) / 100;
    }
  }
  totals.games = statObjects.length;
  return totals;
}
