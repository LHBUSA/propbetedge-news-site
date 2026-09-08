/**
 * src/components/header.js
 * Editorial masthead with PBE chrome logo + header banner ad
 */
import { ad_header_banner, PROPBET_LINKS } from '../ads-config.js';
import { renderScoreStripShell, mountScoreStrip } from './score-strip.js';

const EV_FINDER_URL = 'https://propbetedge-ev-finder.sales-fd3.workers.dev/edges-today';
let _edgeCountFetched = false;

const INTELLIGENCE_PRODUCTS = Object.freeze([
  {
    key: 'mlb',
    emoji: '⚾',
    label: 'MLB Intelligence',
    href: PROPBET_LINKS.picks_mlb,
    domain: 'mlb.propbetedge.ai',
    blurb: 'Live models, player research, props and game context',
  },
  {
    key: 'nfl',
    emoji: '🏈',
    label: 'NFL Intelligence',
    href: PROPBET_LINKS.picks_nfl,
    domain: 'nfl.propbetedge.ai',
    blurb: 'Market Board, Model Lab, simulation and live football context',
  },
  {
    key: 'ufc',
    emoji: '🥊',
    label: 'UFC Intelligence',
    href: PROPBET_LINKS.picks_ufc,
    domain: 'ufc.propbetedge.ai',
    blurb: 'Fight DNA, matchup research, rankings and fight-week intelligence',
  },
]);

export function renderHeader() {
  const path = window.location.pathname;
  const isLive = path === '/games' || path.startsWith('/games/');
  const isLeaders = path === '/leaders' || path.startsWith('/leaders/');
  const isOdds = path === '/odds';
  const sport = inferSport(path);

  if (typeof window !== 'undefined') {
    queueMicrotask(() => {
      if (document.getElementById('pbe-score-strip')) {
        mountScoreStrip().catch(err => console.warn('[header] score strip mount failed:', err));
      }
      if (!_edgeCountFetched) {
        _edgeCountFetched = true;
        fetchEdgeCount().catch(err => console.warn('[header] edge count fetch failed:', err));
      }
    });
  }

  return `
    ${renderScoreStripShell()}
    ${ad_header_banner(sport ? { sport } : {})}
    <header class="masthead">
      <div class="container masthead-inner">
        <div class="masthead-left masthead-leagues" aria-label="League coverage and search">
          <button type="button" class="nav-link pbe-search-trigger masthead-search masthead-search-desktop" data-pbe-search-open aria-label="Search PropBetEdge" aria-keyshortcuts="Control+K Meta+K /">
            <span class="masthead-search-icon" aria-hidden="true">⌕</span><span class="pbe-search-label">Search</span><kbd>/</kbd>
          </button>
          <span class="masthead-nav-divider" aria-hidden="true"></span>
          <a href="/news" class="nav-link ${path === '/news' ? 'active' : ''}">All News</a>
          <a href="/news/mlb" class="nav-link ${sportPathActive(path, 'mlb') ? 'active' : ''}">MLB</a>
          <a href="/news/nfl" class="nav-link ${sportPathActive(path, 'nfl') ? 'active' : ''}">NFL</a>
          <a href="${PROPBET_LINKS.news_ufc}" class="nav-link" target="_blank" rel="noopener">UFC</a>
          <a href="/news/nba" class="nav-link ${sportPathActive(path, 'nba') ? 'active' : ''}">NBA</a>
          <a href="/news/nhl" class="nav-link ${sportPathActive(path, 'nhl') ? 'active' : ''}">NHL</a>
        </div>
        <div class="masthead-logo" aria-label="PropBetEdge">
          <img
            src="/logo/pbe-mark-160.png"
            srcset="/logo/pbe-mark-80.png 1x, /logo/pbe-mark-160.png 2x, /logo/pbe-mark-240.png 3x"
            alt="PropBetEdge"
            class="masthead-mark"
            width="207" height="80"
          />
          <span class="tagline">Sports News &middot; Prop-Bet Intelligence</span>
        </div>
        <div class="masthead-right masthead-tools" aria-label="PropBetEdge tools">
          <a href="/games" class="nav-link live-link ${isLive ? 'active' : ''}">PBEcast</a>
          <a href="/leaders" class="nav-link ${isLeaders ? 'active' : ''}">Leaders</a>
          <a href="/odds" class="nav-link edges-link ${isOdds ? 'active' : ''}">
            <span class="edges-bolt">⚡</span><span class="edges-label">Edges</span><span class="edges-count" id="edges-count" aria-live="polite"></span>
          </a>
          ${renderIntelligenceSwitcher(sport)}
          <button type="button" class="nav-link pbe-search-trigger masthead-search masthead-search-mobile" data-pbe-search-open aria-label="Search PropBetEdge" aria-keyshortcuts="Control+K Meta+K /">
            <span class="masthead-search-icon" aria-hidden="true">⌕</span><span class="pbe-search-label">Search</span>
          </button>
        </div>
      </div>
    </header>
  `;
}

function renderIntelligenceSwitcher(activeSport) {
  return `
    <details class="pbe-intel-switcher">
      <summary class="pbe-intel-summary">
        <span class="pbe-intel-live-dot" aria-hidden="true"></span>
        <span>Live Intelligence</span>
        <span class="pbe-intel-chevron" aria-hidden="true">⌄</span>
      </summary>
      <div class="pbe-intel-menu" role="menu" aria-label="Choose a live PropBetEdge intelligence product">
        <div class="pbe-intel-menu-head">
          <span>PROP BET EDGE NETWORK</span>
          <strong>Choose your live intelligence layer</strong>
        </div>
        ${INTELLIGENCE_PRODUCTS.map(product => `
          <a class="pbe-intel-option${activeSport === product.key ? ' is-active' : ''}" href="${product.href}" target="_blank" rel="noopener" role="menuitem">
            <span class="pbe-intel-option-icon" aria-hidden="true">${product.emoji}</span>
            <span class="pbe-intel-option-copy">
              <strong>${product.label}</strong>
              <small>${product.blurb}</small>
              <em>${product.domain}</em>
            </span>
            <span class="pbe-intel-option-live">LIVE ↗</span>
          </a>
        `).join('')}
      </div>
    </details>
  `;
}

function sportPathActive(path, sport) {
  return inferSport(path) === sport;
}

function inferSport(path) {
  const match = String(path || '').match(/\/(?:news|games|leaders|team|standings|player)\/(mlb|nfl|ufc|nba|nhl)(?:\/|$)/i);
  return match?.[1]?.toLowerCase() || null;
}

async function fetchEdgeCount() {
  try {
    const r = await fetch(EV_FINDER_URL, { cache: 'no-store' });
    if (!r.ok) return;
    const data = await r.json();
    const count = data.total_alerts || 0;
    const el = document.getElementById('edges-count');
    if (!el) return;
    if (count > 0) {
      el.textContent = String(count);
      el.classList.add('has-edges');
    } else {
      el.textContent = '';
      el.classList.remove('has-edges');
    }
  } catch {
    // Silent fail — count badge just won't appear
  }
}
