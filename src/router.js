/**
 * src/router.js
 */

import { renderHome } from './pages/home.js';
import { renderNewsIndex } from './pages/news-index.js';
import { renderSport } from './pages/sport.js';
import { renderArticle } from './pages/article.js';
import { renderAuthor } from './pages/author.js';
import { renderEditorialStandards } from './pages/editorial-standards.js';
import { renderNotFound } from './pages/404.js';

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
