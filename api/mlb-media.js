function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function walk(value, out, depth = 0) {
  if (depth > 8 || value == null) return;
  if (Array.isArray(value)) {
    for (const child of value) walk(child, out, depth + 1);
    return;
  }
  if (typeof value !== 'object') return;
  out.push(value);
  for (const child of Object.values(value)) walk(child, out, depth + 1);
}

function labelOf(obj) {
  return obj?.displayName || obj?.fullName || obj?.name || obj?.title || obj?.shortName || obj?.label || '';
}

function imageOf(obj) {
  return [
    obj?.headshot?.href,
    typeof obj?.headshot === 'string' ? obj.headshot : null,
    obj?.image?.href,
    typeof obj?.image === 'string' ? obj.image : null,
    obj?.images?.[0]?.href,
    obj?.images?.[0]?.url,
  ].find((value) => typeof value === 'string' && /^https?:\/\//i.test(value)) || null;
}

function idOf(obj) {
  const raw = obj?.id;
  if (raw != null && /^\d+$/.test(String(raw))) return String(raw);
  const text = [obj?.uid, obj?.guid, obj?.link?.href, obj?.href, obj?.url].filter(Boolean).join(' ');
  const match = text.match(/(?:~a:|\/id\/|athletes\/)(\d{2,})/i);
  return match?.[1] || null;
}

function exactAthlete(objects, query) {
  const q = normalize(query);
  for (const obj of objects) {
    const label = labelOf(obj);
    if (!label || normalize(label) !== q) continue;
    const context = normalize([
      obj?.type, obj?.typeName, obj?.contentType, obj?.category, obj?.subtitle,
      obj?.description, obj?.uid, obj?.href, obj?.url, obj?.link?.href,
    ].filter(Boolean).join(' '));
    const athleteLike = /\b(athlete|player)\b/.test(context);
    const editorialLike = /\b(article|story|news|video|topic|headline|recap)\b/.test(context);
    if (!athleteLike || (editorialLike && !athleteLike)) continue;
    const image = imageOf(obj);
    if (!image) continue;
    return { name: label, id: idOf(obj), image };
  }
  return null;
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
    const url = new URL('https://site.web.api.espn.com/apis/search/v2');
    url.searchParams.set('query', name);
    url.searchParams.set('limit', '25');
    url.searchParams.set('sport', 'baseball');

    const response = await fetch(url, { headers: { accept: 'application/json' } });
    if (!response.ok) return res.status(404).json({ error: 'media_not_found' });
    const data = await response.json();
    const objects = [];
    walk(data, objects);
    const hit = exactAthlete(objects, name);
    if (!hit) return res.status(404).json({ error: 'media_not_found' });

    return res.status(200).json({
      kind: 'player',
      name: hit.name,
      id: hit.id,
      image: hit.image,
      source: 'ESPN',
      resolved_by: 'exact_player_name',
    });
  } catch {
    return res.status(404).json({ error: 'media_not_found' });
  }
}
