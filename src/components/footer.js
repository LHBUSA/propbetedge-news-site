/**
 * src/components/footer.js
 * Premium network footer for PropBetEdge.ai.
 *
 * The publication is the network hub. Keep sports products first, then news,
 * developer infrastructure, trust, and community. Every product linked here
 * is publicly accessible; NBA and NHL are intentionally presented as LIVE so
 * readers can use them through preseason while they continue to mature.
 */

import { PROPBET_LINKS } from '../ads-config.js';

const SPORTS = [
  { id: 'mlb', label: 'MLB', icon: '⚾', href: PROPBET_LINKS.picks_mlb, copy: 'Baseball intelligence' },
  { id: 'nfl', label: 'NFL', icon: '🏈', href: PROPBET_LINKS.picks_nfl, copy: 'Football intelligence' },
  { id: 'nba', label: 'NBA', icon: '🏀', href: PROPBET_LINKS.picks_nba, copy: 'Basketball intelligence' },
  { id: 'wnba', label: 'WNBA', icon: '🏀', href: 'https://wnba.propbetedge.ai', copy: 'Women’s basketball intelligence' },
  { id: 'nhl', label: 'NHL', icon: '🏒', href: PROPBET_LINKS.picks_nhl, copy: 'Hockey intelligence' },
  { id: 'ufc', label: 'UFC', icon: '🥊', href: PROPBET_LINKS.picks_ufc, copy: 'Fight intelligence' },
];

function sportCard(sport) {
  return `
    <a class="pbe-footer-sport pbe-footer-sport--${sport.id}" href="${sport.href}" target="_blank" rel="noopener" aria-label="Open PropBetEdge ${sport.label}">
      <span class="pbe-footer-sport__icon" aria-hidden="true">${sport.icon}</span>
      <span class="pbe-footer-sport__body">
        <span class="pbe-footer-sport__top"><b>${sport.label}</b><span class="pbe-footer-live"><i></i> LIVE</span></span>
        <span class="pbe-footer-sport__copy">${sport.copy}</span>
      </span>
      <span class="pbe-footer-sport__arrow" aria-hidden="true">↗</span>
    </a>`;
}

export function renderFooter() {
  const year = new Date().getFullYear();

  return `
    <footer class="footer pbe-network-footer">
      <div class="container pbe-network-footer__inner">
        <section class="pbe-footer-hero" aria-labelledby="pbe-footer-title">
          <div class="pbe-footer-hero__copy">
            <span class="pbe-footer-kicker"><i></i> THE PROPBETEDGE NETWORK</span>
            <h2 id="pbe-footer-title">One sports intelligence network.<br><em>Six live platforms.</em></h2>
            <p>Start with the story, move into the sport, and go as deep as you want. News, live context, research tools and the data infrastructure underneath it all.</p>
          </div>
          <div class="pbe-footer-hero__actions">
            <a class="pbe-footer-primary" href="/games">Live Scores <span>→</span></a>
            <a class="pbe-footer-secondary" href="/news">Latest News <span>→</span></a>
          </div>
        </section>

        <section class="pbe-footer-sports" aria-label="Live PropBetEdge sports platforms">
          ${SPORTS.map(sportCard).join('')}
        </section>

        <div class="pbe-footer-rule"></div>

        <section class="pbe-footer-main">
          <div class="pbe-footer-brand">
            <a class="pbe-footer-wordmark" href="/" aria-label="PropBetEdge home">
              <span class="pbe-footer-mark" aria-hidden="true">P</span>
              <span>PropBet<b>Edge</b></span>
            </a>
            <p>Sports news and betting-impact intelligence connected to purpose-built research platforms for every major sport we cover.</p>
            <div class="pbe-footer-infra">
              <span>DATA LAYER</span>
              <a href="${PROPBET_LINKS.propsports}" target="_blank" rel="noopener">Powered by PropSports API ↗</a>
            </div>
          </div>

          <nav class="pbe-footer-column" aria-label="Explore PropBetEdge">
            <span class="pbe-footer-column__label">EXPLORE</span>
            <a href="/news">All News</a>
            <a href="/games">Live Games</a>
            <a href="/leaders">Stat Leaders</a>
            <a href="/odds">Odds & Markets</a>
            <a href="/news/mlb">MLB News</a>
            <a href="/news/nfl">NFL News</a>
            <a href="/news/nba">NBA News</a>
            <a href="/news/nhl">NHL News</a>
          </nav>

          <nav class="pbe-footer-column" aria-label="Build and learn">
            <span class="pbe-footer-column__label">BUILD & LEARN</span>
            <a href="${PROPBET_LINKS.learn}" target="_blank" rel="noopener">Learn PropBetEdge ↗</a>
            <a href="${PROPBET_LINKS.propsports}" target="_blank" rel="noopener">PropSports API ↗</a>
            <a href="${PROPBET_LINKS.api_news}" target="_blank" rel="noopener">Sports News API ↗</a>
            <a href="https://ufc.proptechusa.ai" target="_blank" rel="noopener">UFC Data API ↗</a>
          </nav>

          <nav class="pbe-footer-column" aria-label="Trust and community">
            <span class="pbe-footer-column__label">TRUST & COMMUNITY</span>
            <a href="/editorial-standards">Editorial Standards</a>
            <a href="/authors/propbetedge-editorial-team">Editorial Team</a>
            <a href="${PROPBET_LINKS.discord}" target="_blank" rel="noopener">Discord Community ↗</a>
            <a href="${PROPBET_LINKS.twitter}" target="_blank" rel="noopener">X / Twitter ↗</a>
            <a href="${PROPBET_LINKS.linkedin}" target="_blank" rel="noopener">LinkedIn ↗</a>
            <a href="/news/rss.xml" target="_blank" rel="noopener">RSS Feed ↗</a>
          </nav>
        </section>

        <div class="pbe-footer-bottom">
          <div class="pbe-footer-legal">
            <b>Research tooling, not a guarantee.</b>
            <span>Entertainment purposes only · 21+ · Please gamble responsibly · Gambling Problem? Call 1-800-GAMBLER.</span>
          </div>
          <div class="pbe-footer-copyright">© ${year} PropBetEdge</div>
        </div>
      </div>
    </footer>
  `;
}
