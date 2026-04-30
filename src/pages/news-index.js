/**
 * src/pages/news-index.js
 * v3.16: editorial /news page with Breaking strip + Top Stories + Latest +
 *        4 sport rails, plus rich paginated archive on pages 2+.
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

/* ── PAGE 1: Full editorial layout ─────────────────────────────────── */
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

  // Fetch everything in parallel
  let breaking, homepage, latest, mlb, nfl, nba, nhl;
  try {
    [breaking, homepage, latest, mlb, nfl, nba, nhl] = await Promise.all([
      api.breaking().catch(() => ({ articles: [] })),
      api.homepage().catch(() => ({ articles: [] })),
      api.newsAll(20, 1).catch(() => ({ articles: [] })),
      api.newsBySport('mlb', 4, 1).catch(() => ({ articles: [] })),
      api.newsBySport('nfl', 4, 1).catch(() => ({ articles: [] })),
      api.newsBySport('nba', 4, 1).catch(() => ({ articles: [] })),
      api.newsBySport('nhl', 4, 1).catch(() => ({ articles: [] })),
    ]);
  } catch (e) {
    root.querySelector('main').innerHTML = `
      <div class="container">
        <div class="empty"><h3>Failed to load news</h3><p>${escapeHtml(e.message)}</p></div>
      </div>
    `;
    return;
  }

  const breakingTop = (breaking.articles || [])[0];
  const topStories = (homepage.articles || []).slice(0, 6);
  const latestArticles = (latest.articles || []).slice(0, 12);

  root.innerHTML = `
    ${renderHeader()}

    ${breakingTop ? `
      <div class="breaking">
        <div class="container">
          <div class="breaking-inner">
            <div class="breaking-tag"><span class="blink"></span> Breaking · ${escapeHtml(breakingTop.sport.toUpperCase())}</div>
            <div class="breaking-text">
              <a href="/news/${escapeHtml(breakingTop.sport)}/${escapeHtml(breakingTop.slug)}">${escapeHtml(breakingTop.title)}</a>
            </div>
          </div>
        </div>
      </div>
    ` : ''}

    <main>
      <div class="container">

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

        ${latestArticles.length ? `
          <section class="news-section">
            <div class="section-heading">
              <h2>📰 Latest</h2>
              <span class="section-meta">Newest first · all sports</span>
            </div>
            <div class="article-grid uniform-grid fade-stagger">
              ${latestArticles.map((a) => renderArticleCard(a)).join('')}
            </div>
            <div style="text-align:center;margin:32px 0 8px">
              <a href="/news/page/2" class="btn btn-ghost" style="font-family:var(--font-mono);font-size:11px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;padding:14px 28px">
                Browse the Full Archive →
              </a>
            </div>
          </section>
        ` : ''}

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

/* ── PAGES 2+: Rich paginated archive ──────────────────────────────── */
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
        <div class="empty"><h3>Failed to load archive</h3><p>${escapeHtml(e.message)}</p></div>
      </div>
    `;
    return;
  }

  const articles = resp.articles || [];
  const totalPages = resp.totalPages || 1;
  const currentPage = resp.page || page;
  const total = resp.total || 0;

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
      description: `Page ${page} of ${totalPages} of PropBetEdge's news archive. ${total}+ stories with AI prop-bet impact analysis across MLB, NFL, NBA, and NHL.`,
      canonical: `${baseUrl}/page/${page}`,
    });
  }

  root.innerHTML = `
    ${renderHeader()}

    <!-- Archive hero band — same gravitas as Stat Leaders/Live Games heroes -->
    <main>
      <div class="container">
        <div class="leaders-hero" style="margin-top:24px">
          <div class="leaders-hero-mesh"></div>
          <div class="leaders-hero-inner">
            <div class="leaders-hero-kicker">
              <span class="live-dot-big" style="background:var(--gold);box-shadow:0 0 0 0 rgba(212,175,55,0.5)"></span>
              <span>News Archive</span>
            </div>
            <h1 class="leaders-hero-title">Every story we've published.</h1>
            <p class="leaders-hero-dek">
              ${total}+ articles across MLB, NFL, NBA, and NHL — every headline written with prop-bet impact in mind, every take logged for accountability. Page ${page} of ${totalPages}.
            </p>
            <p style="margin-top:18px">
              <a href="/news" style="color:var(--gold);font-size:13px;font-weight:600;text-decoration:none;font-family:var(--font-mono);letter-spacing:0.1em;text-transform:uppercase">← Back to today's news</a>
            </p>
          </div>
        </div>

        <section class="news-section">
          <div class="section-heading">
            <h2>📰 Page ${page}</h2>
            <span class="section-meta">${articles.length} of ${total} stories · newest first</span>
          </div>
          <div class="article-grid uniform-grid fade-stagger">
            ${articles.map((a) => renderArticleCard(a)).join('')}
          </div>
          ${renderPagination({ currentPage, totalPages, baseHref })}
        </section>

        <!-- Sport-jump strip at the bottom of the archive -->
        <section style="margin:48px 0 16px;padding:28px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)">
          <div style="text-align:center">
            <div style="font-family:var(--font-mono);font-size:10px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;color:var(--paper-faint);margin-bottom:14px">Browse by sport</div>
            <div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center">
              <a href="/news/mlb" class="btn btn-ghost" style="padding:10px 18px;font-size:12px">⚾ MLB</a>
              <a href="/news/nfl" class="btn btn-ghost" style="padding:10px 18px;font-size:12px">🏈 NFL</a>
              <a href="/news/nba" class="btn btn-ghost" style="padding:10px 18px;font-size:12px">🏀 NBA</a>
              <a href="/news/nhl" class="btn btn-ghost" style="padding:10px 18px;font-size:12px">🏒 NHL</a>
            </div>
          </div>
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
