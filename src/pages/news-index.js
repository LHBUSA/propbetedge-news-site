/**
 * src/pages/news-index.js
 * v3.15: page 1 = editorial (Top Stories + 4 sport rails)
 *        pages 2+ = simple paginated archive
 */

import { api } from '../api.js';
import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { renderArticleCard } from '../components/article-card.js';
import { renderPagination, injectPaginationLinkTags } from '../components/pagination.js';

const PAGE_SIZE = 20;

const SPORT_LABELS = { mlb: 'MLB', nfl: 'NFL', nba: 'NBA', nhl: 'NHL' };
const SPORT_EMOJI = { mlb: '⚾', nfl: '🏈', nba: '🏀', nhl: '🏒' };

export async function renderNewsIndex(root, page = 1, setMeta) {
  page = Math.max(1, parseInt(page) || 1);

  if (page === 1) {
    return renderEditorialPage1(root, setMeta);
  }
  return renderArchivePage(root, page, setMeta);
}

/* ── PAGE 1: Editorial layout (Top Stories + sport rails) ──────────── */
async function renderEditorialPage1(root, setMeta) {
  // Skeleton
  root.innerHTML = `
    ${renderHeader()}
    <main>
      <div class="container">
        <div class="article-grid uniform-grid" style="margin-top:32px">
          ${Array.from({ length: 8 }).map(() => `<div class="skel skel-article-card"></div>`).join('')}
        </div>
      </div>
    </main>
  `;

  if (setMeta) {
    setMeta({
      title: 'PropBetEdge News — Sports News & Prop-Bet Intelligence',
      description: 'Latest MLB, NFL, NBA, and NHL news with AI prop-bet impact analysis.',
      canonical: 'https://propbetedge.ai/news',
    });
  }

  // Fetch homepage (top stories) + each sport in parallel
  let homepage, mlb, nfl, nba, nhl;
  try {
    [homepage, mlb, nfl, nba, nhl] = await Promise.all([
      api.homepage().catch(() => ({ articles: [] })),
      api.newsBySport('mlb', 4, 1).catch(() => ({ articles: [] })),
      api.newsBySport('nfl', 4, 1).catch(() => ({ articles: [] })),
      api.newsBySport('nba', 4, 1).catch(() => ({ articles: [] })),
      api.newsBySport('nhl', 4, 1).catch(() => ({ articles: [] })),
    ]);
  } catch (e) {
    root.querySelector('main').innerHTML = `
      <div class="container">
        <div class="empty">
          <h3>Failed to load news</h3>
          <p>${escapeHtml(e.message)}</p>
        </div>
      </div>
    `;
    return;
  }

  const topStories = (homepage.articles || []).slice(0, 6);

  root.innerHTML = `
    ${renderHeader()}
    <main>
      <div class="container">

        <!-- Top Stories -->
        ${topStories.length ? `
          <section class="news-section" style="margin-top:32px">
            <div class="section-heading">
              <h2>🔥 Top Stories</h2>
              <span class="section-meta">Highest-impact news across all sports</span>
            </div>
            <div class="article-grid uniform-grid fade-stagger">
              ${topStories.map((a) => renderArticleCard(a)).join('')}
            </div>
          </section>
        ` : ''}

        ${renderSportRail('mlb', mlb.articles || [])}
        ${renderSportRail('nfl', nfl.articles || [])}
        ${renderSportRail('nba', nba.articles || [])}
        ${renderSportRail('nhl', nhl.articles || [])}

        <!-- Browse all archive link -->
        <div style="text-align:center;margin:48px 0 24px">
          <a href="/news/page/2" class="btn btn-ghost" style="font-family:var(--font-mono);font-size:11px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;padding:14px 28px">
            Browse All News Archive →
          </a>
        </div>

      </div>
    </main>
    ${renderFooter()}
  `;
}

function renderSportRail(sport, articles) {
  if (!articles.length) return '';
  const label = SPORT_LABELS[sport];
  const emoji = SPORT_EMOJI[sport];
  return `
    <section class="sport-rail-section">
      <div class="sport-rail-heading">
        <h3 class="sport-rail-title">
          <span class="sport-rail-emoji">${emoji}</span>
          ${label}
        </h3>
        <a href="/news/${sport}" class="sport-rail-more">All ${label} →</a>
      </div>
      <div class="article-grid uniform-grid fade-stagger">
        ${articles.map((a) => renderArticleCard(a)).join('')}
      </div>
    </section>
  `;
}

/* ── PAGES 2+: Simple paginated archive ────────────────────────────── */
async function renderArchivePage(root, page, setMeta) {
  const baseHref = '/news';
  const baseUrl = 'https://propbetedge.ai/news';

  root.innerHTML = `
    ${renderHeader()}
    <main>
      <div class="container">
        <div class="article-grid uniform-grid" style="margin-top:32px">
          ${Array.from({ length: 8 }).map(() => `<div class="skel skel-article-card"></div>`).join('')}
        </div>
      </div>
    </main>
  `;

  let resp;
  try {
    resp = await api.newsAll(PAGE_SIZE, page);
  } catch (e) {
    root.querySelector('main').innerHTML = `
      <div class="container">
        <div class="empty">
          <h3>Failed to load news</h3>
          <p>${escapeHtml(e.message)}</p>
        </div>
      </div>
    `;
    return;
  }

  const articles = resp.articles || [];
  const totalPages = resp.totalPages || 1;
  const currentPage = resp.page || page;

  if (page > totalPages && totalPages > 0) {
    root.innerHTML = `
      ${renderHeader()}
      <main>
        <div class="container">
          <div class="empty" style="margin-top:32px">
            <h3>Page ${page} doesn't exist</h3>
            <p>The archive has ${totalPages} ${totalPages === 1 ? 'page' : 'pages'}.</p>
            <a href="/news" class="btn btn-primary">Back to latest</a>
          </div>
        </div>
      </main>
      ${renderFooter()}
    `;
    return;
  }

  if (setMeta) {
    setMeta({
      title: `News Archive · Page ${page} — PropBetEdge`,
      description: `PropBetEdge news archive, page ${page} of ${totalPages}. MLB, NFL, NBA, and NHL coverage with AI prop-bet impact analysis.`,
      canonical: `${baseUrl}/page/${page}`,
    });
  }

  root.innerHTML = `
    ${renderHeader()}
    <main>
      <div class="container">
        <section class="news-section" style="margin-top:32px">
          <div class="section-heading">
            <h2>📰 News Archive</h2>
            <span class="section-meta">Page ${page} of ${totalPages} · All sports, newest first</span>
          </div>
          <div class="article-grid uniform-grid fade-stagger">
            ${articles.map((a) => renderArticleCard(a)).join('')}
          </div>
          ${renderPagination({ currentPage, totalPages, baseHref })}
        </section>
      </div>
    </main>
    ${renderFooter()}
  `;

  injectPaginationLinkTags({ currentPage, totalPages, baseUrl });
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
