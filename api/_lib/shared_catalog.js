/**
 * api/_lib/shared_catalog.js
 *
 * Client for the shared catalog. UFC owns the products and the provisioning
 * state; this site reads them.
 *
 * Why this exists rather than two local catalogues that happen to agree.
 * Matching slugs in two repositories is a convention, and a convention drifts
 * the first time somebody edits one file. Worse, a slug matching locally says
 * nothing about whether the product has actually been provisioned at the
 * printer — that fact lives in exactly one database, and this is how a second
 * storefront reads it. Both sites therefore resolve products from the same
 * authoritative records, and neither can decide on its own that something is
 * for sale.
 *
 * Requests are signed rather than bearing a token, because what needs
 * authenticating is a request and not a session: the signature covers the
 * timestamp, the method and the path, so it is worthless against a different
 * endpoint and expires on its own. The secret never leaves the server.
 *
 * The UFC preview sits behind Vercel Deployment Protection, so a
 * server-to-server call from this preview needs an authorised bypass. That is
 * CATALOG_BYPASS_TOKEN, sent as a request header from the server and nowhere
 * else: never in a URL, never in anything a browser receives, never in an
 * image src. It gets past the platform's door; it does not replace the
 * signature, which is what actually authenticates the request. Both are
 * required, and removing the bypass would only make the call fail at the edge
 * rather than make it safe.
 *
 * Everything here fails CLOSED. Unreachable catalog, malformed response,
 * missing secret, a product the shared catalog does not list — every one of
 * those ends with purchasing disabled and an honest reason, never with a
 * cached optimistic guess. The one thing a store must never do is take money
 * for something it cannot confirm exists.
 */

const DEFAULT_ORIGIN = 'https://ufc.propbetedge.ai';
const PATH = '/api/catalog/products';
const TIMEOUT_MS = 8000;

/* A short in-process cache. Serverless instances are short-lived, so this is
 * worth little on a cold start and a lot under a burst — and it deliberately
 * does not persist a stale "available" across a deploy. */
const TTL_MS = 60_000;
let cache = { at: 0, value: null };

export class CatalogUnavailable extends Error {
  constructor(reason) {
    super(reason);
    this.name = 'CatalogUnavailable';
    this.reason = reason;
  }
}

export function catalogConfigured() {
  return Boolean(process.env.CATALOG_SHARED_SECRET);
}

function origin() {
  return String(process.env.CATALOG_ORIGIN || DEFAULT_ORIGIN).replace(/\/$/, '');
}

/**
 * Add the deployment-protection bypass, if one is configured.
 *
 * Header only. Vercel also accepts the bypass as a query parameter, which is
 * convenient and wrong for us: a URL ends up in logs, in referrers and in
 * anything that caches, and this value would then be a standing key to every
 * protected preview in the project.
 */
export function bypassHeaders(headers = {}) {
  const token = process.env.CATALOG_BYPASS_TOKEN;
  if (token) headers['x-vercel-protection-bypass'] = token;
  return headers;
}

/** The configured upstream origin, for callers that proxy a sub-resource. */
export function catalogOrigin() {
  return origin();
}

async function hmacHex(secret, payload) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Fetch the shared catalog for this storefront.
 *
 * Throws CatalogUnavailable rather than returning a partial result, so a
 * caller cannot accidentally treat "we could not ask" as "nothing is for
 * sale but the shop is fine".
 */
export async function fetchSharedCatalog({ site = 'news', force = false, allowDegraded = false } = {}) {
  if (!force && !allowDegraded && cache.value && Date.now() - cache.at < TTL_MS) return cache.value;

  const secret = process.env.CATALOG_SHARED_SECRET;
  if (!secret) throw new CatalogUnavailable('CATALOG_SHARED_SECRET is not configured on this deployment');

  const pathWithQuery = `${PATH}?site=${encodeURIComponent(site)}`;
  const ts = String(Date.now());
  const signature = await hmacHex(secret, `${ts}.GET.${pathWithQuery}`);

  let res;
  try {
    res = await fetch(`${origin()}${pathWithQuery}`, {
      headers: bypassHeaders({
        'x-pbe-timestamp': ts,
        'x-pbe-signature': `sha256=${signature}`,
        accept: 'application/json',
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    throw new CatalogUnavailable(`shared catalog unreachable (${e.name})`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new CatalogUnavailable(`shared catalog returned HTTP ${res.status}${body ? `: ${body.slice(0, 160)}` : ''}`);
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new CatalogUnavailable('shared catalog returned an unparseable body');
  }
  if (!data || !Array.isArray(data.products)) {
    throw new CatalogUnavailable('shared catalog returned no product list');
  }

  /* The upstream tells us whether it could read provisioning state at all.
   * "Nothing is available" and "we could not find out what is available" are
   * different answers and the second one must not masquerade as the first. */
  const degraded = Boolean(data.provisioning_source) && data.provisioning_source !== 'ok';
  /* allowDegraded exists for exactly one caller: the image proxy. A product
   * preview does not depend on provisioning state, so refusing to serve a
   * picture because availability could not be read is a worse answer than
   * showing the picture beside "not for sale". Everything that touches money
   * leaves this false and still fails closed. */
  if (degraded && !allowDegraded) {
    throw new CatalogUnavailable(`shared catalog could not read provisioning state (${data.provisioning_source})`);
  }

  const value = {
    catalog_version: data.catalog_version ?? null,
    generated_at: data.generated_at ?? null,
    degraded,
    products: data.products,
    byslug: new Map(data.products.map((p) => [p.slug, p])),
  };
  /* A degraded read is never cached as if it were a good one. */
  if (!degraded) cache = { at: Date.now(), value };
  return value;
}

/**
 * Resolve one product from the authoritative records.
 *
 * A slug this site knows locally but the shared catalog does not list is not
 * a product — it is a stale local file, and it is refused rather than sold.
 */
export async function resolveProduct(slug, { site = 'news' } = {}) {
  const cat = await fetchSharedCatalog({ site });
  const p = cat.byslug.get(String(slug));
  if (!p) throw new CatalogUnavailable(`"${slug}" is not in the shared catalog`);
  return p;
}

/**
 * Whether a specific size and colour of a product may be sold right now.
 *
 * Availability comes from the shared record only. The option must also be one
 * the authoritative catalog actually offers, so a request naming a size we
 * removed upstream cannot be honoured by a page this site has not rebuilt.
 */
export function optionAvailable(product, size, color) {
  if (!product || product.purchasable !== true) return false;
  return (product.sizes || []).includes(size) && (product.colors || []).includes(color);
}

/** Test seam. Never called in production paths. */
export function __resetCatalogCache() {
  cache = { at: 0, value: null };
}
