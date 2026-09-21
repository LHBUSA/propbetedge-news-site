/**
 * src/entity-hub/adapters/nba.js
 *
 * NBA adapter — reads the NBA product's own relay
 * (`nba.propbetedge.ai/api/nba-provider?r=…`).
 *
 * The relay exists because ESPN answers Cloudflare egress with 403 while
 * answering Vercel; the NBA product already solved that and owns the transport
 * rules. The hub therefore calls the relay and never talks to ESPN itself —
 * raw provider behaviour stays behind the product that abstracts it.
 *
 * What the relay does NOT expose is a season-stats route. Rather than invent
 * one, this adapter derives the season line by aggregating the game log and
 * labels it as derived. When the log is empty — the preseason case — the
 * profile is honestly identity-and-bio rather than a page of zeroes.
 *
 * Athlete ids are ESPN athlete ids: the same ids in the entity dictionary.
 */

import {
  playerSnapshot, teamSnapshot, rosterEntry, statGroup, provenance,
} from '../contract.js';
import { resolveTeam } from '../../entity-graph/entities.js';

export const RELAY = 'https://nba.propbetedge.ai/api/nba-provider';
export const PRODUCT = 'nba.propbetedge.ai';

export function relayUrl(route, params = {}) {
  const query = new URLSearchParams({ r: route, ...params });
  return `${RELAY}?${query.toString()}`;
}

export function relayHeaders() {
  return { Accept: 'application/json', Origin: 'https://propbetedge.ai' };
}

function source(urls, observedAt) {
  return provenance({
    product: PRODUCT,
    source: 'ESPN via NBA PropBetEdge relay',
    source_urls: urls,
    schema: 'nba-provider/v1',
    observed_at: observedAt || new Date().toISOString(),
    ttl_s: 900,
    stale_after_s: 86400,
  });
}

export function normalizePlayer(payload, { gameLog = null, urls = [] } = {}) {
  const a = payload?.athlete || payload;
  if (!a?.id || !a?.displayName) return null;

  const stats = {};
  const games = normalizeGameLog(gameLog);
  if (games.length) {
    stats.games = games.slice(0, 10);
    stats.recent = {
      last5: statGroup({ label: 'Last 5 games', stats: aggregate(games.slice(0, 5)) }),
      last10: statGroup({ label: 'Last 10 games', stats: aggregate(games.slice(0, 10)) }),
    };
    const picked = pickSeasonType(gameLog);
    stats.season = statGroup({
      label: picked?.label || 'Regular season',
      season: picked?.season || null,
      stats: aggregate(games),
      // Said out loud because the relay has no season-stats route: this is a
      // sum of one season type's game log, not a figure the provider published.
      note: `Derived by summing the ${picked?.season || ''} ${(picked?.label || 'game log').toLowerCase()} log;`
        + ' the NBA relay exposes no season-stats route.',
    });
  }

  return playerSnapshot({
    sport: 'nba',
    player_id: a.id,
    name: a.displayName || a.fullName,
    team: teamRef(a.team),
    position: a.position?.abbreviation || '',
    jersey: a.jersey ?? null,
    photo: a.headshot?.href || `https://a.espncdn.com/i/headshots/nba/players/full/${a.id}.png`,
    bio: {
      height: a.displayHeight || null,
      weight: a.displayWeight || null,
      age: a.age ?? null,
      birth_date: a.displayDOB || null,
      birth_place: a.displayBirthPlace || null,
      experience: a.displayExperience || null,
    },
    stats,
    status: a.active === false ? { active: false, label: a.status?.name || 'Inactive' } : null,
    source: source(urls, null),
  });
}

/** ESPN game logs nest events under seasonTypes -> categories -> events. */
export function normalizeGameLog(gameLog) {
  const picked = pickSeasonType(gameLog);
  if (!picked) return [];

  const labels = Array.isArray(gameLog.labels) ? gameLog.labels : [];
  const eventsById = gameLog.events && typeof gameLog.events === 'object' ? gameLog.events : {};
  const out = [];

  for (const category of picked.seasonType.categories || []) {
    for (const event of category.events || []) {
      const meta = eventsById[event.eventId] || {};
      const values = Array.isArray(event.stats) ? event.stats : [];
      const stats = {};
      labels.forEach((label, index) => {
        const raw = values[index];
        // A blank cell is a stat that was not recorded. Number('') is 0, and a
        // fabricated zero in a stat line is worse than an absent one.
        if (raw == null || raw === '' || raw === '-') return;
        const numeric = Number(raw);
        stats[label] = Number.isFinite(numeric) ? numeric : raw;
      });
      out.push({
        date: meta.gameDate || null,
        opponent: meta.opponent?.displayName || null,
        home_road: meta.atVs === 'vs' ? 'home' : meta.atVs === '@' ? 'road' : null,
        result: meta.gameResult || null,
        score: meta.score || null,
        season: picked.season,
        season_type: picked.label,
        stats,
      });
    }
  }

  // Newest first, by the date the provider gave us rather than by array order.
  out.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  return out;
}

/**
 * Choose ONE season type and stay inside it.
 *
 * ESPN returns "2025-26 Regular Season" alongside "2025-26 Preseason" and,
 * in season, the playoffs. Walking every seasonType and concatenating - which
 * is what this did - silently summed preseason and playoff games into a single
 * figure labelled "Season to date". Regular season is preferred; otherwise the
 * first block with games, named honestly.
 */
export function pickSeasonType(gameLog) {
  const types = Array.isArray(gameLog?.seasonTypes) ? gameLog.seasonTypes : [];
  const withGames = types.filter((t) => (t.categories || []).some((c) => (c.events || []).length));
  if (!withGames.length) return null;

  const regular = withGames.find((t) => /regular season/i.test(t.displayName || ''));
  const seasonType = regular || withGames[0];
  const display = String(seasonType.displayName || '');
  const season = (display.match(/^(\d{4}(?:-\d{2})?)/) || [])[1] || null;
  const label = season ? display.slice(season.length).trim() : display;

  return { seasonType, season, label: label || 'Games' };
}

export function normalizeRoster(payload) {
  const athletes = Array.isArray(payload?.athletes) ? payload.athletes : [];
  return athletes
    .filter((a) => a?.id && (a.fullName || a.displayName))
    .map((a) => rosterEntry({
      sport: 'nba',
      player_id: a.id,
      name: a.fullName || a.displayName,
      position: a.position?.abbreviation || '',
      jersey: a.jersey ?? null,
      photo: a.headshot?.href || `https://a.espncdn.com/i/headshots/nba/players/full/${a.id}.png`,
    }));
}

/** Pull one team's row out of the conference-grouped standings payload. */
export function normalizeStandingsRow(payload, espnTeamId) {
  const wanted = String(espnTeamId);
  for (const child of payload?.children || []) {
    const entries = child?.standings?.entries || [];
    for (const entry of entries) {
      if (String(entry?.team?.id) !== wanted) continue;
      const stat = (name) => entry.stats?.find((s) => s.name === name || s.shortDisplayName === name);
      const wins = stat('wins')?.value ?? null;
      const losses = stat('losses')?.value ?? null;
      return {
        record: {
          wins,
          losses,
          winning_percentage: stat('winPercent')?.displayValue ?? null,
          games_played: wins != null && losses != null ? wins + losses : null,
          points_for: stat('avgPointsFor')?.displayValue ?? null,
          points_against: stat('avgPointsAgainst')?.displayValue ?? null,
          summary: wins != null && losses != null ? `${wins}-${losses}` : null,
        },
        standings: {
          conference: child?.name || null,
          division: null,
          conference_rank: stat('playoffSeed')?.value ?? null,
          games_back: stat('gamesBehind')?.displayValue ?? null,
          as_of: payload?.season?.year ? `season ${payload.season.year}` : null,
        },
        recent_form: {
          streak: stat('streak')?.displayValue ?? null,
          last10: stat('lastTenGames')?.displayValue ?? null,
          home: stat('home')?.displayValue ?? null,
          road: stat('road')?.displayValue ?? null,
        },
      };
    }
  }
  return null;
}

export function buildTeam({ slug, rosterPayload, standingsPayload, espnTeamId, urls = [] }) {
  const dictTeam = resolveTeam('nba', slug);
  if (!dictTeam) return null;
  const standing = standingsPayload && espnTeamId
    ? normalizeStandingsRow(standingsPayload, espnTeamId)
    : null;

  return teamSnapshot({
    sport: 'nba',
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
    source: source(urls, null),
  });
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function teamRef(team) {
  if (!team?.displayName && !team?.abbreviation) return null;
  const resolved = resolveTeam('nba', team.abbreviation || team.displayName);
  if (!resolved) return null;
  return {
    id: resolved.abbr,
    slug: resolved.slug,
    name: resolved.name,
    abbr: resolved.abbr,
    logo: resolved.logo_url,
    path: resolved.path,
    espn_team_id: team.id ?? null,
  };
}

function aggregate(games) {
  const totals = {};
  for (const game of games) {
    for (const [key, value] of Object.entries(game.stats || {})) {
      if (typeof value !== 'number') continue;
      totals[key] = Math.round(((totals[key] || 0) + value) * 100) / 100;
    }
  }
  totals.games = games.length;
  return totals;
}
