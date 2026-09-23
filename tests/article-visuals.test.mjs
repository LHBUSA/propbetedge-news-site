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
  assert.match(html, /<strong>30<\/strong>\s*<b>PTS<\/b>/);
  assert.match(html, /<strong>5<\/strong>\s*<b>G<\/b>/);
  assert.match(html, /<strong>25<\/strong>\s*<b>A<\/b>/);
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


test('NFL story evidence distinguishes rushing yards from receiving yards by sentence semantics', () => {
  const article = {
    id: 'aaron-jones-rushing',
    sport: 'nfl',
    title: "Vikings backfield chaos meets Tampa Bay's run defense",
    summary: 'Aaron Jones is managing a knee injury after a heavy rushing workload.',
    body: "Aaron Jones carried the Vikings' offense with 23 rushing attempts for 105 yards and finished the game in a brace.",
    take: { impact_score: 3, prop_types: ['rushing_yards'] },
  };
  const manifest = {
    players: [{ id: '3042519', name: 'Aaron Jones Sr.', team_id: 'MIN', position: 'RB', path: '/player/nfl/3042519' }],
    teams: [{ id: 'MIN', abbreviation: 'MIN', name: 'Minnesota Vikings', path: '/team/nfl/minnesota-vikings' }],
  };

  const html = renderArticleVisuals(article, manifest);
  assert.match(html, />105<\/strong>\s*<b>RUSH YDS<\/b>/);
  assert.doesNotMatch(html, />105<\/strong>\s*<b>REC YDS<\/b>/);
});

test('NFL roster ripple keeps neighboring player clauses isolated and resolves healthy role beneficiaries', () => {
  const article = {
    id: 'vikings-backfield-status',
    sport: 'nfl',
    title: "Vikings backfield injury chaos meets Tampa Bay's run defense: opportunity in flux",
    summary: "Aaron Jones limps into Sunday's matchup while Minnesota cycles through depth.",
    body: [
      'Aaron Jones is nursing a knee injury and his Sunday status is uncertain.',
      'Jordan Mason remains sidelined from a thumb fracture, and rookie Demond Claiborne remains largely untested.',
      'Minnesota will redistribute touches toward Claiborne in space if Jones cannot handle his normal load.',
    ].join(' '),
    take: { impact_score: 3, prop_types: ['rushing_yards'] },
  };
  const manifest = {
    players: [
      { id: '3042519', name: 'Aaron Jones Sr.', team_id: 'MIN', position: 'RB', path: '/player/nfl/3042519' },
      { id: '4360569', name: 'Jordan Mason', team_id: 'MIN', position: 'RB', path: '/player/nfl/4360569' },
      { id: '4832846', name: 'Demond Claiborne', team_id: 'MIN', position: 'RB', path: '/player/nfl/4832846' },
    ],
    teams: [{ id: 'MIN', abbreviation: 'MIN', name: 'Minnesota Vikings', path: '/team/nfl/minnesota-vikings' }],
  };

  const html = renderArticleVisuals(article, manifest);
  assert.match(html, /Jordan Mason/);
  assert.match(html, /OUT \/ IR/);
  assert.match(html, /Demond Claiborne/);
  assert.match(html, /ROLE UP/);
  assert.doesNotMatch(html, /OUT \/ IR[\s\S]{0,220}Demond Claiborne/);
  assert.doesNotMatch(html, /Role redistribution is described in the article text/);
});

test('multi-team NFL roster ripple groups player status under the correct team', () => {
  const article = {
    id: 'turner-van-ness',
    sport: 'nfl',
    title: 'The Two-Game Reset: How Turner and Van Ness Are Rewriting the Pass-Rush Narrative',
    summary: 'With Greenard traded and Parsons sidelined, Dallas Turner and Lukas Van Ness are reshaping Minnesota and Green Bay.',
    body: [
      'Jonathan Greenard is gone from Minnesota, dealt to Philadelphia.',
      'Micah Parsons remains sidelined in Green Bay as his ACL heals.',
      'Dallas Turner has emerged for Minnesota while Lukas Van Ness has surged for Green Bay.',
      'Turner has 20 pressures and 11 quarterback hits through two games.',
    ].join(' '),
    take: { impact_score: 4, prop_types: ['sacks', 'passing_yards'] },
  };
  const manifest = {
    players: [
      { id: '3916409', name: 'Jonathan Greenard', team_id: 'PHI', position: 'LB', path: '/player/nfl/3916409' },
      { id: '4361423', name: 'Micah Parsons', team_id: 'GB', position: 'DE', path: '/player/nfl/4361423' },
      { id: '4429215', name: 'Dallas Turner', team_id: 'MIN', position: 'LB', path: '/player/nfl/4429215' },
      { id: '4431317', name: 'Lukas Van Ness', team_id: 'GB', position: 'DE', path: '/player/nfl/4431317' },
    ],
    teams: [
      { id: 'MIN', abbreviation: 'MIN', name: 'Minnesota Vikings', path: '/team/nfl/minnesota-vikings' },
      { id: 'GB', abbreviation: 'GB', name: 'Green Bay Packers', path: '/team/nfl/green-bay-packers' },
    ],
  };

  const html = renderArticleVisuals(article, manifest);
  const min = html.indexOf('Minnesota Vikings');
  const greenard = html.indexOf('Jonathan Greenard');
  const gb = html.indexOf('Green Bay Packers');
  const parsons = html.indexOf('Micah Parsons');
  assert.ok(min >= 0 && greenard > min, 'Greenard is grouped under Minnesota roster loss');
  assert.ok(gb >= 0 && parsons > gb, 'Parsons is grouped under Green Bay availability');
  assert.match(html, /DEPARTED/);
  assert.match(html, /OUT \/ IR/);
  assert.doesNotMatch(html, /Role redistribution is described in the article text/);
});

test('integer evidence labels pluralize quarterback hits', () => {
  const article = {
    id: 'qb-hits-plural',
    sport: 'nfl',
    title: 'Pressure surge',
    body: 'Dallas Turner has 11 quarterback hits through two games.',
    take: { impact_score: 3, prop_types: ['sacks'] },
  };
  const manifest = {
    players: [{ id: '4429215', name: 'Dallas Turner', team_id: 'MIN', position: 'LB', path: '/player/nfl/4429215' }],
    teams: [{ id: 'MIN', abbreviation: 'MIN', name: 'Minnesota Vikings', path: '/team/nfl/minnesota-vikings' }],
  };

  const html = renderArticleVisuals(article, manifest);
  assert.match(html, />11<\/strong>\s*<b>QB HITS<\/b>/);
  assert.doesNotMatch(html, />11<\/strong>\s*<b>QB HIT<\/b>/);
});

test('global background first paint is neutral rather than an MLB image', () => {
  const css = fs.readFileSync(new URL('../src/styles/background-selector.css', import.meta.url), 'utf8');
  const root = css.match(/:root\s*\{([\s\S]*?)\}/)?.[1] || '';
  assert.match(root, /--pbe-scene-image:\s*none/);
  assert.match(root, /--pbe-scene-opacity:\s*0/);
});


test('v2 relation array is authoritative and an explicit empty array hides roster ripple', () => {
  const article = {
    id: 'relation-empty',
    sport: 'nfl',
    title: 'Vikings injury update',
    summary: 'A multi-player availability update.',
    body: 'Micah Parsons remains sidelined in Green Bay as his ACL heals.',
    take: {
      impact_score: 3,
      prop_types: ['sacks'],
      relations: [],
    },
  };
  const manifest = {
    players: [{ id: '4361423', name: 'Micah Parsons', team_id: 'GB', position: 'DE', path: '/player/nfl/4361423' }],
    teams: [{ id: 'GB', abbreviation: 'GB', name: 'Green Bay Packers', path: '/team/nfl/green-bay-packers' }],
  };

  const html = renderArticleVisuals(article, manifest);
  assert.doesNotMatch(html, /ROSTER RIPPLE/);
  assert.doesNotMatch(html, /OUT \/ IR/);
});

test('v2 relations override current roster team for departures and preserve multi-team ownership', () => {
  const article = {
    id: 'relation-multiteam',
    sport: 'nfl',
    title: 'Vikings and Packers availability reset',
    summary: 'Minnesota lost one edge defender while Green Bay waits on another.',
    body: 'Jonathan Greenard is gone from Minnesota, dealt to Philadelphia. Micah Parsons remains sidelined in Green Bay as his ACL heals.',
    take: {
      impact_score: 4,
      prop_types: ['sacks'],
      relations: [
        {
          player: 'Jonathan Greenard',
          team: 'MIN',
          state: 'departed',
          destination_team: 'PHI',
          evidence: 'Jonathan Greenard is gone from Minnesota, dealt to Philadelphia.',
        },
        {
          player: 'Micah Parsons',
          team: 'GB',
          state: 'medical_absence',
          evidence: 'Micah Parsons remains sidelined in Green Bay as his ACL heals.',
        },
      ],
    },
  };
  const manifest = {
    players: [
      { id: '3916409', name: 'Jonathan Greenard', team_id: 'PHI', position: 'LB', path: '/player/nfl/3916409' },
      { id: '4361423', name: 'Micah Parsons', team_id: 'GB', position: 'DE', path: '/player/nfl/4361423' },
    ],
    teams: [
      { id: 'MIN', abbreviation: 'MIN', name: 'Minnesota Vikings', path: '/team/nfl/minnesota-vikings' },
      { id: 'GB', abbreviation: 'GB', name: 'Green Bay Packers', path: '/team/nfl/green-bay-packers' },
    ],
  };

  const html = renderArticleVisuals(article, manifest);
  const min = html.indexOf('Minnesota Vikings');
  const greenard = html.indexOf('Jonathan Greenard');
  const gb = html.indexOf('Green Bay Packers');
  const parsons = html.indexOf('Micah Parsons');

  assert.ok(min >= 0 && greenard > min, 'departure stays attached to source team');
  assert.ok(gb >= 0 && parsons > gb, 'medical absence stays attached to Green Bay');
  assert.match(html, /DEPARTED/);
  assert.match(html, /OUT \/ IR/);
});

test('v2 NBA relation aliases NYK to the entity graph Knicks code and never flips a departure to ADDED', () => {
  const article = {
    id: 'robinson-departure-v2',
    sport: 'nba',
    title: 'Knicks extension talks reshape roster',
    summary: 'New York is balancing its second-apron roster decisions.',
    body: 'That mandate already cost the Knicks Mitchell Robinson, a valuable backup center who signed with Boston this offseason rather than take a pay cut to stay under the threshold.',
    take: {
      impact_score: 3,
      prop_types: ['team_total'],
      relations: [{
        player: 'Mitchell Robinson',
        team: 'NYK',
        state: 'departed',
        destination_team: 'BOS',
        evidence: 'That mandate already cost the Knicks Mitchell Robinson, a valuable backup center who signed with Boston this offseason rather than take a pay cut to stay under the threshold.',
      }],
    },
  };
  const manifest = {
    players: [{ id: '4351852', name: 'Mitchell Robinson', team_id: 'BOS', position: 'C', path: '/player/nba/4351852' }],
    teams: [{ id: 'NY', abbreviation: 'NY', name: 'New York Knicks', path: '/team/nba/new-york-knicks' }],
  };

  const html = renderArticleVisuals(article, manifest);
  assert.match(html, /New York Knicks/);
  assert.match(html, /Mitchell Robinson/);
  assert.match(html, /DEPARTED/);
  assert.doesNotMatch(html, />ADDED</);
});

test('an explicit empty relation array suppresses the roster ripple even when the prose says signed, injured, out and promoted', () => {
  const article = {
    id: 'relation-empty-loud-prose',
    sport: 'nfl',
    title: 'Vikings depth chart notes',
    summary: 'A busy week of roster chatter in Minnesota.',
    body: 'Jordan Mason was injured and is out. DeeJay Dallas signed and was promoted to the active roster. Demond Claiborne absorbs touches.',
    take: {
      impact_score: 3,
      prop_types: ['rushing_yards'],
      prompt_version: '3.18.0',
      relations: [],
    },
  };
  const manifest = {
    players: [
      { id: '4360569', name: 'Jordan Mason', team_id: 'MIN', position: 'RB', path: '/player/nfl/4360569' },
      { id: '4832846', name: 'Demond Claiborne', team_id: 'MIN', position: 'RB', path: '/player/nfl/4832846' },
      { id: '3916945', name: 'DeeJay Dallas', team_id: 'MIN', position: 'RB', path: '/player/nfl/3916945' },
    ],
    teams: [{ id: 'MIN', abbreviation: 'MIN', name: 'Minnesota Vikings', path: '/team/nfl/minnesota-vikings' }],
  };

  const html = renderArticleVisuals(article, manifest);
  assert.doesNotMatch(html, /ROSTER RIPPLE/);
  assert.doesNotMatch(html, /OUT \/ IR|ADDED|ROLE UP|DEPARTED/);
});

test('a prompt 3.18 article without a relation array never falls back to heuristic roster classification', () => {
  const article = {
    id: 'strict-without-relations',
    sport: 'nfl',
    title: 'Vikings injury update: Mason sidelined',
    summary: 'Jordan Mason is out with a thumb fracture.',
    body: 'Jordan Mason remains sidelined from a thumb fracture. Demond Claiborne absorbs touches.',
    take: {
      impact_score: 3,
      prop_types: ['rushing_yards'],
      prompt_version: '3.18.0',
    },
  };
  const manifest = {
    players: [
      { id: '4360569', name: 'Jordan Mason', team_id: 'MIN', position: 'RB', path: '/player/nfl/4360569' },
      { id: '4832846', name: 'Demond Claiborne', team_id: 'MIN', position: 'RB', path: '/player/nfl/4832846' },
    ],
    teams: [{ id: 'MIN', abbreviation: 'MIN', name: 'Minnesota Vikings', path: '/team/nfl/minnesota-vikings' }],
  };

  const html = renderArticleVisuals(article, manifest);
  assert.doesNotMatch(html, /ROSTER RIPPLE/);
  assert.doesNotMatch(html, /OUT \/ IR/);

  const legacy = renderArticleVisuals({ ...article, take: { impact_score: 3, prop_types: ['rushing_yards'], prompt_version: '3.17.0' } }, manifest);
  assert.match(legacy, /ROSTER RIPPLE/, 'legacy 3.17 articles still use the hardened heuristic path');
});

test('structured relations render the roster ripple regardless of the headline archetype', () => {
  const article = {
    id: 'structured-analysis-archetype',
    sport: 'nba',
    title: 'Sources: extension talks between Knicks, Towns at standstill',
    summary: 'New York is balancing its second-apron roster decisions.',
    body: 'That mandate already cost the Knicks Mitchell Robinson, a valuable backup center who signed with Boston this offseason rather than take a pay cut to stay under the threshold.',
    take: {
      impact_score: 3,
      prop_types: ['team_total'],
      prompt_version: '3.18.0',
      relations: [{
        player: 'Mitchell Robinson',
        team: 'NYK',
        state: 'departed',
        destination_team: 'BOS',
        evidence: 'That mandate already cost the Knicks Mitchell Robinson, a valuable backup center who signed with Boston this offseason rather than take a pay cut to stay under the threshold.',
      }],
    },
  };
  const manifest = {
    players: [{ id: '4351852', name: 'Mitchell Robinson', team_id: 'BOS', position: 'C', path: '/player/nba/4351852' }],
    teams: [{ id: 'NY', abbreviation: 'NY', name: 'New York Knicks', path: '/team/nba/new-york-knicks' }],
  };

  const html = renderArticleVisuals(article, manifest);
  assert.match(html, /ROSTER RIPPLE/);
  assert.match(html, /DEPARTED/);
  assert.doesNotMatch(html, />ADDED</);
});


test('structured practice DNP renders DNP instead of OUT / IR', () => {
  const article = {
    id: 'coleman-practice-dnp',
    sport: 'nfl',
    title: 'Broncos backfield limps toward Rams: Dobbins, Harvey limited; Coleman DNP',
    summary: 'Denver is monitoring three injured backs after Wednesday practice.',
    body: 'Jonah Coleman did not practice after spraining an ankle Sunday against Jacksonville.',
    take: {
      prompt_version: '3.18.1',
      impact_score: 3,
      prop_types: ['rushing_yards', 'rushing_attempts', 'rushing_tds'],
      relations: [{
        player: 'Jonah Coleman',
        team: 'DEN',
        state: 'practice_dnp',
        evidence: 'Jonah Coleman did not practice after spraining an ankle Sunday against Jacksonville.'
      }],
    },
  };
  const manifest = {
    players: [{ id: '4702555', name: 'Jonah Coleman', team_id: 'DEN', position: 'RB', path: '/player/nfl/4702555' }],
    teams: [{ id: 'DEN', abbreviation: 'DEN', name: 'Denver Broncos', path: '/team/nfl/denver-broncos' }],
  };

  const html = renderArticleVisuals(article, manifest);
  assert.match(html, />DNP</);
  assert.doesNotMatch(html, />OUT \/ IR</);
});

test('legacy 3.18 practice-only medical_absence defensively presents as DNP', () => {
  const article = {
    id: 'coleman-legacy-overstatement',
    sport: 'nfl',
    title: 'Broncos backfield update',
    body: 'Jonah Coleman did not practice after spraining an ankle Sunday against Jacksonville.',
    take: {
      prompt_version: '3.18.0',
      impact_score: 3,
      prop_types: ['rushing_yards'],
      relations: [{
        player: 'Jonah Coleman',
        team: 'DEN',
        state: 'medical_absence',
        evidence: 'Jonah Coleman did not practice after spraining an ankle Sunday against Jacksonville.'
      }],
    },
  };
  const manifest = {
    players: [{ id: '4702555', name: 'Jonah Coleman', team_id: 'DEN', position: 'RB', path: '/player/nfl/4702555' }],
    teams: [{ id: 'DEN', abbreviation: 'DEN', name: 'Denver Broncos', path: '/team/nfl/denver-broncos' }],
  };

  const html = renderArticleVisuals(article, manifest);
  assert.match(html, />DNP</);
  assert.doesNotMatch(html, />OUT \/ IR</);
});

test('market watch labels use consistent human title casing', () => {
  const article = {
    id: 'market-label-casing',
    sport: 'nfl',
    title: 'Denver backfield markets',
    body: 'Denver is monitoring its backfield.',
    take: {
      impact_score: 3,
      prop_types: ['rushing_yards', 'rushing_attempts', 'rushing_tds'],
    },
  };
  const manifest = {
    players: [],
    teams: [{ id: 'DEN', abbreviation: 'DEN', name: 'Denver Broncos', path: '/team/nfl/denver-broncos' }],
  };

  const html = renderArticleVisuals(article, manifest);
  assert.match(html, /Rushing Yards/);
  assert.match(html, /Rushing Attempts/);
  assert.match(html, /Rushing TDs/);
  assert.doesNotMatch(html, />rushing attempts</);
});

test('article detail routes override stale manual baseball background preferences', () => {
  const source = fs.readFileSync(new URL('../src/background-selector.js', import.meta.url), 'utf8');
  const currentScene = source.match(/function currentScene\(\)\s*\{([\s\S]*?)\n\}/)?.[1] || '';
  assert.match(source, /function articleDetailSport/);
  assert.match(currentScene, /const articleSport = articleDetailSport\(\)/);
  assert.ok(
    currentScene.indexOf('const articleSport = articleDetailSport()') < currentScene.indexOf('if (!autoScene)'),
    'article sport must win before saved manual scene'
  );
});


test('article angle pills normalize mixed prop-type casing before render', () => {
  const source = fs.readFileSync(new URL('../src/pages/article.js', import.meta.url), 'utf8');
  const formatter = source.match(/function toTitleCase\([\s\S]*?function escapeAttr/ )?.[0] || '';
  assert.match(formatter, /\.toLowerCase\(\)/);
  assert.match(formatter, /replace\(\/\[\^a-z0-9\]\+\/g, '_'/);
  assert.match(formatter, /rushing_attempts:\s*'Rushing Attempts'/);
  assert.match(formatter, /return map\[key\] \|\| toTitleCase/);
});

test('default NFL article scene uses the football-native gridiron asset', () => {
  const selector = fs.readFileSync(new URL('../src/background-selector.js', import.meta.url), 'utf8');
  const assets = fs.readFileSync(new URL('../src/styles/pbe-background-assets.css', import.meta.url), 'utf8');
  assert.match(selector, /nfl:\s*\{[^\n]*Gridiron Night[^\n]*gridiron-gold\.webp/);
  const nflRule = assets.match(/body\[data-pbe-scene='nfl'\]\s*\{([\s\S]*?)\}/)?.[1] || '';
  assert.match(nflRule, /gridiron-gold\.webp/);
  assert.doesNotMatch(nflRule, /stadium-night\.webp/);
});
