import test from 'node:test';
import assert from 'node:assert/strict';

import { buildEntityManifest } from '../src/entity-graph/manifest.js';
import { buildArticleSeo } from '../src/entity-graph/article-seo.js';

// Every fixture runs through the real entity dictionary, manifest builder and NewsArticle graph.
const graphOf = (article) => buildArticleSeo(article, buildEntityManifest(article)).jsonLd['@graph'][0];
const names = (nodes) => (nodes || []).map((n) => n.name);

test('coach/team: the coach and his team are the subjects; incidental tagged players are neither about nor mentioned', () => {
  // The 2026-10-02 production story whose card and graph both featured Igor Shesterkin.
  const g = graphOf({
    sport: 'nhl',
    slug: 'cooper-s-frustration-after-5-1-loss-signals-deeper-tampa-bay-malaise-than-season-opener-blow-2026-10-02',
    title: "Cooper's Frustration After 5-1 Loss Signals Deeper Tampa Bay Malaise Than Season-Opener Blowout",
    summary: "Tampa Bay's opening-night collapse to New York exposes the tension between a coach's championship expectations and a roster entering its fifth consecutive first-round-exit cycle.",
    body: 'The Rangers won 5-1. The scoreline, inflated by an empty-net goal from Rangers goaltender Igor Shesterkin, masked mental lapses, including John Carlson\'s second-period scramble. Andrei Vasilevskiy faced 30 shots. The Rangers controlled the third period.',
    take: { teams: ['TBL', 'NYR', 'WSH'], players: ['Jon Cooper', 'Igor Shesterkin', 'John Carlson', 'Andrei Vasilevskiy'] },
  });
  assert.deepEqual(names(g.about), ['Jon Cooper', 'Tampa Bay Lightning']);
  const cooper = g.about[0];
  assert.deepEqual(cooper, { '@type': 'Person', name: 'Jon Cooper' }); // named, no invented URL or @id
  assert.equal(g.about[1]['@type'], 'SportsTeam');
  for (const incidental of ['Igor Shesterkin', 'John Carlson', 'Andrei Vasilevskiy', 'Washington Capitals']) {
    assert.ok(!names(g.about).includes(incidental), `${incidental} in about`);
    assert.ok(!names(g.mentions).includes(incidental), `${incidental} in mentions`);
  }
  assert.deepEqual(names(g.mentions), ['New York Rangers']);
});

test('player-led: the headline player is about; his team and teammates named repeatedly are mentions', () => {
  const g = graphOf({
    sport: 'nfl',
    slug: 'mahomes',
    title: "Mahomes' Deep-Pass Correction Isn't a Fluke—It's a System Fix",
    summary: 'The quarterback has connected on eight of 14 deep balls in September.',
    body: 'Patrick Mahomes leads Kansas City. The Kansas City offense trusts Mahomes. Travis Kelce caught one pass.',
    take: { teams: ['KC', 'LV'], players: ['Patrick Mahomes', 'Travis Kelce'] },
  });
  assert.deepEqual(names(g.about), ['Patrick Mahomes']);
  assert.ok(names(g.mentions).includes('Kansas City Chiefs'));
  assert.ok(!names(g.mentions).includes('Travis Kelce')); // named once
  assert.ok(!names(g.mentions).includes('Las Vegas Raiders')); // tagged, never named
});

test('team-led: the team is about; tagged players named only once are not promoted', () => {
  const g = graphOf({
    sport: 'nhl',
    slug: 'lightning-power-play',
    title: 'Lightning Power Play Stalls Again in Road Loss',
    summary: 'Tampa Bay went 0-for-5 with the man advantage.',
    body: 'Nikita Kucherov and Brayden Point combined for nine shots.',
    take: { teams: ['TBL'], players: ['Nikita Kucherov', 'Brayden Point'] },
  });
  assert.deepEqual(names(g.about), ['Tampa Bay Lightning']);
  assert.deepEqual(names(g.mentions), []);
});

test('multi-player: every player the headline names, in headline order', () => {
  const g = graphOf({
    sport: 'nfl',
    slug: 'kelce-mahomes',
    title: 'Kelce and Mahomes Rediscover Their Red-Zone Rhythm',
    summary: 'Kansas City scored on four of five red-zone trips.',
    body: 'Patrick Mahomes and Travis Kelce connected twice; Rashee Rice added a score.',
    take: { teams: ['KC'], players: ['Patrick Mahomes', 'Rashee Rice', 'Travis Kelce'] },
  });
  assert.deepEqual(names(g.about), ['Travis Kelce', 'Patrick Mahomes']);
  assert.ok(!names(g.about).includes('Rashee Rice'));
});

test('roundup: headline names nobody and the dek names several teams, so nothing is about', () => {
  const g = graphOf({
    sport: 'nfl',
    slug: 'week-4-shadow',
    title: 'Week 4 Shadow Reports: Early Injuries Reshape the Workload Picture',
    summary: "With Green Bay's Reed sidelined and Miami's Achane done for the season, the Week 4 slate rewards teams willing to hunt vacated touches.",
    body: 'Justin Jefferson is monitored. Aaron Rodgers threw twice to the flat. Rodgers looked sharp.',
    take: { teams: ['GB', 'TB', 'MIA', 'MIN'], players: ['Jaylin Reed', 'Mike Evans', "De'Von Achane", 'Justin Jefferson', 'Aaron Rodgers'] },
  });
  assert.equal(g.about, undefined);
  assert.ok(names(g.mentions).includes('Green Bay Packers')); // named in the dek
  assert.ok(names(g.mentions).includes('Aaron Rodgers')); // named twice
  assert.ok(!names(g.mentions).includes('Justin Jefferson')); // named once
  assert.ok(!names(g.mentions).includes('Mike Evans')); // tagged only
});

test('ambiguous / no primary subject: no about at all rather than a guess', () => {
  const g = graphOf({
    sport: 'nfl',
    slug: 'start-sit',
    title: 'Week 4 Start-Sit Decisions: When Instinct Meets Film',
    summary: 'The gap between what you feel and what the numbers show is where fantasy edges live.',
    body: 'Trevor Lawrence and Joe Burrow headline a crowded slate.',
    take: { teams: ['JAX', 'CIN'], players: ['Trevor Lawrence', 'Joe Burrow'] },
  });
  assert.equal(g.about, undefined);
  assert.equal(g.mentions, undefined);
});

test('regressions: shared surnames and name-token cities', () => {
  const brothers = graphOf({
    sport: 'nhl', slug: 'tkachuk', title: 'Tkachuk Brothers Meet Again as Senators Host Panthers',
    summary: 'Ottawa and Florida open a two-game set.', body: 'Brady Tkachuk scored. Matthew Tkachuk assisted twice.',
    take: { teams: ['OTT', 'FLA'], players: ['Brady Tkachuk', 'Matthew Tkachuk'] },
  });
  assert.ok(!names(brothers.about).includes('Brady Tkachuk') && !names(brothers.about).includes('Matthew Tkachuk'));

  const bellinger = graphOf({
    sport: 'mlb', slug: 'bellinger', title: 'Bellinger Delivers in Bronx as Yankees Edge Red Sox in Wild Card Game 2',
    summary: "A ceremonial first pitch from his firefighter father and a three-run homer cement Cody Bellinger's postseason credentials.",
    body: 'Clay Bellinger threw out the first pitch. Cody Bellinger homered.',
    take: { teams: ['NYY', 'BOS'], players: ['Cody Bellinger', 'Clay Bellinger'] },
  });
  assert.equal(names(bellinger.about)[0], 'Cody Bellinger');
  assert.ok(!names(bellinger.about).includes('Clay Bellinger'));

  const washington = graphOf({
    sport: 'nfl', slug: 'darnell-washington', title: "Darnell Washington Isn't Just Viral—He's the Steelers' Offensive Engine",
    summary: "The 6-foot-7 tight end's size creates a structural mismatch for the Steelers' offense.",
    body: 'Washington caught five passes. Washington blocked well.',
    take: { teams: ['PIT', 'CLE'], players: ['Darnell Washington'] },
  });
  assert.deepEqual(names(washington.about), ['Darnell Washington', 'Pittsburgh Steelers']);
  assert.ok(!names(washington.mentions).includes('Washington Commanders'));
});

test('games: about only when the story is about both teams; a one-team feature only mentions the game', async () => {
  const { toGameManifest } = await import('../src/entity-graph/manifest.js');
  const withGame = (article) => {
    const manifest = buildEntityManifest(article);
    manifest.games = [toGameManifest({ sport: article.sport, id: '401772900', home_abbr: 'CLE', away_abbr: 'PIT', name: 'Pittsburgh Steelers at Cleveland Browns' })];
    return buildArticleSeo(article, manifest).jsonLd['@graph'][0];
  };
  const feature = withGame({
    sport: 'nfl', slug: 'darnell-washington', title: "Darnell Washington Isn't Just Viral—He's the Steelers' Offensive Engine",
    summary: "The tight end's size creates a mismatch for the Steelers' offense.", body: 'Washington caught five passes.',
    take: { teams: ['PIT', 'CLE'], players: ['Darnell Washington'] },
  });
  assert.ok(!names(feature.about).includes('Pittsburgh Steelers at Cleveland Browns'));
  assert.ok(names(feature.mentions).includes('Pittsburgh Steelers at Cleveland Browns'));

  const preview = withGame({
    sport: 'nfl', slug: 'tnf', title: 'Steelers Visit Browns With First Place on the Line',
    summary: 'Cleveland and Pittsburgh meet on Thursday night.', body: 'The Browns host the Steelers.',
    take: { teams: ['PIT', 'CLE'], players: [] },
  });
  assert.ok(names(preview.about).includes('Pittsburgh Steelers at Cleveland Browns'));
});
