const UPSTREAM = 'https://propbetedge-ev-finder.sales-fd3.workers.dev/edges-today';
const CACHE_SECONDS = 4 * 60 * 60;
const STALE_SECONDS = 60 * 60;

function fourHourWindowEt(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  const hour = Number(get('hour')) || 0;
  const block = Math.floor(hour / 4);
  return `${get('year')}-${get('month')}-${get('day')}-${String(block).padStart(2, '0')}`;
}

function sanitizeEdge(edge) {
  if (!edge || typeof edge !== 'object') return null;
  return {
    player_name: edge.player_name || null,
    team: edge.team || null,
    opponent: edge.opponent || null,
    market: edge.market || edge.market_key || null,
    market_label: edge.market_label || null,
    line: edge.line ?? null,
    direction: edge.direction || edge.side || null,
    model_prob_pct: edge.model_prob_pct ?? null,
    book_prob_pct: edge.book_prob_pct ?? null,
    edge_pct: edge.edge_pct ?? null,
    pbe_score: edge.pbe_score ?? null,
    tier_label: edge.tier_label || null,
    best_book: edge.best_book || null,
    book_odds_str: edge.book_odds_str || null,
    best_odds: edge.best_odds ?? null,
    synthetic_market: edge.synthetic_market ?? null,
    market_status: edge.market_status || null,
  };
}

export default async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${STALE_SECONDS}`);
  res.setHeader('CDN-Cache-Control', `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${STALE_SECONDS}`);
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  try {
    const upstream = await fetch(UPSTREAM, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!upstream.ok) throw new Error(`upstream_${upstream.status}`);

    const body = await upstream.json();
    const edges = (Array.isArray(body?.edges) ? body.edges : [])
      .slice(0, 2)
      .map(sanitizeEdge)
      .filter(Boolean);

    return res.status(200).json({
      contract: 'pbe-mlb-edge-free-sample-v1',
      sport: 'MLB',
      sample_window: fourHourWindowEt(),
      refresh_seconds: CACHE_SECONDS,
      max_daily_refreshes: 6,
      generated_at: body?.generated_at || new Date().toISOString(),
      generated_at_et: body?.generated_at_et || null,
      count: edges.length,
      edges,
      full_product_url: 'https://mlb.propbetedge.ai',
      truth: 'limited_public_sample_locked_by_cdn_window',
    });
  } catch {
    return res.status(503).json({
      contract: 'pbe-mlb-edge-free-sample-v1',
      sport: 'MLB',
      sample_window: fourHourWindowEt(),
      refresh_seconds: CACHE_SECONDS,
      max_daily_refreshes: 6,
      generated_at: new Date().toISOString(),
      count: 0,
      edges: [],
      error: 'mlb_edge_sample_unavailable',
    });
  }
}
