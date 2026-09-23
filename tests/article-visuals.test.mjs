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
  assert.match(html, /PBE DATA INTELLIGENCE/);
  assert.match(html, /Here’s the data\./);
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


test('availability stories become a roster ripple, not a generic entity box', () => {
  const article = {
    id: 'nfl-availability',
    sport: 'nfl',
    title: 'Jets place two players on IR',
    body: 'David Onyemata was placed on injured reserve after a groin injury. Mason Taylor is week-to-week with a thumb injury. Jowon Briggs will now absorb a larger role in the interior rotation.',
    take: {
      impact_score: 4,
      prop_types: ['sacks', 'passing_yards', 'team_total'],
    },
  };
  const manifest = {
    players: [
      { id: '1', name: 'David Onyemata', position: 'DT', path: '/player/nfl/1', image_url: '/onyemata.png' },
      { id: '2', name: 'Mason Taylor', position: 'TE', path: '/player/nfl/2', image_url: '/taylor.png' },
      { id: '3', name: 'Jowon Briggs', position: 'DT', path: '/player/nfl/3', image_url: '/briggs.png' },
    ],
    teams: [{ name: 'New York Jets', abbreviation: 'NYJ', path: '/team/nfl/new-york-jets', logo_url: '/nyj.png' }],
  };

  const html = renderArticleVisuals(article, manifest);
  assert.match(html, /ROSTER RIPPLE/);
  assert.match(html, /AVAILABILITY HIT/);
  assert.match(html, /ROLE SHIFT/);
  assert.match(html, /David Onyemata/);
  assert.match(html, /Mason Taylor/);
  assert.match(html, /Jowon Briggs/);
  assert.match(html, /Sacks/);
  assert.match(html, /Passing Yards/);
  assert.doesNotMatch(html, /MARKET FOOTPRINT/);
});
