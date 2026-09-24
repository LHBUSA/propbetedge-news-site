/* PropBetEdge All Access — the network membership page (/pro).
 *
 * Pure content: no DOM, no imports with side effects, so the exact checkout
 * link, price and promotion can be asserted in tests. Stripe identities below
 * are the ONLY live ones (verified against the live Stripe account 2026-09-24):
 * do not add a second link or coupon here. */

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

export const SPORTS = Object.freeze([
  { key: 'mlb', label: 'MLB', name: 'PropBetEdge MLB', url: 'https://mlb.propbetedge.ai', glyph: '⚾', edge: 'HR targets, K props, Ask The Algo, PBEcast' },
  { key: 'nfl', label: 'NFL', name: 'PropBetEdge NFL', url: 'https://nfl.propbetedge.ai', glyph: '🏈', edge: 'PBE Picks, Best Line props, Player DNA, PBEcast' },
  { key: 'nba', label: 'NBA', name: 'PropBetEdge NBA', url: 'https://nba.propbetedge.ai', glyph: '🏀', edge: 'Pro game model, player and matchup intelligence' },
  { key: 'nhl', label: 'NHL', name: 'PropBetEdge NHL', url: 'https://nhl.propbetedge.ai', glyph: '🏒', edge: 'PBE NHL Picks, live scores, atmosphere board' },
  { key: 'wnba', label: 'WNBA', name: 'PropBetEdge WNBA', url: 'https://wnba.propbetedge.ai', glyph: '🏀', edge: 'PBE model, props board, newsroom and video' },
  { key: 'ufc', label: 'UFC', name: 'PropBetEdge UFC', url: 'https://ufc.propbetedge.ai', glyph: '🥊', edge: 'PBE Algo, Fighter DNA, fight-week intelligence' },
]);

export const VALUE_PROPS = Object.freeze([
  { title: 'Proprietary algorithms', body: 'Every sport runs its own PropBetEdge model, built and tuned in-house on data we own. All Access unlocks every one of them.' },
  { title: 'Tracked, graded picks', body: 'Picks are locked before the game, graded against official results, and published to a permanent track record you can audit.' },
  { title: 'Live intelligence', body: 'Injuries, lineups, weigh-ins, weather, venue and market moves, resolved into what actually changes tonight.' },
  { title: 'PBEcast and live experiences', body: 'Sport-specific live surfaces that follow the game as it happens, from MLB matchup columns to NFL and NHL casts.' },
  { title: 'Player and matchup intelligence', body: 'Player DNA, arsenal and splits, fighter records and rankings, team and matchup pages that connect every story to the numbers.' },
  { title: 'Predictions and future Pro tools', body: 'New models, new sports and new Pro products join the network as they launch. Members get them the day they ship, no upgrade.' },
]);

const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function priceLabel() {
  return `$${ALL_ACCESS.priceUsd} / ${ALL_ACCESS.interval}`;
}

export function promoLine() {
  return `${ALL_ACCESS.promoPercent}% off ${ALL_ACCESS.promoDuration} with code ${ALL_ACCESS.promoCode}.`;
}

export function checkoutSucceeded(search) {
  try { return new URLSearchParams(String(search || '')).get('checkout') === 'success'; }
  catch { return false; }
}

function ctaButton(label, extraClass = '') {
  return `<a class="pbe-pro-cta ${extraClass}" href="${ALL_ACCESS.checkoutUrl}" rel="noopener" data-pbe-placement="all_access_checkout" data-pbe-price="${ALL_ACCESS.priceId}" data-pbe-link="${ALL_ACCESS.paymentLinkId}">${esc(label)}<span class="pbe-pro-cta-arrow" aria-hidden="true">→</span></a>`;
}

function promoChip() {
  return `
    <div class="pbe-pro-offer" role="note" aria-label="Launch offer">
      <span class="pbe-pro-offer-eyebrow">Launch offer</span>
      <span class="pbe-pro-offer-line">${ALL_ACCESS.promoPercent}% off ${esc(ALL_ACCESS.promoDuration)}</span>
      <span class="pbe-pro-offer-code">Code <code data-pbe-promo-code>${ALL_ACCESS.promoCode}</code>
        <button type="button" class="pbe-pro-copy" data-pbe-copy="${ALL_ACCESS.promoCode}" aria-label="Copy promo code ${ALL_ACCESS.promoCode}">Copy</button>
      </span>
      <span class="pbe-pro-offer-note">Enter it at checkout. The discount stays on your subscription while it remains active.</span>
    </div>`;
}

function sportsGrid() {
  return `
    <ul class="pbe-pro-sports" aria-label="Sports included in All Access">
      ${SPORTS.map((s) => `
        <li class="pbe-pro-sport" data-sport="${s.key}">
          <a href="${s.url}" target="_blank" rel="noopener">
            <span class="pbe-pro-sport-glyph" aria-hidden="true">${s.glyph}</span>
            <span class="pbe-pro-sport-label">${s.label}</span>
            <span class="pbe-pro-sport-name">${esc(s.name)}</span>
            <span class="pbe-pro-sport-edge">${esc(s.edge)}</span>
            <span class="pbe-pro-sport-badge">Included</span>
          </a>
        </li>`).join('')}
      <li class="pbe-pro-sport pbe-pro-sport-future" data-sport="future">
        <div>
          <span class="pbe-pro-sport-glyph" aria-hidden="true">✦</span>
          <span class="pbe-pro-sport-label">Next</span>
          <span class="pbe-pro-sport-name">Every future sport</span>
          <span class="pbe-pro-sport-edge">Every new PropBetEdge sport and every new Pro product joins All Access on launch day.</span>
          <span class="pbe-pro-sport-badge">Included</span>
        </div>
      </li>
    </ul>`;
}

function membershipCard(active) {
  return `
    <aside class="pbe-pro-card ${active ? 'is-active' : ''}" aria-label="All Access membership">
      <div class="pbe-pro-card-top">
        <span class="pbe-pro-card-eyebrow">${active ? 'Membership active' : 'Membership'}</span>
        <span class="pbe-pro-card-name">All Access</span>
      </div>
      <div class="pbe-pro-card-price"><span class="pbe-pro-card-amount">$${ALL_ACCESS.priceUsd}</span><span class="pbe-pro-card-per">/ ${ALL_ACCESS.interval}</span></div>
      <p class="pbe-pro-card-sub">Cancel anytime. One login across the whole network.</p>
      <ul class="pbe-pro-card-list">
        ${SPORTS.map((s) => `<li><span class="pbe-pro-check" aria-hidden="true">✓</span>${s.label} Pro</li>`).join('')}
        <li class="pbe-pro-card-future"><span class="pbe-pro-check" aria-hidden="true">✓</span>Every future sport and Pro product</li>
      </ul>
      ${active
        ? `<a class="pbe-pro-cta pbe-pro-cta-ghost" href="${ALL_ACCESS.manageUrl}" target="_blank" rel="noopener noreferrer">Manage subscription<span class="pbe-pro-cta-arrow" aria-hidden="true">↗</span></a>`
        : `${ctaButton('Get All Access')}<p class="pbe-pro-card-promo">${ALL_ACCESS.promoPercent}% off ${esc(ALL_ACCESS.promoDuration)} · code <strong>${ALL_ACCESS.promoCode}</strong></p>`}
    </aside>`;
}

function hero() {
  return `
    <section class="pbe-pro-hero">
      <div class="pbe-pro-hero-copy">
        <span class="pbe-pro-eyebrow">PropBetEdge Network · Membership</span>
        <h1 class="pbe-pro-title"><span class="pbe-pro-title-brand">PropBetEdge</span><span class="pbe-pro-title-all">All Access</span></h1>
        <p class="pbe-pro-statement">
          <span>One membership.</span>
          <span>Every sport.</span>
          <span>Every model.</span>
          <span>Every current and future PropBetEdge Pro product.</span>
        </p>
        <div class="pbe-pro-price" aria-label="Price"><span class="pbe-pro-price-amount">$${ALL_ACCESS.priceUsd}</span><span class="pbe-pro-price-per">/ ${ALL_ACCESS.interval}</span></div>
        ${ctaButton('Get All Access', 'pbe-pro-cta-hero')}
        ${promoChip()}
        <p class="pbe-pro-hero-fine">Includes MLB, NFL, NBA, NHL, WNBA and UFC Pro today. Individual sport plans stay available; All Access is the umbrella, not a replacement.</p>
      </div>
      ${membershipCard(false)}
    </section>`;
}

function successHero() {
  return `
    <section class="pbe-pro-hero pbe-pro-hero-success">
      <div class="pbe-pro-hero-copy">
        <span class="pbe-pro-eyebrow pbe-pro-eyebrow-success">Checkout complete</span>
        <h1 class="pbe-pro-title"><span class="pbe-pro-title-brand">Welcome to</span><span class="pbe-pro-title-all">All Access</span></h1>
        <p class="pbe-pro-success-lead">Your PropBetEdge All Access membership is active. Every sport in the network now recognizes the email you used at checkout.</p>
        <ol class="pbe-pro-steps">
          <li><strong>Open any sport</strong> below and choose <em>Sign in</em>.</li>
          <li><strong>Enter the email you used at checkout.</strong> A secure sign-in link arrives in that inbox; no password to remember.</li>
          <li><strong>Repeat once per sport.</strong> One subscription, one email, every PropBetEdge property.</li>
        </ol>
        <p class="pbe-pro-success-note">Stripe confirms your subscription within a minute or two. If a sport does not recognize your email yet, wait a moment and request the sign-in link again. Questions: <a href="mailto:support@proptechusa.ai">support@proptechusa.ai</a>.</p>
      </div>
      ${membershipCard(true)}
    </section>`;
}

export function buildProHtml({ checkoutSuccess = false } = {}) {
  return `
    <div class="pbe-pro ${checkoutSuccess ? 'pbe-pro-is-success' : ''}" data-pbe-page="pro">
      ${checkoutSuccess ? successHero() : hero()}

      <section class="pbe-pro-section pbe-pro-sports-section" id="sports">
        <header class="pbe-pro-section-head">
          <span class="pbe-pro-eyebrow">${checkoutSuccess ? 'Your network' : 'Included today'}</span>
          <h2>Every sport. One login.</h2>
          <p>${checkoutSuccess ? 'Open a sport and sign in with your checkout email.' : 'All Access unlocks the Pro tier of every PropBetEdge sport, and every sport we add next.'}</p>
        </header>
        ${sportsGrid()}
      </section>

      <section class="pbe-pro-section" id="included">
        <header class="pbe-pro-section-head">
          <span class="pbe-pro-eyebrow">What you get</span>
          <h2>The whole edge, not one slice of it.</h2>
        </header>
        <ul class="pbe-pro-values">
          ${VALUE_PROPS.map((v, i) => `
            <li class="pbe-pro-value">
              <span class="pbe-pro-value-index">${String(i + 1).padStart(2, '0')}</span>
              <h3>${esc(v.title)}</h3>
              <p>${esc(v.body)}</p>
            </li>`).join('')}
        </ul>
      </section>

      <section class="pbe-pro-section pbe-pro-plans" id="plans">
        <div class="pbe-pro-plans-inner">
          <div>
            <span class="pbe-pro-eyebrow">Already a member of one sport?</span>
            <h2>Your sport plan stays exactly as it is.</h2>
            <p>MLB, NFL, NBA, NHL, WNBA and UFC Pro plans continue unchanged. All Access is the premium umbrella for people who want the whole network under one subscription and one login.</p>
          </div>
          <div class="pbe-pro-plans-facts">
            <div><span class="pbe-pro-fact-k">Billing</span><span class="pbe-pro-fact-v">${priceLabel()}, cancel anytime</span></div>
            <div><span class="pbe-pro-fact-k">Access</span><span class="pbe-pro-fact-v">Secure sign-in link to your checkout email</span></div>
            <div><span class="pbe-pro-fact-k">Coverage</span><span class="pbe-pro-fact-v">6 sports today, every future sport included</span></div>
            <div><span class="pbe-pro-fact-k">Launch offer</span><span class="pbe-pro-fact-v">${esc(promoLine())}</span></div>
          </div>
        </div>
      </section>

      ${checkoutSuccess ? '' : `
      <section class="pbe-pro-final">
        <h2>Get the edge everywhere.</h2>
        <p>${priceLabel()}. ${esc(promoLine())}</p>
        ${ctaButton('Get All Access', 'pbe-pro-cta-hero')}
      </section>`}
    </div>`;
}

export function proMeta({ checkoutSuccess = false } = {}) {
  return {
    title: checkoutSuccess
      ? 'All Access is active — PropBetEdge'
      : 'PropBetEdge All Access — One Membership, Every Sport | $29/month',
    description: 'PropBetEdge All Access: one $29/month membership for MLB, NFL, NBA, NHL, WNBA and UFC Pro, every model, every tracked pick, PBEcast and every future PropBetEdge sport. Launch offer: 25% off for as long as you stay active with code THEEDGE25.',
    canonical: 'https://propbetedge.ai/pro',
  };
}

/* Product + Offer schema for crawlers. Price is the list price; the promotion
   is described in text (Stripe applies it at checkout). */
export function proSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': 'https://propbetedge.ai/pro#product',
    name: ALL_ACCESS.name,
    description: 'One membership for every PropBetEdge sport: MLB, NFL, NBA, NHL, WNBA, UFC and every future sport. Proprietary models, tracked picks, live intelligence, PBEcast.',
    brand: { '@type': 'Brand', name: 'PropBetEdge' },
    url: 'https://propbetedge.ai/pro',
    offers: {
      '@type': 'Offer',
      url: ALL_ACCESS.checkoutUrl,
      price: String(ALL_ACCESS.priceUsd),
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: String(ALL_ACCESS.priceUsd),
        priceCurrency: 'USD',
        billingDuration: 1,
        billingIncrement: 1,
        unitCode: 'MON',
      },
    },
  };
}
