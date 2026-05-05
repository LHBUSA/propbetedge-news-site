/**
 * src/pages/home.js
 * Editorial homepage — magazine layout
 *
 * v3.16: 📝 Lead dek readability pass
 *   - Removed italics on the lead-story dek (was hard to read at a glance)
 *   - Bumped contrast: rgba(255,255,255,0.92) on lead, with subtle text-shadow
 *     for legibility against busy hero images
 *   - Added 200-char truncation on word boundary so dek stays punchy
 *   - Kept original copy in tooltip (title attr) for full context on hover
 *
 * v3.15: ⏱ Lead carousel freshness gate (5h max age, slow-time fallback)
 * v3.14: 🎠 Lead story carousel — rotates top stories every 8 sec
 * v3.13: 🔄 Auto-refresh + bigger story sizing
 * v3.12.x: breaking banner tiers + recap exclusion
 * v3.12: morning-coffee hero priority
 * v3.11: trust API ordering
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

// v3.13: auto-refresh tunables
const REFRESH_INTERVAL_MS = 3 * 60 * 1000;  // 3 min
const REFRESH_FADE_MS = 280;                 // crossfade duration when content swaps
let _refreshHandle = null;
let _currentRoot = null;

// v3.14: lead carousel state
const LEAD_CYCLE_MS = 8000;       // 8 sec per slide
const LEAD_POOL_SIZE = 5;         // rotate through top 5 stories
const LEAD_RESUME_DELAY_MS = 12000; // resume auto-cycle 12s after manual nav
// v3.15: anything older than this is excluded from the lead carousel —
// unless nothing fresh exists (overnight / slow news days), in which case
// we fall back to whatever's available so the lead is never empty.
const MAX_LEAD_AGE_MS = 5 * 60 * 60 * 1000;  // 5 hours
let _leadPool = [];
let _leadIndex = 0;
let _leadCycleHandle = null;
let _leadResumeHandle = null;
let _leadHovering = false;

export async function renderHome(root) {
  _currentRoot = root;
  injectHomeStyles();

  // Skeleton shell
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
            <span id="latest-refresh-pulse" class="refresh-pulse" style="display:none">↻ Updated</span>
          </div>
          <div id="latest-grid" class="article-grid uniform-grid fade-stagger">${cardSkeleton(6)}</div>
        </section>

        <!-- Per-sport rails -->
        <div id="sport-rails"></div>
      </div>
    </main>
    ${renderFooter()}
  `;

  // Initial load
  const data = await fetchHomeData();
  populateHome(data, { animate: false });
  injectHomePageSchema(data.homepage.articles || []);

  // Start auto-refresh — re-fetch every 3 min, swap content if newer articles arrived
  startAutoRefresh();

  // Cleanup interval on navigate-away
  window.addEventListener('beforeunload', stopAutoRefresh, { once: true });
  window.addEventListener('popstate', stopAutoRefresh, { once: true });
}

// ─── Data fetching ──────────────────────────────────────────────────────
async function fetchHomeData() {
  const [breaking, homepage, mlbData, nflData, nbaData, nhlData] = await Promise.all([
    api.breaking().catch(() => ({ articles: [] })),
    api.homepage().catch(() => ({ articles: [] })),
    api.newsBySport('mlb', 4, 1).catch(() => ({ articles: [], total: 0 })),
    api.newsBySport('nfl', 4, 1).catch(() => ({ articles: [], total: 0 })),
    api.newsBySport('nba', 4, 1).catch(() => ({ articles: [], total: 0 })),
    api.newsBySport('nhl', 4, 1).catch(() => ({ articles: [], total: 0 })),
  ]);
  return { breaking, homepage, mlbData, nflData, nbaData, nhlData };
}

// ─── Auto-refresh loop ──────────────────────────────────────────────────
function startAutoRefresh() {
  stopAutoRefresh();
  _refreshHandle = setInterval(async () => {
    if (!document.getElementById('lead-slot')) {
      // We've navigated away — stop polling
      stopAutoRefresh();
      return;
    }
    if (document.hidden) return;  // don't refresh when tab is backgrounded
    try {
      const data = await fetchHomeData();
      if (hasFreshContent(data)) {
        populateHome(data, { animate: true });
        flashRefreshPulse();
      }
    } catch (e) {
      console.warn('[home auto-refresh]', e.message);
    }
  }, REFRESH_INTERVAL_MS);
}

function stopAutoRefresh() {
  if (_refreshHandle) {
    clearInterval(_refreshHandle);
    _refreshHandle = null;
  }
  // v3.14: also stop the carousel
  stopLeadCycle();
  if (_leadResumeHandle) {
    clearTimeout(_leadResumeHandle);
    _leadResumeHandle = null;
  }
}

// Check if the new data has fresher content than what's currently in the
// carousel pool. v3.14: any change in top-5 article IDs (order or set)
// triggers re-population so newly published articles appear in rotation.
function hasFreshContent(data) {
  const newTop5 = (data.homepage.articles || []).slice(0, LEAD_POOL_SIZE).map((a) => String(a.id));
  const currentTop5 = _leadPool.map((a) => String(a.id));
  if (newTop5.length === 0) return false;
  if (currentTop5.length === 0) return true;
  if (newTop5.length !== currentTop5.length) return true;
  for (let i = 0; i < newTop5.length; i++) {
    if (newTop5[i] !== currentTop5[i]) return true;
  }
  return false;
}

// Brief visual indicator that content was just refreshed
function flashRefreshPulse() {
  const pulse = document.getElementById('latest-refresh-pulse');
  if (!pulse) return;
  pulse.style.display = '';
  pulse.classList.add('refresh-pulse-on');
  setTimeout(() => {
    pulse.classList.remove('refresh-pulse-on');
    setTimeout(() => { pulse.style.display = 'none'; }, 600);
  }, 2400);
}

// ─── Populate sections ──────────────────────────────────────────────────
function populateHome(data, opts = {}) {
  const { animate = false } = opts;
  const fadeClass = animate ? 'fade-swap' : '';

  // Breaking ribbon — prefer fresh non-recap, fall back to most recent non-recap
  const MAX_FRESH_BREAKING_MS = 12 * 60 * 60 * 1000;
  const nowTs = Date.now();
  const breakingCandidates = (data.breaking.articles || []).filter(
    (a) => a.category !== 'recap' && a.topic_kind !== 'recap'
  );
  const freshBreaking = breakingCandidates.find(
    (a) => (nowTs - new Date(a.published_at).getTime()) < MAX_FRESH_BREAKING_MS
  );
  const breakingPick = freshBreaking || breakingCandidates[0];
  const breakingSlot = document.getElementById('breaking-slot');
  if (breakingSlot) {
    breakingSlot.innerHTML = breakingPick ? renderBreakingBanner(breakingPick) : '';
  }

  const all = data.homepage.articles || [];
  const leadSlot = document.getElementById('lead-slot');
  const sidebarSlot = document.getElementById('sidebar-slot');
  const latestGrid = document.getElementById('latest-grid');

  if (!all.length) {
    if (leadSlot) leadSlot.innerHTML = `
      <div class="empty">
        <h3>News engine warming up</h3>
        <p>First articles will appear within minutes.</p>
      </div>
    `;
    if (sidebarSlot) sidebarSlot.innerHTML = '';
    if (latestGrid) latestGrid.innerHTML = '';
    return;
  }

  // Lead — v3.15: carousel pool with 5-hour freshness gate
  const newPool = buildLeadPool(all);
  if (newPool.length === 0) {
    // No articles at all — show empty state (covered above by !all.length check)
    return;
  }
  const leadPick = newPool[0];
  if (leadSlot) {
    setLeadPool(newPool, { animate });
    if (animate) crossfade(leadSlot);
  }

  // Sidebar — top stories below the lead pool. Some overlap with carousel
  // is expected (real news sites do this — same story is often featured AND
  // listed in Top Stories). Filter out only the CURRENTLY-displayed lead.
  const remaining = all.filter((a) => a.id !== leadPick.id);
  const sidebarStories = remaining.slice(0, 4);
  if (sidebarSlot) {
    sidebarSlot.innerHTML = `
      <div class="sidebar-header">Top Stories</div>
      ${sidebarStories.map((s, i) =>
        i === 0 ? renderSidebarStoryHero(s) : renderSidebarStory(s)
      ).join('')}
    `;
    if (animate) crossfade(sidebarSlot);
  }

  // Latest grid — first card (anchor) is bigger
  // remaining = articles minus the carousel's currently-displayed lead
  const latest = remaining.slice(4, 10);
  if (latestGrid) {
    latestGrid.innerHTML = latest.length
      ? latest.map((a, i) => {
          const card = renderArticleCard(a);
          return i === 0 ? `<div class="latest-anchor">${card}</div>` : card;
        }).join('')
      : `<div class="empty" style="grid-column:1/-1"><h3>That's all for now</h3><p>More stories incoming.</p></div>`;
    if (animate) crossfade(latestGrid);
  }

  // Per-sport rails
  const sportData = {
    mlb: data.mlbData,
    nfl: data.nflData,
    nba: data.nbaData,
    nhl: data.nhlData,
  };
  const railsEl = document.getElementById('sport-rails');
  if (!railsEl) return;
  const sportsToShow = ['mlb', 'nfl', 'nba', 'nhl'].filter((s) => (sportData[s].articles || []).length > 0);
  railsEl.innerHTML = sportsToShow.map((sport) => {
    const sd = sportData[sport];
    const articles = (sd.articles || []).slice(0, 4);
    const total = sd.total || articles.length;
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
  if (animate) crossfade(railsEl);
}

function injectHomePageSchema(articles) {
  injectSchemas([
    organizationSchema(),
    websiteSchema(),
    homePageSchema(articles),
  ], 'jsonld-home');
}

function crossfade(el) {
  if (!el) return;
  el.style.opacity = '0.4';
  el.style.transition = `opacity ${REFRESH_FADE_MS}ms ease`;
  requestAnimationFrame(() => {
    el.style.opacity = '1';
  });
}

// ─── v3.14: Lead carousel ────────────────────────────────────────────────
function setLeadPool(newPool, opts = {}) {
  if (!newPool?.length) return;
  // Try to keep showing the same article if it's still in the new pool
  const currentArticleId = _leadPool[_leadIndex]?.id;
  _leadPool = newPool;
  const sameIdx = currentArticleId
    ? newPool.findIndex((a) => String(a.id) === String(currentArticleId))
    : -1;
  _leadIndex = sameIdx >= 0 ? sameIdx : 0;
  showLeadIndex(_leadIndex, { skipFade: !opts.animate });
  if (newPool.length > 1) {
    startLeadCycle();
  } else {
    stopLeadCycle();
  }
  attachLeadHoverHandlers();
}

function showLeadIndex(idx, opts = {}) {
  const article = _leadPool[idx];
  if (!article) return;
  const slot = document.getElementById('lead-slot');
  if (!slot) return;

  if (opts.skipFade) {
    slot.innerHTML = renderLeadStory(article) + renderLeadDots(idx);
    wireLeadDots();
    return;
  }

  // Crossfade: fade out, swap content, fade in
  slot.style.transition = `opacity 320ms ease`;
  slot.style.opacity = '0';
  setTimeout(() => {
    slot.innerHTML = renderLeadStory(article) + renderLeadDots(idx);
    wireLeadDots();
    requestAnimationFrame(() => {
      slot.style.opacity = '1';
    });
  }, 280);
}

function advanceLead() {
  if (_leadHovering) return;  // pause cycling while hovered
  if (!_leadPool.length) return;
  _leadIndex = (_leadIndex + 1) % _leadPool.length;
  showLeadIndex(_leadIndex);
}

function startLeadCycle() {
  stopLeadCycle();
  if (_leadPool.length <= 1) return;
  _leadCycleHandle = setInterval(advanceLead, LEAD_CYCLE_MS);
}

function stopLeadCycle() {
  if (_leadCycleHandle) {
    clearInterval(_leadCycleHandle);
    _leadCycleHandle = null;
  }
}

function attachLeadHoverHandlers() {
  const slot = document.getElementById('lead-slot');
  if (!slot || slot.dataset.hoverWired === '1') return;
  slot.dataset.hoverWired = '1';
  slot.addEventListener('mouseenter', () => { _leadHovering = true; });
  slot.addEventListener('mouseleave', () => { _leadHovering = false; });
}

function renderLeadDots(activeIdx) {
  if (_leadPool.length <= 1) return '';
  const dots = _leadPool.map((_, i) =>
    `<button class="lead-dot${i === activeIdx ? ' lead-dot-active' : ''}" data-lead-dot="${i}" aria-label="Show story ${i + 1}"></button>`
  ).join('');
  return `<div class="lead-dots">${dots}</div>`;
}

function wireLeadDots() {
  const slot = document.getElementById('lead-slot');
  if (!slot) return;
  slot.querySelectorAll('[data-lead-dot]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const idx = parseInt(btn.dataset.leadDot, 10);
      if (Number.isNaN(idx)) return;
      _leadIndex = idx;
      showLeadIndex(idx);
      // Pause auto-cycle, then resume after a delay so user has time to read
      stopLeadCycle();
      if (_leadResumeHandle) clearTimeout(_leadResumeHandle);
      _leadResumeHandle = setTimeout(startLeadCycle, LEAD_RESUME_DELAY_MS);
    });
  });
}

// ─── v3.15 Lead pool with freshness gate ─────────────────────────────────
// Returns array of up to LEAD_POOL_SIZE articles for the carousel.
// Hard rule: nothing older than MAX_LEAD_AGE_MS (5h) leads, UNLESS no fresh
// articles exist (overnight / slow news days), in which case we fall back
// to the top articles regardless of age.
function buildLeadPool(articles) {
  if (!articles?.length) return [];

  const now = Date.now();
  const FRESH_RECAP_MS = 12 * 60 * 60 * 1000;
  const ageOf = (a) => now - new Date(a.published_at).getTime();

  // Fresh = < 5 hours old. Prefer items with images.
  const fresh = articles.filter((a) => ageOf(a) < MAX_LEAD_AGE_MS);
  const freshWithImage = fresh.filter((a) => a.image_url);

  if (freshWithImage.length > 0) {
    // Within fresh-with-image, sort recaps by impact_score (morning-coffee
    // priority from v3.12) ahead of non-recaps which keep API order.
    const freshRecaps = freshWithImage
      .filter((a) =>
        (a.category === 'recap' || a.topic_kind === 'recap') &&
        ageOf(a) < FRESH_RECAP_MS
      )
      .sort((x, y) =>
        (y.relevance_score || y.take?.impact_score || 0) -
        (x.relevance_score || x.take?.impact_score || 0)
      );
    const freshNonRecaps = freshWithImage.filter((a) =>
      a.category !== 'recap' && a.topic_kind !== 'recap'
    );
    // Dedupe by id, cap at pool size
    const pool = [...freshRecaps, ...freshNonRecaps]
      .filter((a, i, arr) => arr.findIndex((x) => x.id === a.id) === i)
      .slice(0, LEAD_POOL_SIZE);
    if (pool.length > 0) return pool;
  }

  // No fresh articles — slow news / overnight fallback.
  // Use top articles regardless of age, prefer those with images.
  const withImage = articles.filter((a) => a.image_url);
  const fallbackPool = (withImage.length ? withImage : articles).slice(0, LEAD_POOL_SIZE);
  return fallbackPool;
}

// ─── Renderers (lead/sidebar/skeletons) ──────────────────────────────────

// v3.13: Bigger lead story — larger image area, bolder headline, more visual weight
// v3.16: Dek truncated to ~200 chars, italic removed, higher contrast
function renderLeadStory(article) {
  const url = article.url || `/news/${article.sport}/${article.slug}`;
  const date = new Date(article.published_at);
  const sport = article.sport;
  const dekFull = article.take?.summary || article.summary || '';
  const dek = truncateDek(dekFull, 200);
  const impact = article.take?.impact_score;

  const imgBlock = article.image_url
    ? `<div class="lead-image lead-image-big">
         <img src="${escapeAttr(proxyImage(article.image_url))}" alt="${escapeAttr(article.title)}" class="hero-image-img" onerror="this.classList.add('img-broken')" />
         <div class="img-fallback">${SPORT_FALLBACK[sport] || '◆'}</div>
       </div>`
    : `<div class="lead-image lead-image-big"><div class="img-fallback">${SPORT_FALLBACK[sport] || '◆'}</div></div>`;

  const impactBadge = impact >= 4
    ? `<span class="lead-impact-badge">⚡ Impact ${impact}/5</span>`
    : '';

  return `
    <a href="${escapeAttr(url)}" class="lead-story lead-story-big fade-in" data-article-id="${escapeAttr(article.id)}">
      ${imgBlock}
      <div class="lead-meta">
        <span class="sport-tag">${escapeHtml(sport.toUpperCase())}</span>
        <span class="dot">·</span>
        <span class="timestamp">${formatRelative(date)}</span>
        ${impactBadge}
      </div>
      <h1 class="lead-headline lead-headline-big">${escapeHtml(article.title)}</h1>
      ${dek ? `<p class="lead-dek lead-dek-big" title="${escapeAttr(dekFull)}">${escapeHtml(dek)}</p>` : ''}
      <div class="lead-byline">
        <span>By <strong style="color:var(--paper)">${escapeHtml(article.author || 'PropBetEdge Staff')}</strong></span>
      </div>
    </a>
  `;
}

// v3.16: Truncate dek to roughly N chars, breaking on word boundary
function truncateDek(text, maxChars = 200) {
  if (!text || text.length <= maxChars) return text || '';
  const slice = text.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > maxChars * 0.7 ? lastSpace : maxChars;
  return slice.slice(0, cut).trim() + '…';
}

// v3.13: First sidebar slot gets a hero treatment with a small image
function renderSidebarStoryHero(article) {
  const url = article.url || `/news/${article.sport}/${article.slug}`;
  const date = new Date(article.published_at);
  const sport = article.sport;
  const imgBlock = article.image_url
    ? `<div class="sidebar-hero-img">
         <img src="${escapeAttr(proxyImage(article.image_url))}" alt="${escapeAttr(article.title)}" onerror="this.classList.add('img-broken')" />
         <div class="img-fallback">${SPORT_FALLBACK[sport] || '◆'}</div>
       </div>`
    : '';
  return `
    <a href="${escapeAttr(url)}" class="sidebar-story sidebar-story-hero">
      ${imgBlock}
      <div class="sidebar-meta">
        <span class="sport-tag">${escapeHtml(sport.toUpperCase())}</span>
        <span class="dot">·</span>
        <span class="timestamp">${formatRelative(date)}</span>
      </div>
      <h3 class="sidebar-headline-hero">${escapeHtml(article.title)}</h3>
    </a>
  `;
}

// v3.13: Style overrides — single source of CSS for the bigger-story treatment.
// These augment your existing stylesheet without modifying it.
function injectHomeStyles() {
  if (document.getElementById('pbe-home-v313-styles')) return;
  const s = document.createElement('style');
  s.id = 'pbe-home-v313-styles';
  s.textContent = `
    /* ─── v3.13 bigger lead story ───────────────────────────── */
    .lead-story-big .lead-image-big {
      aspect-ratio: 16 / 9;
      margin-bottom: 18px;
      border-radius: 10px;
      overflow: hidden;
    }
    .lead-story-big .lead-image-big img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.4s ease;
    }
    .lead-story-big:hover .lead-image-big img {
      transform: scale(1.03);
    }
    .lead-headline-big {
      font-size: clamp(28px, 4.4vw, 56px) !important;
      line-height: 1.05 !important;
      font-weight: 800 !important;
      margin: 12px 0 10px !important;
      letter-spacing: -0.5px;
    }
    .lead-dek-big {
      font-size: clamp(15px, 1.4vw, 19px) !important;
      line-height: 1.5 !important;
      font-style: normal !important;          /* v3.16: kill italics */
      font-weight: 400 !important;
      color: rgba(255, 255, 255, 0.92) !important;  /* v3.16: high contrast */
      text-shadow: 0 1px 6px rgba(0, 0, 0, 0.5);     /* v3.16: legibility on busy bg */
      margin-bottom: 16px !important;
      max-width: 64ch;                                /* readability cap */
    }
    .lead-impact-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: linear-gradient(135deg, rgba(245,166,35,0.18), rgba(245,166,35,0.06));
      border: 1px solid rgba(245,166,35,0.4);
      color: var(--gold, #F5A623);
      padding: 2px 9px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1.2px;
      text-transform: uppercase;
      margin-left: 8px;
    }

    /* ─── Sidebar #1 hero treatment ─────────────────────────── */
    .sidebar-story-hero {
      display: block;
      padding: 0 0 18px !important;
      border-bottom: 1px solid var(--line, rgba(255,255,255,0.08));
      margin-bottom: 14px;
      text-decoration: none;
      color: inherit;
    }
    .sidebar-hero-img {
      position: relative;
      aspect-ratio: 16 / 9;
      width: 100%;
      border-radius: 8px;
      overflow: hidden;
      margin-bottom: 10px;
      background: var(--paper-faint, rgba(255,255,255,0.04));
    }
    .sidebar-hero-img img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .sidebar-meta {
      font-size: 10px;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      color: var(--paper-subtle, #a0a8b4);
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .sidebar-headline-hero {
      font-size: 17px;
      font-weight: 700;
      line-height: 1.25;
      margin: 0;
      color: var(--paper, #fff);
    }

    /* ─── Latest grid: anchor card spans 2 cols on desktop ───── */
    @media (min-width: 900px) {
      .latest-section .article-grid.uniform-grid {
        grid-template-columns: repeat(3, 1fr);
      }
      .latest-section .latest-anchor {
        grid-column: span 2;
        grid-row: span 2;
      }
      .latest-section .latest-anchor .article-card {
        height: 100%;
      }
      .latest-section .latest-anchor .article-card-img {
        aspect-ratio: 16 / 9;
      }
      .latest-section .latest-anchor .article-card-headline {
        font-size: clamp(20px, 1.8vw, 26px);
        line-height: 1.18;
      }
    }

    /* ─── Refresh pulse indicator ───────────────────────────── */
    .refresh-pulse {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: var(--gold, #F5A623);
      margin-left: 12px;
      padding: 3px 10px;
      background: rgba(245,166,35,0.1);
      border: 1px solid rgba(245,166,35,0.3);
      border-radius: 999px;
      opacity: 0;
      transition: opacity 0.4s ease;
    }
    .refresh-pulse.refresh-pulse-on {
      opacity: 1;
    }

    /* ─── v3.14 lead carousel dots ────────────────────────────── */
    .lead-dots {
      display: flex;
      justify-content: center;
      gap: 8px;
      margin-top: 18px;
      padding: 4px 0;
    }
    .lead-dot {
      width: 28px;
      height: 4px;
      border-radius: 4px;
      background: rgba(255,255,255,0.18);
      border: none;
      cursor: pointer;
      padding: 0;
      transition: all 0.25s ease;
    }
    .lead-dot:hover {
      background: rgba(255,255,255,0.4);
    }
    .lead-dot-active {
      background: var(--gold, #F5A623);
      width: 44px;
      box-shadow: 0 0 12px rgba(245,166,35,0.4);
    }
    /* Subtle "paused" indicator when user hovers the lead */
    .lead-story-big {
      position: relative;
    }
  `;
  document.head.appendChild(s);
}

function leadSkeleton() {
  return `
    <div>
      <div class="skel skel-card-img" style="aspect-ratio:16/9"></div>
      <div class="skel skel-line" style="width:30%;height:10px;margin-top:14px"></div>
      <div class="skel skel-line" style="width:90%;height:42px;margin-top:14px"></div>
      <div class="skel skel-line" style="width:75%;height:42px"></div>
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
