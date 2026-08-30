import '../styles/games-hub-worldclass.css';
import { sports } from '../api-sports.js';
import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { renderLeadersTeaserSlot, loadLeadersTeaser } from '../components/leaders-teaser.js';

const SPORT = {
  mlb: { label: 'MLB', emoji: '⚾', name: 'Baseball', product: 'https://mlb.propbetedge.ai', productLabel: 'MLB Intelligence' },
  nfl: { label: 'NFL', emoji: '🏈', name: 'Football', product: 'https://nfl.propbetedge.ai', productLabel: 'NFL Intelligence' },
  nba: { label: 'NBA', emoji: '🏀', name: 'Basketball', product: '/news/nba', productLabel: 'NBA Coverage' },
  nhl: { label: 'NHL', emoji: '🏒', name: 'Hockey', product: '/news/nhl', productLabel: 'NHL Coverage' },
};

let pollHandle = null;
let activeSport = 'all';
let activePhase = 'all';
let gameStore = [];
let lastUpdated = null;

export async function renderGamesHub(root) {
  stopPolling();
  activeSport = 'all';
  activePhase = 'all';
  gameStore = [];

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/New_York',
  });

  root.innerHTML = `
    ${renderHeader()}
    <main id="pbe-games-worldclass" class="pbe-games-worldclass">
      <section class="gh5-stage">
        <div class="gh5-stage-orb gh5-stage-orb-one"></div>
        <div class="gh5-stage-orb gh5-stage-orb-two"></div>
        <div class="container gh5-stage-inner">
          <div class="gh5-overline"><span class="gh5-live-pulse"></span> LIVE SPORTS COMMAND CENTER <span>·</span> ${escapeHtml(today)}</div>
          <div class="gh5-hero-grid">
            <div>
              <h1>Every game.<br><em>One intelligence layer.</em></h1>
              <p>Live scores and schedule context across MLB, NFL, NBA and NHL — connected directly to the deeper PropBetEdge sports network.</p>
              <div class="gh5-data-line">
                <span class="gh5-data-dot"></span>
                <span id="gh5-freshness">Loading live data…</span>
                <span>Powered by <strong>PropSports API</strong></span>
              </div>
            </div>
            <div id="gh5-scoreboard-summary" class="gh5-scoreboard-summary">${summarySkeleton()}</div>
          </div>
        </div>
      </section>

      <div class="container gh5-body">
        <section id="gh5-featured" class="gh5-featured">${featuredSkeleton()}</section>

        <section class="gh5-control-deck" aria-label="Game filters">
          <div id="gh5-sport-tabs" class="gh5-tabs gh5-sport-tabs">
            <button class="gh5-tab active" type="button" data-sport="all">All Sports <span data-count="all">0</span></button>
            ${Object.entries(SPORT).map(([key, meta]) => `<button class="gh5-tab" type="button" data-sport="${key}">${meta.emoji} ${meta.label} <span data-count="${key}">0</span></button>`).join('')}
          </div>
          <div id="gh5-phase-tabs" class="gh5-tabs gh5-phase-tabs">
            <button class="gh5-tab active" type="button" data-phase="all">All</button>
            <button class="gh5-tab" type="button" data-phase="live"><span class="gh5-live-pulse small"></span> Live</button>
            <button class="gh5-tab" type="button" data-phase="pre">Upcoming</button>
            <button class="gh5-tab" type="button" data-phase="final">Final</button>
          </div>
        </section>

        <section class="gh5-board-section">
          <div class="gh5-section-head">
            <div>
              <span class="gh5-section-kicker">SCOREBOARD</span>
              <h2 id="gh5-board-title">Today's Games</h2>
            </div>
            <div id="gh5-board-meta" class="gh5-board-meta">Loading…</div>
          </div>
          <div id="gh5-board" class="gh5-board">${boardSkeleton(6)}</div>
        </section>

        <section id="gh5-intelligence" class="gh5-intelligence"></section>

        <section id="gh5-leaders-wrap" class="gh5-leaders-wrap">
          ${renderLeadersTeaserSlot()}
        </section>

        <section class="gh5-network">
          <div class="gh5-network-head">
            <span class="gh5-section-kicker">GO DEEPER</span>
            <h2>The scoreboard is the surface.</h2>
            <p>Move from game state into sport-specific intelligence — or build on the same data infrastructure powering this page.</p>
          </div>
          <div class="gh5-network-grid">
            <a class="gh5-network-card mlb" href="https://mlb.propbetedge.ai" target="_blank" rel="noopener">
              <span>⚾ MLB · LIVE PRODUCT</span><strong>MLB Intelligence</strong><p>Player research, model analysis, live context and prop intelligence.</p><b>Open MLB →</b>
            </a>
            <a class="gh5-network-card nfl" href="https://nfl.propbetedge.ai" target="_blank" rel="noopener">
              <span>🏈 NFL · LIVE PRODUCT</span><strong>NFL Intelligence</strong><p>Model Lab, Market Watch, simulation, SGP research and football intelligence.</p><b>Open NFL →</b>
            </a>
            <a class="gh5-network-card api" href="https://propsports.proptechusa.ai" target="_blank" rel="noopener">
              <span>⚡ FOR BUILDERS</span><strong>PropSports API</strong><p>The multi-sport data infrastructure behind the live experience.</p><b>Explore the API →</b>
            </a>
          </div>
        </section>
      </div>
    </main>
    ${renderFooter()}
  `;

  wireControls();
  await refreshScoreboards({ initial: true });
  startPolling();
}

async function refreshScoreboards({ initial = false } = {}) {
  try {
    const data = await sports.allTodayScoreboards();
    if (!document.getElementById('pbe-games-worldclass')) return;

    gameStore = [
      ...normalizeMLB(data.mlb?.games || []),
      ...normalizeNFL(data.nfl?.games || []),
      ...normalizeNBA(data.nba?.games || []),
      ...normalizeNHL(data.nhl?.games || []),
    ].sort(sortGames);

    lastUpdated = new Date();
    renderAll({ initial });
  } catch (error) {
    console.error('[games-v5]', error);
    const board = document.getElementById('gh5-board');
    if (board && !gameStore.length) {
      board.innerHTML = `<div class="gh5-empty"><strong>Live scoreboard temporarily unavailable.</strong><span>The news and intelligence network is still online. Try again in a moment.</span></div>`;
    }
  }
}

function renderAll({ initial = false } = {}) {
  renderSummary();
  renderFeatured();
  renderCounts();
  renderBoard();
  renderIntelligence();
  renderFreshness();

  if (initial) loadLeadersTeaser(activeSport);
}

function wireControls() {
  document.querySelectorAll('[data-sport]').forEach((button) => {
    button.addEventListener('click', () => {
      activeSport = button.dataset.sport || 'all';
      document.querySelectorAll('[data-sport]').forEach((item) => item.classList.toggle('active', item === button));
      renderFeatured();
      renderBoard();
      renderIntelligence();
      loadLeadersTeaser(activeSport);
      trackFilter('sport', activeSport);
    });
  });

  document.querySelectorAll('[data-phase]').forEach((button) => {
    button.addEventListener('click', () => {
      activePhase = button.dataset.phase || 'all';
      document.querySelectorAll('[data-phase]').forEach((item) => item.classList.toggle('active', item === button));
      renderFeatured();
      renderBoard();
      trackFilter('phase', activePhase);
    });
  });
}

function renderSummary() {
  const target = document.getElementById('gh5-scoreboard-summary');
  if (!target) return;
  const live = gameStore.filter((game) => game.state === 'live').length;
  const upcoming = gameStore.filter((game) => game.state === 'pre').length;
  const final = gameStore.filter((game) => game.state === 'final').length;

  target.innerHTML = `
    <div class="gh5-summary-cell live"><span>LIVE NOW</span><strong>${live}</strong><small>${live === 1 ? 'game in progress' : 'games in progress'}</small></div>
    <div class="gh5-summary-cell"><span>UPCOMING</span><strong>${upcoming}</strong><small>still on today's board</small></div>
    <div class="gh5-summary-cell"><span>FINAL</span><strong>${final}</strong><small>completed today</small></div>
    <div class="gh5-summary-cell"><span>TOTAL</span><strong>${gameStore.length}</strong><small>across four leagues</small></div>
  `;
}

function renderCounts() {
  const allCount = document.querySelector('[data-count="all"]');
  if (allCount) allCount.textContent = String(gameStore.length);
  Object.keys(SPORT).forEach((sport) => {
    const node = document.querySelector(`[data-count="${sport}"]`);
    if (node) node.textContent = String(gameStore.filter((game) => game.sport === sport).length);
  });
}

function renderFeatured() {
  const target = document.getElementById('gh5-featured');
  if (!target) return;

  const pool = getFilteredGames({ ignorePhaseIfEmpty: true });
  const game = pickFeatured(pool);
  if (!game) {
    target.innerHTML = `<div class="gh5-featured-empty"><span class="gh5-section-kicker">FEATURED MATCHUP</span><strong>No matchup on the selected board yet.</strong><p>Switch leagues or check the latest sport coverage while the next slate populates.</p></div>`;
    return;
  }

  const meta = SPORT[game.sport];
  const gameHref = game.detailUrl || meta.product;
  const external = /^https?:\/\//.test(gameHref);
  const statusClass = game.state === 'live' ? 'live' : game.state;

  target.innerHTML = `
    <div class="gh5-featured-shell sport-${game.sport}">
      <div class="gh5-featured-copy">
        <div class="gh5-featured-topline">
          <span class="gh5-section-kicker">FEATURED MATCHUP</span>
          <span class="gh5-featured-status ${statusClass}">${game.state === 'live' ? '<i></i>' : ''}${escapeHtml(game.statusText)}</span>
        </div>
        <div class="gh5-featured-league">${meta.emoji} ${meta.label} · ${meta.name}</div>
        <h2>${escapeHtml(game.away.name || game.away.abbr)} <em>at</em> ${escapeHtml(game.home.name || game.home.abbr)}</h2>
        ${game.context ? `<p class="gh5-featured-context">${escapeHtml(game.context)}</p>` : '<p class="gh5-featured-context">Live game state connected to the PropBetEdge sports intelligence network.</p>'}
        <div class="gh5-featured-actions">
          <a href="${escapeAttr(gameHref)}" class="gh5-primary-cta"${external ? ' target="_blank" rel="noopener"' : ''}>${game.detailUrl ? 'Open Game Center' : `Open ${meta.productLabel}`} →</a>
          <a href="/news/${game.sport}" class="gh5-secondary-cta">Latest ${meta.label} News</a>
        </div>
      </div>
      <div class="gh5-featured-matchup">
        ${featuredTeam(game.away, game, 'away')}
        <div class="gh5-featured-middle">
          <span>${game.state === 'pre' ? 'VS' : game.statusText}</span>
          ${game.state === 'pre' ? `<strong>${formatGameTime(game.gameDate)}</strong>` : ''}
        </div>
        ${featuredTeam(game.home, game, 'home')}
      </div>
    </div>
  `;
}

function featuredTeam(team, game, side) {
  const showScore = game.state !== 'pre';
  const winner = game.state === 'final' && Number(team.score) > Number(side === 'home' ? game.away.score : game.home.score);
  return `
    <div class="gh5-featured-team ${winner ? 'winner' : ''}">
      ${logoMarkup(team, 'gh5-featured-logo')}
      <span>${escapeHtml(team.abbr || '')}</span>
      <strong>${escapeHtml(team.name || team.abbr || '—')}</strong>
      ${team.record ? `<small>${escapeHtml(team.record)}</small>` : ''}
      ${showScore ? `<b>${escapeHtml(String(team.score ?? ''))}</b>` : ''}
    </div>
  `;
}

function renderBoard() {
  const target = document.getElementById('gh5-board');
  const title = document.getElementById('gh5-board-title');
  const meta = document.getElementById('gh5-board-meta');
  if (!target) return;

  const filtered = getFilteredGames();
  const sportName = activeSport === 'all' ? 'Today\'s Games' : `${SPORT[activeSport].label} Games`;
  const phaseLabel = activePhase === 'all' ? '' : ` · ${phaseName(activePhase)}`;
  if (title) title.textContent = `${sportName}${phaseLabel}`;
  if (meta) meta.textContent = `${filtered.length} ${filtered.length === 1 ? 'matchup' : 'matchups'} · Eastern Time`;

  if (!filtered.length) {
    target.innerHTML = `
      <div class="gh5-empty">
        <strong>No ${activeSport === 'all' ? '' : SPORT[activeSport].label + ' '}games match this filter.</strong>
        <span>Try another status or league. The page refreshes automatically as game states change.</span>
      </div>
    `;
    return;
  }

  const groups = [
    ['live', 'Live Now'],
    ['pre', 'Upcoming'],
    ['final', 'Final'],
  ];

  target.innerHTML = groups.map(([state, label]) => {
    const games = filtered.filter((game) => game.state === state);
    if (!games.length) return '';
    return `
      <div class="gh5-game-group ${state}">
        <div class="gh5-game-group-head"><span>${state === 'live' ? '<i class="gh5-live-pulse small"></i>' : ''}${label}</span><b>${games.length}</b></div>
        <div class="gh5-game-grid">${games.map(renderGameCard).join('')}</div>
      </div>
    `;
  }).join('');
}

function renderGameCard(game) {
  const meta = SPORT[game.sport];
  const homeWins = game.state === 'final' && Number(game.home.score) > Number(game.away.score);
  const awayWins = game.state === 'final' && Number(game.away.score) > Number(game.home.score);
  const href = game.detailUrl || `/news/${game.sport}`;

  return `
    <a class="gh5-game-card sport-${game.sport} ${game.state}" href="${escapeAttr(href)}">
      <div class="gh5-card-top">
        <span>${meta.emoji} ${meta.label}</span>
        <b class="${game.state === 'live' ? 'live' : ''}">${game.state === 'live' ? '<i></i>' : ''}${escapeHtml(game.statusText)}</b>
      </div>
      <div class="gh5-card-teams">
        ${cardTeam(game.away, awayWins, game.state)}
        ${cardTeam(game.home, homeWins, game.state)}
      </div>
      ${game.context ? `<div class="gh5-card-context">${escapeHtml(game.context)}</div>` : ''}
      <div class="gh5-card-footer"><span>${game.detailUrl ? 'Game Center' : `${meta.label} Coverage`}</span><b>Open →</b></div>
    </a>
  `;
}

function cardTeam(team, winner, state) {
  return `
    <div class="gh5-card-team ${winner ? 'winner' : ''}">
      ${logoMarkup(team, 'gh5-card-logo')}
      <div><strong>${escapeHtml(team.name || team.abbr || '—')}</strong>${team.record ? `<small>${escapeHtml(team.record)}</small>` : ''}</div>
      <b>${state === 'pre' ? '' : escapeHtml(String(team.score ?? ''))}</b>
    </div>
  `;
}

function renderIntelligence() {
  const target = document.getElementById('gh5-intelligence');
  if (!target) return;
  const sport = activeSport === 'all' ? null : activeSport;

  if (!sport) {
    target.innerHTML = `
      <div class="gh5-intel-copy"><span class="gh5-section-kicker">INTELLIGENCE LAYER</span><h2>Follow the game. Then understand what moves next.</h2><p>The live board connects into sport-specific research, news impact and model products across the PropBetEdge network.</p></div>
      <div class="gh5-intel-actions"><a href="https://mlb.propbetedge.ai" target="_blank" rel="noopener">⚾ MLB Intelligence →</a><a href="https://nfl.propbetedge.ai" target="_blank" rel="noopener">🏈 NFL Intelligence →</a></div>
    `;
    return;
  }

  const meta = SPORT[sport];
  const external = /^https?:\/\//.test(meta.product);
  target.innerHTML = `
    <div class="gh5-intel-copy"><span class="gh5-section-kicker">${meta.emoji} ${meta.label} INTELLIGENCE</span><h2>The game state is only the beginning.</h2><p>Move directly from today's ${meta.name.toLowerCase()} slate into the deeper PropBetEdge research and coverage layer.</p></div>
    <div class="gh5-intel-actions"><a href="${meta.product}"${external ? ' target="_blank" rel="noopener"' : ''}>Open ${meta.productLabel} →</a><a href="/news/${sport}">Latest ${meta.label} News →</a></div>
  `;
}

function renderFreshness() {
  const node = document.getElementById('gh5-freshness');
  if (!node || !lastUpdated) return;
  node.textContent = `Auto-refresh 30s · Updated ${lastUpdated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', timeZone: 'America/New_York' })} ET`;
}

function getFilteredGames({ ignorePhaseIfEmpty = false } = {}) {
  let games = activeSport === 'all' ? [...gameStore] : gameStore.filter((game) => game.sport === activeSport);
  if (activePhase !== 'all') {
    const phased = games.filter((game) => game.state === activePhase);
    if (phased.length || !ignorePhaseIfEmpty) games = phased;
  }
  return games;
}

function pickFeatured(games) {
  if (!games.length) return null;
  const live = games.filter((game) => game.state === 'live').sort(sortGames);
  if (live.length) return live[0];
  const upcoming = games.filter((game) => game.state === 'pre').sort(sortGames);
  if (upcoming.length) return upcoming[0];
  return games.filter((game) => game.state === 'final').sort((a, b) => new Date(b.gameDate || 0) - new Date(a.gameDate || 0))[0] || games[0];
}

function sortGames(a, b) {
  const order = { live: 0, pre: 1, final: 2 };
  const stateDiff = (order[a.state] ?? 9) - (order[b.state] ?? 9);
  if (stateDiff) return stateDiff;
  return new Date(a.gameDate || 0) - new Date(b.gameDate || 0);
}

function normalizeMLB(games) {
  return games.map((game) => {
    const status = game.status?.abstractGameState || game.status?.detailedState || '';
    const state = status === 'Live' || status === 'In Progress' ? 'live' : status === 'Final' || status === 'Game Over' ? 'final' : 'pre';
    const linescore = game.linescore || {};
    const awayPitcher = game.teams?.away?.probablePitcher?.fullName;
    const homePitcher = game.teams?.home?.probablePitcher?.fullName;
    return {
      sport: 'mlb', gameId: game.gamePk, state, gameDate: game.gameDate,
      statusText: state === 'live' ? `${linescore.inningHalf || 'Live'} ${linescore.currentInningOrdinal || ''}`.trim() : state === 'final' ? 'Final' : formatGameTime(game.gameDate),
      away: mlbTeam(game.teams?.away), home: mlbTeam(game.teams?.home),
      detailUrl: `/games/mlb/${game.gamePk}`,
      context: awayPitcher || homePitcher ? `${awayPitcher || 'TBD'} vs ${homePitcher || 'TBD'} · probable starters` : '',
    };
  });
}

function mlbTeam(side) {
  const team = side?.team || {};
  return {
    name: team.name || '',
    abbr: team.abbreviation || shortAbbr(team.name),
    logo: team.id ? `https://www.mlbstatic.com/team-logos/${team.id}.svg` : null,
    score: side?.score ?? '',
    record: side?.leagueRecord ? `${side.leagueRecord.wins}-${side.leagueRecord.losses}` : '',
  };
}

function normalizeNBA(games) {
  return games.map((game) => {
    const state = game.statusState === 'in' ? 'live' : game.statusState === 'post' ? 'final' : 'pre';
    return {
      sport: 'nba', gameId: game.id, state, gameDate: game.date,
      statusText: state === 'live' ? `Q${game.period || ''} ${game.clock || ''}`.trim() : state === 'final' ? 'Final' : game.statusDetail || formatGameTime(game.date),
      away: { name: game.away || '', abbr: game.awayAbbr || shortAbbr(game.away), logo: game.awayLogo || null, score: game.awayScore ?? '', record: '' },
      home: { name: game.home || '', abbr: game.homeAbbr || shortAbbr(game.home), logo: game.homeLogo || null, score: game.homeScore ?? '', record: '' },
      detailUrl: `/games/nba/${game.id}`,
      context: game.statusDetail && state !== 'pre' ? game.statusDetail : '',
    };
  });
}

function normalizeNFL(games) {
  return games.map((game) => {
    const state = game.statusState === 'in' ? 'live' : game.statusState === 'post' ? 'final' : 'pre';
    return {
      sport: 'nfl', gameId: game.id, state, gameDate: game.date,
      statusText: state === 'live' ? game.statusDetail || `${game.clock || ''} Q${game.period || ''}`.trim() || 'Live' : state === 'final' ? game.statusDetail || 'Final' : game.statusDetail || formatGameTime(game.date),
      away: { name: game.away || '', abbr: game.awayAbbr || shortAbbr(game.away), logo: game.awayLogo || null, score: game.awayScore ?? '', record: game.awayRecord || '' },
      home: { name: game.home || '', abbr: game.homeAbbr || shortAbbr(game.home), logo: game.homeLogo || null, score: game.homeScore ?? '', record: game.homeRecord || '' },
      detailUrl: null,
      context: state === 'pre' ? '2026 NFL schedule · follow roster and market movement in NFL Intelligence' : game.statusDetail || '',
    };
  });
}

function normalizeNHL(games) {
  return games.map((game) => {
    const state = ['LIVE', 'CRIT'].includes(game.status) ? 'live' : ['OFF', 'FINAL'].includes(game.status) ? 'final' : 'pre';
    return {
      sport: 'nhl', gameId: game.id, state, gameDate: game.date,
      statusText: state === 'live' ? 'Live' : state === 'final' ? 'Final' : formatGameTime(game.date),
      away: { name: game.away || '', abbr: game.awayAbbr || shortAbbr(game.away), logo: game.awayLogo || null, score: game.awayScore ?? '', record: '' },
      home: { name: game.home || '', abbr: game.homeAbbr || shortAbbr(game.home), logo: game.homeLogo || null, score: game.homeScore ?? '', record: '' },
      detailUrl: null,
      context: game.venue ? `${game.venue}` : '',
    };
  });
}

function logoMarkup(team, className) {
  if (team.logo) return `<img src="${escapeAttr(team.logo)}" alt="${escapeAttr(team.abbr || team.name || '')}" class="${className}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'" /><span class="${className}-fallback" style="display:none">${escapeHtml((team.abbr || '?').slice(0,3))}</span>`;
  return `<span class="${className}-fallback">${escapeHtml((team.abbr || '?').slice(0,3))}</span>`;
}

function phaseName(phase) {
  return phase === 'live' ? 'Live Now' : phase === 'pre' ? 'Upcoming' : phase === 'final' ? 'Final' : 'All';
}

function shortAbbr(name) {
  if (!name) return '';
  const parts = String(name).trim().split(/\s+/);
  return parts[parts.length - 1].slice(0, 3).toUpperCase();
}

function formatGameTime(value) {
  if (!value) return 'TBD';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'TBD';
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) + ' ET';
}

function startPolling() {
  pollHandle = window.setInterval(() => {
    if (!document.getElementById('pbe-games-worldclass')) return stopPolling();
    refreshScoreboards();
  }, 30000);
}

function stopPolling() {
  if (pollHandle) {
    clearInterval(pollHandle);
    pollHandle = null;
  }
}

function trackFilter(type, value) {
  if (typeof window.gtag !== 'function') return;
  window.gtag('event', 'games_filter', { filter_type: type, filter_value: value });
}

function summarySkeleton() {
  return Array.from({ length: 4 }, () => '<div class="gh5-summary-cell skeleton"><span></span><strong></strong><small></small></div>').join('');
}

function featuredSkeleton() {
  return '<div class="gh5-featured-shell skeleton"><div></div><div></div></div>';
}

function boardSkeleton(count) {
  return `<div class="gh5-game-group"><div class="gh5-game-grid">${Array.from({ length: count }, () => '<div class="gh5-game-card skeleton"></div>').join('')}</div></div>`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char]);
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
