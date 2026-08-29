/**
 * src/api-sports.js — v4
 *
 * Direct public API calls for the four-sport PropBetEdge score strip.
 * NFL now preserves ESPN team abbreviations, logos and records so the
 * shared score-strip renderer can display football teams visually.
 */

const NHL_PROXY = 'https://propbetedge-cors.sales-fd3.workers.dev';

function todayET() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function todayESPN() {
  return todayET().replace(/-/g, '');
}

async function fetchJson(url, opts = {}) {
  const r = await fetch(url, { credentials: 'omit', ...opts });
  if (!r.ok) throw new Error(`${url.split('?')[0]} ${r.status}`);
  return r.json();
}

async function mlbScheduleRaw(date) {
  const d = date || todayET();
  const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${d}&hydrate=probablePitcher,venue,team,linescore`;
  const data = await fetchJson(url);
  return { date: d, games: data?.dates?.[0]?.games || [] };
}

async function nbaScheduleRaw(date) {
  const d = date || todayESPN();
  let events = [];
  try {
    const playoff = await fetchJson(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${d}&seasontype=3`);
    events = playoff.events || [];
  } catch {}
  if (!events.length) {
    const reg = await fetchJson(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${d}`).catch(() => ({ events: [] }));
    events = reg.events || [];
  }
  const games = events.map((e) => {
    const comp = e.competitions?.[0] || {};
    const home = comp.competitors?.find((c) => c.homeAway === 'home') || {};
    const away = comp.competitors?.find((c) => c.homeAway === 'away') || {};
    return {
      id: e.id,
      name: e.name,
      date: e.date,
      status: e.status?.type?.description,
      statusState: e.status?.type?.state,
      statusDetail: e.status?.type?.shortDetail,
      period: e.status?.period,
      clock: e.status?.displayClock,
      home: home.team?.displayName,
      homeAbbr: home.team?.abbreviation,
      homeLogo: home.team?.logo,
      away: away.team?.displayName,
      awayAbbr: away.team?.abbreviation,
      awayLogo: away.team?.logo,
      homeScore: home.score,
      awayScore: away.score,
    };
  });
  return { games };
}

async function nbaSummaryRaw(gameId) {
  const summary = await fetchJson(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${gameId}`);
  const comp = summary?.header?.competitions?.[0] || {};
  const competitors = comp.competitors || [];
  const home = competitors.find((c) => c.homeAway === 'home') || competitors[0] || {};
  const away = competitors.find((c) => c.homeAway === 'away') || competitors[1] || {};
  return {
    gameId,
    header: {
      home: {
        id: home.id,
        abbr: home.team?.abbreviation,
        name: home.team?.displayName,
        logo: home.team?.logos?.[0]?.href || home.team?.logo,
        score: home.score,
        winner: home.winner,
        record: home.records?.[0]?.summary,
      },
      away: {
        id: away.id,
        abbr: away.team?.abbreviation,
        name: away.team?.displayName,
        logo: away.team?.logos?.[0]?.href || away.team?.logo,
        score: away.score,
        winner: away.winner,
        record: away.records?.[0]?.summary,
      },
      status: {
        state: comp.status?.type?.state,
        period: comp.status?.period,
        clock: comp.status?.displayClock,
        detail: comp.status?.type?.shortDetail,
        completed: comp.status?.type?.completed,
      },
    },
    boxscore: summary.boxscore || {},
    plays: summary.plays || [],
    winprobability: summary.winprobability || [],
  };
}

async function nhlScheduleRaw(date) {
  const d = date || todayET();
  const target = `https://api-web.nhle.com/v1/schedule/${d}`;
  const proxied = `${NHL_PROXY}/?url=${encodeURIComponent(target)}`;
  const data = await fetchJson(proxied);
  const today = (data?.gameWeek || []).find(w => w.date === d) || data?.gameWeek?.[0] || { games: [] };
  const games = (today.games || []).map((g) => ({
    id: g.id,
    date: g.startTimeUTC,
    status: g.gameState,
    away: g.awayTeam?.commonName?.default || g.awayTeam?.placeName?.default,
    awayAbbr: g.awayTeam?.abbrev,
    awayLogo: g.awayTeam?.logo,
    home: g.homeTeam?.commonName?.default || g.homeTeam?.placeName?.default,
    homeAbbr: g.homeTeam?.abbrev,
    homeLogo: g.homeTeam?.logo,
    awayScore: g.awayTeam?.score,
    homeScore: g.homeTeam?.score,
    venue: g.venue?.default,
  }));
  return { games };
}

function espnTeamLogo(team) {
  return team?.logo || team?.logos?.[0]?.href || null;
}

function recordSummary(competitor) {
  return competitor?.records?.find(r => r?.summary)?.summary || competitor?.records?.[0]?.summary || '';
}

async function nflScheduleRaw() {
  const data = await fetchJson('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard').catch(() => ({ events: [] }));
  const events = data?.events || [];
  const games = events.map((e) => {
    const comp = e.competitions?.[0] || {};
    const home = comp.competitors?.find((c) => c.homeAway === 'home') || {};
    const away = comp.competitors?.find((c) => c.homeAway === 'away') || {};
    return {
      id: e.id,
      name: e.name,
      date: e.date,
      status: e.status?.type?.description,
      statusState: e.status?.type?.state,
      statusDetail: e.status?.type?.shortDetail,
      period: e.status?.period,
      clock: e.status?.displayClock,
      home: home.team?.displayName,
      homeAbbr: home.team?.abbreviation,
      homeLogo: espnTeamLogo(home.team),
      homeRecord: recordSummary(home),
      away: away.team?.displayName,
      awayAbbr: away.team?.abbreviation,
      awayLogo: espnTeamLogo(away.team),
      awayRecord: recordSummary(away),
      homeScore: home.score,
      awayScore: away.score,
    };
  });
  return { games };
}

export const sports = {
  mlbSchedule: (date) => mlbScheduleRaw(date),
  nbaSchedule: (date) => nbaScheduleRaw(date),
  nhlSchedule: (date) => nhlScheduleRaw(date),
  nflSchedule: () => nflScheduleRaw(),

  mlbLinescore: (gamePk) => fetchJson(`https://statsapi.mlb.com/api/v1/game/${gamePk}/linescore`),
  mlbBoxscore: (gamePk) => fetchJson(`https://statsapi.mlb.com/api/v1/game/${gamePk}/boxscore`),
  async mlbPlays(gamePk, limit = 30) {
    const data = await fetchJson(`https://statsapi.mlb.com/api/v1/game/${gamePk}/playByPlay?startIndex=0`);
    const plays = data?.allPlays || [];
    return { gamePk, total: plays.length, recent: plays.slice(-limit) };
  },

  nbaSummary: (gameId) => nbaSummaryRaw(gameId),

  async allTodayScoreboards() {
    const results = await Promise.allSettled([
      this.mlbSchedule(),
      this.nbaSchedule(),
      this.nhlSchedule(),
      this.nflSchedule(),
    ]);
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.warn(`[sports-api] ${['mlb', 'nba', 'nhl', 'nfl'][i]} fetch failed:`, r.reason?.message || r.reason);
      }
    });
    return {
      mlb: results[0].status === 'fulfilled' ? results[0].value : { games: [] },
      nba: results[1].status === 'fulfilled' ? results[1].value : { games: [] },
      nhl: results[2].status === 'fulfilled' ? results[2].value : { games: [] },
      nfl: results[3].status === 'fulfilled' ? results[3].value : { games: [] },
    };
  },
};