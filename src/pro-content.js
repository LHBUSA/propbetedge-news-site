/* PropBetEdge All Access — canonical /pro membership page.
 * Commercial identity (Stripe product, price, payment link, promo) is fixed here.
 * The network (which products and sports All Access covers) comes from the
 * vendored canonical registry, src/network/family.js. Presentation is a visual
 * sales page built on the owner-approved artwork in public/pro/ (originals and
 * provenance in assets-src/pro/). */

import FAMILY from './network/family.js';

export const ALL_ACCESS = Object.freeze({
  name: 'PropBetEdge All Access',
  productKey: 'pbe_all_access',
  priceId: 'price_1UJCF1F3CaVzg4ORSIohWTca',
  paymentLinkId: 'plink_1UJCFAF3CaVzg4ORKspa47rI',
  checkoutUrl: 'https://buy.stripe.com/8x2eVdgmOaqy4pv8Ez7wA0N',
  priceUsd: 29,
  interval: 'month',
  promoCode: 'THEEDGE25',
  promoPercent: 25,
  promoDuration: 'for as long as you stay active',
  successPath: '/pro?checkout=success',
  manageUrl: 'https://billing.stripe.com/p/login/cNi3cv2vY7em3lr4oj7wA00',
});

export const SIGN_IN_URL = 'https://members.propbetedge.ai/?signin=1';

/* The registry's commercial line — "10 sports + Predictions + Compare + Markets · $29/month". */
export const ALL_ACCESS_LINE = FAMILY.all_access_line;

/* Premium network products, straight from the registry's All Access layer (minus the umbrella itself). */
const REGISTRY_PRODUCTS = Object.fromEntries((FAMILY.all_access || []).filter((p) => p.key !== 'all_access').map((p) => [p.key, p]));
export const COMMAND_CENTER_URL = REGISTRY_PRODUCTS.members?.url || 'https://members.propbetedge.ai/';

export const SPORTS = Object.freeze([
  { key:'mlb', label:'MLB', name:'PropBetEdge MLB', url:'https://mlb.propbetedge.ai', glyph:'MLB', edge:'Models, matchups, HR targets, K intelligence and live baseball context.' },
  { key:'nfl', label:'NFL', name:'PropBetEdge NFL', url:'https://nfl.propbetedge.ai', glyph:'NFL', edge:'PBE Picks, Best Line props, Player DNA, matchups and live football intelligence.' },
  { key:'nba', label:'NBA', name:'PropBetEdge NBA', url:'https://nba.propbetedge.ai', glyph:'NBA', edge:'Game models, player intelligence, matchups, live context and research.' },
  { key:'nhl', label:'NHL', name:'PropBetEdge NHL', url:'https://nhl.propbetedge.ai', glyph:'NHL', edge:'PBE picks, goalie context, market pricing, player intelligence and live hockey.' },
  { key:'wnba', label:'WNBA', name:'PropBetEdge WNBA', url:'https://wnba.propbetedge.ai', glyph:'WNBA', edge:'WinBA, Player DNA, props intelligence, live coverage and original newsroom.' },
  { key:'ufc', label:'UFC', name:'PropBetEdge UFC', url:'https://ufc.propbetedge.ai', glyph:'UFC', edge:'Fight intelligence, Fighter DNA, cards, records and event-week analysis.' },
  { key:'tennis', label:'Tennis', name:'PropBetEdge Tennis', url:'https://tennis.propbetedge.ai', glyph:'TENNIS', edge:'ATP + WTA live scores, Match DNA, rankings, matchups and research.' },
  { key:'soccer', label:'Soccer', name:'PropBetEdge Soccer', url:'https://soccer.propbetedge.ai', glyph:'SOCCER', edge:'Global match intelligence, Player DNA, team research, live matches and model work.' },
  { key:'golf', label:'Golf', name:'PropBetEdge Golf', url:'https://golf.propbetedge.ai', glyph:'GOLF', edge:'Player DNA, Course DNA, weather, matchups, tournaments and majors history.' },
  { key:'f1', label:'F1', name:'PropBetEdge F1', url:'https://f1.propbetedge.ai', glyph:'F1', edge:'Driver, constructor and circuit intelligence, standings, matchups and weather.', proName:'F1 Intelligence' },
]);

export const PREDICTIONS = Object.freeze({
  key:'predictions',
  name:'PropBetEdge Predictions',
  url:'https://predictions.propbetedge.ai',
  websiteId:'https://predictions.propbetedge.ai/#website',
  glyph:'◎',
  tagline:'Independent probability intelligence',
  edge:'Evidence-based probabilities, methodology, live market benchmarks, immutable forecast records and a scored track record.',
});

export const UPCOMING_SPORTS = Object.freeze([
  { key:'boxing', label:'Boxing', glyph:'BOXING', eta:'Q1 2027', edge:'Fight intelligence, boxer profiles, matchup research, model analysis and event-week coverage.' },
]);

/* What actually separates PropBetEdge. No accuracy, profit or certainty claims. */
export const DIFFERENTIATORS = Object.freeze([
  { title:'Proprietary models', body:'Sport-specific engines built in-house for each sport — not one generic model wearing ten jerseys.' },
  { title:'Transparent track records', body:'Official calls are locked before the event, graded against the result and kept on the record, wins and losses alike.' },
  { title:'Prediction-market intelligence', body:'Kalshi and Polymarket pricing compared contract by contract, next to independent model probabilities.' },
  { title:'Live, sport-native products', body:'Each sport keeps the live experience, data and workflows that fit it instead of being flattened into one dashboard.' },
  { title:'DNA research', body:'Player, Match, Circuit and Course DNA where the sport supports it — the profile behind the number.' },
  { title:'PBEcast', body:'Live game experiences that follow the action as it happens, in the sports where PBEcast is live.' },
]);

export const OPERATING_SYSTEM_STAGES = Object.freeze([
  { step:'01', label:'Observe', title:'Ingest live evidence', body:'Scores, markets, lineups, injuries, weather, rankings and source changes flow into the network continuously.' },
  { step:'02', label:'Normalize', title:'Build reliable state', body:'Raw evidence becomes durable sport, event, player, team and market state before downstream products use it.' },
  { step:'03', label:'Analyze', title:'Run purpose-built engines', body:'Sport models, DNA systems, prediction models, market comparison and live-context products operate on domain-specific evidence.' },
  { step:'04', label:'Publish', title:'Put intelligence in the product', body:'The output becomes Compare, Predictions, Markets, Crypto, sport-native research and member-facing intelligence.' },
  { step:'05', label:'Grade', title:'Keep the receipts', body:'Official calls and forecast records are resolved against outcomes and retained so performance can be evaluated after the event.' },
  { step:'06', label:'Improve', title:'Promote after evidence', body:'Research and shadow lanes can test changes prospectively while production remains gated by evidence and release controls.' },
]);

/* The four All Access network products, in the brief's order. URLs come from the registry. */
export const NETWORK_PRODUCTS = Object.freeze([
  { key:'members', label:'Command Center', line:'Your private member workspace', url:COMMAND_CENTER_URL },
  { key:'compare', label:'Compare', line:'Kalshi + Polymarket, side by side', url:REGISTRY_PRODUCTS.compare?.url || 'https://compare.propbetedge.ai/' },
  { key:'markets', label:'Markets', line:'Stocks, crypto, macro and AI', url:REGISTRY_PRODUCTS.markets?.url || 'https://predictions.propbetedge.ai/markets/' },
  { key:'predictions', label:'Predictions', line:'Model probabilities with records', url:REGISTRY_PRODUCTS.predictions?.url || 'https://predictions.propbetedge.ai/' },
]);
const product = (key) => NETWORK_PRODUCTS.find((p) => p.key === key);
export const CRYPTO_URL = 'https://predictions.propbetedge.ai/crypto/';

/* Responsive artwork. Every derivative exists in public/pro/ (scripts/build-pro-art.py).
   w/h are the intrinsic size of the largest derivative, used for aspect ratio. */
export const ART = Object.freeze({
  hero:        { widths:[960, 1600], w:1600, h:900 },
  heroMobile:  { name:'hero-m', widths:[640, 960], w:960, h:720 },
  network:     { widths:[640, 1086], w:1086, h:1448 },
  compare:     { widths:[640, 960, 1600], w:1600, h:900 },
  predictions: { widths:[640, 960, 1600], w:1600, h:900 },
  ufc:         { widths:[640, 1122], w:1122, h:1402 },
  tennis:      { widths:[640, 1122], w:1122, h:1402 },
});
export const HERO_MOBILE_MEDIA = '(max-width: 720px)';
export const HERO_DESKTOP_MEDIA = '(min-width: 721px)';

export function artSrcset(key, ext) {
  const a = ART[key];
  const name = a.name || key;
  return a.widths.map((w) => `/pro/${name}-${w}.${ext} ${w}w`).join(', ');
}

const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function picture(key, { alt, sizes, className = '' }) {
  const a = ART[key];
  const name = a.name || key;
  return `<picture class="pbe-pro-pic ${className}">
      <source type="image/avif" srcset="${artSrcset(key, 'avif')}" sizes="${sizes}">
      <source type="image/webp" srcset="${artSrcset(key, 'webp')}" sizes="${sizes}">
      <img src="/pro/${name}-${a.widths.at(-1)}.webp" width="${a.w}" height="${a.h}" alt="${esc(alt)}" loading="lazy" decoding="async">
    </picture>`;
}

/* Art-directed hero: the phone gets the stadium crop, wider screens the full panorama.
   The media queries match the preloads pro-seo.js hands Edge Middleware. */
function heroPicture() {
  const m = ART.heroMobile, d = ART.hero;
  return `<picture class="pbe-pro-pic pbe-pro-hero-pic">
      <source media="${HERO_MOBILE_MEDIA}" type="image/avif" srcset="${artSrcset('heroMobile', 'avif')}" sizes="100vw" width="${m.w}" height="${m.h}">
      <source media="${HERO_MOBILE_MEDIA}" type="image/webp" srcset="${artSrcset('heroMobile', 'webp')}" sizes="100vw" width="${m.w}" height="${m.h}">
      <source type="image/avif" srcset="${artSrcset('hero', 'avif')}" sizes="100vw">
      <source type="image/webp" srcset="${artSrcset('hero', 'webp')}" sizes="100vw">
      <img src="/pro/hero-1600.webp" width="${d.w}" height="${d.h}" alt="A floodlit stadium beside a city skyline at night, with live market charts rising over it." fetchpriority="high" decoding="async">
    </picture>`;
}

export function priceLabel() { return `$${ALL_ACCESS.priceUsd} / ${ALL_ACCESS.interval}`; }
export function promoLine() { return `${ALL_ACCESS.promoPercent}% off ${ALL_ACCESS.promoDuration} with code ${ALL_ACCESS.promoCode}.`; }
export function checkoutSucceeded(search) {
  try { return new URLSearchParams(String(search || '')).get('checkout') === 'success'; }
  catch { return false; }
}

/* Member states the page can render. The input is only ever the server verdict
   from auth.propbetedge.ai/membership (fetched in src/pages/pro.js); anything
   else — signed out, sport-only, free, an outage — renders the public page. */
export function memberStateFrom(verdict) {
  if (!verdict || verdict.authenticated !== true) return null;
  const state = verdict.membership?.state;
  return state === 'all_access' || state === 'owner' ? state : null;
}

function memberBadge(member) {
  return member === 'owner'
    ? `<span class="pbe-pro-member-badge"><b>VERIFIED OWNER</b><span>PropBetEdge All Access · network unlocked</span></span>`
    : `<span class="pbe-pro-member-badge"><b>◆ PLATINUM MEMBER</b><span>PropBetEdge All Access · active</span></span>`;
}

function ctaButton(label, extraClass = '') {
  return `<a class="pbe-pro-cta ${extraClass}" href="${ALL_ACCESS.checkoutUrl}" rel="noopener" data-pbe-placement="all_access_checkout" data-pbe-price="${ALL_ACCESS.priceId}" data-pbe-link="${ALL_ACCESS.paymentLinkId}">${esc(label)}<span class="pbe-pro-cta-arrow" aria-hidden="true">→</span></a>`;
}

function commandCenterButton(label, extraClass = '') {
  return `<a class="pbe-pro-cta ${extraClass}" href="${COMMAND_CENTER_URL}" rel="noopener" data-pbe-placement="all_access_command_center">${esc(label)}<span class="pbe-pro-cta-arrow" aria-hidden="true">→</span></a>`;
}

function promoChip() {
  return `
    <div class="pbe-pro-offer" role="note" aria-label="All Access offer">
      <span class="pbe-pro-offer-line">${ALL_ACCESS.promoPercent}% off ${esc(ALL_ACCESS.promoDuration)}</span>
      <span class="pbe-pro-offer-code">Code <code data-pbe-promo-code>${ALL_ACCESS.promoCode}</code>
        <button type="button" class="pbe-pro-copy" data-pbe-copy="${ALL_ACCESS.promoCode}" aria-label="Copy promo code ${ALL_ACCESS.promoCode}">Copy</button>
      </span>
    </div>`;
}

/* 1 — hero */
function hero(member, shareBar) {
  const actions = member
    ? `${commandCenterButton('Open Command Center', 'pbe-pro-cta-hero')}
          <a class="pbe-pro-cta-quiet" href="${ALL_ACCESS.manageUrl}" target="_blank" rel="noopener noreferrer">Manage membership ↗</a>`
    : `${ctaButton('Get All Access', 'pbe-pro-cta-hero')}
          <a class="pbe-pro-cta-quiet" href="${SIGN_IN_URL}" rel="noopener" data-pbe-placement="all_access_sign_in">Member sign in</a>`;
  return `
    <section class="pbe-pro-hero" aria-labelledby="pbe-pro-title">
      <div class="pbe-pro-hero-media">${heroPicture()}</div>
      <div class="pbe-pro-wrap pbe-pro-hero-inner">
        <div class="pbe-pro-hero-copy">
          ${member ? memberBadge(member) : '<span class="pbe-pro-kicker">PropBetEdge All Access</span>'}
          <h1 class="pbe-pro-title" id="pbe-pro-title">
            <span>One membership.</span>
            <span class="pbe-pro-title-gold">The entire intelligence network.</span>
          </h1>
          <p class="pbe-pro-dek">${esc(ALL_ACCESS_LINE.split(' · ')[0])}. Live intelligence, proprietary models, prediction markets and sport-native research under one membership.</p>
          <div class="pbe-pro-buyline">
            ${member ? '' : `<div class="pbe-pro-price"><span class="pbe-pro-price-amount">$${ALL_ACCESS.priceUsd}</span><span class="pbe-pro-price-per">/ ${ALL_ACCESS.interval}</span></div>`}
            <div class="pbe-pro-actions">
          ${actions}
            </div>
          </div>
          ${member ? '' : `<p class="pbe-pro-hero-promo">${ALL_ACCESS.promoPercent}% off while you stay active with code <strong>${ALL_ACCESS.promoCode}</strong></p>`}
        </div>
      </div>
    </section>
    ${shareBar ? `<div class="pbe-pro-wrap pbe-pro-share">${shareBar}</div>` : ''}`;
}

/* 2 — what $29 unlocks */
function unlockSection(member) {
  return `
    <section class="pbe-pro-wrap pbe-pro-unlock" aria-labelledby="pbe-pro-unlock-h">
      <h2 id="pbe-pro-unlock-h" class="pbe-pro-unlock-h">${member ? 'Your membership covers' : `What $${ALL_ACCESS.priceUsd} unlocks`}</h2>
      <ul class="pbe-pro-unlock-list">
        ${NETWORK_PRODUCTS.map((p) => `
        <li><a href="${p.url}" rel="noopener" data-pbe-product="${p.key}"><strong>${esc(p.label)}</strong><span>${esc(p.line)}</span></a></li>`).join('')}
        <li class="pbe-pro-unlock-sports"><a href="#sports"><strong>${SPORTS.length} sport products</strong><span>${SPORTS.map((s) => esc(s.label)).join(' · ')}</span></a></li>
      </ul>
    </section>`;
}

/* 3 — network overview */
function networkSection() {
  const sports = FAMILY.sports || [];
  return `
    <section class="pbe-pro-wrap pbe-pro-network" aria-labelledby="pbe-pro-network-h">
      <div class="pbe-pro-network-media">${picture('network', { alt:'A floodlit stadium at the center of a night-time city, connected by lines of light.', sizes:'(max-width: 880px) 100vw, 520px' })}</div>
      <div class="pbe-pro-network-copy">
        <span class="pbe-pro-eyebrow">The network</span>
        <h2 id="pbe-pro-network-h">This isn't one product with ten logos.</h2>
        <p>Every sport is its own purpose-built product — its own live experience, data, models and DNA research, with PBEcast where the sport has it. All Access is the layer that connects them, with Command Center, Compare, Markets and Predictions on top.</p>
        <ul class="pbe-pro-network-sports" aria-label="The ${sports.length} PropBetEdge sports">
          ${sports.map((s) => `<li><a href="${s.url}" rel="noopener">${esc(s.label)}</a></li>`).join('')}
        </ul>
      </div>
    </section>`;
}

/* 4 — premium products */
function productStory({ key, art, eyebrow, title, headline, body, action, alt, reverse = false }) {
  const p = product(key);
  return `
        <article class="pbe-pro-story ${reverse ? 'is-reverse' : ''}" data-pbe-story="${key}">
          <a class="pbe-pro-story-media" href="${p.url}" rel="noopener" tabindex="-1" aria-hidden="true">${picture(art, { alt, sizes:'(max-width: 960px) 100vw, 760px' })}</a>
          <div class="pbe-pro-story-copy">
            <span class="pbe-pro-eyebrow">${esc(eyebrow)}</span>
            <h3>${esc(title)}</h3>
            <strong>${esc(headline)}</strong>
            <p>${esc(body)}</p>
            <div class="pbe-pro-story-links"><a class="pbe-pro-text-link" href="${p.url}" rel="noopener">${esc(action)} →</a></div>
          </div>
        </article>`;
}

function productsSection() {
  return `
    <section class="pbe-pro-wrap pbe-pro-section" id="products" aria-labelledby="pbe-pro-products-h">
      <header class="pbe-pro-section-head">
        <span class="pbe-pro-eyebrow">The All Access layer</span>
        <h2 id="pbe-pro-products-h">Four premium products above the sports.</h2>
      </header>
      <div class="pbe-pro-stories">
        ${productStory({ key:'compare', art:'compare', eyebrow:'Prediction markets', title:'Compare', headline:'See the price. Check the contract.', body:'Kalshi + Polymarket prices side by side, with contract comparability and rules-differ handling — so a real price gap is never confused with two contracts that only look alike.', action:'Explore Compare', alt:'Two market screens, one blue and one gold, facing each other across a stadium floor.' })}
        ${productStory({ key:'predictions', art:'predictions', eyebrow:'Independent models', title:'Predictions', headline:'Probability with evidence — and receipts.', body:'Independent model probabilities, live market comparison and permanent scored records across real-world events.', action:'Explore Predictions', alt:'A glowing globe surrounded by probability curves and charts.', reverse:true })}
      </div>
      <div class="pbe-pro-duo">
        <article class="pbe-pro-panel pbe-pro-panel-markets" data-pbe-story="markets">
          <span class="pbe-pro-eyebrow">Live market intelligence</span>
          <h3>Markets</h3>
          <ul class="pbe-pro-tape" aria-label="Markets coverage"><li>Stocks</li><li>Crypto</li><li>Macro</li><li>AI</li></ul>
          <p>Stocks, crypto, macro and AI market intelligence. A bull case, a bear case and a quant read on the same live tape — plus the BTC 15-minute Crypto nowcast, scored against the live market.</p>
          <div class="pbe-pro-story-links">
            <a class="pbe-pro-text-link" href="${product('markets').url}" rel="noopener">Explore Markets →</a>
            <a class="pbe-pro-text-link is-secondary" href="${CRYPTO_URL}" rel="noopener">Crypto nowcast ↗</a>
          </div>
        </article>
        <article class="pbe-pro-panel pbe-pro-panel-hub" data-pbe-story="members">
          <span class="pbe-pro-eyebrow">Members only</span>
          <h3>Command Center</h3>
          <ul class="pbe-pro-tape" aria-label="Command Center features"><li>Live games</li><li>Multi-View</li><li>Live Market Wire</li><li>Platinum Direct</li></ul>
          <p>One private workspace for live games, member intelligence, Multi-View, network navigation and the new member-only Live Market Wire. Platinum Direct puts your feedback in front of the team building PropBetEdge.</p>
          <div class="pbe-pro-story-links">
            <a class="pbe-pro-text-link" href="${COMMAND_CENTER_URL}" rel="noopener">Open Command Center →</a>
          </div>
        </article>
      </div>
    </section>`;
}

/* 5 — sport-native proof */
function proofSection() {
  const panel = (key, title, body, alt) => {
    const s = SPORTS.find((x) => x.key === key);
    return `
        <a class="pbe-pro-proof-panel" href="${s.url}" rel="noopener" data-sport-proof="${key}">
          ${picture(key, { alt, sizes:'(max-width: 720px) 100vw, 50vw' })}
          <span class="pbe-pro-proof-copy">
            <span class="pbe-pro-eyebrow">${esc(title)}</span>
            <span class="pbe-pro-proof-body">${esc(body)}</span>
            <b>Open ${esc(s.label)} →</b>
          </span>
        </a>`;
  };
  return `
    <section class="pbe-pro-wrap pbe-pro-section pbe-pro-proof" aria-labelledby="pbe-pro-proof-h">
      <header class="pbe-pro-section-head">
        <span class="pbe-pro-eyebrow">Sport-native depth</span>
        <h2 id="pbe-pro-proof-h">Built for the sport, not reskinned for it.</h2>
      </header>
      <div class="pbe-pro-proof-grid">
        ${panel('ufc', 'UFC Intelligence', 'Cards, fighter data, Fighter DNA, original analysis and fight-specific intelligence.', 'A floodlit octagon in a packed arena.')}
        ${panel('tennis', 'Tennis Intelligence', 'ATP + WTA live scores, Match DNA, PBEcast and proprietary analysis.', 'A player serving on a clay court at sunset in front of a full stadium.')}
      </div>
    </section>`;
}

/* 6 — all ten sports */
function sportsGrid() {
  return `
      <ul class="pbe-pro-sports" aria-label="Sports included in All Access">
        ${SPORTS.map((s) => `
        <li class="pbe-pro-sport" data-sport="${s.key}">
          <a href="${s.url}" rel="noopener">
            <span class="pbe-pro-sport-label">${esc(s.label)}</span>
            <span class="pbe-pro-sport-name">${esc(s.proName || s.name)}</span>
            <span class="pbe-pro-sport-edge">${esc(s.edge)}</span>
            <b>Open ${esc(s.label)} →</b>
          </a>
        </li>`).join('')}
      </ul>`;
}

function sportsSection(checkoutSuccess) {
  return `
    <section class="pbe-pro-wrap pbe-pro-section pbe-pro-sports-section" id="sports" aria-labelledby="pbe-pro-sports-h">
      <header class="pbe-pro-section-head">
        <span class="pbe-pro-eyebrow">${checkoutSuccess ? 'Your sports network' : `All ${SPORTS.length} sports`}</span>
        <h2 id="pbe-pro-sports-h">Every sport keeps the product it deserves.</h2>
      </header>
      ${sportsGrid()}
    </section>`;
}

/* 7 — why PropBetEdge is different */
function whySection() {
  return `
    <section class="pbe-pro-wrap pbe-pro-section pbe-pro-why" id="why" aria-labelledby="pbe-pro-why-h">
      <header class="pbe-pro-section-head">
        <span class="pbe-pro-eyebrow">Why PropBetEdge</span>
        <h2 id="pbe-pro-why-h">Not another picks subscription.</h2>
        <p>Probabilities describe uncertainty — they are not promises. What you get is the work behind them, in the open.</p>
      </header>
      <div class="pbe-pro-why-grid">
        ${DIFFERENTIATORS.map((v, i) => `
        <article><span>0${i + 1}</span><h3>${esc(v.title)}</h3><p>${esc(v.body)}</p></article>`).join('')}
        <article class="is-gold"><span>0${DIFFERENTIATORS.length + 1}</span><h3>One membership across the network</h3><p>Every product above, every sport below, one login.</p></article>
      </div>
      <details class="pbe-pro-system">
        <summary><span>The technical story</span><b>How the intelligence system works ↓</b></summary>
        <div class="pbe-pro-system-inner">
          ${OPERATING_SYSTEM_STAGES.map((stage) => `
          <article><span>${stage.step}</span><small>${esc(stage.label)}</small><h3>${esc(stage.title)}</h3><p>${esc(stage.body)}</p></article>`).join('')}
        </div>
      </details>
    </section>`;
}

/* 8 — final CTA */
function finalSection(member) {
  return `
    <section class="pbe-pro-wrap pbe-pro-final-wrap">
      <div class="pbe-pro-final">
        <h2>The network keeps growing. Your membership already covers it.</h2>
        ${member
          ? `<p class="pbe-pro-final-price">${memberBadge(member)}</p>
        ${commandCenterButton('Open your Command Center', 'pbe-pro-cta-hero')}`
          : `<p class="pbe-pro-final-price">$${ALL_ACCESS.priceUsd}/month · one All Access membership</p>
        ${ctaButton('Get All Access', 'pbe-pro-cta-hero')}
        ${promoChip()}`}
        <div class="pbe-pro-final-links">
          ${member ? `<a href="${ALL_ACCESS.manageUrl}" target="_blank" rel="noopener noreferrer">Manage membership ↗</a>` : `<a href="${SIGN_IN_URL}">Already a member? Sign in ↗</a>`}
          <a href="/terms">Terms</a>
          <a href="/support">Support</a>
        </div>
        ${member ? '' : '<p class="pbe-pro-policy">Cancel future renewal anytime. Charges are non-refundable after access is activated except where required by law.</p>'}
      </div>
    </section>`;
}

function successHero(shareBar = '') {
  return `
    <section class="pbe-pro-hero pbe-pro-hero-success" aria-labelledby="pbe-pro-title">
      <div class="pbe-pro-hero-media">${heroPicture()}</div>
      <div class="pbe-pro-wrap pbe-pro-hero-inner">
        <div class="pbe-pro-hero-copy">
          <span class="pbe-pro-kicker is-success">Checkout complete</span>
          <h1 class="pbe-pro-title" id="pbe-pro-title"><span>You're in.</span><span class="pbe-pro-title-gold">Welcome to All Access.</span></h1>
          <p class="pbe-pro-dek">Your membership is active. Start in Command Center — your private front door to the network.</p>
          <div class="pbe-pro-actions">
            ${commandCenterButton('Open Command Center', 'pbe-pro-cta-hero')}
            <a class="pbe-pro-cta-quiet" href="${product('compare').url}" rel="noopener">Open Compare ↗</a>
            <a class="pbe-pro-cta-quiet" href="${product('predictions').url}" rel="noopener">Open Predictions ↗</a>
          </div>
          <ol class="pbe-pro-steps">
            <li><strong>Sign in with the email you used at checkout.</strong></li>
            <li><strong>Your All Access identity unlocks the premium network</strong> across PropBetEdge.</li>
            <li><strong>Use Platinum Direct</strong> in Command Center when you want a feature changed, data checked or something new built.</li>
          </ol>
          <a class="pbe-pro-manage" href="${ALL_ACCESS.manageUrl}" target="_blank" rel="noopener noreferrer">Manage subscription ↗</a>
        </div>
      </div>
    </section>
    ${shareBar ? `<div class="pbe-pro-wrap pbe-pro-share">${shareBar}</div>` : ''}`;
}

/**
 * @param {{checkoutSuccess?: boolean, shareBar?: string, member?: 'all_access'|'owner'|null}} opts
 *   member must come from memberStateFrom(<server verdict>) — never from the URL, storage or plan text.
 */
export function buildProHtml({ checkoutSuccess = false, shareBar = '', member = null } = {}) {
  if (checkoutSuccess) {
    return `
    <div class="pbe-pro pbe-pro-is-success" data-pbe-page="pro">
      ${successHero(shareBar)}
      ${sportsSection(true)}
    </div>`;
  }
  return `
    <div class="pbe-pro${member ? ' pbe-pro-is-member' : ''}" data-pbe-page="pro"${member ? ` data-pbe-member="${member}"` : ''}>
      ${hero(member, shareBar)}
      ${unlockSection(member)}
      ${networkSection()}
      ${productsSection()}
      ${proofSection()}
      ${sportsSection(false)}
      ${whySection()}
      ${finalSection(member)}
    </div>`;
}
