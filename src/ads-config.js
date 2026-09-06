/**
 * src/ads-config.js
 * PropBetEdge sports conversion inventory
 *
 * The news site is the top of funnel for the PropBetEdge sports network.
 * Ad inventory therefore prioritizes the next sports-product step:
 *   news -> sport intelligence product -> developer/API infrastructure.
 *
 * Real-estate cross-promo and inactive sportsbook affiliate creatives are
 * intentionally excluded from normal sports-news inventory.
 */

// ═════ IMAGE PROXY ═════
export const IMG_PROXY = 'https://propbet-img-proxy.sales-fd3.workers.dev/?url=';

export function proxyImage(rawUrl) {
  if (!rawUrl) return null;
  if (rawUrl.startsWith(IMG_PROXY)) return rawUrl;
  if (rawUrl.startsWith('/') || rawUrl.includes('propbetedge.ai')) return rawUrl;
  return IMG_PROXY + encodeURIComponent(rawUrl);
}

// Kept exported for compatibility, but sportsbook ads are disabled until real
// affiliate destinations are configured. Never render placeholder links.
export const AFFILIATE_LINKS = {
  draftkings: null,
  fanduel: null,
  betmgm: null,
  caesars: null,
};

export const PROPBET_LINKS = {
  network:     'https://propbetedge.ai',
  picks_mlb:   'https://mlb.propbetedge.ai',
  picks_nfl:   'https://nfl.propbetedge.ai',
  picks_ufc:   'https://ufc.propbetedge.ai',
  picks_nba:   'https://nba.propbetedge.ai',
  picks_nhl:   'https://nhl.propbetedge.ai',
  news_mlb:    'https://propbetedge.ai/news/mlb',
  news_nfl:    'https://propbetedge.ai/news/nfl',
  news_ufc:    'https://ufc.propbetedge.ai/news',
  news_nba:    'https://propbetedge.ai/news/nba',
  news_nhl:    'https://propbetedge.ai/news/nhl',
  algo:        'https://mlb.propbetedge.ai/askalgo',
  k_props:     'https://mlb.propbetedge.ai/kprops',
  hr_targets:  'https://mlb.propbetedge.ai/picks',
  learn:       'https://learn.propbetedge.ai',
  propsports:  'https://propsports.proptechusa.ai',
  discord:     'https://discord.gg/8rMxrMG5',
  twitter:     'https://x.com/MLBHRALERTSPBE',
  reddit:      'https://www.reddit.com/r/PropBetEdge/',
  linkedin:    'https://www.linkedin.com/company/propbetedge-ai/',
  api_news:    'https://rapidapi.com/propdata-propdata-default/api/propbetedge-sports-news-api',
};

const SPORT_CAMPAIGNS = {
  mlb: {
    key: 'propbetedge_mlb',
    tone: 'gold',
    eyebrow: '⚾ PROPBETEDGE MLB · LIVE',
    headline: 'From the story to the edge — open the full MLB intelligence layer.',
    sub: 'Live game context, player research, prop intelligence, model analysis and the same data infrastructure behind this coverage.',
    cta: 'Open MLB Intelligence',
    href: PROPBET_LINKS.picks_mlb,
  },
  nfl: {
    key: 'propbetedge_nfl',
    tone: 'gold',
    eyebrow: '🏈 PROPBETEDGE NFL · LIVE',
    headline: 'Football intelligence, built like an operating system.',
    sub: 'Market Board, Model Lab, line simulation, live game context and deeper matchup intelligence — connected to the PropBetEdge data layer.',
    cta: 'Explore NFL Intelligence',
    href: PROPBET_LINKS.picks_nfl,
  },
  ufc: {
    key: 'propbetedge_ufc',
    tone: 'gold',
    eyebrow: '🥊 PROPBETEDGE UFC · LIVE',
    headline: 'Go from the headline to the full fight intelligence layer.',
    sub: 'Every card, every fighter and every round — with Fight DNA, matchup intelligence, rankings, fight-week news and deep fighter research.',
    cta: 'Explore UFC Fight Intelligence',
    href: PROPBET_LINKS.picks_ufc,
  },
  nba: {
    key: 'propbetedge_nba',
    tone: 'gold',
    eyebrow: '🏀 PROPBETEDGE NBA · COMING SOON',
    headline: 'The PropBetEdge intelligence layer is coming to basketball.',
    sub: 'News impact, player research, live context and prop intelligence are being built into the next sport-specific experience.',
    cta: 'Follow NBA Coverage',
    href: PROPBET_LINKS.news_nba,
  },
  nhl: {
    key: 'propbetedge_nhl',
    tone: 'gold',
    eyebrow: '🏒 PROPBETEDGE NHL · COMING SOON',
    headline: 'Hockey is next on the PropBetEdge intelligence network.',
    sub: 'Follow NHL coverage now as the full live-data, player-research and prop-intelligence product comes online.',
    cta: 'Follow NHL Coverage',
    href: PROPBET_LINKS.news_nhl,
  },
};

// Products that should receive meaningful discovery inventory right now.
const LIVE_SPORT_KEYS = ['mlb', 'nfl', 'ufc'];

const PROPSPORTS_CAMPAIGN = {
  key: 'propsports',
  tone: 'algo',
  eyebrow: '⚡ PROPSPORTS API · FOR BUILDERS',
  headline: 'Building a sports product? Start with the data layer powering PropBetEdge.',
  sub: 'Production-ready sports data and intelligence infrastructure for apps, agents and AI products — built from the same data-first philosophy behind the PropBetEdge network.',
  cta: 'Explore PropSports API',
  href: PROPBET_LINKS.propsports,
};

const NEWS_API_CAMPAIGN = {
  key: 'propbetedge_news_api',
  tone: 'algo',
  eyebrow: '🗞️ SPORTS NEWS API · MACHINE READY',
  headline: 'Turn sports news into structured betting-impact intelligence.',
  sub: 'Stories scored for impact and tagged by player, team and prop type so products and AI systems can understand what actually matters.',
  cta: 'Explore the News API',
  href: PROPBET_LINKS.api_news,
};

const NETWORK_CAMPAIGN = {
  key: 'propbetedge_network',
  tone: 'gold',
  eyebrow: '⚡ THE PROPBETEDGE SPORTS NETWORK',
  headline: 'News is the surface. The intelligence layer goes much deeper.',
  sub: 'MLB, NFL and UFC now have dedicated intelligence products — purpose-built experiences connected by the same data-first PropBetEdge network.',
  cta: 'Explore the Sports Network',
  href: PROPBET_LINKS.network,
};

// Public compatibility export: sports-only inventory. No real-estate brands.
export const BRAND_FAMILY = [
  SPORT_CAMPAIGNS.mlb,
  SPORT_CAMPAIGNS.nfl,
  SPORT_CAMPAIGNS.ufc,
  SPORT_CAMPAIGNS.nba,
  SPORT_CAMPAIGNS.nhl,
  PROPSPORTS_CAMPAIGN,
  NEWS_API_CAMPAIGN,
];

let _lastBrandKey = null;

function normalizeSport(rawSport) {
  const sport = String(rawSport || '').toLowerCase();
  if (sport === 'mma') return 'ufc';
  return SPORT_CAMPAIGNS[sport] ? sport : null;
}

function inferredSport(ctx = {}) {
  const contextual = normalizeSport(ctx?.sport);
  if (contextual) return contextual;
  if (typeof window === 'undefined') return null;
  const match = String(window.location.pathname || '').match(/\/(?:news|games|leaders)\/(mlb|nfl|ufc|mma|nba|nhl)(?:\/|$)/i);
  return normalizeSport(match?.[1]);
}

function withUtm(href, slot, brandKey, sport = null) {
  try {
    const url = new URL(href, typeof window !== 'undefined' ? window.location.origin : 'https://propbetedge.ai');
    url.searchParams.set('utm_source', 'propbetedge');
    url.searchParams.set('utm_medium', 'house_ad');
    url.searchParams.set('utm_campaign', sport ? `${sport}_news_funnel` : 'sports_network_funnel');
    url.searchParams.set('utm_content', `${slot}_${brandKey}`);
    return url.toString();
  } catch {
    return href;
  }
}

function weightedPick(items) {
  const filtered = items.filter((item) => item && item.campaign && item.weight > 0 && item.campaign.key !== _lastBrandKey);
  const pool = filtered.length ? filtered : items.filter((item) => item && item.campaign && item.weight > 0);
  const total = pool.reduce((sum, item) => sum + item.weight, 0);
  if (!pool.length || total <= 0) return NETWORK_CAMPAIGN;
  let roll = Math.random() * total;
  for (const item of pool) {
    roll -= item.weight;
    if (roll <= 0) {
      _lastBrandKey = item.campaign.key;
      return item.campaign;
    }
  }
  const fallback = pool[pool.length - 1].campaign;
  _lastBrandKey = fallback.key;
  return fallback;
}

function liveSiblingInventory(currentSport, weight = 1) {
  return LIVE_SPORT_KEYS
    .filter((key) => key !== currentSport)
    .map((key) => ({ campaign: SPORT_CAMPAIGNS[key], weight }));
}

function campaignForSlot(slotName, ctx = {}) {
  const sport = inferredSport(ctx);
  const primary = sport ? SPORT_CAMPAIGNS[sport] : null;

  // On a sport-specific story the corresponding product dominates, but readers
  // can still discover the other live PropBetEdge products. On generic news,
  // MLB/NFL/UFC rotate as first-class destinations instead of defaulting to MLB.
  if (slotName === 'after_take' || slotName === 'end_of_article') {
    return weightedPick([
      ...(primary ? [{ campaign: primary, weight: 8 }] : LIVE_SPORT_KEYS.map((key) => ({ campaign: SPORT_CAMPAIGNS[key], weight: 4 }))),
      ...(primary ? liveSiblingInventory(sport, 1) : []),
      { campaign: NETWORK_CAMPAIGN, weight: 2 },
      { campaign: PROPSPORTS_CAMPAIGN, weight: 2 },
      { campaign: NEWS_API_CAMPAIGN, weight: 1 },
    ]);
  }

  return weightedPick([
    ...(primary ? [{ campaign: primary, weight: 6 }] : LIVE_SPORT_KEYS.map((key) => ({ campaign: SPORT_CAMPAIGNS[key], weight: 3 }))),
    ...(primary ? liveSiblingInventory(sport, 1) : []),
    { campaign: NETWORK_CAMPAIGN, weight: 2 },
    { campaign: PROPSPORTS_CAMPAIGN, weight: 3 },
    { campaign: NEWS_API_CAMPAIGN, weight: 1 },
  ]);
}

export function resetAdRotation() {
  _lastBrandKey = null;
}

export function ad_brand_family(slotName = 'brand_slot', ctx = {}) {
  const sport = inferredSport(ctx);
  const campaign = campaignForSlot(slotName, ctx);
  const trackedHref = withUtm(campaign.href, slotName, campaign.key, sport);
  return `
    <a href="${trackedHref}" class="ad-block ad-brand-family ad-tone-${campaign.tone}" target="_blank" rel="noopener sponsored" data-ad-slot="${slotName}" data-ad-brand="${campaign.key}" data-ad-sport="${sport || 'network'}">
      <div class="ad-block-content">
        <span class="ad-block-eyebrow">${campaign.eyebrow}</span>
        <h3 class="ad-block-headline">${campaign.headline}</h3>
        ${campaign.sub ? `<p class="ad-block-sub">${campaign.sub}</p>` : ''}
        <span class="ad-block-cta">${campaign.cta} →</span>
      </div>
    </a>
  `;
}

export function ad_header_banner(ctx = {}) {
  const sport = inferredSport(ctx);
  const campaign = sport
    ? SPORT_CAMPAIGNS[sport]
    : weightedPick([
        ...LIVE_SPORT_KEYS.map((key) => ({ campaign: SPORT_CAMPAIGNS[key], weight: 3 })),
        { campaign: NETWORK_CAMPAIGN, weight: 2 },
      ]);
  return renderAdBanner({
    ...campaign,
    href: withUtm(campaign.href, 'header_banner', campaign.key, sport),
  });
}

export function ad_in_article_after_take(articleContext = {}) {
  return ad_brand_family('after_take', articleContext);
}

export function ad_in_article_mid(articleContext = {}) {
  // Deep-engagement inventory remains entirely inside the PropBetEdge sports
  // ecosystem until real affiliate partnerships are configured.
  return ad_brand_family('mid_article', articleContext);
}

export function ad_footer_banner() {
  return `
    <div class="footer-cta">
      <div class="container footer-cta-inner">
        <div class="footer-cta-text">
          <span class="footer-cta-eyebrow">⚡ THE PROPBETEDGE SPORTS NETWORK</span>
          <h3 class="footer-cta-headline">Read the news. Then go deeper.</h3>
          <p class="footer-cta-sub">Move from headlines into live MLB, NFL and UFC intelligence — or build on the data infrastructure powering the network.</p>
        </div>
        <div class="footer-cta-buttons">
          <a href="${withUtm(PROPBET_LINKS.picks_mlb, 'footer_banner', 'mlb', 'mlb')}" class="footer-cta-btn footer-cta-btn-mlb" target="_blank" rel="noopener">
            <span class="sport-emoji">⚾</span><span>MLB Intelligence</span>
          </a>
          <a href="${withUtm(PROPBET_LINKS.picks_nfl, 'footer_banner', 'nfl', 'nfl')}" class="footer-cta-btn footer-cta-btn-nfl" target="_blank" rel="noopener">
            <span class="sport-emoji">🏈</span><span>NFL Intelligence</span>
          </a>
          <a href="${withUtm(PROPBET_LINKS.picks_ufc, 'footer_banner', 'ufc', 'ufc')}" class="footer-cta-btn footer-cta-btn-ufc" target="_blank" rel="noopener">
            <span class="sport-emoji">🥊</span><span>UFC Fight Intelligence</span>
          </a>
          <a href="${withUtm(PROPBET_LINKS.network, 'footer_banner', 'network')}" class="footer-cta-btn" target="_blank" rel="noopener">
            <span class="sport-emoji">⚡</span><span>PropBetEdge Network</span>
          </a>
          <a href="${withUtm(PROPBET_LINKS.propsports, 'footer_banner', 'propsports')}" class="footer-cta-btn" target="_blank" rel="noopener">
            <span class="sport-emoji">API</span><span>PropSports API</span>
          </a>
        </div>
      </div>
    </div>
  `;
}

function renderAdBanner({ tone, eyebrow, headline, cta, href }) {
  const isExternal = /^https?:\/\//i.test(href);
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
  const isExternal = /^https?:\/\//i.test(href);
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
