/**
 * src/entity-hub/adapters/mlb.js
 *
 * MLB adapter — MLB StatsAPI, the same source `/player/mlb/:id` already
 * resolves against and the same source that built the entity dictionary.
 * Person ids are StatsAPI person ids, so hub snapshots join the article graph
 * by id with no translation.
 *
 * StatsAPI is provider-native rather than pre-normalized, so this module does
 * the normalization the NHL gateway already does for hockey — including
 * choosing the right stat group, because a pitcher's line and a hitter's line
 * are different shapes and must never be merged.
 */

import {
  playerSnapshot, teamSnapshot, rosterEntry, statGroup, provenance,
  scheduledGame, teamLeader,
} from '../contract.js';
import { resolveTeam, allPlayers } from '../../entity-graph/entities.js';

export const STATS_API = 'https://statsapi.mlb.com/api/v1';
export const PRODUCT = 'statsapi.mlb.com';

/** Pitchers get pitching lines; everyone else gets hitting. Two-way players
 *  (Ohtani) legitimately have both, so both are carried, labelled. */
export function statGroupsFor(position) {
  const code = String(position || '').toUpperCase();
  if (code === 'P' || code === 'SP' || code === 'RP') return ['pitching', 'hitting'];
  if (code === 'TWP') return ['hitting', 'pitching'];
  return ['hitting'];
}

export function playerUrl(id, season) {
  const hydrate = `stats(group=[hitting,pitching],type=[season,career],season=${season},sportId=1),currentTeam`;
  return `${STATS_API}/people/${id}?hydrate=${encodeURIComponent(hydrate)}`;
}

export function gameLogUrl(id, season, group) {
  return `${STATS_API}/people/${id}/stats?stats=gameLog&season=${season}&group=${group}`;
}

export function standingsUrl(season) {
  // division and league come back as bare {id, link} without the hydrate, which
  // is how 'AL East' silently became null the first time this ran.
  return `${STATS_API}/standings?leagueId=103,104&season=${season}&hydrate=division,league`;
}

export function scheduleUrl(teamId, season, { from, to }) {
  return `${STATS_API}/schedule?sportId=1&teamId=${teamId}&season=${season}`
    + `&startDate=${from}&endDate=${to}&hydrate=team,linescore`;
}

export function leadersUrl(teamId, season) {
  return `${STATS_API}/teams/${teamId}/leaders`
    + `?leaderCategories=homeRuns,runsBattedIn,battingAverage,strikeouts,wins,earnedRunAverage`
    + `&season=${season}&leaderGameTypes=R`;
}

export function teamStatsUrl(teamId, season) {
  return `${STATS_API}/teams/${teamId}/stats?stats=season&group=hitting,pitching&season=${season}`;
}

export function rosterUrl(teamId, season) {
  return `${STATS_API}/teams/${teamId}/roster/active?season=${season}`;
}

function source(urls, observedAt) {
  return provenance({
    product: PRODUCT,
    source: 'MLB StatsAPI',
    source_urls: urls,
    schema: 'mlb-statsapi/v1',
    observed_at: observedAt || new Date().toISOString(),
    ttl_s: 900,
    stale_after_s: 86400,
  });
}

/**
 * @param {object} person   people[0] from the hydrated person call
 * @param {object} [gameLog] optional gameLog payload for recent games
 */
/**
 * The dictionary's team for a player id.
 *
 * StatsAPI's hydrated `currentTeam` is frequently a minor-league affiliate (or
 * absent on an IL move), which resolves to no major-league club and left 28% of
 * MLB snapshots with no team link at all. The dictionary is the identity spine
 * and already holds the right club, keyed by the same person id — so it is the
 * correct fallback, and it is an id join, not a name guess.
 */
const dictionaryTeamCache = new Map();
function dictionaryTeamFor(playerId) {
  const key = String(playerId);
  if (dictionaryTeamCache.has(key)) return dictionaryTeamCache.get(key);
  const row = allPlayers('mlb').find((p) => p.id === key) || null;
  const team = row?.team_id ? resolveTeam('mlb', row.team_id) : null;
  dictionaryTeamCache.set(key, team);
  return team;
}

export function normalizePlayer(person, { gameLog = null, season, urls = [] } = {}) {
  if (!person?.id || !person?.fullName) return null;

  const positionCode = person.primaryPosition?.abbreviation || '';
  const preferred = statGroupsFor(positionCode);

  const stats = {};
  const seasonSplit = pickSplit(person.stats, 'season', preferred);
  if (seasonSplit) {
    stats.season = statGroup({
      label: `${titleCase(seasonSplit.group)} — regular season`,
      season: String(season || seasonSplit.season || ''),
      stats: seasonSplit.stat,
    });
  }
  const careerSplit = pickSplit(person.stats, 'career', preferred);
  if (careerSplit) {
    stats.career = statGroup({
      label: `${titleCase(careerSplit.group)} — career`,
      season: null,
      stats: careerSplit.stat,
    });
  }

  const logSplits = Array.isArray(gameLog?.stats?.[0]?.splits) ? gameLog.stats[0].splits : [];
  if (logSplits.length) {
    // StatsAPI returns the game log oldest-first; a "recent games" module means
    // the most recent, so take from the end.
    const recent = logSplits.slice(-10).reverse();
    stats.games = recent.map((split) => ({
      date: split.date || null,
      opponent: split.opponent?.name || null,
      home_road: split.isHome === true ? 'home' : split.isHome === false ? 'road' : null,
      result: split.isWin === true ? 'W' : split.isWin === false ? 'L' : null,
      summary: split.stat?.summary || null,
      stats: split.stat || {},
    }));
    stats.recent = {
      last5: statGroup({ label: 'Last 5 games', stats: aggregate(recent.slice(0, 5).map((s) => s.stat)) }),
      last10: statGroup({ label: 'Last 10 games', stats: aggregate(recent.map((s) => s.stat)) }),
    };
  }

  return playerSnapshot({
    sport: 'mlb',
    player_id: person.id,
    name: person.fullName,
    team: teamRef(person.currentTeam) || teamRefFromDictionary(person.id),
    position: positionCode,
    jersey: person.primaryNumber ?? null,
    photo: `https://img.mlbstatic.com/mlb-photos/image/upload/w_426,q_90/v1/people/${person.id}/headshot/67/current`,
    bio: {
      height: person.height || null,
      weight: person.weight ? `${person.weight} lbs` : null,
      age: person.currentAge ?? ageFrom(person.birthDate),
      birth_date: person.birthDate || null,
      birth_place: [person.birthCity, person.birthStateProvince, person.birthCountry].filter(Boolean).join(', ') || null,
      experience: person.mlbDebutDate ? `Debut ${person.mlbDebutDate}` : null,
      bats: person.batSide?.code || null,
      throws: person.pitchHand?.code || null,
    },
    stats,
    status: person.active === false ? { active: false, label: 'Inactive' } : null,
    source: source(urls.length ? urls : [playerUrl(person.id, season)], null),
  });
}

/** One team's standings row, pulled out of the league-wide payload. */
export function normalizeStandingsRow(payload, teamId) {
  const wanted = String(teamId);
  for (const record of payload?.records || []) {
    for (const row of record?.teamRecords || []) {
      if (String(row?.team?.id) !== wanted) continue;
      const overall = row.records?.overallRecords?.find((r) => r.type === 'home' || r.type === 'away');
      return {
        record: {
          wins: row.wins ?? null,
          losses: row.losses ?? null,
          winning_percentage: row.winningPercentage ?? null,
          games_played: row.gamesPlayed ?? null,
          runs_scored: row.runsScored ?? null,
          runs_allowed: row.runsAllowed ?? null,
          summary: row.wins != null && row.losses != null ? `${row.wins}-${row.losses}` : null,
        },
        standings: {
          division: record?.division?.nameShort || record?.division?.name || null,
          league: record?.league?.name || null,
          division_rank: row.divisionRank ?? null,
          league_rank: row.leagueRank ?? null,
          games_back: row.gamesBack ?? null,
          wildcard_games_back: row.wildCardGamesBack ?? null,
          clinched: row.clinchIndicator || null,
          division_leader: row.divisionLeader ?? null,
          as_of: row.lastUpdated || null,
        },
        recent_form: {
          streak: row.streak?.streakCode ?? null,
          last10: tenGameRecord(row),
          home: overall ? `${overall.wins}-${overall.losses}` : null,
        },
      };
    }
  }
  return null;
}

export function normalizeRoster(payload) {
  const rows = Array.isArray(payload?.roster) ? payload.roster : [];
  return rows
    .filter((r) => r?.person?.id && r?.person?.fullName)
    .map((r) => rosterEntry({
      sport: 'mlb',
      player_id: r.person.id,
      name: r.person.fullName,
      position: r.position?.abbreviation || '',
      jersey: r.jerseyNumber ?? null,
      photo: `https://img.mlbstatic.com/mlb-photos/image/upload/w_240,q_90/v1/people/${r.person.id}/headshot/67/current`,
    }));
}

export function normalizeSchedule(payload, statsApiTeamId, { recent = 5, upcoming = 5 } = {}) {
  const mine = String(statsApiTeamId);
  const past = [];
  const future = [];

  for (const day of payload?.dates || []) {
    for (const game of day?.games || []) {
      const home = game?.teams?.home;
      const away = game?.teams?.away;
      if (!home?.team || !away?.team) continue;
      const isHome = String(home.team.id) === mine;
      const opponentRaw = (isHome ? away : home).team;
      const opponentTeam = resolveTeam('mlb', opponentRaw.name);

      const state = String(game?.status?.abstractGameState || '').toLowerCase();
      const isFinal = state === 'final';
      past.length; // keep shape obvious
      const normalized = scheduledGame({
        sport: 'mlb',
        game_id: game.gamePk,
        date: game.gameDate || null,
        home_away: isHome ? 'home' : 'away',
        status: game?.status?.detailedState || null,
        is_final: isFinal,
        venue: game?.venue?.name || null,
        team_score: isFinal ? ((isHome ? home.score : away.score) ?? null) : null,
        opponent_score: isFinal ? ((isHome ? away.score : home.score) ?? null) : null,
        opponent: opponentTeam
          ? { id: opponentTeam.abbr, name: opponentTeam.name, abbr: opponentTeam.abbr, slug: opponentTeam.slug, logo: opponentTeam.logo_url }
          : { name: opponentRaw.name || null },
      });
      (isFinal ? past : future).push(normalized);
    }
  }

  past.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  future.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
  return { recent: past.slice(0, recent), upcoming: future.slice(0, upcoming) };
}

/**
 * Keyed on statGroup AND leaderCategory, because StatsAPI reuses a category
 * name across groups: a `homeRuns` block exists for hitting (hit), pitching
 * (allowed) and catching (allowed while catching). Keying on the category
 * alone ranked pitchers and catchers as home run hitters.
 *
 * An allowlist rather than a passthrough: a block we have not explicitly
 * reasoned about is skipped, not published under a guessed label.
 */
const MLB_LEADER_LABELS = {
  'hitting:homeRuns': ['Home runs', 'HR'],
  'hitting:runsBattedIn': ['RBI', 'RBI'],
  'hitting:battingAverage': ['Batting average', 'AVG'],
  'pitching:earnedRunAverage': ['ERA', 'ERA'],
  'pitching:strikeouts': ['Strikeouts', 'K'],
  'pitching:wins': ['Wins', 'W'],
};

/** MLB publishes team leaders with a real person id — no name join needed. */
export function normalizeLeaders(payload, { perCategory = 3 } = {}) {
  const out = [];
  for (const block of payload?.teamLeaders || []) {
    const category = `${block.statGroup}:${block.leaderCategory}`;
    const labels = MLB_LEADER_LABELS[category];
    if (!labels) continue; // not an allowlisted (group, category) pair
    const [label, unit] = labels;
    for (const leader of (block.leaders || []).slice(0, perCategory)) {
      if (!leader?.person?.id) continue;
      const numeric = Number(leader.value);
      out.push(teamLeader({
        sport: 'mlb',
        player_id: leader.person.id,
        name: leader.person.fullName,
        category,
        label,
        value: Number.isFinite(numeric) ? numeric : leader.value,
        unit,
        rank: leader.rank ?? null,
        photo: `https://img.mlbstatic.com/mlb-photos/image/upload/w_240,q_90/v1/people/${leader.person.id}/headshot/67/current`,
      }));
    }
  }
  return out;
}

export function normalizeTeamStats(payload) {
  const stats = {};
  for (const block of payload?.stats || []) {
    const group = block?.group?.displayName;
    const split = block?.splits?.[0]?.stat;
    if (!group || !split) continue;
    if (group === 'hitting') {
      stats.runs = split.runs ?? null;
      stats.home_runs = split.homeRuns ?? null;
      stats.batting_average = split.avg ?? null;
      stats.on_base_percentage = split.obp ?? null;
      stats.slugging = split.slg ?? null;
    } else if (group === 'pitching') {
      stats.era = split.era ?? null;
      stats.runs_allowed = split.runs ?? null;
      stats.strikeouts = split.strikeOuts ?? null;
      stats.whip = split.whip ?? null;
    }
  }
  return Object.keys(stats).length ? stats : null;
}

export function buildTeam({
  slug, rosterPayload, standingsPayload, statsApiTeamId, urls = [],
  schedulePayload = null, leadersPayload = null, teamStatsPayload = null,
}) {
  const dictTeam = resolveTeam('mlb', slug);
  if (!dictTeam) return null;

  const standing = standingsPayload && statsApiTeamId
    ? normalizeStandingsRow(standingsPayload, statsApiTeamId)
    : null;
  const schedule = schedulePayload ? normalizeSchedule(schedulePayload, statsApiTeamId) : null;
  const leaders = leadersPayload ? normalizeLeaders(leadersPayload) : [];
  const teamStats = teamStatsPayload ? normalizeTeamStats(teamStatsPayload) : null;

  return teamSnapshot({
    sport: 'mlb',
    team_id: dictTeam.id,
    slug: dictTeam.slug,
    name: dictTeam.name,
    abbreviation: dictTeam.abbr,
    logo: dictTeam.logo_url,
    league_context: {
      conference: standing?.standings?.league ?? null,
      division: standing?.standings?.division ?? null,
    },
    record: standing?.record ?? null,
    standings: standing?.standings ?? null,
    recent_form: standing?.recent_form ?? null,
    team_stats: teamStats,
    leaders,
    schedule,
    roster: rosterPayload ? normalizeRoster(rosterPayload) : [],
    source: source(urls, null),
  });
}

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Choose the stat split matching the player's real role, in preference order. */
function pickSplit(statsArray, type, preferredGroups) {
  const groups = Array.isArray(statsArray) ? statsArray : [];
  for (const group of preferredGroups) {
    const entry = groups.find((s) => s.type?.displayName === type && s.group?.displayName === group);
    const split = entry?.splits?.[0];
    if (split?.stat && Object.keys(split.stat).length) {
      return { group, stat: split.stat, season: split.season };
    }
  }
  return null;
}

function teamRefFromDictionary(playerId) {
  const team = dictionaryTeamFor(playerId);
  if (!team) return null;
  return {
    id: team.abbr,
    slug: team.slug,
    name: team.name,
    abbr: team.abbr,
    logo: team.logo_url,
    path: team.path,
    statsapi_team_id: null,
    // Said out loud: the club came from the roster snapshot, not from this
    // player's live StatsAPI record.
    from: 'dictionary',
  };
}

function teamRef(currentTeam) {
  if (!currentTeam?.name) return null;
  const team = resolveTeam('mlb', currentTeam.name);
  if (!team) return null;
  return {
    id: team.abbr,
    slug: team.slug,
    name: team.name,
    abbr: team.abbr,
    logo: team.logo_url,
    path: team.path,
    statsapi_team_id: currentTeam.id ?? null,
  };
}

function tenGameRecord(row) {
  const split = row.records?.splitRecords?.find((r) => r.type === 'lastTen');
  return split ? `${split.wins}-${split.losses}` : null;
}

/** Sum numeric columns only. Rate stats (avg, obp) are strings in StatsAPI and
 *  are deliberately not averaged — a summed batting average is nonsense. */
function aggregate(statObjects) {
  const totals = {};
  for (const stat of statObjects) {
    for (const [key, value] of Object.entries(stat || {})) {
      if (typeof value !== 'number') continue;
      totals[key] = (totals[key] || 0) + value;
    }
  }
  totals.games = statObjects.length;
  return totals;
}

function ageFrom(birthDate) {
  if (!birthDate) return null;
  const born = new Date(`${birthDate}T00:00:00Z`);
  if (!Number.isFinite(born.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - born.getUTCFullYear();
  if (now.getUTCMonth() < born.getUTCMonth()
    || (now.getUTCMonth() === born.getUTCMonth() && now.getUTCDate() < born.getUTCDate())) age -= 1;
  return age >= 0 && age < 120 ? age : null;
}

function titleCase(value) {
  const s = String(value || '');
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
