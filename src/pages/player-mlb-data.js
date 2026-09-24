/**
 * src/pages/player-mlb-data.js — pure StatsAPI contract for /player/mlb/:id.
 *
 * No DOM, no fetch. Every URL the profile requests and every normalization it
 * applies lives here so the regression suite can exercise it against captured
 * StatsAPI payloads (tests/fixtures/mlb-player).
 *
 * Endpoints (all statsapi.mlb.com/api/v1, MLB only via sportId=1):
 *   profile      people/{id}?hydrate=stats(group=[hitting,pitching],type=[season,career],season=Y,sportId=1),currentTeam
 *   yearByYear   people/{id}/stats?stats=yearByYear&group=G&sportId=1&hydrate=team
 *   gameLog      people/{id}/stats?stats=gameLog&group=G&season=Y&sportId=1
 *   teams        teams?sportId=1&season=Y          (opponent id -> that season's abbreviation)
 *
 * Rules: null is never rendered as 0; a 0 is shown only when the source says 0;
 * a season line is always that season's own split, never current-season stats;
 * combined multi-team rows are shown only when StatsAPI supplies them.
 */

export const STATS_API = 'https://statsapi.mlb.com/api/v1';
export const DASH = '—';
export const GROUPS = ['hitting', 'pitching'];

/** MLB season in progress (or just finished) for a date. Jan–Feb belong to the prior season. */
export function currentMlbSeason(now = new Date()) {
  return now.getMonth() < 2 ? now.getFullYear() - 1 : now.getFullYear();
}

export function profileUrl(id, season) {
  return `${STATS_API}/people/${id}?hydrate=stats(group=[hitting,pitching],type=[season,career],season=${season},sportId=1),currentTeam`;
}
export function yearByYearUrl(id, group) {
  return `${STATS_API}/people/${id}/stats?stats=yearByYear&group=${group}&sportId=1&hydrate=team`;
}
export function gameLogUrl(id, group, season) {
  return `${STATS_API}/people/${id}/stats?stats=gameLog&group=${group}&season=${season}&sportId=1`;
}
export function teamsUrl(season) {
  return `${STATS_API}/teams?sportId=1&season=${season}`;
}
export function gameLogCacheKey(id, group, season) {
  return `${id}:${group}:${season}`;
}

/** Display a source value. Missing -> em dash; a real 0 stays "0". */
export function val(v) {
  if (v === null || v === undefined || v === '') return DASH;
  if (typeof v === 'number' && !Number.isFinite(v)) return DASH;
  return String(v);
}
function wl(stat) {
  if (!stat || stat.wins == null || stat.losses == null) return DASH;
  return `${stat.wins}-${stat.losses}`;
}
function pitchingGames(stat) {
  return stat?.gamesPitched ?? stat?.gamesPlayed;
}

// ─── Profile ──────────────────────────────────────────────────────────────
function findStat(stats, group, type) {
  return (stats || []).find((s) => s.group?.displayName === group && s.type?.displayName === type) || null;
}

/** people/{id} hydrate -> { person, season: {hitting,pitching}, career: {hitting,pitching} } */
export function parseProfile(data) {
  const person = data?.people?.[0] || null;
  if (!person) return null;
  const season = {}, career = {};
  for (const g of GROUPS) {
    const s = findStat(person.stats, g, 'season');
    season[g] = s?.splits?.[0] ? { season: String(s.splits[0].season ?? ''), stat: s.splits[0].stat || null } : null;
    career[g] = findStat(person.stats, g, 'career')?.splits?.[0]?.stat || null;
  }
  return { person, season, career };
}

export function isPitcherPosition(pos) {
  return pos?.code === '1' || pos?.abbreviation === 'P' || pos?.abbreviation === 'SP' || pos?.abbreviation === 'RP';
}
export function isTwoWayPosition(pos) {
  return pos?.code === 'Y' || pos?.abbreviation === 'TWP';
}

/**
 * Which stat groups the profile renders, primary first.
 *   TWP                                  -> hitting + pitching
 *   both groups in the source's season    -> both (primary first)
 *   pitcher (P/SP/RP)                    -> pitching
 *   everyone else                        -> hitting
 * Career-only presence of the secondary group (e.g. pre-DH pitchers batting)
 * does not add a section.
 */
export function detectGroups(profile) {
  const pos = profile?.person?.primaryPosition;
  if (isTwoWayPosition(pos)) return ['hitting', 'pitching'];
  const primary = isPitcherPosition(pos) ? 'pitching' : 'hitting';
  const secondary = primary === 'pitching' ? 'hitting' : 'pitching';
  const both = profile?.season?.hitting?.stat && profile?.season?.pitching?.stat;
  return both ? [primary, secondary] : [primary];
}

// ─── Year by year ─────────────────────────────────────────────────────────
/**
 * yearByYear payload -> rows newest season first; source order kept inside a
 * season (per-team rows, then StatsAPI's own combined row when it sends one).
 * Only sportId=1 rows survive. Team comes from the split itself.
 */
export function parseYearByYear(payload, group) {
  const block = (payload?.stats || []).find((s) => !group || s.group?.displayName === group) || payload?.stats?.[0];
  const splits = block?.splits || [];
  const rows = [];
  splits.forEach((s, index) => {
    if (s?.sport?.id != null && Number(s.sport.id) !== 1) return;
    if (s?.season == null || !s.stat) return;
    const team = s.team || null;
    const numTeams = Number(s.numTeams) || null;
    const isTotal = !team && numTeams > 1;
    const teamLabel = team
      ? (team.abbreviation || team.teamName || team.name || DASH)
      : isTotal ? `${numTeams} TEAMS` : DASH;
    rows.push({
      season: String(s.season),
      group,
      teamId: team?.id ?? null,
      teamAbbr: team?.abbreviation || null,
      teamName: team?.name || null,
      teamLabel,
      isTotal,
      numTeams,
      stat: s.stat,
      order: index,
    });
  });
  rows.sort((a, b) => (Number(b.season) - Number(a.season)) || (a.order - b.order));
  return rows;
}

/** Distinct seasons (desc) across groups. */
export function seasonsFromHistory(histories) {
  const set = new Set();
  for (const rows of Object.values(histories || {})) for (const r of rows || []) set.add(r.season);
  return [...set].sort((a, b) => Number(b) - Number(a));
}

/**
 * Default selected season: the current season when any rendered group has a
 * row for it, otherwise the latest season with data (retired / injured / not
 * yet debuted this year), otherwise the current season.
 */
export function defaultSeason(histories, current) {
  const seasons = seasonsFromHistory(histories);
  if (seasons.includes(String(current))) return String(current);
  return seasons[0] || String(current);
}

/**
 * The line that represents one season: StatsAPI's combined row for traded
 * seasons, otherwise the only row. Several per-team rows without a source
 * total -> null (never summed here).
 */
export function seasonLine(rows, season) {
  const inSeason = (rows || []).filter((r) => r.season === String(season));
  if (!inSeason.length) return null;
  const teams = inSeason.filter((r) => !r.isTotal);
  const total = inSeason.find((r) => r.isTotal);
  if (total) return { stat: total.stat, teams: teams.map((t) => t.teamLabel), source: 'yearByYear-total' };
  if (inSeason.length === 1) return { stat: inSeason[0].stat, teams: [inSeason[0].teamLabel], source: 'yearByYear' };
  return null;
}

/**
 * Resolve the stats for the selected season of one group.
 * history = parsed yearByYear rows or null when that request failed.
 */
export function selectedSeasonStat({ history, profileSeason, season, current }) {
  if (history) {
    const line = seasonLine(history, season);
    if (line) return line;
  }
  // Only the current season may come from the profile hydrate, and only when
  // the hydrate is actually for that season.
  if (String(season) === String(current) && profileSeason?.stat && (!profileSeason.season || profileSeason.season === String(season))) {
    return { stat: profileSeason.stat, teams: [], source: 'profile-season' };
  }
  return null;
}

// ─── Opponents + game log ─────────────────────────────────────────────────
/** teams?sportId=1&season=Y -> Map(teamId -> abbreviation) */
export function teamAbbrMap(payload) {
  const map = new Map();
  for (const t of payload?.teams || []) if (t?.id != null && t.abbreviation) map.set(Number(t.id), t.abbreviation);
  return map;
}

/**
 * Opponent label for a gameLog split. Order:
 *   1. that season's StatsAPI team abbreviation for opponent.id
 *   2. opponent.abbreviation if the split carries one
 *   3. opponent.teamName, then the full opponent.name
 *   4. em dash only when the split has no opponent at all
 * Prefix "@" when isHome === false, "vs" when isHome === true, none if unknown.
 * Never inferred from dates or schedules.
 */
export function normalizeOpponent(split, abbrs) {
  const o = split?.opponent;
  if (!o) return DASH;
  const label = (o.id != null && abbrs?.get?.(Number(o.id))) || o.abbreviation || o.teamName || o.name || null;
  if (!label) return DASH;
  const prefix = split.isHome === true ? 'vs ' : split.isHome === false ? '@ ' : '';
  return prefix + label;
}

/**
 * gameLog payload -> rows newest first for exactly the requested season.
 * Rows reporting another season or another sport are dropped, duplicate
 * gamePk entries are collapsed.
 */
export function parseGameLog(payload, { season, abbrs } = {}) {
  const splits = payload?.stats?.[0]?.splits || [];
  const seen = new Set();
  const rows = [];
  splits.forEach((s, index) => {
    if (!s?.stat) return;
    if (s.sport?.id != null && Number(s.sport.id) !== 1) return;
    if (season != null && s.season != null && String(s.season) !== String(season)) return;
    const key = s.game?.gamePk != null ? `pk:${s.game.gamePk}` : `ix:${index}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({
      date: s.date || null,
      gamePk: s.game?.gamePk ?? null,
      isHome: typeof s.isHome === 'boolean' ? s.isHome : null,
      isWin: typeof s.isWin === 'boolean' ? s.isWin : null,
      opp: normalizeOpponent(s, abbrs),
      stat: s.stat,
      order: index,
    });
  });
  rows.sort((a, b) => (String(b.date || '').localeCompare(String(a.date || ''))) || (b.order - a.order));
  return rows;
}

/** "2025-03-29" -> "3/29" without a timezone shift. */
export function shortDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!m) return DASH;
  return `${Number(m[2])}/${Number(m[3])}`;
}

// ─── Field sets (owner spec) ──────────────────────────────────────────────
export const SEASON_FIELDS = {
  hitting: [
    ['AVG', (s) => s.avg], ['HR', (s) => s.homeRuns], ['RBI', (s) => s.rbi], ['OPS', (s) => s.ops],
    ['OBP', (s) => s.obp], ['SLG', (s) => s.slg], ['SB', (s) => s.stolenBases], ['GP', (s) => s.gamesPlayed],
  ],
  pitching: [
    ['ERA', (s) => s.era], ['WHIP', (s) => s.whip], ['K', (s) => s.strikeOuts], ['W-L', wl],
    ['K/9', (s) => s.strikeoutsPer9Inn], ['BB/9', (s) => s.walksPer9Inn], ['IP', (s) => s.inningsPitched], ['SV', (s) => s.saves],
  ],
};
export const CAREER_FIELDS = {
  pitching: [
    ['ERA', (s) => s.era], ['WHIP', (s) => s.whip], ['W-L', wl], ['K', (s) => s.strikeOuts],
    ['IP', (s) => s.inningsPitched], ['SV', (s) => s.saves], ['G', pitchingGames], ['GS', (s) => s.gamesStarted],
  ],
  hitting: [
    ['AVG', (s) => s.avg], ['OPS', (s) => s.ops], ['HR', (s) => s.homeRuns], ['RBI', (s) => s.rbi],
    ['H', (s) => s.hits], ['R', (s) => s.runs], ['SB', (s) => s.stolenBases], ['G', (s) => s.gamesPlayed],
  ],
};
export const HISTORY_FIELDS = {
  pitching: [
    ['G', pitchingGames], ['GS', (s) => s.gamesStarted], ['W', (s) => s.wins], ['L', (s) => s.losses],
    ['ERA', (s) => s.era], ['WHIP', (s) => s.whip], ['K', (s) => s.strikeOuts], ['BB', (s) => s.baseOnBalls],
    ['IP', (s) => s.inningsPitched],
  ],
  hitting: [
    ['G', (s) => s.gamesPlayed], ['AB', (s) => s.atBats], ['AVG', (s) => s.avg], ['OPS', (s) => s.ops],
    ['HR', (s) => s.homeRuns], ['RBI', (s) => s.rbi], ['H', (s) => s.hits], ['R', (s) => s.runs],
    ['2B', (s) => s.doubles], ['BB', (s) => s.baseOnBalls], ['K', (s) => s.strikeOuts], ['SB', (s) => s.stolenBases],
  ],
};
export const GAMELOG_FIELDS = {
  pitching: [
    ['IP', (s) => s.inningsPitched], ['H', (s) => s.hits], ['R', (s) => s.runs], ['ER', (s) => s.earnedRuns],
    ['BB', (s) => s.baseOnBalls], ['K', (s) => s.strikeOuts], ['HR', (s) => s.homeRuns], ['ERA', (s) => s.era],
    ['WHIP', (s) => s.whip],
  ],
  hitting: [
    ['AB', (s) => s.atBats], ['R', (s) => s.runs], ['H', (s) => s.hits], ['2B', (s) => s.doubles],
    ['3B', (s) => s.triples], ['HR', (s) => s.homeRuns], ['RBI', (s) => s.rbi], ['BB', (s) => s.baseOnBalls],
    ['K', (s) => s.strikeOuts], ['SB', (s) => s.stolenBases], ['AVG', (s) => s.avg], ['OPS', (s) => s.ops],
  ],
};
export const RECENT_FIELDS = {
  pitching: [['IP', (s) => s.inningsPitched], ['H', (s) => s.hits], ['ER', (s) => s.earnedRuns], ['BB', (s) => s.baseOnBalls], ['K', (s) => s.strikeOuts]],
  hitting: [['AB', (s) => s.atBats], ['H', (s) => s.hits], ['HR', (s) => s.homeRuns], ['RBI', (s) => s.rbi], ['BB', (s) => s.baseOnBalls], ['K', (s) => s.strikeOuts]],
};
export const SPARK_KEY = { pitching: ['K', 'strikeOuts'], hitting: ['H', 'hits'] };

export function fieldValues(fields, stat) {
  return fields.map(([label, get]) => ({ label, value: stat ? val(get(stat)) : DASH }));
}

/** Meta description for MLB player profiles (client setMeta and Edge middleware). */
export function mlbPlayerDescription(name, team) {
  return `${name}${team ? ` (${team})` : ''} MLB stats: current season, career totals, season-by-season history, full game logs and recent form, with PropBetEdge MLB coverage.`;
}
