/**
 * src/components/score-strip.js
 * ESPN bottom-line score strip — v3.2
 *
 * v3.2 changes:
 *   - HIGH contrast text — all muted grays bumped brighter for readability
 *     (#94a3b8 → #cbd5e1, #64748b → #94a3b8, etc.)
 *   - DATE FILTER: only show games where gameDate is today (ET) OR upcoming
 *     within the next 36 hours. No more stale NFL games from yesterday.
 *   - Added text-rendering: optimizeLegibility for crisp small text
 *   - Added font-feature-settings to disable ligatures (sharper digits)
 *
 * v3.1: Wider tiles, strict overflow control, no clipping
 * v3:   Tiered detail per tile, faster mobile scroll, ESPN bottom-line
 *
 * Tile click routing:
 *   • MLB → /games/mlb/{gameId}
 *   • NBA / NHL / NFL → nba/nhl/nfl.propbetedge.ai
 */

const REFRESH_MS = 60_000;

// 36 hour upcoming window — covers tonight + tomorrow's day games
const UPCOMING_WINDOW_MS = 36 * 60 * 60 * 1000;
// 6 hour past window — keep just-finished games visible briefly
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
let _refreshTimer = null;

/* ─────────────────────────────────────────────────────────────────────────
 * STYLES — HIGH CONTRAST
 * ────────────────────────────────────────────────────────────────────────*/
function injectStyles() {
  if (document.getElementById('pbe-score-strip-styles')) return;
  const s = document.createElement('style');
  s.id = 'pbe-score-strip-styles';
  s.textContent = `
    /* Mobile baseline */
    #pbe-score-strip {
      position: sticky;
      top: 0;
      z-index: 100;
      height: 64px;
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

    /* Filter chips — high contrast */
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

    /* Date stamp — bumped contrast */
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

    /* Rail */
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

    /* Marquee */
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
      from { transform: translateX(0); }
      to   { transform: translateX(-50%); }
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
      gap: 1px;
      padding: 6px 14px 6px 14px;
      height: 100%;
      border-right: 1px solid rgba(255, 255, 255, 0.06);
      text-decoration: none;
      color: inherit;
      transition: background 0.15s ease;
      cursor: pointer;
      position: relative;
      width: 230px;
      min-width: 230px;
      max-width: 230px;
      box-sizing: border-box;
      overflow: hidden;
    }
    .pss-tile:hover { background: rgba(255, 255, 255, 0.05); }

    .pss-tile-accent {
      position: absolute;
      top: 0; left: 0;
      width: 3px;
      height: 100%;
    }

    /* Sport badge — top-right, brighter */
    .pss-sport-tag {
      position: absolute;
      top: 5px;
      right: 6px;
      font-size: 8px;
      font-weight: 800;
      letter-spacing: 0.08em;
      color: #94a3b8;
      font-variant-numeric: tabular-nums;
      pointer-events: none;
    }

    /* Status pill — high contrast */
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

    /* Top line — higher contrast */
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
      padding-right: 28px;
    }
    .pss-tile-top > span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Team rows — bright white */
    .pss-team-row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 6px;
      font-size: 12px;
      line-height: 1.2;
      width: 100%;
      max-width: 100%;
      overflow: hidden;
    }
    .pss-team-name {
      font-weight: 700;
      color: #ffffff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      letter-spacing: 0.02em;
      font-variant-numeric: tabular-nums;
      flex: 1;
      min-width: 0;
    }
    .pss-team-record {
      font-weight: 600;
      color: #94a3b8;
      font-size: 9.5px;
      margin-left: 4px;
      font-variant-numeric: tabular-nums;
    }
    .pss-team-row.winner .pss-team-name { color: #ffd24a; font-weight: 800; }
    .pss-team-row.winner .pss-team-score { color: #ffd24a; font-weight: 800; }
    .pss-team-row.loser .pss-team-name { color: #94a3b8; }
    .pss-team-row.loser .pss-team-score { color: #94a3b8; }
    .pss-team-score {
      font-weight: 700;
      color: #ffffff;
      font-variant-numeric: tabular-nums;
      min-width: 22px;
      text-align: right;
      font-size: 13px;
      flex-shrink: 0;
    }

    /* Bottom meta — brighter */
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
      margin-top: 2px;
    }
    .pss-tile-bottom > span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .pss-tile-bottom .pss-net {
      color: #ffd24a;
      font-weight: 700;
      font-size: 8.5px;
      letter-spacing: 0.06em;
      flex-shrink: 0;
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

    /* Breakpoints */
    @media (min-width: 480px) {
      .pss-tile { width: 250px; min-width: 250px; max-width: 250px; padding: 6px 16px; }
      .pss-team-name { font-size: 12.5px; }
      .pss-team-score { font-size: 13.5px; }
    }

    @media (min-width: 700px) {
      #pbe-score-strip { height: 60px; }
      .pss-date { display: flex; }
      .pss-tile { width: 270px; min-width: 270px; max-width: 270px; padding: 7px 18px; }
      .pss-team-row { font-size: 13px; }
      .pss-team-score { font-size: 14px; }
      .pss-tile-top { font-size: 10px; padding-right: 32px; }
      .pss-tile-bottom { font-size: 9.5px; }
      .pss-filter-btn { padding: 4px 9px; font-size: 10px; letter-spacing: 0.06em; }
      .pss-filter { padding: 0 10px; gap: 3px; }
      .pss-rail.pss-marquee-on { animation-duration: 45s; }
    }

    @media (min-width: 1024px) {
      #pbe-score-strip { height: 56px; }
      .pss-tile { width: 290px; min-width: 290px; max-width: 290px; }
      .pss-rail.pss-marquee-on { animation-duration: 60s; }
    }

    @media (prefers-reduced-motion: reduce) {
      .pss-status-inline.live, .pss-date .pss-live-dot { animation: none; }
      .pss-rail-wrap { scroll-behavior: auto; }
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

/**
 * v3.2 — Filter to relevant games only.
 * Keep:
 *   - All live games (any sport)
 *   - Pre-game scheduled within the next 36 hours
 *   - Just-finished games within the last 6 hours (so a "FINAL" tile
 *     stays visible briefly after game ends, gives users continuity)
 * Drop:
 *   - Stale finals from yesterday or earlier
 *   - Games scheduled more than 36 hours out (tomorrow night NFL etc.
 *     when current focus is today)
 */
function isRelevantGame(g) {
  if (g.state === 'live') return true;
  if (!g.gameDate) {
    // No date info — only keep if live, drop everything else as a safety
    return false;
  }
  const gameTime = new Date(g.gameDate).getTime();
  if (isNaN(gameTime)) return false;
  const now = Date.now();
  if (g.state === 'pre') {
    // Keep if within 36h upcoming AND not in the past
    return gameTime > now - 30 * 60 * 1000 && gameTime < now + UPCOMING_WINDOW_MS;
  }
  if (g.state === 'final') {
    // Keep if finished within last 6 hours
    return gameTime > now - RECENT_FINAL_WINDOW_MS - 6 * 60 * 60 * 1000;
  }
  return true;
}

/* ─────────────────────────────────────────────────────────────────────────
 * TILE HTML
 * ────────────────────────────────────────────────────────────────────────*/
function tileHTML(g) {
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

  return `
    <a class="pss-tile" href="${escape(tileHref(g))}" data-sport="${g.sport}"
       title="${escape(tileTitle(g))}">
      <span class="pss-tile-accent" style="background:${accent}"></span>
      <span class="pss-sport-tag">${escape(sportTag)}</span>

      <div class="pss-tile-top">${topLine}</div>

      <div class="pss-team-row${awayWin ? ' winner' : ''}${awayLose ? ' loser' : ''}">
        <span class="pss-team-name">
          ${escape(awayDisplay)}${g.away.record ? `<span class="pss-team-record">${escape(g.away.record)}</span>` : ''}
        </span>
        ${showScores ? `<span class="pss-team-score">${escape(g.away.score ?? '')}</span>` : ''}
      </div>

      <div class="pss-team-row${homeWin ? ' winner' : ''}${homeLose ? ' loser' : ''}">
        <span class="pss-team-name">
          ${escape(homeDisplay)}${g.home.record ? `<span class="pss-team-record">${escape(g.home.record)}</span>` : ''}
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

  // v3.2 — apply relevance filter before sport filter
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

  const tiles = ordered.map(tileHTML).join('');

  railEl.classList.remove('pss-marquee-on');
  railEl.innerHTML = tiles;

  requestAnimationFrame(() => {
    const wrap = document.querySelector('.pss-rail-wrap');
    if (!wrap) return;
    const overflows = railEl.scrollWidth > wrap.clientWidth + 4;
    if (overflows) {
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

  if (_refreshTimer) clearInterval(_refreshTimer);
  _refreshTimer = setInterval(loadAndPaint, REFRESH_MS);
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
  if (_refreshTimer) { clearInterval(_refreshTimer); _refreshTimer = null; }
}
