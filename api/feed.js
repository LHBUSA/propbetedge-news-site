/**
 * Same-origin sports data gateway (PropSports architecture, 2026-10-03).
 *
 * Browser -> /api/feed (this origin) -> upstream, never Browser -> upstream. The browser bundle carries no
 * provider hostnames; they live only here. Read-only, fixed-source, allowlisted feeds — not an open proxy:
 * every feed name maps to one URL template and every parameter is validated before it reaches a URL.
 * Payloads pass through unchanged, so the callers keep their existing parsing.
 *
 * Caching: live feeds (scoreboards, summaries, schedules, game data) are shared at the edge for a few seconds
 * so many readers collapse into one upstream request; slow-moving feeds (leaders, standings, player stats) for
 * minutes. Callers no longer add cache-busting query params, so the edge cache key is stable.
 */
const LIVE = 'public, max-age=0, s-maxage=10, stale-while-revalidate=20';
const SLOW = 'public, max-age=60, s-maxage=300, stale-while-revalidate=600';

const MLB = 'https://statsapi.mlb.com/api/v1';
const ESPN_SITE = 'https://site.api.espn.com/apis/site/v2/sports';
const ESPN_V2 = 'https://site.api.espn.com/apis/v2/sports';
const NHL = 'https://api-web.nhle.com/v1';

const ESPN_LEAGUES = { mlb: 'baseball/mlb', nfl: 'football/nfl', nba: 'basketball/nba', nhl: 'hockey/nhl', wnba: 'basketball/wnba' };
const MLB_GROUPS = new Set(['hitting', 'pitching', 'fielding']);

const re = {
  date: /^\d{4}-\d{2}-\d{2}$/,
  espnDate: /^\d{8}$/,
  id: /^\d{1,12}$/,
  year: /^\d{4}$/,
  nhlSeason: /^\d{8}$/,
  cats: /^[A-Za-z]{2,40}(,[A-Za-z]{2,40}){0,12}$/,
};

function need(q, key, pattern) {
  const v = q[key] == null ? '' : String(q[key]);
  if (!pattern.test(v)) throw new Error(`Invalid ${key}`);
  return v;
}
function limitOf(q, max) {
  const n = Number(q.limit ?? 10);
  if (!Number.isInteger(n) || n < 1 || n > max) throw new Error('Invalid limit');
  return n;
}
function league(q, allowed) {
  const s = String(q.sport || '').toLowerCase();
  if (!allowed.includes(s)) throw new Error('Invalid sport');
  return ESPN_LEAGUES[s];
}

// feed -> (validated query) -> { url, cache }
export const FEEDS = {
  'mlb-schedule': (q) => ({ url: `${MLB}/schedule?sportId=1&date=${need(q, 'date', re.date)}&hydrate=probablePitcher,venue,team,linescore`, cache: LIVE }),
  'mlb-linescore': (q) => ({ url: `${MLB}/game/${need(q, 'gamePk', re.id)}/linescore`, cache: LIVE }),
  'mlb-boxscore': (q) => ({ url: `${MLB}/game/${need(q, 'gamePk', re.id)}/boxscore`, cache: LIVE }),
  'mlb-playbyplay': (q) => ({ url: `${MLB}/game/${need(q, 'gamePk', re.id)}/playByPlay?startIndex=0`, cache: LIVE }),
  'mlb-leaders': (q) => {
    const group = String(q.group || '');
    if (!MLB_GROUPS.has(group)) throw new Error('Invalid group');
    return { url: `${MLB}/stats/leaders?leaderCategories=${need(q, 'cats', re.cats)}&statGroup=${group}&season=${need(q, 'season', re.year)}&limit=${limitOf(q, 50)}`, cache: SLOW };
  },
  // Player page and article chart: person + stats in one request (two fixed hydrate shapes).
  'mlb-person': (q) => {
    const types = q.view === 'article' ? 'season,gameLog' : 'season,career,gameLog';
    return { url: `${MLB}/people/${need(q, 'id', re.id)}?hydrate=stats(group=[hitting,pitching],type=[${types}],season=${need(q, 'season', re.year)},sportId=1),currentTeam`, cache: SLOW };
  },
  'mlb-person-season-hitting': (q) => ({ url: `${MLB}/people/${need(q, 'id', re.id)}/stats?stats=season&group=hitting&season=${need(q, 'season', re.year)}&sportId=1`, cache: SLOW }),

  'espn-scoreboard': (q) => {
    const path = league(q, ['nba', 'wnba', 'nfl']);
    const qs = new URLSearchParams();
    if (q.dates != null) qs.set('dates', need(q, 'dates', re.espnDate));
    if (q.seasontype != null) qs.set('seasontype', need(q, 'seasontype', /^[123]$/));
    return { url: `${ESPN_SITE}/${path}/scoreboard${qs.size ? '?' + qs : ''}`, cache: LIVE };
  },
  'espn-summary': (q) => ({ url: `${ESPN_SITE}/${league(q, ['nba', 'nfl', 'nhl'])}/summary?event=${need(q, 'event', re.id)}`, cache: LIVE }),
  'espn-standings': (q) => ({ url: `${ESPN_V2}/${league(q, ['mlb', 'nfl', 'nba', 'nhl', 'wnba'])}/standings`, cache: SLOW }),
  'espn-leaders': (q) => ({ url: `${ESPN_V2}/${league(q, ['nba'])}/leaders?season=${need(q, 'season', re.year)}&seasontype=${need(q, 'seasontype', /^[123]$/)}`, cache: SLOW }),

  'nhl-landing': (q) => ({ url: `${NHL}/gamecenter/${need(q, 'gameId', re.id)}/landing`, cache: LIVE }),
  'nhl-schedule': (q) => ({ url: `${NHL}/schedule/${need(q, 'date', re.date)}`, cache: LIVE }),
  'nhl-skater-leaders': (q) => ({ url: `${NHL}/skater-stats-leaders/${need(q, 'season', re.nhlSeason)}/${need(q, 'gameType', /^[23]$/)}?categories=${need(q, 'cats', re.cats)}&limit=${limitOf(q, 50)}`, cache: SLOW }),
  'nhl-goalie-leaders': (q) => ({ url: `${NHL}/goalie-stats-leaders/${need(q, 'season', re.nhlSeason)}/${need(q, 'gameType', /^[23]$/)}?categories=${need(q, 'cats', re.cats)}&limit=${limitOf(q, 50)}`, cache: SLOW }),
};

/** Resolve a validated feed request to its fixed upstream URL. Throws on anything off the allowlist. */
export function resource(query = {}) {
  if (Object.values(query).some((v) => Array.isArray(v) || (v !== null && typeof v === 'object'))) throw new Error('Invalid query');
  const make = Object.prototype.hasOwnProperty.call(FEEDS, String(query.feed)) ? FEEDS[String(query.feed)] : null;
  if (!make) throw new Error('Unknown feed');
  return make(query);
}

export default async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); res.setHeader('Cache-Control', 'no-store'); return res.status(405).json({ ok: false, error: 'method_not_allowed' }); }
  let target;
  try { target = resource(req.query || {}); }
  catch (e) { res.setHeader('Cache-Control', 'no-store'); return res.status(400).json({ ok: false, error: e.message }); }
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const response = await fetch(target.url, { headers: { accept: 'application/json' }, signal: ctrl.signal, redirect: 'error' });
    if (!response.ok) {
      // Mirror not-found (callers treat !ok as empty); everything else is a soft, briefly cached unavailability.
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=15');
      return res.status(response.status === 404 || response.status === 400 ? response.status : 503).json({ ok: false, error: 'source_unavailable' });
    }
    const data = await response.json();
    res.setHeader('Cache-Control', target.cache);
    return res.status(200).json(data);
  } catch {
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=15');
    return res.status(503).json({ ok: false, error: 'source_unavailable' });
  } finally {
    clearTimeout(timer);
  }
}
