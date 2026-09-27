// RETIRED 2026-09-28 (free-product boundary). This route used to hand the top-ranked published MLB HR pick (with its
// model probability) to free surfaces. The MLB free product is now the Featured Player
// (https://mlb.propbetedge.ai/api/free-featured-player), which is not an Algo pick. The route answers with an explicit,
// empty, non-Algo payload so no official or ranked selection can leave through it.
export default async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'public, s-maxage=3600');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  return res.status(200).json({
    contract: 'pbe-mlb-hr-free-sample-v1',
    sport: 'MLB',
    retired: true,
    retired_from: '2026-09-28',
    superseded_by: 'https://mlb.propbetedge.ai/api/free-featured-player',
    count: 0,
    early_bird: null,
    featured: null,
  });
}
