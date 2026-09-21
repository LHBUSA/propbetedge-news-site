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
 * article's own manifest.
 */

import { SITE, SPORT_LABELS } from './constants.js';

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
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Decide what the social card should actually depict.
 * Pure — safe to call on the edge, in the browser and in the auditor.
 */
export function selectShareSubject(article, manifest) {
  const sport = String(article?.sport || manifest?.sport || '').toLowerCase();

  // Prefer entities the newsroom actually tagged as the story's subject over
  // ones merely found in the prose. The card names a story's subject next to
  // its photograph, so picking the wrong player here would caption the picture
  // with somebody else's name.
  const player = pick(manifest?.players, (p) => isUsableRemoteImage(p.image_url));
  const team = pick(manifest?.teams, (t) => isUsableRemoteImage(t.logo_url));

  if (isUsableRemoteImage(article?.image_url)) {
    return {
      tier: 1,
      kind: 'editorial_photo',
      image: article.image_url,
      player,
      team,
      sport,
      alt: editorialAlt(article, manifest),
    };
  }
  if (player) {
    return {
      tier: 2,
      kind: 'player_headshot',
      image: player.image_url,
      player,
      team: team || null,
      sport,
      alt: `${player.name}${player.team_name ? `, ${player.team_name}` : ''} — PropBetEdge ${SPORT_LABELS[sport] || ''} coverage`.trim(),
    };
  }
  if (team) {
    return {
      tier: 3,
      kind: 'team_mark',
      image: team.logo_url,
      player: null,
      team,
      sport,
      alt: `${team.name} — PropBetEdge ${SPORT_LABELS[sport] || ''} coverage`.trim(),
    };
  }
  return {
    tier: 4,
    kind: 'league_card',
    image: null,
    player: null,
    team: null,
    sport,
    alt: `PropBetEdge ${SPORT_LABELS[sport] || 'sports'} coverage`,
  };
}

/**
 * The canonical, stable share image URL for an article.
 * Always PropBetEdge-owned, always 1200×630, always public and 200.
 */
export function shareImageUrl(article, { variant = null } = {}) {
  const slug = String(article?.slug || '');
  const sport = String(article?.sport || '').toLowerCase();
  if (!slug || !sport) return `${SITE}/logo/pbe-full-600.png`;
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

/** First tagged entity that satisfies `usable`, else the first that does. */
function pick(entities, usable) {
  const list = Array.isArray(entities) ? entities : [];
  return list.find((e) => e.origin !== 'text' && usable(e))
    || list.find((e) => usable(e))
    || null;
}

function editorialAlt(article, manifest) {
  const names = [
    ...(manifest?.players || []).slice(0, 2).map((p) => p.name),
    ...(manifest?.teams || []).slice(0, 1).map((t) => t.name),
  ].filter(Boolean);
  if (names.length) return `${names.join(' and ')} — ${String(article?.title || '').trim()}`.slice(0, 240);
  return String(article?.title || 'PropBetEdge story image').slice(0, 240);
}

export function variantSize(key) {
  return IMAGE_VARIANTS.find((v) => v.key === key) || { key: 'og', width: SHARE_IMAGE_WIDTH, height: SHARE_IMAGE_HEIGHT };
}
