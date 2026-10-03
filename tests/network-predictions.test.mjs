// PropBetEdge Predictions is a first-class network product included in All Access — NOT an 11th sport.
// Commercial truth: 10 live sports + PropBetEdge Predictions = All Access, $29/month (Stripe identity unchanged).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ALL_ACCESS, SPORTS, PREDICTIONS, buildProHtml } from '../src/pro-content.js';
import { websiteSchema, organizationSchema } from '../src/schema.js';
import * as seo from '../src/pro-seo.js';
import { toolById, EMPTY_STATE } from '../src/search/destinations.js';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const PRED = 'https://predictions.propbetedge.ai';

test('Predictions is a separate product: ten sports stay ten', () => {
  assert.equal(SPORTS.length, 10);
  assert.equal(SPORTS.some((s) => s.key === 'predictions' || /predictions/i.test(s.url)), false);
  assert.equal(PREDICTIONS.url, PRED);
  assert.equal(PREDICTIONS.websiteId, `${PRED}/#website`);
});

test('main WebSite hasPart lists the ten sports and Predictions (with its canonical @id), once each', () => {
  const site = websiteSchema();
  const pred = site.hasPart.filter((p) => p.url === `${PRED}/`);
  assert.equal(pred.length, 1);
  assert.equal(pred[0]['@id'], `${PRED}/#website`);
  assert.equal(pred[0].publisher['@id'], 'https://propbetedge.ai/#organization');
  assert.equal(site.hasPart.length, SPORTS.length + 1);
  assert.equal(organizationSchema()['@id'], 'https://propbetedge.ai/#organization');
});

test('/pro says ten sports + Predictions, shows a Predictions product card, and keeps the $29 Offer', () => {
  const html = buildProHtml();
  assert.match(html, /<span>Ten sports\.<\/span>\s*<span>All Predictions\.<\/span>/);
  assert.match(html, /class="pbe-pro-predictions" href="https:\/\/predictions\.propbetedge\.ai\/"/);
  assert.match(html, /10 live sports \+ PropBetEdge Predictions today/);
  assert.equal((html.match(/pbe-pro-sport" data-sport=/g) || []).length, 10, 'sport grid still has exactly ten sports');
  const graph = seo.proJsonLd()['@graph'];
  const offer = graph.find((n) => n['@type'] === 'Offer');
  assert.equal(offer.price, '29'); assert.equal(offer.priceCurrency, 'USD'); assert.equal(offer.url, ALL_ACCESS.checkoutUrl);
  const product = graph.find((n) => n['@type'] === 'Product');
  assert.ok(product.isRelatedTo.some((x) => x['@id'] === `${PRED}/#website`));
  assert.match(seo.proServerHtml(), /One membership\. Ten sports\. All Predictions\./);
  assert.match(seo.proServerHtml(), new RegExp(`<a href="${PRED}/">PropBetEdge Predictions</a>`));
  assert.equal(ALL_ACCESS.priceUsd, 29);
});

test('network surfaces link Predictions: footer, header switcher + mobile menu, About crawler HTML, search', () => {
  assert.match(read('src/components/footer.js'), /href="https:\/\/predictions\.propbetedge\.ai\/"[^>]*>PropBetEdge Predictions/);
  const header = read('src/components/header.js');
  assert.match(header, /pbe-intel-option-predictions" href="https:\/\/predictions\.propbetedge\.ai\/"/);
  assert.match(header, /data-pbe-placement="mobile_more_predictions">Predictions</);
  assert.match(read('middleware.js'), /href="https:\/\/predictions\.propbetedge\.ai\/">PropBetEdge Predictions<\/a>/);
  assert.equal(toolById('predictions').href, `${PRED}/`);
  assert.ok(EMPTY_STATE.popular.some((p) => p.id === 'predictions'));
});
