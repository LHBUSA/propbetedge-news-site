/**
 * src/pages/news-index.js
 * All News — categorized sections + clean-route pagination
 */

import { api } from '../api.js';
import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { renderArticleCard } from '../components/article-card.js';
import { renderBreakingBanner } from '../components/breaking-banner.js';
import {
  organizationSchema, websiteSchema, breadcrumbSchema,
  collectionPageSchema, injectSchemas,
} from '../schema.js';

const SPORTS = [
  { key: 'all', label: 'All News', href: '/news' },
  { key: 'mlb', label: 'MLB', href: '/news/mlb' },
  { key: 'nfl', label: 'NFL', href: '/news/nfl' },
  { key: 'nba', label: 'NBA', href: '/news/nba' },
  { key: 'nhl', label: 'NHL', href: '/news/nhl' },
];

const PAGE_SIZE = 12;

function queryPage() {
  const params = new URLSearchParams(window.location.search);
  const page = parseInt(params.get('page'), 10);
  return page > 0 ? page : 1;
}

function normalizePage(requestedPage) {
  const requested = Number.parseInt(requestedPage, 10);
  if (Number.isFinite(requested) && requested > 1) return requested;
  const legacy = queryPage();
  if (legacy > 1) {
    window.history.replaceState({}, '', `/news/page/${legacy}`);
    return legacy;
  }
  return 1;
}

export async function renderNewsIndex(root, requestedPage = 1) {
  const currentPage = normalizePage(requestedPage);

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
        <section id="top-stories-section" class="news-section">
          <div class="section-heading">
            <h2>🔥 Top Stories</h2>
            <span class="section-meta">Highest-impact news across all sports</span>
          </div>
          <div id="top-stories-grid" class="article-grid fade-stagger">${cardSkeleton(3)}</div>
        </section>

        <section id="sport-rails" class="news-section sport-rails-section">
          <div id="sport-rails-content"></div>
        </section>

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

  const [breaking, latest, mlb, nfl, nba, nhl] = await Promise.all([
    api.breaking().catch(() => ({ articles: [] })),
    api.newsAll(PAGE_SIZE, currentPage).catch(() => ({ articles: [], total: 0 })),
    api.newsBySport('mlb', 4).catch(() => ({ articles: [] })),
    api.newsBySport('nfl', 4).catch(() => ({ articles: [] })),
    api.newsBySport('nba', 4).catch(() => ({ articles: [] })),
    api.newsBySport('nhl', 4).catch(() => ({ articles: [] })),
  ]);

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

  if (breaking.articles?.length) {
    document.getElementById('breaking-slot').innerHTML = renderBreakingBanner(breaking.articles[0]);
  }

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

  const railsHTML = [
    renderSportRail('MLB', '⚾', mlb.articles, '/news/mlb'),
    renderSportRail('NFL', '🏈', nfl.articles, '/news/nfl'),
    renderSportRail('NBA', '🏀', nba.articles, '/news/nba'),
    renderSportRail('NHL', '🏒', nhl.articles, '/news/nhl'),
  ].filter(Boolean).join('');
  document.getElementById('sport-rails-content').innerHTML = railsHTML;

  const latestGrid = document.getElementById('latest-grid');
  if (!latest.articles?.length) {
    latestGrid.innerHTML = `
      <div class="empty" style="grid-column:1/-1">
        <h3>No more articles</h3>
        <p>You've reached the end. <a href="/news" style="color:var(--gold)">Return to page 1.</a></p>
      </div>
    `;
  } else {
    latestGrid.innerHTML = latest.articles.map((a) => renderArticleCard(a)).join('');
  }

  const total = latest.total || latest.articles?.length || 0;
  const totalPages = latest.totalPages || (total ? Math.ceil(total / PAGE_SIZE) : Math.max(currentPage, 1));
  document.getElementById('pagination').innerHTML = renderPagination(currentPage, totalPages, '/news');
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

function renderPagination(current, total, baseHref) {
  if (total <= 1) return '';
  const pageHref = (page) => page === 1 ? baseHref : `${baseHref}/page/${page}`;

  const prev = current > 1 ? `<a href="${pageHref(current - 1)}" class="page-btn" rel="prev">← Prev</a>` : `<span class="page-btn disabled">← Prev</span>`;
  const next = current < total ? `<a href="${pageHref(current + 1)}" class="page-btn" rel="next">Next →</a>` : `<span class="page-btn disabled">Next →</span>`;

  const pages = [];
  const start = Math.max(1, current - 2);
  const end = Math.min(total, current + 2);

  if (start > 1) {
    pages.push(`<a href="${pageHref(1)}" class="page-num">1</a>`);
    if (start > 2) pages.push(`<span class="page-ellipsis">…</span>`);
  }
  for (let i = start; i <= end; i++) {
    if (i === current) pages.push(`<span class="page-num current" aria-current="page">${i}</span>`);
    else pages.push(`<a href="${pageHref(i)}" class="page-num">${i}</a>`);
  }
  if (end < total) {
    if (end < total - 1) pages.push(`<span class="page-ellipsis">…</span>`);
    pages.push(`<a href="${pageHref(total)}" class="page-num">${total}</a>`);
  }

  return `
    <nav class="pagination-inner" aria-label="News pagination">
      ${prev}
      <div class="page-numbers">${pages.join('')}</div>
      ${next}
    </nav>
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
