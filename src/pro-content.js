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
  { key: 'tennis', label: 'Tennis', name: 'PropBetEdge Tennis', url: 'https://tennis.propbetedge.ai', glyph: '🎾', edge: 'Tennis Pro, live scores, rankings, Tennis DNA, matchup intelligence and PBEcast' },
  { key: 'soccer', label: 'Soccer', name: 'PropBetEdge Soccer', url: 'https://soccer.propbetedge.ai', glyph: '⚽', edge: 'Soccer Pro, live matches, Player DNA, team intelligence, model research and PBEcast' },
  { key: 'golf', label: 'Golf', name: 'PropBetEdge Golf', url: 'https://golf.propbetedge.ai', glyph: '⛳', edge: 'Golf Pro, Player DNA, Course DNA, matchup intelligence, tournament history and PBEcast' },
  { key: 'f1', label: 'F1', name: 'PropBetEdge F1', url: 'https://f1.propbetedge.ai', glyph: '🏎️', edge: 'Driver DNA, Constructor DNA, Circuit DNA, standings, matchups, weather and PBEcast', proName: 'F1 Intelligence' },
]);

// PropBetEdge Predictions — a first-class intelligence product included in All Access. NOT a sport: never add it
// to SPORTS (the sport count, sport grid and per-sport Pro list stay ten).
export const PREDICTIONS = Object.freeze({
  key: 'predictions',
  name: 'PropBetEdge Predictions',
  url: 'https://predictions.propbetedge.ai',
  websiteId: 'https://predictions.propbetedge.ai/#website',
  glyph: '◎',
  tagline: 'Real-world probability intelligence',
  edge: 'Weather · Rates · Economics · Science · Space · Energy · Business and more — independent model probabilities compared with live prediction markets, immutable forecast records and a scored track record.',
});

export const NETWORK_PRODUCTS = Object.freeze([
  {
    key: 'members', label: 'Platinum Hub', url: 'https://members.propbetedge.ai/',
    eyebrow: 'YOUR PRIVATE FRONT DOOR',
    headline: 'The whole network, organized around your membership.',
    body: 'A premium member destination for the full PropBetEdge network, Member Wire updates and Platinum Direct — a verified member line straight back to the team building the products.',
    proof: ['Member Wire', 'Platinum Direct', 'Full network'],
  },
  {
    key: 'compare', label: 'Compare', url: 'https://compare.propbetedge.ai/',
    eyebrow: 'KALSHI + POLYMARKET',
    headline: 'Two venues. One contract question.',
    body: 'Live sports prediction-market pricing side by side, with comparable-versus-rules-differ labeling so pricing divergence is not confused with a settlement mismatch.',
    proof: ['Live pricing', 'Rule-aware', '60s auto-poll'],
  },
  {
    key: 'markets', label: 'Markets', url: 'https://predictions.propbetedge.ai/markets/',
    eyebrow: 'LIVE MARKET INTELLIGENCE',
    headline: 'Bull case. Bear case. Quant read.',
    body: 'A live market terminal where Tim argues the bull case, Bramer attacks the risk and Data reads the tape — market state, evidence and opposing views in one place.',
    proof: ['Bull', 'Bear', 'Quant'],
  },
  {
    key: 'crypto', label: 'Crypto', url: 'https://predictions.propbetedge.ai/crypto/',
    eyebrow: 'PBE CRYPTO NOWCAST',
    headline: 'Model probability versus the live market.',
    body: 'BTC 15-minute nowcasting with PropBetEdge probability, Kalshi benchmark, Robinhood execution economics, evidence, probability path and a scored research record.',
    proof: ['1 min model', '5 sec tape', 'Model vs market'],
  },
  {
    key: 'predictions', label: 'Predictions', url: 'https://predictions.propbetedge.ai/',
    eyebrow: 'INDEPENDENT MODELS',
    headline: 'Probability with evidence — and receipts.',
    body: 'Evidence-based probabilities, methodology, market benchmarks, immutable forecast records and a scored track record across real-world events.',
    proof: ['Probabilities', 'Evidence', 'Permanent record'],
  },
]);

export const UPCOMING_SPORTS = Object.freeze([
  { key: 'boxing', label: 'Boxing', glyph: '🥊', eta: 'Q1 2027', edge: 'Fight intelligence, boxer profiles, matchup research, model analysis and event-week coverage.' },
]);

export const VALUE_PROPS = Object.freeze([
  { title: 'Sport-specific analytical engines', body: 'Every sport runs its own PropBetEdge intelligence stack — models, DNA systems, matchup research, live context and market analysis — instead of forcing every league through one generic algorithm.' },
  { title: 'Tracked, graded decisions', body: 'Where official model calls are live, they are locked before play, graded against official results and preserved in permanent records you can audit.' },
  { title: 'Continuous live intelligence', body: 'Scores, play-by-play, lineups, injuries, weigh-ins, weather, rankings, transactions and market changes continuously update the state the system reasons from.' },
  { title: 'Shadow research and model evolution', body: 'New signals and candidate models can run beside production in shadow, accumulate evidence and prove themselves without silently changing official customer-facing outputs.' },
  { title: 'PBEcast, research and live products', body: 'The same intelligence layer becomes sport-specific live experiences, matchup desks, Player DNA, research reports, alerts and evidence-grounded content.' },
  { title: 'Every future sport and Pro product', body: 'The operating system keeps expanding. New models, new sports and new Pro products join the network as they launch, with no separate All Access upgrade.' },
]);

export const OPERATING_SYSTEM_STAGES = Object.freeze([
  { step: '01', label: 'Observe', title: 'Ingest live sports data', body: 'Scores, play-by-play, odds, lineups, injuries, weather, rankings, transactions and source changes flow into the network continuously.' },
  { step: '02', label: 'Understand', title: 'Build canonical state', body: 'PropBetEdge normalizes each sport into durable game, player, team and market state so every downstream system reasons from the same evidence.' },
  { step: '03', label: 'Analyze', title: 'Run sport-specific engines', body: 'Each league gets its own analytical stack: prediction models, DNA systems, matchup intelligence, market comparison and live-game context.' },
  { step: '04', label: 'Evaluate', title: 'Grade official decisions', body: 'Official calls are time-stamped, outcomes are graded, records stay permanent and performance feeds calibration and research.' },
  { step: '05', label: 'Learn', title: 'Test new intelligence in shadow', body: 'Candidate signals and models can run prospectively beside production without changing official picks, records or customer claims.' },
  { step: '06', label: 'Promote', title: 'Ship only after evidence clears', body: 'Replay, parity, research and promotion gates decide what is ready. Better intelligence can graduate into production, but experiments do not promote themselves.' },
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
      ${UPCOMING_SPORTS.map((s) => `
        <li class="pbe-pro-sport pbe-pro-sport-future" data-sport="${s.key}">
          <div>
            <span class="pbe-pro-sport-glyph" aria-hidden="true">${s.glyph}</span>
            <span class="pbe-pro-sport-label">Coming ${s.eta}</span>
            <span class="pbe-pro-sport-name">PropBetEdge ${esc(s.label)}</span>
            <span class="pbe-pro-sport-edge">${esc(s.edge)}</span>
            <span class="pbe-pro-sport-badge">Included at launch</span>
          </div>
        </li>`).join('')}
      <li class="pbe-pro-sport pbe-pro-sport-future" data-sport="future">
        <div>
          <span class="pbe-pro-sport-glyph" aria-hidden="true">✦</span>
          <span class="pbe-pro-sport-label">Future network</span>
          <span class="pbe-pro-sport-name">Every future sport</span>
          <span class="pbe-pro-sport-edge">Every new PropBetEdge sport and every new Pro product joins All Access on launch day.</span>
          <span class="pbe-pro-sport-badge">Included</span>
        </div>
      </li>
    </ul>`;
}

function predictionsCard() {
  return `
    <a class="pbe-pro-predictions" href="${PREDICTIONS.url}/" target="_blank" rel="noopener" data-product="${PREDICTIONS.key}">
      <span class="pbe-pro-predictions-glyph" aria-hidden="true">${PREDICTIONS.glyph}</span>
      <span class="pbe-pro-predictions-copy">
        <span class="pbe-pro-predictions-eyebrow">PropBetEdge Predictions</span>
        <strong>${esc(PREDICTIONS.tagline)}</strong>
        <span>${esc(PREDICTIONS.edge)}</span>
      </span>
      <span class="pbe-pro-sport-badge">Included</span>
    </a>`;
}

function membershipCard(active) {
  return `
    <aside class="pbe-pro-card ${active ? 'is-active' : ''}" aria-label="All Access membership">
      <div class="pbe-pro-card-top"><span class="pbe-pro-card-eyebrow">${active ? 'Membership active' : 'Everything below. One membership.'}</span><span class="pbe-pro-card-name">All Access</span></div>
      <div class="pbe-pro-card-price"><span class="pbe-pro-card-amount">$${ALL_ACCESS.priceUsd}</span><span class="pbe-pro-card-per">/ ${ALL_ACCESS.interval}</span></div>
      <p class="pbe-pro-card-sub">The premium network layer plus every live sport product under one All Access membership.</p>
      <ul class="pbe-pro-card-list pbe-pro-card-list-featured">
        <li><span class="pbe-pro-check">✓</span>Platinum Hub + Member Wire</li>
        <li><span class="pbe-pro-check">✓</span>Compare · Kalshi + Polymarket</li>
        <li><span class="pbe-pro-check">✓</span>Market Intelligence</li>
        <li><span class="pbe-pro-check">✓</span>Crypto Nowcast</li>
        <li><span class="pbe-pro-check">✓</span>PropBetEdge Predictions</li>
        <li><span class="pbe-pro-check">✓</span>All ${SPORTS.length} sport-native products</li>
        <li><span class="pbe-pro-check">✓</span>Platinum Direct</li>
      </ul>
      ${active
        ? `<a class="pbe-pro-cta pbe-pro-cta-hub" href="https://members.propbetedge.ai/?signin=1" rel="noopener">Open Platinum Hub<span class="pbe-pro-cta-arrow">→</span></a><a class="pbe-pro-card-manage" href="${ALL_ACCESS.manageUrl}" target="_blank" rel="noopener noreferrer">Manage subscription ↗</a>`
        : `${ctaButton('Unlock Everything for $29', 'pbe-pro-cta-card')}<p class="pbe-pro-card-promo">${ALL_ACCESS.promoPercent}% off ${esc(ALL_ACCESS.promoDuration)} · code <strong>${ALL_ACCESS.promoCode}</strong></p>`}
      <p class="pbe-pro-card-policy">Digital membership · cancel future renewal anytime. Charges are non-refundable once access is activated except where required by law. <a href="/terms">Terms</a></p>
    </aside>`;
}
function heroVisual() {
  return `
    <div class="pbe-pro-hero-visual" aria-label="Inside PropBetEdge All Access">
      <a class="pbe-pro-window pbe-pro-window-compare" href="https://compare.propbetedge.ai/" target="_blank" rel="noopener">
        <span class="pbe-pro-window-top"><b>COMPARE</b><i>LIVE · 60S</i></span>
        <div class="pbe-pro-venue-row"><span><small>KALSHI</small><strong>YES PRICE</strong></span><em>↔</em><span><small>POLYMARKET</small><strong>YES PRICE</strong></span></div>
        <div class="pbe-pro-window-foot"><span>PRICING DIVERGENCE</span><span>RULE-AWARE</span></div>
      </a>
      <a class="pbe-pro-window pbe-pro-window-crypto" href="https://predictions.propbetedge.ai/crypto/" target="_blank" rel="noopener">
        <span class="pbe-pro-window-top"><b>CRYPTO NOWCAST</b><i>BTC · 15 MIN</i></span>
        <div class="pbe-pro-prob"><small>PBE PROBABILITY · UP</small><strong>MODEL</strong><span><i></i></span></div>
        <div class="pbe-pro-window-foot"><span>1 MIN MODEL</span><span>5 SEC TAPE</span></div>
      </a>
      <a class="pbe-pro-window pbe-pro-window-markets" href="https://predictions.propbetedge.ai/markets/" target="_blank" rel="noopener">
        <span class="pbe-pro-window-top"><b>MARKET INTELLIGENCE</b><i>LIVE DATA</i></span>
        <div class="pbe-pro-analysts"><span><small>TIM</small><strong>BULL</strong></span><span><small>BRAMER</small><strong>BEAR</strong></span><span><small>DATA</small><strong>QUANT</strong></span></div>
        <div class="pbe-pro-window-foot"><span>THESIS</span><span>COUNTERCASE</span><span>TAPE</span></div>
      </a>
      <a class="pbe-pro-window pbe-pro-window-hub" href="https://members.propbetedge.ai/" target="_blank" rel="noopener">
        <span class="pbe-pro-window-top"><b>PLATINUM HUB</b><i>MEMBER ONLY</i></span>
        <div class="pbe-pro-hub-lines"><span>MEMBER WIRE</span><span>FULL NETWORK</span><span>PLATINUM DIRECT</span></div>
        <div class="pbe-pro-window-foot"><span>ONE MEMBERSHIP</span><span>YOUR FRONT DOOR</span></div>
      </a>
    </div>`;
}

function hero(shareBar = '') {
  return `
    <section class="pbe-pro-hero pbe-pro-hero-v2">
      <div class="pbe-pro-hero-main">
        <div class="pbe-pro-hero-copy">
          <span class="pbe-pro-eyebrow">PROPBETEDGE PLATINUM · ALL ACCESS</span>
          <h1 class="pbe-pro-title"><span class="pbe-pro-title-brand">One membership.</span><span class="pbe-pro-title-all">The entire network.</span></h1>
          <p class="pbe-pro-statement">Markets. Crypto. Compare. Predictions. A private member hub. Ten sport-native intelligence products. <strong>All for $${ALL_ACCESS.priceUsd}/month.</strong></p>
          <p class="pbe-pro-os-intro">All Access has outgrown the idea of a sports bundle. It is the premium layer across everything PropBetEdge builds: real-time market comparison, model probabilities, live market intelligence, crypto nowcasting, member-only access and deep sport-specific products.</p>
          <div class="pbe-pro-hero-counts">
            <span><b>10</b><small>SPORT PRODUCTS</small></span>
            <span><b>5</b><small>PREMIUM NETWORK EXPERIENCES</small></span>
            <span><b>1</b><small>ALL ACCESS MEMBERSHIP</small></span>
          </div>
          <div class="pbe-pro-buyline">
            <div class="pbe-pro-price"><span class="pbe-pro-price-amount">$${ALL_ACCESS.priceUsd}</span><span class="pbe-pro-price-per">/ ${ALL_ACCESS.interval}</span></div>
            ${ctaButton('Get All Access', 'pbe-pro-cta-hero')}
          </div>
          ${promoChip()}
          <div class="pbe-pro-hero-links"><a href="#premium-network">See everything included ↓</a><a href="https://members.propbetedge.ai/?signin=1">Already a member? Sign in ↗</a></div>
          ${shareBar ? `<div class="pbe-pro-share">${shareBar}</div>` : ''}
        </div>
        ${heroVisual()}
      </div>
      ${membershipCard(false)}
    </section>`;
}

function premiumNetworkSection() {
  return `
    <section class="pbe-pro-section pbe-pro-premium-network" id="premium-network">
      <header class="pbe-pro-section-head pbe-pro-section-head-wide">
        <span class="pbe-pro-eyebrow">THE PREMIUM NETWORK</span>
        <h2>Before you even get to the ten sports, you get all of this.</h2>
        <p>Five live premium experiences sit above the sport products: your private Hub, Compare, Markets, Crypto and Predictions.</p>
      </header>
      <div class="pbe-pro-network-products">
        ${NETWORK_PRODUCTS.map((p, index) => `
          <a class="pbe-pro-product pbe-pro-product-${p.key}" href="${p.url}" target="_blank" rel="noopener" data-product="${p.key}">
            <span class="pbe-pro-product-index">${String(index + 1).padStart(2, '0')}</span>
            <span class="pbe-pro-product-eyebrow">${esc(p.eyebrow)}</span>
            <h3>${esc(p.label)}</h3>
            <strong>${esc(p.headline)}</strong>
            <p>${esc(p.body)}</p>
            <span class="pbe-pro-product-proof">${p.proof.map((x) => `<i>${esc(x)}</i>`).join('')}</span>
            <b class="pbe-pro-product-open">OPEN PRODUCT ↗</b>
          </a>`).join('')}
      </div>
    </section>`;
}

function productShowcase() {
  return `
    <section class="pbe-pro-section pbe-pro-showcase" id="inside">
      <header class="pbe-pro-section-head pbe-pro-section-head-wide">
        <span class="pbe-pro-eyebrow">INSIDE ALL ACCESS</span>
        <h2>This is what the membership actually feels like.</h2>
        <p>Move from market disagreement to model probability to sport-native research without leaving the PropBetEdge ecosystem.</p>
      </header>
      <div class="pbe-pro-showcase-grid">
        <a class="pbe-pro-showcase-card pbe-pro-showcase-compare" href="https://compare.propbetedge.ai/" target="_blank" rel="noopener">
          <div class="pbe-pro-showcase-ui"><span class="pbe-pro-ui-kicker">COMPARE · LIVE</span><div class="pbe-pro-ui-market"><span><small>KALSHI</small><b>PRICE</b></span><i>↔</i><span><small>POLYMARKET</small><b>PRICE</b></span></div><div class="pbe-pro-ui-tags"><span>PRICING DIVERGENCE</span><span>RULES CHECKED</span></div></div>
          <div><span>01 · PREDICTION MARKETS</span><h3>Know whether the two prices are even talking about the same contract.</h3><p>Compare puts pricing and contract alignment together instead of treating every gap as the same thing.</p></div>
        </a>
        <a class="pbe-pro-showcase-card pbe-pro-showcase-crypto" href="https://predictions.propbetedge.ai/crypto/" target="_blank" rel="noopener">
          <div class="pbe-pro-showcase-image"></div>
          <div><span>02 · CRYPTO NOWCAST</span><h3>BTC model probability, live market benchmark and execution economics.</h3><p>The Crypto surface puts the probability path, market gap, evidence, Robinhood tape and scoring together.</p></div>
        </a>
        <a class="pbe-pro-showcase-card pbe-pro-showcase-hub" href="https://members.propbetedge.ai/" target="_blank" rel="noopener">
          <div class="pbe-pro-showcase-hub-ui"><b>PLATINUM</b><strong>YOUR MEMBER HUB</strong><span>MEMBER WIRE</span><span>FULL NETWORK</span><span>PLATINUM DIRECT</span></div>
          <div><span>03 · MEMBER EXPERIENCE</span><h3>Your purchase has a home — and your feedback has a direct route back.</h3><p>The Platinum Hub is the private front door to the network, member updates and direct product feedback.</p></div>
        </a>
      </div>
    </section>`;
}
function operatingSystemSection() {
  return `
      <section class="pbe-pro-section pbe-pro-os" id="intelligence-os">
        <header class="pbe-pro-section-head pbe-pro-os-head">
          <span class="pbe-pro-eyebrow">The system behind All Access</span>
          <h2>Not ten disconnected sports products. One intelligence operating system.</h2>
          <p>PropBetEdge is built to keep working after the page loads. It observes live sports, maintains canonical state, runs sport-specific analytical engines, evaluates what happened, and feeds that evidence into the next round of research.</p>
        </header>
        <div class="pbe-pro-os-loop" aria-label="PropBetEdge intelligence operating system">
          ${OPERATING_SYSTEM_STAGES.map((stage) => `
            <article class="pbe-pro-os-stage">
              <div class="pbe-pro-os-stage-top"><span class="pbe-pro-os-step">${stage.step}</span><span class="pbe-pro-os-label">${esc(stage.label)}</span></div>
              <h3>${esc(stage.title)}</h3>
              <p>${esc(stage.body)}</p>
            </article>`).join('')}
        </div>
        <div class="pbe-pro-os-governance">
          <div>
            <span class="pbe-pro-os-governance-kicker">Governed self-improvement</span>
            <strong>The system can learn without letting experiments rewrite production.</strong>
          </div>
          <p>New intelligence can be researched, replayed and run in shadow automatically. Promotion to official production remains gated by evidence, parity checks and explicit approval. That is what makes the system self-improving without making it uncontrolled.</p>
        </div>
      </section>`;
}

function successHero(shareBar = '') {
  return `
    <section class="pbe-pro-hero pbe-pro-hero-success">
      <div class="pbe-pro-hero-copy">
        <span class="pbe-pro-eyebrow pbe-pro-eyebrow-success">Checkout complete</span>
        <h1 class="pbe-pro-title"><span class="pbe-pro-title-brand">Welcome to</span><span class="pbe-pro-title-all">All Access</span></h1>
        <p class="pbe-pro-success-lead">Your PropBetEdge All Access membership is active. Every sport in the network now recognizes the email you used at checkout.</p>
        <ol class="pbe-pro-steps">
          <li><strong>Open any sport</strong> below and choose <em>Sign in</em>. Your All Access membership covers the Pro features across all ten live sports.</li>
          <li><strong>Enter the email you used at checkout.</strong> A secure sign-in link arrives in that inbox; no password to remember.</li>
          <li><strong>Repeat once per sport.</strong> One subscription, one email, every PropBetEdge property.</li>
        </ol>
        <p class="pbe-pro-success-note">Stripe confirms your subscription within a minute or two. If a sport does not recognize your email yet, wait a moment and request the sign-in link again. Questions: <a href="mailto:support@proptechusa.ai">support@proptechusa.ai</a>.</p>
        ${shareBar ? `<div class="pbe-pro-share">${shareBar}</div>` : ''}
      </div>
      ${membershipCard(true)}
    </section>`;
}

export function buildProHtml({ checkoutSuccess = false, shareBar = '' } = {}) {
  return `
    <div class="pbe-pro ${checkoutSuccess ? 'pbe-pro-is-success' : ''}" data-pbe-page="pro">
      ${checkoutSuccess ? successHero(shareBar) : hero(shareBar)}

      ${checkoutSuccess ? '' : premiumNetworkSection()}
      ${checkoutSuccess ? '' : productShowcase()}

      <section class="pbe-pro-section pbe-pro-sports-section" id="sports">
        <header class="pbe-pro-section-head">
          <span class="pbe-pro-eyebrow">${checkoutSuccess ? 'YOUR SPORTS NETWORK' : 'AND THEN THERE ARE TEN FULL SPORTS PRODUCTS'}</span>
          <h2>Ten sports. Ten purpose-built intelligence products.</h2>
          <p>${checkoutSuccess ? 'Your All Access membership covers the premium network and every live sport below.' : 'The premium network does not replace the sports. Drop into the sport that matters and get the models, data, DNA, matchups, research and live context built specifically for it.'}</p>
        </header>
        ${sportsGrid()}
        <h3 class="pbe-pro-predictions-head">Also included: real-world probability intelligence</h3>
        ${predictionsCard()}
      </section>

      <section class="pbe-pro-section" id="included">
        <header class="pbe-pro-section-head">
          <span class="pbe-pro-eyebrow">What you get</span>
          <h2>Access the system, not just the picks.</h2>
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

${checkoutSuccess ? '' : operatingSystemSection()}

      <section class="pbe-pro-section pbe-pro-plans" id="plans">
        <div class="pbe-pro-plans-inner">
          <div>
            <span class="pbe-pro-eyebrow">Already a member of one sport?</span>
            <h2>Your sport plan stays exactly as it is.</h2>
            <p>Existing individual sport plans continue unchanged. All Access is the premium umbrella for people who want the whole network under one subscription and one login — including Tennis Pro, Soccer Pro, Golf Pro and F1 Intelligence today, plus Boxing Pro when it launches.</p>
          </div>
          <div class="pbe-pro-plans-facts">
            <div><span class="pbe-pro-fact-k">Billing</span><span class="pbe-pro-fact-v">${priceLabel()}, cancel anytime · no prorated refunds after access is activated</span></div>
            <div><span class="pbe-pro-fact-k">Access</span><span class="pbe-pro-fact-v">Secure sign-in link to your checkout email</span></div>
            <div><span class="pbe-pro-fact-k">Coverage</span><span class="pbe-pro-fact-v">10 live sports + PropBetEdge Predictions today · Boxing planned Q1 2027 · every future sport included</span></div>
            <div><span class="pbe-pro-fact-k">Launch offer</span><span class="pbe-pro-fact-v">${esc(promoLine())}</span></div>
          </div>
        </div>
      </section>

      ${checkoutSuccess ? '' : `
      <section class="pbe-pro-final">
        <h2>Markets. Models. Crypto. Compare. Ten sports. One membership.</h2>
        <p>Everything above for ${priceLabel()} — with ${ALL_ACCESS.promoPercent}% off while active using <strong>${ALL_ACCESS.promoCode}</strong>.</p>
        ${ctaButton('Get All Access', 'pbe-pro-cta-hero')}
        <p class="pbe-pro-final-policy">Digital sports intelligence membership. Charges are non-refundable once access is activated, except where required by law. <a href="/terms">Terms</a> · <a href="/support">Support</a></p>
      </section>`}
    </div>`;
}
