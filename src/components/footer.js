/**
 * src/components/footer.js
 * propbetedge.ai MAIN-SITE footer. Its job is to sell the network (owner 2026-10-04):
 *   1. a ten-sport intelligence network        (Sports — family registry)
 *   2. All Access = the whole network + Predictions (Network — family registry + Store, strongest hierarchy)
 *   3. every sport has its own newsroom        (Newsrooms — INTELLIGENCE_SPORTS.newsPath)
 *   4. real research behind the products       (Research — src/research/registry.js)
 *   5. a data platform developers can build on (Developers — src/network/public-apis.js, public APIs only)
 *   6. a real editorial organization + trust/legal layer (compact rows; every link kept)
 *
 * Rules: render the canonical registries, never another hand-made list. A redesign never deletes an established
 * destination. Features (PBEcast, HR Targets, K Props, Ask The Algo...) are never "Products" and MLB tools do
 * not sit under global Research. The full trust/editorial/author inventory belongs on this site (the compact
 * "no individual authors" policy is for sport subdomains only). Each directory destination appears once; the
 * brand band intentionally repeats the three network-level paths: All Access, APIs and Research.
 * Warm palette only. Styles: src/styles/network-footer.css.
 */

import { PROPBET_LINKS } from '../ads-config.js';
import { renderPreferredSource } from './preferred-source.js';
import { AUTHOR_PROFILES } from '../editorial/authors-registry.js';
import { INTELLIGENCE_SPORTS, INTELLIGENCE_ORDER } from '../intelligence-cta.js';
import { RESEARCH_PAGES } from '../research/registry.js';
import { PUBLIC_APIS, API_DOCS_URL } from '../network/public-apis.js';
import FAMILY from '../network/family.js';

// The network's only live storefront is the UFC store (LHBUSA/UFC web/lib/network.ts NETWORK.store). It is labelled
// "UFC Store" (owner 2026-10-04): a bare "Store" on the main site would imply a PropBetEdge network store, which
// does not exist yet. Never add a placeholder /store route; relabel when a real network storefront ships.
export const STORE_URL = 'https://ufc.propbetedge.ai/store';

// Named editorial identities, in masthead order; names come from the canonical byline registry.
export const FOOTER_AUTHORS = ['justin-erickson', 'propbetedge-editorial-team', 'ty-whitney', 'erik-schwartz'];

const EXT = 'target="_blank" rel="noopener"';
const isExt = (href) => /^https?:\/\//.test(href) && !href.startsWith('https://propbetedge.ai/');
const a = (href, label, extra = '') => `<a href="${href}"${isExt(href) ? ` ${EXT}` : ''}${extra ? ` ${extra}` : ''}>${label}</a>`;
const SVG = (d) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`;
const DISCORD_PATH = 'M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z';
const X_PATH = 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z';
const LINKEDIN_PATH = 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.063 2.063 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z';

const predictions = FAMILY.products.find((p) => p.key === 'predictions');
const learn = FAMILY.network.find((n) => n.key === 'learn');

// Canonical network footer. The retired generic pre-footer sales billboard is gone sitewide.
export function renderFooter() {
  const year = new Date().getFullYear();
  const sports = FAMILY.sports.map((s) => `<li>${a(s.url, `${s.label}<span class="nf-sr"> Intelligence</span>`)}</li>`).join('');
  const newsrooms = INTELLIGENCE_ORDER.map((k) => INTELLIGENCE_SPORTS[k]).map((s) => `<li>${a(s.newsPath, `${s.label} News`)}</li>`).join('');
  const research = RESEARCH_PAGES.map((p) => `<li>${a(p.path, p.label)}</li>`).join('');
  const apis = PUBLIC_APIS.map((p) => `<li>${a(p.href, p.footerLabel)}</li>`).join('');
  const authors = FOOTER_AUTHORS.map((slug) => a(`/authors/${slug}`, AUTHOR_PROFILES[slug].name)).join('');
  return `

    <footer class="footer nf">
      <div class="container nf-wrap">
        <div class="nf-band">
          <div class="nf-band-brand">
            <img src="/logo/pbe-full-200.png" srcset="/logo/pbe-full-200.png 1x, /logo/pbe-full-400.png 2x" alt="PropBetEdge" class="nf-logo" width="358" height="200" loading="lazy" decoding="async" />
            <p class="nf-statement">Sports intelligence built from live data, models and permanent records.</p>
          </div>
          <div class="nf-band-actions">
            <a href="/pro" class="nf-action nf-action--primary">Explore All Access</a>
            <a href="/developers" class="nf-action">Explore APIs</a>
            <a href="/research" class="nf-action">Explore Research</a>
          </div>
          <div class="nf-social">
            <a href="${PROPBET_LINKS.discord}" class="nf-social-link" target="_blank" rel="noopener" aria-label="Discord">${SVG(DISCORD_PATH)}</a>
            <a href="${PROPBET_LINKS.twitter}" class="nf-social-link" target="_blank" rel="noopener noreferrer" aria-label="Follow PropBetEdge on X (@PROPBETEDGE)" title="Follow PropBetEdge on X">${SVG(X_PATH)}</a>
            <a href="${PROPBET_LINKS.linkedin}" class="nf-social-link" target="_blank" rel="noopener" aria-label="LinkedIn">${SVG(LINKEDIN_PATH)}</a>
          </div>
        </div>

        <nav class="nf-grid" aria-label="PropBetEdge network">
          <section class="nf-col nf-col--network">
            <h4>Network</h4>
            <a href="/pro" class="nf-hero-link"><span class="nf-hero-name">All Access</span><span class="nf-hero-price">$29/mo</span><span class="nf-hero-note">All ten sports + PropBetEdge Predictions</span></a>
            <a href="${predictions.url}" ${EXT} class="nf-hero-link nf-hero-link--sub"><span class="nf-hero-name">${predictions.name}</span><span class="nf-tag">Included with All Access</span></a>
            <ul>
              <li>${a('/', 'PropBetEdge News')}</li>
              <li>${a(learn.url, learn.name)}</li>
              <li>${a(STORE_URL, 'UFC Store', 'data-nf-dup="band"')}</li>
            </ul>
          </section>

          <section class="nf-col">
            <h4>Sports</h4>
            <ul class="nf-pairs">${sports}</ul>
          </section>

          <section class="nf-col">
            <h4>Newsrooms</h4>
            <ul class="nf-pairs">
              <li class="nf-span">${a('/news', '<strong>All Sports News</strong>')}</li>
              ${newsrooms}
              <li class="nf-span">${a('/news/rss.xml', 'RSS Feed', EXT)}</li>
            </ul>
          </section>

          <section class="nf-col">
            <h4>Research</h4>
            <ul>${research}</ul>
            <h4 class="nf-subhead">Developers</h4>
            <ul>
              ${apis}
              <li>${a(API_DOCS_URL, 'API Documentation')}</li>
              <li>${a('/developers', '<strong>Explore all APIs →</strong>', 'data-nf-dup="band"')}</li>
            </ul>
          </section>
        </nav>

        <div class="nf-rows">
          <div class="nf-row nf-row--editorial">
            <h4>Editorial &amp; Trust</h4>
            <div class="nf-row-primary">${a('/authors', '<strong>Editorial Team</strong>')}${a('/editorial-standards', '<strong>Editorial Standards</strong>')}</div>
            <p class="nf-row-secondary">${authors}</p>
          </div>
          <div class="nf-row">
            <h4>Company &amp; Legal</h4>
            <p>${a('/about', 'About PropBetEdge')}${a('/privacy', 'Privacy Policy')}${a('/terms', 'Terms of Service')}${a('/legal', 'Legal')}${a('/support', 'Support')}${a('/media', 'Media')}${a('https://billing.stripe.com/p/login/cNi3cv2vY7em3lr4oj7wA00', 'Manage Subscription', 'target="_blank" rel="noopener noreferrer"')}${a('mailto:support@proptechusa.ai', 'Contact')}</p>
          </div>
        </div>

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
