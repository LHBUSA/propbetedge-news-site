/**
 * src/api-sports.js
 * PropSports API client — powers the Live Games layer.
 *
 * API: https://propsports.proptechusa.ai (free public endpoints, no key needed
 *      for /mlb/schedule, /nba/schedule, /nhl/schedule, /nfl/schedule and
 *      /games/live across all sports + /nba/game/:id/* summary endpoints)
 *
 * Owner: Justin Erickson — built on PropTechUSA.ai
 *
 * v1: scoreboard hub + MLB game detail + NBA game detail (rich shotchart, plays, win prob)
 *     NFL/NHL fall back to schedule-only on the detail view (kept intentionally
 *     light because the PUBLIC tier of the API is what powers this layer; deeper
 *     stats are paid endpoints).
 */

const SPORTS_API = 'https://propsports.proptechusa.ai/api';

async function fetchJson(path) {
  const r = await fetch(`${SPORTS_API}${path}`, { credentials: 'omit' });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`PropSports API ${r.status}: ${text.slice(0, 160)}`);
  }
  return await r.json();
}

export const sports = {
  // ── Schedules (public, no key) ──────────────────────────────────────────
  mlbSchedule:  (date) => fetchJson(`/mlb/schedule${date ? `?date=${date}` : ''}`),
  nflSchedule: ()      => fetchJson('/nfl/schedule'),
  nbaSchedule:  (date) => fetchJson(`/nba/schedule${date ? `?date=${date}` : ''}`),
  nhlSchedule:  (date) => fetchJson(`/nhl/schedule${date ? `?date=${date}` : ''}`),

  // ── Live games filter (public) ──────────────────────────────────────────
  mlbLive: () => fetchJson('/mlb/games/live'),
  nflLive: () => fetchJson('/nfl/games/live'),
  nbaLive: () => fetchJson('/nba/games/live'),
  nhlLive: () => fetchJson('/nhl/games/live'),

  // ── MLB game detail ────────────────────────────────────────────────────
  mlbLinescore: (gamePk) => fetchJson(`/mlb/game/${gamePk}/linescore`),
  mlbBoxscore:  (gamePk) => fetchJson(`/mlb/game/${gamePk}/boxscore`),
  mlbPlays:     (gamePk, limit = 30) => fetchJson(`/mlb/game/${gamePk}/plays?limit=${limit}`),

  // ── NBA game detail (public via ESPN summary) ───────────────────────────
  nbaSummary:   (gameId) => fetchJson(`/nba/game/${gameId}/summary`),
  nbaBoxscore:  (gameId) => fetchJson(`/nba/game/${gameId}/boxscore`),
  nbaPlays:     (gameId, limit = 30) => fetchJson(`/nba/game/${gameId}/plays?limit=${limit}`),
  nbaWinProb:   (gameId) => fetchJson(`/nba/game/${gameId}/winprob`),
  nbaShotChart: (gameId) => fetchJson(`/nba/game/${gameId}/shotchart`),

  // ── NFL/NHL: schedule only on the public side; detail comes later ───────

  // ── Convenience: fetch all 4 in parallel for hub page ──────────────────
  async allTodayScoreboards() {
    const results = await Promise.allSettled([
      this.mlbSchedule(),
      this.nbaSchedule(),
      this.nhlSchedule(),
      this.nflSchedule(),
    ]);
    return {
      mlb: results[0].status === 'fulfilled' ? results[0].value : { games: [] },
      nba: results[1].status === 'fulfilled' ? results[1].value : { games: [] },
      nhl: results[2].status === 'fulfilled' ? results[2].value : { games: [] },
      nfl: results[3].status === 'fulfilled' ? results[3].value : { games: [] },
    };
  },
};
