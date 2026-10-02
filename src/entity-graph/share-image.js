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

export { primarySubject } from './subjects.js';
import { primarySubject } from './subjects.js';

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
