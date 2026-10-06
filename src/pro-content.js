/* PropBetEdge All Access — canonical /pro membership page.
 * Commercial identity remains fixed here. Presentation is intentionally
 * product-first and avoids brittle product-count marketing. */

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

export const VALUE_PROPS = Object.freeze([
  { title:'The premium layer keeps expanding', body:'All Access is the umbrella for the premium PropBetEdge network. When we ship new All Access products, the membership gets more useful without forcing you to rebuild your subscription stack.' },
  { title:'Markets and models live together', body:'Compare venue pricing, inspect live market intelligence, follow Crypto nowcasts, then move into independent model probabilities and permanent forecast records inside the same ecosystem.' },
  { title:'Every sport keeps its own identity', body:'The sport network stays purpose-built. Baseball, hockey, tennis, UFC, golf and the rest keep the data, models, DNA systems and workflows that fit the sport instead of being flattened into one generic dashboard.' },
  { title:'Members can reach the builders', body:'Platinum Direct gives verified members a real feedback lane for data issues, feature requests and product ideas — connected to the team building PropBetEdge.' },
]);

export const OPERATING_SYSTEM_STAGES = Object.freeze([
  { step:'01', label:'Observe', title:'Ingest live evidence', body:'Scores, markets, lineups, injuries, weather, rankings and source changes flow into the network continuously.' },
  { step:'02', label:'Normalize', title:'Build reliable state', body:'Raw evidence becomes durable sport, event, player, team and market state before downstream products use it.' },
  { step:'03', label:'Analyze', title:'Run purpose-built engines', body:'Sport models, DNA systems, prediction models, market comparison and live-context products operate on domain-specific evidence.' },
  { step:'04', label:'Publish', title:'Put intelligence in the product', body:'The output becomes Compare, Predictions, Markets, Crypto, sport-native research and member-facing intelligence.' },
  { step:'05', label:'Grade', title:'Keep the receipts', body:'Official calls and forecast records are resolved against outcomes and retained so performance can be evaluated after the event.' },
  { step:'06', label:'Improve', title:'Promote after evidence', body:'Research and shadow lanes can test changes prospectively while production remains gated by evidence and release controls.' },
]);

const PRODUCTS = Object.freeze([
  {
    key:'compare',
    eyebrow:'PREDICTION MARKETS',
    title:'Compare',
    headline:'See the price. Check the contract.',
    body:'Kalshi and Polymarket sports markets side by side, with rule-aware labeling that separates real pricing divergence from contracts that only look alike.',
    url:'https://compare.propbetedge.ai/',
    action:'Open Compare',
  },
  {
    key:'markets',
    eyebrow:'LIVE MARKET INTELLIGENCE',
    title:'Markets',
    headline:'Bull. Bear. Quant. Same tape.',
    body:'Tim makes the bull case. Bramer attacks the risk. Data reads the tape. Live market state and opposing interpretations live in one focused terminal.',
    url:'https://predictions.propbetedge.ai/markets/',
    action:'Open Markets',
  },
  {
    key:'crypto',
    eyebrow:'CRYPTO NOWCAST',
    title:'Crypto',
    headline:'Model probability against the live market.',
    body:'BTC 15-minute nowcasting combines PropBetEdge probability, Kalshi benchmark, Robinhood execution economics, live evidence and scored research.',
    url:'https://predictions.propbetedge.ai/crypto/',
    action:'Open Crypto',
  },
  {
    key:'predictions',
    eyebrow:'INDEPENDENT MODELS',
    title:'Predictions',
    headline:'Probability with evidence — and receipts.',
    body:'Independent forecasts, methodology, live market comparison and permanent scored records across real-world events.',
    url:'https://predictions.propbetedge.ai/',
    action:'Open Predictions',
  },
]);

const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function priceLabel() { return `$${ALL_ACCESS.priceUsd} / ${ALL_ACCESS.interval}`; }
export function promoLine() { return `${ALL_ACCESS.promoPercent}% off ${ALL_ACCESS.promoDuration} with code ${ALL_ACCESS.promoCode}.`; }
export function checkoutSucceeded(search) {
  try { return new URLSearchParams(String(search || '')).get('checkout') === 'success'; }
  catch { return false; }
}

function ctaButton(label, extraClass='') {
  return `<a class="pbe-pro-cta ${extraClass}" href="${ALL_ACCESS.checkoutUrl}" rel="noopener" data-pbe-placement="all_access_checkout" data-pbe-price="${ALL_ACCESS.priceId}" data-pbe-link="${ALL_ACCESS.paymentLinkId}">${esc(label)}<span class="pbe-pro-cta-arrow" aria-hidden="true">→</span></a>`;
}

function promoChip() {
  return `
    <div class="pbe-pro-offer" role="note" aria-label="All Access offer">
      <span class="pbe-pro-offer-eyebrow">ALL ACCESS OFFER</span>
      <span class="pbe-pro-offer-line">${ALL_ACCESS.promoPercent}% off ${esc(ALL_ACCESS.promoDuration)}</span>
      <span class="pbe-pro-offer-code">Code <code data-pbe-promo-code>${ALL_ACCESS.promoCode}</code>
        <button type="button" class="pbe-pro-copy" data-pbe-copy="${ALL_ACCESS.promoCode}" aria-label="Copy promo code ${ALL_ACCESS.promoCode}">Copy</button>
      </span>
    </div>`;
}

function membershipCard(active) {
  return `
    <aside class="pbe-pro-card ${active ? 'is-active' : ''}" aria-label="All Access membership">
      <div class="pbe-pro-card-top">
        <span class="pbe-pro-card-eyebrow">${active ? 'MEMBERSHIP ACTIVE' : 'PROPBETEDGE PLATINUM'}</span>
        <span class="pbe-pro-card-name">All Access</span>
      </div>
      <div class="pbe-pro-card-price"><span class="pbe-pro-card-amount">$${ALL_ACCESS.priceUsd}</span><span class="pbe-pro-card-per">/ ${ALL_ACCESS.interval}</span></div>
      <p class="pbe-pro-card-sub">The premium network plus the full live sport network under one membership.</p>
      <ul class="pbe-pro-card-list">
        <li><span class="pbe-pro-check">✓</span>Platinum member hub + Member Wire</li>
        <li><span class="pbe-pro-check">✓</span>Compare · Kalshi + Polymarket</li>
        <li><span class="pbe-pro-check">✓</span>Markets + Crypto</li>
        <li><span class="pbe-pro-check">✓</span>PropBetEdge Predictions</li>
        <li><span class="pbe-pro-check">✓</span>Every live sport-native product</li>
        <li><span class="pbe-pro-check">✓</span>Platinum Direct</li>
        <li class="pbe-pro-card-future"><span class="pbe-pro-check">✓</span>Future All Access products as they launch</li>
      </ul>
      ${active
        ? `<a class="pbe-pro-cta pbe-pro-cta-hub" href="https://members.propbetedge.ai/?signin=1" rel="noopener">Open Platinum Hub<span class="pbe-pro-cta-arrow">→</span></a>
           <a class="pbe-pro-card-manage" href="${ALL_ACCESS.manageUrl}" target="_blank" rel="noopener noreferrer">Manage subscription ↗</a>`
        : `${ctaButton('Get All Access')}<p class="pbe-pro-card-promo">${ALL_ACCESS.promoPercent}% off while active · code <strong>${ALL_ACCESS.promoCode}</strong></p>`}
      <p class="pbe-pro-card-policy">Cancel future renewal anytime. Charges are non-refundable after access is activated except where required by law. <a href="/terms">Terms</a></p>
    </aside>`;
}

function hero(shareBar='') {
  return `
    <section class="pbe-pro-hero">
      <div class="pbe-pro-hero-copy">
        <span class="pbe-pro-eyebrow">PROPBETEDGE PLATINUM · ALL ACCESS</span>
        <h1 class="pbe-pro-title">
          <span class="pbe-pro-title-brand">Everything we build.</span>
          <span class="pbe-pro-title-all">One membership.</span>
        </h1>
        <p class="pbe-pro-statement">
          Compare live prediction markets. Follow market intelligence and Crypto nowcasts.
          Read model probabilities with permanent records. Drop into the full sport network.
          Then manage it all from your private Platinum Hub.
        </p>
        <p class="pbe-pro-os-intro">All Access is no longer a bundle of sport subscriptions. It is the premium layer across PropBetEdge — and it keeps getting better as we ship.</p>
        <div class="pbe-pro-buyline">
          <div class="pbe-pro-price"><span class="pbe-pro-price-amount">$${ALL_ACCESS.priceUsd}</span><span class="pbe-pro-price-per">/ ${ALL_ACCESS.interval}</span></div>
          ${ctaButton('Get All Access', 'pbe-pro-cta-hero')}
        </div>
        ${promoChip()}
        <div class="pbe-pro-hero-links">
          <a href="#flagship">See what you unlock ↓</a>
          <a href="https://members.propbetedge.ai/?signin=1">Already a member? Sign in ↗</a>
        </div>
        ${shareBar ? `<div class="pbe-pro-share">${shareBar}</div>` : ''}
      </div>
      ${membershipCard(false)}
    </section>`;
}

function flagshipSection() {
  return `
    <section class="pbe-pro-section pbe-pro-flagship" id="flagship">
      <header class="pbe-pro-section-head">
        <span class="pbe-pro-eyebrow">THE PREMIUM LAYER</span>
        <h2>Start with the products that sit above the sports.</h2>
        <p>These are live destinations inside the current PropBetEdge ecosystem — not roadmap promises.</p>
      </header>

      <div class="pbe-pro-feature-stories">
        ${PRODUCTS.map((p, index) => `
          <a class="pbe-pro-feature-story pbe-pro-feature-${p.key}" href="${p.url}" target="_blank" rel="noopener">
            <div class="pbe-pro-feature-media" aria-hidden="true"></div>
            <div class="pbe-pro-feature-copy">
              <span class="pbe-pro-feature-index">0${index + 1}</span>
              <span class="pbe-pro-feature-eyebrow">${esc(p.eyebrow)}</span>
              <h3>${esc(p.title)}</h3>
              <strong>${esc(p.headline)}</strong>
              <p>${esc(p.body)}</p>
              <b>${esc(p.action)} ↗</b>
            </div>
          </a>`).join('')}
      </div>
    </section>`;
}

function memberHubSection() {
  return `
    <section class="pbe-pro-hub-story">
      <div class="pbe-pro-hub-story-media" aria-hidden="true"></div>
      <div class="pbe-pro-hub-story-copy">
        <span class="pbe-pro-eyebrow">YOUR PRIVATE FRONT DOOR</span>
        <h2>The membership finally has a home.</h2>
        <p>The Platinum Hub connects the entire network without trying to replace it. Open products, read member updates and use Platinum Direct when you want something checked, changed or built.</p>
        <div class="pbe-pro-hub-points">
          <span>Member Wire</span><span>Full network</span><span>Platinum Direct</span>
        </div>
        <a class="pbe-pro-text-link" href="https://members.propbetedge.ai/" target="_blank" rel="noopener">Open the Platinum Hub ↗</a>
      </div>
    </section>`;
}

function sportsGrid() {
  return `
    <ul class="pbe-pro-sports" aria-label="Sports included in All Access">
      ${SPORTS.map((s) => `
        <li class="pbe-pro-sport" data-sport="${s.key}">
          <a href="${s.url}" target="_blank" rel="noopener">
            <span class="pbe-pro-sport-label">${esc(s.label)}</span>
            <span class="pbe-pro-sport-name">${esc(s.name)}</span>
            <span class="pbe-pro-sport-edge">${esc(s.edge)}</span>
            <b>OPEN ${esc(s.label)} ↗</b>
          </a>
        </li>`).join('')}
    </ul>`;
}

function whySection() {
  return `
    <section class="pbe-pro-section pbe-pro-why" id="why">
      <header class="pbe-pro-section-head">
        <span class="pbe-pro-eyebrow">WHY ALL ACCESS</span>
        <h2>$29 should feel better every time we ship.</h2>
      </header>
      <div class="pbe-pro-why-grid">
        ${VALUE_PROPS.map((v) => `
          <article>
            <h3>${esc(v.title)}</h3>
            <p>${esc(v.body)}</p>
          </article>`).join('')}
      </div>
    </section>`;
}

function operatingSystemSection() {
  return `
    <details class="pbe-pro-system">
      <summary><span>Want the technical story?</span><b>See how the intelligence system works ↓</b></summary>
      <div class="pbe-pro-system-inner">
        ${OPERATING_SYSTEM_STAGES.map((stage) => `
          <article><span>${stage.step}</span><small>${esc(stage.label)}</small><h3>${esc(stage.title)}</h3><p>${esc(stage.body)}</p></article>`).join('')}
      </div>
    </details>`;
}

function successHero(shareBar='') {
  return `
    <section class="pbe-pro-hero pbe-pro-hero-success">
      <div class="pbe-pro-hero-copy">
        <span class="pbe-pro-eyebrow pbe-pro-eyebrow-success">CHECKOUT COMPLETE</span>
        <h1 class="pbe-pro-title"><span class="pbe-pro-title-brand">You are in.</span><span class="pbe-pro-title-all">Welcome to All Access.</span></h1>
        <p class="pbe-pro-success-lead">Your membership is active. Start in the Platinum Hub — your private front door to the network.</p>
        <div class="pbe-pro-success-actions">
          <a class="pbe-pro-cta pbe-pro-cta-hub" href="https://members.propbetedge.ai/?signin=1" rel="noopener">Open Platinum Hub<span class="pbe-pro-cta-arrow">→</span></a>
          <a class="pbe-pro-success-link" href="https://compare.propbetedge.ai/" rel="noopener">Open Compare ↗</a>
          <a class="pbe-pro-success-link" href="https://predictions.propbetedge.ai/" rel="noopener">Open Predictions ↗</a>
        </div>
        <ol class="pbe-pro-steps">
          <li><strong>Use the email from checkout</strong> when the Hub asks you to sign in.</li>
          <li><strong>Your All Access identity unlocks the premium network</strong> across PropBetEdge.</li>
          <li><strong>Use Platinum Direct</strong> inside the Hub when you want a feature changed, data checked or something new built.</li>
        </ol>
        ${shareBar ? `<div class="pbe-pro-share">${shareBar}</div>` : ''}
      </div>
      ${membershipCard(true)}
    </section>`;
}

export function buildProHtml({ checkoutSuccess=false, shareBar='' }={}) {
  return `
    <div class="pbe-pro ${checkoutSuccess ? 'pbe-pro-is-success' : ''}" data-pbe-page="pro">
      ${checkoutSuccess ? successHero(shareBar) : hero(shareBar)}

      ${checkoutSuccess ? '' : flagshipSection()}
      ${checkoutSuccess ? '' : memberHubSection()}

      <section class="pbe-pro-section pbe-pro-sports-section" id="sports">
        <header class="pbe-pro-section-head">
          <span class="pbe-pro-eyebrow">${checkoutSuccess ? 'YOUR SPORTS NETWORK' : 'THE FULL SPORTS NETWORK'}</span>
          <h2>Every sport keeps the product it deserves.</h2>
          <p>${checkoutSuccess ? 'Your membership covers the live PropBetEdge sport network below.' : 'All Access does not flatten the sports into one generic dashboard. Each destination keeps the models, research and live experience that fit that sport.'}</p>
        </header>
        ${sportsGrid()}
      </section>

      ${checkoutSuccess ? '' : whySection()}
      ${checkoutSuccess ? '' : operatingSystemSection()}

      ${checkoutSuccess ? '' : `
      <section class="pbe-pro-final">
        <span class="pbe-pro-eyebrow">PROPBETEDGE ALL ACCESS</span>
        <h2>Everything premium we ship. One membership.</h2>
        <p>Markets, Crypto, Compare, Predictions, the Platinum Hub and the full sport network for ${priceLabel()}.</p>
        ${ctaButton('Unlock All Access', 'pbe-pro-cta-hero')}
        <div class="pbe-pro-final-links">
          <a href="https://members.propbetedge.ai/?signin=1">Already a member? Sign in ↗</a>
          <a href="/terms">Terms</a>
          <a href="/support">Support</a>
        </div>
      </section>`}
    </div>`;
}
