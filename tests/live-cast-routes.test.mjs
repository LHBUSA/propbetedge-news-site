import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { liveCastHome, liveCastLabel, liveCastUrl } from '../src/live-cast-routes.js';

test('canonical league cast deep links preserve the clicked game id', () => {
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
  assert.equal(liveCastUrl('mlb', '123456789'), null);
  assert.equal(liveCastUrl('', '401857189'), null);
});

test('cast homes and labels stay league-specific', () => {
  assert.equal(liveCastHome('nfl'), 'https://nfl.propbetedge.ai/#pbecast');
  assert.equal(liveCastHome('nhl'), 'https://nhl.propbetedge.ai/#/cast');
  assert.equal(liveCastHome('wnba'), 'https://wnba.propbetedge.ai/cast');
  assert.equal(liveCastLabel('nfl'), 'NFL PBEcast');
  assert.equal(liveCastLabel('nhl'), 'NHL PBEcast');
  assert.equal(liveCastLabel('wnba'), 'WNBACast');
});

test('/games actually includes WNBA and routes the three cast leagues through the shared contract', () => {
  const src = readFileSync(new URL('../src/pages/games-hub-worldclass.js', import.meta.url), 'utf8');
  assert.match(src, /normalizeWNBA\(data\.wnba\?\.games \|\| \[\]\)/);
  assert.match(src, /detailUrl: liveCastUrl\('nfl', game\.id\)/);
  assert.match(src, /detailUrl: liveCastUrl\('nhl', game\.id\)/);
  assert.match(src, /detailUrl: liveCastUrl\('wnba', game\.id\)/);
});
