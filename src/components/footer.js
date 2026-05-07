/**
 * src/components/footer.js
 * Editorial footer with sport-picks CTA + 4-column conversion grid + social
 */

import { ad_footer_banner, PROPBET_LINKS } from '../ads-config.js';

export function renderFooter() {
  const year = new Date().getFullYear();
  return `
    ${ad_footer_banner()}

    <footer class="footer">
      <div class="container">
        <div class="footer-grid">

          <div class="footer-col">
            <h4>⚡ Picks</h4>
            <a href="${PROPBET_LINKS.picks_mlb}" target="_blank" rel="noopener">MLB Picks <span class="footer-badge">Tonight</span></a>
            <a href="${PROPBET_LINKS.picks_nfl}" target="_blank" rel="noopener">NFL Picks</a>
            <a href="${PROPBET_LINKS.picks_nba}" target="_blank" rel="noopener">NBA Picks</a>
            <a href="${PROPBET_LINKS.picks_nhl}" target="_blank" rel="noopener">NHL Picks</a>
          </div>

          <div class="footer-col">
            <h4>🧠 Intelligence</h4>
            <a href="${PROPBET_LINKS.algo}" target="_blank" rel="noopener">Ask The Algo</a>
            <a href="${PROPBET_LINKS.hr_targets}" target="_blank" rel="noopener">HR Targets</a>
            <a href="${PROPBET_LINKS.k_props}" target="_blank" rel="noopener">K Props</a>
            <a href="${PROPBET_LINKS.learn}" target="_blank" rel="noopener">Learn <span class="footer-badge-soft">New</span></a>
          </div>

          <div class="footer-col">
            <h4>📰 News</h4>
            <a href="/news">All News</a>
            <a href="/news/mlb">MLB News</a>
            <a href="/news/nfl">NFL News</a>
            <a href="/news/nba">NBA News</a>
            <a href="/news/nhl">NHL News</a>
            <a href="/news/rss.xml" target="_blank">RSS Feed</a>
          </div>

          <div class="footer-col">
            <h4>✍️ Editorial</h4>
            <a href="/authors/justin-erickson">Justin Erickson</a>
            <a href="/authors/donneal-green">Donneal Green</a>
            <a href="/authors/eric-esters">Eric Esters</a>
            <a href="/authors/erik-schwartz">Erik Schwartz</a>
            <a href="/authors/propbetedge-editorial-team">Editorial Team</a>
            <a href="/editorial-standards">Editorial Standards</a>
          </div>

          <div class="footer-col">
            <h4>💬 Community</h4>
            <a href="${PROPBET_LINKS.discord}" target="_blank" rel="noopener">
              <span class="footer-icon">𝕯</span> Discord
              <span class="footer-badge-discord">Live</span>
            </a>
            <a href="${PROPBET_LINKS.twitter}" target="_blank" rel="noopener">
              <span class="footer-icon">𝕏</span> X / Twitter
            </a>
            <a href="${PROPBET_LINKS.reddit}" target="_blank" rel="noopener">
              <span class="footer-icon">ℝ</span> r/PropBetEdge
            </a>
            <a href="${PROPBET_LINKS.linkedin}" target="_blank" rel="noopener">
              <span class="footer-icon">in</span> LinkedIn
            </a>
          </div>

        </div>

        <div class="footer-social-bar">
          <span class="footer-social-label">Follow PropBetEdge</span>
          <a href="${PROPBET_LINKS.discord}" class="footer-social-link" target="_blank" rel="noopener" aria-label="Discord">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
          </a>
          <a href="${PROPBET_LINKS.twitter}" class="footer-social-link" target="_blank" rel="noopener" aria-label="X / Twitter">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          </a>
          <a href="${PROPBET_LINKS.reddit}" class="footer-social-link" target="_blank" rel="noopener" aria-label="Reddit">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm6.67 14.43a3.27 3.27 0 0 1-.04.5c0 3.06-3.56 5.55-7.94 5.55s-7.94-2.49-7.94-5.55c0-.17-.01-.34-.04-.5a2.13 2.13 0 1 1 2.36-3.5 9.74 9.74 0 0 1 5.32-1.69l.99-4.69a.5.5 0 0 1 .59-.39l3.26.69a1.5 1.5 0 1 1-.21 1l-2.92-.62-.88 4.18a9.7 9.7 0 0 1 5.27 1.69 2.13 2.13 0 1 1 2.18 3.33zM7.6 13.13a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0zm8.32 4.16a.5.5 0 0 1 0 .71 5.36 5.36 0 0 1-3.92 1.41 5.36 5.36 0 0 1-3.92-1.41.5.5 0 0 1 .71-.71 4.34 4.34 0 0 0 3.21 1.12 4.34 4.34 0 0 0 3.21-1.12.5.5 0 0 1 .71 0zm-2.4-2.66a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0z"/></svg>
          </a>
          <a href="${PROPBET_LINKS.linkedin}" class="footer-social-link" target="_blank" rel="noopener" aria-label="LinkedIn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.063 2.063 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
          </a>
        </div>

        <div class="footer-bottom">
          <a href="/" aria-label="PropBetEdge home">
            <img
              src="/logo/pbe-full-200.png"
              srcset="/logo/pbe-full-200.png 1x, /logo/pbe-full-400.png 2x"
              alt="PropBetEdge"
              class="footer-logo"
              width="358" height="200"
            />
          </a>
          <span class="footer-legal">© ${year} PropBetEdge · Entertainment purposes only · Bet responsibly · 21+ · Gambling Problem? Call 1-800-GAMBLER</span>
        </div>
      </div>
    </footer>
  `;
}
