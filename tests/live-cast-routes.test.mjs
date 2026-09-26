import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { liveCastHome, liveCastLabel, liveCastUrl } from '../src/live-cast-routes.js';

test('canonical league cast deep links preserve the clicked game id', () => {
  assert.equal(
    liveCastUrl('mlb', '823326'),
    'https://mlb.propbetedge.ai/pbecast?game=823326',
  );
  assert.equal(
    liveCastUrl('nfl', '401772510'),
    'https://nfl.propbetedge.ai/?event=401772510#pbecast',
  );
  assert.equal(
    liveCastUrl('nhl', '2026020001'),
    'https://nhl.propbetedge.ai/#/cast/2026020001',
  );
  assert.equal(
    liveCastUrl('wnba', '401857189'),
    'https://wnba.propbetedge.ai/cast/401857189',
  );
});

test('cast route contract fails closed for bad ids or unsupported sports', () => {
  assert.equal(liveCastUrl('nfl', 'not-a-game'), null);
  assert.equal(liveCastUrl('ufc', '123456789'), null);
  assert.equal(liveCastUrl('', '401857189'), null);
});

test('cast homes and labels stay league-specific', () => {
  assert.equal(liveCastHome('mlb'), 'https://mlb.propbetedge.ai/pbecast');
  assert.equal(liveCastHome('nfl'), 'https://nfl.propbetedge.ai/#pbecast');
  assert.equal(liveCastHome('nhl'), 'https://nhl.propbetedge.ai/#/cast');
  assert.equal(liveCastHome('nba'), 'https://nba.propbetedge.ai/#nbacast');
  assert.equal(liveCastHome('wnba'), 'https://wnba.propbetedge.ai/cast');
  assert.equal(liveCastLabel('mlb'), 'MLB PBEcast');
  assert.equal(liveCastLabel('nfl'), 'NFL PBEcast');
  assert.equal(liveCastLabel('nhl'), 'NHL PBEcast');
  assert.equal(liveCastLabel('nba'), 'NBACast');
  assert.equal(liveCastLabel('wnba'), 'WNBACast');
});

test('/games routes every scoreboard league through its sport-specific live cast contract', () => {
  const src = readFileSync(new URL('../src/pages/games-hub-worldclass.js', import.meta.url), 'utf8');
  assert.match(src, /normalizeWNBA\(data\.wnba\?\.games \|\| \[\]\)/);
  assert.match(src, /detailUrl: liveCastUrl\('mlb', game\.gamePk\)/);
  assert.match(src, /detailUrl: liveCastUrl\('nfl', game\.id\)/);
  assert.match(src, /detailUrl: liveCastUrl\('nba', game\.id\)/);
  assert.match(src, /detailUrl: liveCastUrl\('nhl', game\.id\)/);
  assert.match(src, /detailUrl: liveCastUrl\('wnba', game\.id\)/);
});


test('the scrolling score strip routes every game through liveCastUrl, never a hand-built URL', () => {
  const src = readFileSync(new URL('../src/components/score-strip.js', import.meta.url), 'utf8');
  assert.match(src, /liveCastUrl\(g\.sport, g\.gameId\)/);
  assert.doesNotMatch(src, /\/games\/mlb\/\$\{g\.gameId\}/);
  assert.doesNotMatch(src, /\/cast\/\$\{/);
  assert.doesNotMatch(src, /pbecast\?game=/);
  assert.doesNotMatch(src, /#nbacast\//);
  assert.doesNotMatch(src, /\?event=/);
});

const STRIP_FIXTURES = [
  ['mlb', '823326', 'https://mlb.propbetedge.ai/pbecast?game=823326', 'Open PBEcast', 'Open this game in MLB PBEcast'],
  ['nhl', '2026020001', 'https://nhl.propbetedge.ai/#/cast/2026020001', 'Open PBEcast', 'Open this game in NHL PBEcast'],
  ['nfl', '401772510', 'https://nfl.propbetedge.ai/?event=401772510#pbecast', 'Open PBEcast', 'Open this game in NFL PBEcast'],
  ['nba', '401810001', 'https://nba.propbetedge.ai/#nbacast/401810001', 'Open NBACast', 'Open this game in NBACast'],
  ['wnba', '401857189', 'https://wnba.propbetedge.ai/cast/401857189', 'Open WNBACast', 'Open this game in WNBACast'],
];

test('score strip tiles deep-link each league to that exact game cast', async () => {
  const { tileHref, tileTitle, tileCta } = await import('../src/components/score-strip.js');
  for (const [sport, gameId, url, cta, title] of STRIP_FIXTURES) {
    const g = { sport, gameId };
    assert.equal(tileHref(g), url, `${sport} href`);
    assert.equal(tileCta(g).text, cta, `${sport} cta`);
    assert.equal(tileTitle(g), title, `${sport} title`);
    // Numeric ids (MLB gamePk, NHL id) arrive as numbers from the feeds.
    assert.equal(tileHref({ sport, gameId: Number(gameId) }), url, `${sport} numeric id`);
  }
});

test('score strip never falls back to a bare sport homepage when the game id is valid', async () => {
  const { tileHref } = await import('../src/components/score-strip.js');
  const bare = new Set(['mlb', 'nhl', 'nfl', 'nba', 'wnba'].map((s) => `https://${s}.propbetedge.ai`));
  let fallbacks = 0;
  for (const [sport, gameId] of STRIP_FIXTURES) {
    const href = tileHref({ sport, gameId });
    if (bare.has(href.replace(/\/$/, ''))) fallbacks += 1;
    assert.ok(href.includes(gameId), `${sport} href carries the game id`);
  }
  assert.equal(fallbacks, 0);
});

test('score strip only says "Open platform" when no cast destination exists', async () => {
  const { tileHref, tileTitle, tileCta } = await import('../src/components/score-strip.js');
  for (const sport of ['mlb', 'nhl', 'nfl', 'nba', 'wnba']) {
    const g = { sport, gameId: '' };
    assert.equal(tileCta(g).text, 'Open platform');
    assert.equal(tileTitle(g), 'Open PropBetEdge platform');
    assert.equal(tileHref(g), liveCastHome(sport));
    assert.equal(tileCta({ sport, gameId: 'bad-id' }).text, 'Open platform');
  }
  assert.equal(tileHref({ sport: 'ufc', gameId: '123456789' }), '#');
});

test('other root game surfaces route through the central cast router', () => {
  const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
  const normalize = read('../src/components/score-strip-normalize.js');
  for (const sport of ['mlb', 'nba', 'nhl', 'nfl', 'wnba']) {
    assert.ok(normalize.includes(`detailUrl: liveCastUrl('${sport}'`), sport);
  }
  assert.match(read('../src/pbe-board.js'), /liveCastUrl\(game\.sport, id\)/);
  const detail = read('../src/pages/game-detail.js');
  assert.match(detail, /liveCastUrl\(sport, gameId\)/);
  assert.doesNotMatch(detail, /sport === 'mlb' \? 'mlb\.'/);
});

test('no post-render layer rewrites score-strip tiles back to a platform homepage', () => {
  const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
  for (const file of ['../src/live-platform-launch.js', '../src/site-enhancements.js', '../src/nfl-launch-priority.js', '../src/main.js']) {
    const src = read(file);
    assert.doesNotMatch(src, /\.pss-tile[^`'"]*`?\)\.forEach\(tile => \{\s*setExternal/, file);
    assert.doesNotMatch(src, /patchScoreStrip/, file);
  }
});
