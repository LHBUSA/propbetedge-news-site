// Kalshi PERPETUALS partner offer on propbetedge.ai (contract kalshi-partner/2) — owner 2026-10-07.
//
// A commercial partner unit, never the story and never market evidence:
//  - homepage: ONE subordinate branded strip ('short') at the foot of the existing Market Pulse module;
//  - articles: ONE compact branded card ('card') after the editorial body + Preferred Source, before Related Coverage.
// Never in a headline/dek, PBE analysis, body paragraphs, picks, hero, Breaking, or beside a YES/NO price, and never
// inside the Article Market module: "Open on Kalshi" there stays the direct kalshi.com/markets/... link.
//
// All copy, the disclosure and rel="sponsored noopener noreferrer" come from the vendored canonical client
// (src/vendor/kalshi/kalshi-partner.js = propbetedge-workers workers/propsports-markets/client/kalshi-partner.js at
// KALSHI_PARTNER_CLIENT_PIN, byte-identical). This file holds NO referral URL and NO offer economics.
// Config is read from the same-origin rewrite /go/kalshi-perps/config (vercel.json -> propsports-markets
// /v1/partner/kalshi): disabled (network kill switch), failed, or malformed config renders nothing; unverified/stale
// terms render the generic "See current Kalshi partner offer". The click goes to /go/kalshi-perps (fixed 302).
//
// Presentation only (owner 2026-10-08): this file adds the official Kalshi wordmark (white, per kalshi.com/brandkit
// "white logo on black background"; provenance in docs/kalshi-partner-logo.md) in front of the canonical
// block and drops the word "KALSHI" from the kicker beside it (the logo's alt text says it). It never edits offer
// copy, the link, rel, or the disclosure.
import { loadPartnerConfig, partnerOffer } from './vendor/kalshi/kalshi-partner.js';

export const KALSHI_PARTNER_CLIENT_PIN = '4c3972a';
export const KALSHI_PARTNER_CLIENT_SHA256 = '063e631feadb8011fd6e1a3e7cc92908dd7f402f69fd3f5cb0153b5db4b09b7f';
export const PARTNER_CONFIG_URL = '/go/kalshi-perps/config';
export const PARTNER_PRODUCT = 'propbetedge';
export const HOME_PARTNER_VARIANT = 'short';
export const ARTICLE_PARTNER_VARIANT = 'card';
export const KALSHI_LOGO_SRC = '/assets/partners/kalshi/kalshi-wordmark-white.svg';

export const HOME_PARTNER_CONTEXT = Object.freeze({ placement: 'propbetedge_home_market_pulse', product: PARTNER_PRODUCT });
const ARTICLE_PLACEMENT = 'propbetedge_article_footer';

const SPORT_KEY = /^[a-z0-9_]{1,40}$/;

export function articlePartnerContext(article) {
  const sport = String(article?.sport || '').toLowerCase();
  return { placement: ARTICLE_PLACEMENT, product: PARTNER_PRODUCT, ...(SPORT_KEY.test(sport) ? { sport } : {}) };
}

/** The article's one partner slot (empty + hidden until config decides). */
export function articlePartnerSlot() {
  return '<div class="pbe-kxo-slot pbe-article-partner" data-pbe-kxo-slot="article" hidden></div>';
}

/** Article footer = compact card; everything else (the homepage strip) = short. */
export function partnerVariant(ctx) {
  return ctx?.placement === ARTICLE_PLACEMENT ? ARTICLE_PARTNER_VARIANT : HOME_PARTNER_VARIANT;
}

const LOGO = `<img class="pbe-kxo-logo" src="${KALSHI_LOGO_SRC}" alt="Kalshi" width="772" height="226" decoding="async">`;

/**
 * Brand the canonical block: wordmark first inside the <aside>, and the kicker's leading "KALSHI " removed (the
 * wordmark sits beside it). Works on the canonical output string only; '' stays ''.
 */
export function brandPartnerHtml(html) {
  if (!html) return '';
  return html
    .replace(/^(<aside class="kxo [^"]*"[^>]*>)/, `$1<span class="pbe-kxo-brand">${LOGO}</span>`)
    .replace(/(<span class="kxo__kicker">)KALSHI /, '$1');
}

/** Markup for a context, or '' when the config is disabled / invalid. Pure. */
export function partnerOfferHtml(cfg, ctx, variant = partnerVariant(ctx)) {
  return brandPartnerHtml(partnerOffer(cfg, ctx, { variant }));
}

/**
 * Fill ONE slot. Nothing renders unless the central config says enabled; any failure leaves the slot hidden and
 * empty. A slot is filled at most once (a second call is a no-op), so a page never shows the offer twice.
 */
export async function mountPartnerOffer(slot, ctx, { load = loadPartnerConfig, url = PARTNER_CONFIG_URL } = {}) {
  if (!slot || slot.dataset?.pbeKxoMounted) return '';
  if (slot.dataset) slot.dataset.pbeKxoMounted = '1';
  let html = '';
  try {
    html = partnerOfferHtml(await load(url), ctx);
  } catch {
    html = '';
  }
  if (slot.isConnected === false) return '';
  if (!html) {
    slot.innerHTML = '';
    slot.hidden = true;
    return '';
  }
  slot.innerHTML = html;
  slot.hidden = false;
  return html;
}
