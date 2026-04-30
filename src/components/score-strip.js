/**
 * src/components/score-strip.js
 * ESPN-pattern sticky score strip — MOBILE-FIRST + AUTO-SCROLL (v2)
 *
 * v2 changes:
 *   - Mobile-first sizing (designed for 360px viewport, scales up)
 *   - Auto-scroll the rail every ~5s so bettors see every game without
 *     having to manually swipe. Pauses on hover/touch/focus and on
 *     filter change. Resumes when interaction ends.
 *   - Slightly taller strip on mobile (60px) so tile content breathes
 *   - Inline date/time stamp shrinks to icon-only on small screens
 *   - Reduced-motion users get no auto-scroll (respected via media query)
 *
 * Tile click routing (the funnel):
 *   • MLB live/final → /games/mlb/{gameId}  (your existing game-detail.js page)
 *   • MLB pre-game   → /games/mlb/{gameId}
 *   • NBA / NHL / NFL → nba/nhl/nfl.propbetedge.ai
 *
 * CTA badge per tile:
 *   • MLB → 🔒 Picks live   (gold, the conversion lever)
 *   • Other sports → ○ Free access  (muted, future product)
 */

const REFRESH_MS  = 60_000   // data refresh
const SCROLL_MS   = 4_500    // auto-scroll: how often we step
const SCROLL_PAUSE_AFTER_INTERACT_MS = 8_000

const SPORT_TARGETS = {
  mlb: { label: 'Picks live',   live: true,  base: null },
  nfl: { label: 'Free access',  live: false, base: 'https://nfl.propbetedge.ai' },
  nba: { label: 'Free access',  live: false, base: 'https://nba.propbetedge.ai' },
  nhl: { label: 'Free access',  live: false, base: 'https://nhl.propbetedge.ai' },
}

const SPORT_ACCENTS = {
  mlb: '#ef4444',
  nfl: '#8b5cf6',
  nba: '#f97316',
  nhl: '#06b6d4',
}

const SPORT_ORDER = ['mlb', 'nba', 'nhl', 'nfl']

// ⚠ NHL temporarily disabled — api-web.nhle.com does NOT send CORS headers
// (despite the comment in api-sports.js claiming it does). Until either
// PropSports API exposes NHL or a CORS proxy worker is deployed, NHL stays
// hidden from the score strip to prevent the 4-sport Promise.allSettled
// from logging errors on every page load.
const HIDDEN_SPORTS = new Set(['nhl'])

let _activeFilter = 'all'
let _games = []
let _refreshTimer = null
let _scrollTimer = null
let _resumeScrollTimer = null
let _userInteracting = false
let _scrollPaused = false

/* ─────────────────────────────────────────────────────────────────────────
 * STYLES — mobile-first
 * ────────────────────────────────────────────────────────────────────────*/
function injectStyles() {
  if (document.getElementById('pbe-score-strip-styles')) return
  const s = document.createElement('style')
  s.id = 'pbe-score-strip-styles'
  s.textContent = `
    /* ── Mobile baseline (default) ─────────────────────────────────────── */
    #pbe-score-strip {
      position: sticky;
      top: 0;
      z-index: 100;
      height: 60px;
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

    .pss-filter {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      padding: 0 6px;
      gap: 2px;
      border-right: 1px solid rgba(255, 255, 255, 0.06);
      background: rgba(0, 0, 0, 0.3);
    }
    .pss-filter-btn {
      background: transparent;
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #94a3b8;
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
      color: #f5f8ff;
      border-color: rgba(255, 255, 255, 0.25);
    }
    .pss-filter-btn.active {
      background: rgba(255, 210, 74, 0.15);
      border-color: rgba(255, 210, 74, 0.4);
      color: #ffd24a;
    }

    .pss-date {
      display: none;
      flex-shrink: 0;
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

    .pss-tile {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 0 9px;
      height: 100%;
      border-right: 1px solid rgba(255, 255, 255, 0.05);
      text-decoration: none;
      color: inherit;
      transition: background 0.15s ease;
      cursor: pointer;
      position: relative;
      min-width: 175px;
    }
    .pss-tile:hover { background: rgba(255, 255, 255, 0.04); }
    .pss-tile:hover .pss-cta { opacity: 1; }
    .pss-tile-accent {
      position: absolute;
      top: 0; left: 0;
      width: 2px;
      height: 100%;
    }

    .pss-status {
      font-size: 8.5px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      padding: 2px 5px;
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
      gap: 6px;
      font-size: 11px;
      line-height: 1.2;
    }
    .pss-team-name {
      font-weight: 600;
      color: #e2e8f5;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 70px;
    }
    .pss-team-row.winner .pss-team-name { color: #ffd24a; font-weight: 700; }
    .pss-team-row.winner .pss-team-score { color: #ffd24a; }
    .pss-team-score {
      font-weight: 700;
      color: #f5f8ff;
      font-variant-numeric: tabular-nums;
      min-width: 20px;
      text-align: right;
    }

    .pss-cta {
      display: none;
      align-items: center;
      gap: 3px;
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      padding: 2px 5px;
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

    /* Mini lock icon shown on tightest mobile in place of full CTA pill */
    .pss-lock-mini {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      font-size: 10px;
      flex-shrink: 0;
      opacity: 0.85;
    }
    .pss-lock-mini.locked { color: #ffd24a; }
    .pss-lock-mini.soon { color: #64748b; }

    .pss-empty {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 16px;
      font-size: 11px;
      color: #64748b;
      font-style: italic;
      min-width: 200px;
      flex: 1;
    }

    .pss-fade-r {
      position: absolute;
      top: 0; right: 0; bottom: 0;
      width: 18px;
      background: linear-gradient(90deg, transparent, #0f1626);
      pointer-events: none;
      z-index: 2;
    }

    /* ── 480px+ — large phone / small tablet ─────────────────────── */
    @media (min-width: 480px) {
      .pss-tile { min-width: 195px; padding: 0 10px; gap: 8px; }
      .pss-team-name { max-width: 80px; }
      .pss-cta { display: flex; }
      .pss-lock-mini { display: none; }
    }

    /* ── 700px+ — full date stamp + bigger tiles ─────────────────── */
    @media (min-width: 700px) {
      #pbe-score-strip { height: 52px; }
      .pss-date { display: flex; }
      .pss-tile { min-width: 215px; padding: 0 12px; gap: 9px; }
      .pss-team-name { max-width: 95px; }
      .pss-team-row { font-size: 11.5px; }
      .pss-cta { font-size: 8.5px; padding: 3px 6px; }
      .pss-filter-btn { padding: 4px 9px; font-size: 10px; letter-spacing: 0.06em; }
      .pss-filter { padding: 0 10px; gap: 3px; }
    }

    /* ── 1024px+ — desktop ───────────────────────────────────────── */
    @media (min-width: 1024px) {
      #pbe-score-strip { height: 48px; }
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
 * ────────────────────────────────────────────────────────────────────────*/
function escape(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c])
}

function tileHref(g) {
  const target = SPORT_TARGETS[g.sport]
  if (!target) return '#'
  if (g.sport === 'mlb' && g.gameId) return `/games/mlb/${g.gameId}`
  return target.base || '#'
}

function tileTitle(g) {
  const target = SPORT_TARGETS[g.sport]
  if (target?.live) return 'View game · see tonight\'s picks'
  return 'Coming soon · Free access while in beta'
}

function tileHTML(g) {
  const accent = SPORT_ACCENTS[g.sport] || '#94a3b8'
  const target = SPORT_TARGETS[g.sport] || {}
  const ctaClass = target.live ? 'locked' : 'soon'
  const ctaIcon = target.live ? '🔒' : '○'

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
      <span class="pss-lock-mini ${ctaClass}" aria-hidden="true">${ctaIcon}</span>
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
    stopAutoScroll()
    return
  }

  railEl.innerHTML = ordered.map(tileHTML).join('')
  startAutoScroll() // restart after every paint so timer stays in sync with content
}

function paintFilters() {
  document.querySelectorAll('.pss-filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === _activeFilter)
  })
}

/* ── Auto-scroll ───────────────────────────────────────────────────────── */
function startAutoScroll() {
  if (_scrollTimer) clearInterval(_scrollTimer)
  if (_scrollPaused) return

  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (reduceMotion) return

  _scrollTimer = setInterval(stepScroll, SCROLL_MS)
}

function stopAutoScroll() {
  if (_scrollTimer) {
    clearInterval(_scrollTimer)
    _scrollTimer = null
  }
}

function stepScroll() {
  if (_userInteracting) return
  const wrap = document.querySelector('.pss-rail-wrap')
  if (!wrap) return

  const railEl = document.getElementById('pss-rail')
  if (!railEl) return

  // Nothing to scroll if rail isn't overflowing
  if (railEl.scrollWidth <= wrap.clientWidth + 4) return

  const firstTile = railEl.querySelector('.pss-tile')
  const stepBy = firstTile?.offsetWidth || 200

  const atEnd = wrap.scrollLeft + wrap.clientWidth >= railEl.scrollWidth - 4

  if (atEnd) {
    // Snap back to start without animation (no backwards scroll jank)
    const prevBehavior = wrap.style.scrollBehavior
    wrap.style.scrollBehavior = 'auto'
    wrap.scrollLeft = 0
    requestAnimationFrame(() => { wrap.style.scrollBehavior = prevBehavior || '' })
  } else {
    wrap.scrollBy({ left: stepBy, behavior: 'smooth' })
  }
}

function pauseScrollOnInteract() {
  _userInteracting = true
  stopAutoScroll()
  if (_resumeScrollTimer) clearTimeout(_resumeScrollTimer)
  _resumeScrollTimer = setTimeout(() => {
    _userInteracting = false
    if (!_scrollPaused) startAutoScroll()
  }, SCROLL_PAUSE_AFTER_INTERACT_MS)
}

/* ─────────────────────────────────────────────────────────────────────────
 * PUBLIC API
 * ────────────────────────────────────────────────────────────────────────*/

export function renderScoreStripShell() {
  const time = new Date().toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
  })
  const visibleSports = SPORT_ORDER.filter(s => !HIDDEN_SPORTS.has(s))
  const filterButtons = ['all', ...visibleSports].map(sp => {
    const label = sp === 'all' ? 'All' : sp.toUpperCase()
    const cls = sp === 'all' ? 'pss-filter-btn active' : 'pss-filter-btn'
    return `<button class="${cls}" data-filter="${sp}" type="button">${label}</button>`
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

export async function mountScoreStrip() {
  injectStyles()

  const strip = document.getElementById('pbe-score-strip')
  if (strip && !strip.dataset.wired) {
    // Filter clicks
    strip.addEventListener('click', e => {
      const btn = e.target.closest('.pss-filter-btn')
      if (!btn) return
      e.preventDefault()
      _activeFilter = btn.dataset.filter
      paintFilters()
      paint()
      // Reset rail to start so user sees from beginning of new filter
      const wrap = strip.querySelector('.pss-rail-wrap')
      if (wrap) {
        const prev = wrap.style.scrollBehavior
        wrap.style.scrollBehavior = 'auto'
        wrap.scrollLeft = 0
        requestAnimationFrame(() => { wrap.style.scrollBehavior = prev || '' })
      }
    })

    // Pause auto-scroll on user interaction
    const wrap = strip.querySelector('.pss-rail-wrap')
    if (wrap) {
      const pauseEvents = ['mouseenter', 'touchstart', 'pointerdown', 'wheel', 'focusin']
      pauseEvents.forEach(ev => {
        wrap.addEventListener(ev, pauseScrollOnInteract, { passive: true })
      })
    }

    // Pause when tab is hidden — saves battery, no mid-step on return
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        _scrollPaused = true
        stopAutoScroll()
      } else {
        _scrollPaused = false
        startAutoScroll()
      }
    })

    strip.dataset.wired = '1'
  }

  await loadAndPaint()

  if (_refreshTimer) clearInterval(_refreshTimer)
  _refreshTimer = setInterval(loadAndPaint, REFRESH_MS)
}

async function loadAndPaint() {
  try {
    const { sports } = await import('../api-sports.js')
    const data = await sports.allTodayScoreboards()
    const { normalizeAll } = await import('./score-strip-normalize.js')
    const all = normalizeAll(data)
    // Drop hidden sports (e.g. NHL until CORS is fixed) so the strip stays clean
    _games = all.filter(g => !HIDDEN_SPORTS.has(g.sport))
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
  if (_refreshTimer) { clearInterval(_refreshTimer); _refreshTimer = null }
  stopAutoScroll()
  if (_resumeScrollTimer) { clearTimeout(_resumeScrollTimer); _resumeScrollTimer = null }
}
