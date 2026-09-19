const ESPN_WNBA_LEADERS = 'https://site.api.espn.com/apis/site/v3/sports/basketball/wnba/leaders';
const PBE_WNBA_API = 'https://wnba-api.propbetedge.ai';

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

  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30, stale-while-revalidate=60');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  try {
    const [espnResponse, winbaResponse, teamsResponse] = await Promise.all([
      fetch(`${ESPN_WNBA_LEADERS}?season=${season}&seasontype=2`, {
        headers: { accept: 'application/json' },
      }),
      fetch(`${PBE_WNBA_API}/v1/stats/winba`, {
        headers: { accept: 'application/json' },
      }).catch(() => null),
      fetch(`${PBE_WNBA_API}/v1/teams`, {
        headers: { accept: 'application/json' },
      }).catch(() => null),
    ]);

    if (!espnResponse.ok) throw new Error(`espn_wnba_leaders_${espnResponse.status}`);

    const raw = await espnResponse.json();
    const root = raw?.leaders || raw;
    const categories = Array.isArray(root?.categories) ? root.categories : [];

    const normalized = categories.map((category) => ({
      name: category?.name || '',
      displayName: category?.displayName || '',
      abbreviation: category?.abbreviation || '',
      leaders: (Array.isArray(category?.leaders) ? category.leaders : []).map((leader) => ({
        displayValue: leader?.displayValue ?? null,
        value: leader?.value ?? null,
        athlete: normalizeAthlete(leader?.athlete),
        team: normalizeTeam(leader?.team || leader?.athlete?.team),
      })),
    }));

    let winba = null;
    if (winbaResponse?.ok) {
      const payload = await winbaResponse.json().catch(() => null);
      const snapshot = payload?.ok ? payload.data : null;
      const snapshotSeason = Number(snapshot?.season);
      if (snapshot?.status === 'AVAILABLE' && Array.isArray(snapshot?.rows) && snapshotSeason === season) {
        let teams = [];
        if (teamsResponse?.ok) {
          const tp = await teamsResponse.json().catch(() => null);
          teams = Array.isArray(tp?.data?.teams) ? tp.data.teams : [];
        }
        const teamById = new Map(teams.map((team) => [String(team.team_id), team]));
        const qualified = snapshot.rows
          .filter((row) => row?.qualified && Number.isFinite(Number(row?.score)))
          .sort((a, b) => Number(a.rank ?? Infinity) - Number(b.rank ?? Infinity) || Number(b.score) - Number(a.score))
          .slice(0, 10);

        normalized.unshift({
          name: 'winbaScore',
          displayName: 'PropBetEdge WinBA Score',
          abbreviation: 'WINBA',
          source: 'PropBetEdge',
          leaders: qualified.map((row) => {
            const team = teamById.get(String(row.team_id)) || null;
            return {
              displayValue: row.score,
              value: row.score,
              athlete: {
                id: row.athlete_id || null,
                displayName: row.name || null,
                headshot: resolveWnbaPhoto(row.photo),
                position: null,
                jersey: null,
                age: null,
              },
              team: team ? {
                id: team.team_id || null,
                abbreviation: team.abbr || null,
                displayName: team.name || team.short_name || null,
                logo: null,
              } : null,
              sample: row.sample || null,
              components: row.components || null,
              rank: row.rank || null,
            };
          }),
        });

        winba = {
          version: snapshot.version || null,
          generatedAt: snapshot.generated_at || null,
          gamesUsed: snapshot.games_used ?? null,
          qualifiedCount: snapshot.qualified_count ?? qualified.length,
          provisionalCount: snapshot.provisional_count ?? null,
          formula: snapshot.formula || null,
          source: 'PropSports.PropTechUSA.ai + PropBetEdge final-game archive',
        };
      }
    }

    return res.status(200).json({
      sport: 'wnba',
      season,
      seasonType: 2,
      source: winba ? 'PropSports.PropTechUSA.ai + PropBetEdge WinBA' : 'PropSports.PropTechUSA.ai',
      generatedAt: new Date().toISOString(),
      winba,
      categories: normalized,
    });
  } catch (error) {
    console.error('[wnba-leaders]', error?.message || error);
    res.setHeader('Retry-After', '60');
    return res.status(503).json({ error: 'WNBA leader source temporarily unavailable.' });
  }
}

function resolveWnbaPhoto(photo) {
  if (!photo) return null;
  if (typeof photo === 'string') {
    return photo.startsWith('/') ? `https://wnba.propbetedge.ai${photo}` : photo;
  }
  const path = photo.square || photo.portrait || null;
  if (!path) return null;
  return String(path).startsWith('/') ? `https://wnba.propbetedge.ai${path}` : String(path);
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
