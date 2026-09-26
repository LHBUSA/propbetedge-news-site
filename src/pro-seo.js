/* PropBetEdge All Access (/pro) — the ONE authoritative SEO + sharing contract.
 *
 * Shared by Edge Middleware (crawler bytes) and the client page (hydration), so
 * the raw HTML and the hydrated DOM describe the same product with the same
 * title, description, canonical, robots, Open Graph, Twitter and JSON-LD.
 * Pure: no DOM, no network, no side effects.
 *
 * Commercial facts come from pro-content.js (the single Stripe identity). The
 * structured data states the regular $29/month price; THEEDGE25 is a
 * coupon-required launch discount and is described only in visible copy and
 * descriptions, never as the listed price. */

import { ALL_ACCESS, SPORTS } from './pro-content.js';

import { PROPBETEDGE_X_HANDLE } from './social.js';
export const SITE = 'https://propbetedge.ai';
export const PRO_CANONICAL = `${SITE}/pro`;
export const ORG_ID = `${SITE}/#organization`;
export const WEBSITE_ID = `${SITE}/#website`;
export const WEBPAGE_ID = `${PRO_CANONICAL}#webpage`;
export const PRODUCT_ID = `${PRO_CANONICAL}#product`;
export const OFFER_ID = `${PRO_CANONICAL}#offer`;
export const BREADCRUMB_ID = `${PRO_CANONICAL}#breadcrumb`;

export const PRO_TITLE = 'PropBetEdge All Access | MLB, NFL, NBA, NHL, WNBA & UFC Pro';
export const PRO_DESCRIPTION = 'One $29/month membership for every PropBetEdge sport: MLB, NFL, NBA, NHL, WNBA and UFC Pro today, every future sport included. Proprietary prediction models, tracked and graded picks, live intelligence and PBEcast under one login.';
export const PRO_SUCCESS_TITLE = 'All Access is active | PropBetEdge';
export const PRO_SUCCESS_DESCRIPTION = 'Your PropBetEdge All Access membership is active. Sign in to any sport with the email you used at checkout.';

/* Dedicated, evergreen share card: a static 1200x630 PNG at a stable public
   URL. Static on purpose: no auth, no runtime, correct MIME, cacheable. */
export const PRO_SOCIAL_IMAGE = Object.freeze({
  url: `${SITE}/social/all-access-1200x630.png`,
  secure_url: `${SITE}/social/all-access-1200x630.png`,
  type: 'image/png',
  width: 1200,
  height: 630,
  alt: 'PropBetEdge All Access: one membership, every sport. MLB, NFL, NBA, NHL, WNBA, UFC. $29 per month.',
});

export const PRO_SHARE_TITLE = 'PropBetEdge All Access — MLB, NFL, NBA, NHL, WNBA and UFC Pro under one membership.';

export const ROBOTS_INDEX = 'index, follow, max-image-preview:large';
export const ROBOTS_TRANSACTIONAL = 'noindex, follow';

/** Is this request the Stripe success return? Query-string aware, path-agnostic. */
export function isCheckoutSuccess(search) {
  try { return new URLSearchParams(String(search || '')).get('checkout') === 'success'; }
  catch { return false; }
}

/** The public identity of the page never carries a query string or trailing slash. */
export function canonicalFor() {
  return PRO_CANONICAL;
}

export function proHeadMeta({ checkoutSuccess = false } = {}) {
  return {
    title: checkoutSuccess ? PRO_SUCCESS_TITLE : PRO_TITLE,
    description: checkoutSuccess ? PRO_SUCCESS_DESCRIPTION : PRO_DESCRIPTION,
    canonical: PRO_CANONICAL,
    robots: checkoutSuccess ? ROBOTS_TRANSACTIONAL : ROBOTS_INDEX,
    image: PRO_SOCIAL_IMAGE,
  };
}

/** Complete, dedicated Open Graph set. Always the public (non-success) story:
 *  a shared success URL still previews as the product. */
export function proOpenGraphTags() {
  const image = PRO_SOCIAL_IMAGE;
  return [
    ['og:type', 'website'],
    ['og:site_name', 'PropBetEdge'],
    ['og:locale', 'en_US'],
    ['og:title', PRO_TITLE],
    ['og:description', PRO_DESCRIPTION],
    ['og:url', PRO_CANONICAL],
    ['og:image', image.url],
    ['og:image:secure_url', image.secure_url],
    ['og:image:type', image.type],
    ['og:image:width', String(image.width)],
    ['og:image:height', String(image.height)],
    ['og:image:alt', image.alt],
  ];
}

export function proTwitterTags() {
  return [
    ['twitter:card', 'summary_large_image'],
    ['twitter:site', PROPBETEDGE_X_HANDLE],
    ['twitter:title', PRO_TITLE],
    ['twitter:description', PRO_DESCRIPTION],
    ['twitter:image', PRO_SOCIAL_IMAGE.url],
    ['twitter:image:alt', PRO_SOCIAL_IMAGE.alt],
  ];
}

export function proSocialTags() {
  return [...proOpenGraphTags(), ...proTwitterTags()];
}

/* One connected graph. Organization (#organization) and WebSite (#website) are
   defined once, site-wide, in the shipped global schema; here they are
   referenced by @id so the page, product and offer attach to them instead of
   redefining them. No ratings, reviews, counts or awards: none exist. */
export function proJsonLd() {
  const sportSites = SPORTS.map((s) => ({ '@type': 'WebSite', name: s.name, url: `${s.url}/` }));
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': WEBPAGE_ID,
        url: PRO_CANONICAL,
        name: PRO_TITLE,
        description: PRO_DESCRIPTION,
        inLanguage: 'en-US',
        isPartOf: { '@id': WEBSITE_ID },
        about: { '@id': PRODUCT_ID },
        mainEntity: { '@id': PRODUCT_ID },
        breadcrumb: { '@id': BREADCRUMB_ID },
        primaryImageOfPage: {
          '@type': 'ImageObject',
          url: PRO_SOCIAL_IMAGE.url,
          contentUrl: PRO_SOCIAL_IMAGE.url,
          width: PRO_SOCIAL_IMAGE.width,
          height: PRO_SOCIAL_IMAGE.height,
          caption: PRO_SOCIAL_IMAGE.alt,
        },
        publisher: { '@id': ORG_ID },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': BREADCRUMB_ID,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'PropBetEdge', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'All Access', item: PRO_CANONICAL },
        ],
      },
      {
        '@type': 'Product',
        '@id': PRODUCT_ID,
        name: ALL_ACCESS.name,
        alternateName: 'All Access',
        description: 'A monthly sports intelligence membership covering every PropBetEdge sport. Includes the Pro tier of PropBetEdge MLB, NFL, NBA, NHL, WNBA and UFC, plus every future PropBetEdge sport and Pro product: proprietary prediction models, tracked and graded picks, live game intelligence, PBEcast live experiences, player and matchup intelligence, with one login across the network.',
        url: PRO_CANONICAL,
        image: PRO_SOCIAL_IMAGE.url,
        category: 'Sports intelligence membership',
        brand: { '@id': ORG_ID },
        manufacturer: { '@id': ORG_ID },
        isRelatedTo: sportSites,
        mainEntityOfPage: { '@id': WEBPAGE_ID },
        offers: { '@id': OFFER_ID },
      },
      {
        '@type': 'Offer',
        '@id': OFFER_ID,
        name: `${ALL_ACCESS.name} — monthly`,
        url: ALL_ACCESS.checkoutUrl,
        price: String(ALL_ACCESS.priceUsd),
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
        itemOffered: { '@id': PRODUCT_ID },
        seller: { '@id': ORG_ID },
        eligibleRegion: 'US',
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: String(ALL_ACCESS.priceUsd),
          priceCurrency: 'USD',
          billingDuration: 1,
          billingIncrement: 1,
          unitCode: 'MON',
          referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'MON' },
        },
      },
    ],
  };
}

/** Crawler-readable copy of the actual page: the same product the hydrated
 *  page renders, in semantic HTML, without hidden SEO paragraphs. */
export function proServerHtml({ checkoutSuccess = false } = {}) {
  const sports = SPORTS.map((s) => `<li><a href="${s.url}/">${s.name}</a> — ${escapeHtml(s.edge)}</li>`).join('\n        ');
  const intro = checkoutSuccess
    ? `<p>Your PropBetEdge All Access membership is active. Open any sport below and sign in with the email you used at checkout.</p>`
    : `<p>One membership. Every sport. Every model. Every current and future PropBetEdge Pro product.</p>
      <p><strong>$${ALL_ACCESS.priceUsd} / month.</strong> Launch offer: ${ALL_ACCESS.promoPercent}% off for as long as you stay active with code <strong>${ALL_ACCESS.promoCode}</strong>.</p>
      <p><a href="${ALL_ACCESS.checkoutUrl}" rel="noopener">Get All Access</a></p>`;
  return `<main class="pbe-ssr-pro" data-server-rendered="1">
    <nav aria-label="Breadcrumb"><a href="/">PropBetEdge</a> &rsaquo; All Access</nav>
    <article>
      <p>PropBetEdge Network · Membership</p>
      <h1>${checkoutSuccess ? 'Welcome to All Access' : 'PropBetEdge All Access'}</h1>
      ${intro}
      <h2>Every sport. One login.</h2>
      <p>All Access unlocks the Pro tier of every PropBetEdge sport property, and every sport added next:</p>
      <ul>
        ${sports}
        <li>Every future PropBetEdge sport and Pro product, included on launch day</li>
      </ul>
      <h2>What the membership includes</h2>
      <ul>
        <li><strong>Proprietary algorithms</strong> — each sport runs its own PropBetEdge prediction model, built and tuned in-house.</li>
        <li><strong>Tracked, graded picks</strong> — picks are locked before the game, graded against official results and published to a permanent track record.</li>
        <li><strong>Live intelligence</strong> — injuries, lineups, weigh-ins, weather, venue and market moves resolved into what changes tonight.</li>
        <li><strong>PBEcast and live experiences</strong> — sport-specific live surfaces that follow the game as it happens.</li>
        <li><strong>Player and matchup intelligence</strong> — Player DNA, splits and arsenals, fighter records and rankings, team and matchup pages.</li>
        <li><strong>Predictions and future Pro tools</strong> — new models, sports and Pro products join the network as they launch.</li>
      </ul>
      <p>Individual sport plans stay available. All Access is the umbrella, not a replacement.</p>
    </article>
  </main>`;
}

function escapeHtml(v) {
  return String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
