/**
 * NFL Team Snapshot V1 read-through.
 *
 * The NFL product already owns the public current-season authorities we need:
 *   nfl-api.propbetedge.ai/api/schedule      canonical 2026 schedule
 *   nfl-api.propbetedge.ai/api/standings     current division standings
 *   nfl-api.propbetedge.ai/api/scores        persisted FINAL/live score ledger
 *   nfl-api.propbetedge.ai/api/current-stats current-season box-score accumulator
 *   nfl.propbetedge.ai/api/nfl-live?event=   one game's normalized box score
 *
 * This module composes those existing PropBetEdge surfaces into the shared
 * entity-hub team contract. It deliberately does not depend on the old
 * PROPSPORTS_API_KEY. The committed entity dictionary remains the roster
 * identity spine so every player id resolves to the existing /player route.
 */

import { allPlayers, resolveTeam } from '../entity-graph/entities.js';
import {
  provenance, rosterEntry, scheduledGame, teamLeader,
} from './contract.js';

const GATEWAY = 'https://nfl-api.propbetedge.ai';
const LIVE_RELAY = 'https://nfl.propbetedge.ai/api/nfl-live';
const TIMEOUT_MS = 7000;

export function currentNflSeason(now = new Date()) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  return month <= 1 ? year - 1 : year;
}

async function fetchJson(url, { fetchImpl = fetch, timeoutMs = TIMEOUT_MS } = {}) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const response = await fetchImpl(url, {
      headers: { accept: 'application/json' },
      ...(controller ? { signal: controller.signal } : {}),
    });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    return await response.json();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function round1(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : null;
}

function pct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n.toFixed(3).replace(/^0/, '');
}

function kickoffOf(game) {
  if (!game) return null;
  if (typeof game.kickoff === 'object' && game.kickoff?.utc) return game.kickoff.utc;
  return game.kickoff || game.start_time || game.game_time || game.commence_time
    || game.datetime || game.date || null;
}

function venueOf(game) {
  if (typeof game?.venue === 'string') return game.venue || null;
  if (game?.venue?.status === 'VERIFIED') return game.venue.name || null;
  return game?.venue?.name || game?.stadium || null;
}

function sameTeam(value, abbr) {
  const resolved = resolveTeam('nfl', value);
  return resolved ? resolved.abbr === abbr : String(value || '').toUpperCase() === abbr;
}

function scoreKey(game) {
  return String(game?.espn_event_id || game?.game_id || game?.id || '');
}

function findScore(game, scores) {
  const id = scoreKey(game);
  if (id) {
    const exact = scores.find((s) => String(s?.game_id || s?.id || '') === id);
    if (exact) return exact;
  }
  const away = String(game?.away_team || game?.away || '').toUpperCase();
  const home = String(game?.home_team || game?.home || '').toUpperCase();
  return scores.find((s) => {
    if (away && home
      && String(s?.away_team || '').toUpperCase() === away
      && String(s?.home_team || '').toUpperCase() === home) {
      if (game?.week == null || s?.week == null) return true;
      return Number(game.week) === Number(s.week);
    }
    return false;
  }) || null;
}

function opponentRef(abbr) {
  const team = resolveTeam('nfl', abbr);
  return team ? {
    id: team.abbr,
    name: team.name,
    abbr: team.abbr,
    slug: team.slug,
    logo: team.logo_url,
  } : { id: abbr || null, name: abbr || null, abbr: abbr || null, slug: null, logo: null };
}

function normalizeTeamSchedule(schedulePayload, scorePayload, teamAbbr, now = Date.now()) {
  const rows = Array.isArray(schedulePayload?.games) ? schedulePayload.games : [];
  const scores = Array.isArray(scorePayload?.games) ? scorePayload.games : [];
  const recent = [];
  const upcoming = [];

  for (const raw of rows) {
    const away = String(raw?.away_team || raw?.away || '').toUpperCase();
    const home = String(raw?.home_team || raw?.home || '').toUpperCase();
    const isAway = sameTeam(away, teamAbbr);
    const isHome = sameTeam(home, teamAbbr);
    if (!isAway && !isHome) continue;

    const opponentAbbr = isAway ? home : away;
    const score = findScore(raw, scores);
    const semantics = String(score?.semantics || score?.status || '').toUpperCase();
    const isFinal = semantics === 'FINAL' || String(score?.status || '').toLowerCase() === 'final';
    const isLive = semantics === 'LIVE' || String(score?.status || '').toLowerCase() === 'live';
    const date = kickoffOf(raw) || score?.kickoff || null;

    const teamScore = isFinal || isLive
      ? Number(isAway ? score?.away_score : score?.home_score)
      : null;
    const opponentScore = isFinal || isLive
      ? Number(isAway ? score?.home_score : score?.away_score)
      : null;

    const game = scheduledGame({
      sport: 'nfl',
      game_id: raw?.espn_event_id || score?.game_id || raw?.game_id || raw?.id || null,
      date,
      home_away: isAway ? 'away' : 'home',
      opponent: opponentRef(opponentAbbr),
      status: isFinal ? 'Final' : isLive ? 'Live' : 'Scheduled',
      team_score: Number.isFinite(teamScore) ? teamScore : null,
      opponent_score: Number.isFinite(opponentScore) ? opponentScore : null,
      venue: venueOf(raw),
      is_final: isFinal,
    });

    if (isFinal) recent.push(game);
    else if (date && Date.parse(date) >= now - 6 * 3600000) upcoming.push(game);
  }

  recent.sort((a, b) => Date.parse(b.date || 0) - Date.parse(a.date || 0));
  upcoming.sort((a, b) => Date.parse(a.date || 0) - Date.parse(b.date || 0));
  return { recent: recent.slice(0, 5), upcoming: upcoming.slice(0, 5) };
}

function standingFor(payload, abbr) {
  for (const division of payload?.divisions || []) {
    const teams = Array.isArray(division?.teams) ? division.teams : [];
    const index = teams.findIndex((team) => sameTeam(team?.abbreviation || team?.display_name, abbr));
    if (index < 0) continue;
    return {
      row: teams[index],
      conference: division?.conference || null,
      division: division?.division || null,
      division_rank: index + 1,
      as_of: payload?.last_updated || null,
    };
  }
  return null;
}

function recordFromStanding(standing) {
  const row = standing?.row;
  if (!row) return null;
  const wins = Number(row.wins);
  const losses = Number(row.losses);
  const ties = Number(row.ties);
  const games = [wins, losses, ties].every(Number.isFinite)
    ? wins + losses + ties
    : Number(row.games_played);

  return {
    wins: Number.isFinite(wins) ? wins : null,
    losses: Number.isFinite(losses) ? losses : null,
    ties: Number.isFinite(ties) ? ties : null,
    games_played: Number.isFinite(games) ? games : null,
    winning_percentage: pct(row.win_pct),
    points_for: Number.isFinite(Number(row.points_for)) ? Number(row.points_for) : null,
    points_against: Number.isFinite(Number(row.points_against)) ? Number(row.points_against) : null,
    summary: row.record || (
      Number.isFinite(wins) && Number.isFinite(losses)
        ? `${wins}-${losses}${Number.isFinite(ties) && ties ? `-${ties}` : ''}`
        : null
    ),
  };
}

function teamStatsFromStanding(standing) {
  const row = standing?.row;
  const games = Number(row?.games_played);
  if (!row || !Number.isFinite(games) || games < 1) return null;
  const pf = Number(row.points_for);
  const pa = Number(row.points_against);
  const diff = Number(row.differential);
  return {
    games_played: games,
    points_per_game: Number.isFinite(pf) ? round1(pf / games) : null,
    points_allowed_per_game: Number.isFinite(pa) ? round1(pa / games) : null,
    point_differential: Number.isFinite(diff) ? diff : Number.isFinite(pf) && Number.isFinite(pa) ? pf - pa : null,
    points_for: Number.isFinite(pf) ? pf : null,
    points_against: Number.isFinite(pa) ? pa : null,
    win_percentage: pct(row.win_pct),
  };
}

function resultCode(game) {
  if (!game?.is_final || game.team_score == null || game.opponent_score == null) return null;
  const own = Number(game.team_score);
  const opp = Number(game.opponent_score);
  if (!Number.isFinite(own) || !Number.isFinite(opp)) return null;
  return own === opp ? 'T' : own > opp ? 'W' : 'L';
}

function recentForm(schedule) {
  const finals = (schedule?.recent || []).filter((g) => g?.is_final);
  if (!finals.length) return null;
  const codes = finals.slice(0, 10).map(resultCode).filter(Boolean);
  const wins = codes.filter((x) => x === 'W').length;
  const losses = codes.filter((x) => x === 'L').length;
  const ties = codes.filter((x) => x === 'T').length;

  const first = codes[0] || null;
  let streak = 0;
  if (first) {
    for (const code of codes) {
      if (code !== first) break;
      streak += 1;
    }
  }
  return {
    last10: codes.length ? `${wins}-${losses}${ties ? `-${ties}` : ''}` : null,
    streak: first && streak ? `${first}${streak}` : null,
  };
}

function dictionaryRoster(abbr) {
  return allPlayers('nfl')
    .filter((player) => String(player.team_id || '').toUpperCase() === abbr)
    .map((player) => rosterEntry({
      sport: 'nfl',
      player_id: player.id,
      name: player.name,
      position: player.position || '',
      jersey: null,
      photo: player.image_url || null,
    }));
}

const LEADER_GROUPS = [
  ['passing', 'Passing yards', 'YDS'],
  ['rushing', 'Rushing yards', 'YDS'],
  ['receiving', 'Receiving yards', 'YDS'],
];

function seasonLeaders(payload, abbr) {
  const result = [];
  for (const [category, label, unit] of LEADER_GROUPS) {
    const rows = payload?.categories?.[category]?.leaders || [];
    const row = rows.find((leader) => sameTeam(leader?.team, abbr));
    if (!row?.id || !row?.player) continue;
    result.push(teamLeader({
      sport: 'nfl',
      player_id: row.id,
      name: row.player,
      category,
      label: `Season ${label.toLowerCase()} leader`,
      value: Number.isFinite(Number(row.yards)) ? Number(row.yards) : row.yards ?? null,
      unit,
      rank: 1,
      photo: row.headshot || null,
      derived: true,
    }));
  }
  return result;
}

function gameLeaders(detail, abbr, existing = []) {
  const have = new Set(existing.map((leader) => leader.category));
  const block = (detail?.player_stats || []).find((row) => sameTeam(row?.team?.abbreviation, abbr));
  if (!block) return existing;

  const out = [...existing];
  for (const [category, label, unit] of LEADER_GROUPS) {
    if (have.has(category)) continue;
    const group = (block.groups || []).find((g) => String(g?.name || '').toLowerCase() === category);
    if (!group) continue;
    const labels = Array.isArray(group.labels) ? group.labels : [];
    const yardsIndex = labels.findIndex((x) => String(x).toUpperCase() === 'YDS');
    if (yardsIndex < 0) continue;

    const candidates = (group.athletes || [])
      .filter((row) => !row?.did_not_play && row?.athlete?.id && row?.athlete?.name)
      .map((row) => ({
        row,
        yards: Number(Array.isArray(row.stats) ? row.stats[yardsIndex] : null),
      }))
      .filter((x) => Number.isFinite(x.yards))
      .sort((a, b) => b.yards - a.yards);

    const best = candidates[0];
    if (!best) continue;
    out.push(teamLeader({
      sport: 'nfl',
      player_id: best.row.athlete.id,
      name: best.row.athlete.name,
      category,
      label: `Latest game ${label.toLowerCase()} leader`,
      value: best.yards,
      unit,
      rank: 1,
      photo: best.row.athlete.headshot || null,
      derived: true,
    }));
  }
  return out;
}

export async function enrichNflTeamSnapshot(slug, baseSnapshot = null, { fetchImpl = fetch, now = new Date() } = {}) {
  const team = resolveTeam('nfl', slug);
  if (!team) throw new Error('nfl_team_not_found');

  const season = currentNflSeason(now);
  const scheduleUrl = `${GATEWAY}/api/schedule?season=${season}&team=${encodeURIComponent(team.abbr)}`;
  const standingsUrl = `${GATEWAY}/api/standings?season=${season}`;
  const scoresUrl = `${GATEWAY}/api/scores?season=${season}`;
  const statsUrl = `${GATEWAY}/api/current-stats?season=${season}`;

  const [scheduleResult, standingsResult, scoresResult, statsResult] = await Promise.allSettled([
    fetchJson(scheduleUrl, { fetchImpl }),
    fetchJson(standingsUrl, { fetchImpl }),
    fetchJson(scoresUrl, { fetchImpl }),
    fetchJson(statsUrl, { fetchImpl }),
  ]);

  const schedulePayload = scheduleResult.status === 'fulfilled' ? scheduleResult.value : null;
  const standingsPayload = standingsResult.status === 'fulfilled' ? standingsResult.value : null;
  const scoresPayload = scoresResult.status === 'fulfilled' ? scoresResult.value : null;
  const statsPayload = statsResult.status === 'fulfilled' ? statsResult.value : null;

  const schedule = normalizeTeamSchedule(schedulePayload, scoresPayload, team.abbr, now.getTime());
  const standing = standingFor(standingsPayload, team.abbr);
  const record = recordFromStanding(standing);
  const roster = dictionaryRoster(team.abbr);
  let leaders = seasonLeaders(statsPayload, team.abbr);

  if (leaders.length < LEADER_GROUPS.length && schedule.recent[0]?.game_id) {
    try {
      const detail = await fetchJson(
        `${LIVE_RELAY}?event=${encodeURIComponent(schedule.recent[0].game_id)}`,
        { fetchImpl },
      );
      leaders = gameLeaders(detail, team.abbr, leaders);
    } catch {
      // Season leaders remain valid. A missing game-detail fallback must never
      // turn a good team snapshot into an error.
    }
  }

  const sourceUrls = [scheduleUrl, standingsUrl, scoresUrl, statsUrl];
  const source = provenance({
    product: 'PropBetEdge NFL',
    source: 'PropBetEdge NFL schedule, current-season authority and box-score ledger',
    source_urls: sourceUrls,
    schema: 'pbe-nfl-team-readthrough/v1',
    observed_at: new Date().toISOString(),
    ttl_s: 300,
    stale_after_s: 1800,
  });

  const snapshot = {
    ...(baseSnapshot || {}),
    contract: baseSnapshot?.contract || 'pbe-entity-hub/1',
    kind: 'team',
    sport: 'nfl',
    team_id: String(team.id),
    slug: team.slug,
    name: team.name,
    abbreviation: team.abbr,
    canonical_url: `https://propbetedge.ai/team/nfl/${team.slug}`,
    logo: team.logo_url,
    league_context: {
      conference: standing?.conference || baseSnapshot?.league_context?.conference || null,
      division: standing?.division || baseSnapshot?.league_context?.division || null,
    },
    record: record || baseSnapshot?.record || null,
    standings: standing ? {
      conference: standing.conference,
      division: standing.division,
      division_rank: standing.division_rank,
      games_back: null,
      as_of: standing.as_of,
    } : baseSnapshot?.standings || null,
    recent_form: recentForm(schedule) || baseSnapshot?.recent_form || null,
    team_stats: teamStatsFromStanding(standing) || baseSnapshot?.team_stats || null,
    roster: roster.length ? roster : (baseSnapshot?.roster || []),
    leaders: leaders.length ? leaders : (baseSnapshot?.leaders || []),
    schedule,
    recent_games: schedule.recent,
    upcoming_games: schedule.upcoming,
    injuries: Array.isArray(baseSnapshot?.injuries) ? baseSnapshot.injuries : [],
    source,
  };

  return {
    snapshot,
    sources: {
      schedule: scheduleResult.status,
      standings: standingsResult.status,
      scores: scoresResult.status,
      current_stats: statsResult.status,
    },
  };
}
