const SUPABASE_URL = 'https://rlfyavnhbngwbldebrid.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsZnlhdm5oYm5nd2JsZGVicmlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNTE5MTAsImV4cCI6MjA4MDcyNzkxMH0.bHhCD0qEV34kZkNy0JJhEYfXc8yGkjxMF4Lyi9Jg4yM';

function todayEt() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalize(row) {
  if (!row) return null;
  const playerId = /^\d+$/.test(String(row.mlb_player_id || '')) ? String(row.mlb_player_id) : null;
  return {
    id: row.id || null,
    game_date: row.game_date || null,
    player_name: row.player_name || null,
    mlb_player_id: playerId,
    player_image: playerId
      ? `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_600,q_auto:best/v1/people/${playerId}/headshot/67/current`
      : null,
    team: row.team || null,
    opponent: row.opponent || null,
    tag: row.tag || null,
    phase: row.phase || null,
    is_convergence: row.is_convergence === true,
    hr_probability: numberOrNull(row.hr_prob_today),
    model_score: numberOrNull(row.score),
    batting_order: numberOrNull(row.batting_order),
    recommendation: row.recommendation || null,
    // Deliberately no published snapshot odds here. The MLB product itself
    // stopped presenting stale publication-time prices as live market odds.
    market_pricing: 'pending_live_market',
  };
}

function rank(rows) {
  return [...rows].sort((a, b) => {
    const convergence = Number(Boolean(b.is_convergence)) - Number(Boolean(a.is_convergence));
    if (convergence) return convergence;
    const prob = (Number(b.hr_prob_today) || 0) - (Number(a.hr_prob_today) || 0);
    if (prob) return prob;
    return (Number(b.score) || 0) - (Number(a.score) || 0);
  });
}

export default async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=900');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const date = todayEt();
  const query = new URL('/rest/v1/picks', SUPABASE_URL);
  query.searchParams.set('game_date', `eq.${date}`);
  query.searchParams.set('status', 'eq.published');
  query.searchParams.set('prop_type', 'eq.hr');
  query.searchParams.set('is_scratched', 'eq.false');
  query.searchParams.set('phase', 'not.in.(replaced,scratched)');
  query.searchParams.set('select', [
    'id','game_date','player_name','mlb_player_id','team','opponent','tag',
    'score','hr_prob_today','phase','is_convergence','batting_order','recommendation'
  ].join(','));
  query.searchParams.set('order', 'score.desc');
  query.searchParams.set('limit', '100');

  try {
    const upstream = await fetch(query, {
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
        Accept: 'application/json',
      },
    });
    if (!upstream.ok) throw new Error('upstream_unavailable');
    const rows = await upstream.json();
    const active = rank((Array.isArray(rows) ? rows : []).filter((row) => row?.player_name));
    const early = rank(active.filter((row) => String(row.phase || '').toLowerCase() === 'early_bird'));

    return res.status(200).json({
      contract: 'pbe-mlb-hr-free-sample-v1',
      sport: 'MLB',
      generated_at: new Date().toISOString(),
      game_date: date,
      count: active.length,
      early_bird: normalize(early[0] || null),
      featured: normalize(active[0] || null),
      full_product_url: 'https://mlb.propbetedge.ai/picks',
      truth: 'published_hr_model_target_no_snapshot_odds',
    });
  } catch {
    return res.status(503).json({
      contract: 'pbe-mlb-hr-free-sample-v1',
      sport: 'MLB',
      generated_at: new Date().toISOString(),
      game_date: date,
      count: 0,
      early_bird: null,
      featured: null,
      error: 'hr_source_unavailable',
    });
  }
}
