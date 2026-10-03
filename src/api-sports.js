import { feedUrl } from './feed-url.js';
/**
 * src/api-sports.js — v4
 *
 * Score-strip data through the same-origin PropSports feed gateway (/api/feed).
 * NFL now preserves ESPN team abbreviations, logos and records so the
 * shared score-strip renderer can display football teams visually.
 */


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
  const url = feedUrl('mlb-schedule', { date: d });
  const data = await fetchJson(url);
  return { date: d, games: data?.dates?.[0]?.games || [] };
}

async function nbaScheduleRaw(date) {
  const d = date || todayESPN();
  let events = [];
  try {
    const playoff = await fetchJson(feedUrl('espn-scoreboard', { sport: 'nba', dates: d, seasontype: 3 }));
    events = playoff.events || [];
  } catch {}
  if (!events.length) {
    const reg = await fetchJson(feedUrl('espn-scoreboard', { sport: 'nba', dates: d })).catch(() => ({ events: [] }));
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

async function wnbaScheduleRaw(date) {
  const d = date || todayESPN();
  const data = await fetchJson(feedUrl('espn-scoreboard', { sport: 'wnba', dates: d }))
    .catch(() => ({ events: [] }));
  const games = (data.events || []).map((e) => {
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

async function nbaSummaryRaw(gameId) {
  const summary = await fetchJson(feedUrl('espn-summary', { sport: 'nba', event: gameId }));
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

async function nflSummaryRaw(gameId) {
  const summary = await fetchJson(feedUrl('espn-summary', { sport: 'nfl', event: gameId }));
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
      venue: comp.venue?.fullName || '',
    },
    boxscore: summary.boxscore || {},
    plays: summary.plays || [],
    drives: summary.drives || {},
    scoringPlays: summary.scoringPlays || [],
  };
}

async function nhlSummaryRaw(gameId) {
  const summary = await fetchJson(feedUrl('espn-summary', { sport: 'nhl', event: gameId }));
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
      venue: comp.venue?.fullName || '',
    },
    boxscore: summary.boxscore || {},
    plays: summary.plays || [],
    scoringPlays: summary.scoringPlays || [],
  };
}

async function nhlGameRaw(gameId) {
  return fetchJson(feedUrl('nhl-landing', { gameId }));
}


async function nhlScheduleRaw(date) {
  const d = date || todayET();
  const data = await fetchJson(feedUrl('nhl-schedule', { date: d }));
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
  const data = await fetchJson(feedUrl('espn-scoreboard', { sport: 'nfl' })).catch(() => ({ events: [] }));
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
  wnbaSchedule: (date) => wnbaScheduleRaw(date),
  nhlSchedule: (date) => nhlScheduleRaw(date),
  nflSchedule: () => nflScheduleRaw(),

  mlbLinescore: (gamePk) => fetchJson(feedUrl('mlb-linescore', { gamePk })),
  mlbBoxscore: (gamePk) => fetchJson(feedUrl('mlb-boxscore', { gamePk })),
  async mlbPlays(gamePk, limit = 30) {
    const data = await fetchJson(feedUrl('mlb-playbyplay', { gamePk }));
    const plays = data?.allPlays || [];
    return { gamePk, total: plays.length, recent: plays.slice(-limit) };
  },

  nbaSummary: (gameId) => nbaSummaryRaw(gameId),
  nflSummary: (gameId) => nflSummaryRaw(gameId),
  nhlSummary: (gameId) => nhlSummaryRaw(gameId),
  nhlGame: (gameId) => nhlGameRaw(gameId),

  async allTodayScoreboards() {
    const results = await Promise.allSettled([
      this.mlbSchedule(),
      this.nbaSchedule(),
      this.wnbaSchedule(),
      this.nhlSchedule(),
      this.nflSchedule(),
    ]);
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.warn(`[sports-api] ${['mlb', 'nba', 'wnba', 'nhl', 'nfl'][i]} fetch failed:`, r.reason?.message || r.reason);
      }
    });
    return {
      mlb: results[0].status === 'fulfilled' ? results[0].value : { games: [] },
      nba: results[1].status === 'fulfilled' ? results[1].value : { games: [] },
      wnba: results[2].status === 'fulfilled' ? results[2].value : { games: [] },
      nhl: results[3].status === 'fulfilled' ? results[3].value : { games: [] },
      nfl: results[4].status === 'fulfilled' ? results[4].value : { games: [] },
    };
  },
};