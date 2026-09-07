/**
 * api/store/webhook.js
 *
 * The only place a fulfilment order is ever created.
 *
 * Not the success URL, not client state, not a polling job. A browser can be
 * closed, replayed, or forged; a signed webhook cannot. The order of
 * operations below is the whole design:
 *
 *   1. verify the signature, in constant time, or refuse
 *   2. refuse to acknowledge at all if the ledger is unreachable
 *   3. claim the event id, which the database rejects on redelivery
 *   4. only then call the provider
 *   5. on provider failure, park the order for review, never lose it
 *
 * The status codes matter as much as the logic. A 200 tells Stripe to stop
 * retrying. It is returned only when the order is safely recorded. Anything
 * that might be transient returns 5xx so Stripe delivers again.
 */
import { claimEvent, configured as ledgerConfigured, markReviewRequired, markSubmitted } from '../_lib/orders.js';
import { createFulfillmentOrder, isConfigured as providerReady, normalizeStatus, ProviderError, ProviderNotConfigured } from '../_lib/printful.js';

export const config = { api: { bodyParser: false } };

const send = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
};

async function rawBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(typeof c === 'string' ? Buffer.from(c) : c);
  return Buffer.concat(chunks).toString('utf8');
}

/* Constant-time compare so a wrong signature cannot be discovered byte by
 * byte from response timing. */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verify(raw, header, secret) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=').map((s) => s.trim())));
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;

  /* Reject anything older than five minutes: a captured signature must not be
   * replayable indefinitely. */
  const age = Math.abs(Date.now() / 1000 - Number(t));
  if (!Number.isFinite(age) || age > 300) return false;

  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${raw}`));
  const expected = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return timingSafeEqual(expected, v1);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const raw = await rawBody(req);

  if (!(await verify(raw, req.headers['stripe-signature'], secret))) {
    /* 400, not 500: the signature will not become valid on retry. */
    return send(res, 400, { error: 'invalid_signature' });
  }

  let event;
  try { event = JSON.parse(raw); } catch { return send(res, 400, { error: 'invalid_json' }); }

  if (event.type !== 'checkout.session.completed') {
    return send(res, 200, { ignored: event.type });
  }

  const session = event.data?.object || {};
  if (session.payment_status !== 'paid') {
    return send(res, 200, { ignored: 'not_paid', payment_status: session.payment_status });
  }

  /* Before acknowledging anything, make sure there is somewhere to record it.
   * A 200 here with no ledger would strand a real payment. */
  if (!ledgerConfigured()) {
    console.error('[store] ORDER_STORE_NOT_CONFIGURED — refusing to acknowledge a paid session', session.id);
    return send(res, 503, { error: 'ORDER_STORE_NOT_CONFIGURED' });
  }

  let cart = [];
  try { cart = JSON.parse(session.metadata?.cart || '[]'); } catch { cart = []; }

  const items = cart.map((c) => ({ slug: c.s, size: c.z, color: c.c, qty: c.q, providerVariantId: c.v }));

  let order;
  try {
    order = await claimEvent({
      stripeEventId: event.id,
      sessionId: session.id,
      paymentIntentId: session.payment_intent,
      email: session.customer_details?.email,
      items,
      amounts: {
        subtotal: session.amount_subtotal,
        shipping: session.shipping_cost?.amount_total ?? null,
        tax: session.total_details?.amount_tax ?? null,
        total: session.amount_total,
      },
      currency: session.currency,
    });
  } catch (e) {
    console.error('[store] ledger write failed', e?.message);
    return send(res, 503, { error: 'ledger_unavailable' });
  }

  /* Already handled. The unique constraint on the event id did its job. */
  if (!order) return send(res, 200, { duplicate: true, event: event.id });

  if (!items.length) {
    await markReviewRequired(order.id, 'Paid session carried no cart metadata; cannot determine what to print.');
    return send(res, 200, { order: order.id, status: 'FULFILLMENT_REVIEW_REQUIRED' });
  }

  if (!providerReady()) {
    /* The payment is recorded and safe. The provider simply is not connected
     * yet, which is a configuration state a human resolves, not something to
     * retry forever against Stripe. */
    await markReviewRequired(order.id, 'PROVIDER_NOT_CONFIGURED: PRINTFUL_API_TOKEN missing at fulfilment time.');
    return send(res, 200, { order: order.id, status: 'FULFILLMENT_REVIEW_REQUIRED', reason: 'PROVIDER_NOT_CONFIGURED' });
  }

  const d = session.customer_details || {};
  const a = session.shipping_details?.address || d.address || {};
  const recipient = {
    name: session.shipping_details?.name || d.name || null,
    email: d.email || null,
    address1: a.line1 || null,
    address2: a.line2 || null,
    city: a.city || null,
    state_code: a.state || null,
    country_code: a.country || null,
    zip: a.postal_code || null,
  };

  try {
    const created = await createFulfillmentOrder({
      /* Our own order id is the provider-side idempotency key, so a retry that
       * somehow reaches here twice is rejected by Printful rather than
       * printing a second shirt. */
      externalId: order.id,
      recipient,
      items: items.map((i) => ({ ...i, name: `${i.slug} ${i.size}/${i.color}` })),
      confirm: process.env.PRINTFUL_CONFIRM_ORDERS === 'true',
    });
    const result = created?.result || {};
    await markSubmitted(order.id, { providerOrderId: result.id, providerStatus: normalizeStatus(result.status) });
    return send(res, 200, { order: order.id, provider_order_id: result.id, status: normalizeStatus(result.status) });
  } catch (e) {
    const retryable = e instanceof ProviderError && e.retryable;
    await markReviewRequired(order.id, `${e.code || e.name}: ${e.message}`);
    console.error('[store] fulfilment failed', order.id, e?.message);
    if (retryable && !(e instanceof ProviderNotConfigured)) {
      /* Their outage, not our data. Ask Stripe to deliver again; the ledger
       * claim above means the retry will short-circuit as a duplicate if it
       * later succeeds another way, so this cannot double-print. */
      return send(res, 503, { order: order.id, error: 'provider_unavailable', retry: true });
    }
    return send(res, 200, { order: order.id, status: 'FULFILLMENT_REVIEW_REQUIRED' });
  }
}
