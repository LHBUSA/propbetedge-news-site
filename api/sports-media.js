const SPORTS = {
  nfl: { category: 'football', league: 'nfl' },
  nba: { category: 'basketball', league: 'nba' },
  mlb: { category: 'baseball', league: 'mlb' },
  nhl: { category: 'hockey', league: 'nhl' },
};

export default async function handler(req, res) {
  const sport = String(req.query?.sport || '').toLowerCase();
  const kind = String(req.query?.kind || '').toLowerCase();
  const name = String(req.query?.name || '').trim();
  const meta = SPORTS[sport];

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  if (!meta || !['player', 'team'].includes(kind) || !name || name.length > 100) {
    return res.status(400).json({ error: 'Invalid sport, kind, or name.' });
  }

  try {
    const media = kind === 'team'
      ? await resolveTeam(meta, sport, name)
      : await resolvePlayer(meta, sport, name);

    if (!media?.image) return res.status(404).json({ error: 'No image found.' });
    return res.status(200).json(media);
  } catch (error) {
    console.warn('[sports-media] lookup failed:', error?.message || error);
    return res.status(404).json({ error: 'No image found.' });
  }
}

async function resolveTeam(meta, sport, query) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/${meta.category}/${meta.league}/teams?limit=100`;
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`ESPN teams ${response.status}`);
  const data = await response.json();
  const teams = data?.sports?.[0]?.leagues?.[0]?.teams?.map((entry) => entry?.team || entry).filter(Boolean) || [];
  const team = bestNamedMatch(teams, query, ['displayName', 'shortDisplayName', 'name', 'location', 'abbreviation']);
  if (!team) return null;

  const abbreviation = team.abbreviation || '';
  const image = firstImage(team) || (abbreviation
    ? `https://a.espncdn.com/i/teamlogos/${meta.league}/500/${String(abbreviation).toLowerCase()}.png`
    : null);

  return {
    kind: 'team',
    sport,
    name: team.displayName || team.shortDisplayName || query,
    abbreviation,
    image,
    source: 'ESPN',
  };
}

async function resolvePlayer(meta, sport, query) {
  if (sport === 'mlb') {
    const mlb = await resolveMlbPlayer(query).catch(() => null);
    if (mlb?.image) return mlb;
  }

  const searchUrl = new URL('https://site.web.api.espn.com/apis/search/v2');
  searchUrl.searchParams.set('query', query);
  searchUrl.searchParams.set('limit', '25');
  searchUrl.searchParams.set('sport', meta.category);

  const response = await fetch(searchUrl, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`ESPN search ${response.status}`);
  const data = await response.json();

  const objects = [];
  walkObjects(data, objects, 0);
  const candidate = pickPlayerCandidate(objects, query);
  if (!candidate) return null;

  const id = extractId(candidate);
  const image = firstImage(candidate) || (id
    ? `https://a.espncdn.com/i/headshots/${meta.league}/players/full/${id}.png`
    : null);
  if (!image) return null;

  return {
    kind: 'player',
    sport,
    name: bestLabel(candidate) || query,
    id: id || null,
    image,
    source: 'ESPN',
  };
}

async function resolveMlbPlayer(query) {
  const url = new URL('https://statsapi.mlb.com/api/v1/people/search');
  url.searchParams.set('names', query);
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`MLB people search ${response.status}`);
  const data = await response.json();
  const people = Array.isArray(data?.people) ? data.people : [];
  const person = bestNamedMatch(people, query, ['fullName', 'firstLastName', 'lastFirstName', 'useName', 'lastName']);
  if (!person?.id) return null;

  return {
    kind: 'player',
    sport: 'mlb',
    name: person.fullName || query,
    id: person.id,
    image: `https://img.mlbstatic.com/mlb-photos/image/upload/w_320,q_90/v1/people/${person.id}/headshot/67/current`,
    source: 'MLB',
  };
}

function pickPlayerCandidate(objects, query) {
  const q = normalize(query);
  let best = null;
  let bestScore = -Infinity;

  for (const obj of objects) {
    const label = bestLabel(obj);
    if (!label) continue;
    const n = normalize(label);
    if (!n) continue;

    let score = 0;
    if (n === q) score += 80;
    else if (n.includes(q) || q.includes(n)) score += 42;
    else score += tokenOverlap(q, n) * 26;

    const typeText = normalize([
      obj.type,
      obj.typeName,
      obj.contentType,
      obj.category,
      obj.subtitle,
      obj.description,
    ].filter(Boolean).join(' '));
    if (typeText.includes('athlete') || typeText.includes('player')) score += 30;
    if (typeText.includes('team')) score -= 35;
    if (extractId(obj)) score += 7;
    if (firstImage(obj)) score += 12;

    if (score > bestScore) {
      bestScore = score;
      best = obj;
    }
  }
  return bestScore >= 28 ? best : null;
}

function bestNamedMatch(items, query, fields) {
  const q = normalize(query);
  let best = null;
  let bestScore = -1;
  for (const item of items) {
    let local = 0;
    for (const field of fields) {
      const raw = item?.[field];
      if (!raw) continue;
      const value = normalize(raw);
      if (value === q) local = Math.max(local, 100);
      else if (value.includes(q) || q.includes(value)) local = Math.max(local, 65);
      else local = Math.max(local, tokenOverlap(q, value) * 45);
    }
    if (local > bestScore) {
      bestScore = local;
      best = item;
    }
  }
  return bestScore >= 20 ? best : null;
}

function walkObjects(value, output, depth) {
  if (depth > 8 || value == null) return;
  if (Array.isArray(value)) {
    for (const item of value) walkObjects(item, output, depth + 1);
    return;
  }
  if (typeof value !== 'object') return;
  output.push(value);
  for (const child of Object.values(value)) walkObjects(child, output, depth + 1);
}

function bestLabel(obj) {
  return obj?.displayName || obj?.fullName || obj?.name || obj?.title || obj?.shortName || obj?.label || '';
}

function firstImage(obj) {
  const direct = [
    obj?.headshot?.href,
    typeof obj?.headshot === 'string' ? obj.headshot : null,
    obj?.image?.href,
    typeof obj?.image === 'string' ? obj.image : null,
    obj?.logo,
    obj?.logos?.[0]?.href,
    obj?.images?.[0]?.href,
    obj?.images?.[0]?.url,
  ].find((value) => typeof value === 'string' && /^https?:\/\//i.test(value));
  return direct || null;
}

function extractId(obj) {
  const raw = obj?.id;
  if (raw != null && /^\d+$/.test(String(raw))) return String(raw);

  const text = [obj?.uid, obj?.guid, obj?.link?.href, obj?.href, obj?.url]
    .filter(Boolean)
    .join(' ');
  const match = text.match(/(?:~a:|\/id\/|athletes\/)(\d{2,})/i) || text.match(/\b(\d{4,})\b/);
  return match?.[1] || null;
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenOverlap(a, b) {
  const aTokens = new Set(a.split(/\s+/).filter(Boolean));
  const bTokens = new Set(b.split(/\s+/).filter(Boolean));
  if (!aTokens.size || !bTokens.size) return 0;
  let overlap = 0;
  for (const token of aTokens) if (bTokens.has(token)) overlap += 1;
  return overlap / Math.max(aTokens.size, bTokens.size);
}
