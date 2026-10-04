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

test('scope: homepage suppresses the generic footer CTA; every other footer keeps it', () => {
  assert.match(renderFooter(), /footer-cta/);
  assert.doesNotMatch(renderFooter({ cta: false }), /footer-cta/);
  const home = fs.readFileSync('src/pages/home.js', 'utf8');
  assert.match(home, /\$\{renderHomeCloser\(\)\}\s*<\/main>\s*\$\{renderFooter\(\{ cta: false \}\)\}/);
  const others = fs.readdirSync('src/pages').filter((f) => f.endsWith('.js') && f !== 'home.js').map((f) => fs.readFileSync(`src/pages/${f}`, 'utf8'));
  assert.ok(others.every((s) => !s.includes('renderHomeCloser') && !s.includes('renderFooter({ cta: false })')));
});

test('motion respects prefers-reduced-motion; pulse is transform-only (no layout shift)', () => {
  const css = fs.readFileSync('src/styles/home-closer.css', 'utf8');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.pbe-closer__rail \{ display: none; \}/);
  const kf = css.match(/@keyframes pbe-closer-pulse \{[\s\S]*?\n\}/)[0];
  assert.doesNotMatch(kf, /\b(top|left|height|width|margin)\s*:/);
  assert.doesNotMatch(html, /\sstyle="/);
});
