/**
 * src/pages/news-index.js
 * All News — categorized sections + pagination
 *
 * v3.9: Restructured from a single flat grid into:
 *   • Breaking Now (top impact, last 24h)
 *   • Top Stories (impact 4+)
 *   • Per-sport rails (MLB / NFL / NBA / NHL)
 *   • Latest (paginated, all sports, 12 per page)
 */

import { api } from '../api.js';
import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { renderArticleCard, renderSidebarStory } from '../components/article-card.js';
import { renderBreakingBanner } from '../components/breaking-banner.js';
import {
  organizationSchema, websiteSchema, breadcrumbSchema,
  collectionPageSchema, injectSchemas,
} from '../schema.js';

const SPORTS = [
  { key: 'all', label: 'All News', href: '/news' },
  { key: 'mlb', label: 'MLB',      href: '/news/mlb' },
  { key: 'nfl', label: 'NFL',      href: '/news/nfl' },
  { key: 'nba', label: 'NBA',      href: '/news/nba' },
  { key: 'nhl', label: 'NHL',      href: '/news/nhl' },
];

const PAGE_SIZE = 12;

function getPageFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const p = parseInt(params.get('page'), 10);
  return p > 0 ? p : 1;
}

export async function renderNewsIndex(root) {
  const currentPage = getPageFromUrl();

  root.innerHTML = `
    ${renderHeader()}
    <main>
      <div id="breaking-slot"></div>

      <div class="section-bar">
        <div class="container section-bar-inner">
          ${SPORTS.map((s) => `
            <a href="${s.href}" class="section-link ${s.key === 'all' ? 'active' : ''}">${s.label}</a>
          `).join('')}
        </div>
      </div>

      <div class="container" style="padding-top:36px">
        <!-- Section 1: Top Stories (high-impact) -->
        <section id="top-stories-section" class="news-section">
          <div class="section-heading">
            <h2>🔥 Top Stories</h2>
            <span class="section-meta">Highest-impact news across all sports</span>
          </div>
          <div id="top-stories-grid" class="article-grid fade-stagger">${cardSkeleton(3)}</div>
        </section>

        <!-- Section 2: Per-sport rails -->
        <section id="sport-rails" class="news-section sport-rails-section">
          <div id="sport-rails-content"></div>
        </section>

        <!-- Section 3: Latest (paginated) -->
        <section id="latest-section" class="news-section">
          <div class="section-heading">
            <h2>📰 Latest</h2>
            <span class="section-meta">Page ${currentPage} · All sports, newest first</span>
          </div>
          <div id="latest-grid" class="article-grid fade-stagger">${cardSkeleton(PAGE_SIZE)}</div>
          <div id="pagination" class="pagination"></div>
        </section>
      </div>
    </main>
    ${renderFooter()}
  `;

  // Fetch everything in parallel
  const [breaking, latest, mlb, nfl, nba, nhl] = await Promise.all([
    api.breaking().catch(() => ({ articles: [] })),
    api.newsAll(PAGE_SIZE, currentPage).catch(() => ({ articles: [], total: 0 })),
    api.newsBySport('mlb', 4).catch(() => ({ articles: [] })),
    api.newsBySport('nfl', 4).catch(() => ({ articles: [] })),
    api.newsBySport('nba', 4).catch(() => ({ articles: [] })),
    api.newsBySport('nhl', 4).catch(() => ({ articles: [] })),
  ]);

  // 🆕 v3.9.6: Schema for /news index page
  injectSchemas([
    organizationSchema(),
    websiteSchema(),
    collectionPageSchema({
      url: '/news',
      name: 'All Sports News — PropBetEdge',
      description: 'Latest sports news across MLB, NFL, NBA, and NHL with AI prop-bet impact analysis.',
      articles: latest.articles || [],
    }),
    breadcrumbSchema([
      { name: 'Home', url: '/' },
      { name: 'News' },
    ]),
  ], 'jsonld-news');

  // Breaking banner
  if (breaking.articles?.length) {
    document.getElementById('breaking-slot').innerHTML = renderBreakingBanner(breaking.articles[0]);
  }

  // Top Stories — high-impact across all sports (impact >= 4)
  const allFresh = [
    ...(mlb.articles || []),
    ...(nfl.articles || []),
    ...(nba.articles || []),
    ...(nhl.articles || []),
  ];
  const topStories = allFresh
    .filter((a) => (a.take?.impact_score || 0) >= 4)
    .sort((a, b) => new Date(b.published_at) - new Date(a.published_at))
    .slice(0, 6);

  const topGrid = document.getElementById('top-stories-grid');
  if (topStories.length === 0) {
    document.getElementById('top-stories-section').style.display = 'none';
  } else {
    topGrid.innerHTML = topStories.map((a, i) => renderArticleCard(a, { featured: i === 0 })).join('');
  }

  // Per-sport rails
  const railsHTML = [
    renderSportRail('MLB', '⚾', mlb.articles, '/news/mlb'),
    renderSportRail('NFL', '🏈', nfl.articles, '/news/nfl'),
    renderSportRail('NBA', '🏀', nba.articles, '/news/nba'),
    renderSportRail('NHL', '🏒', nhl.articles, '/news/nhl'),
  ].filter(Boolean).join('');
  document.getElementById('sport-rails-content').innerHTML = railsHTML;

  // Latest grid + pagination
  const latestGrid = document.getElementById('latest-grid');
  if (!latest.articles?.length) {
    latestGrid.innerHTML = `
      <div class="empty" style="grid-column:1/-1">
        <h3>No more articles</h3>
        <p>You've reached the end. Try page 1.</p>
      </div>
    `;
  } else {
    latestGrid.innerHTML = latest.articles.map((a) => renderArticleCard(a)).join('');
  }

  // Pagination controls
  const total = latest.total || latest.articles?.length || 0;
  const totalPages = total ? Math.ceil(total / PAGE_SIZE) : Math.max(currentPage, 1);
  document.getElementById('pagination').innerHTML = renderPagination(currentPage, totalPages);
}

function renderSportRail(label, emoji, articles, href) {
  if (!articles?.length) return '';
  const cards = articles.slice(0, 4);
  return `
    <div class="sport-rail">
      <div class="sport-rail-heading">
        <h3><span class="sport-emoji">${emoji}</span> ${label}</h3>
        <a href="${href}" class="sport-rail-more">All ${label} →</a>
      </div>
      <div class="article-grid fade-stagger sport-rail-grid">
        ${cards.map((a) => renderArticleCard(a)).join('')}
      </div>
    </div>
  `;
}

function renderPagination(current, total) {
  if (total <= 1) return '';

  const prev = current > 1 ? `<a href="?page=${current - 1}" class="page-btn">← Prev</a>` : `<span class="page-btn disabled">← Prev</span>`;
  const next = current < total ? `<a href="?page=${current + 1}" class="page-btn">Next →</a>` : `<span class="page-btn disabled">Next →</span>`;

  // Build numbered links — show 5 surrounding pages
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

function cardSkeleton(n) {
  let out = '';
  for (let i = 0; i < n; i++) {
    out += `
      <div class="skel-card">
        <div class="skel skel-card-img"></div>
        <div class="skel skel-line" style="width:25%;height:10px"></div>
        <div class="skel skel-line" style="width:90%;height:22px;margin-top:8px"></div>
        <div class="skel skel-line" style="width:70%;height:22px"></div>
      </div>
    `;
  }
  return out;
}
