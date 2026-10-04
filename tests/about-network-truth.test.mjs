// /about is a presentation layer over canonical network truth (owner 2026-10-04): no independent sport list,
// product copy, price or URL can drift. Page + crawler HTML both render src/about-content.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { aboutModel, ABOUT_META } from '../src/about-content.js';
import { SPORTS as PRO_SPORTS, PREDICTIONS, ALL_ACCESS, UPCOMING_SPORTS, OPERATING_SYSTEM_STAGES } from '../src/pro-content.js';
import { INTELLIGENCE_SPORTS } from '../src/intelligence-cta.js';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const FAMILY = JSON.parse(read('src/network/family.json'));
const m = aboutModel();
const page = read('src/pages/about.js');
const mw = read('middleware.js');

test('sports = family registry (membership, order, URLs); capability lines = /pro; newsrooms = INTELLIGENCE_SPORTS', () => {
  assert.deepEqual(m.sports.map((s) => s.key), FAMILY.sports.map((s) => s.key));
  assert.deepEqual(m.sports.map((s) => s.url), FAMILY.sports.map((s) => s.url));
  for (const s of m.sports) {
    assert.equal(s.line, PRO_SPORTS.find((p) => p.key === s.key).edge, s.key);
    assert.equal(s.newsPath, INTELLIGENCE_SPORTS[s.key].newsPath, s.key);
  }
  assert.equal(m.sportCount, FAMILY.sports.length);
});

test('Predictions is first-class and never a sport; All Access price and upcoming sports come from /pro', () => {
  assert.ok(!m.sports.some((s) => s.key === 'predictions'));
  assert.equal(m.predictions.name, PREDICTIONS.name);
  assert.equal(m.predictions.line, PREDICTIONS.edge);
  assert.equal(m.allAccess.price, `$${ALL_ACCESS.priceUsd}/${ALL_ACCESS.interval}`);
  assert.deepEqual(m.upcoming.map((u) => u.label), UPCOMING_SPORTS.map((u) => u.label));
  assert.ok(m.upcoming.every((u) => !m.sports.some((s) => s.label === u.label)), 'an upcoming sport is never presented as live');
});

test('operating loop reuses the /pro stages (+ Publish from the research registry)', () => {
  assert.deepEqual(m.stages.slice(0, OPERATING_SYSTEM_STAGES.length).map((s) => s.label), OPERATING_SYSTEM_STAGES.map((s) => s.label));
  assert.equal(m.stages.at(-1).label, 'Publish');
});

test('the page and the crawler HTML hold no independent network copy', () => {
  const code = page.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(code, /const SPORTS\s*=|https:\/\/[a-z0-9]+\.propbetedge\.ai|\$29|ten-sport|Ten live sport/i, 'about.js must render the model, not restate it');
  assert.match(page, /aboutModel\(\)/);
  assert.match(mw, /const m = aboutModel\(\);/);
  assert.match(mw, /title: ABOUT_META\.title,/);
  assert.match(mw, /description: ABOUT_META\.description,/);
  assert.doesNotMatch(mw.slice(mw.indexOf('function buildServerAboutHtml'), mw.indexOf('function buildEditorialStandardsSchema')), /https:\/\/[a-z0-9]+\.propbetedge\.ai/, 'crawler HTML renders the model');
});

test('features are not corporate products; trust summary + links; quiet header; AboutPage schema intact', () => {
  const text = JSON.stringify(m.layers) + ABOUT_META.description;
  assert.doesNotMatch(text, /K Props|HR Targets|Ask The Algo|PBEcast product/i);
  assert.ok(m.trust.includes('Official model calls are frozen before outcomes.'));
  assert.ok(m.trust.includes('Missing data remains missing.'));
  for (const h of ['/editorial-standards', '/research', '/authors', '/terms', '/legal', '/developers']) assert.ok(page.includes(`href="${h}"`), h);
  assert.match(page, /renderHeader\(\{ mode: 'editorial' \}\)/);
  assert.match(page, /'@type': 'AboutPage'/);
  assert.match(page, /canonical: `\$\{SITE\}\/about`/);
  assert.match(m.layers.map((l) => l.name).join(','), /PropBetEdge,PropSports,PropTechUSA\.ai/);
});
