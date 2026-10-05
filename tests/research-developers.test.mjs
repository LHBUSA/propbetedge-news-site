// Research center + developer platform (owner 2026-10-04). Research explains principles without exposing model
// IP; Developers lists only public, sellable APIs. Both render from one registry each and are crawlable.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { RESEARCH_PAGES, RESEARCH_NOT_PUBLISHED } from '../src/research/registry.js';
import { PUBLIC_APIS } from '../src/network/public-apis.js';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const registryText = JSON.stringify(RESEARCH_PAGES);

test('research registry: the five pages the footer links, each with real content', () => {
  assert.deepEqual(RESEARCH_PAGES.map((p) => p.path), ['/research', '/research/methodology', '/research/model-governance', '/research/data-provenance', '/research/intelligence-systems']);
  for (const p of RESEARCH_PAGES) {
    assert.ok(p.title && p.description && p.lede, p.path);
    assert.ok(p.heroSignals?.length >= 4, `${p.path} has a research-principles hero strip`);
    assert.ok(p.summary?.length >= 3, `${p.path} has a substantive overview`);
    assert.ok(p.sections.length >= 6, `${p.path} has first-class depth`);
    assert.ok(p.sections.some((s) => s.points || s.cards || s.steps || s.rule), `${p.path} has structured evidence, not prose only`);
  }
  for (const term of ['provenance', 'canonical', 'uncertainty', 'prospective', 'replay', 'shadow', 'calibrat', 'frozen', 'permanent', 'version', 'promotion', 'missing', 'monitor']) {
    assert.match(registryText.toLowerCase(), new RegExp(term), `covers ${term}`);
  }
});

test('research never exposes model IP: no numbers-as-thresholds, weights, formulas, endpoints or code', () => {
  // The only percentages allowed are the calibration illustration ("a 60% chance ... about 60% of the time").
  const illustration = 'events given a 60% chance should happen about 60% of the time';
  assert.ok(registryText.includes(illustration));
  const rest = registryText.replace(illustration, '');
  assert.doesNotMatch(rest, /\b\d+(\.\d+)?\s*%|\b\d{2,}\s*(observations|weeks|picks|decisions)\b|threshold of|weight of|https?:\/\/|workers\.dev|\/v1\/|SELECT |=>|function\s*\(/i);
  assert.ok(RESEARCH_NOT_PUBLISHED.length >= 5);
  assert.match(JSON.stringify(RESEARCH_NOT_PUBLISHED), /thresholds/i);
  assert.match(registryText, /not third-party notarization/, 'receipts are not overclaimed');
});

test('developer catalog: only the audited public APIs, each with a public portal; no internal hosts', () => {
  assert.deepEqual(PUBLIC_APIS.map((a) => a.key), ['propsports', 'ufc', 'news']);
  for (const a of PUBLIC_APIS) {
    assert.match(a.href, /^https:\/\/(propsports\.proptechusa\.ai|ufc\.proptechusa\.ai|rapidapi\.com\/)/, a.key);
    assert.ok(a.summary && a.access, a.key);
  }
  assert.doesNotMatch(JSON.stringify(PUBLIC_APIS), /workers\.dev|\/v1\/health|internal/i);
  assert.doesNotMatch(JSON.stringify(PUBLIC_APIS), /\b\d{2,}\s*(routes|endpoints)\b/i, 'no route counts (they go stale)');
});

test('routes, quiet header, sitemap and crawler HTML are wired from the same registries', () => {
  const router = read('src/router.js');
  assert.match(router, /if \(path === '\/research' \|\| path\.startsWith\('\/research\/'\)\) \{ if \(renderResearch\(root, path, setMeta\)\) return; \}/);
  assert.match(router, /if \(path === '\/developers'\) return renderDevelopers\(root, setMeta\);/);
  for (const p of ['research', 'developers']) assert.match(read(`src/pages/${p}.js`), /renderHeader\(\{ mode: 'editorial' \}\)/, p);
  const sitemap = read('api/sitemap.js');
  for (const p of [...RESEARCH_PAGES.map((x) => x.path), '/developers']) assert.ok(sitemap.includes(`'${p}'`), p);
  const mw = read('middleware.js');
  assert.match(mw, /const rPage = researchPage\(pathname\);/);
  assert.match(mw, /ssrHtml: buildServerResearchHtml\(rPage\)/);
  assert.match(mw, /ssrHtml: buildServerDevelopersHtml\(\)/);
});
