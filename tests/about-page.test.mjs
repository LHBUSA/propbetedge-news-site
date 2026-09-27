import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const about = fs.readFileSync(new URL('../src/pages/about.js', import.meta.url), 'utf8');
const middleware = fs.readFileSync(new URL('../middleware.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../src/styles/pbe-about.css', import.meta.url), 'utf8');

test('About V2 positions PropBetEdge as the sports intelligence network', () => {
  assert.match(about, /THE SPORTS INTELLIGENCE NETWORK/);
  assert.match(about, /Sports are deeper than the scoreboard/);
  assert.match(about, /News is the entry point\. Intelligence is the product\./);
  assert.match(about, /Accountability by design/i);
});

test('About V2 links all seven live sport verticals', () => {
  for (const host of [
    'mlb.propbetedge.ai',
    'nfl.propbetedge.ai',
    'nba.propbetedge.ai',
    'wnba.propbetedge.ai',
    'nhl.propbetedge.ai',
    'ufc.propbetedge.ai',
    'tennis.propbetedge.ai',
  ]) {
    assert.ok(about.includes(host), host);
  }
});

test('About V2 has server-rendered parity for the core message and network links', () => {
  assert.match(middleware, /About PropBetEdge — The Sports Intelligence Network/);
  assert.match(middleware, /Sports are deeper than the scoreboard/);
  assert.match(middleware, /Seven live sport verticals/);
  assert.match(middleware, /tennis\.propbetedge\.ai/);
});

test('About V2 has dedicated responsive styles', () => {
  assert.match(css, /\.about-hero/);
  assert.match(css, /\.about-sport-grid/);
  assert.match(css, /@media\(max-width:520px\)/);
});
