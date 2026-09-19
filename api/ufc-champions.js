const RANKINGS_URL = 'https://tkmlnhmylqnttmnsnief.supabase.co/storage/v1/object/public/ufc-media/rankings/latest.json';
const MEDIA_BASE = 'https://tkmlnhmylqnttmnsnief.supabase.co/storage/v1/object/public/ufc-media';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=900');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  try {
    const response = await fetch(RANKINGS_URL, { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`ufc_rankings_${response.status}`);
    const snapshot = await response.json();

    const divisions = (Array.isArray(snapshot?.divisions) ? snapshot.divisions : [])
      .filter((division) => !division?.is_p4p && division?.champion)
      .map((division) => {
        const champion = division.champion || {};
        return {
          key: division.key || '',
          division: division.label || division.key || 'Division',
          isWomen: Boolean(division.is_womens),
          champion: {
            name: champion.name || 'Champion',
            fighterId: champion.fighter_id || null,
            slug: champion.ufc_slug || null,
            href: champion.ufc_slug
              ? `https://ufc.propbetedge.ai/fighters/${encodeURIComponent(champion.ufc_slug)}`
              : 'https://ufc.propbetedge.ai/rankings',
            image: champion.fighter_id
              ? `${MEDIA_BASE}/fighters/${encodeURIComponent(champion.fighter_id)}/portrait.jpg`
              : null,
          },
        };
      });

    return res.status(200).json({
      sport: 'ufc',
      source: 'UFC official rankings snapshot',
      capturedAt: snapshot?.captured_at || null,
      snapshotDate: snapshot?.snapshot_date || null,
      sourceUrl: snapshot?.source_url || 'https://www.ufc.com/rankings',
      divisions,
    });
  } catch (error) {
    console.error('[ufc-champions]', error?.message || error);
    res.setHeader('Retry-After', '300');
    return res.status(503).json({ error: 'UFC championship snapshot temporarily unavailable.' });
  }
}
