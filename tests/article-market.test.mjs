// Article Market module on propbetedge.ai news (contract article-market/1). The fixture is a REAL production response
// (GET /v1/article-market/nfl/401872965?published_at=2026-10-04T15:21:00.960Z, captured 2026-10-04 15:56Z:
// Colts at Commanders in London, in play, Kalshi + Polymarket, no PBE decision). Owner rules: prospective only (no
// backfill), proven canonical event link only, venues separate, nothing rendered when nothing is eligible.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import {
  ARTICLE_MARKET_ACTIVATED_AT, ARTICLE_MARKET_CLIENT_PIN, articleMarketEvent, articleMarketSlot, articleMarketWithin,
  frozenArticleMarket, loadArticleMarket,
} from '../src/article-market.js';

const payload = JSON.parse(fs.readFileSync(new URL('./fixtures/article-market-nfl-401872965.json', import.meta.url), 'utf8'));
const EVENT = { contract: 'news-event-link/1', sport: 'nfl', canonical_event_id: '401872965', rule: 'both_teams_same_et_date', home: 'WSH', away: 'IND' };
const article = (over = {}) => ({ sport: 'nfl', published_at: '2026-10-04T15:15:30.88839+00:00', first_published_at: '2026-10-04T15:21:00.960Z', event: EVENT, market_freeze: null, ...over });

test('activation constant equals the production ARTICLE_MARKET_ACTIVATED_AT (never moved)', () => {
  assert.equal(ARTICLE_MARKET_ACTIVATED_AT, '2026-10-04T14:31:40Z');
  assert.equal(Date.parse(payload.activated_at), Date.parse(ARTICLE_MARKET_ACTIVATED_AT));
});

test('eligibility: proven event + first publication AND displayed date at/after activation; nothing else', () => {
  assert.deepEqual(articleMarketEvent(article()), { sport: 'nfl', eventId: '401872965', publishedAt: '2026-10-04T15:21:00.960Z' });
  assert.equal(articleMarketEvent(article({ first_published_at: '2026-10-04T14:31:39Z' })), null, 'pre-activation publication: never');
  assert.equal(articleMarketEvent(article({ published_at: '2026-10-04T13:35:00+00:00' })), null, 'a story dated before activation never carries it');
  assert.equal(articleMarketEvent(article({ first_published_at: null })), null, 'no original publication time: no module');
  assert.equal(articleMarketEvent(article({ event: null })), null, 'no proven link: no module');
  assert.equal(articleMarketEvent(article({ event: { ...EVENT, sport: 'nba' } })), null, 'event of another sport: refused');
  assert.equal(articleMarketEvent(article({ event: { ...EVENT, canonical_event_id: 'colts-commanders' } })), null, 'ids are canonical numeric ids');
  assert.equal(articleMarketEvent(article({ sport: 'wnba' })), null);
});

test('slot: ineligible articles render nothing at all (no empty state)', () => {
  assert.equal(articleMarketSlot(article({ first_published_at: '2026-10-01T10:00:00Z' }), { now: payload }), '');
  assert.equal(articleMarketSlot(article({ event: null }), { now: payload }), '');
  assert.equal(articleMarketSlot(article(), { now: null }), '<div class="art-market" data-art-market></div>', 'eligible but nothing (yet): empty slot, zero height');
  assert.equal(articleMarketSlot(article(), { now: { ...payload, packet: { ...payload.packet, packet_state: 'NO_MARKET_OBSERVED' } } }), '<div class="art-market" data-art-market></div>');
});

test('real payload: LIVE MARKET WATCH, venues as separate columns, "No official call", no averaging', () => {
  const html = articleMarketSlot(article(), { now: payload });
  assert.match(html, /data-art-market/);
  assert.match(html, /Live market watch/i);
  assert.match(html, /data-am-placement="news-article"/);
  assert.match(html, />Kalshi</);
  assert.match(html, /Polymarket/);
  assert.match(html, /No official call/);
  assert.match(html, /never averaged/);
  assert.match(html, new RegExp(`data-am-sha="${payload.packet.sha256}"`));
  assert.doesNotMatch(html, /\b(average|consensus) (price|probability)\b/i);
});

test('frozen FINAL packet from the article evidence is used only for the same publication time and hash', () => {
  const finalBody = { ...payload, mode: 'MARKET_RESULT', freeze: 'EMBED_THIS_PACKET', packet: { ...payload.packet, packet_state: 'FINAL' }, live: { ...payload.live, mode: 'MARKET_RESULT' } };
  const good = { sha256: payload.packet.sha256, published_at: '2026-10-04T15:21:00.960Z', response: finalBody };
  assert.equal(frozenArticleMarket(article({ market_freeze: good })), finalBody);
  assert.equal(frozenArticleMarket(article({ market_freeze: { ...good, sha256: 'x' } })), null, 'hash mismatch');
  assert.equal(frozenArticleMarket(article({ market_freeze: { ...good, published_at: '2026-10-04T16:00:00Z' } })), null, 'other baseline');
  assert.equal(frozenArticleMarket(article({ market_freeze: { ...good, response: payload } })), null, 'not FINAL');
});

test('reads go through the same-origin rewrite with the ORIGINAL publication time; failures render nothing', async () => {
  const seen = [];
  const ok = async (u) => { seen.push(u); return new Response(JSON.stringify(payload), { status: 200 }); };
  const body = await loadArticleMarket(articleMarketEvent(article()), ok);
  assert.equal(body.sport, 'nfl');
  assert.equal(seen[0], '/api/markets/v1/article-market/nfl/401872965?published_at=2026-10-04T15%3A21%3A00.960Z');
  assert.equal(await loadArticleMarket(articleMarketEvent(article()), async () => new Response('x', { status: 502 })), null);
  assert.equal(await loadArticleMarket(articleMarketEvent(article()), async () => { throw new Error('offline'); }), null);
  assert.equal(await loadArticleMarket(articleMarketEvent(article()), async () => new Response(JSON.stringify({ eligible: false, reason: 'PRE_ACTIVATION_ARTICLE' }), { status: 200 })), null);
  const mk = await articleMarketWithin(article({ event: null }), 50, ok);
  assert.deepEqual(mk, { now: null, pending: null }, 'ineligible: no request at all');
  assert.equal(seen.length, 1);
  const slow = await articleMarketWithin(article(), 10, () => new Promise((r) => setTimeout(() => r(new Response(JSON.stringify(payload))), 60)));
  assert.equal(slow.now, null);
  assert.ok(slow.pending, 'a late answer is handed to mount, which only fills a slot below the viewport');
  assert.equal((await slow.pending).sport, 'nfl');
});

test('vendored client is byte-identical to propbetedge-workers client at the pinned SHA', () => {
  assert.equal(ARTICLE_MARKET_CLIENT_PIN, '3f7345e');
  const sha = (f) => createHash('sha256').update(fs.readFileSync(new URL(`../src/vendor/markets/${f}`, import.meta.url))).digest('hex');
  assert.equal(sha('article-market-ui.js'), '2149e2854142657a554ef119533680c77657f0d2b1ea8406fe4de711e4fbe635');
  assert.equal(sha('article-market-ui.css'), '582c879d9a634caa467f31896c928bf854fc16579a1565091bb5b0093ee0505c');
  // kalshi-market-ui.js re-vendored at propbetedge-workers 64ca257 (one-sided book at $0/$1 keeps the full card; no fake mid)
  assert.equal(sha('kalshi-market-ui.js'), '639f834c27bffed519d37eea4066d3b31e5699f7215d6ea5c07e23c2591ccc48');
});

test('vercel.json: exact article-market rewrites for the four newsroom sports only, numeric ids, no wildcard', () => {
  const v = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const routes = v.rewrites.filter((r) => r.source.startsWith('/api/markets'));
  assert.deepEqual(routes, ['mlb', 'nfl', 'nba', 'nhl'].map((s) => ({ source: `/api/markets/v1/article-market/${s}/:id([0-9]+)`, destination: `https://propsports-markets.sales-fd3.workers.dev/v1/article-market/${s}/:id` })));
  const catchAll = v.rewrites.findIndex((r) => r.destination === '/index.html' && r.source.startsWith('/(('));
  assert.ok(v.rewrites.findIndex((r) => r.source.startsWith('/api/markets')) < catchAll);
  const src = fs.readFileSync(new URL('../src/article-market.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src.replace(/^\s*\/\/.*$/gm, ''), /workers\.dev|kalshi\.com|polymarket\.com/, 'browser code never names the Worker or a venue API');
});

test('article page wires the slot next to the Data Intelligence layer and mounts it', () => {
  const page = fs.readFileSync(new URL('../src/pages/article.js', import.meta.url), 'utf8');
  assert.match(page, /visualHtml \+ articleMarketSlot\(article, market\)/);
  assert.match(page, /mountArticleMarketSlot\(root, article, market\)/);
  assert.match(fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8'), /import '\.\/vendor\/markets\/article-market-ui\.css';/);
});

test('vendored kalshi-market-ui (64ca257): one-sided book at $0/$1 keeps the full card, no fake Mid-market; old API fails closed', async () => {
  const ui = await import('../src/vendor/markets/kalshi-market-ui.js');
  const o = (role, bid, ask, last) => ({ role, abbr: role, contract: `${role} wins`, market_ticker: `T-${role}`, state: 'open', best_yes_bid_bp: bid, best_yes_ask_bp: ask, last_price_bp: last, mid_bp: null, spread_bp: null, displayable: false, renderable: true, one_sided: true });
  const entry = { event: { sport: 'nfl' }, kalshi: { market_url: 'https://kalshi.com/markets/kxwtamatch/wta-tennis-match/kxwtamatch-26oct03mucsam', event_ticker: 'KXWTAMATCH-26OCT03MUCSAM', state: 'open', freshness: 'live', age_seconds: 20, outcomes: [o('a', 9900, null, 9900), o('b', null, 100, 100)] } };
  const html = ui.kalshiCard(entry, { placement: 't' });
  assert.ok(html.includes('Mid-market unavailable at this observation · one-sided book'));
  assert.ok(/<dt>Ask<\/dt><dd>—<\/dd>/.test(html) && /<dt>Bid<\/dt><dd>—<\/dd>/.test(html));
  assert.ok(!/99\.5¢|0\.5¢/.test(html));
  assert.equal(ui.kalshiLine(entry), '');
  const old = { ...entry, kalshi: { ...entry.kalshi, outcomes: entry.kalshi.outcomes.map(({ renderable, ...x }) => x) } };
  assert.equal(ui.kalshiCard(old, { placement: 't' }), '');
});
