function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export default async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const name = String(req.query?.name || '').trim();
  if (!name || name.length > 100) return res.status(400).json({ error: 'invalid_name' });

  try {
    const sampleResponse = await fetch('https://ufc.propbetedge.ai/api/ufc/free-sample', {
      headers: { accept: 'application/json' },
    }).catch(() => null);
    if (sampleResponse?.ok) {
      const sample = await sampleResponse.json().catch(() => null);
      const samplePicks = Array.isArray(sample?.picks) && sample.picks.length
        ? sample.picks
        : sample?.pick
          ? [sample.pick]
          : [];
      const pick = samplePicks.find((row) => normalize(row?.pick_name) === normalize(name)) || null;
      if (pick?.media?.image_url) {
        return res.status(200).json({
          kind: 'fighter',
          id: null,
          name: pick.pick_name,
          image_url: pick.media.image_url,
          thumb_url: pick.media.thumb_url || pick.media.image_url,
          attribution_text: pick.media.attribution_text || null,
          license: null,
          source_url: pick.media.source_url || null,
          display_policy: pick.media.display_policy || 'display_only',
          resolved_by: 'ufc_free_sample_verified_media',
        });
      }
    }

    const url = new URL('https://ufc-api.propbetedge.ai/v1/ufc/fighters');
    url.searchParams.set('q', name);
    url.searchParams.set('limit', '20');

    const response = await fetch(url, { headers: { accept: 'application/json' } });
    if (!response.ok) return res.status(404).json({ error: 'media_not_found' });
    const body = await response.json();
    const fighters = Array.isArray(body?.data) ? body.data : [];
    const q = normalize(name);
    const fighter = fighters.find((row) => normalize(row?.name) === q);
    if (!fighter) return res.status(404).json({ error: 'media_not_found' });

    const image = fighter.primary_image || null;
    const primaryUrl = image?.card_url || image?.image_url || image?.thumb_url || null;
    const espnId = /^\d+$/.test(String(fighter.slug_id || '')) ? String(fighter.slug_id) : null;
    const fallbackUrl = espnId
      ? `https://a.espncdn.com/i/headshots/mma/players/full/${espnId}.png`
      : null;
    const imageUrl = primaryUrl || fallbackUrl;

    if (!imageUrl) return res.status(404).json({ error: 'media_not_found' });

    return res.status(200).json({
      kind: 'fighter',
      id: fighter.id || null,
      name: fighter.name || name,
      image_url: imageUrl,
      thumb_url: image?.thumb_url || fallbackUrl,
      attribution_text: image?.attribution_text || (fallbackUrl ? 'Photo: ESPN' : null),
      license: image?.license || null,
      source_url: image?.source_url || (espnId ? `https://www.espn.com/mma/fighter/_/id/${espnId}` : null),
      display_policy: primaryUrl ? 'stored_asset' : 'display_only',
      resolved_by: primaryUrl ? 'exact_fighter_primary_image' : 'exact_fighter_espn_id',
    });
  } catch {
    return res.status(404).json({ error: 'media_not_found' });
  }
}
