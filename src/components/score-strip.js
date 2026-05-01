/**
 * src/components/score-strip.js
 * ESPN-elite score strip — v3.6
 *
 * v3.6 — MOBILE FIXES:
 *
 *   1. SCROLL SPEED: mobile marquee 30s → 18s. Felt glacial before. The
 *      strip now actually scrolls visibly fast on phones. Desktop unchanged
 *      (45s at 700px+, 60s at 1024px+).
 *
 *   2. FILTER COMPACT MODE: at <700px the All/MLB/NBA/NHL/NFL row of
 *      buttons was eating ~140px of horizontal space — half a tile width
 *      on a 380px phone. Now it's a single 56px-wide pill that opens a
 *      vertical dropdown when tapped. Saves ~85px for actual scores.
 *      Above 700px the original button row shows again. Desktop unchanged.
 *
 * v3.5: scroll glitch fix via in-place tile updates
 * v3.4: strip height bumped to 88/76, proper padding
 * v3.3: team logos, reversed scroll, adaptive polling, score flash
 */

const REFRESH_LIVE_MS = 15_000;
const REFRESH_IDLE_MS = 60_000;

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
let _gameSnapshot = new Map();
let _refreshTimer = null;
let _renderedGameIds = new Set();

/* ─────────────────────────────────────────────────────────────────────────
 * STYLES
 * ────────────────────────────────────────────────────────────────────────*/
function injectStyles() {
  if (document.getElementById('pbe-score-strip-styles')) return;
  const s = document.createElement('style');
  s.id = 'pbe-score-strip-styles';
  s.textContent = `
    #pbe-score-strip {
      position: sticky;
      top: 0;
      z-index: 100;
      height: 88px;
      background: linear-gradient(180deg, #0a0f1a 0%, #0f1626 100%);
      border-bottom: 1px solid rgba(255, 210, 74, 0.18);
      box-shadow: 0 2px 14px rgba(0, 0, 0, 0.35);
      display: flex;
      align-items: stretch;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      color: #f8fafc;
      overflow: visible;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
      font-feature-settings: "tnum" 1, "liga" 0;
      contain: layout style;
    }

    /* === MOBILE FILTER: compact pill that opens a dropdown === */
    .pss-filter {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      padding: 0 6px;
      border-right: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(0, 0, 0, 0.35);
      position: relative;
    }
    .pss-filter-row {
      /* Mobile: hidden — only the trigger pill shows */
      display: none;
      gap: 2px;
    }
    .pss-filter-trigger {
      /* Mobile: the only thing visible */
      display: flex;
      align-items: center;
      gap: 4px;
      background: rgba(255, 210, 74, 0.18);
      border: 1px solid rgba(255, 210, 74, 0.5);
      color: #ffd24a;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding: 5px 8px 5px 9px;
      border-radius: 4px;
      cursor: pointer;
      font-family: inherit;
      -webkit-tap-highlight-color: transparent;
      flex-shrink: 0;
      line-height: 1;
      min-width: 56px;
      justify-content: center;
    }
    .pss-filter-trigger::after {
      content: '▾';
      font-size: 8px;
      opacity: 0.7;
    }
    .pss-filter-dropdown {
      display: none;
      position: absolute;
      top: 100%;
      left: 4px;
      margin-top: 4px;
      background: #0f1626;
      border: 1px solid rgba(255, 210, 74, 0.3);
      border-radius: 6px;
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.55);
      padding: 4px;
      z-index: 200;
      flex-direction: column;
      gap: 2px;
      min-width: 80px;
    }
    .pss-filter-dropdown.open {
      display: flex;
    }
    .pss-filter-dropdown .pss-filter-btn {
      width: 100%;
      text-align: center;
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

    /* === MOBILE SCROLL SPEED — 18s (was 30s) === */
    .pss-rail.pss-marquee-on {
      animation: pss-marquee 18s linear infinite;
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

    .pss-tile {
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 1px;
      padding: 10px 14px 12px 14px;
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

    .pss-sport-tag {
      position: absolute;
      top: 8px;
      right: 10px;
      font-size: 8px;
      font-weight: 800;
      letter-spacing: 0.08em;
      color: #94a3b8;
      font-variant-numeric: tabular-nums;
      pointer-events: none;
      line-height: 1;
    }

    .pss-status-inline {
      font-size: 8.5px;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      padding: 2px 5px;
      border-radius: 3px;
      white-space: nowrap;
      flex-shrink: 0;
      font-variant-numeric: tabular-nums;
      display: inline-block;
      vertical-align: middle;
      margin-right: 4px;
      line-height: 1;
    }
    .pss-status-inline.pre   { color: #cbd5e1; background: transparent; padding: 0; }
    .pss-status-inline.live  {
      color: #ffffff;
      background: rgba(239, 68, 68, 0.95);
      animation: pss-pulse 1.6s ease-in-out infinite;
    }
    .pss-status-inline.final { color: #cbd5e1; background: rgba(148, 163, 184, 0.18); }

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
      line-height: 1.3;
      flex-shrink: 0;
    }
    .pss-tile-top > span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .pss-team-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      font-size: 12.5px;
      line-height: 1.25;
      width: 100%;
      max-width: 100%;
      overflow: hidden;
      flex-shrink: 0;
      min-height: 18px;
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
      line-height: 1;
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
      line-height: 1;
    }

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
      flex-shrink: 0;
      line-height: 1.3;
    }
    .pss-tile-bottom > span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .pss-tile-bottom .pss-divider { color: rgba(148, 163, 184, 0.5); flex-shrink: 0; }
    .pss-tile-bottom .pss-cta-mini {
      color: #ffd24a;
      font-weight: 800;
      font-size: 8.5px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      flex-shrink: 0;
    }
    .pss-tile-bottom .pss-cta-mini.soon { color: #94a3b8; }

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
      .pss-tile { width: 270px; min-width: 270px; max-width: 270px; padding: 10px 16px 12px; }
      .pss-team-name { font-size: 13px; }
      .pss-team-score { font-size: 14.5px; }
      .pss-team-logo, .pss-team-logo-placeholder { width: 20px; height: 20px; }
      .pss-team-row { min-height: 20px; }
    }

    /* ── 700px+ : EXPANDED FILTER ROW + slower scroll ─────────────── */
    @media (min-width: 700px) {
      #pbe-score-strip { height: 76px; }
      .pss-date { display: flex; }

      /* Hide the mobile trigger, show the full row */
      .pss-filter-trigger { display: none; }
      .pss-filter-dropdown { display: none !important; }
      .pss-filter-row {
        display: flex;
        gap: 3px;
      }
      .pss-filter { padding: 0 10px; }

      .pss-tile { width: 290px; min-width: 290px; max-width: 290px; padding: 9px 18px 11px; }
      .pss-team-row { font-size: 13.5px; min-height: 22px; }
      .pss-team-score { font-size: 15px; }
      .pss-tile-top { font-size: 10px; padding-right: 36px; }
      .pss-tile-bottom { font-size: 9.5px; }
      .pss-team-logo, .pss-team-logo-placeholder { width: 22px; height: 22px; }
      .pss-filter-btn { padding: 4px 9px; font-size: 10px; letter-spacing: 0.06em; }
      .pss-rail.pss-marquee-on { animation-duration: 45s; }
    }

    /* ── 1024px+ ──────────────────────────────────────────────────── */
    @media (min-width: 1024px) {
      #pbe-score-strip { height: 76px; }
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
  const letters = (team.abbr || team.name || '?').slice(0, 3).toUpperCase();
  return `<div class="pss-team-logo-placeholder">${escape(letters)}</div>`;
}

function gameSignature(g) {
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
function tileHTML(g) {
  const accent = SPORT_ACCENTS[g.sport] || '#94a3b8';
  const target = SPORT_TARGETS[g.sport] || {};
  const sportTag = SPORT_BADGE[g.sport] || '';
  const ctaText = target.live ? 'Picks live' : 'Free access';
  const ctaCls = target.live ? '' : 'soon';

  const topLine = renderTopLine(g);
  const awayRow = renderTeamRow(g, 'away');
  const homeRow = renderTeamRow(g, 'home');
  const bottomLine = renderBottomLine(g, ctaText, ctaCls);

  return `
    <a class="pss-tile" href="${escape(tileHref(g))}" data-sport="${g.sport}"
       data-game-id="${escape(String(g.gameId || ''))}"
       title="${escape(tileTitle(g))}">
      <span class="pss-tile-accent" style="background:${accent}"></span>
      <span class="pss-sport-tag">${escape(sportTag)}</span>
      <div class="pss-tile-top">${topLine}</div>
      ${awayRow}
      ${homeRow}
      <div class="pss-tile-bottom">${bottomLine}</div>
    </a>
  `;
}

function renderTopLine(g) {
  const topLabel = g.state === 'live' ? (g.statusText || 'Live')
                 : g.state === 'final' ? ''
                 : (g.statusText || 'TBD');
  if (g.state === 'live') {
    return `<span class="pss-status-inline live">LIVE</span><span>${escape(topLabel)}</span>`;
  } else if (g.state === 'final') {
    return `<span class="pss-status-inline final">FINAL</span>`;
  } else {
    return `<span>${escape(topLabel)}</span>`;
  }
}

function renderTeamRow(g, side) {
  const me = g[side];
  const them = g[side === 'away' ? 'home' : 'away'];
  const meScoreShown = me.score !== '' && me.score !== null && me.score !== undefined;
  const themScoreShown = them.score !== '' && them.score !== null && them.score !== undefined;
  const showScores = meScoreShown || themScoreShown;
  const isFinal = g.state === 'final' && showScores;
  const won = isFinal && parseInt(me.score) > parseInt(them.score);
  const lost = isFinal && parseInt(me.score) < parseInt(them.score);
  const winnerClass = won ? ' winner' : lost ? ' loser' : '';
  const display = me.abbr || me.name || '—';

  return `
    <div class="pss-team-row${winnerClass}" data-side="${side}">
      <span class="pss-team-id">
        ${teamLogoHTML(me, g.sport)}
        <span class="pss-team-name">
          ${escape(display)}${me.record ? `<span class="pss-team-record">${escape(me.record)}</span>` : ''}
        </span>
      </span>
      ${showScores ? `<span class="pss-team-score">${escape(me.score ?? '')}</span>` : ''}
    </div>
  `;
}

function renderBottomLine(g, ctaText, ctaCls) {
  const pitcherLine = buildPitcherLine(g);
  if (pitcherLine) {
    return `
      <span>${escape(pitcherLine)}</span>
      <span class="pss-divider">·</span>
      <span class="pss-cta-mini ${ctaCls}">${escape(ctaText)}</span>
    `;
  }
  return `<span class="pss-cta-mini ${ctaCls}">${escape(ctaText)}</span>`;
}

/* ─────────────────────────────────────────────────────────────────────────
 * IN-PLACE TILE UPDATE — preserves marquee animation
 * ────────────────────────────────────────────────────────────────────────*/
function updateTileInPlace(tileEl, g) {
  if (!tileEl) return;

  const topEl = tileEl.querySelector('.pss-tile-top');
  if (topEl) topEl.innerHTML = renderTopLine(g);

  ['away', 'home'].forEach(side => {
    const rowEl = tileEl.querySelector(`.pss-team-row[data-side="${side}"]`);
    if (!rowEl) return;

    const me = g[side];
    const them = g[side === 'away' ? 'home' : 'away'];
    const showScores = (me.score !== '' && me.score !== null && me.score !== undefined)
                    || (them.score !== '' && them.score !== null && them.score !== undefined);
    const isFinal = g.state === 'final' && showScores;
    const won = isFinal && parseInt(me.score) > parseInt(them.score);
    const lost = isFinal && parseInt(me.score) < parseInt(them.score);

    rowEl.classList.toggle('winner', won);
    rowEl.classList.toggle('loser', lost);

    let scoreEl = rowEl.querySelector('.pss-team-score');
    if (showScores) {
      if (!scoreEl) {
        scoreEl = document.createElement('span');
        scoreEl.className = 'pss-team-score';
        rowEl.appendChild(scoreEl);
      }
      scoreEl.textContent = me.score ?? '';
    } else if (scoreEl) {
      scoreEl.remove();
    }
  });

  const target = SPORT_TARGETS[g.sport] || {};
  const ctaText = target.live ? 'Picks live' : 'Free access';
  const ctaCls = target.live ? '' : 'soon';
  const bottomEl = tileEl.querySelector('.pss-tile-bottom');
  if (bottomEl) bottomEl.innerHTML = renderBottomLine(g, ctaText, ctaCls);
}

function flashTile(tileEl) {
  if (!tileEl) return;
  tileEl.classList.remove('pss-tile-updated');
  void tileEl.offsetWidth;
  tileEl.classList.add('pss-tile-updated');
}

/* ─────────────────────────────────────────────────────────────────────────
 * RENDER / UPDATE
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
    _renderedGameIds = new Set();
    _gameSnapshot = new Map();
    return;
  }

  const newIds = new Set(ordered.map(g => String(g.gameId || '')));
  const sameSet = newIds.size === _renderedGameIds.size
    && [...newIds].every(id => _renderedGameIds.has(id));

  if (sameSet && railEl.querySelector('.pss-tile')) {
    // IN-PLACE UPDATE — marquee keeps scrolling
    const newSnapshot = new Map();
    for (const g of ordered) {
      const id = String(g.gameId || '');
      const sig = gameSignature(g);
      newSnapshot.set(id, sig);

      const tiles = railEl.querySelectorAll(`.pss-tile[data-game-id="${CSS.escape(id)}"]`);
      tiles.forEach(tileEl => {
        updateTileInPlace(tileEl, g);
        if (_gameSnapshot.has(id) && _gameSnapshot.get(id) !== sig) {
          flashTile(tileEl);
        }
      });
    }
    _gameSnapshot = newSnapshot;
    return;
  }

  // FULL REBUILD — set of games changed
  const tiles = ordered.map(tileHTML).join('');
  railEl.classList.remove('pss-marquee-on');
  railEl.innerHTML = tiles;

  _renderedGameIds = newIds;
  const newSnapshot = new Map();
  for (const g of ordered) {
    newSnapshot.set(String(g.gameId || ''), gameSignature(g));
  }
  _gameSnapshot = newSnapshot;

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
  // Update mobile trigger label
  const trigger = document.querySelector('.pss-filter-trigger');
  if (trigger) {
    trigger.firstChild.nodeValue = _activeFilter === 'all' ? 'All' : _activeFilter.toUpperCase();
  }
}

/* ─────────────────────────────────────────────────────────────────────────
 * ADAPTIVE POLLING
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

  const triggerLabel = _activeFilter === 'all' ? 'All' : _activeFilter.toUpperCase();

  return `
    <div id="pbe-score-strip" role="region" aria-label="Live scores across MLB, NBA, NHL, NFL">
      <div class="pss-filter">
        <button class="pss-filter-trigger" type="button" aria-haspopup="true" aria-expanded="false">${triggerLabel}</button>
        <div class="pss-filter-dropdown" role="menu">${filterButtons}</div>
        <div class="pss-filter-row">${filterButtons}</div>
      </div>
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
    // Filter button clicks (works for both mobile dropdown + desktop row)
    strip.addEventListener('click', e => {
      // Trigger button toggles the dropdown
      const trigger = e.target.closest('.pss-filter-trigger');
      if (trigger) {
        e.preventDefault();
        const dd = strip.querySelector('.pss-filter-dropdown');
        const isOpen = dd?.classList.toggle('open');
        trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        return;
      }

      const btn = e.target.closest('.pss-filter-btn');
      if (!btn) return;
      e.preventDefault();
      _activeFilter = btn.dataset.filter;
      _renderedGameIds = new Set(); // force rebuild on filter change
      paintFilters();
      paint();
      // Close mobile dropdown after selection
      const dd = strip.querySelector('.pss-filter-dropdown');
      if (dd?.classList.contains('open')) {
        dd.classList.remove('open');
        const trig = strip.querySelector('.pss-filter-trigger');
        trig?.setAttribute('aria-expanded', 'false');
      }
    });

    // Close dropdown on outside click
    document.addEventListener('click', e => {
      if (e.target.closest('#pbe-score-strip')) return;
      const dd = strip.querySelector('.pss-filter-dropdown');
      if (dd?.classList.contains('open')) {
        dd.classList.remove('open');
        const trig = strip.querySelector('.pss-filter-trigger');
        trig?.setAttribute('aria-expanded', 'false');
      }
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
