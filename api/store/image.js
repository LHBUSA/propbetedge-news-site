/**
 * GET /api/store/image?slug=<slug> — serve a shared product image from this origin.
 *
 * Why a proxy rather than linking straight at the UFC origin.
 *
 * The shared catalog returns absolute image URLs on the UFC deployment. On
 * production that is a public host and a direct <img src> would be fine. On a
 * preview it is not: the UFC preview sits behind Vercel Deployment Protection,
 * so a visitor's browser fetching that URL gets an SSO redirect and a broken
 * image. The bypass that makes the server-to-server call work must never be
 * the fix for that — putting it in an image URL publishes it to every
 * referrer, proxy log and cache between here and the reader, and it is a
 * standing key to every protected preview in the project.
 *
 * So the bytes come through this function: the server fetches with the bypass
 * as a header, and the browser only ever sees a URL on this site. The
 * credential stays on one side of the boundary, which is the entire point.
 *
 * This is not an open proxy. The slug must appear in the shared catalog, and
 * the URL fetched is the one the catalog itself returned for that slug — not
 * anything a caller supplies — so there is no parameter here that can be
 * pointed at a third host.
 *
 * What it serves is a DESIGN PREVIEW, not a photograph of a garment. It shows
 * a shape and a placement; it does not establish how a printed item looks, and
 * it is not evidence that the printer has accepted the artwork.
 */
import { bypassHeaders, catalogOrigin, fetchSharedCatalog, CatalogUnavailable } from '../_lib/shared_catalog.js';

const TIMEOUT_MS = 8000;

const fail = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('allow', 'GET');
    return fail(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  }

  const url = new URL(req.url, 'https://placeholder.local');
  const slug = String(url.searchParams.get('slug') || '');
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return fail(res, 400, { error: 'bad_slug' });

  let product;
  try {
    const cat = await fetchSharedCatalog({ site: 'news' });
    product = cat.byslug.get(slug);
  } catch (e) {
    const reason = e instanceof CatalogUnavailable ? e.reason : 'unexpected error';
    return fail(res, 503, { error: 'CATALOG_UNAVAILABLE', reason });
  }
  if (!product?.images?.length) return fail(res, 404, { error: 'no_image_for_slug', slug });

  /* The URL comes from the catalog, and must belong to the origin we are
   * configured to talk to. A catalog that started returning links to a third
   * host would otherwise turn this into an open redirect with a credential
   * attached. */
  const target = String(product.images[0].url);
  const allowed = catalogOrigin();
  if (!target.startsWith(`${allowed}/`)) return fail(res, 502, { error: 'image_origin_mismatch' });

  let upstream;
  try {
    upstream = await fetch(target, { headers: bypassHeaders({ accept: 'image/*' }), signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (e) {
    return fail(res, 504, { error: 'image_unreachable', detail: e.name });
  }
  if (!upstream.ok) return fail(res, 502, { error: 'image_upstream_status', status: upstream.status });

  const type = upstream.headers.get('content-type') || '';
  /* Only images. If the upstream ever answered with an SSO page instead of a
   * file, serving it through here would be worse than failing. */
  if (!/^image\//.test(type)) return fail(res, 502, { error: 'image_upstream_not_an_image', got: type.slice(0, 60) });

  const buf = Buffer.from(await upstream.arrayBuffer());
  res.statusCode = 200;
  res.setHeader('content-type', type);
  res.setHeader('content-length', String(buf.length));
  /* Versioned filenames upstream, so these bytes never change for a given
   * slug-and-version and can be cached hard. */
  res.setHeader('cache-control', 'public, max-age=300, s-maxage=86400, stale-while-revalidate=86400');
  res.setHeader('x-image-kind', 'design-preview');
  res.end(buf);
}
