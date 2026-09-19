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
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const name = String(req.query?.name || '').trim();
  if (!name || name.length > 100) return res.status(400).json({ error: 'invalid_name' });

  try {
    const search = new URL('https://statsapi.mlb.com/api/v1/people/search');
    search.searchParams.set('names', name);
    const response = await fetch(search, { headers: { accept: 'application/json' } });
    if (!response.ok) return res.status(404).json({ error: 'media_not_found' });

    const body = await response.json();
    const people = Array.isArray(body?.people) ? body.people : [];
    const q = normalize(name);
    const player = people.find((row) => normalize(row?.fullName) === q && /^\d+$/.test(String(row?.id || '')));
    if (!player) return res.status(404).json({ error: 'media_not_found' });

    const id = String(player.id);
    const image = `https://img.mlbstatic.com/mlb-photos/image/upload/w_600,q_auto:best/v1/people/${id}/headshot/67/current`;

    const imageCheck = await fetch(image, { method: 'HEAD' }).catch(() => null);
    if (!imageCheck?.ok) return res.status(404).json({ error: 'media_not_found' });

    return res.status(200).json({
      kind: 'player',
      name: player.fullName || name,
      id,
      image,
      source: 'MLB',
      resolved_by: 'mlbam_player_id',
    });
  } catch {
    return res.status(404).json({ error: 'media_not_found' });
  }
}
