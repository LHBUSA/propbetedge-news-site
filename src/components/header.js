/**
 * src/components/header.js
 * Editorial masthead — world-class redesign
 *
 * v3.16: 🆕 World-class redesign
 *        - Centered logo with tagline tucked beside it (italic mono)
 *        - Two-tier nav: Premium features (Edges/Live Games/Picks) on top,
 *          editorial sport tabs + Leaders below
 *        - Live edge counter on Edges link (auto-fetches from EV Finder)
 *        - Subtle radial gradient backdrop behind logo for depth
 *        - Gold hairline separator instead of red bar
 *        - Single accent color (gold) used purposefully
 *        - Picks → as gold pill, the only button-style CTA
 *
 * v3.14: Sticky multi-sport SCORE STRIP at top
 * v3.11: renamed "Live" → "Live Games" + added Leaders nav link
 * v3.10: added 🔴 Live link pointing to /games scoreboard hub
 */
import { ad_header_banner } from '../ads-config.js';
import { renderScoreStripShell, mountScoreStrip } from './score-strip.js';

const EV_FINDER_URL = 'https://propbetedge-ev-finder.sales-fd3.workers.dev/edges-today';
let _edgeCountFetched = false;

export function renderHeader() {
  const path = window.location.pathname;
  const isLive    = path === '/games'   || path.startsWith('/games/');
  const isLeaders = path === '/leaders' || path.startsWith('/leaders/');
  const isOdds    = path === '/odds';
  const isAllNews = path === '/news';
  const isMlb     = path.startsWith('/news/mlb');
  const isNfl     = path.startsWith('/news/nfl');
  const isNba     = path.startsWith('/news/nba');
  const isNhl     = path.startsWith('/news/nhl');

  // Schedule the score-strip mount + edge-count fetch for next tick
  if (typeof window !== 'undefined') {
    queueMicrotask(() => {
      if (document.getElementById('pbe-score-strip')) {
        mountScoreStrip().catch(err => console.warn('[header] score strip mount failed:', err));
      }
      // Fetch edge count once per page load
      if (!_edgeCountFetched) {
        _edgeCountFetched = true;
        fetchEdgeCount().catch(err => console.warn('[header] edge count fetch failed:', err));
      }
    });
  }

  return `
    ${renderScoreStripShell()}
    ${ad_header_banner()}
    <header class="masthead-v316">
      <div class="masthead-v316-bg"></div>
      <div class="container masthead-v316-inner">

        <a href="/" class="masthead-v316-logo-row" aria-label="PropBetEdge home">
          <img
            src="/logo/pbe-mark-160.png"
            srcset="/logo/pbe-mark-80.png 1x, /logo/pbe-mark-160.png 2x, /logo/pbe-mark-240.png 3x"
            alt="PropBetEdge"
            class="masthead-v316-mark"
            width="156" height="60"
          />
          <span class="masthead-v316-tagline">Sports News &middot; Prop-Bet Intelligence</span>
        </a>

        <nav class="masthead-v316-primary" aria-label="Primary">
          <a href="/odds" class="primary-link primary-link-edges ${isOdds ? 'active' : ''}">
            <span class="primary-link-bolt">⚡</span>
            <span class="primary-link-label">Edges</span>
            <span class="primary-link-count" id="edges-count" aria-live="polite"></span>
          </a>
          <span class="primary-divider"></span>
          <a href="/games" class="primary-link primary-link-live ${isLive ? 'active' : ''}">
            <span class="primary-link-livedot"></span>
            <span class="primary-link-label">Live Games</span>
          </a>
          <span class="primary-divider"></span>
          <a href="https://mlb.propbetedge.ai" class="primary-link primary-link-cta">
            Picks <span aria-hidden="true">&rarr;</span>
          </a>
        </nav>

        <nav class="masthead-v316-secondary" aria-label="Sections">
          <a href="/news" class="secondary-link ${isAllNews ? 'active' : ''}">All News</a>
          <span class="secondary-dot">&middot;</span>
          <a href="/news/mlb" class="secondary-link ${isMlb ? 'active' : ''}">MLB</a>
          <a href="/news/nfl" class="secondary-link ${isNfl ? 'active' : ''}">NFL</a>
          <a href="/news/nba" class="secondary-link ${isNba ? 'active' : ''}">NBA</a>
          <a href="/news/nhl" class="secondary-link ${isNhl ? 'active' : ''}">NHL</a>
          <span class="secondary-dot">&middot;</span>
          <a href="/leaders" class="secondary-link ${isLeaders ? 'active' : ''}">Leaders</a>
        </nav>

      </div>
      <div class="masthead-v316-hairline"></div>
    </header>
  `;
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
      el.textContent = `${count} LIVE`;
      el.classList.add('has-edges');
    } else {
      el.textContent = '';
      el.classList.remove('has-edges');
    }
  } catch (e) {
    // Silent fail - count badge just won't appear
  }
}
