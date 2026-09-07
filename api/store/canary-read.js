/**
 * Temporary read-only Printful canary for the protected Vercel preview.
 *
 * This route exists so the connected Vercel session can run the Printful
 * resolution canary without requiring a second bearer secret that Vercel does
 * not expose back to tooling. It is deliberately incapable of creating sync
 * products or orders.
 *
 * It only runs on the propbetedge-store-v1 preview branch. Vercel Deployment
 * Protection remains the outer authentication layer. No secret value is ever
 * returned or logged.
 */
import { resolveStoreContext, isConfigured } from '../_lib/printful.js';
import {
  BASE_PRODUCTS,
  getVariants,
  listCatalog,
  resolveBaseProduct,
  selectVariants,
} from '../_lib/printful_catalog.js';
import { bySlug } from '../../src/store/catalog.js';

const CANARY_SLUG = 'propbetedge-logo-tee';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body, null, 2));
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('allow', 'GET');
    return json(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  }

  const isStorePreview =
    process.env.VERCEL_ENV === 'preview' &&
    process.env.VERCEL_GIT_COMMIT_REF === 'propbetedge-store-v1';

  if (!isStorePreview) {
    return json(res, 404, { error: 'NOT_FOUND' });
  }

  const out = {
    ran_at: new Date().toISOString(),
    runtime: {
      vercel_env: process.env.VERCEL_ENV || null,
      git_ref: process.env.VERCEL_GIT_COMMIT_REF || null,
    },
    env: {
      PRINTFUL_API_TOKEN: isConfigured() ? 'present' : 'MISSING',
      PRINTFUL_STORE_ID: process.env.PRINTFUL_STORE_ID
        ? 'present (account-level token)'
        : 'absent (store-scoped token)',
    },
    steps: [],
  };

  const step = (name, status, detail) => {
    out.steps.push({ name, status, detail });
  };

  try {
    if (!isConfigured()) {
      step('auth', 'fail', 'PRINTFUL_API_TOKEN is not present in this preview runtime');
      return json(res, 200, { ...out, verdict: 'fail' });
    }

    const ctx = await resolveStoreContext();
    out.stores = ctx.stores;
    if (!ctx.ok) {
      step(
        'auth',
        'fail',
        ctx.ambiguous
          ? `token sees ${ctx.stores.length} stores; PRINTFUL_STORE_ID is required to disambiguate`
          : 'PRINTFUL_STORE_ID does not match a store visible to this token',
      );
      return json(res, 200, { ...out, verdict: 'fail' });
    }

    out.store = ctx.selected;
    out.token_mode = ctx.mode;
    step('auth', 'pass', `${ctx.mode} · store ${ctx.selected.id} "${ctx.selected.name}"`);

    const catalog = await listCatalog();
    out.catalog_size = catalog.length;
    out.base_products = {};

    for (const key of Object.keys(BASE_PRODUCTS)) {
      try {
        const p = await resolveBaseProduct(key, catalog);
        out.base_products[key] = {
          id: p.id,
          title: p.title,
          model: p.model,
        };
        step(`base:${key}`, 'pass', `${p.title} -> catalog product ${p.id}`);
      } catch (error) {
        out.base_products[key] = {
          error: error.message,
          detail: error.detail ?? null,
        };
        step(`base:${key}`, 'fail', error.message);
      }
    }

    if (!out.base_products.tee?.id) {
      step('variants', 'fail', 'tee base product did not resolve; no variant selection attempted');
      return json(res, 200, { ...out, verdict: 'fail' });
    }

    const product = bySlug(CANARY_SLUG);
    const variants = await getVariants(out.base_products.tee.id);
    const { chosen, missing } = selectVariants(variants, product.sizes, product.colors);

    out.tee_variant_count = variants.length;
    out.selected_variants = chosen;
    out.missing_variants = missing;
    out.available_colors = [...new Set(variants.map((v) => v.color))].filter(Boolean);
    out.available_sizes = [...new Set(variants.map((v) => v.size))].filter(Boolean);
    out.selected_variant_details = variants
      .filter((v) => Object.values(chosen).includes(v.id))
      .map((v) => ({
        id: v.id,
        name: v.name,
        size: v.size,
        color: v.color,
        price: v.price,
        inStock: v.inStock,
        availability: v.availability,
      }));

    step(
      'variants',
      Object.keys(chosen).length ? (missing.length ? 'partial' : 'pass') : 'fail',
      `${Object.keys(chosen).length} selected; ${missing.length} missing`,
    );

    step('mutation', 'skip', 'read-only route cannot create products, mockups, shipping orders, or drafts');

    const failed = out.steps.some((s) => s.status === 'fail');
    return json(res, 200, { ...out, verdict: failed ? 'fail' : 'pass (read-only)' });
  } catch (error) {
    step('fatal', 'fail', `${error.name}: ${String(error.message).slice(0, 300)}`);
    return json(res, 200, { ...out, verdict: 'fail' });
  }
}
