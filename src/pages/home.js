/**
 * src/pages/home.js
 * Editorial homepage — magazine layout
 *
 * v3.12.1: breaking banner excludes recaps. Banner is for time-sensitive
 *          market-moving news (injuries, trades, lineup changes), not daily
 *          morning editorial. Recaps live in hero (morning) and Top Stories.
 *
 * v3.12: morning-coffee hero priority. Fresh recaps (< 12hr old) with images
 *        win the lead slot, sorted by impact_score. After 12hr, fall back to
 *        v3.11 API recency ordering so evening users see tonight's lineup /
 *        breaking news instead of stale recaps.
 *
 * v3.11: trust API ordering for lead/sidebar (was: client-side re-sort by impact_score
 *        only, which buried fresh news under yesterday's high-impact bangers)
 *
 *  Structure:
 *  ┌─────────────────────────────────────────────────────┐
 *  │ Breaking ribbon (impact 5/5 only)                  │
 *  └─────────────────────────────────────────────────────┘
 *  ┌─────────────────────────┬───────────────────────────┐
 *  │  LEAD STORY             │  Top Stories sidebar     │
 *  │  (big photo + headline) │  (4 plain text)          │
 *  └─────────────────────────┴───────────────────────────┘
 *  ─── Latest ──────────────────────────────────────────
 *  ┌──────┬──────┬──────┐
 *  │ card │ card │ card │   3-up grid, ALL same size
 *  ├──────┼──────┼──────┤
 *  │ card │ card │ card │
 *  └──────┴──────┴──────┘
 *  ─── MLB ── All MLB → ────────────────────────────────
 *  ┌──────┬──────┬──────┬──────┐
 *  │ card │ card │ card │ card │   4-up rail
 *  └──────┴──────┴──────┴──────┘
 *  (repeat for NFL / NBA / NHL — counts pulled from real DB totals)
 */

import { api } from '../api.js';
import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { renderArticleCard, renderSidebarStory, escapeHtml, escapeAttr, formatRelative } from '../components/article-card.js';
import { renderBreakingBanner } from '../components/breaking-banner.js';
import { proxyImage } from '../ads-config.js';
import { organizationSchema, websiteSchema, homePageSchema, injectSchemas } from '../schema.js';

const SPORT_FALLBACK = { mlb: '⚾', nfl: '🏈', nba: '🏀', nhl: '🏒' };
const SPORT_LABELS   = { mlb: 'Baseball', nfl: 'Football', nba: 'Basketball', nhl: 'Hockey' };

export async function renderHome(root) {
  root.innerHTML = `
    ${renderHeader()}
    <main>
      <div id="breaking-slot"></div>

      <div class="container">
        <!-- Lead + sidebar -->
        <section class="lead-section">
          <div class="lead-grid">
            <div id="lead-slot">${leadSkeleton()}</div>
            <aside id="sidebar-slot" class="lead-sidebar">
              <div class="sidebar-header">Top Stories</div>
              ${sidebarSkeleton(4)}
            </aside>
          </div>
        </section>

        <!-- Latest grid -->
        <section class="latest-section">
          <div class="section-heading">
            <h2>📰 Latest</h2>
            <a href="/news" class="more-link">All news →</a>
          </div>
          <div id="latest-grid" class="article-grid uniform-grid fade-stagger">${cardSkeleton(6)}</div>
        </section>

        <!-- Per-sport rails -->
        <div id="sport-rails"></div>
      </div>
    </main>
    ${renderFooter()}
  `;

  // Fetch breaking + homepage feed (for lead/sidebar/Latest) + each sport independently for rails
  const [breaking, homepage, mlbData, nflData, nbaData, nhlData] = await Promise.all([
    api.breaking().catch(() => ({ articles: [] })),
    api.homepage().catch(() => ({ articles: [] })),
    api.newsBySport('mlb', 4, 1).catch(() => ({ articles: [], total: 0 })),
    api.newsBySport('nfl', 4, 1).catch(() => ({ articles: [], total: 0 })),
    api.newsBySport('nba', 4, 1).catch(() => ({ articles: [], total: 0 })),
    api.newsBySport('nhl', 4, 1).catch(() => ({ articles: [], total: 0 })),
  ]);

  // Breaking ribbon
  // v3.12.1: exclude recaps from the breaking banner. Recaps are daily
  // morning editorial, not "breaking" news. The banner is reserved for
  // genuinely time-sensitive stories (injuries, trades, lineup changes)
  // that affect tonight's prop markets. If no qualifying article exists,
  // the banner stays empty — better empty than misleading.
  const breakingPick = (breaking.articles || []).find(
    (a) => a.category !== 'recap' && a.topic_kind !== 'recap'
  );
  if (breakingPick) {
    document.getElementById('breaking-slot').innerHTML = renderBreakingBanner(breakingPick);
  }

  const all = homepage.articles || [];

  // Inject homepage schema
  injectSchemas([
    organizationSchema(),
    websiteSchema(),
    homePageSchema(all),
  ], 'jsonld-home');

  if (!all.length) {
    document.getElementById('lead-slot').innerHTML = `
      <div class="empty">
        <h3>News engine warming up</h3>
        <p>First articles will appear within minutes.</p>
      </div>
    `;
    document.getElementById('sidebar-slot').innerHTML = '';
    document.getElementById('latest-grid').innerHTML = '';
    return;
  }

  // 1. Lead story = first article with image (API already sorted by recency_score)
  //    v3.12: pickLead now prefers fresh recaps in the morning window.
  const lead = pickLead(all);
  document.getElementById('lead-slot').innerHTML = renderLeadStory(lead);

  // 2. Sidebar = next 4 stories in API order (recency-weighted)
  const remaining = all.filter((a) => a.id !== lead.id);
  const sidebarStories = remaining.slice(0, 4);
  document.getElementById('sidebar-slot').innerHTML = `
    <div class="sidebar-header">Top Stories</div>
    ${sidebarStories.map(renderSidebarStory).join('')}
  `;

  // 3. Latest grid = next 6 articles, all same size
  const latest = remaining.slice(4, 10);
  document.getElementById('latest-grid').innerHTML = latest.length
    ? latest.map((a) => renderArticleCard(a)).join('')
    : `<div class="empty" style="grid-column:1/-1"><h3>That's all for now</h3><p>More stories incoming.</p></div>`;

  // 4. Per-sport rails — each sport fetched independently so counts reflect actual DB totals
  const sportData = {
    mlb: mlbData,
    nfl: nflData,
    nba: nbaData,
    nhl: nhlData,
  };

  const railsEl = document.getElementById('sport-rails');
  const sportsToShow = ['mlb', 'nfl', 'nba', 'nhl'].filter((s) => (sportData[s].articles || []).length > 0);

  railsEl.innerHTML = sportsToShow.map((sport) => {
    const data = sportData[sport];
    const articles = (data.articles || []).slice(0, 4);
    const total = data.total || articles.length;  // ← real DB total, not group count
    return `
      <section class="sport-rail-section">
        <div class="sport-rail-heading">
          <h2 class="sport-rail-title">
            <span class="sport-rail-emoji">${SPORT_FALLBACK[sport]}</span>
            ${sport.toUpperCase()}
            <span class="sport-rail-meta">· ${SPORT_LABELS[sport]} · ${total} ${total === 1 ? 'story' : 'stories'}</span>
          </h2>
          <a href="/news/${sport}" class="sport-rail-more">All ${sport.toUpperCase()} →</a>
        </div>
        <div class="article-grid uniform-grid fade-stagger">
          ${articles.map((a) => renderArticleCard(a)).join('')}
        </div>
      </section>
    `;
  }).join('');
}

// ─── Helpers ────────────────────────────────────────────────────────────
// v3.12: Morning-coffee hero priority. Fresh recaps (< 12hr old) with images
// win the lead slot, sorted by impact_score. After 12hr, fall back to v3.11
// recency-weighted API ordering. Recaps that age past 12hr drop out of the
// hero so evening readers see tonight's lineup news / breaking stories
// instead of stale game recaps.
//
// v3.11: API returns articles sorted by recency-weighted homepage_score.
// Old version re-sorted by impact_score only, which buried fresh news.
function pickLead(articles) {
  const FRESH_RECAP_MS = 12 * 60 * 60 * 1000;
  const now = Date.now();

  // Fresh recaps with images, ranked by impact_score
  const freshRecaps = articles
    .filter((a) =>
      (a.category === 'recap' || a.topic_kind === 'recap') &&
      a.image_url &&
      (now - new Date(a.published_at).getTime()) < FRESH_RECAP_MS
    )
    .sort((a, b) =>
      (b.relevance_score || b.take?.impact_score || 0) -
      (a.relevance_score || a.take?.impact_score || 0)
    );

  if (freshRecaps.length > 0) return freshRecaps[0];

  // v3.11 fallback: first article with image (API already recency-sorted)
  const firstWithImage = articles.find((a) => a.image_url);
  return firstWithImage || articles[0];
}

function renderLeadStory(article) {
  const url = article.url || `/news/${article.sport}/${article.slug}`;
  const date = new Date(article.published_at);
  const sport = article.sport;
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
      <h1 class="lead-headline">${escapeHtml(article.title)}</h1>
      ${dek ? `<p class="lead-dek">${escapeHtml(dek)}</p>` : ''}
      <div class="lead-byline">
        <span>By <strong style="color:var(--paper)">${escapeHtml(article.author || 'PropBetEdge Staff')}</strong></span>
      </div>
    </a>
  `;
}

function leadSkeleton() {
  return `
    <div>
      <div class="skel skel-card-img"></div>
      <div class="skel skel-line" style="width:30%;height:10px"></div>
      <div class="skel skel-line" style="width:90%;height:36px;margin-top:14px"></div>
      <div class="skel skel-line" style="width:75%;height:36px"></div>
      <div class="skel skel-line" style="width:80%;height:18px;margin-top:12px"></div>
    </div>
  `;
}
function sidebarSkeleton(n) {
  let out = '';
  for (let i = 0; i < n; i++) {
    out += `
      <div style="padding:14px 0;border-bottom:1px solid var(--line)">
        <div class="skel skel-line" style="width:25%;height:10px"></div>
        <div class="skel skel-line" style="width:90%;height:18px;margin-top:8px"></div>
        <div class="skel skel-line" style="width:60%;height:18px"></div>
      </div>
    `;
  }
  return out;
}
function cardSkeleton(n) {
  let out = '';
  for (let i = 0; i < n; i++) {
    out += `
      <div class="skel-card">
        <div class="skel skel-card-img"></div>
        <div class="skel skel-line" style="width:25%;height:10px"></div>
        <div class="skel skel-line" style="width:90%;height:22px;margin-top:8px"></div>
        <div class="skel skel-line" style="width:75%;height:22px"></div>
      </div>
    `;
  }
  return out;
}
