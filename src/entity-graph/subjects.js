/**
 * src/entity-graph/subjects.js
 *
 * What a story is about, proven from its own words. One definition of "the
 * headline names X" shared by the social card (primarySubject) and the
 * NewsArticle graph (articleSubjects), so the two can never disagree.
 *
 * A newsroom tag list is a list of people and teams the story touches; only the
 * headline (then the dek) says who it is about. Nothing here looks at whether an
 * entity has a picture.
 */

import { normalizeName } from './text.js';
import { allTeams } from './entities.js';
import { toTeamManifest, articleText } from './manifest.js';

// ── Primary subject ─────────────────────────────────────────────────────────
// The card names exactly one subject, so it must be the one the headline is
// about — not whichever tagged entity happens to have a picture. A newsroom tag
// list ("Jon Cooper, Igor Shesterkin, …") is a list of people the story touches;
// only the headline (then the dek) says who it is about.

export const NAME_SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v']);
export const words = (value) => ` ${normalizeName(value)} `;

/** Whole-word tokens that identify a person: full name, or surname (possessive allowed). */
export function personNamedAt(text, name) {
  const full = normalizeName(name);
  if (!full) return -1;
  const at = text.indexOf(` ${full} `);
  if (at !== -1) return at;
  const tokens = full.split(' ').filter((t) => !NAME_SUFFIXES.has(t));
  const surname = tokens[tokens.length - 1];
  if (!surname || surname.length < 3 || tokens.length < 2) return -1;
  for (const form of [surname, `${surname}s`]) {
    const i = text.indexOf(` ${form} `);
    if (i !== -1) return i;
  }
  return -1;
}

export function teamNamedAt(text, team, { cityAlone = true } = {}) {
  const spellings = [team?.name, team?.location && team?.nickname ? `${team.location} ${team.nickname}` : null, team?.nickname, cityAlone ? team?.location : null]
    .filter((x) => x && normalizeName(x).length >= 4);
  let best = -1;
  for (const spelling of spellings) {
    const key = normalizeName(spelling);
    // Possessives normalize to a trailing "s" ("Vancouver's" -> "vancouvers").
    for (const form of [key, `${key}s`]) {
      const i = text.indexOf(` ${form} `);
      if (i !== -1 && (best === -1 || i < best)) best = i;
    }
  }
  return best;
}

const tagName = (tag) => (typeof tag === 'string' ? tag : tag?.name || '');

/** Matching key for a person: normalized, with generational suffixes dropped ("Kelvin Banks" = "Kelvin Banks Jr."). */
export const personKey = (name) => normalizeName(name).split(' ').filter((t) => t && !NAME_SUFFIXES.has(t)).join(' ');

/**
 * The story's proven primary subject: { player, team, basis }.
 *
 * Candidates are the people the newsroom tagged (in tag order, resolved or not),
 * the players the manifest resolved, and the manifest's teams. Whatever the
 * headline names first is the subject (a team-led headline hands over to the
 * first person it names only when that person plays for a team it names); only
 * if the headline names no candidate does the dek decide, and a dek naming
 * several teams (a roundup) decides nothing. A named person who is not a resolved player (a coach, an
 * executive, a rookie missing from the dictionary) gets NO player on the card —
 * selection never falls through to another tagged person — and the team that
 * line names, if any, carries the card instead. Pure.
 */
export function primarySubject(article, manifest) {
  const players = Array.isArray(manifest?.players) ? manifest.players : [];
  const sport = String(article?.sport || manifest?.sport || '').toLowerCase();
  const lines = [['headline', words(article?.title)], ['dek', words(article?.summary || article?.take?.summary)]];
  const teams = withHeadlineTeams(sport, Array.isArray(manifest?.teams) ? manifest.teams : [], lines);
  const byKey = new Map(players.map((p) => [personKey(p.name), p]));

  const people = [];
  const seen = new Set();
  const addPerson = (name) => {
    const key = personKey(name);
    if (!key || seen.has(key)) return;
    seen.add(key);
    people.push({ name, player: byKey.get(key) || null });
  };
  for (const tag of [...asList(article?.take?.players), ...asList(article?.players)]) addPerson(tagName(tag));
  for (const p of players) addPerson(p.name);

  for (const [basis, text] of lines) {
    const named = [
      ...people.map((person, order) => ({ kind: 'person', ...person, order, at: personNamedAt(text, person.name) })),
      ...teams.map((team, order) => ({ kind: 'team', team, order: people.length + order, at: teamNamedAt(text, team) })),
    ].filter((x) => x.at !== -1).sort((a, b) => a.at - b.at || a.order - b.order);
    if (!named.length) continue;
    // A dek that names several teams belongs to a roundup: no single subject.
    if (basis === 'dek' && new Set(named.filter((x) => x.kind === 'team').map((x) => x.team.name)).size > 1) break;
    const lead = named[0];
    const lineTeams = named.filter((x) => x.kind === 'team').map((x) => x.team);
    const teamOf = (player) => lineTeams.find((t) => t.team_id === player.team_id || t.name === player.team_name) || null;
    if (lead.kind === 'team') {
      // "Packers Lose Reed for Season": a team-led headline is about the first
      // person it names when that person is a resolved player on a team the
      // headline names. Anyone else (a coach, a rival's player) leaves the team.
      const person = named.find((x) => x.kind === 'person');
      const own = person?.player ? teamOf(person.player) : null;
      if (own) return { player: person.player, team: own, basis: `${basis}:team_player` };
      return { player: null, team: lead.team, basis: `${basis}:team` };
    }
    if (!lead.player) return { player: null, team: lineTeams[0] || null, basis: `${basis}:non_player:${lead.name}` };
    const team = teams.find((t) => t.team_id === lead.player.team_id || t.name === lead.player.team_name) || null;
    return { player: lead.player, team, basis: `${basis}:player` };
  }
  return { player: null, team: null, basis: 'none' };
}

/**
 * The manifest only knows teams named in full ("Vancouver Canucks"); headlines
 * say "Vancouver's" or "Canucks". Add same-sport teams the headline or dek name
 * by nickname or by a city no other team in that sport shares.
 */
export function withHeadlineTeams(sport, teams, lines, { blockedCities = new Set() } = {}) {
  let league = [];
  try { league = sport ? allTeams(sport) || [] : []; } catch { league = []; }
  if (!league.length) return teams;
  const cityCount = new Map();
  for (const t of league) {
    const city = normalizeName(t.location);
    if (city) cityCount.set(city, (cityCount.get(city) || 0) + 1);
  }
  const known = new Set(teams.map((t) => t.abbreviation || t.id));
  const out = [...teams];
  for (const t of league) {
    if (known.has(t.abbr)) continue;
    const entry = toTeamManifest(t);
    const cityAlone = cityCount.get(normalizeName(t.location)) === 1 && !blockedCities.has(normalizeName(t.location));
    if (lines.some(([, text]) => teamNamedAt(text, entry, { cityAlone }) !== -1)) {
      out.push({ ...entry, origin: 'headline' });
      known.add(t.abbr);
    }
  }
  return out;
}

function asList(value) {
  return Array.isArray(value) ? value : [];
}

// ── Article graph: about / mentions ──────────────────────────────────────────

/** Minimum times an entity must be named in the story to count as a meaningful mention. */
export const MENTION_MIN_COUNT = 2;
const MAX_MENTIONS = 24;

function countAll(text, needle) {
  let n = 0;
  for (let i = text.indexOf(needle); i !== -1; i = text.indexOf(needle, i + 1)) n += 1;
  return n;
}

const surnameOf = (name) => {
  const tokens = normalizeName(name).split(' ').filter((t) => t && !NAME_SUFFIXES.has(t));
  return tokens.length >= 2 ? tokens[tokens.length - 1] : '';
};

/**
 * How many times a person is named: by surname (and possessive) when no other
 * candidate shares it, else only by full name ("Tkachuk" is neither brother).
 */
function personCount(text, name, sharedSurnames) {
  const tokens = normalizeName(name).split(' ').filter((t) => t && !NAME_SUFFIXES.has(t));
  if (!tokens.length) return 0;
  const surname = surnameOf(name);
  if (surname.length >= 3 && !sharedSurnames.has(surname)) return countAll(text, ` ${surname} `) + countAll(text, ` ${surname}s `);
  return countAll(text, ` ${tokens.join(' ')} `) + countAll(text, ` ${tokens.join(' ')}s `);
}

/** How many times a team is named: the most frequent of its unambiguous spellings. */
function teamCount(text, team, cityAlone) {
  const spellings = [team?.name, team?.nickname, cityAlone ? team?.location : null]
    .map((x) => normalizeName(x)).filter((x) => x && x.length >= 4);
  let best = 0;
  for (const key of spellings) best = Math.max(best, countAll(text, ` ${key} `) + countAll(text, ` ${key}s `));
  return best;
}

const entityKey = (x) => (x.kind === 'team' ? `team:${x.team.abbreviation || x.team.id || x.team.name}` : x.kind === 'game' ? `game:${x.game.id}` : `person:${personKey(x.name)}`);

/**
 * { about, mentions, basis } for the NewsArticle graph.
 *
 * about    the subjects the headline names (people the newsroom tagged or the
 *          manifest resolved, and teams), in headline order. If the headline
 *          names none, the dek decides — unless the dek names several teams (a
 *          roundup). Then a persisted entity graph, if the story has one.
 *          Otherwise nothing: uncertain means omitted. A tagged person who is not
 *          a resolved player (a coach, an executive) is a subject in their own
 *          right and never hands the role to another person.
 * mentions entities outside `about` that the dek names or that the story names
 *          at least MENTION_MIN_COUNT times. A tag named once in passing is not a
 *          mention.
 * Items: { kind: 'player', player } | { kind: 'person', name } | { kind: 'team', team } | { kind: 'game', game }.
 */
export function articleSubjects(article, manifest) {
  const sport = String(article?.sport || manifest?.sport || '').toLowerCase();
  const players = Array.isArray(manifest?.players) ? manifest.players : [];
  const lines = [['headline', words(article?.title)], ['dek', words(article?.summary || article?.take?.summary)]];
  const byKey = new Map(players.map((p) => [personKey(p.name), p]));

  const people = [];
  const seen = new Set();
  const addPerson = (name, tagged) => {
    const key = personKey(name);
    if (!key || seen.has(key)) return;
    seen.add(key);
    people.push({ name, player: byKey.get(key) || null, tagged });
  };
  for (const tag of [...asList(article?.take?.players), ...asList(article?.players)]) addPerson(tagName(tag), true);
  for (const p of players) addPerson(p.name, false);

  // "Darnell Washington" is not the Washington Commanders: a city that is part of
  // a candidate person's name never identifies a team on its own.
  const nameTokens = new Set(people.flatMap((p) => normalizeName(p.name).split(' ')).filter(Boolean));
  const teams = withHeadlineTeams(sport, Array.isArray(manifest?.teams) ? manifest.teams : [], lines, { blockedCities: nameTokens });
  const cityOk = (team) => !nameTokens.has(normalizeName(team.location));

  let cityCount = new Map();
  try {
    for (const t of (sport ? allTeams(sport) : []) || []) {
      const city = normalizeName(t.location);
      if (city) cityCount.set(city, (cityCount.get(city) || 0) + 1);
    }
  } catch { cityCount = new Map(); }
  const cityAlone = (team) => cityCount.get(normalizeName(team.location)) === 1 && cityOk(team);

  const surnameUse = new Map();
  for (const p of people) { const sn = p.player ? surnameOf(p.name) : ''; if (sn) surnameUse.set(sn, (surnameUse.get(sn) || 0) + 1); }
  const sharedSurnames = new Set([...surnameUse].filter(([, n]) => n > 1).map(([sn]) => sn));
  // A bare surname identifies a player only when no other resolved player shares
  // it (not either Tkachuk), and a non-player (a coach, a father) only when no
  // resolved player has it ("Bellinger" is Cody, never his father Clay).
  const fullNameAt = (text, name) => text.indexOf(` ${normalizeName(name)} `);
  const personAt = (text, person) => {
    const sn = surnameOf(person.name);
    const ambiguous = person.player ? sharedSurnames.has(sn) : surnameUse.has(sn);
    return ambiguous ? fullNameAt(text, person.name) : personNamedAt(text, person.name);
  };

  const asItem = (p) => (p.player ? { kind: 'player', name: p.player.name, player: p.player } : { kind: 'person', name: p.name });
  const namedIn = (text) => [
    ...people.map((p) => ({ ...asItem(p), at: personAt(text, p) })),
    ...teams.map((team) => ({ kind: 'team', name: team.name, team, at: teamNamedAt(text, team, { cityAlone: cityOk(team) }) })),
  ].filter((x) => x.at !== -1).sort((a, b) => a.at - b.at);

  let about = [];
  let basis = 'none';
  const [, headline] = lines[0];
  const [, dek] = lines[1];
  const inHeadline = namedIn(headline);
  if (inHeadline.length) {
    about = inHeadline;
    basis = 'headline';
  } else {
    const inDek = namedIn(dek);
    const dekTeams = new Set(inDek.filter((x) => x.kind === 'team').map((x) => x.team.name));
    if (inDek.length && dekTeams.size <= 1) {
      about = inDek;
      basis = 'dek';
    } else if (manifest?.source === 'persisted') {
      about = [...players.map((player) => ({ kind: 'player', name: player.name, player })), ...teams.filter((t) => t.origin === 'persisted').map((team) => ({ kind: 'team', name: team.name, team }))];
      basis = 'entity_graph';
    }
  }
  // A coach or executive named in the headline is represented only when the
  // newsroom tagged them; untagged unresolved names never reach the graph.
  about = about.filter((x) => x.kind !== 'person' || people.find((p) => personKey(p.name) === personKey(x.name))?.tagged);

  const aboutKeys = new Set(about.map(entityKey));
  const aboutTeamNames = new Set(about.filter((x) => x.kind === 'team').map((x) => x.team.name));
  for (const game of asList(manifest?.games)) {
    const item = { kind: 'game', name: game.name, game };
    const ofSubject = [game.home?.name, game.away?.name].some((n) => n && aboutTeamNames.has(n));
    if (ofSubject && !aboutKeys.has(entityKey(item))) { about.push(item); aboutKeys.add(entityKey(item)); }
  }

  const story = ` ${[headline, dek, words(articleText(article))].join(' ')} `;
  const mentions = [];
  const mentionKeys = new Set();
  const consider = (item, count, inDek) => {
    const key = entityKey(item);
    if (aboutKeys.has(key) || mentionKeys.has(key)) return;
    if (!inDek && count < MENTION_MIN_COUNT) return;
    mentionKeys.add(key);
    mentions.push({ ...item, count });
  };
  for (const p of people) {
    if (!p.player) continue; // an unresolved name is a subject only when the headline proves it
    consider(asItem(p), personCount(story, p.name, sharedSurnames), personAt(dek, p) !== -1);
  }
  for (const team of teams) consider({ kind: 'team', name: team.name, team }, teamCount(story, team, cityAlone(team)), teamNamedAt(dek, team, { cityAlone: cityOk(team) }) !== -1);
  for (const game of asList(manifest?.games)) consider({ kind: 'game', name: game.name, game }, MENTION_MIN_COUNT, true);

  mentions.sort((a, b) => b.count - a.count);
  return {
    about: about.map(({ at, ...x }) => x),
    mentions: mentions.slice(0, MAX_MENTIONS).map(({ count, ...x }) => x),
    basis,
  };
}
