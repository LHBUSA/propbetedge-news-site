/**
 * api/game-lookup.js
 *
 * Read-only, fixed-source resolver: which permanent PropBetEdge game page does
 * a matchup around a given date correspond to?
 *
 * GET /api/game-lookup?sport=nfl&date=20260921&teams=MIN,GB
 *   200 { ok: true,  game: { id, name, start_date, status, home_abbr, away_abbr } }
 *   200 { ok: false, reason: 'no_match' | 'ambiguous' }
 *   400 invalid request
 *   503 upstream unavailable
 *
 * Two deliberate choices:
 *
 * 1. "No confident match" is a 200, not a 404. It is a legitimate answer to a
 *    query — most stories are not about one specific game — and answering 404
 *    would print a console error on every such article for every reader.
 *
 * 2. The date window (the given day ± 1) is searched HERE, in parallel, rather
 *    than by the caller making three sequential requests. Article rendering
 *    waits on this endpoint, so it gets one round trip, not three.
 *
 * Strictness is the point: it answers only when exactly one game across the
 * whole window has both teams. Anything else is reported as no match rather
 * than guessed, so a story can never be attached to the wrong game.
 */

import { teamByAbbreviation } from '../src/entity-graph/entities.js';
import { normalizeName } from '../src/entity-graph/text.js';

const LEAGUES = {
  mlb: 'baseball/mlb',
  nfl: 'football/nfl',
  nba: 'basketball/nba',
  nhl: 'hockey/nhl',
};

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const sport = String(req.query?.sport || '').toLowerCase();
  const date = String(req.query?.date || '');
  const teams = String(req.query?.teams || '')
    .split(',')
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);

  if (!LEAGUES[sport] || !/^\d{8}$/.test(date) || teams.length !== 2) {
    return res.status(400).json({ ok: false, error: 'invalid_request' });
  }

  try {
    const days = windowAround(date);

    // MLB game pages resolve an MLB StatsAPI gamePk, every other league an ESPN
    // event id. Returning an ESPN id for MLB produced a chip that linked to a
    // 404, so each sport is resolved against the source its own route uses.
    if (sport === 'mlb') return await resolveMlbGame(res, days, teams);

    const scoreboards = await Promise.all(days.map((day) => loadScoreboard(sport, day)));

    if (scoreboards.every((board) => board === null)) {
      res.setHeader('Retry-After', '120');
      return res.status(503).json({ ok: false, error: 'source_unavailable' });
    }

    const matches = [];
    for (const board of scoreboards) {
      for (const event of board?.events || []) {
        const competitors = event?.competitions?.[0]?.competitors || [];
        const abbrs = competitors
          .map((c) => String(c?.team?.abbreviation || '').toUpperCase())
          .filter(Boolean);
        if (teams.every((t) => abbrs.includes(t))) matches.push(event);
      }
    }

    // A doubleheader, or the same pairing on consecutive days, is genuinely
    // ambiguous from a story's date alone. Report it rather than pick one.
    const unique = dedupeById(matches);
    if (unique.length !== 1) {
      res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
      return res.status(200).json({
        ok: false,
        reason: unique.length === 0 ? 'no_match' : 'ambiguous',
        candidates: unique.length,
      });
    }

    const event = unique[0];
    const competition = event?.competitions?.[0] || {};
    const competitors = competition.competitors || [];
    const home = competitors.find((c) => c?.homeAway === 'home');
    const away = competitors.find((c) => c?.homeAway === 'away');

    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).json({
      ok: true,
      game: {
        sport,
        id: String(event.id),
        name: event.name || event.shortName || null,
        start_date: event.date || null,
        status: competition?.status?.type?.shortDetail || event?.status?.type?.shortDetail || null,
        home_abbr: String(home?.team?.abbreviation || '').toUpperCase() || null,
        away_abbr: String(away?.team?.abbreviation || '').toUpperCase() || null,
      },
    });
  } catch (error) {
    console.warn('[game-lookup]', error?.message || error);
    res.setHeader('Retry-After', '120');
    return res.status(503).json({ ok: false, error: 'source_unavailable' });
  }
}


/**
 * MLB, resolved against MLB StatsAPI so the id we hand back is the gamePk that
 * /games/mlb/:id actually looks up. Matching is on full team names rather than
 * abbreviations: StatsAPI and ESPN disagree on several (CWS vs CHW, AZ vs ARI),
 * and a name comparison cannot silently match the wrong club.
 */
async function resolveMlbGame(res, days, teams) {
  const wanted = teams
    .map((abbr) => teamByAbbreviation('mlb', abbr)?.name)
    .filter(Boolean)
    .map((name) => normalizeName(name));

  if (wanted.length !== 2) {
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({ ok: false, reason: 'no_match', candidates: 0 });
  }

  const start = isoDay(days[1]);
  const end = isoDay(days[2]);
  const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=${start}&endDate=${end}&hydrate=team`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  let data;
  try {
    const upstream = await fetch(url, { headers: { accept: 'application/json' }, signal: controller.signal });
    if (!upstream.ok) {
      res.setHeader('Retry-After', '120');
      return res.status(503).json({ ok: false, error: 'source_unavailable' });
    }
    data = await upstream.json();
  } catch {
    res.setHeader('Retry-After', '120');
    return res.status(503).json({ ok: false, error: 'source_unavailable' });
  } finally {
    clearTimeout(timer);
  }

  const games = (data?.dates || []).flatMap((row) => row?.games || []);
  const matches = games.filter((game) => {
    const home = normalizeName(game?.teams?.home?.team?.name);
    const away = normalizeName(game?.teams?.away?.team?.name);
    return wanted.includes(home) && wanted.includes(away) && home !== away;
  });

  const unique = [];
  const seen = new Set();
  for (const game of matches) {
    const id = String(game?.gamePk || '');
    if (id && !seen.has(id)) { seen.add(id); unique.push(game); }
  }

  if (unique.length !== 1) {
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({
      ok: false,
      reason: unique.length === 0 ? 'no_match' : 'ambiguous',
      candidates: unique.length,
    });
  }

  const game = unique[0];
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
  return res.status(200).json({
    ok: true,
    game: {
      sport: 'mlb',
      id: String(game.gamePk),
      name: `${game?.teams?.away?.team?.name} at ${game?.teams?.home?.team?.name}`,
      start_date: game.gameDate || null,
      status: game?.status?.detailedState || null,
      home_abbr: teams.find((t) => normalizeName(teamByAbbreviation('mlb', t)?.name) === normalizeName(game?.teams?.home?.team?.name)) || null,
      away_abbr: teams.find((t) => normalizeName(teamByAbbreviation('mlb', t)?.name) === normalizeName(game?.teams?.away?.team?.name)) || null,
    },
  });
}

/** YYYYMMDD -> YYYY-MM-DD */
function isoDay(stamp) {
  return `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}`;
}

/** The publication day and its neighbours: a story is about a game near it. */
function windowAround(stamp) {
  const year = Number(stamp.slice(0, 4));
  const month = Number(stamp.slice(4, 6));
  const day = Number(stamp.slice(6, 8));
  const base = Date.UTC(year, month - 1, day);
  return [0, -1, 1].map((offset) => {
    const d = new Date(base + offset * DAY_MS);
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
  });
}

async function loadScoreboard(sport, day) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/${LEAGUES[sport]}/scoreboard?dates=${day}&limit=100`;
    const upstream = await fetch(url, { headers: { accept: 'application/json' }, signal: controller.signal });
    if (!upstream.ok) return null;
    return await upstream.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function dedupeById(events) {
  const byId = new Map();
  for (const event of events) {
    const id = String(event?.id || '');
    if (id && !byId.has(id)) byId.set(id, event);
  }
  return [...byId.values()];
}

function pad(value) {
  return String(value).padStart(2, '0');
}
