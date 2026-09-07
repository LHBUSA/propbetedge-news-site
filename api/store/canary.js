/**
 * api/store/canary.js — the V1-B canary, run where the secrets actually live.
 *
 * The local script cannot see PRINTFUL_API_TOKEN because the token is a Vercel
 * environment variable and a laptop is not the Vercel runtime. This is the
 * same logic executed server-side, where it resolves.
 *
 * Protection, and why it is shaped this way:
 *
 * The endpoint is disabled unless STORE_CANARY_TOKEN is set, so it cannot
 * become a public operational surface by accident, and forgetting to
 * configure it fails closed rather than open. The caller must present that
 * token as a bearer, compared in constant time. It is an operational tool
 * with a deliberate on switch, and it should be turned off again once V1-B is
 * proven.
 *
 * It never returns or logs a secret. Store metadata, catalog ids and order
 * ids are returned because those are the point; tokens never are.
 *
 * It never confirms a Printful order. ?draft=1 creates an unconfirmed draft,
 * which Printful neither charges nor prints, and even that is opt-in.
 *
 *   GET /api/store/canary                       auth + catalog resolution only
 *   GET /api/store/canary?create=1              also create the logo tee
 *   GET /api/store/canary?create=1&draft=1      also create one draft order
 */
import { getStores, resolveStoreContext, getShippingRates, createFulfillmentOrder, isConfigured, ProviderError } from '../_lib/printful.js';
import {
  BASE_PRODUCTS, createMockupTask, createSyncProduct, findSyncProductByExternalId,
  getVariants, listCatalog, pollMockupTask, resolveBaseProduct, selectVariants, CatalogError,
} from '../_lib/printful_catalog.js';
import { bySlug } from '../../src/store/catalog.js';

/* The one product the canary creates first. Everything else waits until this
 * has proven the whole path. */
const CANARY_SLUG = 'propbetedge-logo-tee';

/* KNOWN GAP, and the most likely reason a first run fails at the create step.
 *
 * Printful accepts PNG and JPG print files. It does not accept SVG. The
 * generated assets are vector, which is right for the source of truth and
 * wrong as the thing handed to the printer, so these need rasterising to PNG
 * at roughly 150 DPI over the print area (1800x2400 for apparel) and
 * uploading before product creation can succeed.
 *
 * The URL is left pointing at the real asset rather than a placeholder so the
 * canary surfaces Printful's own rejection message, which says exactly what
 * it wants, instead of failing against something invented. */
const PRINT_FILE = process.env.STORE_PRINT_FILE_URL
  || 'https://propbetedge.ai/store/print/propbetedge-wordmark-gold.png';

const TEST_RECIPIENT = {
  name: 'PropBetEdge Canary', address1: '19749 Dearborn St', city: 'Chatsworth',
  state_code: 'CA', country_code: 'US', zip: '91311',
};

const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body, null, 2));
};

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default async function handler(req, res) {
  const gate = process.env.STORE_CANARY_TOKEN;
  if (!gate) {
    /* Not configured means off, not open. */
    return json(res, 503, { error: 'CANARY_NOT_ENABLED', message: 'Set STORE_CANARY_TOKEN to enable this endpoint, and unset it when V1-B is proven.' });
  }
  const presented = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!timingSafeEqual(presented, gate)) return json(res, 401, { error: 'unauthorized' });

  const url = new URL(req.url, 'https://placeholder.local');
  const wantCreate = url.searchParams.get('create') === '1';
  const wantDraft = url.searchParams.get('draft') === '1';

  const out = {
    ran_at: new Date().toISOString(),
    /* Presence only. The value is never read into the response. */
    env: {
      PRINTFUL_API_TOKEN: isConfigured() ? 'present' : 'MISSING',
      PRINTFUL_STORE_ID: process.env.PRINTFUL_STORE_ID ? 'present (account-level token)' : 'absent (store-scoped token)',
    },
    steps: [],
  };
  const step = (name, status, detail) => { out.steps.push({ name, status, detail }); };

  try {
    if (!isConfigured()) {
      step('auth', 'fail', 'PRINTFUL_API_TOKEN is not present in this runtime');
      return json(res, 200, { ...out, verdict: 'fail' });
    }

    /* 1. auth + store context ------------------------------------------- */
    const ctx = await resolveStoreContext();
    out.stores = ctx.stores;
    if (!ctx.ok) {
      step('auth', 'fail', ctx.ambiguous
        ? `token sees ${ctx.stores.length} stores; set PRINTFUL_STORE_ID to choose one`
        : 'PRINTFUL_STORE_ID does not match any store this token can see');
      return json(res, 200, { ...out, verdict: 'fail' });
    }
    out.store = ctx.selected;
    out.token_mode = ctx.mode;
    step('auth', 'pass', `${ctx.mode} · store ${ctx.selected.id} "${ctx.selected.name}"`);

    /* 2. live catalog resolution ----------------------------------------- */
    const catalog = await listCatalog();
    out.catalog_size = catalog.length;
    const bases = {};
    for (const key of Object.keys(BASE_PRODUCTS)) {
      try {
        const p = await resolveBaseProduct(key, catalog);
        bases[key] = { id: p.id, title: p.title, model: p.model };
        step(`base:${key}`, 'pass', `${p.title} -> catalog product ${p.id}`);
      } catch (e) {
        bases[key] = { error: e.message, detail: e.detail ?? null };
        step(`base:${key}`, 'fail', e.message);
      }
    }
    out.base_products = bases;

    if (!bases.tee?.id) {
      step('variants', 'fail', 'the tee blank did not resolve, so the canary product cannot be built');
      return json(res, 200, { ...out, verdict: 'fail' });
    }

    /* 3. variants for the sizes and colours we actually sell -------------- */
    const product = bySlug(CANARY_SLUG);
    const variants = await getVariants(bases.tee.id);
    out.tee_variant_count = variants.length;
    const { chosen, missing } = selectVariants(variants, product.sizes, product.colors);
    out.selected_variants = chosen;
    out.missing_variants = missing;
    if (!Object.keys(chosen).length) {
      step('variants', 'fail', `none of our size/colour combinations exist on catalog product ${bases.tee.id}`);
      out.available_colors = [...new Set(variants.map((v) => v.color))].slice(0, 30);
      out.available_sizes = [...new Set(variants.map((v) => v.size))].slice(0, 20);
      return json(res, 200, { ...out, verdict: 'fail' });
    }
    step('variants', missing.length ? 'partial' : 'pass',
      `${Object.keys(chosen).length} resolved${missing.length ? `, ${missing.length} unavailable: ${missing.join(', ')}` : ''}`);

    if (!wantCreate) {
      step('create', 'skip', 'pass ?create=1 to create the logo tee sync product');
      return json(res, 200, { ...out, verdict: 'pass (resolution only)' });
    }

    /* 4. sync product, idempotent on our slug ---------------------------- */
    const existing = await findSyncProductByExternalId(CANARY_SLUG);
    let syncProductId;
    if (existing) {
      syncProductId = existing.id;
      step('create', 'pass', `already exists as sync product ${existing.id}; not duplicated`);
    } else {
      const created = await createSyncProduct({
        externalId: CANARY_SLUG,
        name: product.name,
        thumbnail: PRINT_FILE,
        variants: Object.entries(chosen).map(([key, catalogVariantId]) => {
          const [size, color] = key.split(' / ');
          return { size, color, catalogVariantId, retailPrice: (product.retail_price / 100).toFixed(2), printFileUrl: PRINT_FILE };
        }),
      });
      syncProductId = created?.result?.id;
      step('create', syncProductId ? 'pass' : 'fail', syncProductId ? `sync product ${syncProductId} created` : 'no id returned');
    }
    out.sync_product_id = syncProductId ?? null;

    /* 5. mockup ----------------------------------------------------------- */
    try {
      const taskKey = await createMockupTask({
        catalogProductId: bases.tee.id,
        variantIds: Object.values(chosen).slice(0, 3),
        printFileUrl: PRINT_FILE,
      });
      const result = await pollMockupTask(taskKey);
      out.mockups = (result?.mockups || []).map((m) => ({ placement: m.placement, variantIds: m.variant_ids, url: m.mockup_url }));
      step('mockup', out.mockups.length ? 'pass' : 'fail',
        out.mockups.length ? `${out.mockups.length} generated; URLs expire, so copy them into public/store/mockups/` : 'none returned');
    } catch (e) {
      step('mockup', 'fail', `${e.name}: ${e.message}`);
    }

    /* 6. shipping --------------------------------------------------------- */
    const firstVariant = Object.values(chosen)[0];
    try {
      const rates = await getShippingRates({ recipient: TEST_RECIPIENT, items: [{ providerVariantId: firstVariant, qty: 1 }] });
      out.shipping = (rates?.result || []).map((r) => ({ id: r.id, name: r.name, rate: r.rate, currency: r.currency, minDays: r.minDeliveryDays ?? null, maxDays: r.maxDeliveryDays ?? null }));
      step('shipping', out.shipping.length ? 'pass' : 'fail', out.shipping.length ? `cheapest ${out.shipping[0].currency} ${out.shipping[0].rate}` : 'no rates');
    } catch (e) {
      step('shipping', 'fail', `${e.name}: ${e.message}`);
    }

    /* 7. draft order, never confirmed ------------------------------------- */
    if (!wantDraft) {
      step('draft order', 'skip', 'pass ?draft=1 to create one; it is never confirmed');
    } else {
      const externalId = `canary-${CANARY_SLUG}`;
      try {
        const created = await createFulfillmentOrder({
          externalId, recipient: TEST_RECIPIENT,
          items: [{ providerVariantId: firstVariant, qty: 1, name: `${CANARY_SLUG} canary` }],
          confirm: false,
        });
        out.draft_order = { id: created?.result?.id ?? null, status: created?.result?.status ?? null, external_id: externalId };
        step('draft order', 'pass', `order ${out.draft_order.id} status=${out.draft_order.status} (unconfirmed: not charged, not printed)`);

        /* Replaying the same external id must not create a second order. */
        try {
          const again = await createFulfillmentOrder({
            externalId, recipient: TEST_RECIPIENT,
            items: [{ providerVariantId: firstVariant, qty: 1, name: 'duplicate attempt' }],
            confirm: false,
          });
          const id2 = again?.result?.id ?? null;
          step('idempotency', id2 && id2 !== out.draft_order.id ? 'fail' : 'pass',
            id2 && id2 !== out.draft_order.id ? `a second order ${id2} was created` : 'provider returned the same order');
        } catch (e) {
          step('idempotency', 'pass', `provider refused the duplicate external_id (${e instanceof ProviderError ? `HTTP ${e.status}` : e.name})`);
        }
      } catch (e) {
        step('draft order', 'fail', `${e.name}: ${e.message}`);
      }
    }

    const failed = out.steps.filter((s) => s.status === 'fail').length;
    return json(res, 200, { ...out, verdict: failed ? 'fail' : 'pass' });
  } catch (e) {
    step('fatal', 'fail', `${e.name}: ${String(e.message).slice(0, 300)}`);
    if (e instanceof CatalogError && e.detail) out.detail = e.detail;
    return json(res, 200, { ...out, verdict: 'fail' });
  }
}
