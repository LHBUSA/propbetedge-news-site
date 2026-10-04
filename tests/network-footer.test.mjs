// Network footer (2026-10-04 redesign): pins DESTINATIONS and hierarchy rules, never the visual grid.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderFooter } from '../src/components/footer.js';
import { PROPBET_LINKS } from '../src/ads-config.js';

const html = renderFooter({ cta: false });
const footer = html.slice(html.indexOf('<footer'), html.lastIndexOf('</footer>'));
const hrefs = [...footer.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)].map((m) => m[1]);
const css = fs.readFileSync(new URL('../src/styles/network-footer.css', import.meta.url), 'utf8');

test('every essential destination is a plain crawlable link in the footer HTML', () => {
  const required = [
    '/', '/pro', '/games', '/odds', '/about', '/news', '/authors', '/editorial-standards', '/media', '/support', '/terms', '/legal', '/news/rss.xml',
    'https://predictions.propbetedge.ai/', 'https://f1.propbetedge.ai/', 'https://wnba.propbetedge.ai', 'https://ufc.proptechusa.ai',
    PROPBET_LINKS.picks_mlb, PROPBET_LINKS.picks_nfl, PROPBET_LINKS.picks_nba, PROPBET_LINKS.picks_nhl, PROPBET_LINKS.picks_ufc,
    PROPBET_LINKS.tennis, PROPBET_LINKS.soccer, PROPBET_LINKS.golf, PROPBET_LINKS.algo, PROPBET_LINKS.hr_targets, PROPBET_LINKS.k_props,
    PROPBET_LINKS.learn, PROPBET_LINKS.propsports, PROPBET_LINKS.api_news, PROPBET_LINKS.discord, PROPBET_LINKS.twitter, PROPBET_LINKS.linkedin,
    'https://billing.stripe.com/p/login/cNi3cv2vY7em3lr4oj7wA00', 'mailto:support@proptechusa.ai',
    'https://mother.proptechusa.ai/verify/xgH9unhpY6TDvTtmG8CsUWrq0O6M10TS', 'https://mother.proptechusa.ai/#badge',
    'https://www.google.com/preferences/source?q=propbetedge.ai',
  ];
  for (const h of required) assert.ok(hrefs.includes(h), `missing ${h}`);
});

test('hierarchy: five directions (brand + Sports/Intelligence, Products, Company, Builders), no individual authors', () => {
  assert.deepEqual([...footer.matchAll(/<h4[^>]*>([^<]+)<\/h4>/g)].map((m) => m[1]), ['Sports', 'Intelligence', 'Products', 'Company', 'Builders']);
  assert.equal(hrefs.filter((h) => /^\/authors\/./.test(h)).length, 0, 'people live on /authors, not in global navigation');
  assert.match(footer, /Sports intelligence built from live data, models and permanent records\./);
  assert.match(footer, /class="nf-cta">Explore All Access</);
  assert.doesNotMatch(footer, /footer-badge/, 'no badge on every link');
});

test('trust strip: preferred source keeps the delegated handler + footer analytics surface; Mother badge never sets footer height', () => {
  assert.match(footer, /data-pbe-preferred-source data-surface="footer" data-sport="network"/);
  assert.match(footer, /<img src="https:\/\/api\.mother\.proptechusa\.ai\/badge\/[^"]+\.svg"[^>]*width="236" height="48"/, 'intrinsic size kept: no CLS');
  assert.match(css, /\.nf-mother img \{[^}]*width: 148px;[^}]*aspect-ratio: 236 \/ 48;/);
  assert.match(footer, /class="nf-trust"[\s\S]*class="nf-rail"/, 'trust strip sits above the legal rail');
});

test('utility rail: terms, legal, subscription, contact, RSS and the responsible-gambling line', () => {
  const rail = footer.slice(footer.indexOf('class="nf-rail"'));
  for (const h of ['/terms', '/legal', 'https://billing.stripe.com/p/login/cNi3cv2vY7em3lr4oj7wA00', 'mailto:support@proptechusa.ai', '/news/rss.xml']) assert.ok(rail.includes(`href="${h}"`), h);
  assert.match(rail, /Bet responsibly · 21\+ · Gambling Problem\? Call 1-800-GAMBLER/);
});

test('external links open safely; keyboard focus is visible; styles are scoped and respect reduced motion', () => {
  for (const m of footer.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) assert.match(m[0], /rel="noopener/, m[0]);
  assert.match(css, /\.nf a:focus-visible \{ outline: 2px solid var\(--gold\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8'), /import '\.\/styles\/network-footer\.css';/);
  assert.doesNotMatch(footer, /<style>|\sstyle="/, 'no inline styles in the footer');
});
