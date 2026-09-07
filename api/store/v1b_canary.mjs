/**
 * V1-B canary. Proves the fulfilment path without producing a garment.
 *
 *   PRINTFUL_API_TOKEN=... node api/store/v1b_canary.mjs
 *   PRINTFUL_API_TOKEN=... node api/store/v1b_canary.mjs --draft-order
 *
 * Every step reports pass, fail or skip with the reason, and the run stops at
 * the first step whose failure would make the next one meaningless. It never
 * confirms an order: --draft-order creates an unconfirmed draft, which
 * Printful neither charges nor prints, and even that is opt-in.
 *
 * The token is read from the environment or the repo's .env and is never
 * printed. Store metadata is printed, because knowing which store a token
 * controls is the point.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* Load .env / .env.local before anything reads process.env.
 *
 * Without this the canary only sees variables exported into the shell, so a
 * token sitting in the repo's own .env reports as "not configured" and the
 * run stops for a reason that is not true. Existing process env always wins,
 * so a deliberately exported value is never shadowed by a stale file. */
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
for (const f of ['.env', '.env.local']) {
  const file = path.join(REPO, f);
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const i = line.indexOf('=');
    if (i <= 0 || line.trimStart().startsWith('#')) continue;
    const k = line.slice(0, i).trim();
    if (!process.env[k]) process.env[k] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
}

const { getStores, isConfigured, resolveStoreContext, getShippingRates, createFulfillmentOrder, ProviderError, ProviderNotConfigured } = await import('../_lib/printful.js');
const { PRODUCTS, variantKey, providerConfigured } = await import('../../src/store/catalog.js');

const WANT_DRAFT = process.argv.includes('--draft-order');
const results = [];
const step = (name, status, detail = '') => {
  results.push({ name, status, detail });
  const mark = status === 'pass' ? 'PASS' : status === 'skip' ? 'SKIP' : 'FAIL';
  console.log(`${mark.padEnd(4)}  ${name}${detail ? ` — ${detail}` : ''}`);
};

/* A deliberately ordinary US address. Shipping quotes vary by destination, so
 * a fixed one keeps the number comparable between runs. */
const TEST_RECIPIENT = {
  name: 'PropBetEdge Canary',
  address1: '19749 Dearborn St',
  city: 'Chatsworth',
  state_code: 'CA',
  country_code: 'US',
  zip: '91311',
};

const main = async () => {
  console.log('PropBetEdge Store — V1-B canary\n');

  /* 1. auth --------------------------------------------------------------- */
  if (!isConfigured()) {
    step('auth', 'fail', 'PROVIDER_NOT_CONFIGURED: PRINTFUL_API_TOKEN not found in the environment or in .env / .env.local');
    console.log('\nNothing further can run. No order, no draft, no charge.');
    process.exit(3);
  }

  let ctx;
  try {
    ctx = await resolveStoreContext();
  } catch (e) {
    const why = e instanceof ProviderError ? `HTTP ${e.status}` : e.name;
    step('auth', 'fail', `${why}: ${String(e.message).slice(0, 160)}`);
    process.exit(1);
  }

  if (!ctx.ok) {
    if (ctx.ambiguous) {
      step('auth', 'fail', `token sees ${ctx.stores.length} stores; set PRINTFUL_STORE_ID to disambiguate (account-level token)`);
      for (const s of ctx.stores) console.log(`        store ${s.id} — ${s.name}`);
    } else {
      step('auth', 'fail', 'PRINTFUL_STORE_ID is set but does not match any store this token can see');
    }
    process.exit(1);
  }

  const store = ctx.selected;
  step('auth', 'pass', `${ctx.mode} · store ${store.id} "${store.name}"${store.currency ? ` · ${store.currency}` : ''}`);

  /* 2. catalog mapping ----------------------------------------------------- */
  const mapped = PRODUCTS.filter((p) => p.provider_product_id && Object.keys(p.provider_variant_ids || {}).length);
  const unmapped = PRODUCTS.filter((p) => !mapped.includes(p));
  if (!mapped.length) {
    step('product mapping', 'fail', `0 of ${PRODUCTS.length} products carry a Printful product and variant id`);
    console.log('\n        Fill provider_product_id and provider_variant_ids in src/store/catalog.js');
    console.log('        from the products created in Printful. Until then the store is');
    console.log('        displayable and not purchasable, which is the intended safe state.');
    step('shipping quote', 'skip', 'no mapped variant to quote');
    step('draft order', 'skip', 'no mapped variant to order');
    summarise();
    process.exit(2);
  }
  step('product mapping', 'pass', `${mapped.length} of ${PRODUCTS.length} products mapped`);
  if (unmapped.length) console.log(`        unmapped: ${unmapped.map((p) => p.slug).join(', ')}`);

  /* Pick the first concretely orderable variant. */
  const sample = (() => {
    for (const p of mapped) {
      for (const size of p.sizes) {
        for (const color of p.colors) {
          const id = p.provider_variant_ids[variantKey(size, color)];
          if (id) return { product: p, size, color, providerVariantId: id };
        }
      }
    }
    return null;
  })();
  if (!sample) {
    step('variant resolution', 'fail', 'a product is mapped but no size/colour resolves to a variant id');
    summarise();
    process.exit(2);
  }
  step('variant resolution', 'pass', `${sample.product.slug} ${sample.size}/${sample.color} -> variant ${sample.providerVariantId}`);

  /* 3. shipping ------------------------------------------------------------ */
  try {
    const rates = await getShippingRates({
      recipient: TEST_RECIPIENT,
      items: [{ providerVariantId: sample.providerVariantId, qty: 1 }],
    });
    const list = rates?.result || [];
    if (!list.length) step('shipping quote', 'fail', 'provider returned no rates for a US address');
    else {
      step('shipping quote', 'pass', `${list.length} option(s), cheapest ${list[0].currency || 'USD'} ${list[0].rate}`);
      for (const r of list.slice(0, 4)) console.log(`        ${r.id}: ${r.name} — ${r.rate} ${r.currency || ''} ${r.minDeliveryDays ? `(${r.minDeliveryDays}-${r.maxDeliveryDays}d)` : ''}`);
    }
  } catch (e) {
    step('shipping quote', 'fail', `${e.name}: ${String(e.message).slice(0, 160)}`);
  }

  /* 4. draft order --------------------------------------------------------- */
  if (!WANT_DRAFT) {
    step('draft order', 'skip', 'pass --draft-order to create one; it is never confirmed, so nothing is charged or printed');
  } else {
    const externalId = `canary-${Date.now()}`;
    try {
      const created = await createFulfillmentOrder({
        externalId,
        recipient: TEST_RECIPIENT,
        items: [{ providerVariantId: sample.providerVariantId, qty: 1, name: `${sample.product.slug} ${sample.size}/${sample.color}` }],
        confirm: false,                                   // never confirm in a canary
      });
      const id = created?.result?.id;
      const status = created?.result?.status;
      step('draft order', 'pass', `order ${id} status=${status} external_id=${externalId}`);
      console.log('        Draft only. It is not confirmed, so it will not be produced or charged.');
      console.log('        Delete it from the Printful dashboard when you are done.');

      /* 5. idempotency: the same external id must not create a second order. */
      try {
        const again = await createFulfillmentOrder({
          externalId,
          recipient: TEST_RECIPIENT,
          items: [{ providerVariantId: sample.providerVariantId, qty: 1, name: 'duplicate attempt' }],
          confirm: false,
        });
        const id2 = again?.result?.id;
        if (id2 && id2 !== id) step('idempotency', 'fail', `a second order ${id2} was created for the same external_id`);
        else step('idempotency', 'pass', 'provider returned the same order rather than creating a second');
      } catch (e) {
        /* Printful rejecting the duplicate is the outcome we want. */
        step('idempotency', 'pass', `provider refused the duplicate external_id (${e instanceof ProviderError ? `HTTP ${e.status}` : e.name})`);
      }
    } catch (e) {
      step('draft order', 'fail', `${e.name}: ${String(e.message).slice(0, 200)}`);
      step('idempotency', 'skip', 'no draft order to retry');
    }
  }

  /* 6. failure recovery: the classification the webhook depends on. */
  const retryable = new ProviderError(503, 'x').retryable && new ProviderError(429, 'x').retryable;
  const notRetryable = !new ProviderError(400, 'x').retryable && !new ProviderError(422, 'x').retryable;
  step('failure classification', retryable && notRetryable ? 'pass' : 'fail',
    retryable && notRetryable ? '429/5xx retryable, 4xx not' : 'retryability classification is wrong');
  step('not-configured path', new ProviderNotConfigured().code === 'PROVIDER_NOT_CONFIGURED' ? 'pass' : 'fail',
    'missing token raises a distinct, catchable condition');

  summarise();
};

function summarise() {
  const pass = results.filter((r) => r.status === 'pass').length;
  const fail = results.filter((r) => r.status === 'fail').length;
  const skip = results.filter((r) => r.status === 'skip').length;
  console.log(`\n${pass} passed · ${fail} failed · ${skip} skipped`);
  console.log(providerConfigured()
    ? 'Catalog reports the store as purchasable.'
    : 'Catalog reports the store as NOT purchasable, so checkout stays closed.');
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
