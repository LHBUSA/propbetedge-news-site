// Article Market module on propbetedge.ai news (MLB / NFL / NBA / NHL) — contract article-market/1
// (propbetedge-workers workers/propsports-markets/docs/POST_EVENT_MARKET_RESULT.md). ONE module with a lifecycle on
// an article linked to ONE canonical game: LIVE MARKET WATCH while the market trades -> THE MARKET RESULT once over.
//
// - Link = article.event.canonical_event_id from propbet-news-api 4.5.0: proven by the writer from the official
//   schedule (ESPN event id nfl/nba, statsapi gamePk mlb, NHL gamePk nhl) — the SAME ids propsports-markets keys by.
//   Never a title match; nothing here guesses an event.
// - Prospective only (owner 2026-10-04, NO BACKFILL): eligible only when the article was first published on
//   propbetedge.ai at/after activation AND its displayed date is at/after activation, so no story that reads as older
//   ever carries the module. The market API stays the authority (it refuses pre-activation published_at).
// - published_at sent = article.first_published_at (write-once newsroom publication time; corrections never move it).
// - A frozen FINAL packet stored in the article's evidence (article.market_freeze) is rendered from that copy forever.
// - Read through the exact same-origin rewrite /api/markets/v1/article-market/<sport>/:id (vercel.json). The browser
//   never calls a venue or the Worker host.
// - Nothing eligible / no market observed / a failed read -> nothing rendered (no placeholder, no empty state).
// Vendored client: src/vendor/markets/* = propbetedge-workers 9d887f3 workers/propsports-markets/client, UNCHANGED.
import { articleMarketModule, mountArticleMarket } from './vendor/markets/article-market-ui.js';

export const ARTICLE_MARKET_ACTIVATED_AT = '2026-10-04T14:31:40Z';
export const ARTICLE_MARKET_CLIENT_PIN = '8d3b73f';
export const ARTICLE_MARKET_BASE = '/api/markets';
export const ARTICLE_MARKET_REFRESH_MS = 30_000;
export const ARTICLE_MARKET_FIRST_PAINT_MS = 800;
const SPORTS = new Set(['mlb', 'nfl', 'nba', 'nhl']);

/** { sport, eventId, publishedAt } for an eligible article, else null. */
export function articleMarketEvent(a) {
  const sport = String(a?.sport || '').toLowerCase();
  const ev = a?.event;
  if (!SPORTS.has(sport) || !ev || String(ev.sport || '').toLowerCase() !== sport) return null;
  const id = String(ev.canonical_event_id ?? '');
  if (!/^\d{4,12}$/.test(id)) return null;
  const act = Date.parse(ARTICLE_MARKET_ACTIVATED_AT);
  const first = Date.parse(a?.first_published_at || '');
  const shown = Date.parse(a?.published_at || '');
  if (!Number.isFinite(first) || !Number.isFinite(shown) || first < act || shown < act) return null;
  return { sport, eventId: id, publishedAt: new Date(first).toISOString() };
}

/** The stored FINAL packet (article evidence), when the writer froze it for this exact publication time. */
export function frozenArticleMarket(a) {
  const ev = articleMarketEvent(a);
  const f = a?.market_freeze;
  const body = f?.response;
  if (!ev || !body?.eligible || body.packet?.packet_state !== 'FINAL' || body.packet?.sha256 !== f.sha256) return null;
  if (f.published_at && Date.parse(f.published_at) !== Date.parse(ev.publishedAt)) return null;
  return body;
}

export async function loadArticleMarket(ev, fetchImpl = (...x) => globalThis.fetch(...x)) {
  try {
    const r = await fetchImpl(`${ARTICLE_MARKET_BASE}/v1/article-market/${ev.sport}/${encodeURIComponent(ev.eventId)}?published_at=${encodeURIComponent(ev.publishedAt)}`);
    if (!r.ok) return null;
    const body = await r.json();
    return body?.eligible ? body : null;
  } catch {
    return null;
  }
}

/** Load-time read sharing a first-paint budget. { now } = payload in time; { pending } = a late answer still coming. */
export async function articleMarketWithin(a, budgetMs = ARTICLE_MARKET_FIRST_PAINT_MS, fetchImpl) {
  const ev = articleMarketEvent(a);
  if (!ev) return { now: null, pending: null };
  const frozen = frozenArticleMarket(a);
  if (frozen) return { now: frozen, pending: null };
  const p = loadArticleMarket(ev, fetchImpl);
  let timer;
  const late = new Promise((resolve) => { timer = setTimeout(() => resolve(undefined), budgetMs); });
  const now = await Promise.race([p, late]);
  clearTimeout(timer);
  return now === undefined ? { now: null, pending: p } : { now, pending: null };
}

export const articleMarketHtml = (payload) => (payload ? articleMarketModule(payload, { placement: 'news-article' }) : '');

/** The slot: present only for an eligible article; empty (zero height) when the read had nothing to show. */
export function articleMarketSlot(a, mk) {
  return articleMarketEvent(a) ? `<div class="art-market" data-art-market>${articleMarketHtml(mk?.now)}</div>` : '';
}

/**
 * After render. First paint already holds the module when the read beat the budget; a late answer is inserted only
 * while the slot is below the viewport (no visible layout shift). Then ~30 s refresh while visible (client rules).
 */
export function mountArticleMarketSlot(root, a, { now = null, pending = null } = {}) {
  const slot = root?.querySelector?.('[data-art-market]');
  const ev = articleMarketEvent(a);
  if (!slot || !ev) return () => {};
  const start = (initial) => mountArticleMarket(slot, { base: ARTICLE_MARKET_BASE, sport: ev.sport, eventId: ev.eventId, publishedAt: ev.publishedAt, initial, refreshMs: ARTICLE_MARKET_REFRESH_MS });
  if (now) return start(now);
  if (!pending) return () => {};
  let stop = () => {};
  pending.then((late) => {
    if (!late || !slot.isConnected) return;
    if (slot.getBoundingClientRect().top < window.innerHeight) return; // would shift what the reader sees: skip
    stop = start(late);
  });
  return () => stop();
}
