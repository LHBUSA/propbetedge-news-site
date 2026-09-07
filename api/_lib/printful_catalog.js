/**
 * api/_lib/printful_catalog.js
 *
 * Catalog resolution and Sync Product creation.
 *
 * Nothing here hardcodes a Printful catalog id. Variant ids change, differ by
 * region and are easy to transcribe wrongly, and a wrong variant id does not
 * fail loudly: it prints the wrong garment. So every id is resolved live from
 * the API and reported back, and a base product that cannot be resolved
 * unambiguously is a failure rather than a best guess.
 */

const API = 'https://api.printful.com';

export class CatalogError extends Error {
  constructor(msg, detail) { super(msg); this.name = 'CatalogError'; this.detail = detail; }
}

function headers() {
  const token = process.env.PRINTFUL_API_TOKEN;
  if (!token) throw new Error('PROVIDER_NOT_CONFIGURED');
  const h = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  /* Store-scoped tokens need no store id; only account-level tokens do. */
  if (process.env.PRINTFUL_STORE_ID) h['x-pf-store-id'] = String(process.env.PRINTFUL_STORE_ID);
  return h;
}

async function call(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method, headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(25000),
  });
  const text = await res.text();
  if (!res.ok) throw new CatalogError(`Printful ${res.status} on ${path}`, text.slice(0, 300));
  try { return JSON.parse(text); } catch { throw new CatalogError(`unparseable response from ${path}`, text.slice(0, 200)); }
}

/* The base products V1 uses, described by what they are rather than by id.
 * `match` must identify exactly one catalog product; `prefer` breaks a tie
 * only when several genuinely describe the same blank. */
export const BASE_PRODUCTS = {
  tee: { label: 'Unisex premium tee', match: /bella\s*\+?\s*canvas\s*3001|unisex staple t-shirt/i, prefer: /3001/ },
  hoodie: { label: 'Unisex heavy blend hoodie', match: /gildan\s*18500|unisex heavy blend hooded/i, prefer: /18500/ },
  cap: { label: 'Embroidered cap', match: /embroidered .*(dad|cap)|classic dad hat/i, prefer: /dad/i },
  mug: { label: 'White glossy mug 11oz', match: /white glossy mug/i, prefer: /11/ },
};

export async function listCatalog() {
  const r = await call('/products');
  return (r?.result || []).map((p) => ({ id: p.id, type: p.type, brand: p.brand, model: p.model, title: `${p.brand || ''} ${p.model || ''}`.trim() }));
}

/** Resolve one base product to a single catalog id, or fail with the candidates. */
export async function resolveBaseProduct(key, catalog) {
  const spec = BASE_PRODUCTS[key];
  if (!spec) throw new CatalogError(`unknown base product ${key}`);
  const hits = catalog.filter((p) => spec.match.test(p.title) || spec.match.test(p.model || ''));
  if (!hits.length) throw new CatalogError(`no catalog product matches ${spec.label}`, { key });
  if (hits.length === 1) return hits[0];
  const preferred = hits.filter((p) => spec.prefer.test(p.title) || spec.prefer.test(p.model || ''));
  if (preferred.length === 1) return preferred[0];
  /* Several blanks match and none is clearly the one. Guessing here would
   * silently choose a different garment, so it fails and lists the options. */
  throw new CatalogError(`ambiguous base product for ${spec.label}`, { candidates: hits.slice(0, 8) });
}

/** Catalog variants for a product, with colour and size parsed out. */
export async function getVariants(catalogProductId) {
  const r = await call(`/products/${catalogProductId}`);
  return (r?.result?.variants || []).map((v) => ({
    id: v.id, name: v.name, size: v.size, color: v.color,
    price: v.price, inStock: v.in_stock !== false, availability: v.availability_status ?? null,
  }));
}

/** Pick the variant ids for the exact size and colour set we sell. */
export function selectVariants(variants, sizes, colors) {
  const chosen = {};
  const missing = [];
  for (const color of colors) {
    for (const size of sizes) {
      const hit = variants.find((v) =>
        String(v.color || '').toLowerCase() === color.toLowerCase() &&
        String(v.size || '').toLowerCase() === size.toLowerCase());
      if (hit) chosen[`${size} / ${color}`] = hit.id;
      else missing.push(`${size} / ${color}`);
    }
  }
  return { chosen, missing };
}

/* ---- sync products ------------------------------------------------------ */

/** Existing sync product for our slug, or null. Idempotency starts here. */
export async function findSyncProductByExternalId(externalId) {
  const r = await call('/store/products?limit=100');
  const hit = (r?.result || []).find((p) => String(p.external_id) === String(externalId));
  return hit || null;
}

/**
 * Create a Sync Product. external_id is our catalog slug, which is what makes
 * a re-run safe: the caller checks for it first and Printful rejects a second
 * product carrying the same one.
 */
export async function createSyncProduct({ externalId, name, thumbnail, variants }) {
  if (!variants?.length) throw new CatalogError('createSyncProduct requires variants');
  return call('/store/products', {
    method: 'POST',
    body: {
      sync_product: { name, external_id: externalId, thumbnail },
      sync_variants: variants.map((v) => ({
        external_id: `${externalId}:${v.size}:${v.color}`.toLowerCase().replace(/\s+/g, ''),
        variant_id: v.catalogVariantId,
        retail_price: v.retailPrice,
        files: [{ type: 'front', url: v.printFileUrl }],
      })),
    },
  });
}

/* ---- mockups ------------------------------------------------------------
 * The generator is a task queue: create, then poll. Printful's own mockup
 * URLs expire, so the caller is expected to copy the image into our storage
 * rather than storing the link. */
export async function createMockupTask({ catalogProductId, variantIds, printFileUrl }) {
  const r = await call(`/mockup-generator/create-task/${catalogProductId}`, {
    method: 'POST',
    body: { variant_ids: variantIds, format: 'png', files: [{ placement: 'front', image_url: printFileUrl, position: { area_width: 1800, area_height: 2400, width: 1800, height: 2400, top: 0, left: 0 } }] },
  });
  return r?.result?.task_key || null;
}

export async function pollMockupTask(taskKey, { attempts = 12, delayMs = 2500 } = {}) {
  for (let i = 0; i < attempts; i += 1) {
    const r = await call(`/mockup-generator/task?task_key=${encodeURIComponent(taskKey)}`);
    const status = r?.result?.status;
    if (status === 'completed') return r.result;
    if (status === 'failed') throw new CatalogError('mockup task failed', r?.result?.error || null);
    await new Promise((res) => setTimeout(res, delayMs));
  }
  throw new CatalogError('mockup task did not complete in time', { taskKey });
}
