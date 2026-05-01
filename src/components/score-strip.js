/**
 * src/components/score-strip.js
 * ESPN-elite score strip — v3.3
 *
 * v3.3 changes:
 *   - TEAM LOGOS rendered beside team names (ESPN bottom-line pattern)
 *   - Strip taller: 80px mobile, 70px desktop (was 64/56) for proper breathing room
 *   - Scroll direction REVERSED — content moves left-to-right naturally
 *     (appears on right, departs on left, matches reading flow)
 *   - ADAPTIVE polling — 15s when live games present, 60s when none live
 *   - Score-change FLASH — tiles briefly highlight gold when their data updates
 *   - Logo fallback letters when image fails to load
 *   - More tile breathing room (4 rows + logos need it)
 *
 * v3.2: High contrast, date filter for relevance
 * v3.1: Wider tiles, overflow control
 * v3:   Tiered detail, faster mobile scroll, ESPN bottom-line foundation
 */

const REFRESH_LIVE_MS = 15_000; // 15s when live games present
const REFRESH_IDLE_MS = 60_000; // 60s when nothing live

const UPCOMING_WINDOW_MS = 36 * 60 * 60 * 1000;
const RECENT_FINAL_WINDOW_MS = 6 * 60 * 60 * 1000;

const SPORT_TARGETS = {
  mlb: { label: 'Picks live',  live: true,  base: null },
  nfl: { label: 'Free access', live: false, base: 'https://nfl.propbetedge.ai' },
  nba: { label: 'Free access', live: false, base: 'https://nba.propbetedge.ai' },
  nhl: { label: 'Free access', live: false, base: 'https://nhl.propbetedge.ai' },
};

const SPORT_ACCENTS = {
  mlb: '#ef4444',
  nfl: '#a78bfa',
  nba: '#fb923c',
  nhl: '#22d3ee',
};

const SPORT_BADGE = {
  mlb: 'MLB',
  nfl: 'NFL',
  nba: 'NBA',
  nhl: 'NHL',
};

const SPORT_ORDER = ['mlb', 'nba', 'nhl', 'nfl'];

const HIDDEN_SPORTS = new Set();

let _activeFilter = 'all';
let _games = [];
let _gameSnapshot = new Map(); // gameId → JSON.stringify(g) for change detection
let _refreshTimer = null;

/* ─────────────────────────────────────────────────────────────────────────
 * STYLES
 * ────────────────────────────────────────────────────────────────────────*/
function injectStyles() {
  if (document.getElementById('pbe-score-strip-styles')) return;
  const s = document.createElement('style');
  s.id = 'pbe-score-strip-styles';
  s.textContent = `
    /* Mobile baseline — 80px tall for proper breathing room */
    #pbe-score-strip {
      position: sticky;
      top: 0;
      z-index: 100;
      height: 80px;
      background: linear-gradient(180deg, #0a0f1a 0%, #0f1626 100%);
      border-bottom: 1px solid rgba(255, 210, 74, 0.18);
      box-shadow: 0 2px 14px rgba(0, 0, 0, 0.35);
      display: flex;
      align-items: stretch;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      color: #f8fafc;
      overflow: hidden;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
      font-feature-settings: "tnum" 1, "liga" 0;
      contain: layout style;
    }

    /* Filter chips */
    .pss-filter {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      padding: 0 6px;
      gap: 2px;
      border-right: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(0, 0, 0, 0.35);
    }
    .pss-filter-btn {
      background: transparent;
      border: 1px solid rgba(203, 213, 225, 0.2);
      color: #cbd5e1;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      padding: 4px 6px;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.15s ease;
      font-family: inherit;
      -webkit-tap-highlight-color: transparent;
      flex-shrink: 0;
    }
    .pss-filter-btn:hover {
      color: #ffffff;
      border-color: rgba(255, 255, 255, 0.4);
    }
    .pss-filter-btn.active {
      background: rgba(255, 210, 74, 0.18);
      border-color: rgba(255, 210, 74, 0.5);
      color: #ffd24a;
    }

    /* Date stamp */
    .pss-date {
      display: none;
      flex-shrink: 0;
      align-items: center;
      padding: 0 12px;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.06em;
      color: #cbd5e1;
      text-transform: uppercase;
      border-right: 1px solid rgba(255, 255, 255, 0.06);
      white-space: nowrap;
    }
    .pss-date .pss-live-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #ef4444;
      margin-right: 6px;
      animation: pss-pulse 1.6s ease-in-out infinite;
    }
    @keyframes pss-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.55; }
    }

    /* Rail wrap */
    .pss-rail-wrap {
      flex: 1;
      overflow-x: auto;
      overflow-y: hidden;
      scroll-behavior: smooth;
      scrollbar-width: none;
      -ms-overflow-style: none;
      -webkit-overflow-scrolling: touch;
      position: relative;
    }
    .pss-rail-wrap::-webkit-scrollbar { display: none; }
    .pss-rail {
      display: flex;
      align-items: stretch;
      height: 100%;
    }

    /* Marquee — REVERSED direction (left to right) */
    .pss-rail.pss-marquee-on {
      animation: pss-marquee 30s linear infinite;
      width: max-content;
    }
    .pss-rail-wrap:hover .pss-rail.pss-marquee-on,
    .pss-rail-wrap:focus-within .pss-rail.pss-marquee-on,
    .pss-rail-wrap:active .pss-rail.pss-marquee-on {
      animation-play-state: paused;
    }
    @keyframes pss-marquee {
      from { transform: translateX(-50%); }
      to   { transform: translateX(0); }
    }
    @media (prefers-reduced-motion: reduce) {
      .pss-rail.pss-marquee-on { animation: none; }
    }

    /* === TILE === */
    .pss-tile {
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 2px;
      padding: 8px 14px;
      height: 100%;
      border-right: 1px solid rgba(255, 255, 255, 0.06);
      text-decoration: none;
      color: inherit;
      transition: background 0.15s ease;
      cursor: pointer;
      position: relative;
      width: 250px;
      min-width: 250px;
      max-width: 250px;
      box-sizing: border-box;
      overflow: hidden;
    }
    .pss-tile:hover { background: rgba(255, 255, 255, 0.05); }

    /* Score-change flash */
    .pss-tile.pss-tile-updated {
      animation: pss-tile-flash 1.6s ease-out;
    }
    @keyframes pss-tile-flash {
      0%   { background: rgba(255, 210, 74, 0.18); }
      40%  { background: rgba(255, 210, 74, 0.08); }
      100% { background: transparent; }
    }

    .pss-tile-accent {
      position: absolute;
      top: 0; left: 0;
      width: 3px;
      height: 100%;
    }

    /* Sport badge — top-right */
    .pss-sport-tag {
      position: absolute;
      top: 6px;
      right: 8px;
      font-size: 8px;
      font-weight: 800;
      letter-spacing: 0.08em;
      color: #94a3b8;
      font-variant-numeric: tabular-nums;
      pointer-events: none;
    }

    /* Status pill INLINE */
    .pss-status-inline {
      font-size: 8.5px;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      padding: 1px 5px;
      border-radius: 3px;
      white-space: nowrap;
      flex-shrink: 0;
      font-variant-numeric: tabular-nums;
      display: inline-block;
      vertical-align: middle;
      margin-right: 4px;
    }
    .pss-status-inline.pre   {
      color: #cbd5e1;
      background: transparent;
      padding: 0;
    }
    .pss-status-inline.live  {
      color: #ffffff;
      background: rgba(239, 68, 68, 0.95);
      animation: pss-pulse 1.6s ease-in-out infinite;
    }
    .pss-status-inline.final {
      color: #cbd5e1;
      background: rgba(148, 163, 184, 0.18);
    }

    /* Top line */
    .pss-tile-top {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 9.5px;
      font-weight: 700;
      color: #cbd5e1;
      letter-spacing: 0.04em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      width: 100%;
      max-width: 100%;
      padding-right: 32px;
      margin-bottom: 1px;
    }
    .pss-tile-top > span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Team rows — with logos */
    .pss-team-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      font-size: 12.5px;
      line-height: 1.2;
      width: 100%;
      max-width: 100%;
      overflow: hidden;
    }
    .pss-team-id {
      display: flex;
      align-items: center;
      gap: 6px;
      flex: 1;
      min-width: 0;
      overflow: hidden;
    }
    .pss-team-logo {
      width: 18px;
      height: 18px;
      flex-shrink: 0;
      object-fit: contain;
      background: transparent;
    }
    .pss-team-logo-placeholder {
      width: 18px;
      height: 18px;
      flex-shrink: 0;
      border-radius: 50%;
      background: rgba(148, 163, 184, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 7px;
      font-weight: 800;
      color: #cbd5e1;
      letter-spacing: 0;
      font-variant-numeric: tabular-nums;
    }
    .pss-team-name {
      font-weight: 700;
      color: #ffffff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      letter-spacing: 0.02em;
      font-variant-numeric: tabular-nums;
      min-width: 0;
    }
    .pss-team-record {
      font-weight: 600;
      color: #94a3b8;
      font-size: 9.5px;
      margin-left: 4px;
      font-variant-numeric: tabular-nums;
      flex-shrink: 0;
    }
    .pss-team-row.winner .pss-team-name { color: #ffd24a; font-weight: 800; }
    .pss-team-row.winner .pss-team-score { color: #ffd24a; font-weight: 800; }
    .pss-team-row.loser .pss-team-name { color: #94a3b8; }
    .pss-team-row.loser .pss-team-score { color: #94a3b8; }
    .pss-team-row.loser .pss-team-logo { opacity: 0.55; }
    .pss-team-score {
      font-weight: 800;
      color: #ffffff;
      font-variant-numeric: tabular-nums;
      min-width: 22px;
      text-align: right;
      font-size: 14px;
      flex-shrink: 0;
    }

    /* Bottom meta */
    .pss-tile-bottom {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 9px;
      color: #94a3b8;
      font-weight: 600;
      letter-spacing: 0.02em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      width: 100%;
      max-width: 100%;
      margin-top: 3px;
    }
    .pss-tile-bottom > span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .pss-tile-bottom .pss-divider {
      color: rgba(148, 163, 184, 0.5);
      flex-shrink: 0;
    }
    .pss-tile-bottom .pss-cta-mini {
      color: #ffd24a;
      font-weight: 800;
      font-size: 8.5px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      flex-shrink: 0;
    }
    .pss-tile-bottom .pss-cta-mini.soon {
      color: #94a3b8;
    }

    .pss-empty {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 16px;
      font-size: 11px;
      color: #cbd5e1;
      font-style: italic;
      min-width: 200px;
      flex: 1;
    }

    .pss-fade-r {
      position: absolute;
      top: 0; right: 0; bottom: 0;
      width: 24px;
      background: linear-gradient(90deg, transparent, #0f1626);
      pointer-events: none;
      z-index: 2;
    }

    /* ── 480px+ ───────────────────────────────────────────────────── */
    @media (min-width: 480px) {
      .pss-tile { width: 270px; min-width: 270px; max-width: 270px; padding: 8px 16px; }
      .pss-team-name { font-size: 13px; }
      .pss-team-score { font-size: 14.5px; }
      .pss-team-logo, .pss-team-logo-placeholder { width: 20px; height: 20px; }
    }

    /* ── 700px+ ───────────────────────────────────────────────────── */
    @media (min-width: 700px) {
      #pbe-score-strip { height: 70px; }
      .pss-date { display: flex; }
      .pss-tile { width: 290px; min-width: 290px; max-width: 290px; padding: 8px 18px; }
      .pss-team-row { font-size: 13.5px; }
      .pss-team-score { font-size: 15px; }
      .pss-tile-top { font-size: 10px; padding-right: 36px; }
      .pss-tile-bottom { font-size: 9.5px; }
      .pss-team-logo, .pss-team-logo-placeholder { width: 22px; height: 22px; }
      .pss-filter-btn { padding: 4px 9px; font-size: 10px; letter-spacing: 0.06em; }
      .pss-filter { padding: 0 10px; gap: 3px; }
      .pss-rail.pss-marquee-on { animation-duration: 45s; }
    }

    /* ── 1024px+ ──────────────────────────────────────────────────── */
    @media (min-width: 1024px) {
      #pbe-score-strip { height: 70px; }
      .pss-tile { width: 310px; min-width: 310px; max-width: 310px; }
      .pss-rail.pss-marquee-on { animation-duration: 60s; }
    }

    @media (prefers-reduced-motion: reduce) {
      .pss-status-inline.live, .pss-date .pss-live-dot { animation: none; }
      .pss-rail-wrap { scroll-behavior: auto; }
      .pss-tile.pss-tile-updated { animation: none; }
    }
  `;
  document.head.appendChild(s);
}

/* ─────────────────────────────────────────────────────────────────────────
 * UTILITIES
 * ────────────────────────────────────────────────────────────────────────*/
function escape(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

function tileHref(g) {
  const target = SPORT_TARGETS[g.sport];
  if (!target) return '#';
  if (g.sport === 'mlb' && g.gameId) return `/games/mlb/${g.gameId}`;
  return target.base || '#';
}

function tileTitle(g) {
  const target = SPORT_TARGETS[g.sport];
  if (target?.live) return 'View game · see tonight\'s picks';
  return 'Coming soon · Free access while in beta';
}

function shortName(fullName) {
  if (!fullName || fullName === 'TBD') return 'TBD';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return parts[0];
  return `${parts[0][0]}. ${parts.slice(-1)[0]}`;
}

function buildPitcherLine(g) {
  if (g.sport !== 'mlb' || !g.pitchers || g.state !== 'pre') return null;
  const m = g.pitchers.match(/^(.+?)\s+vs\s+(.+)$/);
  if (!m) return null;
  const away = shortName(m[1].trim());
  const home = shortName(m[2].trim());
  if (away === 'TBD' && home === 'TBD') return null;
  return `${away} vs ${home}`;
}

function isRelevantGame(g) {
  if (g.state === 'live') return true;
  if (!g.gameDate) return false;
  const gameTime = new Date(g.gameDate).getTime();
  if (isNaN(gameTime)) return false;
  const now = Date.now();
  if (g.state === 'pre') {
    return gameTime > now - 30 * 60 * 1000 && gameTime < now + UPCOMING_WINDOW_MS;
  }
  if (g.state === 'final') {
    return gameTime > now - RECENT_FINAL_WINDOW_MS - 6 * 60 * 60 * 1000;
  }
  return true;
}

function teamLogoHTML(team, sport) {
  if (team.logo) {
    return `<img class="pss-team-logo" src="${escape(team.logo)}" alt="${escape(team.abbr || team.name || '')}" loading="lazy" onerror="this.outerHTML='<div class=\\'pss-team-logo-placeholder\\'>${escape((team.abbr || '').slice(0,3))}</div>'" />`;
  }
  // Fallback: 2-3 letter abbreviation in a circle
  const letters = (team.abbr || team.name || '?').slice(0, 3).toUpperCase();
  return `<div class="pss-team-logo-placeholder">${escape(letters)}</div>`;
}

function gameSignature(g) {
  // Used for change detection — only fields we care about
  return JSON.stringify({
    state: g.state,
    statusText: g.statusText,
    awayScore: g.away?.score,
    homeScore: g.home?.score,
  });
}

/* ─────────────────────────────────────────────────────────────────────────
 * TILE HTML
 * ────────────────────────────────────────────────────────────────────────*/
function tileHTML(g, isUpdated) {
  const accent = SPORT_ACCENTS[g.sport] || '#94a3b8';
  const target = SPORT_TARGETS[g.sport] || {};
  const sportTag = SPORT_BADGE[g.sport] || '';
  const ctaText = target.live ? 'Picks live' : 'Free access';
  const ctaCls = target.live ? '' : 'soon';

  let topLabel = '';
  if (g.state === 'live') {
    topLabel = g.statusText || 'Live';
  } else if (g.state === 'final') {
    topLabel = '';
  } else {
    topLabel = g.statusText || 'TBD';
  }

  const awayScoreShown = g.away.score !== '' && g.away.score !== null && g.away.score !== undefined;
  const homeScoreShown = g.home.score !== '' && g.home.score !== null && g.home.score !== undefined;
  const showScores = awayScoreShown || homeScoreShown;

  const awayWin = g.state === 'final' && showScores && parseInt(g.away.score) > parseInt(g.home.score);
  const homeWin = g.state === 'final' && showScores && parseInt(g.home.score) > parseInt(g.away.score);
  const awayLose = g.state === 'final' && showScores && parseInt(g.away.score) < parseInt(g.home.score);
  const homeLose = g.state === 'final' && showScores && parseInt(g.home.score) < parseInt(g.away.score);

  const awayDisplay = g.away.abbr || g.away.name || '—';
  const homeDisplay = g.home.abbr || g.home.name || '—';

  let topLine = '';
  if (g.state === 'live') {
    topLine = `<span class="pss-status-inline live">LIVE</span><span>${escape(topLabel)}</span>`;
  } else if (g.state === 'final') {
    topLine = `<span class="pss-status-inline final">FINAL</span>`;
  } else {
    topLine = `<span>${escape(topLabel)}</span>`;
  }

  const pitcherLine = buildPitcherLine(g);
  let bottomLine = '';
  if (pitcherLine) {
    bottomLine = `
      <span>${escape(pitcherLine)}</span>
      <span class="pss-divider">·</span>
      <span class="pss-cta-mini ${ctaCls}">${escape(ctaText)}</span>
    `;
  } else {
    bottomLine = `<span class="pss-cta-mini ${ctaCls}">${escape(ctaText)}</span>`;
  }

  const tileClasses = ['pss-tile'];
  if (isUpdated) tileClasses.push('pss-tile-updated');

  return `
    <a class="${tileClasses.join(' ')}" href="${escape(tileHref(g))}" data-sport="${g.sport}"
       data-game-id="${escape(String(g.gameId || ''))}"
       title="${escape(tileTitle(g))}">
      <span class="pss-tile-accent" style="background:${accent}"></span>
      <span class="pss-sport-tag">${escape(sportTag)}</span>

      <div class="pss-tile-top">${topLine}</div>

      <div class="pss-team-row${awayWin ? ' winner' : ''}${awayLose ? ' loser' : ''}">
        <span class="pss-team-id">
          ${teamLogoHTML(g.away, g.sport)}
          <span class="pss-team-name">
            ${escape(awayDisplay)}${g.away.record ? `<span class="pss-team-record">${escape(g.away.record)}</span>` : ''}
          </span>
        </span>
        ${showScores ? `<span class="pss-team-score">${escape(g.away.score ?? '')}</span>` : ''}
      </div>

      <div class="pss-team-row${homeWin ? ' winner' : ''}${homeLose ? ' loser' : ''}">
        <span class="pss-team-id">
          ${teamLogoHTML(g.home, g.sport)}
          <span class="pss-team-name">
            ${escape(homeDisplay)}${g.home.record ? `<span class="pss-team-record">${escape(g.home.record)}</span>` : ''}
          </span>
        </span>
        ${showScores ? `<span class="pss-team-score">${escape(g.home.score ?? '')}</span>` : ''}
      </div>

      <div class="pss-tile-bottom">${bottomLine}</div>
    </a>
  `;
}

/* ─────────────────────────────────────────────────────────────────────────
 * RENDER
 * ────────────────────────────────────────────────────────────────────────*/
function paint() {
  const railEl = document.getElementById('pss-rail');
  if (!railEl) return;

  const relevant = _games.filter(isRelevantGame);

  const filtered = _activeFilter === 'all'
    ? relevant
    : relevant.filter(g => g.sport === _activeFilter);

  const ordered = [...filtered].sort((a, b) => {
    const stateOrder = { live: 0, pre: 1, final: 2 };
    if (stateOrder[a.state] !== stateOrder[b.state]) return stateOrder[a.state] - stateOrder[b.state];
    if (a.state === 'pre' && a.gameDate && b.gameDate) {
      return new Date(a.gameDate) - new Date(b.gameDate);
    }
    return SPORT_ORDER.indexOf(a.sport) - SPORT_ORDER.indexOf(b.sport);
  });

  if (!ordered.length) {
    const msg = _activeFilter === 'all'
      ? 'No games right now — check back tonight'
      : `No ${_activeFilter.toUpperCase()} games today`;
    railEl.innerHTML = `<div class="pss-empty">${msg}</div>`;
    railEl.classList.remove('pss-marquee-on');
    return;
  }

  // Detect which games changed since last paint for flash effect
  const newSnapshot = new Map();
  const updatedGameIds = new Set();
  for (const g of ordered) {
    const sig = gameSignature(g);
    const id = String(g.gameId || '');
    newSnapshot.set(id, sig);
    if (id && _gameSnapshot.has(id) && _gameSnapshot.get(id) !== sig) {
      updatedGameIds.add(id);
    }
  }
  _gameSnapshot = newSnapshot;

  const tiles = ordered.map(g => tileHTML(g, updatedGameIds.has(String(g.gameId || '')))).join('');

  railEl.classList.remove('pss-marquee-on');
  railEl.innerHTML = tiles;

  requestAnimationFrame(() => {
    const wrap = document.querySelector('.pss-rail-wrap');
    if (!wrap) return;
    const overflows = railEl.scrollWidth > wrap.clientWidth + 4;
    if (overflows) {
      // For reversed scroll: duplicate tiles AT THE BEGINNING so animation
      // from translateX(-50%) → translateX(0) shows continuous content
      railEl.innerHTML = tiles + tiles;
      railEl.classList.add('pss-marquee-on');
    }
  });
}

function paintFilters() {
  document.querySelectorAll('.pss-filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === _activeFilter);
  });
}

/* ─────────────────────────────────────────────────────────────────────────
 * ADAPTIVE POLLING — 15s when live, 60s when idle
 * ────────────────────────────────────────────────────────────────────────*/
function determineRefreshInterval() {
  const hasLive = _games.some(g => g.state === 'live');
  return hasLive ? REFRESH_LIVE_MS : REFRESH_IDLE_MS;
}

function scheduleNextRefresh() {
  if (_refreshTimer) clearTimeout(_refreshTimer);
  const interval = determineRefreshInterval();
  _refreshTimer = setTimeout(async () => {
    await loadAndPaint();
    scheduleNextRefresh();
  }, interval);
}

/* ─────────────────────────────────────────────────────────────────────────
 * PUBLIC API
 * ────────────────────────────────────────────────────────────────────────*/
export function renderScoreStripShell() {
  const time = new Date().toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
  });
  const visibleSports = SPORT_ORDER.filter(s => !HIDDEN_SPORTS.has(s));
  const filterButtons = ['all', ...visibleSports].map(sp => {
    const label = sp === 'all' ? 'All' : sp.toUpperCase();
    const cls = sp === 'all' ? 'pss-filter-btn active' : 'pss-filter-btn';
    return `<button class="${cls}" data-filter="${sp}" type="button">${label}</button>`;
  }).join('');

  return `
    <div id="pbe-score-strip" role="region" aria-label="Live scores across MLB, NBA, NHL, NFL">
      <div class="pss-filter">${filterButtons}</div>
      <div class="pss-date">
        <span class="pss-live-dot"></span>
        Live · ${time} ET
      </div>
      <div class="pss-rail-wrap">
        <div class="pss-rail" id="pss-rail">
          <div class="pss-empty">Loading scores…</div>
        </div>
        <div class="pss-fade-r"></div>
      </div>
    </div>
  `;
}

export async function mountScoreStrip() {
  injectStyles();

  const strip = document.getElementById('pbe-score-strip');
  if (strip && !strip.dataset.wired) {
    strip.addEventListener('click', e => {
      const btn = e.target.closest('.pss-filter-btn');
      if (!btn) return;
      e.preventDefault();
      _activeFilter = btn.dataset.filter;
      paintFilters();
      paint();
    });
    strip.dataset.wired = '1';
  }

  await loadAndPaint();
  scheduleNextRefresh();
}

async function loadAndPaint() {
  try {
    const { sports } = await import('../api-sports.js');
    const data = await sports.allTodayScoreboards();
    const { normalizeAll } = await import('./score-strip-normalize.js');
    const all = normalizeAll(data);
    _games = all.filter(g => !HIDDEN_SPORTS.has(g.sport));
    paint();
  } catch (err) {
    console.warn('[score-strip] load failed:', err);
    const railEl = document.getElementById('pss-rail');
    if (railEl && !_games.length) {
      railEl.innerHTML = '<div class="pss-empty">Scores unavailable — retrying…</div>';
    }
  }
}

export function unmountScoreStrip() {
  if (_refreshTimer) { clearTimeout(_refreshTimer); _refreshTimer = null; }
}
