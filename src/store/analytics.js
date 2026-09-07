/**
 * src/store/analytics.js
 *
 * Store events, kept deliberately thin.
 *
 * The site has no analytics runtime of its own today, so this emits to
 * whatever is present (gtag or dataLayer) and otherwise does nothing. It does
 * not load a tracker, does not set a cookie, and does not identify anyone.
 * Product, variant and quantity are enough to answer every question the store
 * needs answered; an email address is not, so none is ever sent.
 */
const EVENTS = new Set(['store_view', 'product_view', 'add_to_cart', 'remove_from_cart', 'checkout_started', 'purchase']);

export function track(event, payload = {}) {
  if (!EVENTS.has(event)) return;
  const detail = { ...payload, event };
  try {
    if (typeof window.gtag === 'function') window.gtag('event', event, payload);
    else if (Array.isArray(window.dataLayer)) window.dataLayer.push(detail);
    /* Always dispatch a DOM event so a future analytics layer can subscribe
     * without this file needing to know about it. */
    window.dispatchEvent(new CustomEvent('pbe:store', { detail }));
  } catch {
    /* Analytics must never break a purchase. */
  }
}
