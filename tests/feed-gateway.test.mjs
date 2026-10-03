// Same-origin feed gateway (api/feed.js): browser data goes through /api/feed, never straight to a provider host.
import test from 'node:test';
import assert from 'node:assert/strict';
import handler, { resource, FEEDS } from '../api/feed.js';
import { feedUrl } from '../src/feed-url.js';

const host = (q) => new URL(resource(q).url).host;

test('feed gateway: every allowlisted feed resolves to a fixed upstream host', () => {
  assert.equal(host({ feed: 'mlb-schedule', date: '2026-10-03' }), 'statsapi.mlb.com');
  assert.equal(host({ feed: 'espn-scoreboard', sport: 'nba', dates: '20261003', seasontype: '3' }), 'site.api.espn.com');
  assert.equal(host({ feed: 'nhl-schedule', date: '2026-10-03' }), 'api-web.nhle.com');
  assert.match(resource({ feed: 'mlb-person', id: '592450', season: '2026', view: 'article' }).url, /type=\[season,gameLog\]/);
  assert.match(resource({ feed: 'mlb-person', id: '592450', season: '2026' }).url, /type=\[season,career,gameLog\]/);
  assert.equal(resource({ feed: 'espn-scoreboard', sport: 'nfl' }).url, 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard');
  assert.ok(Object.keys(FEEDS).length >= 15);
});

test('feed gateway: not an open proxy — unknown feeds and unsafe params are rejected', () => {
  const bad = [
    { feed: 'url', url: 'https://evil.example/x' },
    { feed: '__proto__' },
    { feed: 'toString' },
    { feed: 'mlb-linescore', gamePk: '1/../../people' },
    { feed: 'mlb-leaders', cats: 'homeRuns&limit=999', group: 'hitting', season: '2026' },
    { feed: 'mlb-leaders', cats: 'homeRuns', group: 'batting', season: '2026' },
    { feed: 'mlb-leaders', cats: 'homeRuns', group: 'hitting', season: '2026', limit: '500' },
    { feed: 'espn-summary', sport: 'golf', event: '1' },
    { feed: 'espn-standings', sport: 'ufc' },
    { feed: 'nhl-skater-leaders', season: '2025', gameType: '2', cats: 'points' },
    { feed: 'mlb-schedule', date: ['2026-10-03'] },
  ];
  for (const q of bad) assert.throws(() => resource(q), undefined, JSON.stringify(q));
});

function mockRes() {
  const r = { headers: {}, code: 0, body: null };
  r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
}

test('feed gateway: passes the payload through with edge caching; failures are soft and briefly cached', async () => {
  const realFetch = globalThis.fetch;
  try {
    let asked = null;
    globalThis.fetch = async (url) => { asked = url; return new Response(JSON.stringify({ dates: [{ games: [{ gamePk: 1 }] }] }), { status: 200 }); };
    let res = mockRes();
    await handler({ method: 'GET', query: { feed: 'mlb-schedule', date: '2026-10-03' } }, res);
    assert.equal(res.code, 200);
    assert.deepEqual(res.body, { dates: [{ games: [{ gamePk: 1 }] }] });
    assert.match(res.headers['cache-control'], /s-maxage=10, stale-while-revalidate=20/);
    assert.match(asked, /^https:\/\/statsapi\.mlb\.com\/api\/v1\/schedule\?sportId=1&date=2026-10-03/);

    res = mockRes();
    await handler({ method: 'GET', query: { feed: 'espn-standings', sport: 'nba' } }, res);
    assert.match(res.headers['cache-control'], /s-maxage=300/);

    globalThis.fetch = async () => new Response('nope', { status: 500 });
    res = mockRes();
    await handler({ method: 'GET', query: { feed: 'mlb-boxscore', gamePk: '777' } }, res);
    assert.equal(res.code, 503);
    assert.equal(res.body.error, 'source_unavailable');

    res = mockRes();
    await handler({ method: 'GET', query: { feed: 'nope' } }, res);
    assert.equal(res.code, 400);
    assert.equal(res.headers['cache-control'], 'no-store');

    res = mockRes();
    await handler({ method: 'POST', query: { feed: 'mlb-schedule', date: '2026-10-03' } }, res);
    assert.equal(res.code, 405);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('feedUrl builds same-origin gateway URLs only', () => {
  assert.equal(feedUrl('mlb-boxscore', { gamePk: 7 }), '/api/feed?feed=mlb-boxscore&gamePk=7');
  assert.equal(feedUrl('espn-scoreboard', { sport: 'nfl', dates: undefined }), '/api/feed?feed=espn-scoreboard&sport=nfl');
});
