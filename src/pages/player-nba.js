/**
 * src/pages/player-nba.js — /player/nba/:id
 *
 * v3.13 Drop 1 — NBA player profile via ESPN.
 *
 * APIs (parallel):
 *   https://site.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/{id}     — bio + season stats
 *   https://site.api.espn.com/apis/site/v2/sports/basketball/nba/athletes/{id}/gamelog — game log
 */

import {
  playerPageShell, renderPlayerHero, renderStatRibbon, renderPropAngle,
  renderRecentForm, renderSplits, renderGameLog, renderPlayerLoading,
  setPlayerMeta, escapeHtml,
} from './player-shared.js';

export async function renderNbaPlayerPage(root, playerId, setMeta) {
  root.innerHTML = playerPageShell(renderPlayerLoading());

  try {
    const [bioData, logData] = await Promise.all([
      fetch(`https://site.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${playerId}`)
        .then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/athletes/${playerId}/gamelog`)
        .then((r) => r.ok ? r.json() : null).catch(() => null),
    ]);

    const ath = bioData?.athlete;
    if (!ath) {
      root.innerHTML = playerPageShell(renderPlayerError('Player not found'));
      return;
    }

    setPlayerMeta(setMeta, ath.displayName, 'nba', ath.team?.displayName);

    const photo = ath.headshot?.href;
    const team = ath.team?.displayName;
    const teamLogo = ath.team?.logos?.[0]?.href;
    const teamColor = ath.team?.color ? `#${ath.team.color}` : null;
    const teamId = ath.team?.id;

    const heroHtml = renderPlayerHero({
      sport: 'nba',
      photo, name: ath.displayName,
      jersey: ath.jersey,
      position: ath.position?.abbreviation,
      team, teamId, teamLogo, teamColor,
      age: ath.age,
      height: ath.displayHeight || ath.height,
      weight: ath.displayWeight || (ath.weight ? `${ath.weight} lb` : null),
    });

    // Pull season averages from bioData
    const splits = bioData?.statistics?.splits;
    const seasonStats = splits?.[0]?.stats || [];
    const seasonNames = splits?.[0]?.names || [];
    const seasonMap = {};
    seasonNames.forEach((n, i) => { seasonMap[n] = seasonStats[i]; });

    const ribbon = renderNbaRibbon(seasonMap);

    const propAngle = renderPropAngle({
      name: ath.displayName,
      sport: 'nba',
    });

    // Game log
    const games = logData?.events ? extractNbaGameLog(logData) : [];
    const recentForm = renderNbaRecentForm(games);
    const gameLogHtml = renderNbaGameLogTable(games);

    const splitsHtml = renderNbaSplits(seasonMap);
    const newsTease = renderNewsTease(ath.displayName);

    root.innerHTML = playerPageShell(`
      ${heroHtml}
      ${ribbon}
      ${propAngle}
      ${recentForm}
      ${splitsHtml}
      ${gameLogHtml}
      ${newsTease}
    `);
  } catch (e) {
    console.error('[player-nba]', e);
    root.innerHTML = playerPageShell(renderPlayerError(e.message));
  }
}

function renderNbaRibbon(s) {
  if (!Object.keys(s).length) return renderStatRibbon([
    { label: 'PPG', value: '—' }, { label: 'RPG', value: '—' }, { label: 'APG', value: '—' },
    { label: 'FG%', value: '—' }, { label: '3P%', value: '—' }, { label: 'GP', value: '—' },
  ], 'SEASON STATS · NO DATA YET');

  return renderStatRibbon([
    { label: 'PPG',   value: s.avgPoints != null ? parseFloat(s.avgPoints).toFixed(1) : '—', color: '#FF6B6B' },
    { label: 'RPG',   value: s.avgRebounds != null ? parseFloat(s.avgRebounds).toFixed(1) : '—', color: '#7FB3FF' },
    { label: 'APG',   value: s.avgAssists != null ? parseFloat(s.avgAssists).toFixed(1) : '—', color: 'var(--gold)' },
    { label: 'SPG',   value: s.avgSteals != null ? parseFloat(s.avgSteals).toFixed(1) : '—', color: '#5FD38D' },
    { label: 'BPG',   value: s.avgBlocks != null ? parseFloat(s.avgBlocks).toFixed(1) : '—', color: '#FF8C42' },
    { label: 'FG%',   value: s.fieldGoalPct != null ? parseFloat(s.fieldGoalPct).toFixed(1) + '%' : '—' },
    { label: '3P%',   value: s.threePointFieldGoalPct != null ? parseFloat(s.threePointFieldGoalPct).toFixed(1) + '%' : '—' },
    { label: 'GP',    value: s.gamesPlayed ?? '—' },
  ], 'SEASON AVERAGES');
}

function extractNbaGameLog(logData) {
  // ESPN's gamelog response structure: seasonTypes -> categories -> events array
  // or it can be flat: events: [{...stats}, ...] per game
  const events = logData?.events;
  const seasons = logData?.seasonTypes || [];
  const games = [];

  // Try seasonTypes structure first (regular season → categories → events)
  for (const st of seasons) {
    for (const cat of (st.categories || [])) {
      for (const ev of (cat.events || [])) {
        games.push(parseNbaGame(ev, events));
      }
    }
  }

  // If no games found, try flat events array
  if (!games.length && Array.isArray(events)) {
    for (const ev of events) {
      games.push(parseNbaGame(ev, events));
    }
  } else if (!games.length && events && typeof events === 'object') {
    // events as keyed object
    for (const [, ev] of Object.entries(events)) {
      games.push(parseNbaGame(ev, events));
    }
  }

  return games.filter(Boolean);
}

function parseNbaGame(ev, eventsLookup) {
  if (!ev) return null;
  // ESPN sometimes puts stats in `stats` array, sometimes in `eventNote`
  const stats = ev.stats || [];
  const opp = ev.opponent?.abbreviation || ev.atVs || '—';
  const date = ev.gameDate || ev.date || '';
  // stat field positions: 0=MIN, 1=FGM-A, 2=FG%, 3=3PM-A, 4=3P%, 5=FTM-A, 6=FT%, 7=OREB, 8=DREB, 9=REB, 10=AST, 11=STL, 12=BLK, 13=TO, 14=PF, 15=PTS
  return {
    date,
    opp,
    statValues: [
      { label: 'MIN', value: stats[0] ?? '—' },
      { label: 'PTS', value: stats[15] ?? '—', isHot: parseInt(stats[15]) >= 30 },
      { label: 'REB', value: stats[9] ?? '—' },
      { label: 'AST', value: stats[10] ?? '—' },
      { label: 'FG%', value: stats[2] != null ? parseFloat(stats[2]).toFixed(1) + '%' : '—' },
    ],
    raw: stats,
  };
}

function renderNbaRecentForm(games) {
  if (!games?.length) return '';
  return renderRecentForm(games.slice(0, 10), 'PTS', 'PTS');
}

function renderNbaGameLogTable(games) {
  if (!games?.length) return '';
  const headers = ['Date', 'Opp', 'MIN', 'FG', '3P', 'FT', 'REB', 'AST', 'STL', 'BLK', 'TO', 'PTS'];
  const rows = games.map((g) => ({
    cells: [
      { value: formatDate(g.date) },
      { value: g.opp || '—' },
      { value: g.raw?.[0] ?? '—' },
      { value: g.raw?.[1] || '—' },
      { value: g.raw?.[3] || '—' },
      { value: g.raw?.[5] || '—' },
      { value: g.raw?.[9] ?? '—' },
      { value: g.raw?.[10] ?? '—' },
      { value: g.raw?.[11] ?? '—' },
      { value: g.raw?.[12] ?? '—' },
      { value: g.raw?.[13] ?? '—' },
      { value: g.raw?.[15] ?? '—', cls: parseInt(g.raw?.[15]) >= 30 ? 'stat-hot' : '' },
    ],
  }));
  return renderGameLog(rows, headers);
}

function renderNbaSplits(s) {
  return renderSplits([
    {
      name: 'Shooting Efficiency',
      rows: [
        {
          label: 'Per Game',
          statValues: [
            { label: 'FGA', value: s.avgFieldGoalsAttempted != null ? parseFloat(s.avgFieldGoalsAttempted).toFixed(1) : '—' },
            { label: 'FG%', value: s.fieldGoalPct != null ? parseFloat(s.fieldGoalPct).toFixed(1) + '%' : '—' },
            { label: '3PA', value: s.avgThreePointFieldGoalsAttempted != null ? parseFloat(s.avgThreePointFieldGoalsAttempted).toFixed(1) : '—' },
            { label: '3P%', value: s.threePointFieldGoalPct != null ? parseFloat(s.threePointFieldGoalPct).toFixed(1) + '%' : '—' },
            { label: 'FT%', value: s.freeThrowPct != null ? parseFloat(s.freeThrowPct).toFixed(1) + '%' : '—' },
          ],
        },
      ],
    },
  ]);
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
  } catch { return iso; }
}

function renderPlayerError(msg) {
  return `
    <section class="player-error">
      <h2>Player not available</h2>
      <p>${escapeHtml(msg || 'Could not load player profile.')}</p>
      <p><a href="/leaders/nba">← Back to NBA leaders</a></p>
    </section>
  `;
}

function renderNewsTease(name) {
  return `
    <section class="player-section">
      <div class="player-section-kicker">RELATED NEWS</div>
      <div class="player-news-tease">
        <a href="/news/nba" class="player-news-link">
          📰 Latest NBA news → see articles mentioning ${escapeHtml(name)} on the news beat
        </a>
      </div>
    </section>
  `;
}
