/**
 * api/_lib/orders.js
 *
 * The order ledger. Supabase over PostgREST, matching the convention the rest
 * of the organisation already uses, so there is one place to look when an
 * order goes wrong.
 *
 * The governing rule: a paid order must never be lost. That shapes two
 * decisions here.
 *
 * First, `configured()` is checked by the webhook BEFORE it acknowledges a
 * payment. If there is nowhere to write the order, the webhook returns a 5xx
 * so Stripe keeps retrying, rather than a 200 that would strand a real
 * payment with no record anywhere.
 *
 * Second, idempotency is enforced on the Stripe event id with a unique
 * constraint, not with a read-then-write. Webhook redeliveries arrive
 * concurrently, and a check followed by an insert has a race in the middle
 * that produces two fulfilment orders for one payment.
 *
 * No card data is stored. Stripe holds the payment method; we hold ids.
 */

const URL_ = () => (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export function configured() {
  return Boolean(URL_() && KEY());
}

export class LedgerNotConfigured extends Error {
  constructor() {
    super('ORDER_STORE_NOT_CONFIGURED: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing');
    this.name = 'LedgerNotConfigured';
    this.code = 'ORDER_STORE_NOT_CONFIGURED';
  }
}

function headers(extra = {}) {
  if (!configured()) throw new LedgerNotConfigured();
  return { apikey: KEY(), authorization: `Bearer ${KEY()}`, 'content-type': 'application/json', ...extra };
}

async function rest(path, init = {}) {
  const res = await fetch(`${URL_()}/rest/v1/${path}`, { ...init, headers: headers(init.headers) });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`ledger ${res.status}: ${text.slice(0, 300)}`);
    err.status = res.status;
    err.body = text;
    throw err;
  }
  return text ? JSON.parse(text) : null;
}

/**
 * Claim a Stripe event. Returns the created row, or null when this event was
 * already recorded, which is the signal to stop and do nothing further.
 *
 * The uniqueness of stripe_event_id is what makes redelivery safe. We rely on
 * the database rejecting the second insert rather than on having looked first.
 */
export async function claimEvent({ stripeEventId, sessionId, paymentIntentId, email, items, amounts, currency }) {
  const row = {
    stripe_event_id: stripeEventId,
    stripe_checkout_session_id: sessionId,
    stripe_payment_intent_id: paymentIntentId || null,
    customer_email: email || null,
    items,
    subtotal: amounts?.subtotal ?? null,
    shipping: amounts?.shipping ?? null,
    tax: amounts?.tax ?? null,
    total: amounts?.total ?? null,
    currency: currency || 'usd',
    fulfillment_provider: 'printful',
    provider_status: 'pending',
    status: 'paid',
    paid_at: new Date().toISOString(),
  };
  try {
    const created = await rest('store_orders', {
      method: 'POST',
      headers: { prefer: 'return=representation' },
      body: JSON.stringify([row]),
    });
    return created?.[0] || null;
  } catch (e) {
    /* 23505 is a unique violation: this event has already been handled. */
    if (e.status === 409 || String(e.body || '').includes('23505')) return null;
    throw e;
  }
}

export async function markSubmitted(orderId, { providerOrderId, providerStatus }) {
  return rest(`store_orders?id=eq.${encodeURIComponent(orderId)}`, {
    method: 'PATCH',
    headers: { prefer: 'return=representation' },
    body: JSON.stringify({
      provider_order_id: providerOrderId,
      provider_status: providerStatus || 'draft',
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      failure_reason: null,
    }),
  });
}

/**
 * The order is paid but could not be handed to the provider. It is parked in
 * a state a human is expected to look at, with the reason preserved, and it
 * is never silently retried into a duplicate.
 */
export async function markReviewRequired(orderId, reason) {
  return rest(`store_orders?id=eq.${encodeURIComponent(orderId)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: 'FULFILLMENT_REVIEW_REQUIRED',
      failure_reason: String(reason || '').slice(0, 500),
      updated_at: new Date().toISOString(),
    }),
  });
}

export async function updateProviderStatus(orderId, { providerStatus, trackingNumber, trackingUrl }) {
  const patch = { provider_status: providerStatus, updated_at: new Date().toISOString() };
  if (trackingNumber) patch.tracking_number = trackingNumber;
  if (trackingUrl) patch.tracking_url = trackingUrl;
  if (providerStatus === 'shipped') patch.shipped_at = new Date().toISOString();
  if (providerStatus === 'delivered') patch.delivered_at = new Date().toISOString();
  return rest(`store_orders?id=eq.${encodeURIComponent(orderId)}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

export async function getBySession(sessionId) {
  const rows = await rest(`store_orders?select=*&stripe_checkout_session_id=eq.${encodeURIComponent(sessionId)}&limit=1`);
  return rows?.[0] || null;
}
