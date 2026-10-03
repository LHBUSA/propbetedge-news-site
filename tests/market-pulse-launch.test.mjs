// Homepage Kalshi prediction-market launch: approved copy, truthful claims only,
// Kalshi attribution, every network sport linked, ACTIVE_MARKET-only live marks.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  MARKET_PULSE_COPY, MARKET_PULSE_COVERAGE_URL,
  renderMarketPulseLaunch, activeMarketSports, mountMarketPulseLive,
} from '../src/market-pulse-launch.js';

const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

const DOMAINS = {
  nba: 'https://nba.propbetedge.ai/',
  nfl: 'https://nfl.propbetedge.ai/',
  nhl: 'https://nhl.propbetedge.ai/',
  mlb: 'https://mlb.propbetedge.ai/sharp-tools',
  wnba: 'https://wnba.propbetedge.ai/',
  ufc: 'https://ufc.propbetedge.ai/',
  soccer: 'https://soccer.propbetedge.ai/',
  tennis: 'https://tennis.propbetedge.ai/',
  f1: 'https://f1.propbetedge.ai/',
  golf: 'https://golf.propbetedge.ai/',
};

test('approved owner copy ships verbatim', () => {
  assert.equal(MARKET_PULSE_COPY.headline, 'DON’T WAIT ON VEGAS');
  assert.equal(MARKET_PULSE_COPY.dek, 'Prediction-market intelligence is now live across PropBetEdge.');
  assert.equal(MARKET_PULSE_COPY.body, 'PropBetEdge now tracks live prediction markets across the sports network, giving us another real-time signal without waiting for traditional sportsbook odds to appear.');
  assert.equal(MARKET_PULSE_COPY.tagline, 'Proprietary intelligence + live prediction markets — without waiting on Vegas.');
  const html = renderMarketPulseLaunch();
  for (const line of Object.values(MARKET_PULSE_COPY)) {
    assert.ok(text(html).includes(line.replace(/\s+/g, ' ')), line);
  }
});

test('no forbidden claims: never earlier/faster/more accurate than Vegas, never "stale"', () => {
  const copy = [text(renderMarketPulseLaunch()), read('../src/market-pulse-launch.js')
    .split('\n').filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join('\n')].join('\n');
  const forbidden = /(earlier than|faster than|more accurate|stale|ahead of|beats? (vegas|the books?|sportsbooks?)|moves? before vegas)/i;
  assert.doesNotMatch(copy, forbidden);
  // Any comparison word anywhere near Vegas/sportsbook is a claim we do not make.
  const nearVegas = /(earlier|faster|accurate|stale|before)[^.]{0,80}(vegas|sportsbook)|(vegas|sportsbook)[^.]{0,80}(earlier|faster|accurate|stale)/i;
  assert.doesNotMatch(copy, nearVegas);
});

test('Kalshi attribution: prices from Kalshi, not sportsbook odds, not a PBE model', () => {
  const html = renderMarketPulseLaunch();
  assert.match(html, /Prices from Kalshi, a regulated prediction market\./);
  assert.match(html, /Not sportsbook odds and not a PropBetEdge model\./);
});

test('links every network sport on its verified domain', () => {
  const html = renderMarketPulseLaunch();
  const links = [...html.matchAll(/<a href="([^"]+)" data-pbe-market-sport="([a-z0-9]+)"/g)];
  assert.equal(links.length, 10);
  for (const [, href, sport] of links) assert.equal(href, DOMAINS[sport], sport);
  assert.deepEqual(links.map((l) => l[2]).sort(), Object.keys(DOMAINS).sort());
  // Domains match the root footer/header network links.
  const network = read('../src/ads-config.js') + read('../src/components/footer.js') + read('../src/components/header.js');
  for (const href of Object.values(DOMAINS)) {
    assert.ok(network.includes(new URL(href).origin), href);
  }
});

test('static module has no live/empty chip content in first paint', () => {
  const html = renderMarketPulseLaunch();
  assert.doesNotMatch(html, /is-market-live/);
  assert.doesNotMatch(html, /no (active )?market/i);
});

test('only ACTIVE_MARKET sports are marked live', () => {
  const coverage = {
    sports: [
      { sport: 'nba', state: 'ACTIVE_MARKET' },
      { sport: 'golf', state: 'KNOWN_SERIES_NO_ACTIVE_MARKET' },
      { sport: 'f1', state: 'KNOWN_SERIES_LANE_HELD' },
      { sport: 'boxing', state: 'ACTIVE_MARKET' },
      { sport: 'nfl', state: 'NO_KNOWN_SERIES' },
      { sport: 'SOCCER', state: 'ACTIVE_MARKET' },
      null,
    ],
  };
  assert.deepEqual(activeMarketSports(coverage), ['nba', 'soccer']);
  assert.deepEqual(activeMarketSports(null), []);
  assert.deepEqual(activeMarketSports({ sports: 'x' }), []);
});

function fakeRoot() {
  const links = {};
  const section = {
    isConnected: true,
    querySelector(sel) {
      const m = sel.match(/data-pbe-market-sport="([a-z0-9]+)"/);
      if (!m) return null;
      links[m[1]] ||= {
        classes: new Set(),
        sr: { textContent: '' },
        classList: { add(c) { links[m[1]].classes.add(c); } },
        querySelector() { return links[m[1]].sr; },
      };
      return links[m[1]];
    },
  };
  return { links, root: { querySelector: (sel) => (sel === '[data-pbe-market-pulse]' ? section : null) } };
}

test('live mount marks ACTIVE_MARKET sports from the public coverage endpoint', async () => {
  const { root, links } = fakeRoot();
  let calledUrl = '';
  const fetchImpl = async (url) => {
    calledUrl = url;
    return { ok: true, json: async () => ({ sports: [{ sport: 'nhl', state: 'ACTIVE_MARKET' }, { sport: 'mlb', state: 'NO_KNOWN_SERIES' }] }) };
  };
  assert.deepEqual(await mountMarketPulseLive(root, { fetchImpl }), ['nhl']);
  assert.equal(calledUrl, MARKET_PULSE_COVERAGE_URL);
  assert.ok(links.nhl.classes.has('is-market-live'));
  assert.equal(links.mlb, undefined);
});

test('fetch failure leaves the static module untouched', async () => {
  const { root, links } = fakeRoot();
  assert.deepEqual(await mountMarketPulseLive(root, { fetchImpl: async () => { throw new Error('offline'); } }), []);
  assert.deepEqual(await mountMarketPulseLive(root, { fetchImpl: async () => ({ ok: false }) }), []);
  assert.deepEqual(Object.keys(links), []);
});

test('homepage renders the module statically before data loads', () => {
  const home = read('../src/pages/home.js');
  const skeleton = home.slice(home.indexOf('root.innerHTML = `'), home.indexOf('// Initial load'));
  assert.match(skeleton, /\$\{renderMarketPulseLaunch\(\)\}/);
  assert.ok(skeleton.indexOf('lead-section') < skeleton.indexOf('renderMarketPulseLaunch'));
  assert.ok(skeleton.indexOf('renderMarketPulseLaunch') < skeleton.indexOf('latest-section'));
});
