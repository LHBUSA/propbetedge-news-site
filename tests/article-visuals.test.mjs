import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { metricSummary, nflRecentMetric, renderArticleVisuals, renderPlayerContext } from '../src/article-visuals.js';

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


test('NFL RB current-form charts default to rushing even when receiving props are tagged first', () => {
  const article = {
    sport: 'nfl',
    title: 'Aaron Jones Sr. enters a short-term lead role against San Francisco',
    summary: 'Carolina adjusts its backfield usage for the matchup.',
    take: {
      prop_types: ['receiving_yards', 'receiving_tds', 'anytime_td', 'rushing_yards'],
    },
  };

  assert.deepEqual(nflRecentMetric(article, 'RB'), ['rushingYards', 'Rushing Yards']);
});

test('NFL RB current-form charts may use receiving when the story itself is explicitly about receiving work', () => {
  const article = {
    sport: 'nfl',
    title: 'Aaron Jones receiving role expands as Panthers lean on him in the passing game',
    summary: 'Targets and receptions are the focus of the matchup.',
    take: {
      prop_types: ['receiving_yards', 'rushing_yards'],
    },
  };

  assert.deepEqual(nflRecentMetric(article, 'RB'), ['receivingYards', 'Receiving Yards']);
});

test('NFL WR/TE and QB form charts remain position appropriate', () => {
  const wr = { sport: 'nfl', take: { prop_types: ['rushing_yards', 'receiving_yards'] } };
  const qb = { sport: 'nfl', take: { prop_types: ['receiving_yards', 'passing_yards'] } };

  assert.deepEqual(nflRecentMetric(wr, 'WR'), ['receivingYards', 'Receiving Yards']);
  assert.deepEqual(nflRecentMetric(qb, 'QB'), ['passingYards', 'Passing Yards']);
});


test('story evidence cards preserve the full published sentence instead of cutting explainers mid-thought', () => {
  const article = {
    id: 'cubs-weather',
    sport: 'mlb',
    title: 'Cubs add Kevin Gausman before a windy matchup',
    body: "Wind gusts of 10-20 mph out of the northeast, consistent with Tuesday's conditions, will suppress fly-ball carry — a modest tailwind for Chicago's offense against a pitcher whose game is built around limiting hard airborne contact.",
    take: {
      impact_score: 4,
      prop_types: ['k_prop', 'team_total', 'moneyline'],
    },
  };
  const manifest = {
    players: [{ id: '592332', name: 'Kevin Gausman', position: 'P', path: '/player/mlb/592332' }],
    teams: [{ name: 'Chicago Cubs', abbreviation: 'CHC', path: '/team/mlb/chicago-cubs' }],
  };

  const html = renderArticleVisuals(article, manifest);
  assert.match(html, /modest tailwind for Chicago's offense against a pitcher whose game is built around limiting hard airborne contact\./);
  assert.doesNotMatch(html, /Chicago's offense against a pitcher whose game is built…/);
});


test('evidence explainers never apply a character cap across sports', () => {
  const longContext = [
    'His defensive workload has been steady—62 snaps across both games—suggesting the Jaguars were testing his availability and conditioning post-injury before committing him to a heavy role',
    'while also moving him across multiple alignments and asking him to handle motion adjustments in high-leverage situations',
    'with the offense changing personnel groupings repeatedly and the coaching staff continuing to test how much two-way volume he can carry',
    'this intentionally long source passage has no sentence terminator after the metric and must remain intact all the way through END OF CONTEXT'
  ].join(' ');
  const article = {
    id: 'hunter-snaps',
    sport: 'nfl',
    title: 'Travis Hunter workload rises before matchup',
    body: longContext,
    take: { impact_score: 3, prop_types: ['receiving_yards'] },
  };
  const manifest = {
    players: [{ id: '1', name: 'Travis Hunter', position: 'WR', path: '/player/nfl/1' }],
    teams: [{ name: 'Jacksonville Jaguars', abbreviation: 'JAX', path: '/team/nfl/jacksonville-jaguars' }],
  };

  const html = renderArticleVisuals(article, manifest);
  assert.match(html, /62<\/strong>\s*<b>SNAPS<\/b>/);
  assert.match(html, /END OF CONTEXT/);
  assert.doesNotMatch(html, /heavy role…/);
  assert.doesNotMatch(html, /CONTEXT…/);
});

test('evidence card CSS explicitly forbids line-clamp and overflow clipping', () => {
  const css = fs.readFileSync(new URL('../src/styles/pbe-article-visuals.css', import.meta.url), 'utf8');
  assert.match(css, /\.pbe-av-evidence-card p\s*\{[\s\S]*max-height:\s*none !important;/);
  assert.match(css, /\.pbe-av-evidence-card p\s*\{[\s\S]*overflow:\s*visible !important;/);
  assert.match(css, /-webkit-line-clamp:\s*unset !important;/);
  assert.match(css, /text-overflow:\s*clip !important;/);
});


test('editorial evidence groups one stat line into one non-repetitive story card', () => {
  const sentence = 'Last season he posted 30 points — 5 goals and 25 assists across 81 games — while maintaining the defensive infrastructure the Senators built around him.';
  const article = {
    id: 'ottawa-statline',
    sport: 'nhl',
    title: 'Ottawa adjusts its blue line around a key absence',
    body: sentence,
    take: {
      impact_score: 4,
      prop_types: ['points'],
    },
  };
  const manifest = {
    players: [{ id: '1', name: 'Example Senator', position: 'D', path: '/player/nhl/1' }],
    teams: [{ name: 'Ottawa Senators', abbreviation: 'OTT', path: '/team/nhl/ottawa-senators' }],
  };

  const html = renderArticleVisuals(article, manifest);
  assert.equal((html.match(/Last season he posted 30 points/g) || []).length, 1, 'shared source sentence appears once');
  assert.equal((html.match(/pbe-av-evidence-card/g) || []).length, 1, 'one sentence becomes one evidence card');
  assert.match(html, /class="pbe-av-evidence-card is-statline"/);

  const pts = html.indexOf('<b>PTS</b>');
  const goals = html.indexOf('<b>G</b>');
  const assists = html.indexOf('<b>A</b>');
  assert.ok(pts >= 0 && goals > pts && assists > goals, 'editorial total appears before component stats');
  assert.match(html, /<strong>30</strong>s*<b>PTS</b>/);
  assert.match(html, /<strong>5</strong>s*<b>G</b>/);
  assert.match(html, /<strong>25</strong>s*<b>A</b>/);
});

test('evidence grid expands distinct thoughts rather than leaving quarter-width orphan cards', () => {
  const css = fs.readFileSync(new URL('../src/styles/pbe-article-visuals.css', import.meta.url), 'utf8');
  assert.match(css, /\.pbe-av-evidence-grid\[data-count="1"\][\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(css, /\.pbe-av-evidence-card\.is-statline[\s\S]*min-height:\s*156px/);
});


test('live-form intelligence compares recent production to the full verified game log', () => {
  const rows = [
    { date: '2026-09-23', opponent: '@ NE', value: 12 },
    { date: '2026-09-16', opponent: 'vs BUF', value: 10 },
    { date: '2026-09-09', opponent: '@ MIA', value: 8 },
    { date: '2026-09-02', opponent: 'vs KC', value: 7 },
    { date: '2026-08-26', opponent: '@ PHI', value: 9 },
    { date: '2026-08-19', opponent: 'vs NYG', value: 6 },
    { date: '2026-08-12', opponent: '@ BAL', value: 5 },
    { date: '2026-08-05', opponent: 'vs PIT', value: 7 },
    { date: '2026-07-29', opponent: '@ CLE', value: 4 },
    { date: '2026-07-22', opponent: 'vs CIN', value: 2 },
  ];
  const live = metricSummary(rows, (row) => row.value);

  assert.equal(live.rows.length, 8);
  assert.equal(live.seasonGames, 10);
  assert.equal(live.baselineAvailable, true);
  assert.equal(live.recentHigh, 12);
  assert.equal(Number(live.recentAverage.toFixed(2)), 8);
  assert.equal(Number(live.seasonAverage.toFixed(2)), 7);
  assert.equal(Number(live.deltaPct.toFixed(1)), 14.3);
  assert.equal(live.rows.at(-1).opponent, '@ NE', 'chart remains chronological with the latest game at right');
});

test('live-form card shows opponent context, season baseline and form signal when the sample supports them', () => {
  const html = renderPlayerContext({
    name: 'Example Player',
    image: '/player.png',
    label: 'Receiving Yards',
    seasonStats: [['REC', 51], ['YDS', 704], ['TD', 5], ['TGTS', 73]],
    rows: [
      { date: '2026-08-05', opponent: 'vs PIT', value: 7 },
      { date: '2026-08-12', opponent: '@ BAL', value: 5 },
      { date: '2026-08-19', opponent: 'vs NYG', value: 6 },
      { date: '2026-08-26', opponent: '@ PHI', value: 9 },
      { date: '2026-09-02', opponent: 'vs KC', value: 7 },
      { date: '2026-09-09', opponent: '@ MIA', value: 8 },
      { date: '2026-09-16', opponent: 'vs BUF', value: 10 },
      { date: '2026-09-23', opponent: '@ NE', value: 12 },
    ],
    metricLive: {
      recentAverage: 8,
      seasonAverage: 7,
      recentHigh: 12,
      seasonGames: 10,
      baselineAvailable: true,
      deltaPct: 14.2857,
    },
  });

  assert.match(html, /RECENT HIGH/);
  assert.match(html, /SEASON AVG/);
  assert.match(html, /\+14% VS SEASON/);
  assert.match(html, /Season average · 7 Receiving Yards/);
  assert.match(html, />@ NE</);
  assert.match(html, /pbe-av-baseline-tick/);
  assert.match(html, /is-latest/);
});

test('early-season live-form cards call out sample size instead of manufacturing a trend', () => {
  const html = renderPlayerContext({
    name: 'Early Season Player',
    image: null,
    label: 'Receiving Yards',
    seasonStats: [['REC', 1], ['YDS', 8], ['TD', 0], ['TGTS', 1]],
    rows: [
      { date: '2026-09-13', opponent: 'vs BUF', value: 0 },
      { date: '2026-09-20', opponent: '@ MIA', value: 8 },
    ],
    metricLive: {
      recentAverage: 4,
      seasonAverage: 4,
      recentHigh: 8,
      seasonGames: 2,
      baselineAvailable: false,
      deltaPct: null,
    },
  });

  assert.match(html, /2 GAME SAMPLE/);
  assert.match(html, /Build the sample before calling a trend/);
  assert.doesNotMatch(html, /Season average ·/);
  assert.doesNotMatch(html, /VS SEASON/);
});


test('recent-form average says exactly what the number means', () => {
  const html = renderPlayerContext({
    sport: 'mlb',
    name: 'Example Hitter',
    image: '/hitter.png',
    label: 'Hits',
    seasonStats: [['AVG', '.281'], ['HR', 22], ['RBI', 71], ['OPS', '.812']],
    rows: [
      { date: '2026-09-01', opponent: 'vs CHC', value: 1 },
      { date: '2026-09-03', opponent: '@ STL', value: 1 },
      { date: '2026-09-05', opponent: 'vs MIL', value: 0 },
      { date: '2026-09-07', opponent: '@ CIN', value: 1 },
      { date: '2026-09-09', opponent: 'vs PIT', value: 0 },
      { date: '2026-09-11', opponent: '@ ARI', value: 1 },
      { date: '2026-09-13', opponent: 'vs LAD', value: 1 },
      { date: '2026-09-15', opponent: '@ SD', value: 1 },
    ],
    metricLive: {
      recentAverage: 0.75,
      seasonAverage: 0.82,
      recentHigh: 1,
      seasonGames: 144,
      baselineAvailable: true,
      deltaPct: -8.5,
    },
  });

  assert.match(html, /class="pbe-av-player-card is-mlb"/);
  assert.match(html, />0\.75<\/strong>/);
  assert.match(html, /LAST 8 GAME AVG/);
  assert.match(html, /Hits per game/);
  assert.match(html, /Average Hits per game over the last 8 verified games/);
});

test('player photo CSS gives MLB headshots a less aggressive crop', () => {
  const css = fs.readFileSync(new URL('../src/styles/pbe-article-visuals.css', import.meta.url), 'utf8');
  assert.match(css, /\.pbe-av-player-id img\s*\{[\s\S]*width:\s*56px;[\s\S]*object-position:\s*center 24%/);
  assert.match(css, /\.pbe-av-player-card\.is-mlb \.pbe-av-player-photo\s*\{[\s\S]*object-fit:\s*contain;[\s\S]*object-position:\s*center 16%/);
});
