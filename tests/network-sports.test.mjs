// Soccer is the 8th PropBetEdge sport and is included in All Access. The root footer and /pro list every
// sport, and the one live Stripe identity (product, price, Payment Link, THEEDGE25) never changes.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ALL_ACCESS, SPORTS } from '../src/pro-content.js';
import { PROPBET_LINKS } from '../src/ads-config.js';
import { renderFooter } from '../src/components/footer.js';

const slash = (u) => (u.endsWith('/') ? u : `${u}/`);
const footerHrefs = () => [...renderFooter({ cta: false }).matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)].map((m) => slash(m[1]));

// Sport list comes from the vendored network registry (src/network/family.json), not a hard-coded count.
const FAMILY = JSON.parse(fs.readFileSync(new URL('../src/network/family.json', import.meta.url), 'utf8'));
const FAMILY_SPORTS = FAMILY.sports.map((s) => s.key);

test('All Access includes every PropBetEdge family sport', () => {
  assert.deepEqual([...SPORTS.map((s) => s.key)].sort(), [...FAMILY_SPORTS].sort());
  assert.equal(SPORTS.some((s) => s.key === 'predictions'), false, 'Predictions is a product, not a sport');
  const tennis = SPORTS.find((s) => s.key === 'tennis');
  assert.equal(tennis.url, 'https://tennis.propbetedge.ai');
  assert.equal(tennis.label, 'Tennis');
});

test('Stripe identity unchanged: one product, one price, one Payment Link, THEEDGE25', () => {
  assert.equal(ALL_ACCESS.productKey, 'pbe_all_access');
  assert.equal(ALL_ACCESS.priceId, 'price_1UJCF1F3CaVzg4ORSIohWTca');
  assert.equal(ALL_ACCESS.paymentLinkId, 'plink_1UJCFAF3CaVzg4ORKspa47rI');
  assert.equal(ALL_ACCESS.checkoutUrl, 'https://buy.stripe.com/8x2eVdgmOaqy4pv8Ez7wA0N');
  assert.equal(ALL_ACCESS.priceUsd, 29);
  assert.equal(ALL_ACCESS.interval, 'month');
  assert.equal(ALL_ACCESS.promoCode, 'THEEDGE25');
  assert.equal(ALL_ACCESS.promoPercent, 25);
  const src = fs.readFileSync(new URL('../src/pro-content.js', import.meta.url), 'utf8');
  assert.equal((src.match(/buy\.stripe\.com\//g) || []).length, 1, 'no second checkout link');
  assert.doesNotMatch(src, /tennis[^\n]*(price_|plink_|buy\.stripe)/i, 'no Tennis-specific plan');
});

test('root footer links every PropBetEdge sport, Tennis included', () => {
  const hrefs = footerHrefs();
  assert.equal(PROPBET_LINKS.tennis, 'https://tennis.propbetedge.ai');
  for (const key of ['picks_mlb', 'picks_nfl', 'picks_nba', 'picks_nhl', 'picks_ufc', 'tennis']) {
    assert.ok(hrefs.includes(slash(PROPBET_LINKS[key])), key);
  }
  assert.ok(hrefs.includes('https://wnba.propbetedge.ai/'), 'wnba');
});

test('Soccer is a network discovery link and an included All Access sport', () => {
  assert.equal(PROPBET_LINKS.soccer, 'https://soccer.propbetedge.ai');
  assert.ok(footerHrefs().includes(slash(PROPBET_LINKS.soccer)));
  assert.match(renderFooter(), /Soccer<span class="nf-sr"> Intelligence<\/span>/, 'accessible name keeps "Soccer Intelligence"');
  assert.equal(SPORTS.some((s) => s.key === 'soccer'), true, 'Soccer is included in All Access');
});

test('/pro lists all ten sports (F1 as F1 Intelligence); Boxing stays a roadmap sport, not a card', async () => {
  const { buildProHtml, UPCOMING_SPORTS } = await import('../src/pro-content.js');
  const html = buildProHtml();
  for (const name of ['PropBetEdge Tennis', 'PropBetEdge Soccer', 'PropBetEdge Golf', 'F1 Intelligence']) assert.ok(html.includes(name), name);
  assert.deepEqual(UPCOMING_SPORTS.map((s) => s.key), ['boxing']);
  assert.equal(/data-sport="boxing"/.test(html), false, 'no roadmap sport is sold as included');
  assert.match(html, /MLB · NFL · NBA · NHL · WNBA · UFC · Tennis · Soccer · Golf · F1/);
  const success = buildProHtml({ checkoutSuccess: true });
  for (const s of SPORTS) assert.ok(success.includes(`href="${s.url}"`), `${s.label} reachable after checkout`);
});

test('root WebSite schema lists every family sport property once, plus Predictions', async () => {
  const { websiteSchema } = await import('../src/schema.js');
  const urls = websiteSchema().hasPart.map((p) => p.url);
  assert.equal(urls.length, FAMILY_SPORTS.length + FAMILY.products.length);
  assert.equal(new Set(urls).size, urls.length);
  assert.ok(urls.includes('https://predictions.propbetedge.ai/'));
  assert.ok(urls.includes('https://tennis.propbetedge.ai/'));
  assert.ok(urls.includes('https://soccer.propbetedge.ai/'));
});

test('footer: commercial model carried once by All Access, not a Pro badge on every sport', () => {
  const html = renderFooter({ cta: false });
  assert.doesNotMatch(html, /footer-badge">Pro</);
  assert.match(html, /<span class="nf-hero-name">All Access<\/span><span class="nf-hero-price">\$29\/mo<\/span>/);
  assert.match(html, /PropBetEdge Predictions<\/span><span class="nf-tag">Included with All Access<\/span>/);
});
