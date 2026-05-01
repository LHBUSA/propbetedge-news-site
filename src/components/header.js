/**
 * src/components/header.js
 * Editorial masthead with PBE chrome logo + header banner ad
 *
 * v3.16: 🆕 Added ⚡ Edges link → /odds (with live edge counter)
 *        🆕 Renamed "Live Games" → "PBEcast" (branded)
 *        🆕 Contrast tuning on nav links (was too dim)
 *
 * v3.14: 🆕 Replaced thin topbar with sticky multi-sport SCORE STRIP
 *        (ESPN-pattern). Same vertical real estate, way more conversion value.
 *        Auto-fetches from PropSports API, refreshes every 60s.
 *        MLB tiles → /games/mlb/{id} (paywall funnel via game-detail page)
 *        NFL/NBA/NHL tiles → their respective subdomains.
 * v3.11: renamed "Live" → "Live Games" + added Leaders nav link
 * v3.10: 🆕 added 🔴 Live link pointing to /games scoreboard hub
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

  // Schedule the score-strip mount + edge-count fetch for the next tick — by then
  // the header HTML is in the DOM. Idempotent: mountScoreStrip() guards against
  // double-wiring. Using queueMicrotask so it fires before the next paint.
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
    ${ad_header_banner()}
    <header class="masthead">
      <div class="container masthead-inner">
        <div class="masthead-left">
          <a href="/news" class="nav-link ${path === '/news' ? 'active' : ''}">All News</a>
          <a href="/news/mlb" class="nav-link ${path.startsWith('/news/mlb') ? 'active' : ''}">MLB</a>
          <a href="/news/nfl" class="nav-link ${path.startsWith('/news/nfl') ? 'active' : ''}">NFL</a>
        </div>
        <a href="/" class="masthead-logo" aria-label="PropBetEdge home">
          <img
            src="/logo/pbe-mark-160.png"
            srcset="/logo/pbe-mark-80.png 1x, /logo/pbe-mark-160.png 2x, /logo/pbe-mark-240.png 3x"
            alt="PropBetEdge"
            class="masthead-mark"
            width="207" height="80"
          />
          <span class="tagline">Sports News &middot; Prop-Bet Intelligence</span>
        </a>
        <div class="masthead-right">
          <a href="/news/nba" class="nav-link ${path.startsWith('/news/nba') ? 'active' : ''}">NBA</a>
          <a href="/news/nhl" class="nav-link ${path.startsWith('/news/nhl') ? 'active' : ''}">NHL</a>
          <a href="/games" class="nav-link live-link ${isLive ? 'active' : ''}">PBEcast</a>
          <a href="/leaders" class="nav-link ${isLeaders ? 'active' : ''}">Leaders</a>
          <a href="/odds" class="nav-link edges-link ${isOdds ? 'active' : ''}">
            <span class="edges-bolt">⚡</span><span class="edges-label">Edges</span><span class="edges-count" id="edges-count" aria-live="polite"></span>
          </a>
          <a href="https://mlb.propbetedge.ai" class="nav-link cta">Picks &rarr;</a>
        </div>
      </div>
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
      el.textContent = String(count);
      el.classList.add('has-edges');
    } else {
      el.textContent = '';
      el.classList.remove('has-edges');
    }
  } catch (e) {
    // Silent fail — count badge just won't appear
  }
}
