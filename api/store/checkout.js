/**
 * api/store/checkout.js
 *
 * Creates a Stripe Checkout Session from a cart.
 *
 * The single most important property of this endpoint: it does not trust the
 * browser for anything except identity and quantity. The request may say
 * "two of slug X in size M, black". It may not say what that costs. Price,
 * name and currency are resolved here from the catalog, and a request that
 * tries to supply its own price is rejected outright rather than ignored,
 * because a client sending a price is either broken or hostile and both are
 * worth surfacing.
 *
 * Checkout is refused entirely while the fulfilment provider is unconfigured.
 * Taking money for a shirt no one can print is the one failure this store
 * must not have.
 */
import { bySlug, isPurchasable, providerConfigured, variantKey } from '../../src/store/catalog.js';

const MAX_LINES = 20;
const MAX_QTY = 20;

const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return json(res, 503, { error: 'stripe_not_configured', message: 'Checkout is not enabled yet.' });

  /* Refuse before charging, not after. */
  if (!providerConfigured()) {
    return json(res, 503, {
      error: 'PROVIDER_NOT_CONFIGURED',
      message: 'The collection is not purchasable yet. Fulfilment is not connected.',
    });
  }

  let body;
  try {
    body = typeof req.body === 'object' && req.body ? req.body : JSON.parse(req.body || '{}');
  } catch {
    return json(res, 400, { error: 'invalid_json' });
  }

  const rawLines = Array.isArray(body.lines) ? body.lines : [];
  if (!rawLines.length) return json(res, 400, { error: 'empty_cart' });
  if (rawLines.length > MAX_LINES) return json(res, 400, { error: 'too_many_lines' });

  const resolved = [];
  for (const l of rawLines) {
    /* A client that sends money-shaped fields is rejected loudly. */
    if ('price' in l || 'unit_amount' in l || 'amount' in l || 'lineTotal' in l) {
      return json(res, 400, { error: 'price_not_accepted', message: 'Prices are resolved server-side.' });
    }
    const product = bySlug(String(l.slug || ''));
    if (!product) return json(res, 400, { error: 'unknown_sku', slug: l.slug });

    const size = String(l.size || '');
    const color = String(l.color || '');
    if (!product.sizes.includes(size)) return json(res, 400, { error: 'unknown_size', slug: product.slug, size });
    if (!product.colors.includes(color)) return json(res, 400, { error: 'unknown_color', slug: product.slug, color });

    const qty = Math.floor(Number(l.qty));
    if (!Number.isFinite(qty) || qty < 1 || qty > MAX_QTY) return json(res, 400, { error: 'invalid_quantity', slug: product.slug });

    if (!isPurchasable(product, size, color)) {
      return json(res, 409, { error: 'variant_not_available', slug: product.slug, variant: variantKey(size, color) });
    }

    resolved.push({
      slug: product.slug,
      name: product.name,
      size,
      color,
      qty,
      unit_amount: product.retail_price,           // from the catalog, never the request
      currency: product.currency,
      providerVariantId: product.provider_variant_ids[variantKey(size, color)],
    });
  }

  const origin = process.env.STORE_ORIGIN || `https://${req.headers['x-forwarded-host'] || req.headers.host}`;

  /* Stripe's API is form-encoded. Building the body by hand avoids adding the
   * Stripe SDK to a site that currently has zero runtime dependencies. */
  const form = new URLSearchParams();
  form.set('mode', 'payment');
  form.set('success_url', `${origin}/store/thanks?session_id={CHECKOUT_SESSION_ID}`);
  form.set('cancel_url', `${origin}/store/cart`);
  form.set('billing_address_collection', 'auto');
  form.set('shipping_address_collection[allowed_countries][0]', 'US');
  form.set('shipping_address_collection[allowed_countries][1]', 'CA');
  form.set('shipping_address_collection[allowed_countries][2]', 'GB');
  /* Stripe Automatic Tax computes destination tax from the shipping address.
   * It is enabled here rather than hard-coding rates, which would be wrong in
   * most jurisdictions within a year. */
  form.set('automatic_tax[enabled]', 'true');

  resolved.forEach((l, i) => {
    form.set(`line_items[${i}][quantity]`, String(l.qty));
    form.set(`line_items[${i}][price_data][currency]`, l.currency);
    form.set(`line_items[${i}][price_data][unit_amount]`, String(l.unit_amount));
    form.set(`line_items[${i}][price_data][product_data][name]`, `${l.name} — ${l.size} / ${l.color}`);
    form.set(`line_items[${i}][price_data][tax_behavior]`, 'exclusive');
  });

  /* The cart travels to the webhook through Stripe metadata so fulfilment
   * never depends on the browser coming back. Metadata values are capped at
   * 500 characters, so only what fulfilment actually needs is carried. */
  const compact = resolved.map((l) => ({ s: l.slug, z: l.size, c: l.color, q: l.qty, v: l.providerVariantId }));
  const encoded = JSON.stringify(compact);
  if (encoded.length > 480) {
    return json(res, 400, { error: 'cart_too_large', message: 'Please order fewer distinct items at once.' });
  }
  form.set('metadata[cart]', encoded);
  form.set('metadata[catalog_version]', String(body.catalogVersion || ''));

  try {
    const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${secret}`,
        'content-type': 'application/x-www-form-urlencoded',
        /* Stripe deduplicates on this key, so a double-click or a retried
         * request reuses the existing session instead of opening a second. */
        'idempotency-key': `cart_${hash(encoded)}`,
      },
      body: form.toString(),
      signal: AbortSignal.timeout(20000),
    });
    const session = await r.json();
    if (!r.ok) return json(res, 502, { error: 'stripe_error', detail: session?.error?.message || 'unknown' });
    return json(res, 200, { url: session.url, id: session.id });
  } catch (e) {
    return json(res, 502, { error: 'stripe_unreachable', detail: String(e?.message || e).slice(0, 200) });
  }
}

/* Small stable hash for the idempotency key. Not security-sensitive. */
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}
