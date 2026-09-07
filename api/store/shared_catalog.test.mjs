/**
 * Shared-catalog client tests.
 *
 *   node --test api/store/shared_catalog.test.mjs
 *
 * One property throughout: every way of not knowing ends with purchasing
 * disabled. There is no path where an unreachable, misconfigured or
 * malformed catalog produces something a page could render as for sale.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { CatalogUnavailable, __resetCatalogCache, catalogConfigured, fetchSharedCatalog, optionAvailable, resolveProduct } from '../_lib/shared_catalog.js';

const realFetch = globalThis.fetch;
const SECRET = 'test-secret';

function stub(handler) {
  globalThis.fetch = handler;
}
function restore() {
  globalThis.fetch = realFetch;
  delete process.env.CATALOG_SHARED_SECRET;
  __resetCatalogCache();
}

const ok = (body) => async () => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

const CATALOG = {
  catalog_version: '2026-09-07.1',
  generated_at: '2026-09-07T12:00:00Z',
  provisioning_source: 'ok',
  products: [
    { slug: 'propbetedge-logo-tee', name: 'Logo Tee', price_cents: 3200, sizes: ['S', 'M'], colors: ['Black'], purchasable: true, unavailable_reason: null },
    { slug: 'propbetedge-mug', name: 'Mug', price_cents: 1900, sizes: ['11oz'], colors: ['White'], purchasable: false, unavailable_reason: 'Being confirmed with the printer.' },
  ],
};

test('a missing secret disables purchasing rather than failing open', async (t) => {
  t.after(restore);
  __resetCatalogCache();
  delete process.env.CATALOG_SHARED_SECRET;
  assert.equal(catalogConfigured(), false);
  await assert.rejects(() => fetchSharedCatalog(), CatalogUnavailable);
});

test('the request is signed, and the secret never appears in it', async (t) => {
  t.after(restore);
  __resetCatalogCache();
  process.env.CATALOG_SHARED_SECRET = SECRET;
  let seen = null;
  stub(async (url, init) => {
    seen = { url: String(url), headers: init.headers };
    return new Response(JSON.stringify(CATALOG), { status: 200 });
  });

  await fetchSharedCatalog({ force: true });
  assert.match(seen.url, /\/api\/catalog\/products\?site=news$/);
  assert.match(seen.headers['x-pbe-signature'], /^sha256=[0-9a-f]{64}$/);
  assert.ok(Number(seen.headers['x-pbe-timestamp']) > 0);
  /* The signature is derived from the secret; the secret itself must not be
   * anywhere in the request. */
  assert.ok(!JSON.stringify(seen).includes(SECRET));
});

test('an unreachable catalog throws rather than returning an empty shop', async (t) => {
  t.after(restore);
  __resetCatalogCache();
  process.env.CATALOG_SHARED_SECRET = SECRET;

  for (const failure of [
    async () => { throw Object.assign(new Error('timed out'), { name: 'TimeoutError' }); },
    async () => new Response('nope', { status: 502 }),
    async () => new Response('not json', { status: 200 }),
    ok({ products: 'not an array' }),
  ]) {
    __resetCatalogCache();
    stub(failure);
    await assert.rejects(() => fetchSharedCatalog({ force: true }), CatalogUnavailable);
  }
});

test('a catalog that could not read provisioning state is treated as unavailable', async (t) => {
  t.after(restore);
  __resetCatalogCache();
  process.env.CATALOG_SHARED_SECRET = SECRET;
  /* "Nothing is available" and "we could not find out" are different answers,
   * and the second must not be rendered as the first. */
  stub(ok({ ...CATALOG, provisioning_source: 'unreachable', products: [] }));
  await assert.rejects(() => fetchSharedCatalog({ force: true }), CatalogUnavailable);
});

test('a slug known locally but absent upstream is refused, not sold', async (t) => {
  t.after(restore);
  __resetCatalogCache();
  process.env.CATALOG_SHARED_SECRET = SECRET;
  stub(ok(CATALOG));
  /* This slug exists in src/store/catalog.js on this site. Matching local
   * slugs is exactly what must not be sufficient. */
  await assert.rejects(() => resolveProduct('trust-the-data-tee'), CatalogUnavailable);
  assert.equal((await resolveProduct('propbetedge-logo-tee')).name, 'Logo Tee');
});

test('availability comes from the shared record and the options it lists', async (t) => {
  t.after(restore);
  __resetCatalogCache();
  process.env.CATALOG_SHARED_SECRET = SECRET;
  stub(ok(CATALOG));
  const cat = await fetchSharedCatalog({ force: true });
  const tee = cat.byslug.get('propbetedge-logo-tee');
  const mug = cat.byslug.get('propbetedge-mug');

  assert.equal(optionAvailable(tee, 'M', 'Black'), true);
  /* A size the upstream no longer offers cannot be bought from a page this
   * site has not rebuilt. */
  assert.equal(optionAvailable(tee, '3XL', 'Black'), false);
  assert.equal(optionAvailable(tee, 'M', 'Purple'), false);
  /* Unconfirmed upstream: not for sale here either. */
  assert.equal(optionAvailable(mug, '11oz', 'White'), false);
  assert.equal(optionAvailable(null, 'M', 'Black'), false);
});
