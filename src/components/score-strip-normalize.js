/**
 * src/components/score-strip-normalize.js
 *
 * Shared normalizer — extracts the per-league game-shape mapping that
 * games-hub.js already uses, so score-strip.js and games-hub.js never drift.
 *
 * If you ever update a normalizer for one, update it here and both pick it up.
 *
 * Output shape (consumed by both score-strip and games-hub):
 *   {
 *     sport, sportLabel, gameId, state ('live'|'final'|'pre'),
 *     statusText,
 *     home: { name, abbr, logo, score, record },
 *     away: { name, abbr, logo, score, record },
 *     detailUrl, gameDate
 *   }
 */

export function normalizeAll(data) {
  return [
    ...normalizeMLB(data?.mlb?.games || []),
    ...normalizeNBA(data?.nba?.games || []),
    ...normalizeNHL(data?.nhl?.games || []),
    ...normalizeNFL(data?.nfl?.games || []),
  ]
}

export function normalizeMLB(games) {
  return games.map((g) => {
    const status = g.status?.abstractGameState || g.status?.detailedState || ''
    const state = status === 'Live' || status === 'In Progress' ? 'live'
                : status === 'Final' || status === 'Game Over' ? 'final'
                : 'pre'
    const ls = g.linescore || {}
    return {
      sport: 'mlb',
      sportLabel: '⚾ MLB',
      gameId: g.gamePk,
      state,
      statusText: state === 'live'
        ? `${ls.inningHalf || 'Live'} ${ls.currentInningOrdinal || ''}`.trim()
        : state === 'final' ? 'Final' : formatTime(g.gameDate),
      home: {
        name: g.teams?.home?.team?.name || '',
        abbr: g.teams?.home?.team?.abbreviation || teamAbbr(g.teams?.home?.team?.name),
        logo: g.teams?.home?.team?.id ? `https://www.mlbstatic.com/team-logos/${g.teams.home.team.id}.svg` : null,
        score: g.teams?.home?.score ?? '',
        record: g.teams?.home?.leagueRecord ? `${g.teams.home.leagueRecord.wins}-${g.teams.home.leagueRecord.losses}` : '',
      },
      away: {
        name: g.teams?.away?.team?.name || '',
        abbr: g.teams?.away?.team?.abbreviation || teamAbbr(g.teams?.away?.team?.name),
        logo: g.teams?.away?.team?.id ? `https://www.mlbstatic.com/team-logos/${g.teams.away.team.id}.svg` : null,
        score: g.teams?.away?.score ?? '',
        record: g.teams?.away?.leagueRecord ? `${g.teams.away.leagueRecord.wins}-${g.teams.away.leagueRecord.losses}` : '',
      },
      detailUrl: `/games/mlb/${g.gamePk}`,
      pitchers: g.teams ? `${g.teams.away?.probablePitcher?.fullName || 'TBD'} vs ${g.teams.home?.probablePitcher?.fullName || 'TBD'}` : null,
      gameDate: g.gameDate,
    }
  })
}

export function normalizeNBA(games) {
  return games.map((g) => {
    const stateRaw = g.statusState || ''
    const state = stateRaw === 'in' ? 'live' : stateRaw === 'post' ? 'final' : 'pre'
    return {
      sport: 'nba',
      sportLabel: '🏀 NBA',
      gameId: g.id,
      state,
      statusText: state === 'live' ? `Q${g.period || ''} ${g.clock || ''}`.trim()
                : state === 'final' ? 'Final'
                : g.statusDetail || formatTime(g.date),
      home: {
        name: g.home, abbr: g.homeAbbr, logo: g.homeLogo,
        score: g.homeScore ?? '', record: '',
      },
      away: {
        name: g.away, abbr: g.awayAbbr, logo: g.awayLogo,
        score: g.awayScore ?? '', record: '',
      },
      detailUrl: `/games/nba/${g.id}`,
      gameDate: g.date,
    }
  })
}

export function normalizeNHL(games) {
  return games.map((g) => {
    const state = ['LIVE', 'CRIT'].includes(g.status) ? 'live'
                : ['OFF', 'FINAL'].includes(g.status) ? 'final'
                : 'pre'
    return {
      sport: 'nhl',
      sportLabel: '🏒 NHL',
      gameId: g.id,
      state,
      statusText: state === 'live' ? 'Live'
                : state === 'final' ? 'Final'
                : formatTime(g.date),
      home: {
        name: g.home, abbr: teamAbbr(g.home), logo: null,
        score: g.homeScore ?? '', record: '',
      },
      away: {
        name: g.away, abbr: teamAbbr(g.away), logo: null,
        score: g.awayScore ?? '', record: '',
      },
      detailUrl: null,
      gameDate: g.date,
    }
  })
}

export function normalizeNFL(games) {
  return games.map((g) => {
    const status = (g.status || '').toLowerCase()
    const state = status.includes('in progress') ? 'live'
                : status.includes('final') ? 'final'
                : 'pre'
    return {
      sport: 'nfl',
      sportLabel: '🏈 NFL',
      gameId: g.id,
      state,
      statusText: state === 'live' ? 'Live'
                : state === 'final' ? 'Final'
                : formatTime(g.date),
      home: {
        name: g.home, abbr: teamAbbr(g.home), logo: null,
        score: g.homeScore ?? '', record: '',
      },
      away: {
        name: g.away, abbr: teamAbbr(g.away), logo: null,
        score: g.awayScore ?? '', record: '',
      },
      detailUrl: null,
      gameDate: g.date,
    }
  })
}

function teamAbbr(name) {
  if (!name) return ''
  const parts = name.split(' ')
  return parts[parts.length - 1].slice(0, 3).toUpperCase()
}

function formatTime(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
    }) + ' ET'
  } catch {
    return '—'
  }
}
