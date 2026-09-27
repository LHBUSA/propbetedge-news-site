import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const about = fs.readFileSync(new URL('../src/pages/about.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../src/styles/pbe-about.css', import.meta.url), 'utf8');

test('About newsroom uses official PropBetEdge logo instead of generic PBE tile', () => {
  assert.match(about, /\/logo\/pbe-full-400\.png/);
  assert.doesNotMatch(about, /about-news-mark">PBE/);
  assert.match(about, /NEWS <i>•<\/i> DATA <i>•<\/i> INTELLIGENCE/);
});

test('About newsroom ships premium editorial hero treatment', () => {
  assert.match(css, /\.about-news-brand-frame/);
  assert.match(css, /\.about-news-logo/);
  assert.match(css, /\.about-news-cta/);
  assert.match(css, /photo-1666366330282-b11566b272cf/);
});
