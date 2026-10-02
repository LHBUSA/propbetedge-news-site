import test from 'node:test';
import assert from 'node:assert/strict';

import { buildEntityManifest } from '../src/entity-graph/manifest.js';
import { selectShareSubject, primarySubject } from '../src/entity-graph/share-image.js';

// Every fixture runs through the real entity dictionary and manifest builder.
const subjectOf = (article) => selectShareSubject(article, buildEntityManifest(article));
const BROKEN_IMAGE = 'https://www.dailyfaceoff.com/_next/image?url=undefined&w=1200&q=75';

test('coach/team article: the coach is not a player, so no other tagged player is substituted (production regression)', () => {
  // The 2026-10-02 production story whose card read "Igor Shesterkin · New York Rangers".
  const article = {
    sport: 'nhl',
    slug: 'cooper-s-frustration-after-5-1-loss-signals-deeper-tampa-bay-malaise-than-season-opener-blow-2026-10-02',
    title: "Cooper's Frustration After 5-1 Loss Signals Deeper Tampa Bay Malaise Than Season-Opener Blowout",
    summary: "Tampa Bay's opening-night collapse to New York exposes the tension between a coach's championship expectations and a roster entering its fifth consecutive first-round-exit cycle.",
    body: "The scoreline, inflated by an empty-net goal from Rangers goaltender Igor Shesterkin, masked mental lapses, including John Carlson's second-period scramble. Andrei Vasilevskiy faced 30 shots.",
    image_url: BROKEN_IMAGE,
    take: { teams: ['TBL', 'NYR', 'WSH'], players: ['Jon Cooper', 'Igor Shesterkin', 'John Carlson', 'Andrei Vasilevskiy'] },
  };
  const s = subjectOf(article);
  assert.equal(s.player, null);
  assert.equal(s.team?.name, 'Tampa Bay Lightning');
  assert.match(s.basis, /^headline:non_player:Jon Cooper$/);
  assert.equal(s.tier, 3); // broken publisher image rejected; the proven team carries the card
  assert.doesNotMatch(s.alt, /Shesterkin|Rangers|Carlson|Vasilevskiy/);
});

test('player article: the player the headline names, with his own team', () => {
  const article = {
    sport: 'nfl',
    slug: 'mahomes',
    title: "Mahomes' Deep-Pass Correction Isn't a Fluke—It's a System Fix",
    summary: 'Kansas City reworked its vertical concepts.',
    body: 'Patrick Mahomes hit Xavier Worthy twice; Travis Kelce was held to three catches.',
    image_url: 'https://a4.espncdn.com/photo/2026/1001/r1724585_1296x729_16-9.jpg',
    take: { teams: ['KC'], players: ['Travis Kelce', 'Patrick Mahomes'] },
  };
  const s = subjectOf(article);
  assert.equal(s.player?.name, 'Patrick Mahomes'); // headline subject beats tag order
  assert.equal(s.tier, 1);
  assert.match(s.alt, /^Patrick Mahomes — /);
  assert.doesNotMatch(s.alt, /Kelce/);
});

test('team article: a team the headline names, no player even when tagged players have headshots', () => {
  const article = {
    sport: 'nhl',
    slug: 'lightning-power-play',
    title: 'Lightning Power Play Stalls Again in Road Loss',
    summary: 'Tampa Bay went 0-for-5 with the man advantage.',
    body: 'Nikita Kucherov and Brayden Point combined for nine shots.',
    take: { teams: ['TBL'], players: ['Nikita Kucherov', 'Brayden Point'] },
  };
  const s = subjectOf(article);
  assert.equal(s.player, null);
  assert.equal(s.team?.name, 'Tampa Bay Lightning');
  assert.notEqual(s.kind, 'player_headshot');
});

test('multi-player article: the player named first in the headline, never one only named in the body', () => {
  const article = {
    sport: 'nfl',
    slug: 'kelce-mahomes',
    title: 'Kelce and Mahomes Rediscover Their Red-Zone Rhythm',
    summary: 'Kansas City scored on four of five red-zone trips.',
    body: 'Patrick Mahomes and Travis Kelce connected twice; Rashee Rice added a score.',
    take: { teams: ['KC'], players: ['Patrick Mahomes', 'Rashee Rice', 'Travis Kelce'] },
  };
  const s = primarySubject(article, buildEntityManifest(article));
  assert.equal(s.player?.name, 'Travis Kelce');
  assert.notEqual(s.player?.name, 'Rashee Rice');
});

test('no valid subject and no valid image: text-only card with no name on it', () => {
  const article = {
    sport: 'nhl',
    slug: 'league-memo',
    title: 'League Memo Clarifies Offside Review Standard',
    summary: 'The change takes effect next week.',
    body: 'Igor Shesterkin and Andrei Vasilevskiy were both affected by reviews last season.',
    image_url: BROKEN_IMAGE,
    take: { teams: ['NYR', 'TBL'], players: ['Igor Shesterkin', 'Andrei Vasilevskiy'] },
  };
  const s = subjectOf(article);
  assert.equal(s.tier, 4);
  assert.equal(s.image, null);
  assert.equal(s.player, null);
  assert.equal(s.team, null);
  assert.equal(s.alt, 'PropBetEdge NHL coverage');
});

test('team named by possessive city in a team-led headline wins over the opponent', () => {
  const article = {
    sport: 'nhl',
    slug: 'vancouver-upset',
    title: "Vancouver's Opening Night Upset Over Edmonton Reshuffles Tank Narratives",
    summary: 'The Canucks beat the Oilers in overtime.',
    body: 'Paul Cotter scored the winner for the Vancouver Canucks against the Edmonton Oilers.',
    take: { teams: ['EDM', 'VAN'], players: ['Paul Cotter'] },
  };
  const s = subjectOf(article);
  assert.equal(s.team?.name, 'Vancouver Canucks');
  assert.equal(s.player, null); // Cotter is not named in the headline
});

test('roundup: headline names nobody and the dek names several teams, so the card names nobody', () => {
  const article = {
    sport: 'nfl',
    slug: 'week-4-shadow',
    title: 'Week 4 Shadow Reports: Early Injuries Reshape the Workload Picture',
    summary: "With Green Bay's Reed sidelined and Miami's Achane done for the season, the Week 4 slate rewards teams willing to hunt vacated touches.",
    body: 'Justin Jefferson and Aaron Rodgers are monitored.',
    take: { teams: ['GB', 'TB', 'MIA', 'MIN'], players: ['Jaylin Reed', 'Mike Evans', "De'Von Achane", 'Justin Jefferson'] },
  };
  const s = primarySubject(article, buildEntityManifest(article));
  assert.equal(s.player, null);
  assert.equal(s.team, null);
});
