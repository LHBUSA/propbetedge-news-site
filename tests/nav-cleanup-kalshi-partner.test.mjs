// Owner 2026-10-07: (A) global nav cleanup — at most 3 persistent chrome layers, ONE News control, ONE
// sport/intelligence selector, no Free Picks bar above the masthead; (B) Kalshi PERPETUALS partner line, low-key:
// homepage = foot of Market Pulse, articles = one row after body/Preferred Source, before Related Coverage.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {
  KALSHI_PARTNER_CLIENT_SHA256, PARTNER_CONFIG_URL, HOME_PARTNER_CONTEXT, articlePartnerContext, articlePartnerSlot,
  partnerOfferHtml, mountPartnerOffer,
} from '../src/kalshi-partner-offer.js';
import { PARTNER_DISABLED, PARTNER_GENERIC_CTA, PARTNER_DISCLOSURE, PARTNER_REL, normalizeConfig } from '../src/vendor/kalshi/kalshi-partner.js';
import { renderMarketPulseLaunch } from '../src/market-pulse-launch.js';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
// git autocrlf may rewrite line endings in a working copy; the committed bytes are LF, so hash LF.
const sha = (txt) => crypto.createHash('sha256').update(txt.replace(/\r\n/g, '\n')).digest('hex');
const CANONICAL = 'D:/Workers/propbetedge-workers/workers/propsports-markets/client/kalshi-partner.js';

// Test-only fixtures shaped like the Worker's kalshi-partner/2 answer (values are never shipped in src/).
const VERIFIED = { contract: 'kalshi-partner/2', enabled: true, path: '/go/kalshi-perps', program: 'perpetuals', offer: { program: 'perpetuals', qualifying_volume: '$75', user_discount: '15%', user_discount_term: '2 months', pbe_revenue_share: '20%', pbe_revenue_term: '2 years' } };
const STALE = { contract: 'kalshi-partner/2', enabled: true, path: '/go/kalshi-perps', program: 'perpetuals', offer_state: 'stale', offer: null };
const KILLED = { contract: 'kalshi-partner/2', enabled: false };

test('vendored kalshi-partner.js is byte-identical to the pinned canonical client', () => {
  assert.equal(sha(read('src/vendor/kalshi/kalshi-partner.js')), KALSHI_PARTNER_CLIENT_SHA256);
  if (fs.existsSync(CANONICAL)) {
    assert.equal(sha(fs.readFileSync(CANONICAL, 'utf8')), KALSHI_PARTNER_CLIENT_SHA256, 'canonical moved: re-vendor + re-pin');
  }
});

test('kill switch: disabled / failed / malformed config renders nothing', () => {
  for (const cfg of [PARTNER_DISABLED, normalizeConfig(KILLED), normalizeConfig(null), normalizeConfig({ ...VERIFIED, path: 'https://evil.example/x' })]) {
    assert.equal(partnerOfferHtml(cfg, HOME_PARTNER_CONTEXT), '');
  }
});

test('stale / unverified terms render the generic copy, never numbers', () => {
  const html = partnerOfferHtml(normalizeConfig(STALE), HOME_PARTNER_CONTEXT);
  assert.match(html, new RegExp(PARTNER_GENERIC_CTA));
  assert.doesNotMatch(html, /\$\d|\d%|month|year/i);
  assert.match(html, /kxo--generic/);
});

test('verified offer: short variant, first-party link, sponsored rel, disclosure, attribution keys', () => {
  const home = partnerOfferHtml(normalizeConfig(VERIFIED), HOME_PARTNER_CONTEXT);
  assert.match(home, /kxo--short/);
  assert.match(home, /href="\/go\/kalshi-perps\?placement=propbetedge_home_market_pulse&amp;product=propbetedge"/);
  assert.match(home, new RegExp(`rel="${PARTNER_REL}"`));
  assert.ok(home.includes(PARTNER_DISCLOSURE));
  assert.doesNotMatch(home, /kalshi\.com/, 'never a direct Kalshi URL: the Worker 302s');
  const art = partnerOfferHtml(normalizeConfig(VERIFIED), articlePartnerContext({ sport: 'MLB' }));
  assert.match(art, /placement=propbetedge_article_footer&amp;product=propbetedge&amp;sport=mlb/);
  assert.equal(PARTNER_CONFIG_URL, '/go/kalshi-perps/config');
});

test('mount: fills one slot once; a disabled config leaves it hidden and empty', async () => {
  const slot = () => ({ dataset: {}, hidden: true, innerHTML: '', isConnected: true });
  const on = slot();
  await mountPartnerOffer(on, HOME_PARTNER_CONTEXT, { load: async () => normalizeConfig(VERIFIED) });
  assert.equal(on.hidden, false);
  assert.equal((on.innerHTML.match(/class="kxo /g) || []).length, 1);
  let calls = 0;
  await mountPartnerOffer(on, HOME_PARTNER_CONTEXT, { load: async () => { calls++; return normalizeConfig(VERIFIED); } });
  assert.equal(calls, 0, 'second mount is a no-op');
  const off = slot();
  await mountPartnerOffer(off, HOME_PARTNER_CONTEXT, { load: async () => PARTNER_DISABLED });
  assert.equal(off.hidden, true);
  assert.equal(off.innerHTML, '');
  const boom = slot();
  await mountPartnerOffer(boom, HOME_PARTNER_CONTEXT, { load: async () => { throw new Error('network'); } });
  assert.equal(boom.hidden, true);
  assert.equal(boom.innerHTML, '');
});

test('no referral URL or offer economics hardcoded in news-site source (vendored client excepted)', () => {
  const files = ['src/kalshi-partner-offer.js', 'src/pages/home.js', 'src/pages/article.js', 'src/market-pulse-launch.js', 'src/styles/pbe-nav-v2.css', 'vercel.json'];
  for (const f of files) {
    const s = read(f);
    assert.doesNotMatch(s, /38800c96|kalshi\.com\/p\/|referral=/i, f);
    // economics as offer copy (layout percentages such as width:30% are not offer terms)
    assert.doesNotMatch(s, /\$50|(?<![\w:-])(?:10|30)%(?! *[;"])|3 months|1 year/i, f);
  }
});

test('same-origin rewrites are fixed paths to the propsports-markets partner routes', () => {
  const { rewrites } = JSON.parse(read('vercel.json'));
  const go = rewrites.filter((r) => r.source.startsWith('/go/'));
  assert.deepEqual(go, [
    { source: '/go/kalshi-perps/config', destination: 'https://propsports-markets.sales-fd3.workers.dev/v1/partner/kalshi' },
    { source: '/go/kalshi-perps', destination: 'https://propsports-markets.sales-fd3.workers.dev/go/kalshi-perps' },
  ]);
  const catchAll = rewrites.findIndex((r) => r.destination === '/index.html' && r.source.startsWith('/(('));
  assert.ok(rewrites.indexOf(go[1]) < catchAll, 'before the SPA catch-all');
});

test('homepage: the partner slot is the LAST thing inside Market Pulse (subordinate, after Kalshi attribution)', () => {
  const html = renderMarketPulseLaunch();
  assert.equal((html.match(/data-pbe-kxo-slot/g) || []).length, 1);
  assert.match(html, /pbe-market-pulse-attribution[\s\S]*data-pbe-kxo-slot="home" hidden><\/div>\s*<\/section>/);
  assert.match(read('src/pages/home.js'), /mountPartnerOffer\(root\.querySelector\('\[data-pbe-market-pulse\] \[data-pbe-kxo-slot\]'\), HOME_PARTNER_CONTEXT\)/);
});

test('article: ONE partner row after Preferred Source, before Related Coverage; never inside the market module', () => {
  const src = read('src/pages/article.js');
  assert.equal((src.match(/articlePartnerSlot\(\)/g) || []).length, 1);
  assert.match(src, /renderPreferredSource\(\{ surface: 'article'[^\n]*\n\s*\n\s*\$\{articlePartnerSlot\(\)\}\s*\n\s*\n\s*<div id="related-slot"><\/div>/);
  assert.match(articlePartnerSlot(), /data-pbe-kxo-slot="article"/);
  // the real Article Market integration stays free of the partner offer
  for (const f of ['src/article-market.js', 'src/vendor/markets/article-market-ui.js', 'src/vendor/markets/kalshi-market-ui.js']) {
    assert.doesNotMatch(read(f), /kalshi-partner|kxo|go\/kalshi-perps/, f);
  }
});

test('nav: no permanent promo bar, ONE News control, ONE intelligence selector, logo is Home', () => {
  const header = read('src/components/header.js');
  assert.doesNotMatch(header, /ad_header_banner\(/);
  assert.equal((header.match(/<details class="pbe-intel-switcher"/g) || []).length, 1);
  assert.equal((header.match(/<details class="pbe-sports-switcher pbe-news-switcher"/g) || []).length, 1);
  assert.match(header, /NEWS_ORDER = Object\.freeze\(\['mlb', 'nfl', 'nba', 'nhl', 'wnba', 'ufc', 'tennis', 'soccer', 'golf', 'f1'\]\)/);
  assert.doesNotMatch(header, /masthead-home/);
  assert.match(header, /<a href="\/" class="masthead-logo" aria-label="PropBetEdge home">/);
  assert.match(header, /pbe-predictions-link/);
  // moved, not deleted: the mobile More panel still reaches every section
  for (const href of ['/news', '/games', '/odds', '/leaders', '/standings', 'https://predictions.propbetedge.ai/']) {
    assert.ok(header.includes(`href="${href}"`), href);
  }
  const css = read('src/styles/pbe-nav-v2.css');
  assert.match(css, /\.pbe-fight-week\[data-yield-breaking\] \{ display: none !important; \}/, 'Breaking outranks Fight Week');
  assert.match(css, /\.masthead\.pbe-nav2 \.pbe-signin-link \{[^}]*background: transparent !important/, 'Sign In is never gold');
  assert.match(read('src/main.js'), /import '\.\/styles\/pbe-nav-v2\.css';\s*import \{ initBackgroundSelector \}/, 'nav stylesheet is the last stylesheet import');
});
