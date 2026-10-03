// Network source-brand standard (DATA · PropSports): customer surfaces, serverless api/ and middleware carry no
// upstream branding; public team snapshots keep freshness but not upstream lane labels or endpoint URLs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { scan } from '../scripts/guard-source-brand.mjs';

test('source-brand guard: index.html, src, api and middleware are clean', () => {
  assert.deepEqual(scan(), []);
});

test('team-intelligence: public snapshot drops upstream source label and URLs', async () => {
  const { default: handler } = await import('../api/team-intelligence.js');
  const hub = { ok: true, freshness_state: 'CURRENT', snapshot: { kind: 'team', sport: 'mlb', slug: 'x', record: { summary: '1-0' }, source: { product: 'statsapi.mlb.com', source: 'MLB StatsAPI', source_urls: ['https://statsapi.mlb.com/api/v1/x'], observed_at: '2026-10-03T00:00:00Z', ttl_s: 900 } } };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify(hub), { status: 200 });
  let body = null;
  const res = { setHeader() {}, status() { return this; }, json(b) { body = b; return this; } };
  try { await handler({ method: 'GET', query: { sport: 'mlb', slug: 'x' } }, res); } finally { globalThis.fetch = realFetch; }
  assert.equal(body.ok, true);
  assert.equal(body.source_product, 'PropSports');
  assert.equal(body.snapshot.source.product, 'PropSports');
  assert.equal(body.snapshot.source.observed_at, '2026-10-03T00:00:00Z');
  assert.doesNotMatch(JSON.stringify(body), /statsapi|StatsAPI/);
});
