/**
 * PropBetEdge story media recovery
 *
 * Goals:
 * - Never present a PropBetEdge house logo as editorial story photography.
 * - Recover existing no-image / broken-image cards at render time.
 * - Reuse the existing article entity metadata + /api/sports-media resolver.
 * - Fall back to a restrained sport treatment only when no legitimate media exists.
 */

const NEWS_API = 'https://propbet-news-api.sales-fd3.workers.dev';
const ARTICLE_PATH_RE = /^\/news\/(mlb|nfl|nba|nhl)\/([^/]+)\/?$/i;
const SPORT_META = {
  mlb: { emoji: '⚾', label: 'MLB' },
  nfl: { emoji: '🏈', label: 'NFL' },
  nba: { emoji: '🏀', label: 'NBA' },
  nhl: { emoji: '🏒', label: 'NHL' },
};

const articleMediaCache = new Map();
let scanQueued = false;

export function initStoryMediaBackfill() {
  injectStyles();

  document.addEventListener('error', (event) => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement)) return;
    if (!isStoryImage(img)) return;

    // Let the existing proxy -> direct retry run first. If the direct source also
    // fails, this delayed pass will recover a contextual player/team image.
    setTimeout(() => recoverForImage(img), 0);
  }, true);

  const observer = new MutationObserver(queueScan);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  queueScan();
  window.addEventListener('popstate', queueScan);
  window.addEventListener('pbe:route-changed', queueScan);

  window.PBEStoryMediaBackfill = {
    scan: scanStoryMedia,
    cache: articleMediaCache,
  };
}

function injectStyles() {
  if (document.getElementById('pbe-story-media-backfill-styles')) return;
  const style = document.createElement('style');
  style.id = 'pbe-story-media-backfill-styles';
  style.textContent = `
    /* Override the old giant PBE-logo fallback with a quiet editorial state. */
    .img-fallback.pbe-editorial-fallback,
    .img-fallback[data-pbe-branded="1"].pbe-editorial-fallback,
    .lead-overlay-fallback.pbe-editorial-fallback {
      gap: 8px !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
      background:
        radial-gradient(circle at 50% 24%, rgba(212,175,55,.09), transparent 42%),
        linear-gradient(145deg, #17140f, #090807) !important;
      color: rgba(245,241,235,.72) !important;
      opacity: 1 !important;
      font-family: var(--font-sans, Inter, system-ui, sans-serif) !important;
      text-transform: uppercase !important;
      letter-spacing: .13em !important;
    }
    .pbe-editorial-fallback .pbe-fallback-mark { display: none !important; }
    .pbe-editorial-fallback-icon {
      font-size: clamp(34px, 5vw, 58px);
      line-height: 1;
      filter: grayscale(.15);
      opacity: .9;
    }
    .pbe-editorial-fallback-label {
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      font-weight: 800;
      color: rgba(245,241,235,.5);
    }
    .pbe-recovered-story-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .card-image > .pbe-recovered-story-img,
    .sidebar-hero-img > .pbe-recovered-story-img,
    .lead-overlay-image-wrap > .pbe-recovered-story-img {
      position: relative;
      z-index: 1;
    }
    .lead-overlay-image-wrap > .pbe-recovered-story-img {
      position: absolute;
      inset: 0;
    }
  `;
  document.head.appendChild(style);
}

function queueScan() {
  if (scanQueued) return;
  scanQueued = true;
  requestAnimationFrame(() => {
    scanQueued = false;
    scanStoryMedia();
  });
}

function scanStoryMedia() {
  // First neutralize every legacy branded fallback, even when its primary image
  // is still healthy. If that image later fails, the user never sees a logo card.
  document.querySelectorAll('.img-fallback, .lead-overlay-fallback').forEach((fallback) => {
    neutralizeFallback(fallback);

    const container = mediaContainerForFallback(fallback);
    if (!container) return;
    const img = storyImageIn(container);

    if (!img || img.classList.contains('img-broken') || isHouseBrandImageUrl(img.currentSrc || img.src)) {
      if (img && isHouseBrandImageUrl(img.currentSrc || img.src)) {
        img.remove();
      }
      recoverForFallback(fallback);
    }
  });

  // Defense-in-depth: if the API itself ever sends a house logo as image_url,
  // strip it and recover contextual media instead of displaying brand art.
  document.querySelectorAll('img').forEach((img) => {
    if (!isStoryImage(img)) return;
    if (!isHouseBrandImageUrl(img.currentSrc || img.src)) return;
    const container = mediaContainerForImage(img);
    const fallback = fallbackIn(container);
    img.remove();
    if (fallback) {
      neutralizeFallback(fallback);
      fallback.style.display = '';
      recoverForFallback(fallback);
    }
  });
}

function neutralizeFallback(fallback) {
  if (!(fallback instanceof HTMLElement)) return;
  if (fallback.dataset.pbeEditorialFallback === '1') return;

  const sport = storyContextFromElement(fallback)?.sport || sportFromFallback(fallback);
  const meta = SPORT_META[sport] || { emoji: '◆', label: 'Sports' };

  // Mark as already handled so the older site-enhancements observer cannot
  // turn this node back into a giant PBE-logo fallback after our recovery pass.
  fallback.dataset.pbeBranded = '1';
  fallback.dataset.pbeEditorialFallback = '1';
  fallback.classList.add('pbe-editorial-fallback');
  fallback.textContent = '';

  const icon = document.createElement('span');
  icon.className = 'pbe-editorial-fallback-icon';
  icon.textContent = meta.emoji;

  const label = document.createElement('span');
  label.className = 'pbe-editorial-fallback-label';
  label.textContent = `${meta.label} · image resolving`;

  fallback.append(icon, label);
}

function recoverForImage(img) {
  if (!(img instanceof HTMLImageElement)) return;
  const container = mediaContainerForImage(img);
  const fallback = fallbackIn(container);
  if (!fallback) return;

  // If the existing image recovered successfully (e.g. proxy failed but direct
  // URL loaded), leave it alone.
  if (img.isConnected && img.complete && img.naturalWidth > 0 && !isHouseBrandImageUrl(img.currentSrc || img.src)) {
    return;
  }

  img.classList.add('img-broken');
  neutralizeFallback(fallback);
  fallback.style.display = '';
  recoverForFallback(fallback);
}

function recoverForFallback(fallback) {
  if (!(fallback instanceof HTMLElement)) return;
  if (fallback.dataset.pbeMediaState === 'loading' || fallback.dataset.pbeMediaState === 'recovered') return;

  const context = storyContextFromElement(fallback);
  if (!context) {
    setFallbackSettled(fallback, null);
    return;
  }

  fallback.dataset.pbeMediaState = 'loading';
  resolveArticleMedia(context)
    .then((media) => applyRecoveredMedia(fallback, media, context))
    .catch(() => setFallbackSettled(fallback, context.sport));
}

async function resolveArticleMedia(context) {
  const key = `${context.sport}:${context.slug}`;
  if (articleMediaCache.has(key)) return articleMediaCache.get(key);

  const promise = (async () => {
    const article = await fetchArticle(context.slug);
    const candidates = buildCandidates(article, context.title);

    for (const candidate of candidates) {
      const media = await resolveEntityMedia(context.sport, candidate.kind, candidate.name);
      if (media?.image && !isHouseBrandImageUrl(media.image)) {
        return { ...media, candidate };
      }
    }
    return null;
  })();

  articleMediaCache.set(key, promise);
  return promise;
}

async function fetchArticle(slug) {
  try {
    const response = await fetch(`${NEWS_API}/news/article/${encodeURIComponent(slug)}`, {
      credentials: 'omit',
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data?.article || null;
  } catch {
    return null;
  }
}

function buildCandidates(article, fallbackTitle = '') {
  const candidates = [];
  const seen = new Set();
  const add = (kind, rawName) => {
    const name = String(rawName || '').trim();
    const id = `${kind}:${name.toLowerCase()}`;
    if (!name || name.length > 100 || seen.has(id)) return;
    seen.add(id);
    candidates.push({ kind, name });
  };

  const players = [
    ...(Array.isArray(article?.take?.players) ? article.take.players : []),
    ...(Array.isArray(article?.players) ? article.players : []),
  ];
  const teams = [
    ...(Array.isArray(article?.take?.teams) ? article.take.teams : []),
    ...(Array.isArray(article?.teams) ? article.teams : []),
  ];

  // Player headshots usually look better on editorial cards than a team logo.
  players.slice(0, 5).forEach((name) => add('player', name));
  teams.slice(0, 4).forEach((name) => add('team', name));

  // Defensive historical backfill: older stories may lack structured entities.
  // Possessive sports headlines often begin with the subject ("Ohtani's ...",
  // "Rengifo's ..."). The resolver can match MLB/NFL/NBA/NHL surnames.
  const title = String(article?.title || fallbackTitle || '').trim();
  const possessive = title.match(/^([A-Z][A-Za-zÀ-ÖØ-öø-ÿ.'-]+(?:\s+[A-Z][A-Za-zÀ-ÖØ-öø-ÿ.'-]+){0,2})[’']s\b/);
  if (possessive?.[1]) add('player', possessive[1]);

  const twoWord = title.match(/^([A-Z][A-Za-zÀ-ÖØ-öø-ÿ.'-]+\s+[A-Z][A-Za-zÀ-ÖØ-öø-ÿ.'-]+)/);
  if (twoWord?.[1]) add('player', twoWord[1]);

  return candidates.slice(0, 8);
}

async function resolveEntityMedia(sport, kind, name) {
  try {
    const url = `/api/sports-media?sport=${encodeURIComponent(sport)}&kind=${encodeURIComponent(kind)}&name=${encodeURIComponent(name)}`;
    const response = await fetch(url, { credentials: 'omit', cache: 'force-cache' });
    if (!response.ok) return null;
    const media = await response.json();
    return media?.image ? media : null;
  } catch {
    return null;
  }
}

function applyRecoveredMedia(fallback, media, context) {
  if (!(fallback instanceof HTMLElement) || !fallback.isConnected) return;
  if (!media?.image) {
    setFallbackSettled(fallback, context?.sport);
    return;
  }

  const container = mediaContainerForFallback(fallback);
  if (!container) {
    setFallbackSettled(fallback, context?.sport);
    return;
  }

  const existing = storyImageIn(container);
  if (existing && !existing.classList.contains('img-broken') && !isHouseBrandImageUrl(existing.currentSrc || existing.src)) {
    fallback.dataset.pbeMediaState = 'recovered';
    fallback.style.display = 'none';
    return;
  }
  existing?.remove();

  const img = document.createElement('img');
  img.src = media.image;
  img.alt = context?.title || media.name || 'Story image';
  img.loading = 'lazy';
  img.decoding = 'async';
  img.dataset.pbeRecoveredMedia = '1';
  img.className = recoveredImageClass(container);

  img.addEventListener('load', () => {
    fallback.dataset.pbeMediaState = 'recovered';
    fallback.style.display = 'none';
  }, { once: true });

  img.addEventListener('error', () => {
    img.remove();
    setFallbackSettled(fallback, context?.sport);
  }, { once: true });

  container.insertBefore(img, fallback);
}

function setFallbackSettled(fallback, sport) {
  if (!(fallback instanceof HTMLElement)) return;
  fallback.dataset.pbeMediaState = 'unavailable';
  fallback.style.display = '';
  const label = fallback.querySelector('.pbe-editorial-fallback-label');
  if (label) label.textContent = `${SPORT_META[sport]?.label || 'Sports'} · photo unavailable`;
}

function storyContextFromElement(element) {
  const anchor = element.closest?.('a[href]');
  if (!anchor) return null;

  let url;
  try {
    url = new URL(anchor.getAttribute('href') || anchor.href, window.location.origin);
  } catch {
    return null;
  }

  const match = url.pathname.match(ARTICLE_PATH_RE);
  if (!match) return null;

  const headline = anchor.querySelector('.card-headline, .sidebar-headline-hero, .sidebar-headline, .lead-headline-overlay, .lead-headline');
  return {
    sport: match[1].toLowerCase(),
    slug: decodeURIComponent(match[2]),
    title: headline?.textContent?.trim() || '',
  };
}

function sportFromFallback(fallback) {
  const text = fallback.textContent || fallback.dataset.emoji || '';
  if (text.includes('⚾')) return 'mlb';
  if (text.includes('🏈')) return 'nfl';
  if (text.includes('🏀')) return 'nba';
  if (text.includes('🏒')) return 'nhl';
  return null;
}

function mediaContainerForFallback(fallback) {
  return fallback.closest?.('.card-image, .sidebar-hero-img, .lead-overlay-image-wrap, .lead-image') || fallback.parentElement;
}

function mediaContainerForImage(img) {
  return img.closest?.('.card-image, .sidebar-hero-img, .lead-overlay-image-wrap, .lead-image') || img.parentElement;
}

function fallbackIn(container) {
  if (!container) return null;
  return container.querySelector(':scope > .img-fallback, :scope > .lead-overlay-fallback')
    || container.querySelector('.img-fallback, .lead-overlay-fallback');
}

function storyImageIn(container) {
  if (!container) return null;
  return container.querySelector(':scope > img, img.card-image-img, img.lead-overlay-img, img[data-pbe-recovered-media]');
}

function recoveredImageClass(container) {
  if (container.classList.contains('card-image')) return 'card-image-img pbe-recovered-story-img';
  if (container.classList.contains('lead-overlay-image-wrap')) return 'lead-overlay-img pbe-recovered-story-img';
  return 'pbe-recovered-story-img';
}

function isStoryImage(img) {
  return Boolean(img.closest?.('.card-image, .sidebar-hero-img, .lead-overlay-image-wrap, .lead-image'));
}

function isHouseBrandImageUrl(raw) {
  const value = String(raw || '').toLowerCase();
  if (!value) return false;
  return value.includes('/logo/')
    || value.includes('pbe-mark')
    || value.includes('pbe-full')
    || value.includes('propbetedge-logo')
    || value.includes('propbetedge_logo')
    || value.includes('placeholder-pbe');
}
