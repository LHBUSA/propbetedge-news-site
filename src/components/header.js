/**
 * src/components/header.js
 * Editorial masthead with PBE chrome logo + header banner ad
 *
 * v3.10: 🆕 added 🔴 Live link pointing to /games scoreboard hub
 * v3.11: renamed "Live" → "Live Games" + added Leaders nav link
 */
import { ad_header_banner } from '../ads-config.js';
export function renderHeader() {
  const path = window.location.pathname;
  const todayLong = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  const time = new Date().toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
  });
  const isLive    = path === '/games'   || path.startsWith('/games/');
  const isLeaders = path === '/leaders' || path.startsWith('/leaders/');
  return `
    <div class="topbar">
      <div class="container topbar-inner">
        <span><span class="live-dot"></span>Live · ${time} ET</span>
        <span>${todayLong}</span>
      </div>
    </div>
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
          <span class="tagline">Sports News · Prop-Bet Intelligence</span>
        </a>
        <div class="masthead-right">
          <a href="/news/nba" class="nav-link ${path.startsWith('/news/nba') ? 'active' : ''}">NBA</a>
          <a href="/news/nhl" class="nav-link ${path.startsWith('/news/nhl') ? 'active' : ''}">NHL</a>
          <a href="/games" class="nav-link live-link ${isLive ? 'active' : ''}">Live Games</a>
          <a href="/leaders" class="nav-link ${isLeaders ? 'active' : ''}">Leaders</a>
          <a href="https://mlb.propbetedge.ai" class="nav-link cta">Picks →</a>
        </div>
      </div>
    </header>
  `;
}
