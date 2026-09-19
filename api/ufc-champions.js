const UFC_DISPLAY_URL = 'https://ufc.propbetedge.ai/api/rankings-display';
const RANKINGS_FALLBACK_URL = 'https://tkmlnhmylqnttmnsnief.supabase.co/storage/v1/object/public/ufc-media/rankings/latest.json';

const ASPINALL_VACANCY = {
  type: 'vacated_title',
  division: 'HEAVYWEIGHT',
  former_champion: 'Tom Aspinall',
  effective_date: '2026-09-14',
  source_urls: [
    'https://www.mmafighting.com/ufc/510226/tom-aspinall-vacates-ufc-heavyweight-title-absolute-nightmare',
    'https://www.mmafighting.com/ufc/511027/dana-white-says-ciryl-gane-wont-be-promoted-to-undisputed-champion-hes-still-got-to-fight',
  ],
  note: 'Tom Aspinall vacated the heavyweight title. Dana White subsequently said Ciryl Gane would not be automatically promoted to undisputed champion.',
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=900');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  try {
    const response = await fetch(UFC_DISPLAY_URL, { headers: { accept: 'application/json' } });
    if (response.ok) {
      const payload = await response.json();
      if (payload?.ok && Array.isArray(payload?.data?.divisions)) {
        return res.status(200).json(payload.data);
      }
    }

    // Fail safely to the raw rankings snapshot if the UFC web display route is
    // temporarily unavailable. Do not guess portrait URLs or fighter slugs.
    const fallback = await fetch(RANKINGS_FALLBACK_URL, { headers: { accept: 'application/json' } });
    if (!fallback.ok) throw new Error(`ufc_rankings_fallback_${fallback.status}`);
    const snapshot = await fallback.json();
    const divisions = (Array.isArray(snapshot?.divisions) ? snapshot.divisions : [])
      .filter((division) => !division?.is_p4p)
      .map((division) => {
        const staleAspinall = !division?.is_womens
          && division?.key === 'HEAVYWEIGHT'
          && division?.champion?.name === 'Tom Aspinall';
        const champion = staleAspinall ? null : division?.champion || null;
        return {
          key: division?.key || '',
          division: division?.label || division?.key || 'Division',
          isWomen: Boolean(division?.is_womens),
          status: champion ? 'champion' : 'vacant',
          correction: staleAspinall ? ASPINALL_VACANCY : null,
          href: 'https://ufc.propbetedge.ai/rankings',
          champion: champion ? {
            name: champion.name || 'Champion',
            fighterId: champion.fighter_id || null,
            slug: champion.ufc_slug || null,
            href: 'https://ufc.propbetedge.ai/rankings',
            image: null,
            imageSourceFamily: null,
            displayOnly: false,
            attribution: null,
          } : null,
        };
      });

    return res.status(200).json({
      sport: 'ufc',
      source: 'UFC official rankings snapshot',
      capturedAt: snapshot?.captured_at || null,
      snapshotDate: snapshot?.snapshot_date || null,
      sourceUrl: snapshot?.source_url || 'https://www.ufc.com/rankings',
      corrections: divisions.filter((d) => d.correction).map((d) => d.correction),
      divisions,
      displayState: 'fallback',
    });
  } catch (error) {
    console.error('[ufc-champions]', error?.message || error);
    res.setHeader('Retry-After', '300');
    return res.status(503).json({ error: 'UFC championship state temporarily unavailable.' });
  }
}
