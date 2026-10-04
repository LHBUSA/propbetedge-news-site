import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sport = readFileSync(new URL('../src/pages/sport.js', import.meta.url), 'utf8');
const article = readFileSync(new URL('../src/pages/article.js', import.meta.url), 'utf8');

test('standard sport highlight videos still play on-site', () => {
  assert.match(sport, /youtube\.com\/embed/);
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



// Since b0be918 the IFrame API exists for NFL ONLY (runtime restriction detection); every other sport keeps plain
// standard embeds. The API loader and player construction must stay inside the NFL path.
test('sport highlights use plain standard YouTube embeds; the IFrame API is confined to the NFL path', () => {
  assert.match(sport, /youtube\.com\/embed/);
  const nflStart = sport.indexOf('function loadNflYouTubeApi');
  assert.ok(nflStart >= 0, 'the NFL-only API loader exists');
  for (const re of [/youtube\.com\/iframe_api/g, /onYouTubeIframeAPIReady/g]) {
    for (const m of sport.matchAll(re)) assert.ok(m.index > nflStart && m.index < nflStart + 2500, `${re} outside the NFL loader`);
  }
  const player = sport.indexOf('new YT.Player');
  assert.ok(player > 0 && /Nfl/i.test(sport.slice(Math.max(0, sport.lastIndexOf('function ', player) - 1), player)), 'YT.Player only built in an NFL function');
  assert.match(sport, /params\.set\('origin', window\.location\.origin\)/);
});



test('highlight API keeps official-channel videos visible instead of pre-filtering the rail away', () => {
  const source = readFileSync(new URL('../api/youtube-highlights.js', import.meta.url), 'utf8');
  assert.match(source, /selectHighlights\(parseFeed\(xml, sport\), sport, limit\)/);
  assert.doesNotMatch(source, /selectEmbeddableHighlights/);
  assert.doesNotMatch(source, /verifyYouTubeEmbed/);
  assert.doesNotMatch(source, /isOnsitePlaybackCandidate/);
});


test('NFL feed remains complete and is not pre-filtered by embed heuristics', () => {
  const source = readFileSync(new URL('../api/youtube-highlights.js', import.meta.url), 'utf8');
  assert.match(source, /const videos = selectHighlights\(parseFeed\(xml, sport\), sport, limit\)/);
  assert.doesNotMatch(source, /annotateNflEmbeddability/);
  assert.doesNotMatch(source, /youtube\.com\/oembed/);
});

test('NFL alone detects embed failures at runtime while other sport rendering stays on the existing path', () => {
  assert.match(sport, /if \(sport === 'nfl'\) \{\s*renderNflHighlightsSlot\(data\);\s*return;\s*\}/);
  assert.match(sport, /new YT\.Player\(host/);
  assert.match(sport, /\[5, 100, 101, 150, 153\]/);
  assert.match(sport, /rememberNflExternalVideo/);
  assert.match(sport, /Watch on YouTube/);
  assert.match(sport, /renderNflHighlightCard/);
  assert.match(sport, /function renderHighlightCard\(video, label\)/);
});
