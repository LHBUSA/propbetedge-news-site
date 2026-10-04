/**
 * src/components/footer.js
 * propbetedge.ai MAIN-SITE footer: the canonical company + publication directory.
 *
 * Owner rules (2026-10-04, after the first redesign over-simplified it):
 *   - Visual cleanup never permits deleting established destinations or simplifying the network architecture.
 *     Every destination the footer has ever carried stays, as a plain crawlable <a>, grouped correctly.
 *   - propbetedge.ai exposes the FULL trust / legal / editorial / author / company inventory, including each
 *     named editorial identity. (Sport/product subdomains use the compact trust links instead; that rule does
 *     not apply here.)
 *   - Features and tools (PBEcast, Free Picks, Ask The Algo, HR Targets, K Props) are never labelled
 *     "Products". Network properties come from the canonical registry (src/network/family.json) plus Store.
 *   - No duplicate destinations: each href appears once.
 *   - Surface: layered navy/charcoal with readable contrast and restrained gold, never a black void.
 *
 * Family parity (2026-10-03): ten sports in registry order (F1 included), PropBetEdge Predictions outside the
 * sport list, All Access + Learn linked. Store = the network's live storefront (UFC registry NETWORK.store,
 * "the network's only live checkout today"; propbetedge.ai/store has not shipped).
 * Styles: src/styles/network-footer.css.
 */

import { ad_footer_banner, PROPBET_LINKS } from '../ads-config.js';
import { renderPreferredSource } from './preferred-source.js';
import { AUTHOR_PROFILES } from '../editorial/authors-registry.js';

export const STORE_URL = 'https://ufc.propbetedge.ai/store';

// Registry order (family.json). Visible label is the league; " Intelligence" stays in the accessible name.
export const FOOTER_SPORTS = [
  ['MLB', PROPBET_LINKS.picks_mlb],
  ['NFL', PROPBET_LINKS.picks_nfl],
  ['NBA', PROPBET_LINKS.picks_nba],
  ['WNBA', 'https://wnba.propbetedge.ai'],
  ['NHL', PROPBET_LINKS.picks_nhl],
  ['UFC', PROPBET_LINKS.picks_ufc],
  ['Tennis', PROPBET_LINKS.tennis],
  ['Soccer', PROPBET_LINKS.soccer],
  ['Golf', PROPBET_LINKS.golf],
  ['F1', 'https://f1.propbetedge.ai/'],
];

// Named editorial identities, in masthead order; names come from the canonical byline registry.
export const FOOTER_AUTHORS = ['justin-erickson', 'propbetedge-editorial-team', 'ty-whitney', 'erik-schwartz'];

const EXT = 'target="_blank" rel="noopener"';
const SVG = (d) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`;
const DISCORD_PATH = 'M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z';
const X_PATH = 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z';
const LINKEDIN_PATH = 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.063 2.063 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z';

const group = (title, items, cls = '') => `
            <div class="nf-group${cls ? ` ${cls}` : ''}">
              <h4>${title}</h4>
              <ul>${items.join('')}</ul>
            </div>`;
const li = (href, label, extra = '') => `<li><a href="${href}"${extra ? ` ${extra}` : ''}>${label}</a></li>`;

// cta=false: pages with their own closer (homepage brand closer, the article sport closer, trust/author pages) skip
// the generic network CTA; every other page keeps the default.
export function renderFooter({ cta = true } = {}) {
  const year = new Date().getFullYear();
  const sports = FOOTER_SPORTS.map(([label, href]) => `<li><a href="${href}" ${EXT}>${label}<span class="nf-sr"> Intelligence</span></a></li>`).join('');
  const authors = FOOTER_AUTHORS.map((slug) => li(`/authors/${slug}`, AUTHOR_PROFILES[slug].name));
  return `
    ${cta ? ad_footer_banner() : ''}

    <footer class="footer nf">
      <div class="container nf-wrap">
        <div class="nf-band">
          <img src="/logo/pbe-full-200.png" srcset="/logo/pbe-full-200.png 1x, /logo/pbe-full-400.png 2x" alt="PropBetEdge" class="nf-logo" width="358" height="200" loading="lazy" decoding="async" />
          <p class="nf-statement">Sports intelligence built from live data, models and permanent records.</p>
          <div class="nf-social">
            <a href="${PROPBET_LINKS.discord}" class="nf-social-link" target="_blank" rel="noopener" aria-label="Discord">${SVG(DISCORD_PATH)}</a>
            <a href="${PROPBET_LINKS.twitter}" class="nf-social-link" target="_blank" rel="noopener noreferrer" aria-label="Follow PropBetEdge on X (@PROPBETEDGE)" title="Follow PropBetEdge on X">${SVG(X_PATH)}</a>
            <a href="${PROPBET_LINKS.linkedin}" class="nf-social-link" target="_blank" rel="noopener" aria-label="LinkedIn">${SVG(LINKEDIN_PATH)}</a>
          </div>
        </div>

        <nav class="nf-nav" aria-label="PropBetEdge network">
            <div class="nf-group nf-group--sports">
              <h4>Sports</h4>
              <ul class="nf-sports">${sports}</ul>
            </div>
${group('Network', [
    `<li><a href="/pro" class="nf-feature"><strong>All Access</strong> <span class="nf-price">$29/mo</span></a></li>`,
    `<li><a href="https://predictions.propbetedge.ai/" ${EXT}>PropBetEdge Predictions <span class="nf-tag">Included with All Access</span></a></li>`,
    li('/', 'PropBetEdge News'),
    li(PROPBET_LINKS.learn, 'Learn PropBetEdge', EXT),
    li(STORE_URL, 'Store', EXT),
  ])}
${group('News', [
    li('/news', 'Newsroom'),
    li('/news/mlb', 'MLB News'),
    li('/news/nfl', 'NFL News'),
    li('/news/nba', 'NBA News'),
    li('/news/nhl', 'NHL News'),
    li('/news/rss.xml', 'RSS Feed', EXT),
  ])}
${group('Editorial', [
    li('/authors', '<strong>Editorial Team</strong>'),
    ...authors,
    li('/editorial-standards', 'Editorial Standards'),
  ])}
${group('Company', [
    li('/about', 'About PropBetEdge'),
    li('/terms', 'Terms of Service'),
    li('/legal', 'Legal'),
    li('/support', 'Support'),
    li('/media', 'Media'),
    li('https://billing.stripe.com/p/login/cNi3cv2vY7em3lr4oj7wA00', 'Manage Subscription', 'target="_blank" rel="noopener noreferrer"'),
    li('mailto:support@proptechusa.ai', 'Contact'),
  ])}
${group('Research', [
    li(PROPBET_LINKS.algo, 'Ask The Algo', EXT),
    li(PROPBET_LINKS.hr_targets, 'HR Targets', EXT),
    li(PROPBET_LINKS.k_props, 'K Props', EXT),
  ])}
${group('Builders', [
    li(PROPBET_LINKS.propsports, 'PropSports API', EXT),
    li(PROPBET_LINKS.api_news, 'Sports News API', EXT),
    li('https://ufc.proptechusa.ai', 'UFC Data API', EXT),
  ])}
        </nav>

        <div class="nf-trust">
          <span class="nf-trust-label">Trust &amp; Discovery</span>
          ${renderPreferredSource({ surface: 'footer', compact: true })}
          <a class="nf-mother" href="https://mother.proptechusa.ai/verify/xgH9unhpY6TDvTtmG8CsUWrq0O6M10TS" target="_blank" rel="noopener noreferrer" aria-label="Verify PropTechUSA.ai Mother AI protection status (opens in a new tab)">
            <img src="https://api.mother.proptechusa.ai/badge/xgH9unhpY6TDvTtmG8CsUWrq0O6M10TS.svg" alt="Mother AI Protected — live verification for PropTechUSA.ai" width="236" height="48" loading="lazy" decoding="async" />
          </a>
          <span class="nf-trust-note">Part of the PropTechUSA.ai network · <a href="https://mother.proptechusa.ai/#badge" target="_blank" rel="noopener noreferrer">Get Mother AI Protected</a></span>
        </div>

        <div class="nf-rail">
          <p class="footer-legal nf-legal">© ${year} PropBetEdge · Entertainment purposes only · Bet responsibly · 21+ · Gambling Problem? Call 1-800-GAMBLER</p>
        </div>
      </div>
    </footer>
  `;
}
