// Newsroom quality repair (owner 2026-10-06). Acceptance case: /news/mlb/braves-dodgers-game-3-chris-sale-s-elite-
// season-metrics-favor-atlanta-in-playoff-pitching-du-2026-10-06 (news_articles bc7f561d): sourced from a CBS
// DraftKings promo-code page, hero = a "bet $5 get $150" graphic (rejected -> no hero at all), one of several
// Braves-Dodgers/Sale stories sharing promo graphics or the same recovered Sale headshot, and a valid LAD@ATL 849819
// market (Kalshi + Polymarket) that never rendered because the answer arrived after the 800 ms first-paint budget.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isPromotionalSource, promotionalSourceReason } from '../src/editorial/promo-creative.js';
import { imageKey, chooseStoryMedia, heroImageAllowed, SAME_IMAGE_WINDOW_HOURS } from '../src/editorial/media-usage.js';
import { assessArticleIntegrity, filterPublicArticles } from '../news-integrity.js';
import {
  articleMarketSlot, articleMarketWithin, mountArticleMarketSlot, readArticleMarket, ARTICLE_MARKET_RETRY_MS,
} from '../src/article-market.js';

const payload = JSON.parse(fs.readFileSync(new URL('./fixtures/article-market-nfl-401872965.json', import.meta.url), 'utf8'));
const EVENT = { contract: 'news-event-link/1', sport: 'nfl', canonical_event_id: '401872965', rule: 'both_teams_same_et_date', home: 'WSH', away: 'IND' };
const article = (over = {}) => ({ sport: 'nfl', published_at: '2026-10-04T15:15:30.88839+00:00', first_published_at: '2026-10-04T15:21:00.960Z', event: EVENT, market_freeze: null, ...over });

// Real 2026-10-06 newsroom source URLs.
const PROMO_SOURCES = [
  'https://www.cbssports.com/betting/news/use-draftkings-promo-code-to-claim-150-bonus-bets-braves-dodgers-brewers-padres-mlb-tuesday/',
  'https://www.cbssports.com/betting/news/use-betmgm-bonus-code-cbssports-to-get-1500-bonus-bets-braves-dodgers-mlb/',
  'https://www.cbssports.com/betting/news/use-fanduel-promo-code-to-get-250-bonus-bets-cowboys-texans-chiefs-raiders-nfl-week-4/',
  'https://www.cbssports.com/prediction/news/kalshi-promo-code-cbssports55-texas-get-55-bonus-cowboys-texans-nfl-week-4-predictions/',
  'https://www.example.com/sportsbook-reviews/fanduel/',
  'https://www.example.com/nfl/bet-5-get-200-in-bonus-bets-this-week/',
];
const EDITORIAL_SOURCES = [
  'https://www.cbssports.com/betting/news/dodgers-vs-braves-nlds-game-3-picks-atlanta-chris-sale/',
  'https://www.cbssports.com/betting/news/brewers-vs-padres-nlds-game-3-parlay-picks-best-bets/',
  'https://www.cbssports.com/betting/news/week-5-nfl-betting-odds-lines-totals-spreads/',
  'https://www.profootballrumors.com/2026/10/falcons-to-extend-dl-gervon-dexter',
  'https://www.profootballrumors.com/2026/10/rookie-signing-bonus-details-first-round-picks',
  'https://www.mlb.com/news/yoshinobu-yamamoto-chris-sale-nlds-game-3',
  'https://www.espn.com/mlb/story/_/id/50114618/rays-take-advantage-error-prone-yankees',
  'https://nhlrumors.com/the-detroit-red-wings-made-a-big-offer-to-simon-edvinsson/',
];

test('source quality gate: promo/affiliate pages are PROMOTIONAL_SOURCE; betting picks, odds and contract news are not', () => {
  for (const u of PROMO_SOURCES) assert.equal(promotionalSourceReason({ source_url: u }), 'PROMOTIONAL_SOURCE', u);
  for (const u of EDITORIAL_SOURCES) assert.equal(isPromotionalSource({ source_url: u }), false, u);
  assert.equal(isPromotionalSource({ source_url: 'https://x.com/a', source_title: 'Use DraftKings promo code for $150 in bonus bets' }), true, 'source headline');
  assert.equal(isPromotionalSource({ source_url: 'https://x.com/a', source_title: 'Chiefs give rookie record signing bonus' }), false);
  assert.equal(isPromotionalSource({}), false);
});

test('integrity policy withholds a promo-sourced story everywhere (article route, lists, RSS, sitemaps, search)', () => {
  const sale = { title: "Braves-Dodgers Game 3: Chris Sale's Elite Season Metrics Favor Atlanta in Playoff Pitching Duel", source_url: PROMO_SOURCES[0] };
  assert.deepEqual(assessArticleIntegrity(sale), { ok: false, reason: 'PROMOTIONAL_SOURCE' });
  const ok = { title: "Yamamoto and Sale Stage Postseason Rarity", source_url: EDITORIAL_SOURCES[5] };
  assert.deepEqual(filterPublicArticles([sale, ok]).map((a) => a.title), [ok.title]);
});

test('imageKey: one identity through the proxy wrapper, ESPN combiner and size/cache queries', () => {
  const raw = 'https://sportshub.cbsistatic.com/i/2026/07/26/f6e09138/draftkings-bet-5-get-150.jpg';
  assert.equal(imageKey(`https://propbet-img-proxy.sales-fd3.workers.dev/?url=${encodeURIComponent(raw)}`), imageKey(raw));
  assert.equal(imageKey(`${raw}?w=640&q=80`), imageKey(raw));
  const espn = (w) => `https://a.espncdn.com/combiner/i?img=%2Fi%2Fheadshots%2Fmlb%2Fplayers%2Ffull%2F30948.png&w=${w}&h=${w}`;
  assert.equal(imageKey(espn(350)), imageKey(espn(1200)));
  assert.notEqual(imageKey(espn(350)), imageKey('https://a.espncdn.com/combiner/i?img=%2Fi%2Fheadshots%2Fmlb%2Fplayers%2Ffull%2F39832.png'));
  assert.equal(imageKey(''), '');
});

test('page media policy: three Sale stories never share one headshot; next contextual candidate, else sport fallback', () => {
  const SALE = { image: 'https://a.espncdn.com/combiner/i?img=/i/headshots/mlb/players/full/30948.png', candidate: { kind: 'player', name: 'Chris Sale' } };
  const YAMA = { image: 'https://a.espncdn.com/combiner/i?img=/i/headshots/mlb/players/full/42405.png', candidate: { kind: 'player', name: 'Yoshinobu Yamamoto' } };
  const ATL = { image: 'https://a.espncdn.com/i/teamlogos/mlb/500/atl.png', candidate: { kind: 'team', name: 'ATL' } };
  const used = new Map();
  const pick = (story, cands) => { const m = chooseStoryMedia(cands, used, story); if (m) used.set(imageKey(m.image), story); return m; };
  assert.equal(pick('mlb:a', [SALE, YAMA, ATL]), SALE);
  assert.equal(pick('mlb:b', [SALE, YAMA, ATL]), YAMA, 'second story: the opponent, not Sale again');
  assert.equal(pick('mlb:c', [SALE, ATL]), ATL, 'third story: team imagery');
  assert.equal(pick('mlb:d', [SALE, ATL]), null, 'every contextual image in use: restrained fallback, never a repeat or a random photo');
  assert.equal(chooseStoryMedia([SALE], used, 'mlb:a'), SALE, 'the same story (rendered twice / updated) may keep its own image');
  assert.equal(chooseStoryMedia([], used), null);
});

test(`writer media policy: one exact hero per ${SAME_IMAGE_WINDOW_HOURS} h unless it is the same canonical story`, () => {
  const img = 'https://sportshub.cbsistatic.com/i/2026/08/28/x/2026-08-28t020602z-76107650-mt1usatoday.jpg';
  assert.equal(heroImageAllowed(img, []), true);
  assert.equal(heroImageAllowed(img, [{ id: 'other', image_url: `${img}?w=1200` }], { articleId: 'new' }), false);
  assert.equal(heroImageAllowed(img, [{ id: 'canon', image_url: img }], { articleId: 'new', canonicalId: 'canon' }), true, 'genuine update');
  assert.equal(heroImageAllowed(img, [{ id: 'new', image_url: img }], { articleId: 'new' }), true, 'itself');
  assert.equal(heroImageAllowed(null, [{ id: 'x', image_url: img }]), true);
});

test('article page always reserves the editorial media surface and names its story for media recovery', () => {
  const page = fs.readFileSync(new URL('../src/pages/article.js', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /const heroImage = article\.image_url\s*\?/, 'a rejected/missing image must not remove the hero');
  assert.match(page, /<figure class="article-hero-image" data-story-media data-story-sport=/);
  const mb = fs.readFileSync(new URL('../src/media-backfill.js', import.meta.url), 'utf8');
  assert.match(mb, /closest\?\.\('\[data-story-media\]'\)/);
  assert.match(mb, /\.lead-image, \.article-hero-image'/);
  assert.match(mb, /chooseStoryMedia\(candidates, imagesInUse\(container\)/);
});

// ---- Article Market delivery ----

const res = (status, body) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });

test('reads are classified: ok / none (definite) / error (retry)', async () => {
  const ev = { sport: 'nfl', eventId: '401872965', publishedAt: '2026-10-04T15:21:00.960Z' };
  assert.equal((await readArticleMarket(ev, async () => res(200, payload))).state, 'ok');
  assert.equal((await readArticleMarket(ev, async () => res(200, { eligible: false }))).state, 'none');
  assert.equal((await readArticleMarket(ev, async () => res(200, { ...payload, packet: { ...payload.packet, packet_state: 'NO_MARKET_OBSERVED' } }))).state, 'none');
  assert.equal((await readArticleMarket(ev, async () => res(404, 'x'))).state, 'none');
  for (const s of [500, 502, 503, 429]) assert.equal((await readArticleMarket(ev, async () => res(s, '{"error":"unavailable"}'))).state, 'error', String(s));
  assert.equal((await readArticleMarket(ev, async () => { throw new Error('offline'); })).state, 'error');
});

test('eligible + late or failed read: the slot is RESERVED (blank, aria-busy); ineligible articles get nothing', async () => {
  const offline = { pbeFetchImpl: async () => { throw new Error('offline'); } };
  const late = await articleMarketWithin(article(), 10, () => new Promise((r) => setTimeout(() => r(res(200, payload)), 40)), offline);
  assert.equal(late.now, null);
  assert.equal(articleMarketSlot(article(), late), '<div class="art-market art-market--reserved" data-art-market data-art-market-state="pending" aria-busy="true"></div>');
  assert.equal((await late.pending.read).state, 'ok');
  const failed = await articleMarketWithin(article(), 200, async () => res(503, '{"error":"unavailable"}'), offline);
  assert.equal(failed.failed, true);
  assert.match(articleMarketSlot(article(), failed), /art-market--reserved/);
  assert.equal(articleMarketSlot(article({ event: null }), late), '', 'never a reservation on a non-eligible article');
  const none = await articleMarketWithin(article(), 200, async () => res(200, { eligible: false }), offline);
  assert.equal(articleMarketSlot(article(), none), '<div class="art-market" data-art-market></div>', 'definite nothing: zero height');
});

// Minimal DOM stand-ins for the slot (node has no document).
function fakeSlot() {
  const classes = new Set(['art-market', 'art-market--reserved']);
  const attrs = new Map([['aria-busy', 'true'], ['data-art-market-state', 'pending']]);
  const slot = {
    isConnected: true, innerHTML: '',
    classList: { remove: (c) => classes.delete(c), contains: (c) => classes.has(c) },
    removeAttribute: (a) => attrs.delete(a), setAttribute: (a, v) => attrs.set(a, v), getAttribute: (a) => attrs.get(a),
    getBoundingClientRect: () => ({ top: 0 }), // ON SCREEN: the old code discarded the late answer here
  };
  return { slot, root: { querySelector: () => slot }, classes, attrs };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

test('a late answer HYDRATES the reserved slot even when it is already in the viewport (the 849819 failure)', async () => {
  const { slot, root, classes, attrs } = fakeSlot();
  let resolve;
  const read = new Promise((r) => { resolve = r; });
  const pending = read.then((x) => x.body); pending.read = read;
  const stop = mountArticleMarketSlot(root, article(), { now: null, pending });
  resolve({ state: 'ok', body: payload });
  await flush();
  assert.match(slot.innerHTML, /Live market watch/i);
  assert.match(slot.innerHTML, />Kalshi</);
  assert.match(slot.innerHTML, /Polymarket/);
  assert.equal(classes.has('art-market--reserved'), false);
  assert.equal(attrs.get('aria-busy'), undefined);
  stop();
});

test('failed reads retry with backoff, then hydrate; definite nothing or exhausted retries collapse the reservation', async () => {
  assert.deepEqual(ARTICLE_MARKET_RETRY_MS, [2000, 5000, 12000, 30000]);
  const timers = [];
  const setTimer = (f, ms) => timers.push({ f, ms });
  // 503, 503, then data.
  {
    const { slot, root } = fakeSlot();
    const answers = [res(503, '{}'), res(200, payload)];
    const stop = mountArticleMarketSlot(root, article(), { failed: true }, { fetchImpl: async () => answers.shift(), setTimer });
    assert.equal(timers.at(-1).ms, 2000);
    timers.at(-1).f(); await flush(); await flush();
    assert.equal(timers.at(-1).ms, 5000);
    timers.at(-1).f(); await flush(); await flush();
    assert.match(slot.innerHTML, /Live market watch/i);
    stop();
  }
  // Definite "no market": collapse at once.
  {
    const { slot, root, classes } = fakeSlot();
    timers.length = 0;
    mountArticleMarketSlot(root, article(), { failed: true }, { fetchImpl: async () => res(200, { eligible: false }), setTimer });
    timers.at(-1).f(); await flush(); await flush();
    assert.equal(slot.innerHTML, '');
    assert.equal(classes.has('art-market--reserved'), false);
  }
  // Always failing: four retries, then collapse (never a permanent blank box).
  {
    const { slot, root, classes } = fakeSlot();
    timers.length = 0;
    mountArticleMarketSlot(root, article(), { failed: true }, { fetchImpl: async () => res(503, '{}'), setTimer });
    for (let i = 0; i < 4; i++) { timers.at(-1).f(); await flush(); await flush(); }
    assert.deepEqual(timers.map((t) => t.ms), [2000, 5000, 12000, 30000]);
    assert.equal(classes.has('art-market--reserved'), false);
    assert.equal(slot.innerHTML, '');
  }
});

test('reservation CSS exists and is scoped to the reserved state only', () => {
  const css = fs.readFileSync(new URL('../src/styles/pbe-article-visuals.css', import.meta.url), 'utf8');
  assert.match(css, /\.art-market--reserved \{ min-height: \d+px;/);
  assert.doesNotMatch(css, /\.art-market \{[^}]*min-height/, 'a settled/empty slot never keeps a box');
});

test('Article Market house theme: gold/brown/charcoal, no blue, host-scoped and loaded after the pinned vendor CSS', () => {
  const css = fs.readFileSync(new URL('../src/styles/pbe-article-market-theme.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /#7fb8ff|127,\s*184,\s*255|#16181d|160,\s*186,\s*220/i, 'no market blue / cold slab');
  for (const rule of css.match(/^[^@/\s}][^{]*\{/gm) || []) assert.match(rule, /^\.art-market /, `scoped to the host slot: ${rule}`);
  assert.match(css, /--am-accent: var\(--gold, #d4af37\)/);
  const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.ok(main.indexOf("import './styles/pbe-article-market-theme.css';") > main.indexOf("import './vendor/markets/article-market-ui.css';"), 'theme after vendor');
});
