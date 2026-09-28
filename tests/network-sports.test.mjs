// Soccer is the 8th PropBetEdge sport and is included in All Access. The root footer and /pro list every
// sport, and the one live Stripe identity (product, price, Payment Link, THEEDGE25) never changes.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ALL_ACCESS, SPORTS } from '../src/pro-content.js';
import { PROPBET_LINKS } from '../src/ads-config.js';

const EIGHT = ['mlb', 'nfl', 'nba', 'nhl', 'wnba', 'ufc', 'tennis', 'soccer'];

test('All Access includes all eight PropBetEdge sports', () => {
  assert.deepEqual(SPORTS.map((s) => s.key), EIGHT);
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
  const footer = fs.readFileSync(new URL('../src/components/footer.js', import.meta.url), 'utf8');
  assert.equal(PROPBET_LINKS.tennis, 'https://tennis.propbetedge.ai');
  for (const key of ['picks_mlb', 'picks_nfl', 'picks_nba', 'picks_nhl', 'picks_ufc', 'tennis']) {
    assert.ok(footer.includes(`\${PROPBET_LINKS.${key}}`), key);
  }
  assert.ok(footer.includes('https://wnba.propbetedge.ai'), 'wnba');
});

test('Soccer is a network discovery link and an included All Access sport', () => {
  const footer = fs.readFileSync(new URL('../src/components/footer.js', import.meta.url), 'utf8');
  assert.equal(PROPBET_LINKS.soccer, 'https://soccer.propbetedge.ai');
  assert.ok(footer.includes('${PROPBET_LINKS.soccer}'));
  assert.match(footer, /Soccer Intelligence <span class="footer-badge">Live<\/span>/);
  assert.equal(SPORTS.some((s) => s.key === 'soccer'), true, 'Soccer is included in All Access');
});

test('Tennis and Soccer are included open intelligence surfaces; eight-sport line', async () => {
  const { buildProHtml } = await import('../src/pro-content.js');
  const html = buildProHtml();
  assert.ok(!/Tennis Pro<\/li>/.test(html), 'Tennis has no Pro tier yet');
  assert.match(html, /Tennis Intelligence, plus its Pro features as they launch/);
  assert.match(html, /One membership\. Eight sports\. Every future sport\./);
  assert.match(html, /MLB · NFL · NBA · WNBA · NHL · UFC · Tennis · Soccer/);
  assert.match(buildProHtml({ checkoutSuccess: true }), /Tennis and Soccer are open to everyone today, no sign-in needed/);
});

test('root WebSite schema lists all eight sport properties once', async () => {
  const { websiteSchema } = await import('../src/schema.js');
  const urls = websiteSchema().hasPart.map((p) => p.url);
  assert.equal(urls.length, 8);
  assert.equal(new Set(urls).size, 8);
  assert.ok(urls.includes('https://tennis.propbetedge.ai/'));
  assert.ok(urls.includes('https://soccer.propbetedge.ai/'));
});

test('Tennis footer badge is Included (part of All Access), never a separate Free plan', () => {
  const footer = fs.readFileSync(new URL('../src/components/footer.js', import.meta.url), 'utf8');
  assert.match(footer, /Tennis Intelligence <span class="footer-badge">Included<\/span>/);
  assert.doesNotMatch(footer, /Tennis[^<]*<span class="footer-badge">Free/);
});
