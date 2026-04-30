/**
 * src/pages/sport.js
 * v3.15: paginated per-sport news listing
 */

import { api } from '../api.js';
import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { renderArticleCard } from '../components/article-card.js';
import { renderPagination, injectPaginationLinkTags } from '../components/pagination.js';

const PAGE_SIZE = 20;

const SPORT_LABELS = { mlb: 'MLB', nfl: 'NFL', nba: 'NBA', nhl: 'NHL' };
const SPORT_DESCRIPTIONS = {
  mlb: 'Major League Baseball news, injuries, and prop-bet edges.',
  nfl: 'NFL news, snap counts, and player prop analysis.',
  nba: 'NBA news, rotations, and prop-bet edges.',
  nhl: 'NHL news, line changes, and goalie matchup analysis.',
};

export async function renderSport(root, sport, page = 1, setMeta) {
  page = Math.max(1, parseInt(page) || 1);
  const sportLabel = SPORT_LABELS[sport] || sport.toUpperCase();
  const baseHref = `/news/${sport}`;
  const baseUrl = `https://propbetedge.ai/news/${sport}`;
  const canonicalUrl = page === 1 ? baseUrl : `${baseUrl}/page/${page}`;

  root.innerHTML = `
    ${renderHeader()}
    <main>
      <div class="container">
        <header class="news-header">
          <a href="/news" class="article-back">&larr; All News</a>
          <h1>${sportLabel} News</h1>
        </header>
        <div class="article-grid">
          ${Array.from({ length: 8 }).map(() => `<div class="skel skel-article-card"></div>`).join('')}
        </div>
      </div>
    </main>
  `;

  let resp;
  try {
    resp = await api.newsBySport(sport, PAGE_SIZE, page);
  } catch (e) {
    root.querySelector('main').innerHTML = `
      <div class="container">
        <div class="empty">
          <h3>Failed to load ${sportLabel} news</h3>
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
            <p>${sportLabel} News has ${totalPages} ${totalPages === 1 ? 'page' : 'pages'}.</p>
            <a href="${baseHref}" class="btn btn-primary">Back to ${sportLabel} latest</a>
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
        ? `${sportLabel} News & Prop-Bet Analysis — PropBetEdge`
        : `${sportLabel} News · Page ${page} — PropBetEdge`,
      description: SPORT_DESCRIPTIONS[sport] || `Latest ${sportLabel} news with AI prop-bet impact analysis.`,
      canonical: canonicalUrl,
    });
  }

  root.innerHTML = `
    ${renderHeader()}
    <main>
      <div class="container">
        <header class="news-header">
          <a href="/news" class="article-back">&larr; All News</a>
          <h1>${sportLabel} News${page > 1 ? ` · Page ${page}` : ''}</h1>
          <p class="news-dek">${SPORT_DESCRIPTIONS[sport] || ''}</p>
        </header>

        ${articles.length === 0 ? `
          <div class="empty">
            <h3>No ${sportLabel} articles yet</h3>
            <p>Check back shortly.</p>
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
