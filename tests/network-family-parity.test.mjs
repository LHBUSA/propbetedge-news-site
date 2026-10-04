// PropBetEdge family footer parity (owner decision 2026-10-03).
// src/network/family.json is VENDORED from LHBUSA/propbetedge-workers shared/network/family.json
// (generated from shared/network/pbe-network.js). Never hand-edit it; re-vendor when the registry changes.
// This test fails if the footer, /pro SPORTS + PREDICTIONS, src/schema.js hasPart or the static
// index.html JSON-LD drift from the network registry.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SPORTS, PREDICTIONS } from '../src/pro-content.js';
import { websiteSchema } from '../src/schema.js';
import { PROPBET_LINKS } from '../src/ads-config.js';
import { renderFooter } from '../src/components/footer.js';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const family = JSON.parse(read('src/network/family.json'));
const ORG = 'https://propbetedge.ai/#organization';
const SPORT_URLS = family.sports.map((s) => s.url);
const PRED_URL = family.products.find((p) => p.key === 'predictions').url;
const F1_URL = family.sports.find((s) => s.key === 'f1').url;
const slash = (u) => (u.endsWith('/') ? u : `${u}/`);

function footerHrefs() {
  const html = renderFooter();
  const footer = html.slice(html.indexOf('<footer'), html.lastIndexOf('</footer>'));
  return { footer, hrefs: [...footer.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)].map((m) => m[1]) };
}

test('vendored family.json is the canonical registry shape', () => {
  assert.equal(family.organization, ORG);
  assert.deepEqual(family.sports.map((s) => s.key), ['mlb', 'nfl', 'nba', 'wnba', 'nhl', 'ufc', 'tennis', 'soccer', 'golf', 'f1']);
  assert.equal(PRED_URL, 'https://predictions.propbetedge.ai/');
  assert.deepEqual(family.network.map((n) => n.url), ['https://propbetedge.ai/', 'https://propbetedge.ai/pro', 'https://learn.propbetedge.ai/']);
  assert.ok(family.retired_hosts.includes('hub.propbetedge.ai'));
});

test('footer links every family sport in registry order, Predictions in its own group after the sports', () => {
  const { footer, hrefs } = footerHrefs();
  const sportHrefs = hrefs.filter((h) => SPORT_URLS.includes(slash(h)));
  assert.deepEqual(sportHrefs.map(slash), SPORT_URLS, 'sports set + order match family.json');
  assert.equal(hrefs.filter((h) => h === F1_URL).length, 1, 'exactly one canonical F1 anchor');
  assert.equal(hrefs.filter((h) => h === PRED_URL).length, 1, 'exactly one canonical Predictions anchor');
  assert.equal(hrefs.filter((h) => /predictions\.propbetedge\.ai/.test(h)).length, 1);
  assert.equal(hrefs.filter((h) => /f1\.propbetedge\.ai/.test(h)).length, 1);
  // Predictions sits under its own heading, never inside the sport list.
  const f1At = footer.indexOf(`href="${F1_URL}"`);
  const predAt = footer.indexOf(`href="${PRED_URL}"`);
  const between = footer.slice(f1At, predAt);
  assert.match(between, /<h4[^>]*>[^<]*Intelligence<\/h4>/, 'Predictions has its own group heading');
  assert.match(footer, /F1<span class="nf-sr"> Intelligence<\/span>/, 'accessible name "F1 Intelligence"');
  assert.match(footer, />PropBetEdge Predictions </);
});

test('footer network links: PropBetEdge home, All Access, Learn; no retired hosts, no http://', () => {
  const { hrefs } = footerHrefs();
  assert.ok(hrefs.includes('/'), 'self link (relative) to PropBetEdge');
  assert.ok(hrefs.includes('/pro'), 'All Access (relative /pro on its own host)');
  assert.equal(PROPBET_LINKS.learn, family.network.find((n) => n.key === 'learn').url);
  assert.ok(hrefs.includes(PROPBET_LINKS.learn) || read('src/components/footer.js').includes('${PROPBET_LINKS.learn}'));
  for (const h of hrefs) {
    for (const host of family.retired_hosts) assert.ok(!h.includes(host), `retired host in footer: ${h}`);
    assert.ok(!h.startsWith('http://'), `insecure footer link: ${h}`);
  }
});

test('/pro SPORTS == family sports (set + urls); PREDICTIONS is separate, never a sport', () => {
  assert.equal(SPORTS.length, family.sports.length);
  const byKey = Object.fromEntries(SPORTS.map((s) => [s.key, s]));
  for (const s of family.sports) {
    assert.ok(byKey[s.key], `missing sport ${s.key}`);
    assert.equal(slash(byKey[s.key].url), s.url, s.key);
  }
  assert.equal(SPORTS.some((s) => s.key === 'predictions'), false);
  assert.equal(slash(PREDICTIONS.url), PRED_URL);
});

test('schema.js hasPart and index.html static JSON-LD == family sports + Predictions, one org id', () => {
  const expected = [...SPORT_URLS, PRED_URL];
  const site = websiteSchema();
  assert.deepEqual(site.hasPart.map((p) => p.url), expected);
  for (const p of site.hasPart) assert.equal(p.publisher['@id'], family.organization);
  const html = read('index.html');
  const graph = JSON.parse(html.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/)[1])['@graph'];
  const staticSite = graph.find((n) => n['@type'] === 'WebSite');
  assert.deepEqual(staticSite.hasPart.map((p) => p.url), expected);
  const orgs = graph.filter((n) => /Organization$/.test(n['@type']));
  assert.equal(orgs.length, 1, 'exactly one top-level organization node');
  assert.equal(orgs[0]['@id'], family.organization);
});

test('About crawler HTML lists the ten family sports and Predictions separately', () => {
  const mw = read('middleware.js');
  const block = mw.slice(mw.indexOf('<h2>Ten live sport intelligence products</h2>'), mw.indexOf('<h2>Accountability by design</h2>'));
  const hosts = [...block.matchAll(/href="https:\/\/([a-z0-9]+)\.propbetedge\.ai\//g)].map((m) => m[1]);
  assert.deepEqual(hosts, [...family.sports.map((s) => s.key), 'predictions']);
});
