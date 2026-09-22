const DEFAULT_HUB = 'https://pbe-entity-hub.sales-fd3.workers.dev';
const ALLOWED_SPORTS = new Set(['mlb', 'nfl', 'nba', 'nhl', 'wnba']);
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const sport = String(req.query?.sport || '').toLowerCase();
  const slug = String(req.query?.slug || '').toLowerCase();

  if (!ALLOWED_SPORTS.has(sport) || !SLUG.test(slug) || slug.length > 96) {
    return res.status(400).json({ ok: false, error: 'invalid_team_request' });
  }

  const hub = String(process.env.PBE_ENTITY_HUB_URL || DEFAULT_HUB).replace(/\/+$/, '');
  const url = `${hub}/v1/snapshot/team/${encodeURIComponent(sport)}/${encodeURIComponent(slug)}`;

  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  try {
    const upstream = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });

    const payload = await upstream.json().catch(() => null);

    if (upstream.status === 404) {
      return res.status(404).json({ ok: false, error: 'team_snapshot_not_found', sport, slug });
    }

    if (!upstream.ok || !payload?.ok || !payload?.snapshot) {
      console.error('[team-intelligence] hub read failed', {
        sport,
        slug,
        status: upstream.status,
        error: payload?.error || null,
      });
      res.setHeader('Retry-After', '60');
      return res.status(502).json({ ok: false, error: 'team_snapshot_unavailable' });
    }

    return res.status(200).json({
      ok: true,
      sport,
      slug,
      freshness_state: payload.freshness_state || null,
      completeness: payload.completeness || null,
      readiness: payload.readiness || null,
      observed_at: payload.observed_at || payload.snapshot?.source?.observed_at || null,
      source_product: payload.source_product || payload.snapshot?.source?.product || null,
      snapshot: payload.snapshot,
    });
  } catch (error) {
    console.error('[team-intelligence] request failed', {
      sport,
      slug,
      error: error?.message || String(error),
    });
    res.setHeader('Retry-After', '60');
    return res.status(503).json({ ok: false, error: 'team_snapshot_unavailable' });
  }
}
