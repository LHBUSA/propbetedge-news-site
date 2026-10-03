/**
 * src/market-pulse-launch.js
 * Homepage launch module: Kalshi prediction-market intelligence across the network.
 *
 * Owner positioning (2026-10-03): PropBetEdge is not waiting on Vegas. The only
 * claim is that we can surface real market pricing without requiring a
 * sportsbook line to exist. Never say prediction markets are earlier, faster or
 * more accurate than sportsbooks, or that sportsbook lines are stale.
 * Prices come from Kalshi; they are not sportsbook odds and not a PBE model.
 *
 * Pure render (no window/document at import). The static module is complete on
 * first paint; mountMarketPulseLive() only lights a fixed-size dot on sports
 * whose coverage state is ACTIVE_MARKET, so nothing shifts and nothing empty
 * is ever rendered. A failed fetch leaves the static module untouched.
 */

import { INTELLIGENCE_SPORTS, INTELLIGENCE_ORDER, ctaAttrs } from './intelligence-cta.js';

export const MARKET_PULSE_COPY = Object.freeze({
  kicker: 'NEW · PREDICTION MARKETS',
  headline: 'DON’T WAIT ON VEGAS',
  dek: 'Prediction-market intelligence is now live across PropBetEdge.',
  body: 'PropBetEdge now tracks live prediction markets across the sports network, giving us another real-time signal without waiting for traditional sportsbook odds to appear.',
  tagline: 'Proprietary intelligence + live prediction markets — without waiting on Vegas.',
  attribution: 'Prices from Kalshi, a regulated prediction market. Not sportsbook odds and not a PropBetEdge model.',
});

export const MARKET_PULSE_COVERAGE_URL =
  'https://propsports-markets.sales-fd3.workers.dev/v1/market-intelligence/coverage';

const ACTIVE_STATE = 'ACTIVE_MARKET';

export function renderMarketPulseLaunch() {
  const c = MARKET_PULSE_COPY;
  return `
    <section class="pbe-market-pulse" data-pbe-market-pulse aria-labelledby="pbe-market-pulse-title">
      <span class="pbe-intel-cta-kicker"><span class="pbe-intel-cta-dot" aria-hidden="true"></span>${esc(c.kicker)}</span>
      <h2 id="pbe-market-pulse-title" class="pbe-market-pulse-title">${esc(c.headline)}</h2>
      <p class="pbe-market-pulse-dek">${esc(c.dek)}</p>
      <p class="pbe-market-pulse-body">${esc(c.body)}</p>
      <p class="pbe-market-pulse-tagline">${esc(c.tagline)}</p>
      <nav class="pbe-intel-row-links pbe-market-pulse-links" aria-label="Kalshi Market Pulse across PropBetEdge">
        ${INTELLIGENCE_ORDER.map((key) => {
          const intel = INTELLIGENCE_SPORTS[key];
          return `<a href="${esc(intel.href)}" data-pbe-market-sport="${esc(key)}" ${ctaAttrs(intel, { placement: 'market_pulse_launch', pageType: 'home' })}><span class="pbe-market-pulse-live" aria-hidden="true"></span><span aria-hidden="true">${intel.emoji}</span> ${esc(intel.label)}<span class="pbe-market-pulse-sr" data-pbe-market-sr></span> <span aria-hidden="true">→</span></a>`;
        }).join('')}
      </nav>
      <p class="pbe-market-pulse-attribution">${esc(c.attribution)}</p>
    </section>
  `;
}

/** Sports whose coverage state is ACTIVE_MARKET. Anything else is ignored. */
export function activeMarketSports(coverage) {
  const rows = Array.isArray(coverage?.sports) ? coverage.sports : [];
  return rows
    .filter((row) => row && row.state === ACTIVE_STATE && INTELLIGENCE_SPORTS[String(row.sport || '').toLowerCase()])
    .map((row) => String(row.sport).toLowerCase());
}

/** Progressive enhancement: mark ACTIVE_MARKET sports. Never throws, never adds empty UI. */
export async function mountMarketPulseLive(root, { fetchImpl = globalThis.fetch, timeoutMs = 6000 } = {}) {
  const section = root?.querySelector?.('[data-pbe-market-pulse]');
  if (!section || typeof fetchImpl !== 'function') return [];
  let active = [];
  try {
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
    const res = await fetchImpl(MARKET_PULSE_COVERAGE_URL, { signal: ctrl?.signal, credentials: 'omit' });
    if (timer) clearTimeout(timer);
    if (!res?.ok) return [];
    active = activeMarketSports(await res.json());
  } catch {
    return [];
  }
  if (!section.isConnected && section.isConnected !== undefined) return [];
  for (const sport of active) {
    const link = section.querySelector(`[data-pbe-market-sport="${sport}"]`);
    if (!link) continue;
    link.classList.add('is-market-live');
    const sr = link.querySelector('[data-pbe-market-sr]');
    if (sr) sr.textContent = ' — live Kalshi markets';
  }
  return active;
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
