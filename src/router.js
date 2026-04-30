/**
 * src/router.js
 *
 * v3.11 additions:
 *   /games                     → live scoreboard hub
 *   /games/:sport/:gameId      → game detail
 *   /leaders                   → ESPN-style stat leaders
 *   /team/:sport/:teamId       → v2 stub
 *   /standings/:sport          → v2 stub
 *
 * v3.12 additions:
 *   /leaders/:sport            → per-sport deep leaderboards (mlb/nhl/nba/nfl)
 *
 * v3.13 Drop 1 additions:
 *   /player/:sport/:playerId   → real bet-focused player profiles (replaces stub)
 *
 * Everything pre-existing is unchanged.
 */

import { renderHome } from './pages/home.js';
import { renderNewsIndex } from './pages/news-index.js';
import { renderSport } from './pages/sport.js';
import { renderArticle } from './pages/article.js';
import { renderAuthor } from './pages/author.js';
import { renderEditorialStandards } from './pages/editorial-standards.js';
import { renderNotFound } from './pages/404.js';
import { renderGamesHub } from './pages/games-hub.js';
import { renderGameDetail } from './pages/game-detail.js';
import { renderLeadersPage } from './pages/leaders.js';
// v3.12 — per-sport leader pages
import { renderMlbLeadersPage } from './pages/leaders-mlb.js';
import { renderNhlLeadersPage } from './pages/leaders-nhl.js';
import { renderNbaLeadersPage } from './pages/leaders-nba.js';
import { renderNflLeadersPage } from './pages/leaders-nfl.js';
// v3.13 Drop 1 — player profile pages
import { renderMlbPlayerPage } from './pages/player-mlb.js';
import { renderNhlPlayerPage } from './pages/player-nhl.js';
import { renderNbaPlayerPage } from './pages/player-nba.js';
import { renderNflPlayerPage } from './pages/player-nfl.js';

const VALID_SPORTS = new Set(['mlb', 'nfl', 'nba', 'nhl']);

function setMeta({ title, description, canonical, ogImage }) {
  if (title) document.title = title;
  if (description) {
    setOrCreateMeta('name', 'description', description);
    setOrCreateMeta('property', 'og:description', description);
    setOrCreateMeta('name', 'twitter:description', description);
  }
  if (title) {
    setOrCreateMeta('property', 'og:title', title);
    setOrCreateMeta('name', 'twitter:title', title);
  }
  if (canonical) {
    let link = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = canonical;
    setOrCreateMeta('property', 'og:url', canonical);
  }
  if (ogImage) {
    setOrCreateMeta('property', 'og:image', ogImage);
    setOrCreateMeta('name', 'twitter:image', ogImage);
  }
}

function setOrCreateMeta(attr, name, value) {
  let el = document.querySelector(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
}

function clearAndRoute() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const root = document.getElementById('app');
  window.scrollTo({ top: 0, behavior: 'instant' });

  if (path === '/' || path === '') {
    setMeta({
      title: 'PropBetEdge — Sports News & Prop-Bet Intelligence',
      description: 'Editorial sports journalism with AI prop-bet impact analysis. MLB, NFL, NBA, NHL.',
      canonical: 'https://propbetedge.ai/',
    });
    return renderHome(root);
  }

  if (path === '/news') {
    setMeta({
      title: 'All Sports News — PropBetEdge',
      description: 'Latest sports news across MLB, NFL, NBA, and NHL with AI prop-bet impact analysis.',
      canonical: 'https://propbetedge.ai/news',
    });
    return renderNewsIndex(root);
  }

  // 🆕 Live Games hub
  if (path === '/games') {
    setMeta({
      title: 'Live Games — PropBetEdge',
      description: 'Live scores across MLB, NBA, NHL, and NFL. Powered by PropSports API.',
      canonical: 'https://propbetedge.ai/games',
    });
    return renderGamesHub(root);
  }

  // 🆕 Stat Leaders page (root — redirects to /leaders/mlb)
  if (path === '/leaders') {
    setMeta({
      title: 'Stat Leaders — PropBetEdge',
      description: 'Top performers across MLB, NHL, NBA, and NFL — sourced from official league APIs.',
      canonical: 'https://propbetedge.ai/leaders',
    });
    return renderLeadersPage(root);
  }

  // 🆕 v3.12 — Per-sport leaderboards: /leaders/mlb, /leaders/nhl, /leaders/nba, /leaders/nfl
  const leadersMatch = path.match(/^\/leaders\/(mlb|nhl|nba|nfl)$/);
  if (leadersMatch) {
    const sport = leadersMatch[1].toLowerCase();
    const sportLabel = sport.toUpperCase();
    setMeta({
      title: `${sportLabel} Stat Leaders — PropBetEdge`,
      description: `${sportLabel} leaders — basic + advanced stats, prop-bet impact analysis.`,
      canonical: `https://propbetedge.ai/leaders/${sport}`,
    });
    if (sport === 'mlb') return renderMlbLeadersPage(root);
    if (sport === 'nhl') return renderNhlLeadersPage(root);
    if (sport === 'nba') return renderNbaLeadersPage(root);
    if (sport === 'nfl') return renderNflLeadersPage(root);
  }

  // 🆕 Game detail: /games/:sport/:gameId
  const gameMatch = path.match(/^\/games\/([a-z]+)\/([\w-]+)$/);
  if (gameMatch) {
    const sport = gameMatch[1].toLowerCase();
    const gameId = gameMatch[2];
    if (!VALID_SPORTS.has(sport)) return renderNotFound(root);
    return renderGameDetail(root, sport, gameId);
  }

  const sportMatch = path.match(/^\/news\/([a-z]+)$/);
  if (sportMatch) {
    const sport = sportMatch[1].toLowerCase();
    if (!VALID_SPORTS.has(sport)) return renderNotFound(root);
    const sportLabel = sport.toUpperCase();
    setMeta({
      title: `${sportLabel} News — PropBetEdge`,
      description: `Latest ${sportLabel} news with AI prop-bet impact analysis.`,
      canonical: `https://propbetedge.ai/news/${sport}`,
    });
    return renderSport(root, sport);
  }

  const articleMatch = path.match(/^\/news\/([a-z]+)\/([^\/]+)$/);
  if (articleMatch) {
    const sport = articleMatch[1].toLowerCase();
    const slug = articleMatch[2];
    if (!VALID_SPORTS.has(sport)) return renderNotFound(root);
    return renderArticle(root, sport, slug, setMeta);
  }

  // 🆕 Author profile: /authors/:slug
  const authorMatch = path.match(/^\/authors\/([a-z0-9-]+)$/);
  if (authorMatch) {
    const slug = authorMatch[1];
    return renderAuthor(root, slug, setMeta);
  }

  // 🆕 Editorial Standards page (referenced by Org schema policy URLs)
  if (path === '/editorial-standards') {
    return renderEditorialStandards(root, setMeta);
  }

  // ── v2 stub routes (added v3.11) ─────────────────────────────────────
  // Team + standings stubs remain — those are Drop 2 + Drop 3.

  const teamMatch = path.match(/^\/team\/([a-z]+)\/([\w-]+)$/);
  if (teamMatch) {
    const sport = teamMatch[1].toLowerCase();
    if (!VALID_SPORTS.has(sport)) return renderNotFound(root);
    setMeta({
      title: `${sport.toUpperCase()} Team — PropBetEdge`,
      description: 'Team page coming soon — roster, stats, schedule, standings.',
    });
    return renderComingSoon(root, {
      kicker: `${sport.toUpperCase()} TEAM PAGE`,
      title: 'Team pages launching soon',
      dek: 'Roster, stats, schedule, and standings — coming next. For now, head back to live games or check the latest news.',
      cta: { href: '/games', label: '← Back to live games' },
    });
  }

  const standingsMatch = path.match(/^\/standings\/([a-z]+)$/);
  if (standingsMatch) {
    const sport = standingsMatch[1].toLowerCase();
    if (!VALID_SPORTS.has(sport)) return renderNotFound(root);
    setMeta({
      title: `${sport.toUpperCase()} Standings — PropBetEdge`,
      description: 'Standings tables coming soon.',
    });
    return renderComingSoon(root, {
      kicker: `${sport.toUpperCase()} STANDINGS`,
      title: 'Standings tables coming soon',
      dek: 'Division and conference standings, Wild Card races, and full season splits — launching next sprint.',
      cta: { href: '/games', label: '← Back to live games' },
    });
  }

  // 🆕 v3.13 Drop 1 — Real player pages (replaces v3.11 stub)
  const playerMatch = path.match(/^\/player\/([a-z]+)\/([\w-]+)$/);
  if (playerMatch) {
    const sport = playerMatch[1].toLowerCase();
    const playerId = playerMatch[2];
    if (!VALID_SPORTS.has(sport)) return renderNotFound(root);
    if (sport === 'mlb') return renderMlbPlayerPage(root, playerId, setMeta);
    if (sport === 'nhl') return renderNhlPlayerPage(root, playerId, setMeta);
    if (sport === 'nba') return renderNbaPlayerPage(root, playerId, setMeta);
    if (sport === 'nfl') return renderNflPlayerPage(root, playerId, setMeta);
  }

  setMeta({ title: 'Not found — PropBetEdge', description: 'Page not found.' });
  return renderNotFound(root);
}

// "Coming soon" renderer for v2 stub routes. Uses the leaders-hero styles.
function renderComingSoon(root, opts) {
  root.innerHTML = `
    <main>
      <div class="container">
        <div class="leaders-hero" style="margin-top:32px">
          <div class="leaders-hero-mesh"></div>
          <div class="leaders-hero-inner">
            <div class="leaders-hero-kicker">
              <span class="live-dot-big" style="background:var(--gold);box-shadow:0 0 0 0 rgba(212,175,55,0.5)"></span>
              <span>${opts.kicker}</span>
            </div>
            <h1 class="leaders-hero-title">${opts.title}</h1>
            <p class="leaders-hero-dek">${opts.dek}</p>
            <p style="margin-top:18px">
              <a href="${opts.cta.href}" style="color:var(--gold);font-size:15px;font-weight:600;text-decoration:none">${opts.cta.label}</a>
            </p>
          </div>
        </div>
      </div>
    </main>
  `;
}

export function navigate(href) {
  if (href.startsWith('http://') || href.startsWith('https://')) {
    if (!href.startsWith('https://propbetedge.ai')) {
      window.location.href = href;
      return;
    }
    href = href.replace(/^https:\/\/propbetedge\.ai/, '');
  }
  window.history.pushState({}, '', href);
  clearAndRoute();
}

export function initRouter() {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href) return;
    if (a.target === '_blank' || a.hasAttribute('download')) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    if (href.startsWith('http://') || href.startsWith('https://')) {
      if (!href.startsWith('https://propbetedge.ai')) return;
    }
    if (href.startsWith('mailto:') || href.startsWith('tel:')) return;
    if (href.startsWith('#')) return;
    e.preventDefault();
    navigate(href);
  });

  window.addEventListener('popstate', clearAndRoute);
  clearAndRoute();
}

export { setMeta };
