/**
 * src/components/score-strip.js
 * ESPN-pattern sticky score strip for the news site.
 *
 * Sits where the old <div class="topbar"> used to live. Same vertical space,
 * way more conversion value. Reuses sports.allTodayScoreboards() from api-sports.js
 * — same data source as games-hub.js, no duplicate fetching logic.
 *
 * Tile click routing (the funnel):
 *   • MLB live/final → /games/mlb/{gameId}  (your existing game-detail.js page)
 *   • MLB pre-game   → /games/mlb/{gameId}  (still detail page, future picks teaser)
 *   • NBA / NHL / NFL → nba/nhl/nfl.propbetedge.ai (their subdomains, paywall funnel)
 *
 * CTA badge per tile:
 *   • MLB → 🔒 Picks live   (gold, the conversion lever)
 *   • Other sports → ○ Lock in free  (muted, future product)
 *
 * Auto-refresh: 60s. Filter pills: All / MLB / NBA / NHL / NFL.
 *
 * Usage from header.js:
 *   import { renderScoreStripShell, mountScoreStrip } from './score-strip.js'
 *   ...
 *   ${renderScoreStripShell()}    // synchronous — drops the empty shell into HTML
 *   ...
 *   // Then call mountScoreStrip() once after the page renders to fetch + populate.
 *   // header.js handles this automatically (see updated header.js).
 */

const REFRESH_MS = 60_000

// Per-sport CTA targets — matches your subdomain plan
const SPORT_TARGETS = {
  mlb: { label: 'Picks live',   live: true,  base: null /* uses /games/mlb/{id} */ },
  nfl: { label: 'Lock in free', live: false, base: 'https://nfl.propbetedge.ai' },
  nba: { label: 'Lock in free', live: false, base: 'https://nba.propbetedge.ai' },
  nhl: { label: 'Lock in free', live: false, base: 'https://nhl.propbetedge.ai' },
}

const SPORT_ACCENTS = {
  mlb: '#ef4444',
  nfl: '#8b5cf6',
  nba: '#f97316',
  nhl: '#06b6d4',
}

const SPORT_ORDER = ['mlb', 'nba', 'nhl', 'nfl']

let _activeFilter = 'all'
let _games = []
let _refreshTimer = null

/* ─────────────────────────────────────────────────────────────────────────
 * STYLES — injected once, scoped under #pbe-score-strip
 * ────────────────────────────────────────────────────────────────────────*/
function injectStyles() {
  if (document.getElementById('pbe-score-strip-styles')) return
  const s = document.createElement('style')
  s.id = 'pbe-score-strip-styles'
  s.textContent = `
    #pbe-score-strip {
      position: sticky;
      top: 0;
      z-index: 100;
      height: 48px;
      background: linear-gradient(180deg, #0a0f1a 0%, #0f1626 100%);
      border-bottom: 1px solid rgba(255, 210, 74, 0.18);
      box-shadow: 0 2px 14px rgba(0, 0, 0, 0.35);
      display: flex;
      align-items: stretch;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      color: #f5f8ff;
      overflow: hidden;
      -webkit-font-smoothing: antialiased;
      contain: layout style;
    }

    /* Filter rail — leftmost */
    .pss-filter {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      padding: 0 10px;
      gap: 3px;
      border-right: 1px solid rgba(255, 255, 255, 0.06);
      background: rgba(0, 0, 0, 0.3);
    }
    .pss-filter-btn {
      background: transparent;
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #94a3b8;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding: 4px 9px;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.15s ease;
      font-family: inherit;
      -webkit-tap-highlight-color: transparent;
    }
    .pss-filter-btn:hover {
      color: #f5f8ff;
      border-color: rgba(255, 255, 255, 0.25);
    }
    .pss-filter-btn.active {
      background: rgba(255, 210, 74, 0.15);
      border-color: rgba(255, 210, 74, 0.4);
      color: #ffd24a;
    }

    /* Date stamp — only visible when there's room */
    .pss-date {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      padding: 0 12px;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.06em;
      color: #64748b;
      text-transform: uppercase;
      border-right: 1px solid rgba(255, 255, 255, 0.04);
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

    /* Scroll rail */
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

    /* Game tile */
    .pss-tile {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 0 12px;
      height: 100%;
      border-right: 1px solid rgba(255, 255, 255, 0.05);
      text-decoration: none;
      color: inherit;
      transition: background 0.15s ease;
      cursor: pointer;
      position: relative;
      min-width: 215px;
    }
    .pss-tile:hover { background: rgba(255, 255, 255, 0.04); }
    .pss-tile:hover .pss-cta { opacity: 1; }
    .pss-tile-accent {
      position: absolute;
      top: 0; left: 0;
      width: 2px;
      height: 100%;
    }

    /* Status badge */
    .pss-status {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.07em;
      text-transform: uppercase;
      padding: 2px 6px;
      border-radius: 3px;
      white-space: nowrap;
      flex-shrink: 0;
      font-variant-numeric: tabular-nums;
    }
    .pss-status.pre   { color: #94a3b8; background: rgba(148, 163, 184, 0.1); }
    .pss-status.live  {
      color: #fff;
      background: rgba(239, 68, 68, 0.85);
      animation: pss-pulse 1.6s ease-in-out infinite;
    }
    .pss-status.final { color: #94a3b8; background: rgba(148, 163, 184, 0.08); }

    /* Teams + scores */
    .pss-teams {
      display: flex;
      flex-direction: column;
      gap: 1px;
      flex: 1;
      min-width: 0;
    }
    .pss-team-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-size: 11.5px;
      line-height: 1.2;
    }
    .pss-team-name {
      font-weight: 600;
      color: #e2e8f5;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 95px;
    }
    .pss-team-row.winner .pss-team-name { color: #ffd24a; font-weight: 700; }
    .pss-team-row.winner .pss-team-score { color: #ffd24a; }
    .pss-team-score {
      font-weight: 700;
      color: #f5f8ff;
      font-variant-numeric: tabular-nums;
      min-width: 22px;
      text-align: right;
    }

    /* CTA pill */
    .pss-cta {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 8.5px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      padding: 3px 6px;
      border-radius: 3px;
      white-space: nowrap;
      flex-shrink: 0;
      opacity: 0.85;
      transition: opacity 0.15s ease;
    }
    .pss-cta.locked {
      color: #ffd24a;
      background: rgba(255, 210, 74, 0.12);
      border: 1px solid rgba(255, 210, 74, 0.3);
    }
    .pss-cta.soon {
      color: #94a3b8;
      background: rgba(148, 163, 184, 0.08);
      border: 1px solid rgba(148, 163, 184, 0.2);
    }

    /* Empty state */
    .pss-empty {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 16px;
      font-size: 11px;
      color: #64748b;
      font-style: italic;
      min-width: 200px;
    }

    /* Right edge fade — hint scrollable */
    .pss-fade-r {
      position: absolute;
      top: 0; right: 0; bottom: 0;
      width: 24px;
      background: linear-gradient(90deg, transparent, #0f1626);
      pointer-events: none;
      z-index: 2;
    }

    /* Mobile */
    @media (max-width: 640px) {
      #pbe-score-strip { height: 44px; }
      .pss-tile { min-width: 175px; padding: 0 9px; gap: 7px; }
      .pss-team-row { font-size: 11px; }
      .pss-team-name { max-width: 78px; }
      .pss-cta { font-size: 8px; padding: 2px 5px; }
      .pss-filter-btn { padding: 3px 6px; font-size: 9px; }
      .pss-date { display: none; }
    }

    @media (prefers-reduced-motion: reduce) {
      .pss-status.live, .pss-date .pss-live-dot { animation: none; }
      .pss-rail-wrap { scroll-behavior: auto; }
    }
  `
  document.head.appendChild(s)
}

/* ─────────────────────────────────────────────────────────────────────────
 * GAME → TILE
 * Reuses the normalized game shape that games-hub.js already produces.
 * ────────────────────────────────────────────────────────────────────────*/
function escape(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c])
}

function tileHref(g) {
  const target = SPORT_TARGETS[g.sport]
  if (!target) return '#'
  // MLB games → existing /games/mlb/{id} detail page (the funnel into picks teaser)
  if (g.sport === 'mlb' && g.gameId) return `/games/mlb/${g.gameId}`
  // Other sports → their subdomain
  return target.base || '#'
}

function tileTitle(g) {
  const target = SPORT_TARGETS[g.sport]
  if (target?.live) return 'View game · see tonight\'s picks'
  return 'Coming soon · Lock in free access before May 15'
}

function tileHTML(g) {
  const accent = SPORT_ACCENTS[g.sport] || '#94a3b8'
  const target = SPORT_TARGETS[g.sport] || {}
  const ctaClass = target.live ? 'locked' : 'soon'
  const ctaIcon = target.live ? '🔒' : '○'

  // Status text
  let statusText = ''
  let statusClass = 'pre'
  if (g.state === 'live') {
    statusText = g.statusText || 'LIVE'
    statusClass = 'live'
  } else if (g.state === 'final') {
    statusText = 'FINAL'
    statusClass = 'final'
  } else {
    statusText = g.statusText || 'TBD'
    statusClass = 'pre'
  }

  // Score display — only if scores exist
  const awayScoreShown = g.away.score !== '' && g.away.score !== null && g.away.score !== undefined
  const homeScoreShown = g.home.score !== '' && g.home.score !== null && g.home.score !== undefined
  const showScores = awayScoreShown || homeScoreShown

  const awayWin = g.state === 'final' && showScores && parseInt(g.away.score) > parseInt(g.home.score)
  const homeWin = g.state === 'final' && showScores && parseInt(g.home.score) > parseInt(g.away.score)

  const awayDisplay = g.away.abbr || g.away.name || '—'
  const homeDisplay = g.home.abbr || g.home.name || '—'

  return `
    <a class="pss-tile" href="${escape(tileHref(g))}" data-sport="${g.sport}"
       title="${escape(tileTitle(g))}">
      <span class="pss-tile-accent" style="background:${accent}"></span>
      <span class="pss-status ${statusClass}">${escape(statusText)}</span>
      <div class="pss-teams">
        <div class="pss-team-row${awayWin ? ' winner' : ''}">
          <span class="pss-team-name">${escape(awayDisplay)}</span>
          ${showScores ? `<span class="pss-team-score">${escape(g.away.score ?? '')}</span>` : ''}
        </div>
        <div class="pss-team-row${homeWin ? ' winner' : ''}">
          <span class="pss-team-name">${escape(homeDisplay)}</span>
          ${showScores ? `<span class="pss-team-score">${escape(g.home.score ?? '')}</span>` : ''}
        </div>
      </div>
      <span class="pss-cta ${ctaClass}">
        <span>${ctaIcon}</span>
        <span>${target.label || ''}</span>
      </span>
    </a>
  `
}

/* ─────────────────────────────────────────────────────────────────────────
 * RENDER
 * ────────────────────────────────────────────────────────────────────────*/
function paint() {
  const railEl = document.getElementById('pss-rail')
  if (!railEl) return

  const filtered = _activeFilter === 'all'
    ? _games
    : _games.filter(g => g.sport === _activeFilter)

  // Sort: live first → upcoming (by time) → final
  const ordered = [...filtered].sort((a, b) => {
    const stateOrder = { live: 0, pre: 1, final: 2 }
    if (stateOrder[a.state] !== stateOrder[b.state]) return stateOrder[a.state] - stateOrder[b.state]
    if (a.state === 'pre' && a.gameDate && b.gameDate) {
      return new Date(a.gameDate) - new Date(b.gameDate)
    }
    return SPORT_ORDER.indexOf(a.sport) - SPORT_ORDER.indexOf(b.sport)
  })

  if (!ordered.length) {
    const msg = _activeFilter === 'all'
      ? 'No games today — check back tomorrow'
      : `No ${_activeFilter.toUpperCase()} games today`
    railEl.innerHTML = `<div class="pss-empty">${msg}</div>`
    return
  }

  railEl.innerHTML = ordered.map(tileHTML).join('')
}

function paintFilters() {
  document.querySelectorAll('.pss-filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === _activeFilter)
  })
}

/* ─────────────────────────────────────────────────────────────────────────
 * PUBLIC API
 * ────────────────────────────────────────────────────────────────────────*/

/**
 * Render the empty shell synchronously. Drop this into the header HTML
 * where the topbar used to be. mountScoreStrip() populates it after the
 * page renders.
 */
export function renderScoreStripShell() {
  const time = new Date().toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
  })
  const filterButtons = ['all', ...SPORT_ORDER].map(sp => {
    const label = sp === 'all' ? 'All' : sp.toUpperCase()
    const cls = sp === 'all' ? 'pss-filter-btn active' : 'pss-filter-btn'
    return `<button class="${cls}" data-filter="${sp}">${label}</button>`
  }).join('')

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
  `
}

/**
 * Fetch + populate. Call once after page renders. Auto-refreshes every 60s.
 */
export async function mountScoreStrip() {
  injectStyles()

  // Wire filter buttons (delegate from the strip element so re-renders survive)
  const strip = document.getElementById('pbe-score-strip')
  if (strip && !strip.dataset.wired) {
    strip.addEventListener('click', e => {
      const btn = e.target.closest('.pss-filter-btn')
      if (!btn) return
      e.preventDefault()
      _activeFilter = btn.dataset.filter
      paintFilters()
      paint()
    })
    strip.dataset.wired = '1'
  }

  await loadAndPaint()

  // Refresh loop
  if (_refreshTimer) clearInterval(_refreshTimer)
  _refreshTimer = setInterval(loadAndPaint, REFRESH_MS)
}

async function loadAndPaint() {
  try {
    // Dynamic import — keeps score-strip lazy on pages that don't need it,
    // and reuses games-hub's existing normalizers via a shared helper.
    const { sports } = await import('../api-sports.js')
    const data = await sports.allTodayScoreboards()

    // Normalize using the same logic games-hub.js already uses.
    const { normalizeAll } = await import('./score-strip-normalize.js')
    _games = normalizeAll(data)

    paint()
  } catch (err) {
    console.warn('[score-strip] load failed:', err)
    const railEl = document.getElementById('pss-rail')
    if (railEl && !_games.length) {
      railEl.innerHTML = '<div class="pss-empty">Scores unavailable — retrying…</div>'
    }
  }
}

export function unmountScoreStrip() {
  if (_refreshTimer) {
    clearInterval(_refreshTimer)
    _refreshTimer = null
  }
}
