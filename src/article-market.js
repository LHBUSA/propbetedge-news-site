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
// - Not eligible -> nothing at all. Eligible -> the slot is reserved from first paint (owner 2026-10-06: a valid
//   Kalshi/Polymarket answer arriving after the 800 ms budget used to be thrown away whenever the slot was already on
//   screen; LAD@ATL 849819 read 67 s cold that day). A late answer now HYDRATES the reserved slot; a failed read
//   (network / 5xx / 429) retries with backoff; only a definite "no market" (ineligible / NO_MARKET_OBSERVED / 4xx)
//   or exhausted retries collapse the reservation. The reservation is blank space, never a "loading" message.
// - NFL: the module's PBE line is the OFFICIAL record (none for NFL), so the NFL product's own per-game PBE context
//   (validation signals + TD targets, entitlement decided by the NFL server) is read in parallel and passed as the
//   client's separate pbeContext (src/article-pbe-context.js). It never touches the public /api/markets read.
// Vendored client: src/vendor/markets/* = propbetedge-workers workers/propsports-markets/client at
// ARTICLE_MARKET_CLIENT_PIN, UNCHANGED.
import { articleMarketModule, mountArticleMarket } from './vendor/markets/article-market-ui.js';
import { loadNflPbeContext } from './article-pbe-context.js';

export const ARTICLE_MARKET_ACTIVATED_AT = '2026-10-04T14:31:40Z';
export const ARTICLE_MARKET_CLIENT_PIN = 'd2a920a';
export const ARTICLE_MARKET_BASE = '/api/markets';
export const ARTICLE_MARKET_REFRESH_MS = 30_000;
export const ARTICLE_MARKET_FIRST_PAINT_MS = 800;
export const ARTICLE_MARKET_RETRY_MS = [2_000, 5_000, 12_000, 30_000];
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

const renderable = (body) => !!body?.eligible && !!body.packet && !!body.live && body.packet.packet_state !== 'NO_MARKET_OBSERVED';

/** One read, classified: { state: 'ok', body } | { state: 'none' } (definite: nothing to show) | { state: 'error' } (retry). */
export async function readArticleMarket(ev, fetchImpl = (...x) => globalThis.fetch(...x)) {
  try {
    const r = await fetchImpl(`${ARTICLE_MARKET_BASE}/v1/article-market/${ev.sport}/${encodeURIComponent(ev.eventId)}?published_at=${encodeURIComponent(ev.publishedAt)}`);
    if (!r.ok) return { state: r.status >= 500 || r.status === 429 || r.status === 408 ? 'error' : 'none' };
    const body = await r.json();
    return renderable(body) ? { state: 'ok', body } : { state: 'none' };
  } catch {
    return { state: 'error' };
  }
}

export async function loadArticleMarket(ev, fetchImpl) {
  const r = await readArticleMarket(ev, fetchImpl);
  return r.state === 'ok' ? r.body : null;
}

/** Resolves to the promise's value, or undefined once the budget is spent. */
async function within(p, budgetMs) {
  let timer;
  const late = new Promise((resolve) => { timer = setTimeout(() => resolve(undefined), budgetMs); });
  const v = await Promise.race([p, late]);
  clearTimeout(timer);
  return v;
}

/**
 * Load-time read sharing a first-paint budget. { now } = payload in time; { pending } = a late answer still coming
 * (pending.read = its classified result); { failed } = the in-time read failed and is retried after mount.
 * NFL also carries { pbe, pbePending }: the NFL PBE context, read in parallel under the same budget.
 */
export async function articleMarketWithin(a, budgetMs = ARTICLE_MARKET_FIRST_PAINT_MS, fetchImpl, { pbeFetchImpl } = {}) {
  const ev = articleMarketEvent(a);
  if (!ev) return { now: null, pending: null };
  const ctxP = ev.sport === 'nfl' ? loadNflPbeContext(ev.eventId, pbeFetchImpl) : null;
  const frozen = frozenArticleMarket(a);
  const readP = frozen ? Promise.resolve({ state: 'ok', body: frozen }) : readArticleMarket(ev, fetchImpl);
  const [r, pbe] = await Promise.all([within(readP, budgetMs), ctxP ? within(ctxP, budgetMs) : null]);
  let out;
  if (r === undefined) {
    const pending = readP.then((x) => (x.state === 'ok' ? x.body : null));
    pending.read = readP;
    out = { now: null, pending };
  } else {
    out = { now: r.state === 'ok' ? r.body : null, pending: null };
    if (r.state === 'error') out.failed = true;
  }
  if (ctxP) Object.assign(out, pbe === undefined ? { pbe: null, pbePending: ctxP } : { pbe, pbePending: null });
  return out;
}

export const articleMarketHtml = (payload, pbeContext = null) => (payload ? articleMarketModule(payload, { placement: 'news-article', pbeContext }) : '');

/**
 * The slot: present only for an eligible article. Holds the module when the read beat the budget; RESERVED (stable
 * min-height, blank, aria-busy) while a late answer or a retry is still coming; empty (zero height) when the read
 * definitely had nothing to show.
 */
export function articleMarketSlot(a, mk) {
  if (!articleMarketEvent(a)) return '';
  const html = articleMarketHtml(mk?.now, mk?.pbe);
  if (!html && (mk?.pending || mk?.failed)) return '<div class="art-market art-market--reserved" data-art-market data-art-market-state="pending" aria-busy="true"></div>';
  return `<div class="art-market" data-art-market>${html}</div>`;
}

/**
 * After render. First paint already holds the module when the read beat the budget. Otherwise the reserved slot is
 * hydrated by the late answer (wherever the slot is: the reservation already holds the space), failed reads retry on
 * ARTICLE_MARKET_RETRY_MS, and a definite "nothing" (or exhausted retries) collapses the reservation. Then ~30 s
 * refresh while visible (client rules).
 */
export function mountArticleMarketSlot(root, a, { now = null, pending = null, failed = false, pbe = null, pbePending = null } = {}, { fetchImpl, retryMs = ARTICLE_MARKET_RETRY_MS, setTimer = (f, ms) => setTimeout(f, ms) } = {}) {
  const slot = root?.querySelector?.('[data-art-market]');
  const ev = articleMarketEvent(a);
  if (!slot || !ev) return () => {};
  let ctx = pbe;
  let stop = () => {};
  let gone = false;
  const alive = () => !gone && slot.isConnected !== false;
  const settle = () => { slot.classList?.remove('art-market--reserved'); slot.removeAttribute?.('aria-busy'); slot.setAttribute?.('data-art-market-state', 'settled'); };
  const start = (initial) => {
    if (!alive()) return;
    settle();
    stop = mountArticleMarket(slot, { base: ARTICLE_MARKET_BASE, sport: ev.sport, eventId: ev.eventId, publishedAt: ev.publishedAt, initial, refreshMs: ARTICLE_MARKET_REFRESH_MS, pbeContext: () => ctx });
  };
  const collapse = () => { if (alive()) { settle(); slot.innerHTML = ''; } };
  const onRead = (next) => (r) => {
    if (r.state === 'ok') start(r.body);
    else if (r.state === 'error') attempt(next);
    else collapse();
  };
  function attempt(i) {
    if (!alive()) return;
    if (i >= retryMs.length) { collapse(); return; }
    setTimer(() => { if (alive()) readArticleMarket(ev, fetchImpl).then(onRead(i + 1)); }, retryMs[i]);
  }
  // A late NFL context replaces only the PBE strip inside an already-rendered module (or waits for the market read).
  pbePending?.then((late) => { if (late) { ctx = late; stop.repaint?.(); } });
  if (now) start(now);
  else if (pending) (pending.read || pending.then((b) => (b ? { state: 'ok', body: b } : { state: 'none' }))).then(onRead(0));
  else if (failed) attempt(0);
  return () => { gone = true; stop(); };
}
