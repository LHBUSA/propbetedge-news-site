/**
 * src/ads-config.js
 * ─────────────────────────────────────────────────────────────────────────
 * ALL ad slots and creatives defined here. Paywall-ready copy.
 *
 * v3.16: Disclosure handled by existing CSS .ad-brand-family::before
 *        rel="sponsored" added to ALL ad links (Google 2019 spec)
 *        1-800-GAMBLER inline tag on sportsbook ads (state law)
 *        Same-page frequency cap to prevent duplicate brand showings
 *        Improved pickBrand fallback (random vs always-first)
 * v3.17: Discord invite updated → discord.gg/hXhm33SE (replaces stale e9S6pFq9).
 * v3.18: Added PropBetEdge Sports News API to BRAND_FAMILY rotation. This
 *        product is sold ONLY on RapidAPI (no standalone Stripe site), so its
 *        ad points at the RapidAPI listing. PropSports/PropData are unchanged —
 *        they have their own checkout. New link: PROPBET_LINKS.api_news.
 * ─────────────────────────────────────────────────────────────────────────
 */

// ═════ IMAGE PROXY ═════
// Used to bypass hotlink blocking from ESPN/MLB.com/etc.
export const IMG_PROXY = 'https://propbet-img-proxy.sales-fd3.workers.dev/?url=';

/**
 * Wrap any image URL through the proxy. Skips proxying for:
 * - Empty/null URLs
 * - Already-proxied URLs
 * - URLs hosted on PropBetEdge domains (no need to proxy)
 */
export function proxyImage(rawUrl) {
  if (!rawUrl) return null;
  if (rawUrl.startsWith(IMG_PROXY)) return rawUrl;
  if (rawUrl.startsWith('/') || rawUrl.includes('propbetedge.ai')) return rawUrl;
  return IMG_PROXY + encodeURIComponent(rawUrl);
}

// ═════ AFFILIATE LINKS ═════
export const AFFILIATE_LINKS = {
  draftkings: 'https://sportsbook.draftkings.com/?REPLACE_WITH_AFFILIATE_ID',
  fanduel:    'https://www.fanduel.com/?REPLACE_WITH_AFFILIATE_ID',
  betmgm:     'https://sports.betmgm.com/?REPLACE_WITH_AFFILIATE_ID',
  caesars:    'https://www.caesars.com/sportsbook?REPLACE_WITH_AFFILIATE_ID',
};

// ═════ HOUSE LINKS ═════
export const PROPBET_LINKS = {
  picks_mlb:   'https://mlb.propbetedge.ai',
  picks_nfl:   'https://nfl.propbetedge.ai',
  picks_nba:   'https://nba.propbetedge.ai',
  picks_nhl:   'https://nhl.propbetedge.ai',
  algo:        'https://mlb.propbetedge.ai/askalgo',
  k_props:     'https://mlb.propbetedge.ai/kprops',
  hr_targets:  'https://mlb.propbetedge.ai/picks',
  learn:       'https://learn.propbetedge.ai',
  discord:     'https://discord.gg/8rMxrMG5',
  twitter:     'https://x.com/propbetedgeai',
  reddit:      'https://www.reddit.com/r/PropBetEdge/',
  linkedin:    'https://www.linkedin.com/company/propbetedge-ai/',
  // Sports News API — sold only on RapidAPI (no standalone site).
  api_news:    'https://rapidapi.com/propdata-propdata-default/api/propbetedge-sports-news-api',
};

// ═════════════════════════════════════════════════════════════════════════
// FAMILY OF BRANDS — Justin's products advertised cross-business
// Each click is tagged with UTM params for attribution.
// ═════════════════════════════════════════════════════════════════════════
function withUtm(href, slot, brandKey) {
  const url = new URL(href);
  url.searchParams.set('utm_source', 'propbetedge');
  url.searchParams.set('utm_medium', 'cross_promo');
  url.searchParams.set('utm_campaign', 'news_ads');
  url.searchParams.set('utm_content', `${slot}_${brandKey}`);
  return url.toString();
}

export const BRAND_FAMILY = [
  {
    key: 'propbetedge_pro',
    eyebrow: '⚡ PropBetEdge Pro',
    headline: 'Tonight\'s sharpest picks. AI-built. $29/mo.',
    sub: 'Live odds, prop edges, and The Algo — every league, all season.',
    cta: 'Get the picks',
    href: PROPBET_LINKS.picks_mlb,
    tone: 'gold',
    weight: 4, // weighted higher — it's the money play
  },
  {
    key: 'propdata',
    eyebrow: '🏠 PropData API',
    headline: '165M+ property records. Own pipeline. $49 flat.',
    sub: 'Owner data, rents, FEMA risk, school scores — 16 live sources. ATTOM charges $2K/mo for less.',
    cta: 'Get free API key',
    href: 'https://propdata.proptechusa.ai/',
    tone: 'algo',
    weight: 1,
  },
  {
    key: 'propsports',
    eyebrow: '⚡ PropSports API',
    headline: 'Sports data with its own Poisson odds model. $24/mo flat.',
    sub: '37+ endpoints across MLB, NFL, NBA, NHL. Owned Statcast. We don\'t scrape DK — we generate odds.',
    cta: 'Get free MLB key',
    href: 'https://propsports.proptechusa.ai/',
    tone: 'algo',
    weight: 2,
  },
  {
    key: 'propbetedge_news_api',
    eyebrow: '🗞️ Sports News API',
    headline: 'AI sports news, scored for prop-bet impact.',
    sub: 'Every story Claude-scored 1–5 for line impact and tagged by player, team & prop type. /algo/affecting-tonight returns tonight\'s edges LLM-ready in one call. MLB · NFL · NBA · NHL.',
    cta: 'View on RapidAPI',
    href: PROPBET_LINKS.api_news,
    tone: 'algo',
    weight: 1,
  },
  {
    key: 'intelligenthomebuying',
    eyebrow: '🏡 IntelligentHomeBuying',
    headline: 'Free real estate intelligence. All 50 states.',
    sub: 'Live mortgage rates, market data, buyer & seller guides. No paywall, no signup.',
    cta: 'Browse markets',
    href: 'https://www.intelligenthomebuying.com/',
    tone: 'gold',
    weight: 1,
  },
  {
    key: 'intelligentstr',
    eyebrow: '🌴 IntelligentSTR',
    headline: 'Short-term rental market intelligence.',
    sub: 'Occupancy forecasts, revenue analysis, and STR market data for AirBnB operators. Free.',
    cta: 'Free analysis',
    href: 'https://intelligentstr.com',
    tone: 'algo',
    weight: 1,
  },
  {
    key: 'intelligentlandlord',
    eyebrow: '🔑 IntelligentLandlord',
    headline: 'Free rental & landlord intelligence.',
    sub: 'Rent optimization, tenant signals, and rental market data across thousands of US zips.',
    cta: 'Browse markets',
    href: 'https://intelligentlandlord.com',
    tone: 'gold',
    weight: 1,
  },
  {
    key: 'proptechusa',
    eyebrow: '🛠️ PropTechUSA.ai',
    headline: 'The dev studio behind PropData, IntelligentSTR & more.',
    sub: '200+ Cloudflare Workers in production. Real estate intelligence built from scratch.',
    cta: 'See the stack',
    href: 'https://proptechusa.ai',
    tone: 'algo',
    weight: 1,
  },
  {
    key: 'lhbusa',
    eyebrow: '💰 Local Home Buyers USA',
    headline: 'Sell your home in 7 days — or partner for top dollar.',
    sub: 'Cash offers nationwide. Or our Bee\'s Knees partnership for premium pricing.',
    cta: 'Learn how',
    href: 'https://localhomebuyersusa.com',
    tone: 'gold',
    weight: 1,
  },
];

// Same-page frequency cap — avoid showing the same brand back-to-back.
// Module-level state persists across calls in the same render pass.
let _lastBrandKey = null;

// Weighted random pick — PropBetEdge Pro shows ~4x more often than other brands.
// Skips the most recently shown brand to avoid duplicates on a single page.
function pickBrand() {
  const eligible = BRAND_FAMILY.filter((b) => b.key !== _lastBrandKey);
  const pool = eligible.length ? eligible : BRAND_FAMILY;
  const total = pool.reduce((s, b) => s + (b.weight || 1), 0);
  let r = Math.random() * total;
  for (const brand of pool) {
    r -= brand.weight || 1;
    if (r <= 0) {
      _lastBrandKey = brand.key;
      return brand;
    }
  }
  // Safer fallback: random pick instead of always first brand
  const fallback = pool[Math.floor(Math.random() * pool.length)];
  _lastBrandKey = fallback.key;
  return fallback;
}

// Reset the same-page frequency cap (useful for tests or per-request resets)
export function resetAdRotation() {
  _lastBrandKey = null;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ═════════════════════════════════════════════════════════════════════════
// SLOT: brand_family — rotating cross-promo ad for any article position
// Used after lead image, after take, end of article
// Disclosure is rendered by CSS .ad-brand-family::before automatically
// ═════════════════════════════════════════════════════════════════════════
export function ad_brand_family(slotName = 'brand_slot') {
  const brand = pickBrand();
  const trackedHref = withUtm(brand.href, slotName, brand.key);
  return `
    <a href="${trackedHref}" class="ad-block ad-brand-family ad-tone-${brand.tone}" target="_blank" rel="noopener sponsored" data-ad-slot="${slotName}" data-ad-brand="${brand.key}">
      <div class="ad-block-content">
        <span class="ad-block-eyebrow">${brand.eyebrow}</span>
        <h3 class="ad-block-headline">${brand.headline}</h3>
        ${brand.sub ? `<p class="ad-block-sub">${brand.sub}</p>` : ''}
        <span class="ad-block-cta">${brand.cta} →</span>
      </div>
    </a>
  `;
}

// ═════════════════════════════════════════════════════════════════════════
// SLOT: header_banner — between topbar and masthead, every page
// ═════════════════════════════════════════════════════════════════════════
export function ad_header_banner() {
  const creatives = [
    {
      tone: 'gold',
      eyebrow: '🔥 Tonight\'s slate',
      headline: 'AI-built picks across MLB, NFL, NBA & NHL',
      cta: 'See tonight\'s picks',
      href: PROPBET_LINKS.picks_mlb,
    },
    {
      tone: 'algo',
      eyebrow: '⚡ Ask The Algo',
      headline: 'Real-time prop-bet intelligence on tonight\'s slate',
      cta: 'Try The Algo',
      href: PROPBET_LINKS.algo,
    },
    {
      tone: 'gold',
      eyebrow: '🎯 The Edge',
      headline: 'Sharp lines, AI prop analysis — all in one place',
      cta: 'Get the picks',
      href: PROPBET_LINKS.picks_mlb,
    },
  ];
  return renderAdBanner(pick(creatives));
}

// ═════════════════════════════════════════════════════════════════════════
// SLOT: in_article_after_take — right after AI take callout
// v3.9.2: Now rotates brand_family ads (cross-promo + PropBetEdge Pro weighted).
// Sportsbook ads moved to mid_article only — eliminates back-to-back ad stacking.
// ═════════════════════════════════════════════════════════════════════════
export function ad_in_article_after_take(articleContext = {}) {
  return ad_brand_family('after_take');
}

// ═════════════════════════════════════════════════════════════════════════
// SLOT: in_article_mid — auto-injected after 3rd paragraph of body
// v3.9.2: 50/50 split between brand_family and sportsbook offers.
// Sportsbook ads ONLY appear here — deep in article where reader is engaged.
// ═════════════════════════════════════════════════════════════════════════
export function ad_in_article_mid(articleContext = {}) {
  // 50% brand_family (cross-promo), 50% sportsbook offers
  if (Math.random() < 0.5) {
    return ad_brand_family('mid_article');
  }

  const sportsbookCreatives = [
    {
      tone: 'sportsbook',
      eyebrow: 'Place this bet',
      headline: 'New users get a $200 bonus on their first bet',
      sub: '21+ · T&Cs apply · See sportsbook for details · If you or someone you know has a gambling problem, call 1-800-GAMBLER',
      cta: 'Open DraftKings',
      href: AFFILIATE_LINKS.draftkings,
      sportsbook: 'DraftKings',
    },
    {
      tone: 'sportsbook',
      eyebrow: 'Bet this angle',
      headline: 'Get up to $1,000 in bonus bets — first bet covered',
      sub: '21+ · T&Cs apply · If you or someone you know has a gambling problem, call 1-800-GAMBLER',
      cta: 'Open FanDuel',
      href: AFFILIATE_LINKS.fanduel,
      sportsbook: 'FanDuel',
    },
  ];
  return renderAdBlock(pick(sportsbookCreatives));
}

// ═════════════════════════════════════════════════════════════════════════
// SLOT: footer_banner — above main footer, sells across all sports + community
// (House CTA, not paid advertising — so no disclosure needed)
// ═════════════════════════════════════════════════════════════════════════
export function ad_footer_banner() {
  return `
    <div class="footer-cta">
      <div class="container footer-cta-inner">
        <div class="footer-cta-text">
          <span class="footer-cta-eyebrow">⚡ Tonight's Slate · Every League</span>
          <h3 class="footer-cta-headline">Sharp picks. AI-built. Built to win.</h3>
          <p class="footer-cta-sub">The same model that wrote this article grades picks against live odds 24/7. Pick your sport →</p>
        </div>
        <div class="footer-cta-buttons">
          <a href="${PROPBET_LINKS.picks_mlb}" class="footer-cta-btn footer-cta-btn-mlb" target="_blank" rel="noopener">
            <span class="sport-emoji">⚾</span><span>MLB Picks</span>
          </a>
          <a href="${PROPBET_LINKS.picks_nfl}" class="footer-cta-btn footer-cta-btn-nfl" target="_blank" rel="noopener">
            <span class="sport-emoji">🏈</span><span>NFL Picks</span>
          </a>
          <a href="${PROPBET_LINKS.picks_nba}" class="footer-cta-btn footer-cta-btn-nba" target="_blank" rel="noopener">
            <span class="sport-emoji">🏀</span><span>NBA Picks</span>
          </a>
          <a href="${PROPBET_LINKS.picks_nhl}" class="footer-cta-btn footer-cta-btn-nhl" target="_blank" rel="noopener">
            <span class="sport-emoji">🏒</span><span>NHL Picks</span>
          </a>
        </div>
      </div>
    </div>
  `;
}

// ═════════════════════════════════════════════════════════════════════════
// RENDER HELPERS
// ═════════════════════════════════════════════════════════════════════════

function renderAdBanner({ tone, eyebrow, headline, cta, href }) {
  const isExternal = href.startsWith('http');
  return `
    <a href="${href}" class="ad-banner ad-tone-${tone}" target="${isExternal ? '_blank' : '_self'}" rel="noopener sponsored">
      <div class="ad-banner-inner">
        <span class="ad-banner-eyebrow">${eyebrow}</span>
        <span class="ad-banner-headline">${headline}</span>
        <span class="ad-banner-cta">${cta} →</span>
      </div>
    </a>
  `;
}

function renderAdBlock({ tone, eyebrow, headline, sub, cta, href, sportsbook }) {
  const isExternal = href.startsWith('http');
  return `
    <a href="${href}" class="ad-block ad-tone-${tone}" target="${isExternal ? '_blank' : '_self'}" rel="noopener sponsored"${sportsbook ? ` data-ad-sportsbook="${sportsbook}"` : ''}>
      <div class="ad-block-content">
        <span class="ad-block-eyebrow">${eyebrow}${sportsbook ? ` · Sponsored` : ''}</span>
        <h3 class="ad-block-headline">${headline}</h3>
        ${sub ? `<p class="ad-block-sub">${sub}</p>` : ''}
        <span class="ad-block-cta">${cta} →</span>
      </div>
    </a>
  `;
}
