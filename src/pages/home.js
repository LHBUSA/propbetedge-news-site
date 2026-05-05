/**
 * src/pages/home.js
 * Editorial homepage — magazine layout
 *
 * v3.20: 🔆 Sidebar timestamp readability
 *   - Sidebar timestamps ("48M AGO", "2H AGO") were rendered in muted
 *     paper-subtle gray that was barely legible against the sidebar bg
 *   - Bumped .timestamp color globally inside sidebar context to white
 *     w/ heavier font-weight and letter-spacing
 *   - Catches both the #1 hero item (rendered here) and items 2-3
 *     (rendered by article-card.js component) via broad selector match
 *
 * v3.19: meta strip contrast pass for any-bg legibility
 * v3.18: layout balance fix (hero stretches, sidebar trim 4→3)
 * v3.17: cinematic overlay hero, mobile pass, all-4-sport rails
 * v3.16: lead dek readability
 * v3.15: 5h freshness gate
 * v3.14: lead carousel
 * v3.13: auto-refresh + bigger story sizing
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

  // Sidebar — top stories below the lead pool. v3.18: trimmed from 4 → 3
  // for tighter layout balance with the cinematic hero.
  const remaining = all.filter((a) => a.id !== leadPick.id);
  const sidebarStories = remaining.slice(0, 3);
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
  // v3.18: sidebar shows 3, so latest starts at index 3 in `remaining`
  const latest = remaining.slice(3, 9);
  if (latestGrid) {
    latestGrid.innerHTML = latest.length
      ? latest.map((a, i) => {
          const card = renderArticleCard(a);
          return i === 0 ? `<div class="latest-anchor">${card}</div>` : card;
        }).join('')
      : `<div class="empty" style="grid-column:1/-1"><h3>That's all for now</h3><p>More stories incoming.</p></div>`;
    if (animate) crossfade(latestGrid);
  }

  // Per-sport rails — v3.17: always show all 4 sports for brand consistency.
  // Empty sports get a placeholder with an archive link instead of being hidden.
  const sportData = {
    mlb: data.mlbData,
    nfl: data.nflData,
    nba: data.nbaData,
    nhl: data.nhlData,
  };
  const railsEl = document.getElementById('sport-rails');
  if (!railsEl) return;
  const allSports = ['mlb', 'nfl', 'nba', 'nhl'];
  railsEl.innerHTML = allSports.map((sport) => {
    const sd = sportData[sport];
    const articles = (sd.articles || []).slice(0, 4);
    const total = sd.total || articles.length;
    const hasContent = articles.length > 0;
    const headerHtml = `
      <div class="sport-rail-heading">
        <h2 class="sport-rail-title">
          <span class="sport-rail-emoji">${SPORT_FALLBACK[sport]}</span>
          ${sport.toUpperCase()}
          <span class="sport-rail-meta">· ${SPORT_LABELS[sport]} · ${total} ${total === 1 ? 'story' : 'stories'}</span>
        </h2>
        <a href="/news/${sport}" class="sport-rail-more">${hasContent ? `All ${sport.toUpperCase()}` : 'Explore archive'} →</a>
      </div>
    `;
    if (hasContent) {
      return `
        <section class="sport-rail-section">
          ${headerHtml}
          <div class="article-grid uniform-grid fade-stagger">
            ${articles.map((a) => renderArticleCard(a)).join('')}
          </div>
        </section>
      `;
    }
    // Empty state — placeholder card
    return `
      <section class="sport-rail-section sport-rail-empty">
        ${headerHtml}
        <div class="sport-rail-empty-card">
          <div class="sport-rail-empty-emoji">${SPORT_FALLBACK[sport]}</div>
          <div class="sport-rail-empty-body">
            <div class="sport-rail-empty-title">${sport.toUpperCase()} coverage incoming</div>
            <div class="sport-rail-empty-sub">${total > 0 ? `${total} ${total === 1 ? 'archive story' : 'archive stories'} available` : 'New coverage launching this season'}</div>
          </div>
          <a href="/news/${sport}" class="sport-rail-empty-cta">Visit /news/${sport} →</a>
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

// v3.17: Cinematic overlay hero — image fills card, content overlays bottom
// with darkening gradient (Athletic / BBC / NYT Sports pattern)
function renderLeadStory(article) {
  const url = article.url || `/news/${article.sport}/${article.slug}`;
  const date = new Date(article.published_at);
  const sport = article.sport;
  const dekFull = article.take?.summary || article.summary || '';
  const dek = truncateDek(dekFull, 180);
  const impact = article.take?.impact_score;

  const imgBlock = article.image_url
    ? `<img src="${escapeAttr(proxyImage(article.image_url))}" alt="${escapeAttr(article.title)}" class="lead-overlay-img" onerror="this.classList.add('img-broken')" />
       <div class="lead-overlay-fallback">${SPORT_FALLBACK[sport] || '◆'}</div>`
    : `<div class="lead-overlay-fallback lead-overlay-fallback-only">${SPORT_FALLBACK[sport] || '◆'}</div>`;

  const impactBadge = impact >= 4
    ? `<span class="lead-impact-badge">⚡ Impact ${impact}/5</span>`
    : '';

  return `
    <a href="${escapeAttr(url)}" class="lead-story lead-story-overlay fade-in" data-article-id="${escapeAttr(article.id)}">
      <div class="lead-overlay-image-wrap">
        ${imgBlock}
        <div class="lead-overlay-gradient"></div>
      </div>
      <div class="lead-overlay-content">
        <div class="lead-meta">
          <span class="sport-tag">${escapeHtml(sport.toUpperCase())}</span>
          <span class="dot">·</span>
          <span class="timestamp">${formatRelative(date)}</span>
          ${impactBadge}
        </div>
        <h1 class="lead-headline-overlay">${escapeHtml(article.title)}</h1>
        ${dek ? `<p class="lead-dek-overlay">${escapeHtml(dek)}</p>` : ''}
        <div class="lead-byline-overlay">
          <span>By <strong>${escapeHtml(article.author || 'PropBetEdge Staff')}</strong></span>
        </div>
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
    /* ─── v3.17 cinematic overlay hero ───────────────────────── */
    /* v3.18: dropped aspect-ratio in favor of height:100% + min-height.
       In the lead-grid, this stretches to match sidebar height naturally. */
    .lead-story-overlay {
      position: relative;
      display: block;
      height: 100%;
      min-height: 540px;
      border-radius: 14px;
      overflow: hidden;
      text-decoration: none !important;
      color: inherit;
      background: #0a0a0a;
      transition: transform 0.3s ease, box-shadow 0.3s ease;
      box-shadow: 0 8px 24px rgba(0,0,0,0.25);
    }
    .lead-story-overlay:hover {
      transform: translateY(-2px);
      box-shadow: 0 16px 40px rgba(0,0,0,0.4);
    }
    .lead-overlay-image-wrap {
      position: absolute;
      inset: 0;
      z-index: 1;
      overflow: hidden;
    }
    .lead-overlay-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.5s ease;
    }
    .lead-story-overlay:hover .lead-overlay-img {
      transform: scale(1.025);
    }
    .lead-overlay-fallback {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: clamp(80px, 14vw, 140px);
      opacity: 0.18;
      pointer-events: none;
    }
    .lead-overlay-fallback-only {
      background: linear-gradient(135deg, #1a1a1a, #0a0a0a);
      opacity: 0.5;
    }
    .lead-overlay-gradient {
      position: absolute;
      inset: 0;
      background: linear-gradient(
        180deg,
        rgba(0,0,0,0) 0%,
        rgba(0,0,0,0) 28%,
        rgba(0,0,0,0.55) 60%,
        rgba(0,0,0,0.92) 100%
      );
      pointer-events: none;
      z-index: 2;
    }
    .lead-overlay-content {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      padding: clamp(20px, 3vw, 40px);
      z-index: 3;
      color: #fff;
    }
    .lead-overlay-content .lead-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      font-size: 11px;
      letter-spacing: 1.4px;
      text-transform: uppercase;
      color: #fff;
      margin-bottom: 14px;
    }
    /* v3.19: solid dark pill + brighter border + backdrop blur for any-bg legibility */
    .lead-overlay-content .sport-tag {
      background: rgba(0, 0, 0, 0.65);
      backdrop-filter: blur(10px) saturate(140%);
      -webkit-backdrop-filter: blur(10px) saturate(140%);
      border: 1px solid rgba(255, 255, 255, 0.45);
      color: #fff;
      padding: 4px 10px;
      border-radius: 4px;
      font-weight: 700;
      font-size: 10px;
      letter-spacing: 1.5px;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    }
    /* v3.19: timestamp gets text-shadow halo, no pill */
    .lead-overlay-content .dot {
      color: rgba(255, 255, 255, 0.65);
      text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
      font-weight: 700;
    }
    .lead-overlay-content .timestamp {
      color: #fff;
      font-weight: 600;
      text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8), 0 0 12px rgba(0, 0, 0, 0.5);
      letter-spacing: 1.4px;
    }
    .lead-headline-overlay {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: clamp(24px, 3.8vw, 50px);
      line-height: 1.06;
      font-weight: 800;
      letter-spacing: -0.5px;
      margin: 0 0 14px;
      color: #fff;
      text-shadow: 0 2px 16px rgba(0,0,0,0.6);
    }
    .lead-dek-overlay {
      font-size: clamp(14px, 1.2vw, 17px);
      line-height: 1.5;
      font-style: normal;
      font-weight: 400;
      color: rgba(255,255,255,0.92);
      text-shadow: 0 1px 8px rgba(0,0,0,0.7);
      margin: 0 0 14px;
      max-width: 64ch;
    }
    .lead-byline-overlay {
      font-size: 12px;
      letter-spacing: 0.5px;
      color: rgba(255,255,255,0.78);
    }
    .lead-byline-overlay strong {
      color: #fff;
      font-weight: 700;
    }
    /* v3.19: impact badge bumped opacity + text-shadow + outer glow */
    .lead-impact-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: linear-gradient(135deg, rgba(245,166,35,0.55), rgba(245,166,35,0.35));
      backdrop-filter: blur(10px) saturate(140%);
      -webkit-backdrop-filter: blur(10px) saturate(140%);
      border: 1px solid rgba(255,200,90,0.85);
      color: #fff;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1.2px;
      text-transform: uppercase;
      margin-left: 8px;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
      box-shadow:
        0 2px 8px rgba(0, 0, 0, 0.35),
        0 0 16px rgba(245, 166, 35, 0.4);
    }

    /* ─── v3.18 ensure grid columns stretch to match heights ─── */
    .lead-grid {
      align-items: stretch !important;
    }
    .lead-grid > * {
      min-height: 0;
    }
    /* Lead slot must fill the grid cell so the overlay's height:100% works */
    #lead-slot {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    #lead-slot > .lead-story-overlay {
      flex: 1 1 auto;
    }
    /* Tighten section gap between lead row and Latest */
    .latest-section {
      margin-top: clamp(28px, 4vw, 48px);
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
      font-size: 11px;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.85) !important;  /* v3.20: brighter than --paper-subtle */
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 600;
    }
    /* v3.20: catch ALL sidebar timestamps (#1 hero rendered here + #2/#3
       from article-card.js). High specificity overrides the muted defaults. */
    .sidebar-story .timestamp,
    .sidebar-meta .timestamp,
    .top-stories .timestamp,
    .sidebar-story time,
    .top-stories time {
      color: rgba(255, 255, 255, 0.82) !important;
      font-weight: 600 !important;
      letter-spacing: 1px !important;
      font-size: 11px !important;
    }
    .sidebar-story .dot,
    .sidebar-meta .dot,
    .top-stories .dot {
      color: rgba(255, 255, 255, 0.45) !important;
      font-weight: 700 !important;
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

    /* ─── Empty sport rail placeholder ───────────────────────── */
    .sport-rail-empty .sport-rail-empty-card {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 22px 24px;
      background: linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01));
      border: 1px dashed var(--line, rgba(255,255,255,0.12));
      border-radius: 10px;
    }
    .sport-rail-empty-emoji {
      font-size: 36px;
      opacity: 0.55;
      flex-shrink: 0;
    }
    .sport-rail-empty-body {
      flex: 1;
      min-width: 0;
    }
    .sport-rail-empty-title {
      font-family: var(--font-d, 'Oswald', sans-serif);
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 1.2px;
      text-transform: uppercase;
      color: var(--paper, #fff);
      margin-bottom: 3px;
    }
    .sport-rail-empty-sub {
      font-size: 12px;
      color: var(--paper-subtle, #a0a8b4);
      letter-spacing: 0.3px;
    }
    .sport-rail-empty-cta {
      flex-shrink: 0;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.8px;
      color: var(--gold, #F5A623);
      text-decoration: none;
      padding: 8px 14px;
      border: 1px solid rgba(245,166,35,0.3);
      border-radius: 6px;
      transition: all 0.15s ease;
    }
    .sport-rail-empty-cta:hover {
      background: rgba(245,166,35,0.1);
      border-color: rgba(245,166,35,0.6);
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
      margin-top: 16px;
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

    /* ─── v3.17 mobile pass ──────────────────────────────────── */
    @media (max-width: 700px) {
      .lead-story-overlay {
        aspect-ratio: 4 / 5;  /* taller for portrait phones */
        border-radius: 10px;
      }
      .lead-overlay-content {
        padding: 18px 18px 20px;
      }
      .lead-headline-overlay {
        font-size: clamp(20px, 5.4vw, 28px);
        line-height: 1.1;
        margin-bottom: 10px;
      }
      .lead-dek-overlay {
        font-size: 13px;
        line-height: 1.45;
        margin-bottom: 10px;
        /* hide dek on very small screens to keep hero clean */
      }
      .lead-overlay-content .lead-meta {
        margin-bottom: 10px;
        font-size: 10px;
      }
      .lead-byline-overlay {
        font-size: 11px;
      }
      /* Bigger touch targets for carousel dots on mobile */
      .lead-dot {
        height: 6px;
        width: 32px;
      }
      .lead-dot-active {
        width: 48px;
      }
      /* Sidebar hero img scales down */
      .sidebar-hero-img {
        aspect-ratio: 16 / 10;
      }
      .sidebar-headline-hero {
        font-size: 15px;
      }
      /* Latest anchor reverts to single col on mobile */
      .latest-section .latest-anchor {
        grid-column: auto;
        grid-row: auto;
      }
      /* Empty rail card stacks vertical */
      .sport-rail-empty .sport-rail-empty-card {
        flex-direction: column;
        align-items: flex-start;
        gap: 10px;
        padding: 16px;
      }
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
