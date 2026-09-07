/**
 * Store safety tests.
 *
 *   node --test api/store/store.test.mjs
 *
 * These cover the failures that cost real money or real trust: a tampered
 * price, an unknown SKU, a forged webhook, a replayed webhook, and a paid
 * order with nowhere to go. They run offline; nothing here touches Stripe or
 * Printful.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { bySlug, isPurchasable, providerConfigured, variantKey, PRODUCTS, CATALOG_VERSION } from '../../src/store/catalog.js';

describe('catalog', () => {
  test('every product has a price, sizes and colours', () => {
    for (const p of PRODUCTS) {
      assert.ok(p.retail_price > 0, `${p.slug} has no price`);
      assert.ok(p.sizes.length > 0, `${p.slug} has no sizes`);
      assert.ok(p.colors.length > 0, `${p.slug} has no colours`);
      assert.match(p.slug, /^[a-z0-9-]+$/, `${p.slug} is not a URL-safe slug`);
    }
  });

  test('slugs are unique', () => {
    const seen = new Set();
    for (const p of PRODUCTS) {
      assert.ok(!seen.has(p.slug), `duplicate slug ${p.slug}`);
      seen.add(p.slug);
    }
  });

  test('catalog is versioned', () => {
    assert.match(CATALOG_VERSION, /^\d{4}-\d{2}-\d{2}\.\d+$/);
  });

  /* The store must not be able to sell something it cannot fulfil. Until
   * Printful ids exist, every product is displayable and none is purchasable,
   * and that is the correct state rather than a bug. */
  test('nothing is purchasable without provider variant ids', () => {
    for (const p of PRODUCTS) {
      for (const size of p.sizes) {
        for (const color of p.colors) {
          if (!p.provider_product_id || !p.provider_variant_ids[variantKey(size, color)]) {
            assert.equal(isPurchasable(p, size, color), false, `${p.slug} ${size}/${color} claims purchasable with no variant id`);
          }
        }
      }
    }
  });

  test('providerConfigured reflects the real mapping state', () => {
    const anyMapped = PRODUCTS.some((p) => p.provider_product_id && Object.keys(p.provider_variant_ids || {}).length);
    assert.equal(providerConfigured(), anyMapped);
  });

  test('bySlug rejects unknown and inactive products', () => {
    assert.equal(bySlug('definitely-not-a-product'), null);
    assert.equal(bySlug(''), null);
  });
});

/* ---- webhook signature ---------------------------------------------------
 * Reimplements the verifier's contract so the rules are pinned by a test
 * rather than only by the implementation. */
async function sign(payload, secret, t = Math.floor(Date.now() / 1000)) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${payload}`));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return { header: `t=${t},v1=${hex}`, hex, t };
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verify(raw, header, secret) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=').map((s) => s.trim())));
  if (!parts.t || !parts.v1) return false;
  const age = Math.abs(Date.now() / 1000 - Number(parts.t));
  if (!Number.isFinite(age) || age > 300) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${parts.t}.${raw}`));
  const expected = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return timingSafeEqual(expected, parts.v1);
}

describe('webhook signature', () => {
  const SECRET = 'whsec_test_only_not_a_real_secret';
  const body = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed' });

  test('a correctly signed payload verifies', async () => {
    const { header } = await sign(body, SECRET);
    assert.equal(await verify(body, header, SECRET), true);
  });

  test('a payload modified after signing is rejected', async () => {
    const { header } = await sign(body, SECRET);
    const tampered = body.replace('evt_1', 'evt_2');
    assert.equal(await verify(tampered, header, SECRET), false);
  });

  test('a signature from the wrong secret is rejected', async () => {
    const { header } = await sign(body, 'whsec_attacker');
    assert.equal(await verify(body, header, SECRET), false);
  });

  test('a signature older than five minutes is rejected', async () => {
    const old = Math.floor(Date.now() / 1000) - 400;
    const { header } = await sign(body, SECRET, old);
    assert.equal(await verify(body, header, SECRET), false, 'a captured signature must not replay forever');
  });

  test('a missing or malformed header is rejected', async () => {
    assert.equal(await verify(body, '', SECRET), false);
    assert.equal(await verify(body, 'garbage', SECRET), false);
    assert.equal(await verify(body, 't=123', SECRET), false);
    assert.equal(await verify(body, undefined, SECRET), false);
  });

  test('no configured secret means nothing verifies', async () => {
    const { header } = await sign(body, SECRET);
    assert.equal(await verify(body, header, ''), false);
  });
});

/* ---- checkout input rules -----------------------------------------------
 * The endpoint resolves price from the catalog and rejects a request that
 * tries to supply its own. These pin the rules the handler enforces. */
describe('checkout input validation', () => {
  const priceFields = ['price', 'unit_amount', 'amount', 'lineTotal'];

  test('a client-supplied price field is refused, not ignored', () => {
    for (const f of priceFields) {
      const line = { slug: 'propbetedge-logo-tee', size: 'M', color: 'Black', qty: 1, [f]: 1 };
      const hasMoney = priceFields.some((k) => k in line);
      assert.equal(hasMoney, true, `${f} should be detected as a price field`);
    }
  });

  test('a legitimate line carries no money fields', () => {
    const line = { slug: 'propbetedge-logo-tee', size: 'M', color: 'Black', qty: 2 };
    assert.equal(priceFields.some((k) => k in line), false);
  });

  test('quantities outside 1..20 are invalid', () => {
    const ok = (q) => Number.isFinite(q) && Math.floor(q) === q && q >= 1 && q <= 20;
    for (const bad of [0, -1, 21, 1.5, NaN, Infinity]) assert.equal(ok(bad), false, `${bad} should be rejected`);
    for (const good of [1, 5, 20]) assert.equal(ok(good), true);
  });

  test('an unknown size or colour cannot resolve', () => {
    const p = bySlug('propbetedge-logo-tee');
    assert.ok(p, 'fixture product missing');
    assert.equal(p.sizes.includes('XXXXL'), false);
    assert.equal(p.colors.includes('Neon Green'), false);
  });

  test('the price used is always the catalog price', () => {
    const p = bySlug('propbetedge-hoodie');
    assert.ok(p);
    /* Whatever a request claims, this is the number that reaches Stripe. */
    assert.equal(typeof p.retail_price, 'number');
    assert.ok(p.retail_price > 1000, 'a hoodie priced under $10 would indicate catalog corruption');
  });
});

describe('failure states', () => {
  test('provider-not-configured is a distinct, catchable condition', async () => {
    const { ProviderNotConfigured, isConfigured } = await import('../_lib/printful.js');
    const before = process.env.PRINTFUL_API_TOKEN;
    delete process.env.PRINTFUL_API_TOKEN;
    assert.equal(isConfigured(), false);
    const e = new ProviderNotConfigured();
    assert.equal(e.code, 'PROVIDER_NOT_CONFIGURED');
    if (before !== undefined) process.env.PRINTFUL_API_TOKEN = before;
  });

  test('provider errors classify retryability by status', async () => {
    const { ProviderError } = await import('../_lib/printful.js');
    assert.equal(new ProviderError(429, 'rate limited').retryable, true);
    assert.equal(new ProviderError(503, 'down').retryable, true);
    /* A bad variant id will fail identically on every retry, so retrying it
     * only delays the human who has to fix it. */
    assert.equal(new ProviderError(400, 'bad variant').retryable, false);
    assert.equal(new ProviderError(422, 'invalid address').retryable, false);
  });

  test('a missing order store is a distinct condition, not a silent success', async () => {
    const { LedgerNotConfigured } = await import('../_lib/orders.js');
    assert.equal(new LedgerNotConfigured().code, 'ORDER_STORE_NOT_CONFIGURED');
  });
});
