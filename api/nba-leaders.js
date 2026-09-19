const ESPN_NBA_LEADERS = 'https://site.api.espn.com/apis/site/v3/sports/basketball/nba/leaders';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const requestedSeason = Number(req.query?.season || currentNbaSeason());
  const season = Number.isInteger(requestedSeason) && requestedSeason >= 2000 && requestedSeason <= currentNbaSeason() + 1
    ? requestedSeason
    : currentNbaSeason();

  res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  try {
    const response = await fetch(`${ESPN_NBA_LEADERS}?season=${season}&seasontype=2`, {
      headers: { accept: 'application/json' },
    });
    if (response.status === 400 || response.status === 404) {
      return res.status(200).json({
        sport: 'nba',
        season,
        seasonType: 2,
        source: 'PropSports.PropTechUSA.ai',
        generatedAt: new Date().toISOString(),
        availability: 'pending',
        categories: [],
      });
    }
    if (!response.ok) throw new Error(`espn_nba_leaders_${response.status}`);

    const raw = await response.json();
    const root = raw?.leaders || raw;
    const categories = Array.isArray(root?.categories) ? root.categories : [];

    return res.status(200).json({
      sport: 'nba',
      season,
      seasonType: 2,
      source: 'PropSports.PropTechUSA.ai',
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
    console.error('[nba-leaders]', error?.message || error);
    res.setHeader('Retry-After', '60');
    return res.status(503).json({ error: 'NBA leader source temporarily unavailable.' });
  }
}

function currentNbaSeason() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  return month >= 7 ? y + 1 : y;
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
