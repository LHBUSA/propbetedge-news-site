/**
 * src/pages/player-nhl.js — /player/nhl/:id
 *
 * v3.13 Drop 1 — NHL player profile.
 *
 * Single API call:
 *   https://api-web.nhle.com/v1/player/{id}/landing
 * Returns: bio, current season stats, last 5 games, career totals, awards.
 *
 * Bonus calls (parallel):
 *   /v1/player/{id}/game-log/{season}/{gameType} — full game log
 */

import {
  playerPageShell, renderPlayerHero, renderStatRibbon, renderPropAngle,
  renderRecentForm, renderSplits, renderGameLog, renderPlayerLoading,
  setPlayerMeta, escapeHtml,
} from './player-shared.js';

export async function renderNhlPlayerPage(root, playerId, setMeta) {
  root.innerHTML = playerPageShell(renderPlayerLoading());

  try {
    // Landing returns most of what we need in one call
    const landing = await fetch(`https://api-web.nhle.com/v1/player/${playerId}/landing`)
      .then((r) => r.ok ? r.json() : null);

    if (!landing) {
      root.innerHTML = playerPageShell(renderPlayerError('Player not found'));
      return;
    }

    // Determine season for game-log call
    const season = nhlCurrentSeasonString();
    // gameType: 2 = regular, 3 = playoffs — try playoffs first
    let gameLog = null;
    for (const gt of [3, 2]) {
      const log = await fetch(`https://api-web.nhle.com/v1/player/${playerId}/game-log/${season}/${gt}`)
        .then((r) => r.ok ? r.json() : null).catch(() => null);
      if (log?.gameLog?.length) {
        gameLog = log;
        break;
      }
    }

    const isGoalie = landing.position === 'G';
    const fullName = `${landing.firstName?.default || ''} ${landing.lastName?.default || ''}`.trim();

    setPlayerMeta(setMeta, fullName, 'nhl', landing.fullTeamName?.default);

    // Photo + team logo
    const photo = landing.headshot;
    const teamAbbr = landing.currentTeamAbbrev || '';
    const teamLogo = teamAbbr ? `https://assets.nhle.com/logos/nhl/svg/${teamAbbr}_light.svg` : null;
    const teamColor = TEAM_COLORS[teamAbbr] || null;

    // Bio
    const heightFt = landing.heightInInches ? `${Math.floor(landing.heightInInches / 12)}' ${landing.heightInInches % 12}"` : null;
    const weightLb = landing.weightInPounds ? `${landing.weightInPounds} lb` : null;
    const age = landing.birthDate ? Math.floor((Date.now() - new Date(landing.birthDate).getTime()) / (365.25 * 24 * 3600 * 1000)) : null;

    const heroHtml = renderPlayerHero({
      sport: 'nhl',
      photo, name: fullName,
      jersey: landing.sweaterNumber,
      position: landing.position,
      team: landing.fullTeamName?.default,
      teamId: teamAbbr, // we pass the abbr as id for routing
      teamLogo, teamColor,
      age, height: heightFt, weight: weightLb,
      throws: landing.shootsCatches,
    });

    const ribbon = isGoalie
      ? renderGoalieRibbon(landing.featuredStats?.regularSeason?.subSeason || landing.featuredStats?.regularSeason)
      : renderSkaterRibbon(landing.featuredStats?.regularSeason?.subSeason || landing.featuredStats?.regularSeason);

    const propAngle = renderPropAngle({
      name: fullName,
      sport: 'nhl',
    });

    const recentForm = isGoalie
      ? renderGoalieRecentForm(landing.last5Games || [])
      : renderSkaterRecentForm(landing.last5Games || []);

    const splits = renderSplitsForPosition(landing, isGoalie);

    const gameLogHtml = isGoalie
      ? renderGoalieGameLog(gameLog?.gameLog || [])
      : renderSkaterGameLog(gameLog?.gameLog || []);

    const newsTease = renderNewsTease(fullName);

    root.innerHTML = playerPageShell(`
      ${heroHtml}
      ${ribbon}
      ${propAngle}
      ${recentForm}
      ${splits}
      ${gameLogHtml}
      ${newsTease}
    `);
  } catch (e) {
    console.error('[player-nhl]', e);
    root.innerHTML = playerPageShell(renderPlayerError(e.message));
  }
}

// ─── Skater ──────────────────────────────────────────────────────────────
function renderSkaterRibbon(stats) {
  if (!stats) return renderStatRibbon([
    { label: 'G', value: '—' }, { label: 'A', value: '—' }, { label: 'P', value: '—' },
    { label: '+/-', value: '—' }, { label: 'GP', value: '—' }, { label: 'PIM', value: '—' },
  ], 'SEASON STATS · NO DATA YET');

  return renderStatRibbon([
    { label: 'G',     value: stats.goals ?? 0,       color: '#FF6B6B' },
    { label: 'A',     value: stats.assists ?? 0,     color: '#7FB3FF' },
    { label: 'P',     value: stats.points ?? 0,      color: 'var(--gold)' },
    { label: '+/-',   value: signed(stats.plusMinus), color: '#5FD38D' },
    { label: 'GP',    value: stats.gamesPlayed ?? 0 },
    { label: 'SOG',   value: stats.shots ?? 0 },
    { label: 'SH%',   value: stats.shootingPctg != null ? (stats.shootingPctg * 100).toFixed(1) + '%' : '—' },
    { label: 'PIM',   value: stats.pim ?? 0 },
  ], 'SEASON STATS');
}

function renderSkaterRecentForm(games) {
  if (!games?.length) return '';
  const top = games.slice(0, 10);
  const formatted = top.map((g) => ({
    date: g.gameDate,
    opp: g.opponentAbbrev || '—',
    statValues: [
      { label: 'G', value: g.goals ?? 0, isHot: (g.goals || 0) >= 2 },
      { label: 'A', value: g.assists ?? 0, isHot: (g.assists || 0) >= 2 },
      { label: 'P', value: g.points ?? 0, isHot: (g.points || 0) >= 3 },
      { label: 'SOG', value: g.shots ?? 0 },
      { label: '+/-', value: signed(g.plusMinus) },
    ],
  }));
  return renderRecentForm(formatted, 'points', 'P');
}

function renderSkaterGameLog(games) {
  if (!games?.length) return '';
  const headers = ['Date', 'Opp', 'G', 'A', 'P', '+/-', 'SOG', 'PIM', 'TOI'];
  const rows = games.map((g) => ({
    cells: [
      { value: formatDate(g.gameDate) },
      { value: g.opponentAbbrev || '—' },
      { value: g.goals ?? 0, cls: (g.goals || 0) >= 2 ? 'stat-hot' : '' },
      { value: g.assists ?? 0, cls: (g.assists || 0) >= 2 ? 'stat-hot' : '' },
      { value: g.points ?? 0, cls: (g.points || 0) >= 3 ? 'stat-hot' : '' },
      { value: signed(g.plusMinus) },
      { value: g.shots ?? 0 },
      { value: g.pim ?? 0 },
      { value: g.toi || '—' },
    ],
  }));
  return renderGameLog(rows, headers);
}

// ─── Goalie ──────────────────────────────────────────────────────────────
function renderGoalieRibbon(stats) {
  if (!stats) return renderStatRibbon([
    { label: 'W', value: '—' }, { label: 'L', value: '—' }, { label: 'SV%', value: '—' },
    { label: 'GAA', value: '—' }, { label: 'SO', value: '—' }, { label: 'GP', value: '—' },
  ], 'SEASON STATS · NO DATA YET');

  return renderStatRibbon([
    { label: 'W',    value: stats.wins ?? 0, color: 'var(--gold)' },
    { label: 'L',    value: stats.losses ?? 0 },
    { label: 'OTL',  value: stats.otLosses ?? stats.overtimeLosses ?? 0 },
    { label: 'SV%',  value: stats.savePctg != null ? stats.savePctg.toFixed(3).replace(/^0/, '') : '—', color: '#5FD38D' },
    { label: 'GAA',  value: stats.goalsAgainstAvg != null ? stats.goalsAgainstAvg.toFixed(2) : '—', color: '#7FB3FF' },
    { label: 'SO',   value: stats.shutouts ?? 0, color: '#FF8C42' },
    { label: 'GP',   value: stats.gamesPlayed ?? 0 },
    { label: 'SA',   value: stats.shotsAgainst ?? '—' },
  ], 'SEASON STATS');
}

function renderGoalieRecentForm(games) {
  if (!games?.length) return '';
  const top = games.slice(0, 10);
  const formatted = top.map((g) => ({
    date: g.gameDate,
    opp: g.opponentAbbrev || '—',
    statValues: [
      { label: 'GA', value: g.goalsAgainst ?? 0, isCold: (g.goalsAgainst || 0) >= 4 },
      { label: 'SV', value: g.shotsAgainst != null ? (g.shotsAgainst - (g.goalsAgainst || 0)) : '—' },
      { label: 'SV%', value: g.savePctg != null ? g.savePctg.toFixed(3).replace(/^0/, '') : '—', isHot: g.savePctg >= 0.93 },
      { label: 'Decision', value: g.decision || '—' },
    ],
  }));
  return renderRecentForm(formatted, 'savePctg', 'SV%');
}

function renderGoalieGameLog(games) {
  if (!games?.length) return '';
  const headers = ['Date', 'Opp', 'Dec', 'GA', 'SA', 'SV%', 'TOI'];
  const rows = games.map((g) => ({
    cells: [
      { value: formatDate(g.gameDate) },
      { value: g.opponentAbbrev || '—' },
      { value: g.decision || '—', cls: g.decision === 'W' ? 'stat-hot' : g.decision === 'L' ? 'stat-cold' : '' },
      { value: g.goalsAgainst ?? '—' },
      { value: g.shotsAgainst ?? '—' },
      { value: g.savePctg != null ? g.savePctg.toFixed(3).replace(/^0/, '') : '—' },
      { value: g.toi || '—' },
    ],
  }));
  return renderGameLog(rows, headers);
}

function renderSplitsForPosition(landing, isGoalie) {
  // NHL API doesn't expose situational splits in landing — show career summary instead
  const career = landing.careerTotals?.regularSeason;
  const playoffs = landing.careerTotals?.playoffs;

  if (!career && !playoffs) return '';

  const skaterRow = (label, s) => ({
    label,
    statValues: [
      { label: 'GP', value: s.gamesPlayed ?? 0 },
      { label: 'G', value: s.goals ?? 0 },
      { label: 'A', value: s.assists ?? 0 },
      { label: 'P', value: s.points ?? 0 },
      { label: 'PIM', value: s.pim ?? 0 },
    ],
  });
  const goalieRow = (label, s) => ({
    label,
    statValues: [
      { label: 'GP', value: s.gamesPlayed ?? 0 },
      { label: 'W', value: s.wins ?? 0 },
      { label: 'SV%', value: s.savePctg != null ? s.savePctg.toFixed(3).replace(/^0/, '') : '—' },
      { label: 'GAA', value: s.goalsAgainstAvg != null ? s.goalsAgainstAvg.toFixed(2) : '—' },
      { label: 'SO', value: s.shutouts ?? 0 },
    ],
  });

  const rowFn = isGoalie ? goalieRow : skaterRow;
  const rows = [];
  if (career) rows.push(rowFn('Regular Season', career));
  if (playoffs) rows.push(rowFn('Playoffs', playoffs));

  return renderSplits([{ name: 'Career Totals', rows }]);
}

// ─── Helpers ────────────────────────────────────────────────────────────
function signed(v) {
  if (v == null) return '—';
  const n = parseInt(v);
  if (isNaN(n)) return '—';
  return n > 0 ? `+${n}` : `${n}`;
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
  } catch { return iso; }
}

function nhlCurrentSeasonString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (m >= 8) return `${y}${y + 1}`;
  return `${y - 1}${y}`;
}

function renderPlayerError(msg) {
  return `
    <section class="player-error">
      <h2>Player not available</h2>
      <p>${escapeHtml(msg || 'Could not load player profile.')}</p>
      <p><a href="/leaders/nhl">← Back to NHL leaders</a></p>
    </section>
  `;
}

function renderNewsTease(name) {
  return `
    <section class="player-section">
      <div class="player-section-kicker">RELATED NEWS</div>
      <div class="player-news-tease">
        <a href="/news/nhl" class="player-news-link">
          📰 Latest NHL news → see articles mentioning ${escapeHtml(name)} on the news beat
        </a>
      </div>
    </section>
  `;
}

const TEAM_COLORS = {
  ANA: '#F47A38', BOS: '#FFB81C', BUF: '#002654', CGY: '#C8102E', CAR: '#CC0000',
  CHI: '#CF0A2C', COL: '#6F263D', CBJ: '#002654', DAL: '#006847', DET: '#CE1126',
  EDM: '#041E42', FLA: '#041E42', LAK: '#111111', MIN: '#154734', MTL: '#AF1E2D',
  NSH: '#FFB81C', NJD: '#CE1126', NYI: '#00539B', NYR: '#0038A8', OTT: '#C52032',
  PHI: '#F74902', PIT: '#000000', SJS: '#006D75', SEA: '#001628', STL: '#002F87',
  TBL: '#002868', TOR: '#00205B', UTA: '#71AFE5', VAN: '#00205B', VGK: '#B4975A',
  WSH: '#041E42', WPG: '#041E42',
};
