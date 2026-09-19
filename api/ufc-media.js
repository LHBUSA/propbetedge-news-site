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
    const url = new URL('https://ufc-api.propbetedge.ai/v1/ufc/fighters');
    url.searchParams.set('q', name);
    url.searchParams.set('limit', '20');

    const response = await fetch(url, { headers: { accept: 'application/json' } });
    if (!response.ok) return res.status(404).json({ error: 'media_not_found' });
    const body = await response.json();
    const fighters = Array.isArray(body?.data) ? body.data : [];
    const q = normalize(name);
    const fighter = fighters.find((row) => normalize(row?.name) === q && row?.primary_image?.image_url);
    if (!fighter) return res.status(404).json({ error: 'media_not_found' });

    const image = fighter.primary_image;
    return res.status(200).json({
      kind: 'fighter',
      id: fighter.id || null,
      name: fighter.name || name,
      image_url: image.card_url || image.image_url || image.thumb_url || null,
      thumb_url: image.thumb_url || null,
      attribution_text: image.attribution_text || null,
      license: image.license || null,
      source_url: image.source_url || null,
      resolved_by: 'exact_fighter_name',
    });
  } catch {
    return res.status(404).json({ error: 'media_not_found' });
  }
}
