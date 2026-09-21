/**
 * src/schema.js
 * Centralized JSON-LD schema generators for PropBetEdge.
 *
 * Why this exists: schema is the single biggest E-E-A-T lever we control,
 * and it needs to be consistent across every page type. One file = one source
 * of truth for how PropBetEdge identifies itself to Google, Bing, and AI search.
 *
 * Coverage:
 *   - Organization (publisher) — referenced from every other schema via @id
 *   - WebSite + connected PropBetEdge sport properties
 *   - WebPage / CollectionPage
 *   - NewsArticle (rich, multi-author capable, ImageObject)
 *   - ProfilePage wrapping Person (Google's 2024 recommended pattern)
 *   - BreadcrumbList (every page)
 *   - ItemList (homepage, sport pages, news index)
 *
 * Usage: import { injectSchemas } from './schema.js';
 *        injectSchemas([ schema1, schema2, ... ])
 */

const SITE = {
  url: 'https://propbetedge.ai',
  name: 'PropBetEdge',
  parentOrg: 'PropTechUSA.ai',
  description: 'AI-native sports newsroom and sports-intelligence network covering MLB, NFL, NBA, WNBA, NHL, UFC, and expanding sports data products.',
  logo: 'https://propbetedge.ai/logo/pbe-full-400.png',
  logoSquare: 'https://propbetedge.ai/favicon-192.png',
  twitter: 'https://x.com/MLBHRALERTSPBE',
  linkedin: 'https://www.linkedin.com/company/propbetedge-ai/',
  bluesky: 'https://bsky.app/profile/propbetedge.bsky.social',
};

// ─── @id references — used to deduplicate the publisher across schemas ──
const ORG_ID = `${SITE.url}/#organization`;
const SITE_ID = `${SITE.url}/#website`;
const LOGO_ID = `${SITE.url}/#logo`;

// ════════════════════════════════════════════════════════════════════════
// ORGANIZATION (publisher — referenced from everything else)
// ════════════════════════════════════════════════════════════════════════
export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'NewsMediaOrganization',
    '@id': ORG_ID,
    name: SITE.name,
    alternateName: 'PropBetEdge.ai',
    url: SITE.url,
    description: SITE.description,
    mainEntityOfPage: `${SITE.url}/about`,
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'editorial',
        email: 'editorial@proptechusa.ai',
      },
      {
        '@type': 'ContactPoint',
        contactType: 'business inquiries',
        email: 'hello@proptechusa.ai',
      },
      {
        '@type': 'ContactPoint',
        contactType: 'press',
        email: 'press@proptechusa.ai',
      },
    ],
    parentOrganization: {
      '@type': 'Organization',
      name: SITE.parentOrg,
      url: 'https://proptechusa.ai',
    },
    logo: {
      '@type': 'ImageObject',
      '@id': LOGO_ID,
      url: SITE.logo,
      contentUrl: SITE.logo,
      width: 400,
      height: 100,
      caption: SITE.name,
    },
    image: { '@id': LOGO_ID },
    sameAs: [
      SITE.twitter,
      SITE.linkedin,
      SITE.bluesky,
    ].filter(Boolean),
    diversityPolicy: `${SITE.url}/editorial-standards`,
    ethicsPolicy: `${SITE.url}/editorial-standards`,
    publishingPrinciples: `${SITE.url}/editorial-standards`,
    actionableFeedbackPolicy: `${SITE.url}/editorial-standards`,
    correctionsPolicy: `${SITE.url}/editorial-standards`,
  };
}

// ════════════════════════════════════════════════════════════════════════
// WEBSITE + first-class sport properties
// ════════════════════════════════════════════════════════════════════════
export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': SITE_ID,
    url: SITE.url,
    name: SITE.name,
    description: SITE.description,
    publisher: { '@id': ORG_ID },
    hasPart: [
      ['MLB', 'https://mlb.propbetedge.ai/'],
      ['NFL', 'https://nfl.propbetedge.ai/'],
      ['NBA', 'https://nba.propbetedge.ai/'],
      ['WNBA', 'https://wnba.propbetedge.ai/'],
      ['NHL', 'https://nhl.propbetedge.ai/'],
      ['UFC', 'https://ufc.propbetedge.ai/'],
    ].map(([sport, url]) => ({
      '@type': 'WebSite',
      name: `PropBetEdge ${sport}`,
      url,
      publisher: { '@id': ORG_ID },
    })),
    inLanguage: 'en-US',
  };
}

// ════════════════════════════════════════════════════════════════════════
// BREADCRUMB LIST (every non-home page)
// items: [ { name: 'MLB News', url: '/news/mlb' }, { name: 'Article Title' } ]
// Last item should NOT have a url (current page).
// ════════════════════════════════════════════════════════════════════════
export function breadcrumbSchema(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, idx) => {
      const el = {
        '@type': 'ListItem',
        position: idx + 1,
        name: item.name,
      };
      if (item.url) {
        el.item = item.url.startsWith('http') ? item.url : `${SITE.url}${item.url}`;
      }
      return el;
    }),
  };
}

// ════════════════════════════════════════════════════════════════════════
// NEWS ARTICLE — rich version with ImageObject, multi-author, keywords
// ════════════════════════════════════════════════════════════════════════
export function newsArticleSchema(article, sport, slug) {
  const articleUrl = `${SITE.url}/news/${sport}/${slug}`;
  const authorName = article.author || 'PropBetEdge Editorial Team';
  const authorSlug = nameToSlug(authorName);

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    '@id': `${articleUrl}#article`,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': articleUrl,
    },
    url: articleUrl,
    headline: article.title,
    alternativeHeadline: article.summary || article.take?.summary || undefined,
    description: article.summary || article.take?.summary || article.title,
    datePublished: article.published_at,
    dateModified: article.updated_at || article.published_at,
    articleSection: sport.toUpperCase(),
    inLanguage: 'en-US',
    isPartOf: { '@id': SITE_ID },
    isAccessibleForFree: true,
    author: {
      '@type': authorName === 'PropBetEdge Editorial Team' ? 'Organization' : 'Person',
      '@id': `${SITE.url}/authors/${authorSlug}#author`,
      name: authorName,
      url: `${SITE.url}/authors/${authorSlug}`,
    },
    publisher: { '@id': ORG_ID },
  };

  // Image — convert to ImageObject if we have one
  if (article.image_url) {
    schema.image = {
      '@type': 'ImageObject',
      url: article.image_url,
      contentUrl: article.image_url,
      caption: article.title,
    };
  }

  // Keywords from sport + tags + prop types
  const keywords = [sport.toUpperCase(), 'prop bets', 'sports betting', 'fantasy sports'];
  if (article.take?.affected_props && Array.isArray(article.take.affected_props)) {
    keywords.push(...article.take.affected_props.map((p) => formatPropForKeyword(p)));
  }
  schema.keywords = [...new Set(keywords)].join(', ');

  // Word count if we have body
  if (article.body) {
    const wc = article.body.split(/\s+/).filter(Boolean).length;
    if (wc > 0) schema.wordCount = wc;
  }

  return schema;
}

// ════════════════════════════════════════════════════════════════════════
// PROFILE PAGE wrapping PERSON (Google's 2024 recommended pattern for authors)
// ════════════════════════════════════════════════════════════════════════
export function profilePageSchema(slug, author) {
  const profileUrl = `${SITE.url}/authors/${slug}`;
  const personId = `${profileUrl}#person`;

  const personNode = {
    '@type': 'Person',
    '@id': personId,
    name: author.name,
    jobTitle: author.title || author.role,
    description: stripHtml(author.bio).slice(0, 500),
    url: profileUrl,
    worksFor: { '@id': ORG_ID },
    knowsAbout: author.expertise || [],
  };

  if (author.credentials && author.credentials.length) {
    personNode.hasCredential = author.credentials.map((c) => ({
      '@type': 'EducationalOccupationalCredential',
      name: c,
    }));
  }
  if (author.location) {
    personNode.homeLocation = { '@type': 'Place', name: author.location };
  }
  if (author.image) {
    personNode.image = {
      '@type': 'ImageObject',
      url: author.image,
      contentUrl: author.image,
      caption: author.name,
    };
  }
  const sameAs = [];
  if (author.twitter) sameAs.push(author.twitter);
  if (sameAs.length) personNode.sameAs = sameAs;

  // ProfilePage wrapping Person
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    '@id': `${profileUrl}#profilepage`,
    url: profileUrl,
    name: `${author.name} — ${author.role}`,
    description: stripHtml(author.bio).slice(0, 200),
    mainEntity: personNode,
    isPartOf: { '@id': SITE_ID },
    inLanguage: 'en-US',
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE.url },
        { '@type': 'ListItem', position: 2, name: 'Editorial Team', item: `${SITE.url}/authors` },
        { '@type': 'ListItem', position: 3, name: author.name },
      ],
    },
  };
}

// ════════════════════════════════════════════════════════════════════════
// COLLECTION PAGE — for /news, /news/mlb, etc.
// ════════════════════════════════════════════════════════════════════════
export function collectionPageSchema({ url, name, description, articles }) {
  const fullUrl = url.startsWith('http') ? url : `${SITE.url}${url}`;
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${fullUrl}#collectionpage`,
    url: fullUrl,
    name,
    description,
    isPartOf: { '@id': SITE_ID },
    inLanguage: 'en-US',
    publisher: { '@id': ORG_ID },
  };
  if (articles && articles.length) {
    schema.mainEntity = {
      '@type': 'ItemList',
      itemListElement: articles.slice(0, 20).map((a, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        url: `${SITE.url}/news/${a.sport}/${a.slug}`,
        name: a.title,
      })),
    };
  }
  return schema;
}

// ════════════════════════════════════════════════════════════════════════
// HOME PAGE — special CollectionPage with featured items
// ════════════════════════════════════════════════════════════════════════
export function homePageSchema(articles) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${SITE.url}/#homepage`,
    url: SITE.url,
    name: SITE.name,
    description: SITE.description,
    isPartOf: { '@id': SITE_ID },
    inLanguage: 'en-US',
    publisher: { '@id': ORG_ID },
    mainEntity:
      articles && articles.length
        ? {
            '@type': 'ItemList',
            itemListElement: articles.slice(0, 10).map((a, idx) => ({
              '@type': 'ListItem',
              position: idx + 1,
              url: `${SITE.url}/news/${a.sport}/${a.slug}`,
              name: a.title,
            })),
          }
        : undefined,
  };
}

// ════════════════════════════════════════════════════════════════════════
// INJECTION HELPER — pass an array of schemas, this writes them to <head>
// ════════════════════════════════════════════════════════════════════════
export function injectSchemas(schemas, idPrefix = 'jsonld') {
  // Remove any previously injected jsonld scripts with this prefix
  document.querySelectorAll(`script[type="application/ld+json"][data-managed="${idPrefix}"]`).forEach((el) => el.remove());

  schemas.filter(Boolean).forEach((schema, idx) => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = `${idPrefix}-${idx}`;
    script.setAttribute('data-managed', idPrefix);
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────
function stripHtml(s) {
  return String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function nameToSlug(name) {
  return (name || '').toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
}

function formatPropForKeyword(p) {
  const map = {
    hr: 'home run props',
    k_prop: 'strikeout props',
    hitter: 'hitter props',
    altprop_total_bases: 'total bases props',
    altprop_hits: 'hits props',
    altprop_rbi: 'RBI props',
    altprop_doubles: 'doubles props',
  };
  return map[p] || `${p} props`;
}
