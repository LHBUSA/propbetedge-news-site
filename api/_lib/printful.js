/**
 * api/_lib/printful.js
 *
 * Fulfilment provider adapter. The rest of the system talks to the interface
 * at the bottom of this file, never to Printful directly, so swapping to
 * Printify later is a new file rather than a rewrite of the webhook.
 *
 * Every method throws ProviderNotConfigured when the token is absent. That is
 * deliberate and it is not a fallback: a webhook that swallows a missing
 * token would return 200 to Stripe, Stripe would stop retrying, and a paid
 * order would disappear silently. Throwing keeps the order in a retryable,
 * reviewable state instead.
 */

const API = 'https://api.printful.com';

export class ProviderNotConfigured extends Error {
  constructor(detail = 'PRINTFUL_API_TOKEN is not set') {
    super(`PROVIDER_NOT_CONFIGURED: ${detail}`);
    this.name = 'ProviderNotConfigured';
    this.code = 'PROVIDER_NOT_CONFIGURED';
  }
}

export class ProviderError extends Error {
  constructor(status, body) {
    super(`Printful ${status}: ${String(body).slice(0, 300)}`);
    this.name = 'ProviderError';
    this.status = status;
    /* 4xx is our bug (bad variant, bad address) and will fail again on retry.
     * 5xx and 429 are theirs and are worth retrying. The webhook uses this to
     * decide whether to ask Stripe to redeliver. */
    this.retryable = status === 429 || status >= 500;
  }
}

export function isConfigured() {
  return Boolean(process.env.PRINTFUL_API_TOKEN);
}

async function call(path, { method = 'GET', body } = {}) {
  const token = process.env.PRINTFUL_API_TOKEN;
  if (!token) throw new ProviderNotConfigured();

  const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  /* Store id is only required on accounts with more than one store. Sending
   * it when we have it avoids an ambiguous-store error later. */
  if (process.env.PRINTFUL_STORE_ID) headers['x-pf-store-id'] = String(process.env.PRINTFUL_STORE_ID);

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  if (!res.ok) throw new ProviderError(res.status, text);
  try { return JSON.parse(text); } catch { throw new ProviderError(res.status, `unparseable response: ${text.slice(0, 200)}`); }
}

/**
 * Create the fulfilment order.
 *
 * `externalId` is our own order id. Printful treats external_id as unique per
 * store, so a webhook redelivery that reaches this point a second time is
 * rejected by Printful rather than producing a duplicate shirt. That is the
 * outer guard; the ledger's own idempotency is the inner one.
 *
 * `confirm` is false by default, which creates the order as a draft. Nothing
 * is charged or printed until a draft is confirmed, so the whole path can be
 * proven end to end before a single real garment is produced.
 */
export async function createFulfillmentOrder({ externalId, recipient, items, confirm = false }) {
  if (!externalId) throw new Error('createFulfillmentOrder requires an externalId');
  if (!items?.length) throw new Error('createFulfillmentOrder requires at least one item');

  return call(`/orders?confirm=${confirm ? '1' : '0'}`, {
    method: 'POST',
    body: {
      external_id: externalId,
      recipient,
      items: items.map((i) => ({
        variant_id: i.providerVariantId,
        quantity: i.qty,
        /* Carries our slug into Printful's dashboard so a support question can
         * be traced back without opening the database. */
        name: i.name,
      })),
    },
  });
}

export async function getShippingRates({ recipient, items }) {
  return call('/shipping/rates', {
    method: 'POST',
    body: {
      recipient,
      items: items.map((i) => ({ variant_id: i.providerVariantId, quantity: i.qty })),
    },
  });
}

export async function getOrderStatus(providerOrderId) {
  const r = await call(`/orders/${encodeURIComponent(providerOrderId)}`);
  const d = r?.result || {};
  return {
    providerOrderId: d.id ?? providerOrderId,
    status: normalizeStatus(d.status),
    rawStatus: d.status || null,
    trackingNumber: d.shipments?.[0]?.tracking_number || null,
    trackingUrl: d.shipments?.[0]?.tracking_url || null,
  };
}

/* Printful's vocabulary mapped to ours. Anything unrecognised stays unknown
 * rather than being guessed into a customer-visible state. */
export function normalizeStatus(s) {
  switch (String(s || '').toLowerCase()) {
    case 'draft': return 'draft';
    case 'pending': case 'inprocess': case 'onhold': return 'in_production';
    case 'fulfilled': case 'shipped': return 'shipped';
    case 'delivered': return 'delivered';
    case 'canceled': case 'cancelled': case 'failed': return 'failed';
    default: return 'unknown';
  }
}

export const provider = {
  name: 'printful',
  isConfigured,
  createFulfillmentOrder,
  getShippingRates,
  getOrderStatus,
};
