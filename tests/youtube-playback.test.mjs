import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sport = readFileSync(new URL('../src/pages/sport.js', import.meta.url), 'utf8');
const article = readFileSync(new URL('../src/pages/article.js', import.meta.url), 'utf8');

test('sport highlight videos play on-site instead of redirecting to YouTube', () => {
  assert.match(sport, /youtube-nocookie\.com\/embed/);
  assert.match(sport, /data-highlight-video-id/);
  assert.match(sport, /Play here/);
  assert.match(sport, /Playing on PropBetEdge/);
  assert.doesNotMatch(sport, /class="sport-highlight-card"\s+href=/);
  assert.doesNotMatch(sport, /class="sport-highlight-frame sport-highlight-featured-link"/);
});

test('article YouTube media derives a privacy-enhanced on-site embed', () => {
  assert.match(article, /youtubeVideoIdFromEmbed/);
  assert.match(article, /youtube-nocookie\.com\/embed/);
  assert.match(article, /Plays on PropBetEdge/);
  assert.match(article, /picture-in-picture; web-share/);
});


test('NFL highlight source rejects rights-restricted full-game replay candidates', () => {
  const source = readFileSync(new URL('../api/youtube-highlights.js', import.meta.url), 'utf8');
  assert.match(source, /isOnsitePlaybackCandidate/);
  assert.match(source, /\\bfull game\\b/);
  assert.match(source, /\\bcondensed game\\b/);
  assert.match(source, /sport !== 'nfl'/);
});


test('sport highlights detect YouTube embed-policy failures and advance', () => {
  assert.match(sport, /youtube\.com\/iframe_api/);
  assert.match(sport, /onYouTubeIframeAPIReady/);
  assert.match(sport, /\[5, 100, 101, 150, 153\]/);
  assert.match(sport, /blocked embed; advancing/);
  assert.match(sport, /params\.set\('origin', window\.location\.origin\)/);
});
