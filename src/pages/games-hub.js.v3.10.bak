/**
 * src/pages/games-hub.js — /games
 * Multi-sport live scoreboard, free public layer.
 *
 * Powered by PropSports API (propsports.proptechusa.ai)
 *
 * Layout:
 *   ┌─────────────────────────────────────────────────────┐
 *   │ Hero strip — LIVE NOW count, today's date           │
 *   ├─────────────────────────────────────────────────────┤
 *   │ Sport tabs — All · MLB · NBA · NHL · NFL            │
 *   ├─────────────────────────────────────────────────────┤
 *   │ Live games (red dot, "in progress")                 │
 *   ├─────────────────────────────────────────────────────┤
 *   │ Final games (today's results)                       │
 *   ├─────────────────────────────────────────────────────┤
 *   │ Upcoming games (scheduled, time)                    │
 *   ├─────────────────────────────────────────────────────┤
 *   │ "PropBetEdge Storylines" tease — links to picks     │
 *   └─────────────────────────────────────────────────────┘
 */

import { sports } from '../api-sports.js';
import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';

export async function renderGamesHub(root) {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  root.innerHTML = `
    ${renderHeader()}
    <main>
      <div class="container">

        <!-- Hero -->
        <section class="games-hero">
          <div class="games-hero-mesh"></div>
          <div class="games-hero-inner">
            <div class="games-hero-kicker">
              <span class="live-dot-big"></span>
              <span>LIVE GAMES · ${today}</span>
            </div>
            <h1 class="games-hero-title">Today's Action</h1>
            <p class="games-hero-dek">
              MLB · NBA · NHL · NFL — every score, every game, every night.
              Powered by <strong style="color:var(--gold)">PropSports API</strong>.
            </p>
            <div id="games-hero-counts" class="games-hero-counts"></div>
          </div>
        </section>

        <!-- Sport tabs -->
        <div class="games-tabs">
          <button class="games-tab active" data-sport="all">All Sports</button>
          <button class="games-tab" data-sport="mlb">⚾ MLB</button>
          <button class="games-tab" data-sport="nba">🏀 NBA</button>
          <button class="games-tab" data-sport="nhl">🏒 NHL</button>
          <button class="games-tab" data-sport="nfl">🏈 NFL</button>
        </div>

        <!-- Live + Final + Upcoming -->
        <div id="games-content" class="games-content">
          <div class="games-loading">
            <div class="games-loading-dot"></div>
            <div class="games-loading-dot"></div>
            <div class="games-loading-dot"></div>
          </div>
        </div>

        <!-- PropBetEdge angle / API plug -->
        <section class="games-edge-strip">
          <div class="games-edge-grid">
            <div class="games-edge-cell">
              <div class="games-edge-icon">🎯</div>
              <div class="games-edge-title">PropBetEdge Picks</div>
              <div class="games-edge-dek">Daily AI-scored prop picks across MLB, NBA, NHL, NFL.</div>
              <a href="https://mlb.propbetedge.ai" class="games-edge-cta">See picks →</a>
            </div>
            <div class="games-edge-cell">
              <div class="games-edge-icon">📡</div>
              <div class="games-edge-title">PropSports API</div>
              <div class="games-edge-dek">47 endpoints. 4 sports. Live scoreboards, box scores, Statcast, model odds. Free demo key.</div>
              <a href="https://propsports.proptechusa.ai" class="games-edge-cta">API docs →</a>
            </div>
            <div class="games-edge-cell">
              <div class="games-edge-icon">🔒</div>
              <div class="games-edge-title">Free MLB for life</div>
              <div class="games-edge-dek">Subscribe before May 15 to lock in MLB picks free forever. After: $29/mo.</div>
              <a href="https://mlb.propbetedge.ai" class="games-edge-cta">Subscribe →</a>
            </div>
          </div>
        </section>
      </div>
    </main>
    ${renderFooter()}
  `;

  // Fetch all 4 sports in parallel
  const data = await sports.allTodayScoreboards().catch((e) => {
    console.error('[games-hub]', e);
    return { mlb: { games: [] }, nba: { games: [] }, nhl: { games: [] }, nfl: { games: [] } };
  });

  // Normalize each sport's games into a common format
  const all = [
    ...normalizeMLB(data.mlb.games || []),
    ...normalizeNBA(data.nba.games || []),
    ...normalizeNHL(data.nhl.games || []),
    ...normalizeNFL(data.nfl.games || []),
  ];

  // Render hero counts
  const live = all.filter((g) => g.state === 'live');
  const final = all.filter((g) => g.state === 'final');
  const upcoming = all.filter((g) => g.state === 'pre');

  document.getElementById('games-hero-counts').innerHTML = `
    <div class="games-hero-stat">
      <div class="games-hero-stat-num live">${live.length}</div>
      <div class="games-hero-stat-lbl">Live Now</div>
    </div>
    <div class="games-hero-stat">
      <div class="games-hero-stat-num">${upcoming.length}</div>
      <div class="games-hero-stat-lbl">Upcoming</div>
    </div>
    <div class="games-hero-stat">
      <div class="games-hero-stat-num">${final.length}</div>
      <div class="games-hero-stat-lbl">Final</div>
    </div>
    <div class="games-hero-stat">
      <div class="games-hero-stat-num">${all.length}</div>
      <div class="games-hero-stat-lbl">Total Games</div>
    </div>
  `;

  // Render the games content
  renderGamesList(all, 'all');

  // Wire up tabs
  document.querySelectorAll('.games-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.games-tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const sport = btn.dataset.sport;
      renderGamesList(all, sport);
    });
  });

  // Auto-refresh live games every 30s
  if (live.length > 0) {
    setInterval(async () => {
      try {
        const fresh = await sports.allTodayScoreboards();
        const freshAll = [
          ...normalizeMLB(fresh.mlb.games || []),
          ...normalizeNBA(fresh.nba.games || []),
          ...normalizeNHL(fresh.nhl.games || []),
          ...normalizeNFL(fresh.nfl.games || []),
        ];
        const activeTab = document.querySelector('.games-tab.active')?.dataset.sport || 'all';
        renderGamesList(freshAll, activeTab);
      } catch (e) {
        // silent — just retry next cycle
      }
    }, 30000);
  }
}

// ─── Normalizers ──────────────────────────────────────────────────────────
// Each sport's API returns different shapes — normalize to a common interface.

function normalizeMLB(games) {
  return games.map((g) => {
    const status = g.status?.abstractGameState || g.status?.detailedState || '';
    const state = status === 'Live' || status === 'In Progress' ? 'live'
                : status === 'Final' || status === 'Game Over' ? 'final'
                : 'pre';
    const ls = g.linescore || {};
    return {
      sport: 'mlb',
      sportLabel: '⚾ MLB',
      gameId: g.gamePk,
      state,
      statusText: state === 'live'
        ? `${ls.inningHalf || 'Live'} ${ls.currentInningOrdinal || ''}`
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
    };
  });
}

function normalizeNBA(games) {
  return games.map((g) => {
    const stateRaw = g.statusState || '';
    const state = stateRaw === 'in' ? 'live' : stateRaw === 'post' ? 'final' : 'pre';
    return {
      sport: 'nba',
      sportLabel: '🏀 NBA',
      gameId: g.id,
      state,
      statusText: state === 'live' ? `Q${g.period || ''} ${g.clock || ''}`.trim()
                : state === 'final' ? 'Final'
                : g.statusDetail || formatTime(g.date),
      home: {
        name: g.home,
        abbr: g.homeAbbr,
        logo: g.homeLogo,
        score: g.homeScore ?? '',
        record: '',
      },
      away: {
        name: g.away,
        abbr: g.awayAbbr,
        logo: g.awayLogo,
        score: g.awayScore ?? '',
        record: '',
      },
      detailUrl: `/games/nba/${g.id}`,
      gameDate: g.date,
    };
  });
}

function normalizeNHL(games) {
  return games.map((g) => {
    const state = ['LIVE', 'CRIT'].includes(g.status) ? 'live'
                : ['OFF', 'FINAL'].includes(g.status) ? 'final'
                : 'pre';
    return {
      sport: 'nhl',
      sportLabel: '🏒 NHL',
      gameId: g.id,
      state,
      statusText: state === 'live' ? 'Live'
                : state === 'final' ? 'Final'
                : formatTime(g.date),
      home: {
        name: g.home,
        abbr: teamAbbr(g.home),
        logo: null,
        score: g.homeScore ?? '',
        record: '',
      },
      away: {
        name: g.away,
        abbr: teamAbbr(g.away),
        logo: null,
        score: g.awayScore ?? '',
        record: '',
      },
      detailUrl: null, // NHL detail is v2
      gameDate: g.date,
    };
  });
}

function normalizeNFL(games) {
  return games.map((g) => {
    const status = (g.status || '').toLowerCase();
    const state = status.includes('in progress') ? 'live'
                : status.includes('final') ? 'final'
                : 'pre';
    return {
      sport: 'nfl',
      sportLabel: '🏈 NFL',
      gameId: g.id,
      state,
      statusText: state === 'live' ? 'Live'
                : state === 'final' ? 'Final'
                : formatTime(g.date),
      home: {
        name: g.home,
        abbr: teamAbbr(g.home),
        logo: null,
        score: g.homeScore ?? '',
        record: '',
      },
      away: {
        name: g.away,
        abbr: teamAbbr(g.away),
        logo: null,
        score: g.awayScore ?? '',
        record: '',
      },
      detailUrl: null, // NFL detail is v2
      gameDate: g.date,
    };
  });
}

function teamAbbr(name) {
  if (!name) return '';
  const parts = name.split(' ');
  return parts[parts.length - 1].slice(0, 3).toUpperCase();
}

function formatTime(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
    }) + ' ET';
  } catch {
    return '—';
  }
}

// ─── Renderers ────────────────────────────────────────────────────────────
function renderGamesList(all, sportFilter) {
  const filtered = sportFilter === 'all' ? all : all.filter((g) => g.sport === sportFilter);
  const live = filtered.filter((g) => g.state === 'live');
  const upcoming = filtered.filter((g) => g.state === 'pre');
  const final = filtered.filter((g) => g.state === 'final');

  const target = document.getElementById('games-content');
  if (!target) return;

  if (filtered.length === 0) {
    target.innerHTML = `
      <div class="games-empty">
        <h3>No games today</h3>
        <p>Check back tomorrow — schedule resets at midnight ET.</p>
      </div>
    `;
    return;
  }

  target.innerHTML = `
    ${live.length ? `
      <section class="games-section">
        <div class="games-section-head">
          <h2><span class="live-dot-big"></span> Live Now <span class="games-count">${live.length}</span></h2>
        </div>
        <div class="games-grid">
          ${live.map(renderGameCard).join('')}
        </div>
      </section>
    ` : ''}

    ${upcoming.length ? `
      <section class="games-section">
        <div class="games-section-head">
          <h2>⏰ Upcoming <span class="games-count">${upcoming.length}</span></h2>
        </div>
        <div class="games-grid">
          ${upcoming.map(renderGameCard).join('')}
        </div>
      </section>
    ` : ''}

    ${final.length ? `
      <section class="games-section">
        <div class="games-section-head">
          <h2>✓ Final <span class="games-count">${final.length}</span></h2>
        </div>
        <div class="games-grid">
          ${final.map(renderGameCard).join('')}
        </div>
      </section>
    ` : ''}
  `;
}

function renderGameCard(g) {
  const isLive = g.state === 'live';
  const isFinal = g.state === 'final';
  const clickable = !!g.detailUrl;
  const tag = clickable ? 'a' : 'div';
  const href = clickable ? `href="${g.detailUrl}"` : '';

  const teamRow = (team, isWinner) => `
    <div class="game-team ${isWinner ? 'winner' : ''}">
      ${team.logo
        ? `<img src="${team.logo}" alt="${team.abbr || ''}" class="game-team-logo" loading="lazy" onerror="this.style.display='none'" />`
        : `<div class="game-team-logo-fallback">${(team.abbr || '?').slice(0, 3)}</div>`}
      <div class="game-team-meta">
        <div class="game-team-name">${team.name || team.abbr || '—'}</div>
        ${team.record ? `<div class="game-team-record">${team.record}</div>` : ''}
      </div>
      <div class="game-team-score">${team.score !== '' ? team.score : ''}</div>
    </div>
  `;

  const homeWins = isFinal && parseInt(g.home.score) > parseInt(g.away.score);
  const awayWins = isFinal && parseInt(g.away.score) > parseInt(g.home.score);

  return `
    <${tag} ${href} class="game-card ${isLive ? 'live' : ''} ${isFinal ? 'final' : ''}">
      <div class="game-card-head">
        <span class="game-sport-tag">${g.sportLabel}</span>
        <span class="game-status ${isLive ? 'live' : ''}">
          ${isLive ? '<span class="live-dot"></span>' : ''}
          ${g.statusText}
        </span>
      </div>
      <div class="game-teams">
        ${teamRow(g.away, awayWins)}
        ${teamRow(g.home, homeWins)}
      </div>
      ${g.pitchers ? `<div class="game-card-foot">⚾ ${g.pitchers}</div>` : ''}
      ${clickable ? '<div class="game-card-cta">View Game →</div>' : ''}
    </${tag}>
  `;
}
