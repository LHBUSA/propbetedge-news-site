const SPORTS = {
  nfl: { category: 'football', league: 'nfl' },
  nba: { category: 'basketball', league: 'nba' },
  nhl: { category: 'hockey', league: 'nhl' },
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const sport = String(req.query?.sport || '').toLowerCase();
  const id = String(req.query?.id || '').trim();
  if (!['mlb', 'nfl', 'nba', 'nhl'].includes(sport) || !/^\d{1,12}$/.test(id)) {
    return res.status(400).json({ error: 'Invalid sport or game id.' });
  }

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=1800');

  try {
    const game = sport === 'mlb'
      ? await resolveMlbGame(id)
      : await resolveEspnGame(sport, id);

    if (!game) return res.status(404).json({ error: 'Game not found.' });
    return res.status(200).json(game);
  } catch (error) {
    console.warn('[game-meta]', sport, id, error?.message || error);
    res.setHeader('Retry-After', '300');
    return res.status(503).json({ error: 'Game source temporarily unavailable.' });
  }
}

async function resolveMlbGame(id) {
  const response = await fetch(
    `https://statsapi.mlb.com/api/v1/schedule?gamePks=${encodeURIComponent(id)}&hydrate=team,venue,linescore,probablePitcher`,
    { headers: { accept: 'application/json' } }
  );
  if (response.status === 404 || response.status === 400) return null;
  if (!response.ok) throw new Error(`mlb_${response.status}`);
  const data = await response.json();
  const game = (data?.dates || []).flatMap((row) => row?.games || [])[0];
  if (!game) return null;

  const away = game?.teams?.away || {};
  const home = game?.teams?.home || {};

  return {
    id: String(game.gamePk || id),
    sport: 'mlb',
    startDate: game.gameDate || null,
    status: game?.status?.abstractGameState || game?.status?.detailedState || '',
    statusDetail: game?.status?.detailedState || '',
    venue: game?.venue?.name || '',
    away: mlbTeam(away, 'Away Team'),
    home: mlbTeam(home, 'Home Team'),
  };
}

function mlbTeam(side, fallback) {
  const team = side?.team || {};
  return {
    id: team?.id ? String(team.id) : null,
    name: team?.name || fallback,
    abbreviation: team?.abbreviation || '',
    score: side?.score ?? null,
    winner: side?.isWinner === true,
    image: team?.id ? `https://www.mlbstatic.com/team-logos/${team.id}.svg` : null,
  };
}

async function resolveEspnGame(sport, id) {
  const meta = SPORTS[sport];
  const response = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/${meta.category}/${meta.league}/summary?event=${encodeURIComponent(id)}`,
    { headers: { accept: 'application/json' } }
  );
  if (response.status === 404 || response.status === 400) return null;
  if (!response.ok) throw new Error(`espn_${sport}_${response.status}`);

  const data = await response.json();
  const competition = data?.header?.competitions?.[0];
  if (!competition) return null;

  const competitors = competition?.competitors || [];
  const homeRaw = competitors.find((row) => row?.homeAway === 'home') || competitors[0];
  const awayRaw = competitors.find((row) => row?.homeAway === 'away') || competitors[1];
  if (!homeRaw?.team || !awayRaw?.team) return null;

  return {
    id: String(data?.header?.id || id),
    sport,
    startDate: competition?.date || null,
    status: competition?.status?.type?.state || competition?.status?.type?.description || '',
    statusDetail: competition?.status?.type?.shortDetail || competition?.status?.type?.detail || '',
    venue: competition?.venue?.fullName || competition?.venue?.name || '',
    away: espnTeam(awayRaw, 'Away Team'),
    home: espnTeam(homeRaw, 'Home Team'),
  };
}

function espnTeam(row, fallback) {
  const team = row?.team || {};
  return {
    id: team?.id ? String(team.id) : (row?.id ? String(row.id) : null),
    name: team?.displayName || team?.shortDisplayName || team?.name || fallback,
    abbreviation: team?.abbreviation || '',
    score: row?.score ?? null,
    winner: row?.winner === true,
    image: team?.logos?.[0]?.href || team?.logo || null,
  };
}
