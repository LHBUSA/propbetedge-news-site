/**
 * GET /api/store/catalog — this storefront's view of the shared catalog.
 *
 * The store pages are prerendered from src/store/catalog.js, which is fine
 * for copy and layout and useless for availability: a static build cannot
 * know whether a product has been provisioned since it was built. So the
 * pages read availability from here at runtime, and here reads it from the
 * one system that actually knows.
 *
 * The signing secret stays server-side; the browser never sees it and never
 * talks to the UFC origin directly.
 *
 * When the shared catalog cannot be reached this returns 503 with a reason
 * and, deliberately, no products. A degraded response that listed products
 * without availability would be rendered by a page as a shop, and the honest
 * answer is that we do not currently know what is for sale.
 */
import { fetchSharedCatalog, catalogConfigured, CatalogUnavailable } from '../_lib/shared_catalog.js';

const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  /* Availability changes when provisioning changes, not on a schedule the
   * CDN picks. A short shared cache keeps a burst off the upstream without
   * letting a sold-out or newly-opened state linger. */
  res.setHeader('cache-control', status === 200 ? 'public, max-age=0, s-maxage=60, stale-while-revalidate=30' : 'no-store');
  res.end(JSON.stringify(body, null, 2));
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('allow', 'GET');
    return json(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  }

  if (!catalogConfigured()) {
    return json(res, 503, {
      error: 'CATALOG_NOT_CONFIGURED',
      message: 'This deployment has no shared-catalog credential, so nothing can be offered for sale.',
      purchasing: 'disabled',
      products: [],
    });
  }

  try {
    /* Degraded is tolerated HERE and nowhere that takes money.
     *
     * A page needs to show the same products as the other storefront — same
     * names, same prices, same options, same images, resolved from the same
     * records. Whether any of them can be bought is a separate fact, and when
     * provisioning state cannot be read the answer to that is simply "no".
     * Refusing to render the shop at all conflated the two and left this site
     * showing "not listed in the shared catalog" for products that are very
     * much listed. Checkout still refuses outright. */
    const cat = await fetchSharedCatalog({ site: 'news', allowDegraded: true });
    return json(res, 200, {
      catalog_version: cat.catalog_version,
      generated_at: cat.generated_at,
      source: 'shared',
      /* Only true availability opens purchasing, and a degraded read can never
       * produce it: every product projects unavailable upstream in that case. */
      provisioning: cat.degraded ? 'unreadable' : 'ok',
      purchasing: !cat.degraded && cat.products.some((p) => p.purchasable) ? 'open' : 'disabled',
      count: cat.products.length,
      /* Passed through unchanged. The upstream already projects storefront
       * fields only; re-shaping here would create a second place where a
       * provider field could be let through by accident. */
      products: cat.products,
    });
  } catch (e) {
    const reason = e instanceof CatalogUnavailable ? e.reason : 'unexpected error reading the shared catalog';
    console.error(`[store] shared catalog unavailable: ${reason}`);
    return json(res, 503, {
      error: 'CATALOG_UNAVAILABLE',
      message: 'The shared catalog could not be reached, so purchasing is disabled.',
      reason,
      purchasing: 'disabled',
      products: [],
    });
  }
}
