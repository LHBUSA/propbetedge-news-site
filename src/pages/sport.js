/**
 * src/pages/sport.js
 * Sport-section landing — like a magazine section front
 * v3.15: pagination added (?page=N), everything else unchanged
 * v3.16: Hero article must be fresh (36h window) — fixes stale top story on section pages
 */

import { api } from '../api.js';
import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { renderArticleCard, renderSidebarStory, escapeHtml, formatRelative } from '../components/article-card.js';
import { proxyImage } from '../ads-config.js';
import {
  organizationSchema, websiteSchema, breadcrumbSchema,
  collectionPageSchema, injectSchemas,
} from '../schema.js';

const SPORT_FALLBACK = { mlb: '⚾', nfl: '🏈', nba: '🏀', nhl: '🏒' };
const SPORT_TAGLINES = {
  mlb: 'Strikeouts, home runs, hits, total bases — all the angles for tonight\'s diamond.',
  nfl: 'Yards, touchdowns, anytime scorers — the Sunday slate broken down.',
  nba: 'Points, assists, rebounds, threes — every angle on the hardwood.',
  nhl: 'Shots on goal, goals, saves — the ice-level edge.',
};
const SECTIONS = ['mlb', 'nfl', 'nba', 'nhl'];
const PAGE_SIZE = 20;

function getPageFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const p = parseInt(params.get('page'), 10);
  return p > 0 ? p : 1;
}

export async function renderSport(root, sport) {
  const tagline = SPORT_TAGLINES[sport] || '';
  const currentPage = getPageFromUrl();

  root.innerHTML = `
    ${renderHeader()}
    <main>
      <div class="section-bar">
        <div class="container section-bar-inner">
          <a href="/news" class="section-link">All News</a>
          ${SECTIONS.map((s) => `
            <a href="/news/${s}" class="section-link ${s === sport ? 'active' : ''}">${s.toUpperCase()}</a>
          `).join('')}
        </div>
      </div>

      <div class="container" style="padding-top:40px">
        <div style="border-bottom:2px solid var(--gold);padding-bottom:18px;margin-bottom:32px">
          <div class="kicker kicker-gold" style="margin-bottom:8px">${escapeHtml(sport.toUpperCase())} · The Section</div>
          <h1 class="serif" style="font-family:var(--font-serif);font-size:clamp(36px,5vw,52px);font-weight:900;letter-spacing:-0.025em;margin:0 0 10px;line-height:1.05">${escapeHtml(sport.toUpperCase())} News & Notes</h1>
          <p style="font-family:var(--font-serif);font-style:italic;font-size:18px;color:var(--paper-dim);max-width:680px;margin:0">${escapeHtml(tagline)}</p>
        </div>

        <div id="lead-slot">${cardSkeleton(1, true)}</div>
        <div id="rest-slot">${cardSkeleton(8)}</div>
        <div id="pagination" class="pagination"></div>
      </div>
    </main>
    ${renderFooter()}
  `;

  const data = await api.newsBySport(sport, PAGE_SIZE, currentPage).catch(() => ({ articles: [] }));
  const articles = data.articles || [];
  const sportLabel = sport.toUpperCase();

  // Schema (unchanged)
  injectSchemas([
    organizationSchema(),
    websiteSchema(),
    collectionPageSchema({
      url: `/news/${sport}`,
      name: `${sportLabel} News — PropBetEdge`,
      description: `Latest ${sportLabel} news with AI prop-bet impact analysis.`,
      articles,
    }),
    breadcrumbSchema([
      { name: 'Home', url: '/' },
      { name: 'News', url: '/news' },
      { name: `${sportLabel} News` },
    ]),
  ], 'jsonld-sport');

  if (!articles.length) {
    document.getElementById('lead-slot').innerHTML = '';
    document.getElementById('rest-slot').innerHTML = `
      <div class="empty" style="margin-top:32px">
        <h3>No ${sport.toUpperCase()} articles ${currentPage > 1 ? `on page ${currentPage}` : 'yet'}</h3>
        <p>${currentPage > 1 ? `<a href="/news/${sport}" style="color:var(--gold)">← Back to page 1</a>` : 'The news engine pulls every 30 minutes — check back shortly.'}</p>
      </div>
    `;
    document.getElementById('pagination').innerHTML = '';
    return;
  }

  // Lead = first article (or one with image preferred) — only on page 1
  // On pages 2+, just show the grid (no lead+sidebar treatment)
  if (currentPage === 1) {
    const lead = pickLead(articles);
    const rest = articles.filter((a) => a.id !== lead.id);

    document.getElementById('lead-slot').innerHTML = `
      <div class="lead-grid" style="margin-bottom:48px">
        ${renderLeadStory(lead, sport)}
        <aside class="lead-sidebar">
          <div class="sidebar-header">More ${sport.toUpperCase()}</div>
          ${rest.slice(0, 4).map(renderSidebarStory).join('')}
        </aside>
      </div>
    `;

    const remaining = rest.slice(4);
    document.getElementById('rest-slot').innerHTML = remaining.length ? `
      <div class="section-heading">
        <h2>More Stories</h2>
      </div>
      <div class="article-grid fade-stagger">
        ${remaining.map((a) => renderArticleCard(a)).join('')}
      </div>
    ` : '';
  } else {
    // Pages 2+ — simple grid with section heading, no lead story
    document.getElementById('lead-slot').innerHTML = '';
    document.getElementById('rest-slot').innerHTML = `
      <div class="section-heading">
        <h2>${sportLabel} · Page ${currentPage}</h2>
        <span class="section-meta">Newest first</span>
      </div>
      <div class="article-grid fade-stagger">
        ${articles.map((a) => renderArticleCard(a)).join('')}
      </div>
    `;
  }

  // Pagination controls
  const total = data.total || articles.length;
  const totalPages = data.totalPages || (total ? Math.ceil(total / PAGE_SIZE) : Math.max(currentPage, 1));
  document.getElementById('pagination').innerHTML = renderPagination(currentPage, totalPages);
}

function renderPagination(current, total) {
  if (total <= 1) return '';

  const prev = current > 1 ? `<a href="?page=${current - 1}" class="page-btn">← Prev</a>` : `<span class="page-btn disabled">← Prev</span>`;
  const next = current < total ? `<a href="?page=${current + 1}" class="page-btn">Next →</a>` : `<span class="page-btn disabled">Next →</span>`;

  const pages = [];
  const start = Math.max(1, current - 2);
  const end = Math.min(total, current + 2);

  if (start > 1) {
    pages.push(`<a href="?page=1" class="page-num">1</a>`);
    if (start > 2) pages.push(`<span class="page-ellipsis">…</span>`);
  }
  for (let i = start; i <= end; i++) {
    if (i === current) pages.push(`<span class="page-num current">${i}</span>`);
    else pages.push(`<a href="?page=${i}" class="page-num">${i}</a>`);
  }
  if (end < total) {
    if (end < total - 1) pages.push(`<span class="page-ellipsis">…</span>`);
    pages.push(`<a href="?page=${total}" class="page-num">${total}</a>`);
  }

  return `
    <div class="pagination-inner">
      ${prev}
      <div class="page-numbers">${pages.join('')}</div>
      ${next}
    </div>
    <div class="pagination-meta">Page ${current} of ${total}</div>
  `;
}

// v3.16: Hero must be both relevant AND fresh.
// Look for the highest-impact article from the last 36 hours that has an image.
// Fall back gracefully if no recent article qualifies.
function pickLead(articles) {
  const FRESH_WINDOW_MS = 36 * 60 * 60 * 1000; // 36 hours
  const now = Date.now();

  const withImage = articles.filter((a) => a.image_url);

  // Tier 1: Fresh articles (last 36h) with images, sorted by impact_score DESC,
  // with published_at DESC as tiebreaker.
  const fresh = withImage.filter((a) => {
    if (!a.published_at) return false;
    const age = now - new Date(a.published_at).getTime();
    return age >= 0 && age <= FRESH_WINDOW_MS;
  });

  if (fresh.length) {
    return fresh.sort((a, b) => {
      const impactDiff = (b.take?.impact_score || 0) - (a.take?.impact_score || 0);
      if (impactDiff !== 0) return impactDiff;
      return new Date(b.published_at) - new Date(a.published_at);
    })[0];
  }

  // Tier 2: No fresh article with image — fall back to the freshest article with an image (any age).
  if (withImage.length) {
    return withImage.sort((a, b) =>
      new Date(b.published_at) - new Date(a.published_at)
    )[0];
  }

  // Tier 3: No images at all — take whatever the API sent first (already published_at DESC).
  return articles[0];
}

function renderLeadStory(article, sport) {
  const url = article.url || `/news/${article.sport}/${article.slug}`;
  const date = new Date(article.published_at);
  const dek = article.take?.summary || article.summary;
  const imgBlock = article.image_url
    ? `<div class="lead-image">
         <img src="${escapeAttr(proxyImage(article.image_url))}" alt="${escapeAttr(article.title)}" class="hero-image-img" onerror="this.classList.add('img-broken')" />
         <div class="img-fallback">${SPORT_FALLBACK[sport] || '◆'}</div>
       </div>`
    : `<div class="lead-image"><div class="img-fallback">${SPORT_FALLBACK[sport] || '◆'}</div></div>`;

  return `
    <a href="${escapeAttr(url)}" class="lead-story fade-in">
      ${imgBlock}
      <div class="lead-meta">
        <span class="sport-tag">${escapeHtml(sport.toUpperCase())}</span>
        <span class="dot">·</span>
        <span class="timestamp">${formatRelative(date)}</span>
      </div>
      <h2 class="lead-headline">${escapeHtml(article.title)}</h2>
      ${dek ? `<p class="lead-dek">${escapeHtml(dek)}</p>` : ''}
    </a>
  `;
}

function cardSkeleton(n, large = false) {
  let out = large ? '<div class="lead-grid" style="margin-bottom:48px"><div>' : '<div class="article-grid">';
  for (let i = 0; i < n; i++) {
    out += `
      <div class="skel-card">
        <div class="skel skel-card-img"></div>
        <div class="skel skel-line" style="width:30%;height:10px"></div>
        <div class="skel skel-line" style="width:90%;height:24px;margin-top:8px"></div>
      </div>
    `;
  }
  out += large ? '</div><div></div></div>' : '</div>';
  return out;
}

function escapeAttr(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
