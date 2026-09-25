/**
 * ARTICLE_DATA_ADAPTERS — one registry entry per sport the newsroom can
 * hydrate with VERIFIED LIVE CONTEXT. Adding a sport means adding an entry
 * here; nothing else switches on sport names.
 *
 * Every adapter consumes an existing read contract:
 *   team   → /api/team-intelligence (pbe-entity-hub/1 team snapshot)
 *   player → MLB StatsAPI, /api/player-data (ESPN / NHL api-web), and for
 *            NBA the documented nba-intel /v1/players WinBA read via
 *            /api/pbe-intel. No frontend scraping, no re-derived model math.
 *
 * UFC and Boxing have no entry: the newsroom carries no UFC/Boxing articles
 * and the entity dictionary has no fighter identities to join on, so an
 * adapter could only guess. Evidence extraction for UFC prose still exists
 * in evidence.js for when that content lands.
 */

import {
  espnCategories,
  espnGameLog,
  nhlCategories,
  nhlGameLog,
  number as toNumber,
} from '../pages/player-history-core.js';
import { SPORT_CONFIG } from '../sport-config.js';
import { teamDataFromPayload } from './team-data.js';
import { isDisplayableValue } from './evidence.js';

export function currentSeason(sport, now = new Date()) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  if (sport === 'nba') return String(month >= 7 ? year + 1 : year);
  if (sport === 'nfl') return String(month >= 7 ? year : year - 1);
  if (sport === 'nhl') {
    const start = month >= 7 ? year : year - 1;
    return `${start}${start + 1}`;
  }
  return String(year);
}

async function fetchJson(ctx, path) {
  const url = /^https?:/.test(path) ? path : `${ctx.base || ''}${path}`;
  const res = await (ctx.fetch || fetch)(url, { credentials: 'omit' });
  if (!res.ok) throw new Error(`source ${res.status}`);
  return res.json();
}

/* ---------------- metric selection ---------------- */

const RECENT_METRIC = {
  mlb_hitter: {
    hr: ['homeRuns', 'Home Runs'],
    altprop_hits: ['hits', 'Hits'],
    altprop_total_bases: ['totalBases', 'Total Bases'],
    altprop_rbi: ['rbi', 'RBI'],
    altprop_runs: ['runs', 'Runs'],
    altprop_walks: ['baseOnBalls', 'Walks'],
    stolen_bases: ['stolenBases', 'Stolen Bases'],
  },
  mlb_pitcher: {
    k_prop: ['strikeOuts', 'Strikeouts'],
  },
  nfl: {
    passing_yards: ['passingYards', 'Passing Yards'],
    passing_tds: ['passingTouchdowns', 'Passing TDs'],
    passing_completions: ['completions', 'Completions'],
    passing_attempts: ['passingAttempts', 'Passing Attempts'],
    completion_pct: ['completionPct', 'Completion %'],
    rushing_yards: ['rushingYards', 'Rushing Yards'],
    rushing_attempts: ['rushingAttempts', 'Rushing Attempts'],
    rushing_tds: ['rushingTouchdowns', 'Rushing TDs'],
    receiving_yards: ['receivingYards', 'Receiving Yards'],
    receptions: ['receptions', 'Receptions'],
    receiving_tds: ['receivingTouchdowns', 'Receiving TDs'],
  },
  basketball: {
    points: ['points', 'Points'],
    rebounds: ['rebounds', 'Rebounds'],
    assists: ['assists', 'Assists'],
    threes_made: ['threePointFieldGoalsMade', '3PM'],
  },
  nhl_skater: {
    shots_on_goal: ['shots', 'Shots on Goal'],
    goals: ['goals', 'Goals'],
    assists: ['assists', 'Assists'],
    points: ['points', 'Points'],
  },
};

const NFL_PROP_GROUPS = {
  passing: new Set(['passing_yards', 'passing_tds', 'passing_completions', 'passing_attempts', 'completion_pct']),
  rushing: new Set(['rushing_yards', 'rushing_attempts', 'rushing_tds']),
  receiving: new Set(['receiving_yards', 'receptions', 'receiving_tds']),
};

export const NFL_OFFENSE_SKILL = new Set(['QB', 'RB', 'FB', 'WR', 'TE']);
export const NFL_DEFENSE = new Set(['DE', 'DT', 'NT', 'DL', 'LB', 'ILB', 'OLB', 'MLB', 'EDGE', 'CB', 'S', 'FS', 'SS', 'DB', 'SAF']);
export const NFL_NO_PLAYER_CHART = new Set(['OL', 'G', 'C', 'T', 'OT', 'OG', 'LT', 'RT', 'LG', 'RG', 'IOL', 'LS', 'K', 'PK', 'P']);
const NFL_DEFENSIVE_PROPS = new Set(['sacks', 'tackles', 'tackles_assists', 'interceptions', 'defensive_interceptions']);

function propsOf(article) {
  return (article?.take?.prop_types || []).map((x) => String(x || '').trim()).filter(Boolean);
}

function firstNflMetric(props, group) {
  for (const prop of props) {
    if (NFL_PROP_GROUPS[group]?.has(prop) && RECENT_METRIC.nfl[prop]) return RECENT_METRIC.nfl[prop];
  }
  return null;
}

export function nflRecentMetric(article, position) {
  const props = propsOf(article);
  const pos = String(position || '').toUpperCase();
  const subject = [article?.title, article?.summary].filter(Boolean).join(' ');

  const passing = firstNflMetric(props, 'passing');
  const rushing = firstNflMetric(props, 'rushing');
  const receiving = firstNflMetric(props, 'receiving');

  const explicitlyReceiving = /\breceiv(?:e|er|ers|ing)?\b|\breceptions?\b|\btargets?\b|pass[- ]catch/i.test(subject);
  const explicitlyRushing = /\brush(?:ing|es|ed)?\b|\bcarr(?:y|ies)\b|\bground game\b/i.test(subject);

  if (pos === 'QB') {
    if (passing) return passing;
    if (explicitlyRushing && rushing) return rushing;
    return ['passingYards', 'Passing Yards'];
  }
  if (pos === 'RB' || pos === 'FB') {
    // Market tags are broad. For backs, an incidental receiving prop never
    // turns the live-form card into a receiver card.
    if (explicitlyReceiving && !explicitlyRushing && receiving) return receiving;
    return rushing || ['rushingYards', 'Rushing Yards'];
  }
  if (pos === 'WR' || pos === 'TE') return receiving || ['receivingYards', 'Receiving Yards'];
  if (NFL_DEFENSE.has(pos)) return props.includes('sacks') ? ['sacks', 'Sacks'] : ['totalTackles', 'Tackles'];
  // OL, specialists and unknown roles get no player metric at all.
  return null;
}

export function mlbIsPitcher(article, position) {
  const pos = String(position || '').toUpperCase();
  if (pos === 'P' || pos === 'SP' || pos === 'RP') return true;
  if (pos === 'TWP') return propsOf(article).includes('k_prop');
  return false;
}

export function mlbRecentMetric(article, pitcher) {
  const table = pitcher ? RECENT_METRIC.mlb_pitcher : RECENT_METRIC.mlb_hitter;
  for (const prop of propsOf(article)) if (table[prop]) return table[prop];
  return pitcher ? ['strikeOuts', 'Strikeouts'] : ['hits', 'Hits'];
}

export function nhlRecentMetric(article, goalie) {
  if (goalie) return ['saves', 'Saves'];
  for (const prop of propsOf(article)) if (RECENT_METRIC.nhl_skater[prop]) return RECENT_METRIC.nhl_skater[prop];
  return ['shots', 'Shots on Goal'];
}

export function basketballRecentMetric(article) {
  for (const prop of propsOf(article)) if (RECENT_METRIC.basketball[prop]) return RECENT_METRIC.basketball[prop];
  return ['points', 'Points'];
}

/* ---------------- metric summary ---------------- */

export function metricSummary(sourceRows, valueFor, limit = 8) {
  const all = (sourceRows || []).map((row) => {
    const value = toNumber(valueFor(row));
    return value == null ? null : {
      date: row.date || row.gameDate || '',
      opponent: row.opponent || '',
      result: row.result || '',
      value,
    };
  }).filter(Boolean);

  const recentNewest = all.slice(0, limit);
  const rows = [...recentNewest].reverse();
  const average = (items) => items.length
    ? items.reduce((sum, row) => sum + Number(row.value || 0), 0) / items.length
    : null;
  const recentAverage = average(recentNewest);
  const seasonAverage = average(all);
  const recentHigh = recentNewest.length ? Math.max(...recentNewest.map((row) => Number(row.value) || 0)) : null;
  const baselineAvailable = all.length > recentNewest.length && seasonAverage != null;
  const deltaPct = baselineAvailable && seasonAverage !== 0 && recentAverage != null
    ? ((recentAverage - seasonAverage) / Math.abs(seasonAverage)) * 100
    : null;

  return { rows, recentAverage, seasonAverage, recentHigh, seasonGames: all.length, baselineAvailable, deltaPct };
}

function cleanStats(pairs) {
  return pairs.filter((pair) => pair && isDisplayableValue(pair[1]));
}

function firstUsableCategory(categories, preferred) {
  return categories.find((c) => c.key === preferred && c.rows?.length)
    || categories.find((c) => c.rows?.length)
    || null;
}

function espnSeasonLabel(sport, row) {
  if (!row) return '';
  if (sport === 'nba') {
    const y = Number(row.year);
    return Number.isFinite(y) ? `${y - 1}-${String(y).slice(-2)}` : row.season;
  }
  return row.season || row.year || '';
}

/* ---------------- player loaders ---------------- */

async function mlbPlayer(ctx, player, article) {
  const season = currentSeason('mlb');
  const data = await fetchJson(ctx, `https://statsapi.mlb.com/api/v1/people/${encodeURIComponent(player.id)}?hydrate=stats(group=[hitting,pitching],type=[season,gameLog],season=${season},sportId=1),currentTeam`);
  const person = data?.people?.[0];
  if (!person) return null;

  const pitcher = mlbIsPitcher(article, person.primaryPosition?.abbreviation || player.position);
  const group = pitcher ? 'pitching' : 'hitting';
  const stats = person.stats || [];
  const seasonRow = stats.find((s) => s.group?.displayName === group && s.type?.displayName === 'season')?.splits?.[0]?.stat || null;
  const games = stats.find((s) => s.group?.displayName === group && s.type?.displayName === 'gameLog')?.splits || [];
  const [key, label] = mlbRecentMetric(article, pitcher);

  const metricLive = metricSummary(
    [...games].reverse().map((g) => ({
      date: g.date || g.game?.gameDate || '',
      opponent: g.opponent?.abbreviation || g.opponent?.name || '',
      result: g.isWin === true ? 'W' : g.isWin === false ? 'L' : '',
      stat: g.stat || {},
    })),
    (g) => g.stat?.[key],
  );

  const seasonStats = cleanStats(pitcher
    ? [['ERA', seasonRow?.era], ['WHIP', seasonRow?.whip], ['K', seasonRow?.strikeOuts], ['IP', seasonRow?.inningsPitched]]
    : [['AVG', seasonRow?.avg], ['HR', seasonRow?.homeRuns], ['RBI', seasonRow?.rbi], ['OPS', seasonRow?.ops]]);

  return {
    sport: 'mlb',
    role: pitcher ? 'pitcher' : 'hitter',
    name: person.fullName || player.name,
    image: player.image_url,
    label,
    rows: metricLive.rows,
    seasonStats,
    seasonLabel: `${season} season`,
    seasonCurrent: true,
    metricLive,
  };
}

async function espnPlayer(ctx, player, article, sport) {
  const season = currentSeason(sport);
  const position = String(player?.position || '').toUpperCase();
  const [statsPayload, logPayload] = await Promise.all([
    fetchJson(ctx, `/api/player-data?sport=${sport}&id=${encodeURIComponent(player.id)}&kind=stats&type=2`).then((x) => x.data),
    fetchJson(ctx, `/api/player-data?sport=${sport}&id=${encodeURIComponent(player.id)}&kind=gamelog&type=2&season=${encodeURIComponent(season)}`)
      .then((x) => x.data)
      .catch(() => null),
  ]);

  const categories = espnCategories(statsPayload, '2');
  const requested = sport === 'nfl' ? nflRecentMetric(article, position) : basketballRecentMetric(article);
  if (sport === 'nfl' && !requested) return null;
  const requestedKey = requested?.[0] || '';

  const preferred = sport === 'nfl'
    ? (position === 'QB'
      ? (requestedKey.startsWith('rushing') ? 'rushing' : 'passing')
      : ['RB', 'FB'].includes(position)
        ? (requestedKey.startsWith('receiving') || requestedKey === 'receptions' ? 'receiving' : 'rushing')
        : ['WR', 'TE'].includes(position) ? 'receiving' : 'defensive')
    : 'averages';

  const cat = sport === 'nfl'
    ? categories.find((c) => c.key === preferred && c.rows?.length) || null
    : firstUsableCategory(categories, preferred);
  const seasonRow = cat?.rows?.[0] || null;
  const log = logPayload ? espnGameLog(logPayload, season, '2') : { rows: [], names: [] };

  const fallbackMetric = sport !== 'nfl' ? ['points', 'Points']
    : cat?.key === 'passing' ? ['passingYards', 'Passing Yards']
      : cat?.key === 'rushing' ? ['rushingYards', 'Rushing Yards']
        : cat?.key === 'receiving' ? ['receivingYards', 'Receiving Yards']
          : cat?.key === 'defensive' ? ['totalTackles', 'Tackles']
            : null;
  const metric = requested && (log.names || []).includes(requested[0])
    ? requested
    : fallbackMetric && (log.names || []).includes(fallbackMetric[0]) ? fallbackMetric : null;
  const key = metric?.[0];
  const label = metric?.[1] || 'Recent form';
  const metricLive = key ? metricSummary(log.rows || [], (g) => g.values?.[key]) : metricSummary([], () => null);

  const preferredKeys = sport !== 'nfl'
    ? ['avgPoints', 'avgRebounds', 'avgAssists', 'threePointFieldGoalPct', 'avgBlocks', 'avgSteals']
    : cat?.key === 'passing' ? ['passingYards', 'passingTouchdowns', 'interceptions', 'completionPct']
      : cat?.key === 'rushing' ? ['rushingYards', 'rushingTouchdowns', 'yardsPerRushAttempt', 'rushingAttempts']
        : cat?.key === 'receiving' ? ['receptions', 'receivingYards', 'receivingTouchdowns', 'receivingTargets']
          : cat?.key === 'defensive' ? ['totalTackles', 'sacks', 'interceptions', 'passesDefended']
            : [];

  const seasonStats = cleanStats(preferredKeys.map((keyName) => {
    const idx = cat?.names?.indexOf(keyName);
    if (!(idx >= 0)) return null;
    const value = seasonRow?.values?.[keyName];
    // A 0.0 shooting percentage on a non-shooter says nothing; show the next stat.
    if (/Pct$/.test(keyName) && toNumber(value) === 0) return null;
    return [cat.labels?.[idx] || keyName, value];
  })).slice(0, 4);

  const data = {
    sport,
    role: cat?.key || null,
    name: player.name,
    image: player.image_url,
    label,
    rows: metricLive.rows,
    seasonStats,
    seasonLabel: seasonRow ? `${espnSeasonLabel(sport, seasonRow)} season` : '',
    seasonCurrent: seasonRow ? String(seasonRow.year) === season : false,
    metricLive,
  };

  if (sport === 'nba') {
    const winba = await fetchJson(ctx, `/api/pbe-intel?sport=nba&kind=winba&id=${encodeURIComponent(player.id)}`).catch(() => null);
    const model = winbaMetric(winba);
    if (model) data.modelMetrics = [model];
  }
  return data;
}

export function winbaMetric(payload) {
  const w = payload?.ok ? payload.winba : null;
  const score = w?.score == null || w.score === '' ? NaN : Number(w.score);
  if (!w || !Number.isFinite(score) || !['QUALIFIED', 'PROVISIONAL'].includes(String(w.status))) return null;
  const season = Number(w.season);
  const seasonLabel = Number.isFinite(season) ? `${season - 1}-${String(season).slice(-2)}` : '';
  const rank = Number(w.rank);
  const games = Number(w.sample?.games);
  return {
    label: 'PBE WinBA',
    value: score.toFixed(1),
    note: [Number.isFinite(rank) && rank > 0 ? `#${rank} NBA` : '', seasonLabel, Number.isFinite(games) ? `${games} GP` : '', w.status === 'PROVISIONAL' ? 'provisional' : ''].filter(Boolean).join(' · '),
    version: w.version || null,
  };
}

async function nhlPlayer(ctx, player, article) {
  const season = currentSeason('nhl');
  const [bio, logPayload] = await Promise.all([
    fetchJson(ctx, `/api/player-data?sport=nhl&id=${encodeURIComponent(player.id)}&kind=bio`).then((x) => x.data),
    fetchJson(ctx, `/api/player-data?sport=nhl&id=${encodeURIComponent(player.id)}&kind=gamelog&type=2&season=${encodeURIComponent(season)}`)
      .then((x) => x.data)
      .catch(() => null),
  ]);

  const goalie = String(bio?.position || player.position || '').toUpperCase() === 'G';
  const cat = nhlCategories(bio, '2')[0];
  const seasonRow = cat?.rows?.[0] || null;
  const [key, label] = nhlRecentMetric(article, goalie);
  const log = logPayload ? nhlGameLog(logPayload, season, '2', goalie) : { rows: [] };
  // Goalie logs carry shots against and goals against; saves are their exact
  // difference (SA − GA), never an estimate.
  const valueFor = goalie
    ? (g) => {
      const sa = toNumber(g.values?.shotsAgainst);
      const ga = toNumber(g.values?.goalsAgainst);
      return sa != null && ga != null && sa >= ga ? sa - ga : null;
    }
    : (g) => g.values?.[key];
  const metricLive = metricSummary(log.rows || [], valueFor);

  const preferred = goalie ? ['savePctg', 'goalsAgainstAvg', 'wins', 'shutouts'] : ['goals', 'assists', 'points', 'shots'];
  const seasonStats = cleanStats(preferred.map((keyName) => {
    const idx = cat?.names?.indexOf(keyName);
    return idx >= 0 ? [cat.labels?.[idx] || keyName, seasonRow?.values?.[keyName]] : null;
  })).slice(0, 4);

  return {
    sport: 'nhl',
    role: goalie ? 'goalie' : 'skater',
    name: player.name,
    image: player.image_url,
    label,
    rows: metricLive.rows,
    seasonStats,
    seasonLabel: seasonRow ? `${seasonRow.season} season` : '',
    seasonCurrent: seasonRow ? String(seasonRow.year) === season : false,
    metricLive,
  };
}

/* ---------------- team loader ---------------- */

async function teamIntelligence(ctx, team, sport) {
  if (!team?.slug) return null;
  const payload = await fetchJson(ctx, `/api/team-intelligence?sport=${encodeURIComponent(sport)}&slug=${encodeURIComponent(team.slug)}`);
  return teamDataFromPayload(payload, sport, ctx.now || Date.now());
}

/* ---------------- registry ---------------- */

const anyPlayer = (player) => Boolean(player?.id);

function adapter(sport, { player = null, playerSupports = anyPlayer, team = teamIntelligence } = {}) {
  const config = SPORT_CONFIG[sport] || {};
  return Object.freeze({
    sport,
    label: config.label || sport.toUpperCase(),
    intelligenceUrl: config.productUrl || null,
    team: team ? (ctx, entity) => team(ctx, entity, sport) : null,
    player: player ? (ctx, entity, article) => player(ctx, entity, article, sport) : null,
    playerSupports: player ? playerSupports : () => false,
  });
}

export const ARTICLE_DATA_ADAPTERS = Object.freeze({
  mlb: adapter('mlb', { player: mlbPlayer }),
  nfl: adapter('nfl', {
    player: espnPlayer,
    playerSupports: (player) => {
      const pos = String(player?.position || '').toUpperCase();
      return Boolean(player?.id) && (NFL_OFFENSE_SKILL.has(pos) || NFL_DEFENSE.has(pos));
    },
  }),
  nba: adapter('nba', { player: espnPlayer }),
  wnba: adapter('wnba', { player: espnPlayer }),
  nhl: adapter('nhl', { player: nhlPlayer }),
});

export function adapterFor(sport) {
  return ARTICLE_DATA_ADAPTERS[String(sport || '').toLowerCase()] || null;
}

export { NFL_DEFENSIVE_PROPS };
