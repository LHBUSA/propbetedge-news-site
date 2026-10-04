// Homepage brand closer (owner 2026-10-04): homepage-only, sells the decision pipeline, never a link grid.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderHomeCloser } from '../src/components/home-closer.js';
import { renderFooter } from '../src/components/footer.js';

const html = renderHomeCloser();
const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('copy: headline, body, pipeline, vow and the two CTAs', () => {
  assert.match(text, /Sports information is everywhere\. Decision intelligence isn’t\./);
  for (const s of ['Live data', 'PBE model', 'Market check', 'The record']) assert.ok(text.includes(s), s);
  assert.match(text, /Kalshi · Polymarket · movement/);
  assert.match(text, /No black-box pick\. No rewritten history\. The evidence stays with the call\./);
  assert.match(html, /href="\/pro"[^>]*>Explore All Access/);
  assert.match(html, /href="\/odds\/history"[^>]*>See the track record/);
});

test('no fabricated numbers, no sport/product navigation, no promo code', () => {
  assert.deepEqual(text.match(/\d+/g), ['01', '02', '03', '04']); // stage indices only
  assert.doesNotMatch(html, /mlb\.|nfl\.|nhl\.|ufc\.|PBEcast|PBE Cast|Player DNA|API|promo|code/i);
  assert.equal((html.match(/<a /g) || []).length, 2);
});

// The generic "Go deeper than the article." network CTA is suppressed on an explicit list only: the homepage (its own
// brand closer), ARTICLES (owner P0 2026-10-04: the sport-specific MORE THAN NEWS closer from article-funnel.js does
// that job) and the trust / author / editorial pages that already opted out. Every other page keeps it.
const SUPPRESSED = ['home.js', 'article.js', 'author.js', 'authors.js', 'editorial-standards.js', 'trust.js'];

test('scope: generic footer CTA suppressed on the explicit list only; every other page keeps it', () => {
  assert.match(renderFooter(), /footer-cta/);
  assert.doesNotMatch(renderFooter({ cta: false }), /footer-cta/);
  assert.match(renderFooter({ cta: false }), /<footer class="footer">/, 'the real footer stays');
  const home = fs.readFileSync('src/pages/home.js', 'utf8');
  assert.match(home, /\$\{renderHomeCloser\(\)\}\s*<\/main>\s*\$\{renderFooter\(\{ cta: false \}\)\}/);
  for (const f of fs.readdirSync('src/pages').filter((x) => x.endsWith('.js'))) {
    const src = fs.readFileSync(`src/pages/${f}`, 'utf8');
    if (!src.includes('renderFooter(')) continue;
    assert.equal(src.includes('renderFooter({ cta: false })'), SUPPRESSED.includes(f), `${f}: footer CTA scope`);
  }
});

test('article: no generic footer CTA, real footer kept, sport-specific MORE THAN NEWS closer still injected', () => {
  const article = fs.readFileSync('src/pages/article.js', 'utf8');
  assert.match(article, /\$\{renderFooter\(\{ cta: false \}\)\}/);
  assert.doesNotMatch(article, /renderFooter\(\)|ad_footer_banner|footer-cta|Go deeper than the article/);
  const footer = renderFooter({ cta: false });
  assert.doesNotMatch(footer, /footer-cta|Go deeper than the article\./);
  assert.match(footer, /<footer class="footer">/);
  const funnel = fs.readFileSync('src/article-funnel.js', 'utf8');
  assert.match(funnel, /renderMoreThanNewsCta\(sport, \{ placement: 'article_footer', pageType: 'article', slug \}\)/);
  assert.match(fs.readFileSync('src/intelligence-cta.js', 'utf8'), /<aside class="pbe-intel-closer"/);
});

test('motion respects prefers-reduced-motion; pulse is transform-only (no layout shift)', () => {
  const css = fs.readFileSync('src/styles/home-closer.css', 'utf8');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.pbe-closer__rail \{ display: none; \}/);
  const kf = css.match(/@keyframes pbe-closer-pulse \{[\s\S]*?\n\}/)[0];
  assert.doesNotMatch(kf, /\b(top|left|height|width|margin)\s*:/);
  assert.doesNotMatch(html, /\sstyle="/);
});
