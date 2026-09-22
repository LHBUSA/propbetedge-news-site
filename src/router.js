/**
 * src/router.js
 *
 * v3.17 additions:
 *   /team/:sport/:team        → connected team intelligence hub
 *   /standings/:sport         → live standings with team entity links
 *
 * v3.16 additions:
 *   /odds                     → cross-sport free picks & model-edge sampler
 *
 * v3.15 additions:
 *   /news/page/N              → paginated all-news
 *   /news/:sport/page/N       → paginated per-sport
 *   Page 1 redirects to bare URL (canonicalization)
 */

import { renderHome } from './pages/home.js';
import { renderNewsIndex } from './pages/news-index.js';
import { renderSport } from './pages/sport.js';
import { renderArticle } from './pages/article.js';
import { renderAuthor } from './pages/author.js';
import { renderAuthorsIndex } from './pages/authors.js';
import { renderEditorialStandards } from './pages/editorial-standards.js';
import { renderAbout } from './pages/about.js';
import { renderNotFound } from './pages/404.js';
import { renderGamesHub } from './pages/games-hub.js';
import { renderGameDetail } from './pages/game-detail.js';
import { renderLeadersPage } from './pages/leaders.js';
import { renderMlbLeadersPage } from './pages/leaders-mlb.js';
import { renderNhlLeadersPage } from './pages/leaders-nhl.js';
import { renderNbaLeadersPage } from './pages/leaders-nba.js';
import { renderNflLeadersPage } from './pages/leaders-nfl.js';
import { renderWnbaLeadersPage } from './pages/leaders-wnba.js';
import { renderUfcChampionsPage } from './pages/leaders-ufc.js';
import { renderMlbPlayerPage } from './pages/player-mlb.js';
import { renderNhlPlayerPage } from './pages/player-nhl.js';
import { renderNbaPlayerPage } from './pages/player-nba.js';
import { renderNflPlayerPage } from './pages/player-nfl.js';
import { renderOdds } from './pages/odds.js';
import { renderFreePicksHistory } from './pages/free-picks-history.js';
import { renderTeamPage } from './pages/team.js';
import { renderStandingsPage } from './pages/standings.js';
import { liveCastUrl } from './live-cast-routes.js';

const VALID_SPORTS = new Set(['mlb', 'nfl', 'nba', 'nhl']);
const DEFAULT_OG_IMAGE = 'https://propbetedge.ai/logo/pbe-full-600.png';

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

  const socialImage = ogImage || DEFAULT_OG_IMAGE;
  setOrCreateMeta('property', 'og:image', socialImage);
  setOrCreateMeta('name', 'twitter:image', socialImage);
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

  if (path === '/odds') {
    setMeta({
      title: 'Free Picks — PropBetEdge',
      description: 'Free PropBetEdge picks across MLB, NFL, UFC, WNBA and NHL, including two MLB home run props plus current game and fight calls with market context when available.',
      canonical: 'https://propbetedge.ai/odds',
    });
    return renderOdds(root);
  }

  if (path === '/odds/history') {
    setMeta({
      title: 'Free Picks History — PropBetEdge',
      description: 'The complete public PropBetEdge free-picks ledger: every recorded free pick, result, score and settlement proof since tracking began September 20, 2026.',
      canonical: 'https://propbetedge.ai/odds/history',
    });
    return renderFreePicksHistory(root);
  }

  const newsPageMatch = path.match(/^\/news\/page\/(\d+)$/);
  if (newsPageMatch) {
    const page = parseInt(newsPageMatch[1], 10);
    if (page === 1) {
      window.history.replaceState({}, '', '/news');
      return renderNewsIndex(root, 1, setMeta);
    }
    return renderNewsIndex(root, page, setMeta);
  }

  const sportPageMatch = path.match(/^\/news\/([a-z]+)\/page\/(\d+)$/);
  if (sportPageMatch) {
    const sport = sportPageMatch[1].toLowerCase();
    const page = parseInt(sportPageMatch[2], 10);
    if (!VALID_SPORTS.has(sport)) return renderNotFound(root);
    if (page === 1) {
      window.history.replaceState({}, '', `/news/${sport}`);
      return renderSport(root, sport, 1, setMeta);
    }
    return renderSport(root, sport, page, setMeta);
  }

  if (path === '/news') return renderNewsIndex(root, 1, setMeta);

  if (path === '/games') {
    setMeta({
      title: 'Live Games — PropBetEdge',
      description: 'Live scores across MLB, NFL, NBA, WNBA and NHL, with NFL, WNBA and NHL games linked directly into their live PBEcast experiences. Powered by PropSports API.',
      canonical: 'https://propbetedge.ai/games',
    });
    return renderGamesHub(root);
  }

  if (path === '/leaders') {
    setMeta({
      title: 'Stat Leaders & UFC Champions — PropBetEdge',
      description: 'Live player leaderboards across MLB, WNBA, NFL, NHL and NBA, plus current UFC divisional champions.',
      canonical: 'https://propbetedge.ai/leaders',
    });
    return renderLeadersPage(root);
  }

  const leadersMatch = path.match(/^\/leaders\/(mlb|wnba|nfl|nhl|nba|ufc)$/);
  if (leadersMatch) {
    const sport = leadersMatch[1].toLowerCase();
    const sportLabel = sport.toUpperCase();
    setMeta({
      title: sport === 'ufc' ? 'UFC Champions — PropBetEdge' : `${sportLabel} Stat Leaders — PropBetEdge`,
      description: sport === 'ufc'
        ? 'Current UFC divisional champions from the verified official rankings snapshot.'
        : `${sportLabel} leaders — live player rankings and connected PropBetEdge intelligence.`,
      canonical: `https://propbetedge.ai/leaders/${sport}`,
    });
    if (sport === 'mlb') return renderMlbLeadersPage(root);
    if (sport === 'wnba') return renderWnbaLeadersPage(root);
    if (sport === 'nfl') return renderNflLeadersPage(root);
    if (sport === 'nhl') return renderNhlLeadersPage(root);
    if (sport === 'nba') return renderNbaLeadersPage(root);
    if (sport === 'ufc') return renderUfcChampionsPage(root);
  }

  const gameMatch = path.match(/^\/games\/([a-z]+)\/([\w-]+)$/);
  if (gameMatch) {
    const sport = gameMatch[1].toLowerCase();
    const gameId = gameMatch[2];
    if (['nfl', 'nhl', 'wnba'].includes(sport)) {
      const cast = liveCastUrl(sport, gameId);
      if (!cast) return renderNotFound(root);
      window.location.replace(cast);
      return;
    }
    if (!VALID_SPORTS.has(sport)) return renderNotFound(root);
    return renderGameDetail(root, sport, gameId);
  }

  const articleMatch = path.match(/^\/news\/([a-z]+)\/([^\/]+)$/);
  if (articleMatch) {
    const sport = articleMatch[1].toLowerCase();
    const slug = articleMatch[2];
    if (!VALID_SPORTS.has(sport)) return renderNotFound(root);
    return renderArticle(root, sport, slug, setMeta);
  }

  const sportMatch = path.match(/^\/news\/([a-z]+)$/);
  if (sportMatch) {
    const sport = sportMatch[1].toLowerCase();
    if (!VALID_SPORTS.has(sport)) return renderNotFound(root);
    return renderSport(root, sport, 1, setMeta);
  }

  if (path === '/authors') return renderAuthorsIndex(root, setMeta);

  const authorMatch = path.match(/^\/authors\/([a-z0-9-]+)$/);
  if (authorMatch) return renderAuthor(root, authorMatch[1], setMeta);

  if (path === '/about') return renderAbout(root, setMeta);

  if (path === '/editorial-standards') return renderEditorialStandards(root, setMeta);

  const teamMatch = path.match(/^\/team\/([a-z]+)\/([\w-]+)$/);
  if (teamMatch) {
    const sport = teamMatch[1].toLowerCase();
    const teamSlug = teamMatch[2];
    if (!VALID_SPORTS.has(sport)) return renderNotFound(root);
    return renderTeamPage(root, sport, teamSlug, setMeta);
  }

  const standingsMatch = path.match(/^\/standings\/([a-z]+)$/);
  if (standingsMatch) {
    const sport = standingsMatch[1].toLowerCase();
    if (!VALID_SPORTS.has(sport)) return renderNotFound(root);
    return renderStandingsPage(root, sport, setMeta);
  }

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
