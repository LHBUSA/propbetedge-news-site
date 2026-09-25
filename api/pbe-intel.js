/**
 * Read-only, fixed-source adapter for PBE model reads the newsroom may show.
 * Not an open proxy: one sport, one kind, one documented upstream route.
 *
 *   sport=nba&kind=winba&id=<ESPN athlete id>
 *     → nba-intel GET /v1/players/:espnAthleteId (docs/intel/INTEL_API.md,
 *       nba-intel-player/1.x). Only the public WinBA block is returned.
 *
 * Load Score numbers are Pro-gated in the NBA product, so they are never read
 * here. nba-intel's CORS allowlist does not include propbetedge.ai, which is
 * why this read runs server-side.
 */
const NBA_INTEL = 'https://nba-intel.sales-fd3.workers.dev';

export function resource(query) {
  if (Object.values(query || {}).some((v) => Array.isArray(v) || (v !== null && typeof v === 'object'))) throw new Error('Invalid query');
  const sport = String(query?.sport || '').toLowerCase();
  const kind = String(query?.kind || '').toLowerCase();
  const id = String(query?.id || '');
  if (sport !== 'nba' || kind !== 'winba') throw new Error('Unsupported intel resource');
  if (!/^\d{1,12}$/.test(id)) throw new Error('Invalid player id');
  return `${NBA_INTEL}/v1/players/${id}`;
}

export function pickWinba(body) {
  const w = body?.winba;
  if (!w || typeof w !== 'object') return null;
  const score = Number(w.score);
  if (!Number.isFinite(score)) return null;
  return {
    score,
    status: w.status ?? null,
    rank: w.rank ?? null,
    season: w.season ?? null,
    sample: w.sample ? { games: w.sample.games ?? null } : null,
    version: w.version ?? null,
  };
}

export default async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ ok: false, error: 'method_not_allowed' }); }
  let url;
  try { url = resource(req.query || {}); }
  catch (e) { res.setHeader('Cache-Control', 'no-store'); return res.status(400).json({ ok: false, error: e.message }); }

  try {
    const upstream = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(6000), redirect: 'error' });
    if (!upstream.ok) {
      res.setHeader('Cache-Control', 'public, s-maxage=120');
      return res.status(upstream.status === 404 ? 404 : 503).json({ ok: false, error: upstream.status === 404 ? 'source_not_found' : 'source_unavailable' });
    }
    const body = await upstream.json();
    if (body?.state === 'UNAVAILABLE') {
      res.setHeader('Cache-Control', 'public, s-maxage=300');
      return res.status(404).json({ ok: false, error: 'not_ingested' });
    }
    const winba = pickWinba(body);
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=900, stale-while-revalidate=3600');
    return res.status(200).json({
      ok: Boolean(winba),
      contract: 'pbe-intel/v1',
      sport: 'nba',
      kind: 'winba',
      player_id: String(req.query.id),
      source_schema: body?.schema || null,
      source_version: body?.version || null,
      as_of: body?.as_of || null,
      winba,
    });
  } catch (_) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).json({ ok: false, error: 'source_unavailable' });
  }
}
