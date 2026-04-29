/**
 * src/api-sports.js — v2
 *
 * Direct public API calls (matches the pattern used in pbecast.js,
 * mlb-api.js, and other parts of the propbetedge stack).
 *
 *   MLB → statsapi.mlb.com           (CORS open)
 *   NBA → site.api.espn.com          (CORS open)
 *   NHL → api-web.nhle.com           (CORS open)
 *   NFL → site.api.espn.com          (CORS open)
 *
 * Why direct, not via propsports.proptechusa.ai:
 *   The PropSports API at propsports.proptechusa.ai works perfectly for
 *   server-to-server and curl, but the browser was hitting a CORS wall on
 *   www.propbetedge.ai → propsports.proptechusa.ai (likely a Pages /
 *   subdomain redirect strips CORS headers before the worker responds).
 *
 *   Fix: hit the underlying public APIs directly, the same way pbecast.js
 *   already does. PropSports API stays as the paid/server-side product.
 *
 * The "Powered by PropSports API" credit on the page is preserved — these
 * are the same data sources the API exposes, just called from the browser.
 */

// Today in ET (matches MLB API's date format)
function todayET() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

// Today in YYYYMMDD (ESPN's preferred format)
function todayESPN() {
  return todayET().replace(/-/g, '');
}

async function fetchJson(url, opts = {}) {
  const r = await fetch(url, { credentials: 'omit', ...opts });
  if (!r.ok) {
    throw new Error(`${url.split('?')[0]} ${r.status}`);
  }
  return r.json();
}

// ─── MLB (statsapi.mlb.com — public, CORS open) ────────────────────────────
async function mlbScheduleRaw(date) {
  const d = date || todayET();
  const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${d}&hydrate=probablePitcher,venue,team,linescore`;
  const data = await fetchJson(url);
  // Normalize to { games: [...] } so games-hub.js code keeps working unchanged
  return { date: d, games: data?.dates?.[0]?.games || [] };
}

// ─── NBA (ESPN scoreboard — public, CORS open) ─────────────────────────────
async function nbaScheduleRaw(date) {
  const d = date || todayESPN();
  // Try playoffs first, fall back to regular season
  let events = [];
  try {
    const playoff = await fetchJson(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${d}&seasontype=3`);
    events = playoff.events || [];
  } catch {}
  if (!events.length) {
    const reg = await fetchJson(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${d}`).catch(() => ({ events: [] }));
    events = reg.events || [];
  }
  // Map ESPN shape into the simplified shape games-hub.js expects (matches
  // the PropSports API's /nba/schedule output)
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
  // Build the same { header, boxscore, plays } shape as the PropSports API
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

// ─── NHL (api-web.nhle.com — public, CORS open) ────────────────────────────
async function nhlScheduleRaw(date) {
  const d = date || todayET();
  const data = await fetchJson(`https://api-web.nhle.com/v1/schedule/${d}`);
  const games = (data?.gameWeek?.[0]?.games || []).map((g) => ({
    id: g.id,
    date: g.startTimeUTC,
    status: g.gameState,
    away: g.awayTeam?.commonName?.default,
    home: g.homeTeam?.commonName?.default,
    awayScore: g.awayTeam?.score,
    homeScore: g.homeTeam?.score,
    venue: g.venue?.default,
  }));
  return { games };
}

// ─── NFL (ESPN scoreboard — public, CORS open) ─────────────────────────────
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
      home: home.team?.displayName,
      away: away.team?.displayName,
      homeScore: home.score,
      awayScore: away.score,
    };
  });
  return { games };
}

// ─── Public API ────────────────────────────────────────────────────────────
export const sports = {
  mlbSchedule: (date) => mlbScheduleRaw(date),
  nbaSchedule: (date) => nbaScheduleRaw(date),
  nhlSchedule: (date) => nhlScheduleRaw(date),
  nflSchedule: ()     => nflScheduleRaw(),

  // ── MLB game detail ───────────────────────────────────────────────────
  mlbLinescore: (gamePk) => fetchJson(`https://statsapi.mlb.com/api/v1/game/${gamePk}/linescore`),
  mlbBoxscore:  (gamePk) => fetchJson(`https://statsapi.mlb.com/api/v1/game/${gamePk}/boxscore`),
  async mlbPlays(gamePk, limit = 30) {
    const data = await fetchJson(`https://statsapi.mlb.com/api/v1/game/${gamePk}/playByPlay?startIndex=0`);
    const plays = data?.allPlays || [];
    return { gamePk, total: plays.length, recent: plays.slice(-limit) };
  },

  // ── NBA game detail ───────────────────────────────────────────────────
  nbaSummary: (gameId) => nbaSummaryRaw(gameId),

  // ── Convenience: 4-sport hub fetch ────────────────────────────────────
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
