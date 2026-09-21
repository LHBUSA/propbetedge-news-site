/**
 * src/entity-hub/refresh.js
 *
 * The one place an adapter is actually driven against a live upstream.
 *
 * Shared by the `pbe-entity-hub` Worker's scheduled refresh and by the
 * offline backfill auditor, so "what the cron writes" and "what the audit
 * measured" can never be two different pipelines.
 *
 * Failure contract: every function here returns `{ snapshot: null, reason }`
 * rather than throwing on an upstream problem. The caller decides what to do,
 * and the caller's rule is always the same — keep the last known good.
 */

import { allTeams, teamByAbbreviation, nhlTricode } from '../entity-graph/entities.js';
import * as nhl from './adapters/nhl.js';
import * as mlb from './adapters/mlb.js';
import * as nba from './adapters/nba.js';
import * as nfl from './adapters/nfl.js';

const TIMEOUT_MS = 9000;

/** MLB StatsAPI team ids, needed to read one club out of league-wide payloads. */
const MLB_TEAM_IDS = {
  ARI: 109, ATL: 144, BAL: 110, BOS: 111, CHC: 112, CHW: 145, CIN: 113, CLE: 114,
  COL: 115, DET: 116, HOU: 117, KC: 118, LAA: 108, LAD: 119, MIA: 146, MIL: 158,
  MIN: 142, NYM: 121, NYY: 147, ATH: 133, OAK: 133, PHI: 143, PIT: 134, SD: 135,
  SF: 137, SEA: 136, STL: 138, TB: 139, TEX: 140, TOR: 141, WSH: 120,
};

export function currentSeason(sport, now = new Date()) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  if (sport === 'mlb') return year;
  // NFL/NBA/NHL seasons span the new year; before roughly July the current
  // season is still the one that began last year.
  return month >= 7 ? year : year - 1;
}

/** Teams the refresher should walk for a sport — straight from the dictionary. */
export function teamRefreshTargets(sport) {
  return allTeams(sport).map((t) => ({ slug: t.slug, abbr: t.abbr, id: t.id, name: t.name }));
}

async function getJson(url, { headers = { Accept: 'application/json' }, timeoutMs = TIMEOUT_MS } = {}) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetch(url, { headers, ...(controller ? { signal: controller.signal } : {}) });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, data: await res.json() };
  } catch (error) {
    return { ok: false, status: 0, error: String(error?.message || error) };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// ─── players ─────────────────────────────────────────────────────────────────

export async function refreshPlayer(sport, id, { env = {} } = {}) {
  if (sport === 'nhl') return refreshNhlPlayer(id);
  if (sport === 'mlb') return refreshMlbPlayer(id);
  if (sport === 'nba') return refreshNbaPlayer(id);
  if (sport === 'nfl') return refreshNflPlayer(id);
  return { snapshot: null, reason: 'unsupported_sport' };
}

async function refreshNhlPlayer(id) {
  const url = `${nhl.NHL_GATEWAY}/nhl/player/${id}`;
  const res = await getJson(url, { headers: nhl.gatewayHeaders() });
  if (!res.ok) return { snapshot: null, reason: `upstream_${res.status}` };
  const snapshot = nhl.normalizePlayer(res.data, { url });
  return snapshot
    ? { snapshot, route: '/nhl/player/:id', sourceIds: [String(id)] }
    : { snapshot: null, reason: 'normalize_empty' };
}

async function refreshMlbPlayer(id) {
  const season = currentSeason('mlb');
  const personRes = await getJson(mlb.playerUrl(id, season));
  if (!personRes.ok) return { snapshot: null, reason: `upstream_${personRes.status}` };
  const person = personRes.data?.people?.[0];
  if (!person) return { snapshot: null, reason: 'person_not_found' };

  const group = mlb.statGroupsFor(person.primaryPosition?.abbreviation)[0];
  const logRes = await getJson(mlb.gameLogUrl(id, season, group));

  const snapshot = mlb.normalizePlayer(person, {
    gameLog: logRes.ok ? logRes.data : null,
    season,
    urls: [mlb.playerUrl(id, season), mlb.gameLogUrl(id, season, group)],
  });
  return snapshot
    ? { snapshot, route: '/people/:id', sourceIds: [String(id)] }
    : { snapshot: null, reason: 'normalize_empty' };
}

async function refreshNbaPlayer(id) {
  const athleteUrl = nba.relayUrl('athlete', { id });
  const res = await getJson(athleteUrl, { headers: nba.relayHeaders() });
  if (!res.ok) return { snapshot: null, reason: `upstream_${res.status}` };

  const logRes = await getJson(nba.relayUrl('gamelog', { id }), { headers: nba.relayHeaders() });
  const snapshot = nba.normalizePlayer(res.data, {
    gameLog: logRes.ok ? logRes.data : null,
    urls: [athleteUrl, nba.relayUrl('gamelog', { id })],
  });
  return snapshot
    ? { snapshot, route: 'nba-provider?r=athlete', sourceIds: [String(id)] }
    : { snapshot: null, reason: 'normalize_empty' };
}

async function refreshNflPlayer(id) {
  const url = nfl.playerUrl(id);
  const res = await getJson(url);
  if (!res.ok) return { snapshot: null, reason: `upstream_${res.status}` };
  const snapshot = nfl.normalizePlayer(res.data, { espnId: id, urls: [url] });
  return snapshot
    ? { snapshot, route: '/api/player-career', sourceIds: [String(id)] }
    : { snapshot: null, reason: 'normalize_empty' };
}

// ─── teams ───────────────────────────────────────────────────────────────────

export async function refreshTeam(sport, target, { env = {} } = {}) {
  if (sport === 'nhl') return refreshNhlTeam(target);
  if (sport === 'mlb') return refreshMlbTeam(target);
  if (sport === 'nba') return refreshNbaTeam(target);
  if (sport === 'nfl') return refreshNflTeam(target, env);
  return { snapshot: null, reason: 'unsupported_sport' };
}

async function refreshNhlTeam(target) {
  // NHL api-web wants its own tricode, not the ESPN abbreviation the
  // dictionary is keyed on. Five clubs differ and 404 without this.
  const tricode = nhlTricode(target.abbr);
  const rosterUrl = `${nhl.NHL_GATEWAY}/nhl/team/${tricode}/roster`;
  const standingsUrl = `${nhl.NHL_GATEWAY}/nhl/standings`;
  const [rosterRes, standingsRes] = await Promise.all([
    getJson(rosterUrl, { headers: nhl.gatewayHeaders() }),
    getJson(standingsUrl, { headers: nhl.gatewayHeaders() }),
  ]);
  if (!rosterRes.ok) return { snapshot: null, reason: `upstream_${rosterRes.status}` };

  const snapshot = nhl.buildTeam({
    slug: target.slug,
    abbrev: target.abbr,
    rosterPayload: rosterRes.data,
    standingsPayload: standingsRes.ok ? standingsRes.data : null,
  });
  return snapshot
    ? { snapshot, route: '/nhl/team/:tricode/roster', sourceIds: [tricode] }
    : { snapshot: null, reason: 'normalize_empty' };
}

async function refreshMlbTeam(target) {
  const season = currentSeason('mlb');
  const statsApiTeamId = MLB_TEAM_IDS[target.abbr];
  if (!statsApiTeamId) return { snapshot: null, reason: 'unmapped_team' };

  const [rosterRes, standingsRes] = await Promise.all([
    getJson(mlb.rosterUrl(statsApiTeamId, season)),
    getJson(mlb.standingsUrl(season)),
  ]);
  if (!rosterRes.ok) return { snapshot: null, reason: `upstream_${rosterRes.status}` };

  const snapshot = mlb.buildTeam({
    slug: target.slug,
    rosterPayload: rosterRes.data,
    standingsPayload: standingsRes.ok ? standingsRes.data : null,
    statsApiTeamId,
    urls: [mlb.rosterUrl(statsApiTeamId, season), mlb.standingsUrl(season)],
  });
  return snapshot
    ? { snapshot, route: '/teams/:id/roster/active', sourceIds: [String(statsApiTeamId)] }
    : { snapshot: null, reason: 'normalize_empty' };
}

async function refreshNbaTeam(target) {
  const espnTeamId = target.id; // dictionary team ids ARE ESPN team ids for NBA
  const [rosterRes, standingsRes] = await Promise.all([
    getJson(nba.relayUrl('roster', { team: espnTeamId }), { headers: nba.relayHeaders() }),
    getJson(nba.relayUrl('standings'), { headers: nba.relayHeaders() }),
  ]);
  if (!rosterRes.ok) return { snapshot: null, reason: `upstream_${rosterRes.status}` };

  const snapshot = nba.buildTeam({
    slug: target.slug,
    rosterPayload: rosterRes.data,
    standingsPayload: standingsRes.ok ? standingsRes.data : null,
    espnTeamId,
    urls: [nba.relayUrl('roster', { team: espnTeamId }), nba.relayUrl('standings')],
  });
  return snapshot
    ? { snapshot, route: 'nba-provider?r=roster', sourceIds: [String(espnTeamId)] }
    : { snapshot: null, reason: 'normalize_empty' };
}

/**
 * NFL teams need the PropSports key. Without it we still write an identity
 * snapshot so the page has a real hero and a working roster-less hub, and the
 * completeness counter reports `identity_only` rather than pretending.
 */
async function refreshNflTeam(target, env) {
  const key = env?.PROPSPORTS_API_KEY;
  const espnTeamId = target.id;

  if (!key) {
    const snapshot = nfl.buildTeam({ slug: target.slug });
    return snapshot
      ? { snapshot, route: 'identity_only(no_key)', sourceIds: [String(espnTeamId)] }
      : { snapshot: null, reason: 'normalize_empty' };
  }

  const headers = nfl.propsportsHeaders(key);
  const [rosterRes, standingsRes] = await Promise.all([
    getJson(nfl.rosterUrl(espnTeamId), { headers }),
    getJson(nfl.standingsUrl(), { headers }),
  ]);

  const snapshot = nfl.buildTeam({
    slug: target.slug,
    rosterPayload: rosterRes.ok ? rosterRes.data : null,
    standingsPayload: standingsRes.ok ? standingsRes.data : null,
    espnTeamId,
    urls: [nfl.rosterUrl(espnTeamId), nfl.standingsUrl()],
  });
  return snapshot
    ? { snapshot, route: '/v1/nfl/team/:id/roster', sourceIds: [String(espnTeamId)] }
    : { snapshot: null, reason: 'normalize_empty' };
}

export { MLB_TEAM_IDS };
