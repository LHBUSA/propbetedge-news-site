/** Read-only, fixed-source adapter for the hub's player pages. Not an open proxy. */
const LEAGUES = { nfl: 'football/nfl', nba: 'basketball/nba', wnba: 'basketball/wnba' };
export function resource(query, now = new Date()) {
  if (Object.values(query).some(v => Array.isArray(v) || (v !== null && typeof v === 'object'))) throw new Error('Invalid query');
  const sport = String(query.sport || '').toLowerCase(), id = String(query.id || ''), kind = String(query.kind || 'bio');
  if (!/^\d{1,12}$/.test(id)) throw new Error('Invalid player id');
  const year = query.season == null ? null : String(query.season), type = String(query.type || '2');
  if (!['1', '2', '3'].includes(type)) throw new Error('Invalid season type');
  const max = now.getUTCFullYear() + 1;
  if (year && (sport === 'nhl'
    ? !/^\d{8}$/.test(year) || Number(year.slice(4)) !== Number(year.slice(0, 4)) + 1 || Number(year.slice(0, 4)) < 1917 || Number(year.slice(0, 4)) > max
    : !/^\d{4}$/.test(year) || Number(year) < 1876 || Number(year) > max)) throw new Error('Invalid season');
  if (sport === 'nfl' && kind === 'career') return `https://nfl.propbetedge.ai/api/player-career?espn_id=${id}`;
  if (LEAGUES[sport] && ['bio', 'stats', 'gamelog'].includes(kind)) {
    const qs = new URLSearchParams({ region: 'us', lang: 'en', contentorigin: 'espn', seasontype: type });
    if (year) qs.set('season', year);
    return `https://site.web.api.espn.com/apis/common/v3/sports/${LEAGUES[sport]}/athletes/${id}${kind === 'bio' ? '' : '/' + kind}?${qs}`;
  }
  if (sport === 'nhl') {
    if (kind === 'bio') return `https://api-web.nhle.com/v1/player/${id}/landing`;
    if (kind === 'gamelog' && year) return `https://api-web.nhle.com/v1/player/${id}/game-log/${year}/${type}`;
  }
  throw new Error('Unsupported player resource');
}
export default async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ ok: false, error: 'method_not_allowed' }); }
  let url;
  try { url = resource(req.query || {}); }
  catch (e) { return res.status(400).json({ ok: false, error: e.message }); }
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const response = await fetch(url, { headers: { accept: 'application/json' }, signal: ctrl.signal, redirect: 'error' });
    if (!response.ok) {
      res.setHeader('Retry-After', '60');
      return res.status(response.status === 404 ? 404 : 503).json({ ok: false, error: response.status === 404 ? 'source_not_found' : 'source_unavailable', upstream_status: response.status });
    }
    const data = await response.json();
    if (!data || typeof data !== 'object' || data.ok === false) throw new Error('invalid_source_payload');
    const live = req.query.kind === 'career' && data.live != null;
    res.setHeader('Cache-Control', live ? 'no-store' : 'public, s-maxage=120, stale-while-revalidate=60');
    return res.status(200).json({ ok: true, contract: 'hub-player-data/v1', sport: req.query.sport, player_id: String(req.query.id), kind: req.query.kind || 'bio', fetched_at: new Date().toISOString(), data });
  } catch (_) {
    res.setHeader('Retry-After', '60');
    return res.status(503).json({ ok: false, error: 'source_unavailable' });
  } finally { clearTimeout(timer); }
}
