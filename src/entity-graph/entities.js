/**
 * src/entity-graph/entities.js
 *
 * The one entity resolver for PropBetEdge. Edge Middleware (SSR), the browser
 * renderer, the backfill auditor and the tests all call these functions — there
 * is deliberately no second implementation to drift against.
 *
 * Resolution rules:
 *   - Resolution is always scoped to one sport. "Jaden Bradley" is an NFL
 *     receiver and an NBA guard; "TOR" is the Blue Jays and the Raptors.
 *   - A name that maps to more than one player inside its own sport is
 *     AMBIGUOUS and is never linked unless the article's own team tags
 *     resolve the tie. Ambiguity is reported, not guessed.
 *   - Ids are real ids from the same sources the /player and /team routes
 *     resolve against. Nothing here invents an id, a slug or a URL.
 */

import {
  DICTIONARY_VERSION, GENERATED_AT, NHL_HEADSHOT_SEASON,
  TEAMS, PLAYERS, NHL_TRICODE_TO_ABBR,
} from './dictionary.js';
import { normalizeName, surnameKey, slugifyEntity, NAME_SUFFIXES, RISKY_TEAM_NICKNAMES } from './text.js';

import { SITE, SUPPORTED_SPORTS, SPORT_LABELS } from './constants.js';

export { SITE, SUPPORTED_SPORTS, SPORT_LABELS };

export const ENTITY_GRAPH_VERSION = `pbe-entity-graph/1 (dict ${DICTIONARY_VERSION} @ ${GENERATED_AT})`;

const ABBR_TO_TRICODE = (() => {
  const out = {};
  for (const [tricode, abbr] of Object.entries(NHL_TRICODE_TO_ABBR)) out[abbr] = tricode;
  return out;
})();

// ─── index construction (built once, memoized per sport) ─────────────────────

const indexes = new Map();

function indexFor(sport) {
  const key = String(sport || '').toLowerCase();
  if (indexes.has(key)) return indexes.get(key);
  if (!SUPPORTED_SPORTS.includes(key)) {
    const empty = {
      sport: key,
      teams: [],
      teamByKey: new Map(),
      players: [],
      playersByName: new Map(),
      playersBySurname: new Map(),
    };
    indexes.set(key, empty);
    return empty;
  }

  const teams = (TEAMS[key] || []).map(([id, name, location, nickname, abbr, slug, logo]) => ({
    kind: 'team',
    sport: key,
    id,
    name,
    location,
    nickname,
    abbr,
    slug,
    logo_url: logo || null,
    canonical_url: `${SITE}/team/${key}/${slug}`,
    path: `/team/${key}/${slug}`,
  }));

  const teamByKey = new Map();
  const addTeamKey = (value, team) => {
    const normalized = normalizeName(value);
    if (!normalized) return;
    if (teamByKey.has(normalized) && teamByKey.get(normalized) !== team) {
      teamByKey.set(normalized, null); // collision inside one sport → unusable
      return;
    }
    teamByKey.set(normalized, team);
  };
  for (const team of teams) {
    addTeamKey(team.name, team);
    addTeamKey(team.slug, team);
    addTeamKey(team.abbr, team);
    addTeamKey(team.nickname, team);
    if (team.location && team.nickname) addTeamKey(`${team.location} ${team.nickname}`, team);
    if (key === 'nhl' && ABBR_TO_TRICODE[team.abbr]) addTeamKey(ABBR_TO_TRICODE[team.abbr], team);
  }
  // Abbreviation spellings the newsroom's tagger uses that ESPN does not.
  for (const [alias, abbr] of Object.entries(TEAM_ABBR_ALIASES[key] || {})) {
    const team = teams.find((t) => t.abbr === abbr);
    if (team) addTeamKey(alias, team);
  }

  const teamByAbbr = new Map(teams.map((t) => [t.abbr, t]));

  const players = (PLAYERS[key] || []).map(([id, name, teamAbbr, position]) => {
    const team = teamByAbbr.get(teamAbbr) || null;
    return {
      kind: 'player',
      sport: key,
      id,
      name,
      position: position || '',
      team_id: teamAbbr || null,
      team_name: team?.name || null,
      team_url: team?.canonical_url || null,
      image_url: playerImageUrl(key, id, teamAbbr),
      canonical_url: `${SITE}/player/${key}/${id}`,
      path: `/player/${key}/${id}`,
    };
  });

  const playersByName = new Map();
  const playersBySurname = new Map();
  for (const player of players) {
    for (const alias of playerAliasKeys(player.name)) {
      if (!playersByName.has(alias)) playersByName.set(alias, []);
      const bucket = playersByName.get(alias);
      if (!bucket.includes(player)) bucket.push(player);
    }
    const surname = surnameKey(player.name);
    if (surname) {
      if (!playersBySurname.has(surname)) playersBySurname.set(surname, []);
      playersBySurname.get(surname).push(player);
    }
  }

  const index = { sport: key, teams, teamByKey, teamByAbbr, players, playersByName, playersBySurname };
  indexes.set(key, index);
  return index;
}

/**
 * Every spelling of a player name we are willing to treat as the same person.
 * Deliberately conservative: no first-initial forms, no surname-only forms.
 * Surname-only matching is handled separately and only for entities the
 * article has already confirmed.
 */
function playerAliasKeys(name) {
  const normalized = normalizeName(name);
  if (!normalized) return [];
  const keys = new Set([normalized]);

  const tokens = normalized.split(' ');
  const withoutSuffix = tokens.filter((t) => !NAME_SUFFIXES.has(t));
  if (withoutSuffix.length >= 2 && withoutSuffix.length !== tokens.length) {
    keys.add(withoutSuffix.join(' '));
  }

  // Rosters and newsrooms disagree about given names: ESPN lists "Pat Surtain
  // II" and "Mike Onwenu" where the tagger writes "Patrick Surtain" and
  // "Michael Onwenu". Equivalence applies to the FIRST token only, and a key
  // that lands on two players is still reported ambiguous rather than guessed.
  for (const base of [...keys]) {
    const parts = base.split(' ');
    if (parts.length < 2) continue;
    for (const variant of givenNameVariants(parts[0])) {
      keys.add([variant, ...parts.slice(1)].join(' '));
    }
  }
  return [...keys];
}

function givenNameVariants(given) {
  const group = GIVEN_NAME_GROUPS.get(given);
  if (!group) return [];
  return group.filter((name) => name !== given);
}

/**
 * Conventional short/long given-name pairs. Only pairs that are genuinely the
 * same name; nothing here could merge two different people.
 */
const GIVEN_NAME_GROUPS = (() => {
  const groups = [
    ['michael', 'mike'], ['patrick', 'pat'], ['christopher', 'chris'],
    ['nicholas', 'nick'], ['robert', 'rob', 'bob', 'bobby'], ['anthony', 'tony'],
    ['joseph', 'joe'], ['daniel', 'dan', 'danny'], ['matthew', 'matt'],
    ['thomas', 'tom', 'tommy'], ['james', 'jim', 'jimmy'],
    ['william', 'will', 'bill', 'billy'], ['alexander', 'alex'],
    ['benjamin', 'ben'], ['samuel', 'sam'], ['david', 'dave'],
    ['steven', 'steve'], ['stephen', 'steve'], ['gregory', 'greg'],
    ['jeffrey', 'jeff'], ['kenneth', 'ken'], ['ronald', 'ron'],
    ['richard', 'rich', 'rick'], ['andrew', 'andy'],
    ['charles', 'charlie'], ['joshua', 'josh'], ['zachary', 'zach'],
    ['cameron', 'cam'], ['gabriel', 'gabe'], ['nathaniel', 'nate'],
    ['nathan', 'nate'], ['edward', 'eddie'], ['timothy', 'tim'],
    ['jonathan', 'jon'], ['vincent', 'vince'], ['raymond', 'ray'],
    ['frederick', 'fred'], ['lawrence', 'larry'], ['phillip', 'phil'],
    ['philip', 'phil'], ['manuel', 'manny'],
  ];
  const map = new Map();
  for (const group of groups) {
    for (const name of group) {
      const existing = map.get(name) || [];
      map.set(name, [...new Set([...existing, ...group])]);
    }
  }
  return map;
})();

function playerImageUrl(sport, id, teamAbbr) {
  if (sport === 'mlb') {
    return `https://img.mlbstatic.com/mlb-photos/image/upload/w_240,q_90/v1/people/${id}/headshot/67/current`;
  }
  if (sport === 'nhl') {
    const tricode = ABBR_TO_TRICODE[teamAbbr] || teamAbbr;
    if (!NHL_HEADSHOT_SEASON || !tricode) return null;
    return `https://assets.nhle.com/mugs/nhl/${NHL_HEADSHOT_SEASON}/${tricode}/${id}.png`;
  }
  if (sport === 'nfl' || sport === 'nba') {
    return `https://a.espncdn.com/i/headshots/${sport}/players/full/${id}.png`;
  }
  return null;
}

// Newsroom tagger abbreviations that differ from the ESPN spellings the
// dictionary is keyed on. Measured, not guessed: every entry here appeared as
// an actual unresolved team mention in the corpus audit.
const TEAM_ABBR_ALIASES = {
  nfl: {
    GNB: 'GB', KAN: 'KC', SFO: 'SF', TAM: 'TB', NOR: 'NO', NWE: 'NE',
    LVR: 'LV', JAC: 'JAX', WAS: 'WSH', CLV: 'CLE', ARZ: 'ARI', BLT: 'BAL',
    HST: 'HOU', SD: 'LAC', OAK: 'LV', STL: 'LAR',
  },
  mlb: {
    CWS: 'CHW', KCR: 'KC', SDP: 'SD', SFG: 'SF', TBR: 'TB',
    WSN: 'WSH', WAS: 'WSH', ARZ: 'ARI', AZ: 'ARI',
    ANA: 'LAA', FLA: 'MIA', MON: 'WSH',
  },
  nba: {
    NYK: 'NY', GSW: 'GS', UTA: 'UTAH', SAS: 'SA', NOP: 'NO', PHO: 'PHX',
    BRK: 'BKN', CHO: 'CHA', WAS: 'WSH', NOH: 'NO', NJN: 'BKN',
  },
  nhl: {
    VEG: 'VGK', LV: 'VGK', TBL: 'TB', LAK: 'LA', NJD: 'NJ', SJS: 'SJ',
    WAS: 'WSH', MON: 'MTL', ARI: 'UTAH', PHX: 'UTAH', UTA: 'UTAH',
    CLS: 'CBJ', WIN: 'WPG',
  },
};

// ─── public resolution API ───────────────────────────────────────────────────

/** Resolve a team from any spelling: abbreviation, slug, nickname, full name. */
export function resolveTeam(sport, value) {
  const index = indexFor(sport);
  const key = normalizeName(value);
  if (!key) return null;
  const hit = index.teamByKey.get(key);
  return hit || null;
}

/**
 * Resolve a player name inside one sport.
 * Returns { entity } on success, or { entity: null, reason } so callers can
 * report unresolved and ambiguous mentions instead of silently dropping them.
 *
 * teamHints — abbreviations already confirmed for the article. Used only to
 * break a tie between real same-sport namesakes; never to invent a match.
 */
export function resolvePlayer(sport, value, { teamHints = [] } = {}) {
  const index = indexFor(sport);
  const key = normalizeName(value);
  if (!key) return { entity: null, reason: 'empty' };

  const matches = index.playersByName.get(key);
  if (!matches || !matches.length) return { entity: null, reason: 'unknown' };
  if (matches.length === 1) return { entity: matches[0], reason: null };

  const hints = new Set(teamHints.filter(Boolean).map((t) => String(t).toUpperCase()));
  const narrowed = matches.filter((p) => p.team_id && hints.has(p.team_id));
  if (narrowed.length === 1) return { entity: narrowed[0], reason: null };

  return { entity: null, reason: 'ambiguous', candidates: matches.map((p) => p.canonical_url) };
}

/** Players in this sport whose surname appears in the supplied token set. */
export function playersBySurname(sport, surname) {
  return indexFor(sport).playersBySurname.get(surnameKey(surname)) || [];
}

export function allTeams(sport) {
  return indexFor(sport).teams;
}

export function allPlayers(sport) {
  return indexFor(sport).players;
}

export function teamByAbbreviation(sport, abbr) {
  return indexFor(sport).teamByAbbr?.get(String(abbr || '').toUpperCase()) || null;
}

/**
 * Link surfaces for an entity — the exact strings we are willing to turn into
 * an <a> in article copy.
 *
 * Teams link on their full name, on location + nickname, and on the bare
 * nickname unless that nickname is ordinary English (see RISKY_TEAM_NICKNAMES).
 * Matching is case-sensitive against the dictionary spelling, so "the heat of
 * a playoff race" can never become the Miami Heat even before the risk list
 * applies. A bare location ("Seattle", "Toronto") is never a link surface — it
 * is shared by teams in different leagues and by the city itself.
 */
/**
 * Every abbreviation a team's stories might be tagged with in the newsroom
 * database, most likely first.
 *
 * The dictionary is keyed on ESPN's spellings, but the newsroom tagger uses its
 * own: the Knicks are ESPN "NY" and tagger "NYK", the Warriors "GS" vs "GSW",
 * the Jazz "UTAH" vs "UTA". Measured against the live API, querying
 * /news/by-team with only the ESPN spelling returns ZERO stories for those
 * three clubs, so any caller asking "what has been written about this team"
 * has to ask for every spelling.
 */
export function teamQueryAbbreviations(sport, team) {
  const key = String(sport || '').toLowerCase();
  const canonical = String(team?.abbreviation || team?.abbr || team || '').toUpperCase();
  if (!canonical) return [];

  const aliases = Object.entries(TEAM_ABBR_ALIASES[key] || {})
    .filter(([, target]) => target === canonical)
    .map(([alias]) => alias);

  return [...new Set([canonical, ...aliases])];
}

export function linkSurfaces(entity) {
  if (!entity) return [];
  if (entity.kind === 'team') {
    const surfaces = new Set([entity.name]);
    if (entity.location && entity.nickname) surfaces.add(`${entity.location} ${entity.nickname}`);
    if (entity.nickname && !RISKY_TEAM_NICKNAMES.has(normalizeName(entity.nickname))) {
      surfaces.add(entity.nickname);
    }
    return [...surfaces].filter(Boolean);
  }
  return [entity.name];
}

/** Surname-only surface, allowed only for a confirmed, unambiguous player. */
export function surnameSurface(entity) {
  if (!entity || entity.kind !== 'player') return null;
  const index = indexFor(entity.sport);
  const surname = surnameKey(entity.name);
  if (!surname || surname.length < 4) return null;
  const sharing = index.playersBySurname.get(surname) || [];
  if (sharing.length !== 1) return null;

  const tokens = String(entity.name).trim().split(/\s+/);
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (!NAME_SUFFIXES.has(normalizeName(tokens[i]))) return tokens[i];
  }
  return null;
}

export { slugifyEntity, normalizeName };
