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


test('MLB evidence preserves comma milestones and rejects speculative prop ranges', () => {
  const article = {
    id: 'wheeler-2000',
    sport: 'mlb',
    title: "Wheeler's 2,000th K Marks Peak Form Heading Into October",
    body: [
      "Zack Wheeler reached his 2,000th career strikeout Tuesday night against Milwaukee.",
      "Wheeler entered Tuesday at 13-5 with a 2.99 ERA.",
      "Wheeler's strikeout rate sits at 11.2 per nine innings for the season.",
      "The Rays strike out at a 23.8% clip this season.",
      "The market will likely price Wheeler's K line conservatively given the postseason context (typically 5.5 to 6.5 strikeouts for five-inning samples).",
    ].join(' '),
    take: {
      impact_score: 4,
      prop_types: ['k_prop'],
      advice: "Lean over on Wheeler's strikeout prop if the market posts 5.5 to 6.5.",
    },
  };
  const manifest = {
    players: [{ id: '554430', name: 'Zack Wheeler', position: 'P', path: '/player/mlb/554430' }],
    teams: [{ name: 'Philadelphia Phillies', abbreviation: 'PHI', path: '/team/mlb/philadelphia-phillies' }],
  };

  const html = renderArticleVisuals(article, manifest);
  assert.match(html, />2,000<\/strong>\s*<b>CAREER K<\/b>/);
  assert.match(html, />2\.99<\/strong>\s*<b>ERA<\/b>/);
  assert.match(html, />11\.2<\/strong>\s*<b>K\/9<\/b>/);
  assert.match(html, />23\.8%<\/strong>\s*<b>OPP K%<\/b>/);
  assert.doesNotMatch(html, />000<\/strong>/);
  assert.doesNotMatch(html, />6\.5<\/strong>\s*<b>K<\/b>/);
  assert.doesNotMatch(html, /PBE READ/);
  assert.doesNotMatch(html, /Lean over on Wheeler/);
});


test('NFL QB performance stories are not reclassified as injury stories by body context', () => {
  const article = {
    id: 'purdy-performance',
    sport: 'nfl',
    title: "Purdy's Fundamental Overhaul Sets Up Cleaner Passing Volume in 2026",
    summary: 'The 49ers QB has improved his completion efficiency through two games and is sustaining cleaner passing volume.',
    body: [
      'Brock Purdy has completed 80.4% of his passes through two games.',
      'Christian Kirk, De\'Zhaun Stribling, and Demarcus Robinson are all sidelined or limited.',
      'The injury toll at receiver is real, but Purdy\'s processing gains are the center of the story.',
    ].join(' '),
    take: {
      impact_score: 3,
      prop_types: ['passing_completions'],
    },
  };
  const manifest = {
    players: [
      { id: '4361741', name: 'Brock Purdy', position: 'QB', path: '/player/nfl/4361741', image_url: '/purdy.png' },
      { id: '3895856', name: 'Christian Kirk', position: 'WR', path: '/player/nfl/3895856', image_url: '/kirk.png' },
      { id: '999', name: "De'Zhaun Stribling", position: 'WR', path: '/player/nfl/999', image_url: '/stribling.png' },
    ],
    teams: [{ name: 'San Francisco 49ers', abbreviation: 'SF', path: '/team/nfl/san-francisco-49ers', logo_url: '/sf.png' }],
  };

  const html = renderArticleVisuals(article, manifest);
  assert.match(html, /data-archetype="trend"/);
  assert.match(html, /data-player-id="4361741"/);
  assert.match(html, /Passing Completions/);
  assert.match(html, /Brock Purdy/);
  assert.doesNotMatch(html, /ROSTER RIPPLE/);
  assert.doesNotMatch(html, /Christian Kirk/);
});
