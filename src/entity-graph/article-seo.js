/**
 * src/entity-graph/article-seo.js
 *
 * ONE article SEO contract. Edge Middleware and the browser renderer both call
 * buildArticleSeo() and emit what it returns — there is no second place where a
 * canonical URL, a social tag or a NewsArticle node gets assembled, so the
 * server and the client cannot describe the same article differently.
 *
 * Everything here is derived from the article payload and the entity manifest.
 * Nothing is invented: no fabricated dates, no keyword stuffing, no schema
 * nodes for entities the page does not actually show.
 */

import { SITE, SPORT_LABELS } from './entities.js';
import { buildShareImage } from './share-image.js';

const ORG_ID = `${SITE}/#organization`;
const SITE_ID = `${SITE}/#website`;
const DEFAULT_ROBOTS = 'index, follow, max-image-preview:large';
const EDITORIAL_TEAM = 'PropBetEdge Editorial Team';

export function articleCanonicalUrl(article) {
  const sport = String(article?.sport || '').toLowerCase();
  const slug = String(article?.slug || '');
  return `${SITE}/news/${sport}/${slug}`;
}

export function authorSlug(name) {
  return String(name || EDITORIAL_TEAM)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');
}

/**
 * Meta title. The H1 stays the editor's headline; the document title simply
 * carries the publication and section after it. A headline is never rewritten
 * or padded to hit a keyword.
 */
export function metaTitle(article) {
  const sport = String(article?.sport || '').toLowerCase();
  const label = SPORT_LABELS[sport];
  const headline = String(article?.title || '').trim();
  if (!headline) return `PropBetEdge ${label || 'Sports'} News`;
  const suffix = label ? ` | PropBetEdge ${label}` : ' | PropBetEdge';
  if (headline.length > 75) return `${headline} | PropBetEdge`;
  return `${headline}${suffix}`;
}

/**
 * Meta description. Prefers the editor's dek, then the analysis summary. Falls
 * back to a plain factual sentence built from resolved entities rather than a
 * keyword string.
 */
export function metaDescription(article, manifest) {
  const candidates = [article?.summary, article?.take?.summary];
  for (const candidate of candidates) {
    const text = clean(candidate);
    if (text.length >= 60) return clampSentence(text, 185);
    if (text) return text;
  }

  const sport = String(article?.sport || '').toLowerCase();
  const label = SPORT_LABELS[sport] || 'Sports';
  const names = [
    ...(manifest?.players || []).slice(0, 2).map((p) => p.name),
    ...(manifest?.teams || []).slice(0, 2).map((t) => t.name),
  ].filter(Boolean);

  if (names.length) {
    return clampSentence(
      `${clean(article?.title)} — PropBetEdge ${label} coverage of ${listPhrase(names)}.`,
      185,
    );
  }
  return clampSentence(`${clean(article?.title)} — PropBetEdge ${label} coverage.`, 185);
}

/** Breadcrumb trail, used for both the visible nav and BreadcrumbList. */
export function articleBreadcrumbs(article, manifest) {
  const sport = String(article?.sport || '').toLowerCase();
  const label = SPORT_LABELS[sport] || sport.toUpperCase();
  const trail = [
    { name: 'PropBetEdge', url: `${SITE}/` },
    { name: `${label} News`, url: `${SITE}/news/${sport}` },
  ];

  // A single clearly-primary team earns a breadcrumb level; two teams playing
  // each other do not, and a crowded trail helps nobody.
  const primaryTeams = (manifest?.teams || []).filter((t) => t.origin !== 'text');
  if (primaryTeams.length === 1) {
    trail.push({ name: primaryTeams[0].name, url: primaryTeams[0].canonical_url });
  }

  trail.push({ name: clean(article?.title) });
  return trail;
}

/**
 * The whole server/client SEO payload for one article.
 */
export function buildArticleSeo(article, manifest) {
  const sport = String(article?.sport || '').toLowerCase();
  const label = SPORT_LABELS[sport] || sport.toUpperCase();
  const canonical = articleCanonicalUrl(article);
  const title = metaTitle(article);
  const description = metaDescription(article, manifest);
  const image = buildShareImage(article, manifest);
  const breadcrumbs = articleBreadcrumbs(article, manifest);

  const published = isoDate(article?.published_at);
  // Never manufacture a modification time. An article that has not been
  // updated reports its publication time and nothing else.
  const modified = isoDate(article?.updated_at) || published;

  const tags = articleTags(article, manifest, label);

  return {
    canonical,
    title,
    description,
    robots: DEFAULT_ROBOTS,
    section: label,
    publishedTime: published,
    modifiedTime: modified,
    image,
    tags,
    breadcrumbs,
    openGraph: openGraphTags({ canonical, title, description, image, published, modified, label, tags }),
    twitter: twitterTags({ title, description, image }),
    jsonLd: articleJsonLd({
      article, manifest, canonical, title, description, image,
      label, published, modified, breadcrumbs, tags,
    }),
  };
}

function openGraphTags({ canonical, title, description, image, published, modified, label, tags }) {
  const pairs = [
    ['og:type', 'article'],
    ['og:site_name', 'PropBetEdge'],
    ['og:locale', 'en_US'],
    ['og:title', title],
    ['og:description', description],
    ['og:url', canonical],
    ['og:image', image.url],
    ['og:image:secure_url', image.secure_url],
    ['og:image:type', 'image/png'],
    ['og:image:width', String(image.width)],
    ['og:image:height', String(image.height)],
    ['og:image:alt', image.alt],
    ['article:section', label],
  ];
  if (published) pairs.push(['article:published_time', published]);
  if (modified) pairs.push(['article:modified_time', modified]);
  for (const tag of tags) pairs.push(['article:tag', tag]);
  return pairs;
}

function twitterTags({ title, description, image }) {
  return [
    ['twitter:card', 'summary_large_image'],
    ['twitter:site', '@MLBHRALERTSPBE'],
    ['twitter:title', title],
    ['twitter:description', description],
    ['twitter:image', image.url],
    ['twitter:image:alt', image.alt],
  ];
}

/**
 * article:tag / keywords. Real entity names and the story's own category —
 * never "latest AI prop bet news" filler.
 */
export function articleTags(article, manifest, label) {
  const tags = [];
  for (const player of manifest?.players || []) tags.push(player.name);
  for (const team of manifest?.teams || []) tags.push(team.name);
  if (label) tags.push(label);
  const category = clean(article?.category);
  if (category && category !== 'general') tags.push(titleCase(category));
  return [...new Set(tags.filter(Boolean))].slice(0, 14);
}

function articleJsonLd({
  article, manifest, canonical, title, description, image,
  label, published, modified, breadcrumbs, tags,
}) {
  const authorName = clean(article?.author) || EDITORIAL_TEAM;
  const isTeamByline = authorName === EDITORIAL_TEAM;
  const slug = authorSlug(authorName);

  // Entities the story is *about* are the ones the newsroom tagged or a
  // persisted manifest asserted. Entities merely named in the prose are
  // mentions. Both resolve to the exact URLs the page links to.
  const primary = [];
  const secondary = [];
  for (const player of manifest?.players || []) {
    (player.origin === 'text' ? secondary : primary).push(personNode(player));
  }
  for (const team of manifest?.teams || []) {
    (team.origin === 'text' ? secondary : primary).push(teamNode(team));
  }
  for (const game of manifest?.games || []) primary.push(eventNode(game));

  // A story with no structured tags still has a subject: its first entities.
  if (!primary.length && secondary.length) primary.push(secondary.shift());

  const newsArticle = {
    '@type': 'NewsArticle',
    '@id': `${canonical}#article`,
    url: canonical,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    headline: clean(article?.title),
    name: clean(article?.title),
    description,
    articleSection: label,
    inLanguage: 'en-US',
    isAccessibleForFree: true,
    isPartOf: { '@id': SITE_ID },
    author: {
      '@type': isTeamByline ? 'Organization' : 'Person',
      '@id': `${SITE}/authors/${slug}#author`,
      name: authorName,
      url: `${SITE}/authors/${slug}`,
    },
    publisher: { '@id': ORG_ID },
    image: imageNodes(image),
  };

  if (published) newsArticle.datePublished = published;
  if (modified) newsArticle.dateModified = modified;
  if (tags.length) newsArticle.keywords = tags.join(', ');
  if (primary.length) newsArticle.about = primary;
  if (secondary.length) newsArticle.mentions = secondary;

  const wordCount = countWords(article);
  if (wordCount) newsArticle.wordCount = wordCount;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      newsArticle,
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonical}#breadcrumbs`,
        itemListElement: breadcrumbs.map((crumb, index) => {
          const node = { '@type': 'ListItem', position: index + 1, name: crumb.name };
          if (crumb.url) node.item = crumb.url;
          return node;
        }),
      },
    ],
  };
}

function imageNodes(image) {
  const primary = {
    '@type': 'ImageObject',
    url: image.url,
    contentUrl: image.url,
    width: image.width,
    height: image.height,
    caption: image.alt,
  };
  const variants = (image.variants || []).map((variant) => ({
    '@type': 'ImageObject',
    url: variant.url,
    contentUrl: variant.url,
    width: variant.width,
    height: variant.height,
    caption: image.alt,
  }));
  return [primary, ...variants];
}

function personNode(player) {
  const node = {
    '@type': 'Person',
    '@id': `${player.canonical_url}#person`,
    name: player.name,
    url: player.canonical_url,
  };
  if (player.image_url) node.image = player.image_url;
  if (player.team_url && player.team_name) {
    node.memberOf = {
      '@type': 'SportsTeam',
      '@id': `${player.team_url}#team`,
      name: player.team_name,
      url: player.team_url,
    };
  }
  return node;
}

function teamNode(team) {
  const node = {
    '@type': 'SportsTeam',
    '@id': `${team.canonical_url}#team`,
    name: team.name,
    url: team.canonical_url,
  };
  if (team.logo_url) node.logo = team.logo_url;
  if (team.sport) {
    node.memberOf = {
      '@type': 'SportsOrganization',
      name: SPORT_LABELS[team.sport] || team.sport.toUpperCase(),
    };
  }
  return node;
}

function eventNode(game) {
  const node = {
    '@type': 'SportsEvent',
    '@id': `${game.canonical_url}#event`,
    name: game.name,
    url: game.canonical_url,
  };
  if (game.start_date) node.startDate = game.start_date;
  if (game.home) node.homeTeam = teamNode(game.home);
  if (game.away) node.awayTeam = teamNode(game.away);
  return node;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function clean(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

function isoDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function clampSentence(text, max) {
  const value = clean(text);
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const boundary = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf(', '), cut.lastIndexOf(' '));
  return `${cut.slice(0, boundary > max * 0.6 ? boundary : max - 1).trimEnd()}…`;
}

function listPhrase(names) {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function titleCase(value) {
  return clean(value).replace(/(^|\s|-)([a-z])/g, (_, prefix, char) => prefix + char.toUpperCase());
}

function countWords(article) {
  const body = article?.body || '';
  if (!body) return 0;
  const words = String(body).split(/\s+/).filter(Boolean).length;
  return words > 0 ? words : 0;
}

export { DEFAULT_ROBOTS };
