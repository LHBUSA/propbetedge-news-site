import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sport = readFileSync(new URL('../src/pages/sport.js', import.meta.url), 'utf8');
const article = readFileSync(new URL('../src/pages/article.js', import.meta.url), 'utf8');

test('standard sport highlight videos still play on-site', () => {
  assert.match(sport, /youtube\\.com\\/embed/);
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



test('sport highlights use plain standard YouTube embeds without the fragile IFrame API wrapper', () => {
  assert.match(sport, /youtube\\.com\\/embed/);
  assert.doesNotMatch(sport, /youtube\.com\/iframe_api/);
  assert.doesNotMatch(sport, /onYouTubeIframeAPIReady/);
  assert.doesNotMatch(sport, /new YT\.Player/);
  assert.match(sport, /params\.set\('origin', window\.location\.origin\)/);
});



test('highlight API keeps official-channel videos visible instead of pre-filtering the rail away', () => {
  const source = readFileSync(new URL('../api/youtube-highlights.js', import.meta.url), 'utf8');
  assert.match(source, /selectHighlights\(parseFeed\(xml, sport\), sport, limit\)/);
  assert.doesNotMatch(source, /selectEmbeddableHighlights/);
  assert.doesNotMatch(source, /verifyYouTubeEmbed/);
  assert.doesNotMatch(source, /isOnsitePlaybackCandidate/);
});


test('NFL embed policy is annotated per video without deleting or reordering the feed', () => {
  const source = readFileSync(new URL('../api/youtube-highlights.js', import.meta.url), 'utf8');
  assert.match(source, /sport === 'nfl'\s*\? await annotateNflEmbeddability\(selectedVideos\)\s*:\s*selectedVideos/);
  assert.match(source, /youtube\.com\/oembed/);
  assert.match(source, /return checks\.map/);
  assert.doesNotMatch(source, /filter\([^\n]*embeddable/);
});

test('NFL alone gets restricted-video handling while other sport rendering stays on the existing path', () => {
  assert.match(sport, /if \(sport === 'nfl'\) \{\s*renderNflHighlightsSlot\(data\);\s*return;\s*\}/);
  assert.match(sport, /videos\.find\(\(video\) => video\.embeddable === true\)/);
  assert.match(sport, /Watch on YouTube/);
  assert.match(sport, /renderNflHighlightCard/);
  assert.match(sport, /function renderHighlightCard\(video, label\)/);
});
