// propbetedge.ai MAIN-SITE footer contract (owner 2026-10-04). The footer sells the network and renders the
// canonical registries; a redesign never deletes an established trust/legal/editorial destination.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderFooter, STORE_URL } from '../src/components/footer.js';
import { PROPBET_LINKS } from '../src/ads-config.js';
import { INTELLIGENCE_SPORTS, INTELLIGENCE_ORDER } from '../src/intelligence-cta.js';
import { RESEARCH_PAGES } from '../src/research/registry.js';
import { PUBLIC_APIS, API_DOCS_URL } from '../src/network/public-apis.js';

const FAMILY = JSON.parse(fs.readFileSync(new URL('../src/network/family.json', import.meta.url), 'utf8'));
const html = renderFooter({ cta: false });
const footer = html.slice(html.indexOf('<footer'), html.lastIndexOf('</footer>'));
const band = footer.slice(footer.indexOf('class="nf-band"'), footer.indexOf('class="nf-grid"'));
const directory = footer.slice(footer.indexOf('class="nf-grid"'));
const anchors = (s) => [...s.matchAll(/<a\b[^>]*\bhref="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => ({ href: m[1], text: m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() }));
const all = anchors(footer);
const hrefs = all.map((x) => x.href);
const dirHrefs = anchors(directory).map((x) => x.href);
const css = fs.readFileSync(new URL('../src/styles/network-footer.css', import.meta.url), 'utf8');
const groupOf = (href) => { const at = footer.indexOf(`href="${href}"`, footer.indexOf('class="nf-grid"')); const h = [...footer.slice(0, at).matchAll(/<h4[^>]*>([^<]+)<\/h4>/g)].pop(); return h ? h[1].replace(/&amp;/g, '&') : null; };

test('main-site trust / legal / editorial inventory: every required link present and labelled', () => {
  const required = {
    '/about': /About PropBetEdge/, '/privacy': /Privacy Policy/, '/terms': /Terms of Service/, '/legal': /Legal/, '/support': /Support/, '/media': /Media/,
    '/editorial-standards': /Editorial Standards/, '/authors': /Editorial Team/,
    '/authors/justin-erickson': /Justin Erickson/, '/authors/propbetedge-editorial-team': /PropBetEdge Editorial Team/,
    '/authors/ty-whitney': /Ty Whitney/, '/authors/erik-schwartz': /Erik Schwartz/,
    '/news': /All Sports News/, '/news/rss.xml': /RSS/,
    'https://billing.stripe.com/p/login/cNi3cv2vY7em3lr4oj7wA00': /Manage Subscription/, 'mailto:support@proptechusa.ai': /Contact/,
  };
  for (const [href, label] of Object.entries(required)) {
    const x = all.find((y) => y.href === href);
    assert.ok(x, `missing ${href}`);
    assert.match(x.text, label, href);
  }
  for (const h of ['/privacy', '/terms', '/legal', '/support', '/media', '/about']) assert.equal(groupOf(h), 'Company & Legal', h);
  for (const h of ['/authors', '/authors/justin-erickson', '/editorial-standards']) assert.equal(groupOf(h), 'Editorial & Trust', h);
});

test('commercial band: Explore All Access, Explore APIs, Explore Research', () => {
  const b = anchors(band);
  assert.deepEqual(b.filter((x) => /nf-action/.test(band.slice(band.indexOf(`href="${x.href}"`) - 40, band.indexOf(`href="${x.href}"`) + 60)) || true).map((x) => x.href).slice(0, 3), ['/pro', '/developers', '/research']);
  assert.match(band, /class="nf-action nf-action--primary">Explore All Access</);
});

test('Network renders the registry (All Access + Predictions prominent, News, Learn, Store)', () => {
  const pred = FAMILY.products.find((p) => p.key === 'predictions');
  const learn = FAMILY.network.find((n) => n.key === 'learn');
  for (const h of ['/pro', pred.url, '/', learn.url, STORE_URL]) assert.equal(groupOf(h), 'Network', h);
  assert.match(directory, /class="nf-hero-name">All Access<\/span><span class="nf-hero-price">\$29\/mo/);
  assert.match(directory, /PropBetEdge Predictions<\/span><span class="nf-tag">Included with All Access<\/span>/);
  assert.equal(STORE_URL, 'https://ufc.propbetedge.ai/store');
  // The destination is the UFC storefront, so the label says so; a bare "Store" would imply a network store.
  const storeLinks = all.filter((x) => x.href === STORE_URL);
  assert.ok(storeLinks.length >= 1);
  for (const x of storeLinks) assert.equal(x.text, 'UFC Store');
  assert.ok(!all.some((x) => x.text === 'Store'), 'no bare "Store" label');
  assert.ok(!all.some((x) => /^\/store/.test(x.href)), 'no placeholder /store route');
});

test('Sports render family.json; Newsrooms render INTELLIGENCE_SPORTS.newsPath for all ten sports', () => {
  for (const s of FAMILY.sports) assert.equal(groupOf(s.url), 'Sports', s.key);
  for (const k of INTELLIGENCE_ORDER) {
    const s = INTELLIGENCE_SPORTS[k];
    const x = all.find((y) => y.href === s.newsPath);
    assert.ok(x, `newsroom ${k}`);
    assert.equal(x.text, `${s.label} News`);
    assert.equal(groupOf(s.newsPath), 'Newsrooms', k);
  }
  assert.equal(INTELLIGENCE_ORDER.length, 10);
});

test('Research renders the research registry; MLB tools never sit under global Research; no "Products"', () => {
  for (const p of RESEARCH_PAGES) assert.equal(groupOf(p.path), 'Research', p.path);
  for (const h of [PROPBET_LINKS.algo, PROPBET_LINKS.hr_targets, PROPBET_LINKS.k_props]) assert.ok(!hrefs.includes(h), `MLB feature in footer: ${h}`);
  assert.doesNotMatch(footer, /<h4[^>]*>\s*Products?\s*<\/h4>/i);
});

test('Developers render the public-API catalog only, plus docs and the full catalog page', () => {
  for (const api of PUBLIC_APIS) assert.equal(groupOf(api.href), 'Developers', api.key);
  assert.equal(groupOf(API_DOCS_URL), 'Developers');
  assert.ok(dirHrefs.includes('/developers'));
  assert.ok(!/workers\.dev/.test(footer), 'no internal Worker hosts');
});

test('no duplicate directory destinations (only the band repeats All Access, APIs, Research)', () => {
  const dupes = dirHrefs.filter((h, i) => dirHrefs.indexOf(h) !== i);
  assert.deepEqual(dupes, []);
  const bandOnly = anchors(band).map((x) => x.href).filter((h) => !/discord|x\.com|twitter|linkedin/.test(h));
  assert.deepEqual(bandOnly, ['/pro', '/developers', '/research']);
});

test('warm palette only; preferred source + Mother badge kept; legal line; focus visible; no inline styles', () => {
  assert.match(css, /--nf-surface: rgba\(29, 25, 20, \.74\)/, 'translucent espresso --ink-2 glass');
  assert.match(css, /--nf-surface-solid: rgba\(29, 25, 20, \.95\)/, 'opaque fallback');
  assert.match(css, /@supports \(\(backdrop-filter: blur\(1px\)\) or \(-webkit-backdrop-filter: blur\(1px\)\)\)/, 'glass only where supported');
  assert.match(css, /-webkit-backdrop-filter: blur\(20px\) saturate\(120%\);\s+backdrop-filter: blur\(20px\) saturate\(120%\)/);
  assert.match(css, /--nf-band: rgba\(42, 36, 28, \.55\)/, 'charcoal --ink-3');
  assert.doesNotMatch(css, /rgba\(27, 31, 40|#a9b0bd|rgba\(255, 255, 255/i, 'no navy/blue-grey or cold white');
  assert.match(footer, /data-pbe-preferred-source data-surface="footer" data-sport="network"/);
  assert.match(footer, /<img src="https:\/\/api\.mother\.proptechusa\.ai\/badge\/[^"]+\.svg"[^>]*width="236" height="48"/);
  assert.match(footer, /Bet responsibly · 21\+ · Gambling Problem\? Call 1-800-GAMBLER/);
  for (const m of footer.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) assert.match(m[0], /rel="noopener/, m[0]);
  assert.match(css, /\.nf a:focus-visible \{ outline: 2px solid var\(--gold\)/);
  assert.doesNotMatch(footer, /<style>|\sstyle="/);
});


test('footer layout: balanced directory, responsive hierarchy, dividers and readable legal line', () => {
  assert.match(footer, /class="nf-row nf-row--editorial"/);
  assert.match(footer, /class="nf-row-primary"[^>]*>[\s\S]*Editorial Team[\s\S]*Editorial Standards/);
  assert.match(footer, /class="nf-row-secondary"/);
  assert.match(css, /\.nf-logo \{[^}]*height: 52px/);
  assert.match(css, /\.nf-rows::before/);
  assert.match(css, /\.nf-row \+ \.nf-row \{[^}]*border-left:/);
  assert.match(css, /\.nf-trust::before/);
  assert.match(css, /\.nf \.nf-legal \{[^}]*font-size: 11\.5px/);
  assert.match(footer, /class="nf-col nf-col--sports"/);
  assert.match(footer, /class="nf-col nf-col--newsrooms"/);
  assert.match(footer, /class="nf-col nf-col--research"/);
  assert.match(footer, /class="nf-col nf-col--developers"/);
  assert.match(css, /grid-template-columns: minmax\(210px, 1\.18fr\) minmax\(120px, \.62fr\) minmax\(190px, 1fr\) minmax\(180px, \.92fr\) minmax\(180px, \.92fr\)/);
  assert.match(css, /@media \(max-width: 560px\)[\s\S]*\.nf-band-actions \{ display: grid; grid-template-columns: 1fr 1fr;/);
  assert.match(css, /@media \(max-width: 560px\)[\s\S]*\.nf-col--sports ul, \.nf-col--newsrooms ul, \.nf-col--research ul, \.nf-col--developers ul \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
});
