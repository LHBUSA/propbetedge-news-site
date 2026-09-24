import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';

const CHECKOUT_URL = 'https://buy.stripe.com/8x2eVdgmOaqy4pv8Ez7wA0N';

const SPORTS = Object.freeze([
  { key: 'mlb', label: 'MLB', emoji: '⚾', href: 'https://mlb.propbetedge.ai', copy: 'Models, props, player intelligence and recorded picks.' },
  { key: 'nfl', label: 'NFL', emoji: '🏈', href: 'https://nfl.propbetedge.ai', copy: 'Market Board, Model Lab, TD Targets and live football intelligence.' },
  { key: 'nba', label: 'NBA', emoji: '🏀', href: 'https://nba.propbetedge.ai', copy: 'Player markets, model context and pro basketball intelligence.' },
  { key: 'nhl', label: 'NHL', emoji: '🏒', href: 'https://nhl.propbetedge.ai', copy: 'Ice Board, PBE Picks, player research and hockey intelligence.' },
  { key: 'wnba', label: 'WNBA', emoji: '🏀', href: 'https://wnba.propbetedge.ai', copy: 'Live games, player load, picks and WNBA intelligence.' },
  { key: 'ufc', label: 'UFC', emoji: '🥊', href: 'https://ufc.propbetedge.ai', copy: 'Fight DNA, matchup research, injuries and fight-week intelligence.' },
]);

export function renderProPage(root, setMeta) {
  const params = new URLSearchParams(window.location.search);
  const success = params.get('checkout') === 'success';

  setMeta?.({
    title: 'PropBetEdge All Access — Every Sport, One Membership',
    description: 'PropBetEdge All Access unlocks every current and future PropBetEdge sport, predictions, models and Pro add-ons for $29/month.',
    canonical: 'https://propbetedge.ai/pro',
    ogImage: 'https://propbetedge.ai/logo/pbe-full-600.png',
  });

  root.innerHTML = `
    ${renderHeader()}
    <main class="pbe-pro-page">
      ${success ? `
        <section class="pbe-pro-success" role="status">
          <strong>Welcome to PropBetEdge All Access.</strong>
          <span>Your membership is activating across the PropBetEdge network.</span>
        </section>
      ` : ''}

      <section class="pbe-pro-hero">
        <div class="container">
          <div class="pbe-pro-eyebrow">PROPBETEDGE PRO · ALL ACCESS</div>
          <h1>Every sport.<br><em>One membership.</em></h1>
          <p class="pbe-pro-dek">
            One PropBetEdge subscription unlocks every current and future sport, plus predictions, models and Pro add-ons as they launch.
            No stacking subscriptions. No choosing one league over another.
          </p>

          <div class="pbe-pro-price-lockup">
            <div class="pbe-pro-price"><span>$</span><strong>29</strong><sup>/month</sup></div>
            <div class="pbe-pro-price-copy">
              <b>All current + future sports included</b>
              <span>Predictions, models and Pro add-ons included as they launch</span>
            </div>
          </div>

          <div class="pbe-pro-launch-offer" aria-label="PropBetEdge All Access launch offer">
            <span class="pbe-pro-launch-badge">LAUNCH OFFER</span>
            <strong>Get 25% off for as long as you stay active</strong>
            <span>Use <code>THEEDGE25</code> at checkout · all current and future sports, predictions and Pro add-ons included</span>
          </div>

          <div class="pbe-pro-actions">
            <a class="pbe-pro-primary" href="${CHECKOUT_URL}" target="_blank" rel="noopener">Get All Access →</a>
            <a class="pbe-pro-secondary" href="#sports">See what’s included</a>
          </div>

          <div class="pbe-pro-proof">
            <span>⚾ MLB</span><span>🏈 NFL</span><span>🏀 NBA</span><span>🏒 NHL</span><span>🏀 WNBA</span><span>🥊 UFC</span>
            <b>+ future sports, predictions & Pro add-ons</b>
          </div>
        </div>
      </section>

      <section class="pbe-pro-value">
        <div class="container">
          <div class="pbe-pro-section-head">
            <span>ONE NETWORK</span>
            <h2>Six specialized products. One Pro account.</h2>
            <p>Each sport keeps its own purpose-built experience and subdomain. All Access sits above them as the membership layer.</p>
          </div>

          <div class="pbe-pro-sport-grid" id="sports">
            ${SPORTS.map((sport) => `
              <a class="pbe-pro-sport-card is-${sport.key}" href="${sport.href}" target="_blank" rel="noopener">
                <div class="pbe-pro-sport-top">
                  <span class="pbe-pro-sport-emoji" aria-hidden="true">${sport.emoji}</span>
                  <span class="pbe-pro-sport-status">INCLUDED</span>
                </div>
                <h3>${sport.label} Pro</h3>
                <p>${sport.copy}</p>
                <span class="pbe-pro-sport-link">Open ${sport.label} ↗</span>
              </a>
            `).join('')}
          </div>
        </div>
      </section>

      <section class="pbe-pro-future">
        <div class="container pbe-pro-future-inner">
          <div>
            <span>BUILT TO EXPAND</span>
            <h2>Your membership gets better when PropBetEdge gets bigger.</h2>
          </div>
          <p>
            All Access is not a six-sport bundle with a fixed ceiling. It is the PropBetEdge Pro membership.
            New sports, prediction products, models and Pro add-ons join the membership as they launch.
          </p>
        </div>
      </section>

      <section class="pbe-pro-final">
        <div class="container">
          <span>PROPBETEDGE ALL ACCESS</span>
          <h2>Stop buying sports one at a time.</h2>
          <p>Get the entire PropBetEdge Pro network for $29/month. Use <strong>THEEDGE25</strong> at checkout and get 25% off for as long as you stay active — including current and future sports, predictions, models and Pro add-ons.</p>
          <a class="pbe-pro-primary" href="${CHECKOUT_URL}" target="_blank" rel="noopener">Start All Access →</a>
          <small>Existing sport-specific plans remain valid. All Access is an additional network-wide option.</small>
        </div>
      </section>
    </main>
    ${renderFooter()}
  `;
}
