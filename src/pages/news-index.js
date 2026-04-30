/**
 * src/pages/news-index.js
 * v3.15: pagination support — /news/page/2 etc.
 */

import { api } from '../api.js';
import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { renderArticleCard } from '../components/article-card.js';
import { renderPagination, injectPaginationLinkTags } from '../components/pagination.js';

const PAGE_SIZE = 20;

export async function renderNewsIndex(root, page = 1, setMeta) {
  page = Math.max(1, parseInt(page) || 1);
  const baseHref = '/news';
  const baseUrl = 'https://propbetedge.ai/news';
  const canonicalUrl = page === 1 ? baseUrl : `${baseUrl}/page/${page}`;

  root.innerHTML = `
    ${renderHeader()}
    <main>
      <div class="container">
        <header class="news-header">
          <h1>PropBetEdge News</h1>
          <p class="news-dek">Sports news with AI prop-bet impact analysis.</p>
        </header>
        <div class="article-grid">
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
          <div class="empty">
            <h3>Page ${page} doesn't exist</h3>
            <p>This section has ${totalPages} ${totalPages === 1 ? 'page' : 'pages'} of articles.</p>
            <a href="/news" class="btn btn-primary">Back to latest news</a>
          </div>
        </div>
      </main>
      ${renderFooter()}
    `;
    return;
  }

  if (setMeta) {
    setMeta({
      title: page === 1
        ? 'Latest Sports News & Prop-Bet Analysis — PropBetEdge'
        : `Sports News · Page ${page} — PropBetEdge`,
      description: 'Latest MLB, NFL, NBA, NHL news with AI prop-bet impact analysis.',
      canonical: canonicalUrl,
    });
  }

  root.innerHTML = `
    ${renderHeader()}
    <main>
      <div class="container">
        <header class="news-header">
          <h1>PropBetEdge News${page > 1 ? ` · Page ${page}` : ''}</h1>
          <p class="news-dek">Sports news with AI prop-bet impact analysis.</p>
        </header>

        ${articles.length === 0 ? `
          <div class="empty">
            <h3>No articles found</h3>
            <p>Check back shortly — our news pipeline runs every few minutes.</p>
          </div>
        ` : `
          <div class="article-grid fade-stagger">
            ${articles.map((a) => renderArticleCard(a)).join('')}
          </div>
          ${renderPagination({ currentPage, totalPages, baseHref })}
        `}
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
