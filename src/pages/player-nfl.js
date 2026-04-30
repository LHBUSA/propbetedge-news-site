/**
 * src/pages/player-nfl.js — /player/nfl/:id
 *
 * v3.13 Drop 1 — NFL player profile via ESPN.
 * Offseason aware — falls back to last season's stats when current is empty.
 */

import {
  playerPageShell, renderPlayerHero, renderStatRibbon, renderPropAngle,
  renderPlayerLoading, setPlayerMeta, escapeHtml,
} from './player-shared.js';

export async function renderNflPlayerPage(root, playerId, setMeta) {
  root.innerHTML = playerPageShell(renderPlayerLoading());

  try {
    const data = await fetch(`https://site.api.espn.com/apis/common/v3/sports/football/nfl/athletes/${playerId}`)
      .then((r) => r.ok ? r.json() : null).catch(() => null);

    const ath = data?.athlete;
    if (!ath) {
      root.innerHTML = playerPageShell(renderPlayerError('Player not found'));
      return;
    }

    setPlayerMeta(setMeta, ath.displayName, 'nfl', ath.team?.displayName);

    const photo = ath.headshot?.href;
    const team = ath.team?.displayName;
    const teamLogo = ath.team?.logos?.[0]?.href;
    const teamColor = ath.team?.color ? `#${ath.team.color}` : null;
    const teamId = ath.team?.id;

    const heroHtml = renderPlayerHero({
      sport: 'nfl',
      photo, name: ath.displayName,
      jersey: ath.jersey,
      position: ath.position?.abbreviation,
      team, teamId, teamLogo, teamColor,
      age: ath.age,
      height: ath.displayHeight || ath.height,
      weight: ath.displayWeight || (ath.weight ? `${ath.weight} lb` : null),
    });

    // ESPN's NFL bio response varies by position — pull raw stats array
    const splits = data?.statistics?.splits?.[0];
    const statsArr = splits?.stats || [];
    const namesArr = splits?.names || [];
    const labelsArr = splits?.displayNames || namesArr;
    const statMap = {};
    namesArr.forEach((n, i) => { statMap[n] = { value: statsArr[i], label: labelsArr[i] }; });

    const ribbon = renderNflRibbon(ath.position?.abbreviation, statMap);

    const propAngle = renderPropAngle({
      name: ath.displayName,
      sport: 'nfl',
    });

    const offseasonNote = `
      <section class="player-section">
        <div class="player-empty-card" style="text-align:center">
          <strong>Offseason</strong> — game logs and weekly stats return when the regular season opens in September.
          Stats above reflect the most recent completed season.
        </div>
      </section>
    `;

    const newsTease = renderNewsTease(ath.displayName);

    root.innerHTML = playerPageShell(`
      ${heroHtml}
      ${ribbon}
      ${propAngle}
      ${offseasonNote}
      ${newsTease}
    `);
  } catch (e) {
    console.error('[player-nfl]', e);
    root.innerHTML = playerPageShell(renderPlayerError(e.message));
  }
}

function renderNflRibbon(position, s) {
  // Pick stat set based on position
  const isQB = position === 'QB';
  const isRB = position === 'RB' || position === 'FB';
  const isWR = position === 'WR' || position === 'TE';
  const isDef = ['DE', 'DT', 'LB', 'CB', 'S', 'OLB', 'ILB', 'NT'].includes(position);
  const isK = position === 'K' || position === 'P';

  if (isQB) {
    return renderStatRibbon([
      { label: 'YDS',   value: getNfl(s, 'passingYards'), color: 'var(--gold)' },
      { label: 'TD',    value: getNfl(s, 'passingTouchdowns'), color: '#FF6B6B' },
      { label: 'INT',   value: getNfl(s, 'interceptions'), color: '#7FB3FF' },
      { label: 'CMP%',  value: getNflPct(s, 'completionPct') },
      { label: 'RTG',   value: getNfl(s, 'QBRating') || getNfl(s, 'passerRating'), color: '#5FD38D' },
      { label: 'GP',    value: getNfl(s, 'gamesPlayed') },
    ], 'PASSING STATS');
  }
  if (isRB) {
    return renderStatRibbon([
      { label: 'YDS',   value: getNfl(s, 'rushingYards'), color: 'var(--gold)' },
      { label: 'TD',    value: getNfl(s, 'rushingTouchdowns'), color: '#FF6B6B' },
      { label: 'YPC',   value: getNflDec(s, 'yardsPerRushAttempt'), color: '#5FD38D' },
      { label: 'ATT',   value: getNfl(s, 'rushingAttempts') },
      { label: 'REC',   value: getNfl(s, 'receptions'), color: '#7FB3FF' },
      { label: 'GP',    value: getNfl(s, 'gamesPlayed') },
    ], 'RUSHING STATS');
  }
  if (isWR) {
    return renderStatRibbon([
      { label: 'REC',   value: getNfl(s, 'receptions'), color: '#7FB3FF' },
      { label: 'YDS',   value: getNfl(s, 'receivingYards'), color: 'var(--gold)' },
      { label: 'TD',    value: getNfl(s, 'receivingTouchdowns'), color: '#FF6B6B' },
      { label: 'YPR',   value: getNflDec(s, 'yardsPerReception'), color: '#5FD38D' },
      { label: 'TGT',   value: getNfl(s, 'receivingTargets') },
      { label: 'GP',    value: getNfl(s, 'gamesPlayed') },
    ], 'RECEIVING STATS');
  }
  if (isDef) {
    return renderStatRibbon([
      { label: 'TKL',   value: getNfl(s, 'totalTackles'), color: 'var(--gold)' },
      { label: 'SACK',  value: getNflDec(s, 'sacks'), color: '#FF6B6B' },
      { label: 'INT',   value: getNfl(s, 'interceptions'), color: '#7FB3FF' },
      { label: 'FF',    value: getNfl(s, 'fumblesForced') },
      { label: 'PD',    value: getNfl(s, 'passesDefended') },
      { label: 'GP',    value: getNfl(s, 'gamesPlayed') },
    ], 'DEFENSIVE STATS');
  }
  // Fallback
  return renderStatRibbon([
    { label: 'GP', value: getNfl(s, 'gamesPlayed') || '—' },
  ], 'CAREER STATS');
}

function getNfl(s, key) {
  const v = s[key]?.value;
  if (v == null || v === '') return '—';
  return v;
}
function getNflDec(s, key) {
  const v = s[key]?.value;
  if (v == null || v === '') return '—';
  return parseFloat(v).toFixed(1);
}
function getNflPct(s, key) {
  const v = s[key]?.value;
  if (v == null || v === '') return '—';
  return parseFloat(v).toFixed(1) + '%';
}

function renderPlayerError(msg) {
  return `
    <section class="player-error">
      <h2>Player not available</h2>
      <p>${escapeHtml(msg || 'Could not load player profile.')}</p>
      <p><a href="/leaders/nfl">← Back to NFL leaders</a></p>
    </section>
  `;
}

function renderNewsTease(name) {
  return `
    <section class="player-section">
      <div class="player-section-kicker">RELATED NEWS</div>
      <div class="player-news-tease">
        <a href="/news/nfl" class="player-news-link">
          📰 Latest NFL news → see articles mentioning ${escapeHtml(name)} on the news beat
        </a>
      </div>
    </section>
  `;
}
