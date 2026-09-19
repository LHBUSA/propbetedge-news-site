const ESPN_WNBA_LEADERS = 'https://site.api.espn.com/apis/site/v3/sports/basketball/wnba/leaders';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const now = new Date();
  const requestedSeason = Number(req.query?.season || now.getUTCFullYear());
  const season = Number.isInteger(requestedSeason) && requestedSeason >= 2000 && requestedSeason <= now.getUTCFullYear() + 1
    ? requestedSeason
    : now.getUTCFullYear();

  res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  try {
    const response = await fetch(`${ESPN_WNBA_LEADERS}?season=${season}&seasontype=2`, {
      headers: { accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`espn_wnba_leaders_${response.status}`);

    const raw = await response.json();
    const root = raw?.leaders || raw;
    const categories = Array.isArray(root?.categories) ? root.categories : [];

    return res.status(200).json({
      sport: 'wnba',
      season,
      seasonType: 2,
      source: 'ESPN',
      generatedAt: new Date().toISOString(),
      categories: categories.map((category) => ({
        name: category?.name || '',
        displayName: category?.displayName || '',
        abbreviation: category?.abbreviation || '',
        leaders: (Array.isArray(category?.leaders) ? category.leaders : []).map((leader) => ({
          displayValue: leader?.displayValue ?? null,
          value: leader?.value ?? null,
          athlete: normalizeAthlete(leader?.athlete),
          team: normalizeTeam(leader?.team || leader?.athlete?.team),
        })),
      })),
    });
  } catch (error) {
    console.error('[wnba-leaders]', error?.message || error);
    res.setHeader('Retry-After', '60');
    return res.status(503).json({ error: 'WNBA leader source temporarily unavailable.' });
  }
}

function normalizeAthlete(athlete) {
  if (!athlete || typeof athlete !== 'object') return null;
  return {
    id: athlete.id || null,
    displayName: athlete.displayName || athlete.fullName || [athlete.firstName, athlete.lastName].filter(Boolean).join(' ') || null,
    headshot: athlete?.headshot?.href || athlete?.headshot || null,
    position: athlete?.position?.abbreviation || athlete?.position?.name || null,
    jersey: athlete?.jersey || null,
    age: athlete?.age ?? null,
  };
}

function normalizeTeam(team) {
  if (!team || typeof team !== 'object') return null;
  return {
    id: team.id || null,
    abbreviation: team.abbreviation || null,
    displayName: team.displayName || team.shortDisplayName || team.name || null,
    logo: team?.logos?.[0]?.href || team?.logo || null,
  };
}
