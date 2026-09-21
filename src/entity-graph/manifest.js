/**
 * src/entity-graph/manifest.js
 *
 * Turns one article into its deterministic entity manifest.
 *
 * Preference order is fixed and applies everywhere:
 *   1. article.entities        — persisted manifest, if the API ever supplies one
 *   2. deterministic derivation from the article + committed dictionary
 *   3. nothing. An entity that does not resolve is reported, never guessed.
 *
 * The manifest is the only thing downstream modules (linkifier, In this story,
 * schema, related coverage, share image) are allowed to consult, so SSR and the
 * client always describe the same graph.
 */

import {
  resolvePlayer, resolveTeam, playersBySurname, allTeams, allPlayers,
  teamByAbbreviation, SUPPORTED_SPORTS, SITE,
} from './entities.js';
import { normalizeName, normalizeTokens, nameMatchPattern, LEADING_BOUNDARY, TRAILING_BOUNDARY } from './text.js';

export const MAX_MANIFEST_PLAYERS = 12;
export const MAX_MANIFEST_TEAMS = 6;

/** Plain, tag-free text of an article. Mirrors the SSR body extraction. */
export function articleText(article) {
  const raw = article?.body || stripHtml(article?.body_html || '') || article?.summary || '';
  return String(raw)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~`]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|h[1-6]|li|section|article|blockquote)>/gi, '\n\n')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/**
 * Build the manifest. Pure and synchronous — game enrichment is a separate,
 * optional async step so article text never waits on a network call.
 */
export function buildEntityManifest(article) {
  const sport = String(article?.sport || '').toLowerCase();
  const empty = {
    version: 1,
    sport,
    source: 'none',
    players: [],
    teams: [],
    games: [],
    unresolved: [],
  };
  if (!article || !SUPPORTED_SPORTS.includes(sport)) return empty;

  // 1. Persisted manifest wins outright, once the API carries one.
  const persisted = adoptPersistedManifest(article, sport);
  if (persisted) return persisted;

  const unresolved = [];
  const teams = [];
  const teamSeen = new Set();

  const addTeam = (entity, origin) => {
    if (!entity || teamSeen.has(entity.id)) return;
    teamSeen.add(entity.id);
    teams.push({ ...toTeamManifest(entity), origin });
  };

  // 2a. Structured team tags from the newsroom tagger (abbreviations).
  for (const tag of asArray(article?.take?.teams)) {
    const entity = resolveTeam(sport, tag);
    if (entity) addTeam(entity, 'take');
    else unresolved.push({ kind: 'team', mention: String(tag), reason: 'unknown' });
  }
  for (const tag of asArray(article?.teams)) {
    const entity = resolveTeam(sport, tag);
    if (entity) addTeam(entity, 'article');
    else unresolved.push({ kind: 'team', mention: String(tag), reason: 'unknown' });
  }

  const haystack = `${article.title || ''} \n ${article.summary || ''} \n ${articleText(article)}`;
  const normalizedHaystack = ` ${normalizeName(haystack)} `;

  // 2b. Teams named in full anywhere in the story.
  for (const team of allTeams(sport)) {
    if (teamSeen.has(team.id)) continue;
    const spellings = [team.name];
    if (team.location && team.nickname) spellings.push(`${team.location} ${team.nickname}`);
    if (spellings.some((s) => normalizedHaystack.includes(` ${normalizeName(s)} `))) {
      addTeam(team, 'text');
    }
  }

  const teamHints = teams.map((t) => t.id);

  // 2c. Players: structured tags first, then full names found in the copy.
  const players = [];
  const playerSeen = new Set();
  const addPlayer = (entity, origin) => {
    if (!entity || playerSeen.has(entity.id)) return;
    playerSeen.add(entity.id);
    players.push({ ...toPlayerManifest(entity), origin });
  };

  for (const tag of [...asArray(article?.take?.players), ...asArray(article?.players)]) {
    const name = typeof tag === 'string' ? tag : tag?.name;
    if (!name) continue;
    const { entity, reason, candidates } = resolvePlayer(sport, name, { teamHints });
    if (entity) addPlayer(entity, 'take');
    else unresolved.push({ kind: 'player', mention: String(name), reason, candidates });
  }

  for (const entity of scanPlayersInText(sport, haystack, teamHints, unresolved)) {
    addPlayer(entity, 'text');
  }

  return {
    version: 1,
    sport,
    source: 'derived',
    players: players.slice(0, MAX_MANIFEST_PLAYERS),
    teams: teams.slice(0, MAX_MANIFEST_TEAMS),
    games: [],
    unresolved,
  };
}

/**
 * Full-name scan. Candidates come from a surname index so a story is tested
 * against a handful of players, not the whole league.
 */
function scanPlayersInText(sport, haystack, teamHints, unresolved) {
  const tokens = new Set(normalizeTokens(haystack));
  const candidates = new Map();

  for (const token of tokens) {
    for (const player of playersBySurname(sport, token)) {
      candidates.set(player.id, player);
    }
  }

  const found = [];
  const byName = new Map();
  for (const player of candidates.values()) {
    const pattern = nameMatchPattern(player.name);
    if (!pattern) continue;
    const re = new RegExp(`${LEADING_BOUNDARY}(?:${pattern})${TRAILING_BOUNDARY}`);
    if (!re.test(haystack)) continue;
    const key = normalizeName(player.name);
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(player);
  }

  const hints = new Set(teamHints.filter(Boolean));
  for (const [key, matches] of byName) {
    if (matches.length === 1) {
      found.push(matches[0]);
      continue;
    }
    const narrowed = matches.filter((p) => p.team_id && hints.has(p.team_id));
    if (narrowed.length === 1) {
      found.push(narrowed[0]);
      continue;
    }
    unresolved.push({
      kind: 'player',
      mention: matches[0].name,
      reason: 'ambiguous',
      candidates: matches.map((p) => p.canonical_url),
    });
  }

  // Stable output regardless of Map iteration order.
  found.sort((a, b) => (a.name === b.name ? (a.id < b.id ? -1 : 1) : (a.name < b.name ? -1 : 1)));
  return found;
}

/**
 * Accept a persisted manifest only when every entity in it carries a real id
 * that still resolves. A persisted row must never be able to inject a URL the
 * dictionary cannot vouch for.
 */
function adoptPersistedManifest(article, sport) {
  const raw = article?.entities;
  if (!raw || typeof raw !== 'object') return null;
  const rawPlayers = asArray(raw.players);
  const rawTeams = asArray(raw.teams);
  if (!rawPlayers.length && !rawTeams.length) return null;

  const unresolved = [];
  const players = [];
  const teams = [];

  for (const row of rawPlayers) {
    const id = row?.id != null ? String(row.id) : '';
    const entity = id ? findPlayerById(sport, id) : null;
    if (entity) players.push({ ...toPlayerManifest(entity), origin: 'persisted' });
    else unresolved.push({ kind: 'player', mention: row?.name || id, reason: 'persisted_id_unknown' });
  }
  for (const row of rawTeams) {
    const entity = resolveTeam(sport, row?.id ?? row?.abbreviation ?? row?.name);
    if (entity) teams.push({ ...toTeamManifest(entity), origin: 'persisted' });
    else unresolved.push({ kind: 'team', mention: row?.name || row?.id, reason: 'persisted_id_unknown' });
  }

  if (!players.length && !teams.length) return null;

  return {
    version: 1,
    sport,
    source: 'persisted',
    players: players.slice(0, MAX_MANIFEST_PLAYERS),
    teams: teams.slice(0, MAX_MANIFEST_TEAMS),
    games: asArray(raw.games).filter((g) => g && g.id && g.sport === sport).map(toGameManifest),
    unresolved,
  };
}

const playerByIdCache = new Map();
function findPlayerById(sport, id) {
  const cacheKey = `${sport}:${id}`;
  if (playerByIdCache.has(cacheKey)) return playerByIdCache.get(cacheKey);
  const hit = allPlayers(sport).find((p) => p.id === id) || null;
  playerByIdCache.set(cacheKey, hit);
  return hit;
}

export function toPlayerManifest(entity) {
  return {
    kind: 'player',
    sport: entity.sport,
    id: entity.id,
    name: entity.name,
    canonical_url: entity.canonical_url,
    path: entity.path,
    image_url: entity.image_url,
    team_id: entity.team_id,
    team_name: entity.team_name,
    team_url: entity.team_url,
    position: entity.position,
    aliases: aliasesFor(entity),
  };
}

export function toTeamManifest(entity) {
  return {
    kind: 'team',
    sport: entity.sport,
    id: entity.abbr,
    team_id: entity.id,
    name: entity.name,
    location: entity.location,
    nickname: entity.nickname,
    abbreviation: entity.abbr,
    slug: entity.slug,
    canonical_url: entity.canonical_url,
    path: entity.path,
    logo_url: entity.logo_url,
    aliases: aliasesFor(entity),
  };
}

export function toGameManifest(game) {
  const sport = String(game.sport || '').toLowerCase();
  const id = String(game.id);
  const home = game.home_abbr ? teamByAbbreviation(sport, game.home_abbr) : null;
  const away = game.away_abbr ? teamByAbbreviation(sport, game.away_abbr) : null;
  return {
    kind: 'game',
    sport,
    id,
    name: game.name || (home && away ? `${away.name} at ${home.name}` : `${sport.toUpperCase()} game`),
    canonical_url: `${SITE}/games/${sport}/${id}`,
    path: `/games/${sport}/${id}`,
    start_date: game.start_date || null,
    status: game.status || null,
    home: home ? toTeamManifest(home) : null,
    away: away ? toTeamManifest(away) : null,
  };
}

function aliasesFor(entity) {
  if (entity.kind === 'team') {
    return [entity.name, entity.nickname, entity.abbr, entity.location && entity.nickname ? `${entity.location} ${entity.nickname}` : null]
      .filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i);
  }
  return [entity.name];
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}
