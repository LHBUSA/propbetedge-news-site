/* /pro — PropBetEdge All Access membership page.
 *
 * Pins the ONE live Stripe checkout (payment link + price), the $29/month
 * price, the THEEDGE25 launch offer, the six included sports plus the
 * future-sports promise, the ?checkout=success state, and the crawler bytes
 * Edge Middleware serves for /pro.
 *
 *   node --test tests/pro-page.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { ALL_ACCESS, SPORTS, buildProHtml, proMeta, proSchema, checkoutSucceeded, promoLine } from '../src/pro-content.js';

const read = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const LIVE = {
  checkoutUrl: 'https://buy.stripe.com/8x2eVdgmOaqy4pv8Ez7wA0N',
  paymentLinkId: 'plink_1UJCFAF3CaVzg4ORKspa47rI',
  priceId: 'price_1UJCF1F3CaVzg4ORSIohWTca',
};

test('the live Stripe identities are pinned and nothing else is offered', () => {
  assert.equal(ALL_ACCESS.checkoutUrl, LIVE.checkoutUrl);
  assert.equal(ALL_ACCESS.paymentLinkId, LIVE.paymentLinkId);
  assert.equal(ALL_ACCESS.priceId, LIVE.priceId);
  assert.equal(ALL_ACCESS.productKey, 'pbe_all_access');
  assert.equal(ALL_ACCESS.priceUsd, 29); assert.equal(ALL_ACCESS.interval, 'month');
  assert.equal(ALL_ACCESS.promoCode, 'THEEDGE25'); assert.equal(ALL_ACCESS.promoPercent, 25);
  const html = buildProHtml();
  const stripeLinks = html.match(/https:\/\/buy\.stripe\.com\/[A-Za-z0-9]+/g) || [];
  assert.ok(stripeLinks.length >= 3, 'hero, card and closing CTA all link to checkout');
  assert.ok(stripeLinks.every(l => l === LIVE.checkoutUrl), 'every checkout button points to the one live payment link');
  assert.equal((html.match(/data-pbe-placement="all_access_checkout"/g) || []).length, stripeLinks.length);
});

test('hierarchy: title, statement, price, CTA, launch offer, six sports, future sports', () => {
  const html = buildProHtml();
  assert.match(html, /PropBetEdge<\/span><span class="pbe-pro-title-all">All Access/);
  for (const line of ['One membership.', 'Every sport.', 'Every model.', 'Every current and future PropBetEdge Pro product.']) assert.ok(html.includes(line), line);
  assert.match(html, /pbe-pro-price-amount">\$29<\/span><span class="pbe-pro-price-per">\/ month/);
  assert.match(html, />Get All Access</);
  assert.match(html, /25% off for as long as you stay active/);
  assert.match(html, /<code data-pbe-promo-code>THEEDGE25<\/code>/);
  assert.deepEqual(SPORTS.map(s => s.label), ['MLB', 'NFL', 'NBA', 'NHL', 'WNBA', 'UFC']);
  for (const s of SPORTS) {
    assert.match(html, new RegExp(`data-sport="${s.key}"`), s.key);
    assert.ok(html.includes(`href="${s.url}"`), `${s.label} links to its property`);
  }
  assert.match(html, /data-sport="future"/);
  assert.match(html, /Every future sport/);
  assert.match(html, /Every new PropBetEdge sport and every new Pro product joins All Access on launch day/);
});

test('value proposition names every promised pillar and keeps sport plans alive', () => {
  const html = buildProHtml();
  for (const pillar of ['Proprietary algorithms', 'Tracked, graded picks', 'Live intelligence', 'PBEcast and live experiences', 'Player and matchup intelligence', 'Predictions and future Pro tools']) {
    assert.ok(html.includes(pillar), pillar);
  }
  assert.match(html, /Every sport\. One login\./);
  assert.match(html, /Your sport plan stays exactly as it is\./);
  assert.match(html, /All Access is the premium umbrella/);
  assert.equal(promoLine(), '25% off for as long as you stay active with code THEEDGE25.');
});

test('?checkout=success renders the premium success state and no second checkout', () => {
  assert.equal(checkoutSucceeded('?checkout=success'), true);
  assert.equal(checkoutSucceeded('?checkout=canceled'), false);
  assert.equal(checkoutSucceeded(''), false);
  const html = buildProHtml({ checkoutSuccess: true });
  assert.match(html, /pbe-pro-is-success/);
  assert.match(html, /Checkout complete/);
  assert.match(html, /Welcome to<\/span><span class="pbe-pro-title-all">All Access/);
  assert.match(html, /membership is active/);
  assert.match(html, /Enter the email you used at checkout/);
  assert.match(html, /Manage subscription/);
  assert.equal(html.includes(LIVE.checkoutUrl), false, 'a buyer who just paid is not sold again');
  for (const s of SPORTS) assert.ok(html.includes(`href="${s.url}"`), `${s.label} reachable from the success state`);
  assert.equal(proMeta({ checkoutSuccess: true }).title, 'All Access is active — PropBetEdge');
});

test('meta + schema: canonical /pro, $29 USD monthly offer at the live checkout URL', () => {
  const meta = proMeta();
  assert.equal(meta.canonical, 'https://propbetedge.ai/pro');
  assert.match(meta.title, /All Access/); assert.match(meta.description, /THEEDGE25/);
  const schema = proSchema();
  assert.equal(schema['@type'], 'Product');
  assert.equal(schema.offers.url, LIVE.checkoutUrl);
  assert.equal(schema.offers.price, '29'); assert.equal(schema.offers.priceCurrency, 'USD');
  assert.equal(schema.offers.priceSpecification.unitCode, 'MON');
});

test('wiring: router, styles, header pill, footer link, sitemap and Edge Middleware all know /pro', () => {
  assert.match(read('src/router.js'), /if \(path === '\/pro'\) return renderPro\(root, setMeta\);/);
  assert.match(read('src/main.js'), /pbe-pro\.css/);
  assert.match(read('src/components/header.js'), /href="\/pro" class="nav-link pbe-all-access-link/);
  assert.match(read('src/components/footer.js'), /href="\/pro"><strong>All Access<\/strong>/);
  assert.match(read('api/sitemap.js'), /'\/pro',/);
  const mw = read('middleware.js');
  assert.match(mw, /if \(pathname === '\/pro'\) \{/);
  assert.ok(mw.includes(`const ALL_ACCESS_CHECKOUT = '${LIVE.checkoutUrl}';`));
  assert.match(mw, /THEEDGE25/);
  assert.equal(read('vercel.json').includes('"/pro"'), false, 'the SPA catch-all already serves /pro; no bespoke rewrite');
});

test('crawler bytes: Edge Middleware serves /pro with title, canonical, product schema and the live checkout link', async () => {
  const { renderPage } = await import('./ssr-harness.mjs');
  const { html, status } = await renderPage('/pro');
  assert.equal(status, 200);
  assert.match(html, /<title>PropBetEdge All Access — One Membership, Every Sport \| \$29\/month<\/title>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/propbetedge\.ai\/pro"/);
  assert.match(html, /data-server-rendered="1"/);
  assert.ok(html.includes(LIVE.checkoutUrl));
  assert.match(html, /"@type":"Product"/);
  assert.match(html, /THEEDGE25/);
});
