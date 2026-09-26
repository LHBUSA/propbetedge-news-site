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

import { PROPBETEDGE_X_URL } from './social.js';

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

// The one PropBetEdge Discord invite for the whole network (non-expiring,
// owner-confirmed 2026-09-11). Reference this constant; never paste an
// invite code anywhere else - per-page codes are how 8rMxrMG5 and e9S6pFq9
// both expired while still linked.
export const PROPBETEDGE_DISCORD_URL = 'https://discord.gg/kb5zCTHbME';

export const PROPBET_LINKS = {
  network:     'https://propbetedge.ai',
  picks_mlb:   'https://mlb.propbetedge.ai',
  picks_nfl:   'https://nfl.propbetedge.ai',
  picks_ufc:   'https://ufc.propbetedge.ai',
  picks_wnba:  'https://wnba.propbetedge.ai',
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
  learn:       'https://learn.propbetedge.ai/',
  propsports:  'https://propsports.proptechusa.ai',
  discord:     PROPBETEDGE_DISCORD_URL,
  twitter:     PROPBETEDGE_X_URL,
  bluesky:     'https://bsky.app/profile/propbetedge.bsky.social',
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
    eyebrow: '🏀 PROPBETEDGE NBA · LIVE',
    headline: 'Take the basketball story into the full NBA intelligence layer.',
    sub: 'Live basketball research, player context, game intelligence and connected PropBetEdge tools.',
    cta: 'Open NBA Intelligence',
    href: PROPBET_LINKS.picks_nba,
  },
  wnba: {
    key: 'propbetedge_wnba',
    tone: 'gold',
    eyebrow: '🏀 PROPBETEDGE WNBA · LIVE',
    headline: 'Women’s basketball intelligence built beyond the box score.',
    sub: 'Live games, PBE Picks, player profiles, WNBACast and original metrics such as WinBA.',
    cta: 'Open WNBA Intelligence',
    href: PROPBET_LINKS.picks_wnba,
  },
  nhl: {
    key: 'propbetedge_nhl',
    tone: 'gold',
    eyebrow: '🏒 PROPBETEDGE NHL · LIVE',
    headline: 'Hockey intelligence goes well beyond the scoreboard.',
    sub: 'Ice Board, PBE Cast, PBE Picks, player research, documented fights and live hockey context.',
    cta: 'Open NHL Intelligence',
    href: PROPBET_LINKS.picks_nhl,
  },
};

// Products that should receive meaningful discovery inventory right now.
const LIVE_SPORT_KEYS = ['mlb', 'nfl', 'ufc', 'wnba', 'nba', 'nhl'];

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

const FREE_PICKS_CAMPAIGN = {
  key: 'free_picks',
  tone: 'gold',
  eyebrow: '⚡ FREE PICKS · PUBLIC PROOF',
  headline: 'Every public call stays on the board.',
  sub: 'See today’s free picks, live grading and the immutable track record — wins and losses included.',
  cta: 'Open Free Picks',
  href: '/odds',
};

const FREE_HISTORY_CAMPAIGN = {
  key: 'free_picks_history',
  tone: 'gold',
  eyebrow: '✓ FREE PICKS · FULL HISTORY',
  headline: 'Don’t take the record on faith. Inspect every call.',
  sub: 'The complete public ledger shows the pick, publication time, result and settlement proof with no historical backfill.',
  cta: 'View Full History',
  href: '/odds/history',
};

const PBECAST_CAMPAIGN = {
  key: 'pbe_cast',
  tone: 'gold',
  eyebrow: '● PBE CAST · LIVE GAMES',
  headline: 'Follow the game live, then go straight into the intelligence layer.',
  sub: 'Live scores and game state across the network with direct paths into each sport-specific PropBetEdge product.',
  cta: 'Open PBE Cast',
  href: '/games',
};

const LEADERS_CAMPAIGN = {
  key: 'live_leaders',
  tone: 'gold',
  eyebrow: '📊 LIVE LEADERS · CONNECTED PROFILES',
  headline: 'See who is actually leading each league right now.',
  sub: 'Live leaderboards connect directly into player and team intelligence across the PropBetEdge network.',
  cta: 'Open League Leaders',
  href: '/leaders',
};

// Compatibility key for older post-render code. It deliberately points deeper
// into the product instead of linking the PropBetEdge homepage back to itself.
const NETWORK_CAMPAIGN = {
  key: 'propbetedge_network',
  tone: 'gold',
  eyebrow: '⚡ THE PROPBETEDGE SPORTS NETWORK',
  headline: 'News is the surface. Jump into the live intelligence layer.',
  sub: 'Free Picks, PBE Cast, live league leaders and six sport-specific intelligence products are connected across one network.',
  cta: 'Open Free Picks',
  href: '/odds',
};

// Public compatibility export: sports-only inventory. No real-estate brands.
export const BRAND_FAMILY = [
  SPORT_CAMPAIGNS.mlb,
  SPORT_CAMPAIGNS.nfl,
  SPORT_CAMPAIGNS.ufc,
  SPORT_CAMPAIGNS.wnba,
  SPORT_CAMPAIGNS.nba,
  SPORT_CAMPAIGNS.nhl,
  FREE_PICKS_CAMPAIGN,
  PBECAST_CAMPAIGN,
  LEADERS_CAMPAIGN,
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
  const match = String(window.location.pathname || '').match(/\/(?:news|games|leaders|team|standings|player)\/(mlb|nfl|ufc|mma|wnba|nba|nhl)(?:\/|$)/i);
  return normalizeSport(match?.[1]);
}

// Hosts whose pages must never carry marketing UTMs: they are indexable and
// the UTM variants were showing up in Search Console as separate URLs. House-ad
// clicks to them are still attributed by the house_ad_click event.
const NO_UTM_HOSTS = new Set(['ufc.propbetedge.ai']);

function withUtm(href, slot, brandKey, sport = null) {
  try {
    const url = new URL(href, typeof window !== 'undefined' ? window.location.origin : 'https://propbetedge.ai');
    if (NO_UTM_HOSTS.has(url.hostname)) return url.toString();
    url.searchParams.set('utm_source', 'propbetedge');
    url.searchParams.set('utm_medium', 'house_ad');
    url.searchParams.set('utm_campaign', sport ? `${sport}_news_funnel` : 'sports_network_funnel');
    url.searchParams.set('utm_content', `${slot}_${brandKey}`);
    return url.toString();
  } catch {
    return href;
  }
}

function canonicalDestination(href) {
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'https://propbetedge.ai';
    const url = new URL(href, base);
    const path = (url.pathname.replace(/\/+$/, '') || '/');
    return `${url.hostname.toLowerCase()}${path}${url.hash || ''}`;
  } catch {
    return String(href || '');
  }
}

function currentDestination() {
  if (typeof window === 'undefined') return null;
  return canonicalDestination(`${window.location.pathname || '/'}${window.location.hash || ''}`);
}

function isSelfDestination(campaign) {
  const current = currentDestination();
  return Boolean(current && campaign?.href && canonicalDestination(campaign.href) === current);
}

function weightedPick(items) {
  const eligible = items.filter((item) => item && item.campaign && item.weight > 0 && !isSelfDestination(item.campaign));
  const fresh = eligible.filter((item) => item.campaign.key !== _lastBrandKey);
  const pool = fresh.length ? fresh : eligible;
  const total = pool.reduce((sum, item) => sum + item.weight, 0);
  if (!pool.length || total <= 0) return PROPSPORTS_CAMPAIGN;
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

function pagePath() {
  return typeof window === 'undefined' ? '/' : (window.location.pathname || '/').replace(/\/+$/, '') || '/';
}

function headerCampaignForPage(ctx = {}) {
  const sport = inferredSport(ctx);
  if (sport) return SPORT_CAMPAIGNS[sport];

  const path = pagePath();
  if (path === '/') return FREE_PICKS_CAMPAIGN;
  if (path === '/odds') return FREE_HISTORY_CAMPAIGN;
  if (path === '/odds/history') return PBECAST_CAMPAIGN;
  if (path === '/games' || path.startsWith('/games/')) return FREE_PICKS_CAMPAIGN;
  if (path === '/leaders' || path.startsWith('/leaders/')) return FREE_PICKS_CAMPAIGN;
  if (path === '/news' || path.startsWith('/news/page/')) return FREE_PICKS_CAMPAIGN;

  return weightedPick([
    { campaign: FREE_PICKS_CAMPAIGN, weight: 5 },
    { campaign: PBECAST_CAMPAIGN, weight: 3 },
    { campaign: LEADERS_CAMPAIGN, weight: 2 },
    ...LIVE_SPORT_KEYS.map((key) => ({ campaign: SPORT_CAMPAIGNS[key], weight: 2 })),
    { campaign: PROPSPORTS_CAMPAIGN, weight: 1 },
  ]);
}

function liveSiblingInventory(currentSport, weight = 1) {
  return LIVE_SPORT_KEYS
    .filter((key) => key !== currentSport)
    .map((key) => ({ campaign: SPORT_CAMPAIGNS[key], weight }));
}

function campaignForSlot(slotName, ctx = {}) {
  const sport = inferredSport(ctx);
  const primary = sport ? SPORT_CAMPAIGNS[sport] : null;
  const productDepth = [
    { campaign: FREE_PICKS_CAMPAIGN, weight: 4 },
    { campaign: PBECAST_CAMPAIGN, weight: 3 },
    { campaign: LEADERS_CAMPAIGN, weight: 2 },
  ];

  if (slotName === 'after_take' || slotName === 'end_of_article') {
    return weightedPick([
      ...(primary ? [{ campaign: primary, weight: 10 }] : LIVE_SPORT_KEYS.map((key) => ({ campaign: SPORT_CAMPAIGNS[key], weight: 3 }))),
      ...(primary ? liveSiblingInventory(sport, 1) : []),
      ...productDepth,
      { campaign: PROPSPORTS_CAMPAIGN, weight: 2 },
      { campaign: NEWS_API_CAMPAIGN, weight: 1 },
    ]);
  }

  return weightedPick([
    ...(primary ? [{ campaign: primary, weight: 7 }] : LIVE_SPORT_KEYS.map((key) => ({ campaign: SPORT_CAMPAIGNS[key], weight: 2 }))),
    ...(primary ? liveSiblingInventory(sport, 1) : []),
    ...productDepth,
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
  const external = (() => {
    try { return new URL(trackedHref, window.location.origin).hostname !== window.location.hostname; } catch { return false; }
  })();
  return `
    <a href="${trackedHref}" class="ad-block ad-brand-family ad-tone-${campaign.tone}" target="${external ? '_blank' : '_self'}" rel="noopener" data-ad-slot="${slotName}" data-ad-brand="${campaign.key}" data-ad-sport="${sport || 'network'}">
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
  const campaign = headerCampaignForPage(ctx);
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
          <span class="footer-cta-eyebrow">⚡ CHOOSE YOUR NEXT INTELLIGENCE LAYER</span>
          <h3 class="footer-cta-headline">Don’t dead-end at the article.</h3>
          <p class="footer-cta-sub">Move into Free Picks, PBE Cast, six live sport-specific intelligence products or the PropSports data layer.</p>
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
          <a href="${withUtm('/odds', 'footer_banner', 'free_picks')}" class="footer-cta-btn">
            <span class="sport-emoji">⚡</span><span>Free Picks + Track Record</span>
          </a>
          <a href="${withUtm('/games', 'footer_banner', 'pbe_cast')}" class="footer-cta-btn">
            <span class="sport-emoji">●</span><span>PBE Cast</span>
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
  let isExternal = false;
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'https://propbetedge.ai';
    isExternal = new URL(href, base).hostname !== new URL(base).hostname;
  } catch {
    isExternal = /^https?:\/\//i.test(href);
  }
  return `
    <a href="${href}" class="ad-banner ad-tone-${tone}" target="${isExternal ? '_blank' : '_self'}" rel="noopener">
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
  const rel = sportsbook ? 'noopener sponsored' : 'noopener';
  return `
    <a href="${href}" class="ad-block ad-tone-${tone}" target="${isExternal ? '_blank' : '_self'}" rel="${rel}"${sportsbook ? ` data-ad-sportsbook="${sportsbook}"` : ''}>
      <div class="ad-block-content">
        <span class="ad-block-eyebrow">${eyebrow}${sportsbook ? ` · Sponsored` : ''}</span>
        <h3 class="ad-block-headline">${headline}</h3>
        ${sub ? `<p class="ad-block-sub">${sub}</p>` : ''}
        <span class="ad-block-cta">${cta} →</span>
      </div>
    </a>
  `;
}
