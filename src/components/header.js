/**
 * src/components/header.js
 * Editorial masthead with PBE chrome logo + header banner ad
 */
import { ad_header_banner, PROPBET_LINKS } from '../ads-config.js';
import { renderScoreStripShell, mountScoreStrip } from './score-strip.js';

const EV_FINDER_URL = 'https://propbetedge-ev-finder.sales-fd3.workers.dev/edges-today';
let _edgeCountFetched = false;

export function renderHeader() {
  const path = window.location.pathname;
  const isLive    = path === '/games'   || path.startsWith('/games/');
  const isLeaders = path === '/leaders' || path.startsWith('/leaders/');
  const isOdds    = path === '/odds';
  const sport = inferSport(path);
  const primaryCta = headerCtaForSport(sport);

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
          <a href="${primaryCta.href}" class="nav-link cta"${primaryCta.external ? ' target="_blank" rel="noopener"' : ''}>${primaryCta.label} &rarr;</a>
        </div>
      </div>
    </header>
  `;
}

function inferSport(path) {
  const match = String(path || '').match(/\/(?:news|games|leaders)\/(mlb|nfl|nba|nhl)(?:\/|$)/i);
  return match?.[1]?.toLowerCase() || null;
}

function headerCtaForSport(sport) {
  if (sport === 'mlb') return { href: PROPBET_LINKS.picks_mlb, label: 'MLB Intelligence', external: true };
  if (sport === 'nfl') return { href: PROPBET_LINKS.picks_nfl, label: 'NFL Intelligence', external: true };
  if (sport === 'nba') return { href: '/news/nba', label: 'NBA · Coming Soon', external: false };
  if (sport === 'nhl') return { href: '/news/nhl', label: 'NHL · Coming Soon', external: false };

  // NFL is the network's next major launch, so generic surfaces should point
  // football-first while sport-specific pages continue to respect context.
  return { href: PROPBET_LINKS.picks_nfl, label: 'NFL Intelligence', external: true };
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
