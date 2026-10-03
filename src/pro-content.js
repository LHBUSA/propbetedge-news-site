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
      <div class="pbe-pro-card-top">
        <span class="pbe-pro-card-eyebrow">${active ? 'Membership active' : 'Membership'}</span>
        <span class="pbe-pro-card-name">All Access</span>
      </div>
      <div class="pbe-pro-card-price"><span class="pbe-pro-card-amount">$${ALL_ACCESS.priceUsd}</span><span class="pbe-pro-card-per">/ ${ALL_ACCESS.interval}</span></div>
      <p class="pbe-pro-card-sub">Cancel anytime. One login across the whole network.</p>
      <ul class="pbe-pro-card-list">
        ${SPORTS.map((s) => `<li><span class="pbe-pro-check" aria-hidden="true">✓</span>${s.proName || `${s.label} Pro`}</li>`).join('')}
        <li class="pbe-pro-card-predictions"><span class="pbe-pro-check" aria-hidden="true">✓</span>PropBetEdge Predictions</li>
        <li><span class="pbe-pro-check" aria-hidden="true">✓</span>Boxing Pro — coming Q1 2027</li>
        <li><span class="pbe-pro-check" aria-hidden="true">✓</span>Governed model evolution and shadow research</li>
        <li class="pbe-pro-card-future"><span class="pbe-pro-check" aria-hidden="true">✓</span>Every future sport and Pro product</li>
      </ul>
      ${active
        ? `<a class="pbe-pro-cta pbe-pro-cta-ghost" href="${ALL_ACCESS.manageUrl}" target="_blank" rel="noopener noreferrer">Manage subscription<span class="pbe-pro-cta-arrow" aria-hidden="true">↗</span></a>`
        : `${ctaButton('Get All Access')}<p class="pbe-pro-card-promo">${ALL_ACCESS.promoPercent}% off ${esc(ALL_ACCESS.promoDuration)} · code <strong>${ALL_ACCESS.promoCode}</strong></p>`}
    </aside>`;
}

function hero(shareBar = '') {
  return `
    <section class="pbe-pro-hero">
      <div class="pbe-pro-hero-copy">
        <span class="pbe-pro-eyebrow">PropBetEdge Network · Membership</span>
        <h1 class="pbe-pro-title"><span class="pbe-pro-title-brand">PropBetEdge</span><span class="pbe-pro-title-all">All Access</span></h1>
        <p class="pbe-pro-statement">
          <span>One membership.</span>
          <span>${SPORTS.length === 10 ? 'Ten' : SPORTS.length} sports.</span>
          <span>All Predictions.</span>
          <span>One autonomous sports intelligence operating system.</span>
          <span>Every current and future PropBetEdge Pro product.</span>
        </p>
        <p class="pbe-pro-os-intro">All Access is the customer layer of a system that continuously ingests live sports data, runs sport-specific analytical engines, evaluates its own predictions, tests new intelligence in shadow, grades official decisions and turns the results into live products, research and content — with governed promotion into production.</p>
        <p class="pbe-pro-family"><strong>One operating system. ${SPORTS.length === 10 ? 'Ten' : SPORTS.length} sports + PropBetEdge Predictions. Every future sport.</strong><span>MLB · NFL · NBA · WNBA · NHL · UFC · Tennis · Soccer · Golf · F1 · <a href="${PREDICTIONS.url}/" target="_blank" rel="noopener">Predictions</a></span></p>
        <div class="pbe-pro-price" aria-label="Price"><span class="pbe-pro-price-amount">$${ALL_ACCESS.priceUsd}</span><span class="pbe-pro-price-per">/ ${ALL_ACCESS.interval}</span></div>
        ${ctaButton('Get All Access', 'pbe-pro-cta-hero')}
        ${promoChip()}
        <p class="pbe-pro-hero-fine">Includes MLB, NFL, NBA, NHL, WNBA, UFC, Tennis, Soccer and Golf Pro today, plus F1 Intelligence and PropBetEdge Predictions. Boxing Pro is planned for Q1 2027 and joins All Access at launch. All Access is not just a bundle of sport subscriptions — it is access to the connected intelligence system underneath them.</p>
        ${shareBar ? `<div class="pbe-pro-share">${shareBar}</div>` : ''}
      </div>
      ${membershipCard(false)}
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

      ${checkoutSuccess ? '' : operatingSystemSection()}

      <section class="pbe-pro-section pbe-pro-sports-section" id="sports">
        <header class="pbe-pro-section-head">
          <span class="pbe-pro-eyebrow">${checkoutSuccess ? 'Your network' : 'Included today'}</span>
          <h2>Every sport. One login.</h2>
          <p>${checkoutSuccess ? 'Open a sport and sign in with your checkout email.' : 'All Access unlocks the Pro tier across all ten live PropBetEdge sports, including Golf and F1, plus PropBetEdge Predictions. Boxing is planned for Q1 2027 and joins the membership at launch.'}</p>
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

      <section class="pbe-pro-section pbe-pro-plans" id="plans">
        <div class="pbe-pro-plans-inner">
          <div>
            <span class="pbe-pro-eyebrow">Already a member of one sport?</span>
            <h2>Your sport plan stays exactly as it is.</h2>
            <p>Existing individual sport plans continue unchanged. All Access is the premium umbrella for people who want the whole network under one subscription and one login — including Tennis Pro, Soccer Pro, Golf Pro and F1 Intelligence today, plus Boxing Pro when it launches.</p>
          </div>
          <div class="pbe-pro-plans-facts">
            <div><span class="pbe-pro-fact-k">Billing</span><span class="pbe-pro-fact-v">${priceLabel()}, cancel anytime</span></div>
            <div><span class="pbe-pro-fact-k">Access</span><span class="pbe-pro-fact-v">Secure sign-in link to your checkout email</span></div>
            <div><span class="pbe-pro-fact-k">Coverage</span><span class="pbe-pro-fact-v">10 live sports + PropBetEdge Predictions today · Boxing planned Q1 2027 · every future sport included</span></div>
            <div><span class="pbe-pro-fact-k">Launch offer</span><span class="pbe-pro-fact-v">${esc(promoLine())}</span></div>
          </div>
        </div>
      </section>

      ${checkoutSuccess ? '' : `
      <section class="pbe-pro-final">
        <h2>Get the intelligence system behind every PropBetEdge sport.</h2>
        <p>Ten live sports and PropBetEdge Predictions today. Boxing planned Q1 2027. Every future sport. ${priceLabel()}. ${esc(promoLine())}</p>
        ${ctaButton('Get All Access', 'pbe-pro-cta-hero')}
      </section>`}
    </div>`;
}
