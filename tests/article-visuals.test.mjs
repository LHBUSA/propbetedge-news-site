import test from 'node:test';
import assert from 'node:assert/strict';
import { renderArticleVisuals } from '../src/article-visuals.js';

test('article visuals render only article facts and tagged entities', () => {
  const article = {
    id: 'a1',
    sport: 'mlb',
    slug: 'example-story',
    body: 'The starter struck out 9 hitters over 6 innings. He allowed 4 hits and the offense added 2 home runs.',
    take: {
      impact_score: 4,
      prop_types: ['k_prop', 'hr'],
    },
  };
  const manifest = {
    players: [{ id: '123', name: 'Example Pitcher', path: '/player/mlb/123', image_url: 'https://example.com/p.png' }],
    teams: [{ name: 'Example Club', abbreviation: 'EX', path: '/team/mlb/example-club', logo_url: 'https://example.com/t.png' }],
  };

  const html = renderArticleVisuals(article, manifest);
  assert.match(html, /PBE DATA VIEW/);
  assert.match(html, />4<\/strong><span>\/5/);
  assert.match(html, />9<\/strong>\s*<span>K</);
  assert.match(html, />6<\/strong>\s*<span>IP</);
  assert.match(html, /Strikeouts/);
  assert.match(html, /Home Runs/);
  assert.match(html, /Example Pitcher/);
  assert.match(html, /data-pbe-player-chart/);
});

test('article visuals never fill missing values with fake zeroes', () => {
  const article = { id: 'a2', sport: 'nfl', slug: 'empty-story', body: 'A roster update without any published statistics.', take: null };
  const html = renderArticleVisuals(article, { players: [], teams: [] });
  assert.equal(html, '');
});
