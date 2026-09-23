/**
 * src/pages/sport.js
 * Sport-section landing — magazine section front with clean-route pagination.
 */

import { api } from '../api.js';
import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { renderArticleCard, renderSidebarStory, escapeHtml, formatRelative } from '../components/article-card.js';
import { proxyImage } from '../ads-config.js';
import {
  organizationSchema, websiteSchema, breadcrumbSchema,
  collectionPageSchema, injectSchemas,
} from '../schema.js';

const SPORT_FALLBACK = { mlb: '⚾', nfl: '🏈', nba: '🏀', nhl: '🏒' };
const SPORT_TAGLINES = {
  mlb: 'Strikeouts, home runs, hits, total bases — all the angles for tonight\'s diamond.',
  nfl: 'Yards, touchdowns, anytime scorers — the Sunday slate broken down.',
  nba: 'Points, assists, rebounds, threes — every angle on the hardwood.',
  nhl: 'Shots on goal, goals, saves — the ice-level edge.',
};
const SECTIONS = ['mlb', 'nfl', 'nba', 'nhl'];
const PAGE_SIZE = 20;
const HIGHLIGHTS_LIMIT = 6;
const HIGHLIGHTS_REFRESH_MS = 15 * 60 * 1000;

let _highlightsRefreshHandle = null;
let _highlightsRefreshSport = null;
let _nflYouTubeApiPromise = null;

function queryPage() {
  const params = new URLSearchParams(window.location.search);
  const page = parseInt(params.get('page'), 10);
  return page > 0 ? page : 1;
}

function normalizePage(sport, requestedPage) {
  const requested = Number.parseInt(requestedPage, 10);
  if (Number.isFinite(requested) && requested > 1) return requested;
  const legacy = queryPage();
  if (legacy > 1) {
    window.history.replaceState({}, '', `/news/${sport}/page/${legacy}`);
    return legacy;
  }
  return 1;
}

export async function renderSport(root, sport, requestedPage = 1) {
  // A sport route owns at most one highlights refresh loop.
  stopSportLifecycle();

  const tagline = SPORT_TAGLINES[sport] || '';
  const currentPage = normalizePage(sport, requestedPage);

  root.innerHTML = `
    ${renderHeader()}
    <main>
      <div class="section-bar">
        <div class="container section-bar-inner">
          <a href="/news" class="section-link">All News</a>
          ${SECTIONS.map((s) => `
            <a href="/news/${s}" class="section-link ${s === sport ? 'active' : ''}">${s.toUpperCase()}</a>
          `).join('')}
          <a href="/standings/${sport}" class="section-link">Standings</a>
        </div>
      </div>

      <div class="container" style="padding-top:40px">
        <div style="border-bottom:2px solid var(--gold);padding-bottom:18px;margin-bottom:32px">
          <div class="kicker kicker-gold" style="margin-bottom:8px">${escapeHtml(sport.toUpperCase())} · The Section</div>
          <h1 class="serif" style="font-family:var(--font-serif);font-size:clamp(36px,5vw,52px);font-weight:900;letter-spacing:-0.025em;margin:0 0 10px;line-height:1.05">${escapeHtml(sport.toUpperCase())} News & Notes</h1>
          <p style="font-family:var(--font-serif);font-style:italic;font-size:18px;color:var(--paper-dim);max-width:680px;margin:0">${escapeHtml(tagline)}</p>
        </div>

        <div id="sport-lead-slot">${cardSkeleton(1, true)}</div>
        <div id="highlights-slot">${currentPage === 1 ? highlightsSkeleton() : ''}</div>
        <div id="rest-slot">${cardSkeleton(8)}</div>
        <div id="pagination" class="pagination"></div>
      </div>
    </main>
    ${renderFooter()}
  `;

  const [data, highlights] = await Promise.all([
    api.newsBySport(sport, PAGE_SIZE, currentPage).catch(() => ({ articles: [] })),
    currentPage === 1 ? fetchHighlights(sport).catch(() => null) : Promise.resolve(null),
  ]);
  // Defense in depth: a sport section may only render rows whose canonical
  // sport matches the route, even if an upstream view/regression ever leaks.
  const articles = (data.articles || []).filter(
    (article) => String(article?.sport || '').toLowerCase() === sport
  );
  const sportLabel = sport.toUpperCase();

  if (currentPage === 1) {
    renderHighlightsSlot(sport, highlights);
    startSportHighlightsRefresh(sport);
  }

  injectSchemas([
    organizationSchema(),
    websiteSchema(),
    collectionPageSchema({
      url: `/news/${sport}`,
      name: `${sportLabel} News — PropBetEdge`,
      description: `Latest ${sportLabel} news with AI prop-bet impact analysis.`,
      articles,
    }),
    breadcrumbSchema([
      { name: 'Home', url: '/' },
      { name: 'News', url: '/news' },
      { name: `${sportLabel} News` },
    ]),
  ], 'jsonld-sport');

  if (!articles.length) {
    document.getElementById('sport-lead-slot').innerHTML = '';
    document.getElementById('rest-slot').innerHTML = `
      <div class="empty" style="margin-top:32px">
        <h3>No ${sport.toUpperCase()} articles ${currentPage > 1 ? `on page ${currentPage}` : 'yet'}</h3>
        <p>${currentPage > 1 ? `<a href="/news/${sport}" style="color:var(--gold)">← Back to page 1</a>` : 'The news engine pulls every 30 minutes — check back shortly.'}</p>
      </div>
    `;
    document.getElementById('pagination').innerHTML = '';
    return;
  }

  if (currentPage === 1) {
    const lead = pickLead(articles);
    const rest = articles.filter((a) => a.id !== lead.id);

    document.getElementById('sport-lead-slot').innerHTML = `
      <div class="lead-grid" style="margin-bottom:48px">
        ${renderLeadStory(lead, sport)}
        <aside class="lead-sidebar">
          <div class="sidebar-header">More ${sport.toUpperCase()}</div>
          ${rest.slice(0, 4).map(renderSidebarStory).join('')}
        </aside>
      </div>
    `;

    const remaining = rest.slice(4);
    document.getElementById('rest-slot').innerHTML = remaining.length ? `
      <div class="section-heading">
        <h2>More Stories</h2>
      </div>
      <div class="article-grid fade-stagger">
        ${remaining.map((a) => renderArticleCard(a)).join('')}
      </div>
    ` : '';
  } else {
    document.getElementById('sport-lead-slot').innerHTML = '';
    document.getElementById('rest-slot').innerHTML = `
      <div class="section-heading">
        <h2>${sportLabel} · Page ${currentPage}</h2>
        <span class="section-meta">Newest first</span>
      </div>
      <div class="article-grid fade-stagger">
        ${articles.map((a) => renderArticleCard(a)).join('')}
      </div>
    `;
  }

  const total = data.total || articles.length;
  const totalPages = data.totalPages || (total ? Math.ceil(total / PAGE_SIZE) : Math.max(currentPage, 1));
  document.getElementById('pagination').innerHTML = renderPagination(currentPage, totalPages, `/news/${sport}`);
}


export function stopSportLifecycle() {
  if (_highlightsRefreshHandle) {
    clearInterval(_highlightsRefreshHandle);
    _highlightsRefreshHandle = null;
  }
  _highlightsRefreshSport = null;
}

function startSportHighlightsRefresh(sport) {
  stopSportLifecycle();
  _highlightsRefreshSport = sport;

  const expectedPath = `/news/${sport}`;
  _highlightsRefreshHandle = setInterval(async () => {
    const path = window.location.pathname.replace(/\/+$/, '') || '/';

    // Never let a stale sport-page timer survive SPA navigation.
    if (path !== expectedPath || _highlightsRefreshSport !== sport) {
      stopSportLifecycle();
      return;
    }

    if (document.hidden) return;

    try {
      const data = await fetchHighlights(sport);
      const slot = document.getElementById('highlights-slot');
      if (!slot || !data?.ok) return;

      const nextSignature = highlightsSignature(data);
      if (nextSignature && nextSignature !== slot.dataset.highlightSignature) {
        // Never interrupt an inline video while the reader is watching it.
        if (slot.dataset.videoPlaying === '1') return;
        renderHighlightsSlot(sport, data);
      }
    } catch (error) {
      // Keep the current successful highlights visible if a refresh fails.
      console.warn('[sport highlights refresh]', sport, error?.message || error);
    }
  }, HIGHLIGHTS_REFRESH_MS);
}

function highlightsSignature(data) {
  const videos = Array.isArray(data?.videos) ? data.videos : [];
  return videos
    .filter((video) => video?.videoId)
    .slice(0, HIGHLIGHTS_LIMIT)
    .map((video) => `${video.videoId}:${video.publishedAt || ''}`)
    .join('|');
}

async function fetchHighlights(sport) {
  const response = await fetch(
    `/api/youtube-highlights?sport=${encodeURIComponent(sport)}&limit=${HIGHLIGHTS_LIMIT}`,
    { cache: 'no-store', credentials: 'omit' }
  );
  if (!response.ok) throw new Error(`Highlights ${response.status}`);
  const data = await response.json();
  return data?.ok ? data : null;
}

function youtubeEmbedUrl(videoId, { autoplay = false } = {}) {
  if (!videoId) return '';
  const params = new URLSearchParams({
    rel: '0',
    playsinline: '1',
    modestbranding: '1',
  });
  if (typeof window !== 'undefined' && window.location?.origin) {
    params.set('origin', window.location.origin);
  }
  if (autoplay) params.set('autoplay', '1');
  return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`;
}

function renderInlineHighlightPlayer(video, label, { autoplay = false } = {}) {
  const videoId = String(video?.videoId || '');
  if (!videoId) return '';
  return `
    <iframe
      src="${escapeAttr(youtubeEmbedUrl(videoId, { autoplay }))}"
      title="${escapeAttr(video.title || `${label} video`)}"
      loading="lazy"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowfullscreen
    ></iframe>
  `;
}

function renderHighlightsSlot(sport, data) {
  if (sport === 'nfl') {
    renderNflHighlightsSlot(data);
    return;
  }

  const slot = document.getElementById('highlights-slot');
  if (!slot) return;

  const videos = Array.isArray(data?.videos) ? data.videos.filter((video) => video?.videoId && video?.title) : [];
  if (!videos.length) {
    slot.innerHTML = '';
    return;
  }

  const existingSelected = String(slot.dataset.selectedVideoId || '');
  const featured = videos.find((video) => String(video.videoId) === existingSelected) || videos[0];
  const rail = videos.filter((video) => String(video.videoId) !== String(featured.videoId)).slice(0, HIGHLIGHTS_LIMIT - 1);
  const label = String(data?.league || sport || '').toUpperCase();

  slot.dataset.highlightSignature = highlightsSignature(data);
  slot.dataset.highlightSport = sport;
  slot.dataset.selectedVideoId = String(featured.videoId);
  slot.dataset.videoPlaying = '0';

  slot.innerHTML = `
    <section class="sport-highlights" aria-labelledby="sport-highlights-heading">
      <div class="sport-highlights-head">
        <div>
          <span class="kicker kicker-gold">▶ LATEST HIGHLIGHTS</span>
          <h2 id="sport-highlights-heading">${escapeHtml(label)} Video Highlights</h2>
          <p>Watch fresh clips from the official ${escapeHtml(label)} YouTube channel without leaving PropBetEdge.</p>
        </div>
        <a href="${escapeAttr(data?.channel?.url || `https://www.youtube.com/@${label}`)}" target="_blank" rel="noopener">
          Official channel ↗
        </a>
      </div>

      <div class="sport-highlights-layout">
        <article class="sport-highlight-featured">
          <div class="sport-highlight-frame" data-highlight-player>
            ${renderInlineHighlightPlayer(featured, label)}
          </div>
          <div class="sport-highlight-featured-copy">
            <span data-highlight-featured-meta>${escapeHtml(featured.channelName || `${label} Official`)} · ${escapeHtml(formatHighlightTime(featured.publishedAt))}</span>
            <h3 data-highlight-featured-title>${escapeHtml(featured.title)}</h3>
            <small class="sport-highlight-onsite-label">Playing on PropBetEdge · YouTube player</small>
          </div>
        </article>

        <div class="sport-highlight-rail" role="list" aria-label="${escapeAttr(label)} video playlist">
          ${rail.map((video) => renderHighlightCard(video, label)).join('')}
        </div>
      </div>
    </section>
  `;

  const player = slot.querySelector('[data-highlight-player]');
  const title = slot.querySelector('[data-highlight-featured-title]');
  const meta = slot.querySelector('[data-highlight-featured-meta]');
  const buttons = [...slot.querySelectorAll('[data-highlight-video-id]')];

  const selectVideo = (videoId, { autoplay = true } = {}) => {
    const video = videos.find((item) => String(item.videoId) === String(videoId));
    if (!video || !player) return;

    player.innerHTML = renderInlineHighlightPlayer(video, label, { autoplay });
    if (title) title.textContent = video.title || '';
    if (meta) meta.textContent = `${video.channelName || `${label} Official`} · ${formatHighlightTime(video.publishedAt)}`;
    slot.dataset.selectedVideoId = String(video.videoId);
    slot.dataset.videoPlaying = '1';

    for (const button of buttons) {
      const active = String(button.dataset.highlightVideoId) === String(video.videoId);
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
  };

  player?.addEventListener('pointerdown', () => {
    slot.dataset.videoPlaying = '1';
  }, { passive: true });

  for (const button of buttons) {
    button.addEventListener('click', () => {
      selectVideo(button.dataset.highlightVideoId, { autoplay: true });
      player?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  injectSchemas(
    videos.map((video) => videoObjectSchema(video, label)),
    'jsonld-sport-video'
  );
}

function loadNflYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (_nflYouTubeApiPromise) return _nflYouTubeApiPromise;

  _nflYouTubeApiPromise = new Promise((resolve, reject) => {
    const timeoutAt = Date.now() + 8000;
    const previousReady = window.onYouTubeIframeAPIReady;

    const finish = () => {
      if (window.YT?.Player) {
        resolve(window.YT);
        return true;
      }
      return false;
    };

    window.onYouTubeIframeAPIReady = () => {
      try {
        if (typeof previousReady === 'function') previousReady();
      } catch {
        // Another consumer must not block the NFL player.
      }
      finish();
    };

    const poll = window.setInterval(() => {
      if (finish()) {
        window.clearInterval(poll);
      } else if (Date.now() >= timeoutAt) {
        window.clearInterval(poll);
        reject(new Error('YouTube IFrame API timed out'));
      }
    }, 100);

    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.addEventListener('error', () => {
        window.clearInterval(poll);
        reject(new Error('YouTube IFrame API failed to load'));
      }, { once: true });
      document.head.appendChild(script);
    }
  }).catch((error) => {
    _nflYouTubeApiPromise = null;
    throw error;
  });

  return _nflYouTubeApiPromise;
}

function nflExternalVideoIds(slot) {
  return new Set(
    String(slot?.dataset?.nflExternalVideoIds || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

function rememberNflExternalVideo(slot, videoId) {
  const ids = nflExternalVideoIds(slot);
  ids.add(String(videoId));
  slot.dataset.nflExternalVideoIds = [...ids].join(',');
}

function renderNflHighlightsSlot(data) {
  const slot = document.getElementById('highlights-slot');
  if (!slot) return;

  const videos = Array.isArray(data?.videos)
    ? data.videos.filter((video) => video?.videoId && video?.title)
    : [];
  if (!videos.length) {
    slot.innerHTML = '';
    return;
  }

  const label = String(data?.league || 'NFL').toUpperCase();
  const externalIds = nflExternalVideoIds(slot);
  const existingSelected = String(slot.dataset.selectedVideoId || '');
  const existing = videos.find((video) =>
    String(video.videoId) === existingSelected && !externalIds.has(String(video.videoId))
  );
  const featured = existing
    || videos.find((video) => !externalIds.has(String(video.videoId)))
    || videos[0];
  const featuredExternal = externalIds.has(String(featured.videoId));
  const rail = videos
    .filter((video) => String(video.videoId) !== String(featured.videoId))
    .slice(0, HIGHLIGHTS_LIMIT - 1);

  slot.dataset.highlightSignature = highlightsSignature(data);
  slot.dataset.highlightSport = 'nfl';
  slot.dataset.selectedVideoId = String(featured.videoId);
  slot.dataset.videoPlaying = '0';

  slot.innerHTML = `
    <section class="sport-highlights" aria-labelledby="sport-highlights-heading">
      <div class="sport-highlights-head">
        <div>
          <span class="kicker kicker-gold">▶ LATEST HIGHLIGHTS</span>
          <h2 id="sport-highlights-heading">${escapeHtml(label)} Video Highlights</h2>
          <p>Official NFL videos stay visible. If YouTube blocks an inline player, PropBetEdge keeps the video and opens that upload on YouTube.</p>
        </div>
        <a href="${escapeAttr(data?.channel?.url || 'https://www.youtube.com/@NFL')}" target="_blank" rel="noopener">
          Official channel ↗
        </a>
      </div>

      <div class="sport-highlights-layout">
        <article class="sport-highlight-featured">
          <div class="sport-highlight-frame" data-highlight-player>
            ${featuredExternal ? renderNflRestrictedFeatured(featured, label) : '<div data-nfl-player-host></div>'}
          </div>
          <div class="sport-highlight-featured-copy">
            <span data-highlight-featured-meta>${escapeHtml(featured.channelName || 'NFL Official')} · ${escapeHtml(formatHighlightTime(featured.publishedAt))}</span>
            <h3 data-highlight-featured-title>${escapeHtml(featured.title)}</h3>
            <small class="sport-highlight-onsite-label" data-highlight-featured-status>${featuredExternal ? 'Watch on YouTube · Inline playback unavailable' : 'Loading official YouTube player…'}</small>
          </div>
        </article>

        <div class="sport-highlight-rail" role="list" aria-label="NFL video playlist">
          ${rail.map((video) => renderNflHighlightCard(video, label, externalIds)).join('')}
        </div>
      </div>
    </section>
  `;

  const playerShell = slot.querySelector('[data-highlight-player]');
  const title = slot.querySelector('[data-highlight-featured-title]');
  const meta = slot.querySelector('[data-highlight-featured-meta]');
  const status = slot.querySelector('[data-highlight-featured-status]');
  const buttons = [...slot.querySelectorAll('[data-highlight-video-id]')];
  let playerInstance = null;

  const mountVideo = async (video, { autoplay = false } = {}) => {
    if (!video || !playerShell) return;
    const videoId = String(video.videoId);
    if (nflExternalVideoIds(slot).has(videoId)) return;

    slot.dataset.selectedVideoId = videoId;
    slot.dataset.videoPlaying = autoplay ? '1' : '0';
    playerShell.innerHTML = '<div data-nfl-player-host></div>';
    const host = playerShell.querySelector('[data-nfl-player-host]');

    if (title) title.textContent = video.title || '';
    if (meta) meta.textContent = `${video.channelName || 'NFL Official'} · ${formatHighlightTime(video.publishedAt)}`;
    if (status) status.textContent = 'Loading official YouTube player…';

    for (const button of buttons) {
      const active = String(button.dataset.highlightVideoId) === videoId;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    }

    try {
      const YT = await loadNflYouTubeApi();
      if (!host?.isConnected || slot.dataset.selectedVideoId !== videoId) return;

      playerInstance?.destroy?.();
      playerInstance = new YT.Player(host, {
        videoId,
        playerVars: {
          autoplay: autoplay ? 1 : 0,
          playsinline: 1,
          rel: 0,
          origin: window.location.origin,
          widget_referrer: window.location.href,
        },
        events: {
          onReady() {
            if (status && slot.dataset.selectedVideoId === videoId) {
              status.textContent = 'Playing on PropBetEdge · YouTube player';
            }
          },
          onError(event) {
            const code = Number(event?.data);
            if (![5, 100, 101, 150, 153].includes(code)) return;
            if (slot.dataset.selectedVideoId !== videoId) return;

            console.warn('[sport highlights] NFL YouTube playback unavailable', {
              videoId,
              errorCode: code,
            });

            rememberNflExternalVideo(slot, videoId);
            slot.dataset.videoPlaying = '0';
            try {
              playerInstance?.destroy?.();
            } catch {
              // Ignore teardown errors from an already-failed player.
            }
            renderNflHighlightsSlot(data);
          },
        },
      });
    } catch (error) {
      console.warn('[sport highlights] NFL YouTube player failed to initialize', error?.message || error);
      rememberNflExternalVideo(slot, videoId);
      renderNflHighlightsSlot(data);
    }
  };

  if (!featuredExternal) {
    mountVideo(featured, { autoplay: false });
  }

  for (const button of buttons) {
    button.addEventListener('click', () => {
      const video = videos.find((item) => String(item.videoId) === String(button.dataset.highlightVideoId));
      if (!video) return;
      mountVideo(video, { autoplay: true });
      playerShell?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  injectSchemas(
    videos.map((video) => videoObjectSchema(video, label)),
    'jsonld-sport-video'
  );
}

function renderNflRestrictedFeatured(video, label) {
  const thumbnail = video.thumbnail || `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`;
  const href = video.url || `https://www.youtube.com/watch?v=${video.videoId}`;
  return `
    <a
      href="${escapeAttr(href)}"
      target="_blank"
      rel="noopener"
      aria-label="Watch ${escapeAttr(video.title || `${label} video`)} on YouTube"
      style="position:absolute;inset:0;display:block;text-decoration:none;color:inherit"
    >
      <img src="${escapeAttr(thumbnail)}" alt="" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover">
      <span style="position:absolute;inset:0;display:grid;place-items:center;background:linear-gradient(180deg,rgba(0,0,0,.04),rgba(0,0,0,.58))">
        <span style="display:inline-flex;align-items:center;gap:8px;padding:10px 14px;border:1px solid rgba(255,255,255,.2);background:rgba(0,0,0,.72);color:#fff;font-family:var(--font-mono);font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase">
          Watch on YouTube ↗
        </span>
      </span>
    </a>
  `;
}

function renderNflHighlightCard(video, label, externalIds) {
  const thumbnail = video.thumbnail || `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`;
  const meta = `${video.channelName || `${label} Official`} · ${formatHighlightTime(video.publishedAt)}`;
  const external = externalIds?.has(String(video.videoId));

  if (external) {
    const href = video.url || `https://www.youtube.com/watch?v=${video.videoId}`;
    return `
      <a
        href="${escapeAttr(href)}"
        target="_blank"
        rel="noopener"
        class="sport-highlight-card"
        style="text-decoration:none"
        aria-label="Watch ${escapeAttr(video.title)} on YouTube"
      >
        <div class="sport-highlight-thumb">
          <img src="${escapeAttr(thumbnail)}" alt="" loading="lazy" decoding="async">
          <span class="sport-highlight-play" aria-hidden="true">↗</span>
        </div>
        <div class="sport-highlight-card-copy">
          <span>${escapeHtml(meta)}</span>
          <strong>${escapeHtml(video.title)}</strong>
          <small>Watch on YouTube</small>
        </div>
      </a>
    `;
  }

  return `
    <button
      type="button"
      class="sport-highlight-card"
      data-highlight-video-id="${escapeAttr(video.videoId)}"
      aria-pressed="false"
      aria-label="Play ${escapeAttr(video.title)} on PropBetEdge"
    >
      <div class="sport-highlight-thumb">
        <img src="${escapeAttr(thumbnail)}" alt="" loading="lazy" decoding="async">
        <span class="sport-highlight-play" aria-hidden="true">▶</span>
      </div>
      <div class="sport-highlight-card-copy">
        <span>${escapeHtml(meta)}</span>
        <strong>${escapeHtml(video.title)}</strong>
        <small>Play here</small>
      </div>
    </button>
  `;
}

function renderHighlightCard(video, label) {
  const thumbnail = video.thumbnail || `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`;
  return `
    <button
      type="button"
      class="sport-highlight-card"
      data-highlight-video-id="${escapeAttr(video.videoId)}"
      aria-pressed="false"
      aria-label="Play ${escapeAttr(video.title)} on PropBetEdge"
    >
      <div class="sport-highlight-thumb">
        <img src="${escapeAttr(thumbnail)}" alt="" loading="lazy" decoding="async">
        <span class="sport-highlight-play" aria-hidden="true">▶</span>
      </div>
      <div class="sport-highlight-card-copy">
        <span>${escapeHtml(video.channelName || `${label} Official`)} · ${escapeHtml(formatHighlightTime(video.publishedAt))}</span>
        <strong>${escapeHtml(video.title)}</strong>
        <small>Play here</small>
      </div>
    </button>
  `;
}

function formatHighlightTime(value) {
  const ms = Date.parse(value || '');
  if (!Number.isFinite(ms)) return 'Latest';
  const age = Math.max(0, Date.now() - ms);
  const hours = Math.floor(age / 3600000);
  if (hours < 1) return 'Just posted';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? '1d ago' : `${days}d ago`;
}

function videoObjectSchema(video, label) {
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: video.title,
    description: `${label} highlight video surfaced by PropBetEdge from the official YouTube channel.`,
    thumbnailUrl: video.thumbnail ? [video.thumbnail] : undefined,
    uploadDate: video.publishedAt || undefined,
    contentUrl: video.url || `https://www.youtube.com/watch?v=${video.videoId}`,
    embedUrl: youtubeEmbedUrl(video.videoId),
    isFamilyFriendly: true,
  };
}

function highlightsSkeleton() {
  return `
    <section class="sport-highlights is-loading" aria-hidden="true">
      <div class="sport-highlights-head">
        <div>
          <div class="skel skel-line" style="width:120px;height:10px"></div>
          <div class="skel skel-line" style="width:260px;height:28px;margin-top:10px"></div>
        </div>
      </div>
      <div class="sport-highlights-layout">
        <div class="skel skel-card" style="aspect-ratio:16/9"></div>
        <div class="sport-highlight-rail">
          <div class="skel skel-card" style="height:96px"></div>
          <div class="skel skel-card" style="height:96px"></div>
          <div class="skel skel-card" style="height:96px"></div>
        </div>
      </div>
    </section>
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
    <nav class="pagination-inner" aria-label="${baseHref.split('/').pop().toUpperCase()} news pagination">
      ${prev}
      <div class="page-numbers">${pages.join('')}</div>
      ${next}
    </nav>
    <div class="pagination-meta">Page ${current} of ${total}</div>
  `;
}

function pickLead(articles) {
  const FRESH_WINDOW_MS = 36 * 60 * 60 * 1000;
  const now = Date.now();
  const withImage = articles.filter((a) => a.image_url);

  const fresh = withImage.filter((a) => {
    if (!a.published_at) return false;
    const age = now - new Date(a.published_at).getTime();
    return age >= 0 && age <= FRESH_WINDOW_MS;
  });

  if (fresh.length) {
    return fresh.sort((a, b) => {
      const impactDiff = (b.take?.impact_score || 0) - (a.take?.impact_score || 0);
      if (impactDiff !== 0) return impactDiff;
      return new Date(b.published_at) - new Date(a.published_at);
    })[0];
  }

  if (withImage.length) {
    return withImage.sort((a, b) => new Date(b.published_at) - new Date(a.published_at))[0];
  }

  return articles[0];
}

function renderLeadStory(article, sport) {
  const url = article.url || `/news/${article.sport}/${article.slug}`;
  const date = new Date(article.published_at);
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
      <h2 class="lead-headline">${escapeHtml(article.title)}</h2>
      ${dek ? `<p class="lead-dek">${escapeHtml(dek)}</p>` : ''}
    </a>
  `;
}

function cardSkeleton(n, large = false) {
  let out = large ? '<div class="lead-grid" style="margin-bottom:48px"><div>' : '<div class="article-grid">';
  for (let i = 0; i < n; i++) {
    out += `
      <div class="skel-card">
        <div class="skel skel-card-img"></div>
        <div class="skel skel-line" style="width:30%;height:10px"></div>
        <div class="skel skel-line" style="width:90%;height:24px;margin-top:8px"></div>
      </div>
    `;
  }
  out += large ? '</div><div></div></div>' : '</div>';
  return out;
}

function escapeAttr(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
