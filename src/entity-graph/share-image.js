/**
 * src/entity-graph/share-image.js
 *
 * Deterministic article share imagery.
 *
 * The house logo is branding, not a story picture. Every article therefore
 * resolves to a representative image through a fixed hierarchy, and the social
 * card itself is a stable, public, cacheable PropBetEdge URL that always
 * returns a real 1200×630 raster.
 *
 * Hierarchy (first hit wins):
 *   1. the article's own editorial photograph — the same picture the page shows
 *   2. the headshot of the story's primary resolved player
 *   3. the logo treatment of the story's primary resolved team
 *   4. the league editorial card
 *
 * Nothing here composites a likeness, borrows an unrelated athlete, or dresses
 * a story in another player's face: the subject always comes from this
 * article's own manifest, and only once primarySubject() proves it is what the
 * headline is about. No proven subject means a text-only card with no name on it.
 */

import { SITE, SPORT_LABELS } from './constants.js';
import { normalizeName } from './text.js';

import { NETWORK_SOCIAL_IMAGE } from '../social.js';
export const SHARE_IMAGE_WIDTH = 1200;
export const SHARE_IMAGE_HEIGHT = 630;

/** Aspect variants exposed to structured data. */
export const IMAGE_VARIANTS = [
  { key: '16x9', width: 1200, height: 675 },
  { key: '4x3', width: 1200, height: 900 },
  { key: '1x1', width: 1200, height: 1200 },
];

const HOUSE_BRAND_MARKERS = [
  '/logo/', 'pbe-mark', 'pbe-full', 'propbetedge-logo', 'propbetedge_logo',
  'placeholder-pbe', 'favicon',
];

export function isHouseBrandImage(url) {
  const value = String(url || '').toLowerCase();
  if (!value) return false;
  return HOUSE_BRAND_MARKERS.some((marker) => value.includes(marker));
}

function isUsableRemoteImage(url) {
  if (!url || isHouseBrandImage(url)) return false;
  try {
    const parsed = new URL(String(url));
    if (parsed.protocol !== 'https:') return false;
    // A publisher template that rendered without its image ("?url=undefined",
    // ".../null.jpg") is not a picture of anything.
    for (const value of parsed.searchParams.values()) {
      if (/^(undefined|null)$/i.test(value)) return false;
    }
    return !/\/(undefined|null)(\.[a-z]+)?$/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

// ── Primary subject ─────────────────────────────────────────────────────────
// The card names exactly one subject, so it must be the one the headline is
// about — not whichever tagged entity happens to have a picture. A newsroom tag
// list ("Jon Cooper, Igor Shesterkin, …") is a list of people the story touches;
// only the headline (then the dek) says who it is about.

const NAME_SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v']);
const words = (value) => ` ${normalizeName(value)} `;

/** Whole-word tokens that identify a person: full name, or surname (possessive allowed). */
function personNamedAt(text, name) {
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

function teamNamedAt(text, team) {
  const spellings = [team?.name, team?.location && team?.nickname ? `${team.location} ${team.nickname}` : null, team?.nickname, team?.location]
    .filter((x) => x && normalizeName(x).length >= 4);
  let best = -1;
  for (const spelling of spellings) {
    const i = text.indexOf(` ${normalizeName(spelling)} `);
    if (i !== -1 && (best === -1 || i < best)) best = i;
  }
  return best;
}

const tagName = (tag) => (typeof tag === 'string' ? tag : tag?.name || '');

/**
 * The story's proven primary subject: { player, team, basis }.
 *
 * Candidates are the people the newsroom tagged (in tag order, resolved or not)
 * plus the players the manifest resolved. The subject is the candidate named
 * earliest in the headline; failing that, in the dek. When that person is not a
 * resolved player (a coach, an executive), the card gets NO player — it never
 * falls through to the next tagged person. A team is only the subject when the
 * headline or dek names it. Pure.
 */
export function primarySubject(article, manifest) {
  const players = Array.isArray(manifest?.players) ? manifest.players : [];
  const teams = Array.isArray(manifest?.teams) ? manifest.teams : [];
  const byName = new Map(players.map((p) => [normalizeName(p.name), p]));

  const people = [];
  const seen = new Set();
  const addPerson = (name) => {
    const key = normalizeName(name);
    if (!key || seen.has(key)) return;
    seen.add(key);
    people.push({ name, player: byName.get(key) || null });
  };
  for (const tag of [...asList(article?.take?.players), ...asList(article?.players)]) addPerson(tagName(tag));
  for (const p of players) addPerson(p.name);

  const lines = [['headline', words(article?.title)], ['dek', words(article?.summary || article?.take?.summary)]];

  for (const [basis, text] of lines) {
    const named = people
      .map((person, order) => ({ ...person, order, at: personNamedAt(text, person.name) }))
      .filter((x) => x.at !== -1)
      .sort((a, b) => a.at - b.at || a.order - b.order);
    if (!named.length) continue;
    const lead = named[0];
    if (!lead.player) {
      // The story is about someone who is not a player we can show. Do not
      // substitute anybody else; a named team can still carry the card.
      return { player: null, team: namedTeam(lines, teams), basis: `${basis}:non_player:${lead.name}` };
    }
    const team = teams.find((t) => t.team_id === lead.player.team_id || t.name === lead.player.team_name) || null;
    return { player: lead.player, team, basis: `${basis}:player` };
  }
  const team = namedTeam(lines, teams);
  return { player: null, team, basis: team ? 'team' : 'none' };
}

function namedTeam(lines, teams) {
  for (const [, text] of lines) {
    const named = teams
      .map((team, order) => ({ team, order, at: teamNamedAt(text, team) }))
      .filter((x) => x.at !== -1)
      .sort((a, b) => a.at - b.at || a.order - b.order);
    if (named.length) return named[0].team;
  }
  return null;
}

function asList(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * Decide what the social card should actually depict.
 * Pure — safe to call on the edge, in the browser and in the auditor.
 */
export function selectShareSubject(article, manifest) {
  const sport = String(article?.sport || manifest?.sport || '').toLowerCase();
  const label = SPORT_LABELS[sport] || '';
  const { player, team, basis } = primarySubject(article, manifest);
  const subjectName = player ? `${player.name}${player.team_name ? `, ${player.team_name}` : ''}` : team?.name || '';

  if (isUsableRemoteImage(article?.image_url)) {
    return {
      tier: 1,
      kind: 'editorial_photo',
      image: article.image_url,
      player,
      team,
      sport,
      basis,
      alt: editorialAlt(article, player, team),
    };
  }
  if (player && isUsableRemoteImage(player.image_url)) {
    return {
      tier: 2,
      kind: 'player_headshot',
      image: player.image_url,
      player,
      team,
      sport,
      basis,
      alt: `${subjectName} — PropBetEdge ${label} coverage`.trim(),
    };
  }
  if (!player && team && isUsableRemoteImage(team.logo_url)) {
    return {
      tier: 3,
      kind: 'team_mark',
      image: team.logo_url,
      player: null,
      team,
      sport,
      basis,
      alt: `${team.name} — PropBetEdge ${label} coverage`.trim(),
    };
  }
  return {
    tier: 4,
    kind: 'league_card',
    image: null,
    player,
    team,
    sport,
    basis,
    alt: subjectName ? `${subjectName} — PropBetEdge ${label} coverage`.trim() : `PropBetEdge ${label || 'sports'} coverage`,
  };
}

/**
 * The canonical, stable share image URL for an article.
 * Always PropBetEdge-owned, always 1200×630, always public and 200.
 */
export function shareImageUrl(article, { variant = null } = {}) {
  const slug = String(article?.slug || '');
  const sport = String(article?.sport || '').toLowerCase();
  if (!slug || !sport) return NETWORK_SOCIAL_IMAGE.url;
  const query = new URLSearchParams({ sport, slug });
  if (variant) query.set('v', variant);
  return `${SITE}/api/social-card?${query.toString()}`;
}

/** Article-level share image contract, used by meta tags and schema alike. */
export function buildShareImage(article, manifest) {
  const subject = selectShareSubject(article, manifest);
  return {
    url: shareImageUrl(article),
    secure_url: shareImageUrl(article),
    width: SHARE_IMAGE_WIDTH,
    height: SHARE_IMAGE_HEIGHT,
    alt: subject.alt,
    tier: subject.tier,
    kind: subject.kind,
    source_image: subject.image,
    variants: IMAGE_VARIANTS.map((variant) => ({
      ...variant,
      url: shareImageUrl(article, { variant: variant.key }),
    })),
  };
}

function editorialAlt(article, player, team) {
  const headline = String(article?.title || '').trim();
  const subject = player?.name || team?.name;
  if (subject) return `${subject} — ${headline}`.slice(0, 240);
  return (headline || 'PropBetEdge story image').slice(0, 240);
}

export function variantSize(key) {
  return IMAGE_VARIANTS.find((v) => v.key === key) || { key: 'og', width: SHARE_IMAGE_WIDTH, height: SHARE_IMAGE_HEIGHT };
}
