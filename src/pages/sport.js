/**
 * src/pages/sport.js
 * v3.16: per-sport editorial layout matching /news quality.
 *        Page 1 = sport hero + Top stories + Latest + cross-sport strip
 *        Pages 2+ = paginated archive with hero band
 */

import { api } from '../api.js';
import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { renderArticleCard } from '../components/article-card.js';
import { renderPagination, injectPaginationLinkTags } from '../components/pagination.js';

const PAGE_SIZE = 20;

const SPORT_LABELS = { mlb: 'MLB', nfl: 'NFL', nba: 'NBA', nhl: 'NHL' };
const SPORT_EMOJI = { mlb: '⚾', nfl: '🏈', nba: '🏀', nhl: '🏒' };
const SPORT_DESCRIPTIONS = {
  mlb: 'Strikeouts, home runs, hits, total bases — every angle on tonight\'s diamond.',
  nfl: 'Snap counts, target shares, rushing volume — the props that move on Sundays.',
  nba: 'Points, assists, rebounds, threes — every angle on the hardwood.',
  nhl: 'Goals, assists, shots on goal, goalie matchups — the ice props worth backing.',
};

export async function renderSport(root, sport, page = 1, setMeta) {
  page = Math.max(1, parseInt(page) || 1);

  if (!SPORT_LABELS[sport]) {
    root.innerHTML = `${renderHeader()}<main><div class="container"><div class="empty"><h3>Unknown sport</h3></div></div></main>${renderFooter()}`;
    return;
  }

  if (page === 1) {
    return renderSportPage1(root, sport, setMeta);
  }
  return renderSportArchive(root, sport, page, setMeta);
}

/* ── PAGE 1: Editorial sport home ──────────────────────────────────── */
async function renderSportPage1(root, sport, setMeta) {
  const sportLabel = SPORT_LABELS[sport];
  const emoji = SPORT_EMOJI[sport];
  const dek = SPORT_DESCRIPTIONS[sport];
  const baseUrl = `https://propbetedge.ai/news/${sport}`;

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
      title: `${sportLabel} News & Prop-Bet Analysis — PropBetEdge`,
      description: dek,
      canonical: baseUrl,
    });
  }

  // Fetch breaking + latest in parallel; filter breaking client-side to this sport
  let breakingResp, latestResp;
  try {
    [breakingResp, latestResp] = await Promise.all([
      api.breaking().catch(() => ({ articles: [] })),
      api.newsBySport(sport, 24, 1).catch(() => ({ articles: [] })),
    ]);
  } catch (e) {
    root.querySelector('main').innerHTML = `
      <div class="container"><div class="empty"><h3>Failed to load ${sportLabel} news</h3><p>${escapeHtml(e.message)}</p></div></div>
    `;
    return;
  }

  const allArticles = latestResp.articles || [];
  const total = latestResp.total || allArticles.length;
  const totalPages = latestResp.totalPages || 1;

  // Top stories = highest-impact articles for this sport (impact_score 4+)
  const topStories = allArticles
    .filter((a) => (a.take?.impact_score || 0) >= 4)
    .slice(0, 4);

  // Latest = the rest, in order
  const topIds = new Set(topStories.map((a) => a.id));
  const latest = allArticles.filter((a) => !topIds.has(a.id)).slice(0, 12);

  // Also pull the breaking story IF it's for this sport
  const sportBreaking = (breakingResp.articles || []).find((a) => a.sport === sport);

  root.innerHTML = `
    ${renderHeader()}

    ${sportBreaking ? `
      <div class="breaking">
        <div class="container">
          <div class="breaking-inner">
            <div class="breaking-tag"><span class="blink"></span> Breaking · ${escapeHtml(sportLabel)}</div>
            <div class="breaking-text">
              <a href="/news/${escapeHtml(sportBreaking.sport)}/${escapeHtml(sportBreaking.slug)}">${escapeHtml(sportBreaking.title)}</a>
            </div>
          </div>
        </div>
      </div>
    ` : ''}

    <main>
      <div class="container">

        <!-- Sport hero -->
        <div class="leaders-hero" style="margin-top:24px">
          <div class="leaders-hero-mesh"></div>
          <div class="leaders-hero-inner">
            <div class="leaders-hero-kicker">
              <span style="font-size:18px;line-height:1">${emoji}</span>
              <span>${sportLabel} · The Section</span>
            </div>
            <h1 class="leaders-hero-title">${sportLabel} News &amp; Notes</h1>
            <p class="leaders-hero-dek">${escapeHtml(dek)}</p>
            <p style="margin-top:16px;font-family:var(--font-mono);font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:var(--paper-faint)">
              ${total} ${total === 1 ? 'story' : 'stories'} indexed · updated continuously
            </p>
          </div>
        </div>

        ${topStories.length ? `
          <section class="news-section" style="margin-top:32px">
            <div class="section-heading">
              <h2>🔥 Top ${sportLabel} Stories</h2>
              <span class="section-meta">Highest-impact ${sportLabel} news right now</span>
            </div>
            <div class="article-grid uniform-grid fade-stagger">
              ${topStories.map((a) => renderArticleCard(a)).join('')}
            </div>
          </section>
        ` : ''}

        <section class="news-section">
          <div class="section-heading">
            <h2>📰 Latest ${sportLabel}</h2>
            <span class="section-meta">Newest first · all ${sportLabel} coverage</span>
          </div>
          ${latest.length === 0 ? `
            <div class="empty"><h3>No ${sportLabel} articles yet</h3><p>Check back shortly.</p></div>
          ` : `
            <div class="article-grid uniform-grid fade-stagger">
              ${latest.map((a) => renderArticleCard(a)).join('')}
            </div>
            ${totalPages > 1 ? `
              <div style="text-align:center;margin:32px 0 8px">
                <a href="/news/${sport}/page/2" class="btn btn-ghost" style="font-family:var(--font-mono);font-size:11px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;padding:14px 28px">
                  Browse Full ${sportLabel} Archive →
                </a>
              </div>
            ` : ''}
          `}
        </section>

        ${renderCrossSportStrip(sport)}

      </div>
    </main>
    ${renderFooter()}
  `;
}

/* ── PAGES 2+: Sport archive with hero band ────────────────────────── */
async function renderSportArchive(root, sport, page, setMeta) {
  const sportLabel = SPORT_LABELS[sport];
  const emoji = SPORT_EMOJI[sport];
  const baseHref = `/news/${sport}`;
  const baseUrl = `https://propbetedge.ai/news/${sport}`;

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
    resp = await api.newsBySport(sport, PAGE_SIZE, page);
  } catch (e) {
    root.querySelector('main').innerHTML = `
      <div class="container"><div class="empty"><h3>Failed to load ${sportLabel} archive</h3><p>${escapeHtml(e.message)}</p></div></div>
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
            <p>${sportLabel} has ${totalPages} ${totalPages === 1 ? 'page' : 'pages'} of articles.</p>
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
      title: `${sportLabel} Archive · Page ${page} — PropBetEdge`,
      description: `Page ${page} of ${totalPages} of PropBetEdge's ${sportLabel} archive. ${total} stories with prop-bet impact analysis.`,
      canonical: `${baseUrl}/page/${page}`,
    });
  }

  root.innerHTML = `
    ${renderHeader()}
    <main>
      <div class="container">

        <div class="leaders-hero" style="margin-top:24px">
          <div class="leaders-hero-mesh"></div>
          <div class="leaders-hero-inner">
            <div class="leaders-hero-kicker">
              <span style="font-size:18px;line-height:1">${emoji}</span>
              <span>${sportLabel} Archive</span>
            </div>
            <h1 class="leaders-hero-title">Every ${sportLabel} story we've published.</h1>
            <p class="leaders-hero-dek">
              ${total} ${sportLabel} stories with AI prop-bet impact analysis. Page ${page} of ${totalPages}.
            </p>
            <p style="margin-top:18px">
              <a href="${baseHref}" style="color:var(--gold);font-size:13px;font-weight:600;text-decoration:none;font-family:var(--font-mono);letter-spacing:0.1em;text-transform:uppercase">← Back to ${sportLabel} latest</a>
            </p>
          </div>
        </div>

        <section class="news-section">
          <div class="section-heading">
            <h2>📰 Page ${page}</h2>
            <span class="section-meta">${articles.length} of ${total} ${sportLabel} stories · newest first</span>
          </div>
          <div class="article-grid uniform-grid fade-stagger">
            ${articles.map((a) => renderArticleCard(a)).join('')}
          </div>
          ${renderPagination({ currentPage, totalPages, baseHref })}
        </section>

        ${renderCrossSportStrip(sport)}

      </div>
    </main>
    ${renderFooter()}
  `;

  injectPaginationLinkTags({ currentPage, totalPages, baseUrl });
}

/* ── Cross-sport strip — bottom of every sport page ────────────────── */
function renderCrossSportStrip(currentSport) {
  const sports = ['mlb', 'nfl', 'nba', 'nhl'].filter((s) => s !== currentSport);
  return `
    <section style="margin:48px 0 16px;padding:28px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)">
      <div style="text-align:center">
        <div style="font-family:var(--font-mono);font-size:10px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;color:var(--paper-faint);margin-bottom:14px">Other sections</div>
        <div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center">
          <a href="/news" class="btn btn-ghost" style="padding:10px 18px;font-size:12px">📰 All News</a>
          ${sports.map((s) => `
            <a href="/news/${s}" class="btn btn-ghost" style="padding:10px 18px;font-size:12px">${SPORT_EMOJI[s]} ${SPORT_LABELS[s]}</a>
          `).join('')}
        </div>
      </div>
    </section>
  `;
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
