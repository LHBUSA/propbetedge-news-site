/**
 * src/store/shared.js
 *
 * Browser-side access to the shared catalog UFC owns.
 *
 * The store pages are rendered from src/store/catalog.js, which is a static
 * file baked at build time. That is fine for copy and layout and useless for
 * availability: a build cannot know whether a product has been provisioned at
 * the printer since it shipped, and it certainly cannot know it changed an
 * hour ago. So price, options and availability are re-resolved at render time
 * from /api/store/catalog, which reads the authoritative records server-side.
 *
 * The local file remains the source of layout and prose. It is no longer the
 * source of what may be bought or what it costs.
 *
 * Nothing secret passes through here. The signing secret and the deployment
 * bypass live on the server; this only ever talks to our own origin.
 *
 * Fails closed. If the endpoint is unreachable, misconfigured, or reports it
 * could not read provisioning state, every product renders unavailable with a
 * stated reason rather than falling back to the build-time guess. A shop that
 * shows a working Add to Cart because a fetch failed is exactly the failure
 * this whole arrangement exists to prevent.
 */

let inflight = null;

/**
 * @returns {Promise<{state:'ok'|'unavailable', reason:string|null, byslug:Map, catalogVersion:string|null}>}
 */
export function loadShared() {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch('/api/store/catalog', { headers: { accept: 'application/json' } });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !Array.isArray(data.products)) {
        return { state: 'unavailable', reason: data?.reason || `catalog endpoint returned ${res.status}`, byslug: new Map(), catalogVersion: null };
      }
      return {
        state: 'ok',
        reason: null,
        byslug: new Map(data.products.map((p) => [p.slug, p])),
        catalogVersion: data.catalog_version ?? null,
      };
    } catch (e) {
      return { state: 'unavailable', reason: `catalog endpoint unreachable (${e.name})`, byslug: new Map(), catalogVersion: null };
    }
  })();
  return inflight;
}

/**
 * Merge a build-time product with its authoritative record.
 *
 * Copy comes from the local file; everything commercial comes from the shared
 * record, and a product the shared catalog does not list is not purchasable
 * here regardless of what the local file says.
 */
export function merge(local, shared) {
  if (!shared) {
    return {
      ...local,
      purchasable: false,
      unavailable_reason: 'Not listed in the shared catalog.',
      image_url: null,
      shared: false,
    };
  }
  return {
    ...local,
    name: shared.name || local.name,
    retail_price: typeof shared.price_cents === 'number' ? shared.price_cents : local.retail_price,
    currency: 'USD',
    sizes: Array.isArray(shared.sizes) && shared.sizes.length ? shared.sizes : local.sizes,
    colors: Array.isArray(shared.colors) && shared.colors.length ? shared.colors : local.colors,
    purchasable: shared.purchasable === true,
    unavailable_reason: shared.unavailable_reason || null,
    /* Served from our own origin, never the upstream URL: the upstream may be
     * a protected preview, and the credential that reaches it must not be in
     * anything a browser handles. */
    image_url: `/api/store/image?slug=${encodeURIComponent(local.slug)}`,
    shared: true,
  };
}

/** Whether a size/colour may be bought, per the shared record only. */
export function canBuy(merged, size, color) {
  return Boolean(merged?.purchasable) && merged.sizes.includes(size) && merged.colors.includes(color);
}
