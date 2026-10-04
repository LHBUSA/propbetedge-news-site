// Editorial Standards V2 (public trust center). Asserts POLICY GUARANTEES on the rendered page and crawler copy,
// not paragraph wording: rephrasing a sentence must not fail these, removing a guarantee must.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// renderHeader() reads window/document; a minimal stub is enough to render the page as a string.
globalThis.window ??= { location: { pathname: '/editorial-standards', search: '', hostname: 'propbetedge.ai' }, matchMedia: () => ({ matches: false }) };
globalThis.document ??= { querySelector: () => null, getElementById: () => null };
globalThis.localStorage ??= { getItem: () => null, setItem: () => {} };

const { editorialStandardsHtml, STANDARDS_TOC, MODEL_STATES } = await import('../src/pages/editorial-standards.js');
const html = editorialStandardsHtml();
const main = html.slice(html.indexOf('<main class="es"'), html.indexOf('</main>'));
const text = main.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/\s+/g, ' ');
const src = fs.readFileSync(new URL('../src/pages/editorial-standards.js', import.meta.url), 'utf8');
const mw = fs.readFileSync(new URL('../middleware.js', import.meta.url), 'utf8');
const ssr = mw.slice(mw.indexOf('function buildServerEditorialStandardsHtml'), mw.indexOf('function buildAuthorSchema'));
const section = (id) => { const at = main.indexOf(`id="${id}"`); return main.slice(at, main.indexOf('</section>', at)); };

test('TOC: every entry is a plain anchor to a section that exists (works without JS)', () => {
  assert.equal(STANDARDS_TOC.length, 10);
  for (const [id] of STANDARDS_TOC) {
    assert.ok(main.includes(`<a href="#${id}">`), `toc link #${id}`);
    assert.match(main, new RegExp(`<section class="es-sec[^"]*" id="${id}"`), `section #${id}`);
  }
});

test('sources: primary-source preference + conflict rule (uncertainty or hold)', () => {
  const s = section('sources').toLowerCase();
  assert.match(s, /primary/);
  assert.ok(s.indexOf('primary') < s.indexOf('secondary'), 'primary ranked above secondary');
  assert.match(s, /conflict/);
  assert.match(s, /hold/);
});

test('AI disclosure: AI and automation are used; missing evidence means hold, not fill-in', () => {
  const s = section('ai').replace(/<[^>]+>/g, ' ').toLowerCase();
  assert.match(s, /uses ai and automation/);
  assert.match(s, /hold/);
  assert.match(s, /invented quotes|unsupported numbers/);
  assert.match(s, /vary by product/);
});

test('bylines: named humans vs the operational byline; the operational byline is never a person', () => {
  const s = section('bylines');
  for (const name of ['Justin Erickson', 'Erik Schwartz', 'Ty Whitney', 'PropBetEdge Editorial Team']) assert.ok(s.includes(name), name);
  assert.match(s, /operational newsroom byline, not a fictitious person/i);
  assert.match(s, /href="\/authors"/);
  // the Editorial Team appears only in the operational column
  const human = s.slice(s.indexOf('Named human'), s.indexOf('Operational newsroom'));
  assert.doesNotMatch(human, /PropBetEdge Editorial Team/);
});

test('models: probabilistic; market observation distinct from model output; no backfill', () => {
  const s = section('models').replace(/<[^>]+>/g, ' ');
  assert.match(s, /probabilistic/i);
  assert.match(s, /Market observation/);
  assert.match(s, /Derived PBE metric/);
  assert.match(s, /Markets do not become model truth/i);
  assert.match(s, /not backfilled/i);
  assert.deepEqual([...MODEL_STATES], ['MONITORING', 'SHADOW', 'RESEARCH', 'VALIDATED', 'OFFICIAL'], 'canonical states only');
  assert.match(s, /not a confidence adjective/i);
});

test('publication gates: stories can be withheld; evidence beats prose; no internal gate names', () => {
  const s = section('gates').replace(/<[^>]+>/g, ' ');
  assert.match(s, /withheld/i);
  assert.match(s, /evidence wins/i);
  assert.doesNotMatch(s, /[A-Z]{3,}_[A-Z_]{3,}|threshold|\d+%/, 'no internal identifiers or thresholds');
});

test('corrections: history preserved, timestamps kept, reader channel present', () => {
  const s = section('corrections').replace(/<[^>]+>/g, ' ');
  assert.match(s, /not deletion of history/i);
  assert.match(s, /Publication timestamps/);
  assert.match(section('corrections'), /href="mailto:editorial@proptechusa\.ai"/);
  assert.match(s, /article URL/i);
});

test('independence, responsible betting, ownership and contacts', () => {
  assert.match(section('independence'), /do not authorize a sponsor, data provider or platform partner to alter an editorial conclusion/);
  const rb = section('responsible-betting');
  assert.match(rb, /not a sportsbook/);
  assert.match(rb, /1-800-GAMBLER/);
  assert.match(rb, /chase losses/);
  const acc = section('accountability');
  for (const m of ['editorial@proptechusa.ai', 'support@proptechusa.ai', 'press@proptechusa.ai']) assert.ok(acc.includes(`mailto:${m}`), m);
  assert.ok(text.includes('PropBetEdge is operated by Local Home Buyers LLC d/b/a PropTechUSA.ai.'), 'legal identity verbatim');
});

test('page closes with accountability, then the footer: no homepage brand closer here; homepage unchanged', () => {
  assert.doesNotMatch(src, /renderHomeCloser/);
  assert.match(src, /\$\{renderFooter\(\{ cta: false \}\)\}/);
  assert.ok(main.lastIndexOf('id="accountability"') > main.lastIndexOf('id="responsible-betting"'));
  assert.match(fs.readFileSync(new URL('../src/pages/home.js', import.meta.url), 'utf8'), /\$\{renderHomeCloser\(\)\}/);
  assert.doesNotMatch(src, /<style>/, 'styles live in src/styles/editorial-standards.css');
});

test('schema + crawler copy: canonical WebPage, dates, and the same policy story', () => {
  assert.match(src, /'@id': 'https:\/\/propbetedge\.ai\/editorial-standards#webpage'/);
  assert.match(src, /canonical: 'https:\/\/propbetedge\.ai\/editorial-standards'/);
  assert.match(src, /datePublished: '2026-04-29'/);
  assert.match(src, /dateModified: UPDATED_ISO/);
  assert.match(src, /publisher: \{ '@id': 'https:\/\/propbetedge\.ai\/#organization' \}/);
  for (const re of [/operational newsroom byline, not a fictitious person/i, /uses AI and automation/i, /primary or official evidence/i, /Models are probabilistic/i, /not silently rewritten/i, /1-800-GAMBLER/]) assert.match(ssr, re);
});
