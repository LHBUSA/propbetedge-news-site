// propbetedge.ai MAIN-SITE footer contract (owner 2026-10-04). A visual redesign must never delete a destination:
// this pins every established trust / legal / editorial / author / network / store link, the taxonomy, and no
// duplicates. (The compact "no individual authors" policy is for sport subdomains only, never this site.)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderFooter, STORE_URL } from '../src/components/footer.js';
import { PROPBET_LINKS } from '../src/ads-config.js';

const html = renderFooter({ cta: false });
const footer = html.slice(html.indexOf('<footer'), html.lastIndexOf('</footer>'));
const anchors = [...footer.matchAll(/<a\b[^>]*\bhref="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => ({ href: m[1], text: m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() }));
const hrefs = anchors.map((a) => a.href);
const css = fs.readFileSync(new URL('../src/styles/network-footer.css', import.meta.url), 'utf8');
const groupOf = (href) => { const at = footer.indexOf(`href="${href}"`); const h = [...footer.slice(0, at).matchAll(/<h4[^>]*>([^<]+)<\/h4>/g)].pop(); return h ? h[1] : null; };

test('main-site trust / legal / editorial inventory: every required link present and visibly labelled', () => {
  const required = {
    '/about': /About PropBetEdge/, '/terms': /Terms of Service/, '/legal': /Legal/, '/support': /Support/, '/media': /Media/,
    '/editorial-standards': /Editorial Standards/, '/authors': /Editorial Team/,
    '/authors/justin-erickson': /Justin Erickson/, '/authors/propbetedge-editorial-team': /PropBetEdge Editorial Team/,
    '/authors/ty-whitney': /Ty Whitney/, '/authors/erik-schwartz': /Erik Schwartz/,
    '/news': /Newsroom/, '/news/rss.xml': /RSS/,
  };
  for (const [href, label] of Object.entries(required)) {
    const a = anchors.find((x) => x.href === href);
    assert.ok(a, `missing ${href}`);
    assert.match(a.text, label, `${href} label`);
  }
  // Terms and Legal live in the Company directory, not only a faint legal rail.
  assert.equal(groupOf('/terms'), 'Company');
  assert.equal(groupOf('/legal'), 'Company');
});

test('Store is restored at the network storefront destination', () => {
  assert.equal(STORE_URL, 'https://ufc.propbetedge.ai/store');
  const a = anchors.find((x) => x.href === STORE_URL);
  assert.ok(a, 'Store link');
  assert.equal(a.text, 'Store');
  assert.equal(groupOf(STORE_URL), 'Network');
});

test('network / products come from the registry: All Access, Predictions (included with All Access), News, Learn, Store', () => {
  for (const href of ['/pro', 'https://predictions.propbetedge.ai/', '/', PROPBET_LINKS.learn, STORE_URL]) assert.equal(groupOf(href), 'Network', href);
  assert.match(footer, /PropBetEdge Predictions <span class="nf-tag">Included with All Access<\/span>/);
});

test('features are never presented as company "Products"', () => {
  assert.doesNotMatch(footer, /<h4[^>]*>\s*Products?\s*<\/h4>/i);
  for (const href of [PROPBET_LINKS.algo, PROPBET_LINKS.hr_targets, PROPBET_LINKS.k_props]) assert.equal(groupOf(href), 'Research', href);
  assert.ok(!hrefs.includes('/games') || groupOf('/games') !== 'Network', 'PBEcast is not a network product');
});

test('all ten sports, every established destination kept, no duplicate destinations', () => {
  const sports = [PROPBET_LINKS.picks_mlb, PROPBET_LINKS.picks_nfl, PROPBET_LINKS.picks_nba, 'https://wnba.propbetedge.ai', PROPBET_LINKS.picks_nhl, PROPBET_LINKS.picks_ufc, PROPBET_LINKS.tennis, PROPBET_LINKS.soccer, PROPBET_LINKS.golf, 'https://f1.propbetedge.ai/'];
  for (const s of sports) assert.equal(groupOf(s), 'Sports', s);
  // Everything the pre-redesign footer carried (ba06d50) is still here.
  const established = ['/pro', '/news', '/news/mlb', '/news/nfl', '/news/nba', '/news/nhl', '/news/rss.xml', '/about', '/terms', '/legal', '/support', '/media',
    '/authors', '/authors/justin-erickson', '/authors/propbetedge-editorial-team', '/authors/ty-whitney', '/authors/erik-schwartz', '/editorial-standards',
    PROPBET_LINKS.algo, PROPBET_LINKS.hr_targets, PROPBET_LINKS.k_props, PROPBET_LINKS.learn, PROPBET_LINKS.propsports, PROPBET_LINKS.api_news, 'https://ufc.proptechusa.ai',
    PROPBET_LINKS.discord, PROPBET_LINKS.linkedin, PROPBET_LINKS.twitter, 'https://billing.stripe.com/p/login/cNi3cv2vY7em3lr4oj7wA00', 'mailto:support@proptechusa.ai',
    'https://mother.proptechusa.ai/verify/xgH9unhpY6TDvTtmG8CsUWrq0O6M10TS', 'https://mother.proptechusa.ai/#badge', 'https://predictions.propbetedge.ai/', 'https://f1.propbetedge.ai/', '/'];
  for (const h of established) assert.ok(hrefs.includes(h), `dropped ${h}`);
  const dupes = hrefs.filter((h, i) => hrefs.indexOf(h) !== i);
  assert.deepEqual(dupes, [], 'each destination appears once');
});

test('visual contract: warm palette only (espresso/charcoal/parchment from main.css tokens), stepped surfaces, no new hue', () => {
  assert.match(css, /--nf-surface: rgba\(29, 25, 20, \.92\)/, 'espresso --ink-2');
  assert.match(css, /--nf-band: rgba\(42, 36, 28, \.9\)/, 'charcoal --ink-3');
  assert.doesNotMatch(css, /rgba\(27, 31, 40|#a9b0bd|rgba\(255, 255, 255/i, 'no navy/blue-grey or cold white');
  assert.doesNotMatch(css, /background: #0[0-9a-f]{5};/i, 'no near-black slab');
  assert.match(css, /--nf-text: var\(--paper-2\)/);
  assert.match(footer, /data-pbe-preferred-source data-surface="footer" data-sport="network"/);
  assert.match(footer, /<img src="https:\/\/api\.mother\.proptechusa\.ai\/badge\/[^"]+\.svg"[^>]*width="236" height="48"/);
  assert.match(footer, /Bet responsibly · 21\+ · Gambling Problem\? Call 1-800-GAMBLER/);
});

test('external links open safely; focus visible; no inline styles', () => {
  for (const m of footer.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) assert.match(m[0], /rel="noopener/, m[0]);
  assert.match(css, /\.nf a:focus-visible \{ outline: 2px solid var\(--gold\)/);
  assert.doesNotMatch(footer, /<style>|\sstyle="/);
});
