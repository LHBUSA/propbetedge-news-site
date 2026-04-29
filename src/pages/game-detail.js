/**
 * src/pages/game-detail.js — /games/:sport/:gameId
 * ESPN-style game detail page. Currently supports MLB + NBA (most data-rich
 * via PropSports API public endpoints). NFL/NHL show a simplified view.
 *
 * Layout:
 *   ┌──────────────────────────────────────────────┐
 *   │ Game header: away team — score — home team  │
 *   │ Status, period/inning, venue                 │
 *   ├──────────────────────────────────────────────┤
 *   │ Line score / box score table                 │
 *   ├──────────────────────────────────────────────┤
 *   │ Last plays / pitch-by-pitch                  │
 *   ├──────────────────────────────────────────────┤
 *   │ PropBetEdge angle teaser (no picks shown)    │
 *   └──────────────────────────────────────────────┘
 */

import { sports } from '../api-sports.js';
import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';

export async function renderGameDetail(root, sport, gameId) {
  root.innerHTML = `
    ${renderHeader()}
    <main>
      <div class="container">
        <div class="game-detail-back">
          <a href="/games">← All Games</a>
        </div>
        <div id="game-detail-body">
          <div class="games-loading">
            <div class="games-loading-dot"></div>
            <div class="games-loading-dot"></div>
            <div class="games-loading-dot"></div>
          </div>
        </div>
      </div>
    </main>
    ${renderFooter()}
  `;

  const target = document.getElementById('game-detail-body');

  try {
    if (sport === 'mlb') {
      await renderMlbDetail(target, gameId);
    } else if (sport === 'nba') {
      await renderNbaDetail(target, gameId);
    } else {
      target.innerHTML = unsupportedDetail(sport);
    }
  } catch (e) {
    console.error('[game-detail]', e);
    target.innerHTML = `
      <div class="games-empty">
        <h3>Couldn't load this game</h3>
        <p>${escapeHtml(e.message)}</p>
        <p><a href="/games">← Back to all games</a></p>
      </div>
    `;
  }
}

// ─── MLB Detail ──────────────────────────────────────────────────────────
async function renderMlbDetail(target, gamePk) {
  const [linescore, boxscore, plays] = await Promise.all([
    sports.mlbLinescore(gamePk).catch(() => null),
    sports.mlbBoxscore(gamePk).catch(() => null),
    sports.mlbPlays(gamePk, 30).catch(() => ({ recent: [] })),
  ]);

  if (!linescore && !boxscore) {
    target.innerHTML = `<div class="games-empty"><h3>Game not found</h3></div>`;
    return;
  }

  const homeTeam = boxscore?.teams?.home?.team || {};
  const awayTeam = boxscore?.teams?.away?.team || {};
  const homeId = homeTeam.id;
  const awayId = awayTeam.id;
  const homeScore = linescore?.teams?.home?.runs ?? 0;
  const awayScore = linescore?.teams?.away?.runs ?? 0;
  const homeHits = linescore?.teams?.home?.hits ?? 0;
  const awayHits = linescore?.teams?.away?.hits ?? 0;
  const homeErr = linescore?.teams?.home?.errors ?? 0;
  const awayErr = linescore?.teams?.away?.errors ?? 0;

  const isLive = !!linescore?.currentInning && !linescore?.isLive === false;
  const inningText = linescore?.currentInning
    ? `${linescore?.inningHalf || ''} ${linescore?.currentInningOrdinal || ''}`.trim()
    : 'Pre-game';

  // Build inning-by-inning header
  const innings = linescore?.innings || [];
  const inningCount = Math.max(innings.length, 9);

  const headerHtml = `
    <section class="game-hero">
      <div class="game-hero-row">
        ${teamColumn(awayTeam, awayScore, awayId, parseInt(awayScore) > parseInt(homeScore))}
        <div class="game-hero-mid">
          <div class="game-hero-status">${escapeHtml(inningText)}</div>
          <div class="game-hero-vs">vs</div>
          <div class="game-hero-meta">⚾ MLB</div>
        </div>
        ${teamColumn(homeTeam, homeScore, homeId, parseInt(homeScore) > parseInt(awayScore))}
      </div>
    </section>
  `;

  // Line score table
  const lineScoreHtml = innings.length ? `
    <section class="game-section">
      <h2 class="game-section-title">Line Score</h2>
      <div class="linescore-wrap">
        <table class="linescore-table">
          <thead>
            <tr>
              <th class="ls-team"></th>
              ${Array.from({ length: inningCount }, (_, i) => `<th>${i + 1}</th>`).join('')}
              <th class="ls-total">R</th>
              <th class="ls-total">H</th>
              <th class="ls-total">E</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="ls-team">${escapeHtml(awayTeam.abbreviation || awayTeam.name || 'AWAY')}</td>
              ${Array.from({ length: inningCount }, (_, i) => {
                const inn = innings[i];
                return `<td>${inn?.away?.runs ?? '-'}</td>`;
              }).join('')}
              <td class="ls-total"><strong>${awayScore}</strong></td>
              <td class="ls-total">${awayHits}</td>
              <td class="ls-total">${awayErr}</td>
            </tr>
            <tr>
              <td class="ls-team">${escapeHtml(homeTeam.abbreviation || homeTeam.name || 'HOME')}</td>
              ${Array.from({ length: inningCount }, (_, i) => {
                const inn = innings[i];
                return `<td>${inn?.home?.runs ?? '-'}</td>`;
              }).join('')}
              <td class="ls-total"><strong>${homeScore}</strong></td>
              <td class="ls-total">${homeHits}</td>
              <td class="ls-total">${homeErr}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  ` : '';

  // Recent plays
  const recentPlays = plays?.recent || [];
  const playsHtml = recentPlays.length ? `
    <section class="game-section">
      <h2 class="game-section-title">Recent Plays</h2>
      <ul class="plays-list">
        ${recentPlays.slice().reverse().slice(0, 12).map((p) => {
          const desc = p.result?.description || p.about?.halfInning || '';
          const inning = p.about?.inning ? `${p.about.halfInning?.[0]?.toUpperCase()}${p.about.inning}` : '';
          return `
            <li class="play-item ${p.about?.isScoringPlay ? 'scoring' : ''}">
              <span class="play-inning">${escapeHtml(inning)}</span>
              <span class="play-desc">${escapeHtml(desc)}</span>
            </li>
          `;
        }).join('')}
      </ul>
    </section>
  ` : '';

  // Top batters from box score
  const topBatters = extractMlbTopBatters(boxscore);
  const battersHtml = topBatters.length ? `
    <section class="game-section">
      <h2 class="game-section-title">Top Performers</h2>
      <div class="batters-grid">
        ${topBatters.slice(0, 6).map(renderBatterCard).join('')}
      </div>
    </section>
  ` : '';

  target.innerHTML = `
    ${headerHtml}
    ${lineScoreHtml}
    ${battersHtml}
    ${playsHtml}
    ${propBetEdgeAngle('mlb')}
  `;

  // Auto-refresh if live
  if (isLive) {
    setTimeout(() => renderMlbDetail(target, gamePk), 30000);
  }
}

function extractMlbTopBatters(boxscore) {
  if (!boxscore?.teams) return [];
  const out = [];
  for (const side of ['home', 'away']) {
    const players = boxscore.teams[side]?.players || {};
    for (const key of Object.keys(players)) {
      const p = players[key];
      const stat = p?.stats?.batting;
      if (!stat || stat.atBats === 0) continue;
      out.push({
        name: p.person?.fullName || '',
        team: boxscore.teams[side]?.team?.abbreviation || '',
        position: p.position?.abbreviation || '',
        ab: stat.atBats || 0,
        hits: stat.hits || 0,
        r: stat.runs || 0,
        rbi: stat.rbi || 0,
        hr: stat.homeRuns || 0,
        avg: p.seasonStats?.batting?.avg || '',
      });
    }
  }
  return out.sort((a, b) => (b.hits * 10 + b.hr * 4 + b.rbi * 2) - (a.hits * 10 + a.hr * 4 + a.rbi * 2));
}

function renderBatterCard(b) {
  return `
    <div class="batter-card">
      <div class="batter-card-name">${escapeHtml(b.name)}</div>
      <div class="batter-card-meta">${escapeHtml(b.team)} · ${escapeHtml(b.position)}</div>
      <div class="batter-card-stats">
        <div><span class="bs-num">${b.hits}</span><span class="bs-lbl">/${b.ab}</span></div>
        ${b.hr > 0 ? `<div><span class="bs-num gold">${b.hr}</span><span class="bs-lbl">HR</span></div>` : ''}
        ${b.rbi > 0 ? `<div><span class="bs-num">${b.rbi}</span><span class="bs-lbl">RBI</span></div>` : ''}
        ${b.r > 0 ? `<div><span class="bs-num">${b.r}</span><span class="bs-lbl">R</span></div>` : ''}
      </div>
    </div>
  `;
}

function teamColumn(team, score, teamId, isWinner) {
  const logo = teamId ? `https://www.mlbstatic.com/team-logos/${teamId}.svg` : null;
  return `
    <div class="game-hero-team ${isWinner ? 'winner' : ''}">
      ${logo
        ? `<img src="${logo}" alt="${escapeAttr(team.abbreviation || team.name || '')}" class="game-hero-logo" />`
        : `<div class="game-hero-logo-fallback">${escapeHtml((team.abbreviation || '?').slice(0, 3))}</div>`}
      <div class="game-hero-team-name">${escapeHtml(team.name || team.abbreviation || '—')}</div>
      <div class="game-hero-team-score">${score}</div>
    </div>
  `;
}

// ─── NBA Detail ──────────────────────────────────────────────────────────
async function renderNbaDetail(target, gameId) {
  const summary = await sports.nbaSummary(gameId).catch(() => null);
  if (!summary || !summary.header) {
    target.innerHTML = `<div class="games-empty"><h3>Game not found</h3></div>`;
    return;
  }

  const header = summary.header || {};
  const home = header.home || {};
  const away = header.away || {};
  const status = header.status || {};

  const isLive = status.state === 'in';
  const isFinal = status.state === 'post';

  // Hero
  const heroHtml = `
    <section class="game-hero">
      <div class="game-hero-row">
        <div class="game-hero-team ${away.winner ? 'winner' : ''}">
          ${away.logo ? `<img src="${away.logo}" alt="${escapeAttr(away.abbr)}" class="game-hero-logo" />` : ''}
          <div class="game-hero-team-name">${escapeHtml(away.name || away.abbr || '—')}</div>
          <div class="game-hero-team-record">${escapeHtml(away.record || '')}</div>
          <div class="game-hero-team-score">${away.score ?? ''}</div>
        </div>
        <div class="game-hero-mid">
          <div class="game-hero-status">${escapeHtml(status.detail || '—')}</div>
          <div class="game-hero-vs">vs</div>
          <div class="game-hero-meta">🏀 NBA</div>
        </div>
        <div class="game-hero-team ${home.winner ? 'winner' : ''}">
          ${home.logo ? `<img src="${home.logo}" alt="${escapeAttr(home.abbr)}" class="game-hero-logo" />` : ''}
          <div class="game-hero-team-name">${escapeHtml(home.name || home.abbr || '—')}</div>
          <div class="game-hero-team-record">${escapeHtml(home.record || '')}</div>
          <div class="game-hero-team-score">${home.score ?? ''}</div>
        </div>
      </div>
    </section>
  `;

  // Box score
  const teams = summary.boxscore?.players || [];
  const boxHtml = teams.length ? `
    <section class="game-section">
      <h2 class="game-section-title">Box Score</h2>
      <div class="nba-boxscore-wrap">
        ${teams.map((t) => renderNbaBoxTeam(t)).join('')}
      </div>
    </section>
  ` : '';

  // Recent plays
  const plays = (summary.plays || []).slice(-15).reverse();
  const playsHtml = plays.length ? `
    <section class="game-section">
      <h2 class="game-section-title">Recent Plays</h2>
      <ul class="plays-list">
        ${plays.map((p) => `
          <li class="play-item ${p.scoringPlay ? 'scoring' : ''}">
            <span class="play-inning">Q${p.period?.number || ''} ${p.clock?.displayValue || ''}</span>
            <span class="play-desc">${escapeHtml(p.text || '')}</span>
          </li>
        `).join('')}
      </ul>
    </section>
  ` : '';

  target.innerHTML = `
    ${heroHtml}
    ${boxHtml}
    ${playsHtml}
    ${propBetEdgeAngle('nba')}
  `;

  if (isLive) {
    setTimeout(() => renderNbaDetail(target, gameId), 30000);
  }
}

function renderNbaBoxTeam(t) {
  const team = t.team || {};
  const stats = t.statistics?.[0] || {};
  const labels = stats.labels || [];
  const athletes = (stats.athletes || []).slice(0, 8); // top 8 minutes

  const idxMin = labels.indexOf('MIN');
  const idxPts = labels.indexOf('PTS');
  const idxReb = labels.indexOf('REB');
  const idxAst = labels.indexOf('AST');

  return `
    <div class="nba-box-team">
      <div class="nba-box-team-head">
        ${team.logo ? `<img src="${team.logo}" alt="${escapeAttr(team.abbreviation || '')}" class="nba-box-team-logo" />` : ''}
        <div class="nba-box-team-name">${escapeHtml(team.displayName || team.abbreviation || '—')}</div>
      </div>
      <table class="nba-box-table">
        <thead>
          <tr><th>Player</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th></tr>
        </thead>
        <tbody>
          ${athletes.map((a) => {
            const stat = a.stats || [];
            return `
              <tr>
                <td class="nba-box-player">${escapeHtml(a.athlete?.shortName || a.athlete?.displayName || '—')}</td>
                <td>${idxMin >= 0 ? stat[idxMin] || '0' : '0'}</td>
                <td><strong>${idxPts >= 0 ? stat[idxPts] || '0' : '0'}</strong></td>
                <td>${idxReb >= 0 ? stat[idxReb] || '0' : '0'}</td>
                <td>${idxAst >= 0 ? stat[idxAst] || '0' : '0'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ─── Unsupported sport (NFL/NHL detail v2) ───────────────────────────────
function unsupportedDetail(sport) {
  const label = { nfl: 'NFL', nhl: 'NHL' }[sport] || sport.toUpperCase();
  return `
    <div class="games-empty">
      <h3>${label} game detail coming soon</h3>
      <p>Live ${label} scores are on the <a href="/games">scoreboard</a>. Detailed game pages launch with the full v2 release.</p>
    </div>
  `;
}

// ─── PropBetEdge angle (no picks given away) ─────────────────────────────
function propBetEdgeAngle(sport) {
  const sportLabel = { mlb: 'MLB', nba: 'NBA', nfl: 'NFL', nhl: 'NHL' }[sport] || '';
  return `
    <section class="pbe-angle">
      <div class="pbe-angle-icon">🎯</div>
      <div class="pbe-angle-body">
        <div class="pbe-angle-kicker">PropBetEdge Angle</div>
        <h3 class="pbe-angle-title">See what our model sees on this game</h3>
        <p class="pbe-angle-dek">
          Live scoreboards are free. The picks are paid.
          PropBetEdge runs ML-scored ${sportLabel} props every day — Statcast inputs,
          umpire grades, park factors, lineup K-rates, sharp line movement.
        </p>
        <div class="pbe-angle-ctas">
          <a href="https://mlb.propbetedge.ai" class="pbe-angle-cta primary">See today's picks →</a>
          <a href="https://propsports.proptechusa.ai" class="pbe-angle-cta">PropSports API →</a>
        </div>
      </div>
    </section>
  `;
}

// ─── Helpers ─────────────────────────────────────────────────────────────
function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escapeAttr(s) { return escapeHtml(s); }
