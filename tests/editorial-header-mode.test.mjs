// Institutional pages use the quiet editorial header; the score-strip marquee clone never duplicates content
// in the accessibility tree (owner 2026-10-04).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('institutional / editorial pages render the editorial header mode; sports pages keep the full chrome', () => {
  for (const p of ['about', 'author', 'author-founder', 'authors', 'editorial-standards', 'trust']) {
    assert.match(read(`src/pages/${p}.js`), /renderHeader\(\{ mode: 'editorial' \}\)/, p);
  }
  for (const p of ['home', 'article', 'sport', 'games-hub-worldclass', 'odds']) {
    assert.match(read(`src/pages/${p}.js`), /renderHeader\(\)/, `${p} keeps the sports header`);
  }
  const header = read('src/components/header.js');
  assert.match(header, /\$\{editorial \? '' : renderScoreStripShell\(\)\}/);
  assert.match(header, /\$\{editorial \? '' : ad_header_banner\(/);
  assert.match(header, /\$\{editorial \? '' : renderUfcFightWeekShell\(\)\}/);
});

test('score-strip marquee: the loop copy is aria-hidden, unfocusable and marked; originals untouched', async () => {
  const { marqueeClone } = await import('../src/components/score-strip.js');
  const tiles = '<a class="pss-tile" href="/a" data-game-id="1">A</a><a class="pss-tile" href="/b" data-game-id="2">B</a>';
  const clone = marqueeClone(tiles);
  assert.equal((clone.match(/aria-hidden="true"/g) || []).length, 2);
  assert.equal((clone.match(/tabindex="-1"/g) || []).length, 2);
  assert.equal((clone.match(/data-pss-clone="1"/g) || []).length, 2);
  assert.doesNotMatch(tiles, /aria-hidden/);
  assert.match(read('src/components/score-strip.js'), /railEl\.innerHTML = tiles \+ marqueeClone\(tiles\);/);
});
