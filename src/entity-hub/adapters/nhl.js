/**
 * src/entity-hub/adapters/nhl.js
 *
 * NHL adapter — reads the NHL PropBetEdge gateway (`nhl-gateway-v1`), which is
 * the product's own normalized surface over NHL api-web.
 *
 * Two reasons this is the cleanest source in the network:
 *   - it already carries provenance (`source`, `source_urls`, `fetched_at`)
 *     and freshness (`ttl_s`, `stale_after_s`), so none of that is invented here
 *   - its `allowedOrigin` already whitelists HUB_ORIGIN = https://propbetedge.ai,
 *     so the hub is an authorized caller today, with no key and no new gate
 *
 * Player ids are NHL api-web ids — the same ids src/entity-graph/dictionary.js
 * emits and /player/nhl/:id resolves against.
 */

import {
  playerSnapshot, teamSnapshot, rosterEntry, statGroup, provenance,
} from '../contract.js';
import { resolveTeam } from '../../entity-graph/entities.js';

export const NHL_GATEWAY = 'https://nhl-api.propbetedge.ai';
export const PRODUCT = 'nhl.propbetedge.ai';

/** The gateway is origin-gated; the hub is an allowed origin. */
export function gatewayHeaders() {
  return {
    Accept: 'application/json',
    Origin: 'https://propbetedge.ai',
    Referer: 'https://propbetedge.ai/',
  };
}

function sourceFrom(payload, fallbackUrl) {
  return provenance({
    product: PRODUCT,
    source: payload?.source || 'NHL',
    source_urls: payload?.source_urls?.length ? payload.source_urls : [fallbackUrl],
    schema: payload?.schema || 'nhl-gateway-v1',
    observed_at: payload?.fetched_at,
    ttl_s: payload?.ttl_s ?? 900,
    stale_after_s: payload?.stale_after_s ?? 3600,
  });
}

/** Raw gateway player payload -> normalized player snapshot. */
export function normalizePlayer(payload, { url = `${NHL_GATEWAY}/nhl/player` } = {}) {
  const p = payload?.player;
  if (!p?.id || !p?.full_name) return null;

  const team = teamRefFromAbbrev(p.current_team_abbrev, p.current_team_name, p.team_logo);

  const stats = {};
  // featured_stats.regularSeason.subSeason is the current season line.
  const featured = p.featured_stats?.regularSeason?.subSeason;
  if (featured && Object.keys(featured).length) {
    stats.season = statGroup({
      label: 'Regular season',
      season: formatSeason(p.featured_stats?.season),
      stats: featured,
    });
  }
  if (p.career_totals?.regularSeason && Object.keys(p.career_totals.regularSeason).length) {
    stats.career = statGroup({ label: 'Career', season: null, stats: p.career_totals.regularSeason });
  }
  if (Array.isArray(p.last_5_games) && p.last_5_games.length) {
    stats.recent = { last5: statGroup({ label: 'Last 5 games', stats: aggregate(p.last_5_games) }) };
    stats.games = p.last_5_games.slice(0, 10).map((g) => ({
      date: g.gameDate || null,
      opponent: g.opponentAbbrev || null,
      home_road: g.homeRoadFlag || null,
      result: g.decision || null,
      stats: g,
    }));
  }

  return playerSnapshot({
    sport: 'nhl',
    player_id: p.id,
    name: p.full_name,
    team,
    position: p.position || '',
    jersey: p.sweater_number ?? null,
    photo: p.headshot || null,
    bio: {
      height: p.height_inches ? `${Math.floor(p.height_inches / 12)}' ${p.height_inches % 12}"` : null,
      weight: p.weight_pounds ? `${p.weight_pounds} lbs` : null,
      age: ageFrom(p.birth_date),
      birth_date: p.birth_date || null,
      birth_place: [p.birth_city, p.birth_country].filter(Boolean).join(', ') || null,
      throws: p.shoots_catches || null,
    },
    stats,
    status: p.is_active === false ? { active: false, label: 'Inactive' } : null,
    source: sourceFrom(payload, url),
  });
}

/** Raw gateway roster payload -> roster entries plus the team identity. */
export function normalizeRoster(payload, { url = `${NHL_GATEWAY}/nhl/team` } = {}) {
  const players = Array.isArray(payload?.players) ? payload.players : [];
  return {
    team_abbrev: payload?.team || null,
    season: payload?.season || null,
    roster: players
      .filter((p) => p?.id && (p.full_name || p.last_name))
      .map((p) => rosterEntry({
        sport: 'nhl',
        player_id: p.id,
        name: p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim(),
        position: p.position || '',
        jersey: p.sweater_number ?? null,
        photo: p.headshot || null,
      })),
    source: sourceFrom(payload, url),
  };
}

/**
 * Standings row for one team. The gateway returns the whole league, so the
 * caller passes the abbreviation it wants rather than fetching 32 times.
 */
export function normalizeStandingsRow(payload, abbrev) {
  const rows = Array.isArray(payload?.standings) ? payload.standings : [];
  const wanted = String(abbrev || '').toUpperCase();
  const row = rows.find((r) => String(r.team || '').toUpperCase() === wanted);
  if (!row) return null;

  const summary = [row.wins, row.losses, row.ot_losses].every((v) => v != null)
    ? `${row.wins}-${row.losses}-${row.ot_losses}`
    : null;

  return {
    record: {
      wins: row.wins ?? null,
      losses: row.losses ?? null,
      ot_losses: row.ot_losses ?? null,
      points: row.points ?? null,
      games_played: row.games_played ?? null,
      goals_for: row.goals_for ?? null,
      goals_against: row.goals_against ?? null,
      goal_diff: row.goal_diff ?? null,
      summary,
    },
    standings: {
      conference: row.conference ?? null,
      division: row.division ?? null,
      division_rank: row.division_seq ?? null,
      conference_rank: row.conference_seq ?? null,
      league_rank: row.league_seq ?? null,
      points_percentage: row.point_pct ?? null,
      clinched: row.clinch || null,
      // The provider dates its own standings row; carry it rather than
      // implying these numbers are from this minute.
      as_of: row.date ?? null,
    },
    recent_form: {
      last10: row.l10 ?? null,
      streak: row.streak ?? null,
      home: row.home ?? null,
      road: row.road ?? null,
    },
  };
}

/** Assemble a team snapshot from the gateway's roster + standings payloads. */
export function buildTeam({ slug, rosterPayload, standingsPayload, abbrev }) {
  const dictTeam = resolveTeam('nhl', abbrev || slug);
  if (!dictTeam) return null;

  const roster = normalizeRoster(rosterPayload);
  const standing = standingsPayload ? normalizeStandingsRow(standingsPayload, abbrev || dictTeam.abbr) : null;

  return teamSnapshot({
    sport: 'nhl',
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
    roster: roster.roster,
    source: roster.source,
  });
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function teamRefFromAbbrev(abbrev, name, logo) {
  if (!abbrev) return null;
  // Join through the dictionary so the team link is the canonical site route,
  // never a slug invented from whatever string the provider happened to send.
  const team = resolveTeam('nhl', abbrev);
  if (!team) return null;
  return {
    id: team.abbr,
    slug: team.slug,
    name: name || team.name,
    abbr: team.abbr,
    logo: logo || team.logo_url,
    path: team.path,
  };
}

/** 20252026 -> "2025-26" */
function formatSeason(value) {
  const s = String(value || '');
  if (!/^\d{8}$/.test(s)) return null;
  return `${s.slice(0, 4)}-${s.slice(6, 8)}`;
}

function ageFrom(birthDate) {
  if (!birthDate) return null;
  const born = new Date(`${birthDate}T00:00:00Z`);
  if (!Number.isFinite(born.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - born.getUTCFullYear();
  const beforeBirthday = now.getUTCMonth() < born.getUTCMonth()
    || (now.getUTCMonth() === born.getUTCMonth() && now.getUTCDate() < born.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 && age < 120 ? age : null;
}

/** Sum the numeric columns of a game list; never invent a column. */
function aggregate(games) {
  const totals = {};
  for (const game of games) {
    for (const [key, value] of Object.entries(game || {})) {
      if (typeof value !== 'number') continue;
      totals[key] = (totals[key] || 0) + value;
    }
  }
  totals.games = games.length;
  return totals;
}
