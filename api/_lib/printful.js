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
  /* Printful has two kinds of private token and they differ in exactly one
   * way that matters here.
   *
   * A STORE-level token is already scoped to the store it was created for.
   * X-PF-Store-Id is not required, and sending one is at best redundant.
   *
   * An ACCOUNT-level token is not scoped, so it needs X-PF-Store-Id to say
   * which store a call is about.
   *
   * The header is therefore sent only when PRINTFUL_STORE_ID is explicitly
   * configured, and PRINTFUL_STORE_ID is optional. Requiring it would refuse
   * a perfectly valid store-level token for no reason. */
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
 * Auth canary. GET /stores is the cheapest call that proves three things at
 * once: the token is valid, it reaches the API, and which store it actually
 * controls. It creates nothing and costs nothing.
 *
 * A store-level token returns exactly the store it is scoped to, which is the
 * fact worth confirming before any order is created: a token pointed at the
 * wrong store would otherwise be discovered by a shirt arriving from it.
 */
export async function getStores() {
  const r = await call('/stores');
  const list = Array.isArray(r?.result) ? r.result : r?.result ? [r.result] : [];
  return list.map((s) => ({
    id: s.id,
    name: s.name,
    type: s.type ?? null,
    website: s.website ?? null,
    currency: s.currency ?? null,
  }));
}

/**
 * Which store this token will act on, and whether that is unambiguous.
 *
 * Scoped means the token resolves to a single store on its own, so no
 * X-PF-Store-Id is needed. Ambiguous means the token sees several stores and
 * PRINTFUL_STORE_ID must say which, otherwise Printful will either guess or
 * refuse and neither is acceptable for an order.
 */
export async function resolveStoreContext() {
  const stores = await getStores();
  const configured = process.env.PRINTFUL_STORE_ID ? String(process.env.PRINTFUL_STORE_ID) : null;
  if (configured) {
    const hit = stores.find((s) => String(s.id) === configured) || null;
    return { mode: 'account_token_with_store_id', stores, selected: hit, ambiguous: false, ok: Boolean(hit) };
  }
  if (stores.length === 1) return { mode: 'store_token', stores, selected: stores[0], ambiguous: false, ok: true };
  return { mode: 'account_token_missing_store_id', stores, selected: null, ambiguous: stores.length > 1, ok: false };
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
  getStores,
  resolveStoreContext,
  createFulfillmentOrder,
  getShippingRates,
  getOrderStatus,
};
