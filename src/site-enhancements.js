/**
 * PropBetEdge site enhancements
 * - Score strip anti-clipping + resilient NFL logo fallback
 * - External image retry (proxy -> direct source)
 * - PBE-branded broken-image fallbacks
 * - Contextual player/team imagery on article pages
 * - Optional Resend Reader Pass soft paywall (fail-open until configured)
 */

const NEWS_API = 'https://propbet-news-api.sales-fd3.workers.dev';
const PBE_MARK = '/logo/pbe-mark-160.png';
const PBE_FULL = '/logo/pbe-full-400.png';
const IMAGE_PROXY_HOST = 'propbet-img-proxy.sales-fd3.workers.dev';

let articleEnhancementKey = '';
let articleEnhancementTimer = null;
let paywallRunKey = '';

export function initSiteEnhancements() {
  injectEnhancementStyles();
  document.addEventListener('error', handleImageError, true);

  const observer = new MutationObserver(() => {
    healNflLogos();
    brandImageFallbacks();
    scheduleArticleEnhancements();
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
  healNflLogos();
  brandImageFallbacks();
  scheduleArticleEnhancements();

  window.addEventListener('popstate', scheduleArticleEnhancements);
}

function injectEnhancementStyles() {
  if (document.getElementById('pbe-site-enhancement-styles')) return;
  const style = document.createElement('style');
  style.id = 'pbe-site-enhancement-styles';
  style.textContent = `
    /* Score strip: the v3.6 desktop 76px box cannot contain two 22px team rows,
       status, CTA and vertical padding. Force a safe content height. */
    #pbe-score-strip {
      height: 100px !important;
      min-height: 100px !important;
      overflow: visible !important;
    }
    #pbe-score-strip .pss-tile {
      min-height: 100px !important;
      padding-top: 8px !important;
      padding-bottom: 8px !important;
    }
    #pbe-score-strip .pss-rail,
    #pbe-score-strip .pss-rail-wrap {
      min-height: 100px !important;
    }
    @media (max-width: 699px) {
      #pbe-score-strip,
      #pbe-score-strip .pss-rail,
      #pbe-score-strip .pss-rail-wrap,
      #pbe-score-strip .pss-tile {
        height: 98px !important;
        min-height: 98px !important;
      }
    }

    /* PBE-branded fallback treatment */
    .img-fallback[data-pbe-branded="1"] {
      gap: 10px;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background:
        radial-gradient(circle at 50% 25%, rgba(255,210,74,.14), transparent 48%),
        linear-gradient(145deg, #0a0f1a, #111a2c) !important;
      color: #f8fafc !important;
      font-family: Inter, system-ui, sans-serif;
      font-size: 13px !important;
      font-weight: 800;
      letter-spacing: .08em;
      text-transform: uppercase;
    }
    .pbe-fallback-mark {
      width: 54px;
      height: 54px;
      object-fit: contain;
      filter: drop-shadow(0 7px 16px rgba(0,0,0,.3));
    }
    .pbe-fallback-sport { opacity: .82; }

    /* Contextual team/player visuals */
    .pbe-story-entities {
      margin: 22px 0 28px;
      padding: 16px 18px;
      border: 1px solid rgba(20,17,13,.10);
      border-radius: 12px;
      background: linear-gradient(135deg, rgba(255,210,74,.06), rgba(255,255,255,.72));
      box-shadow: 0 8px 24px rgba(20,17,13,.05);
    }
    .pbe-story-entities-head {
      display: flex;
      align-items: center;
      gap: 9px;
      margin-bottom: 12px;
      color: var(--ink, #14110d);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: .12em;
      text-transform: uppercase;
    }
    .pbe-story-entities-head img {
      width: 24px;
      height: 24px;
      object-fit: contain;
    }
    .pbe-story-entities-grid {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    .pbe-story-entity {
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px 8px 8px;
      border-radius: 999px;
      border: 1px solid rgba(20,17,13,.10);
      background: rgba(255,255,255,.88);
      color: var(--ink, #14110d);
      box-shadow: 0 2px 8px rgba(20,17,13,.04);
    }
    .pbe-story-entity img {
      width: 42px;
      height: 42px;
      flex: 0 0 42px;
      border-radius: 50%;
      object-fit: cover;
      background: #f4f4f4;
    }
    .pbe-story-entity.team img {
      object-fit: contain;
      padding: 4px;
      background: transparent;
    }
    .pbe-story-entity-text { min-width: 0; }
    .pbe-story-entity-kind {
      display: block;
      margin-bottom: 1px;
      font-size: 8px;
      font-weight: 800;
      letter-spacing: .12em;
      text-transform: uppercase;
      opacity: .5;
    }
    .pbe-story-entity-name {
      display: block;
      max-width: 180px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 12px;
      font-weight: 800;
    }

    /* Reader Pass soft wall */
    .article-body.pbe-reader-locked {
      max-height: 150px !important;
      overflow: hidden !important;
      pointer-events: none;
      user-select: none;
      opacity: .42;
      filter: blur(1.1px);
      -webkit-mask-image: linear-gradient(to bottom, #000 0%, rgba(0,0,0,.85) 45%, transparent 100%);
      mask-image: linear-gradient(to bottom, #000 0%, rgba(0,0,0,.85) 45%, transparent 100%);
    }
    .pbe-reader-wall {
      position: relative;
      z-index: 3;
      margin: 24px 0 18px;
      padding: 0;
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid rgba(255,210,74,.30);
      background: linear-gradient(145deg, #08101e 0%, #101b30 62%, #0c1424 100%);
      color: #f8fafc;
      box-shadow: 0 18px 50px rgba(4,8,16,.22);
    }
    .pbe-reader-wall-inner {
      padding: 26px 26px 24px;
      background:
        radial-gradient(circle at 88% 0%, rgba(255,210,74,.17), transparent 35%),
        radial-gradient(circle at 0% 100%, rgba(81,109,255,.12), transparent 40%);
    }
    .pbe-reader-brand {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 18px;
    }
    .pbe-reader-brand img { width: 150px; max-height: 46px; object-fit: contain; object-position: left center; }
    .pbe-reader-badge {
      flex: 0 0 auto;
      padding: 5px 9px;
      border: 1px solid rgba(255,210,74,.38);
      border-radius: 999px;
      color: #ffd24a;
      font-size: 9px;
      font-weight: 900;
      letter-spacing: .12em;
      text-transform: uppercase;
    }
    .pbe-reader-wall h3 {
      margin: 0 0 8px;
      color: #fff;
      font-family: 'Playfair Display', Georgia, serif;
      font-size: clamp(24px, 5vw, 34px);
      line-height: 1.08;
    }
    .pbe-reader-wall p {
      margin: 0 0 18px;
      max-width: 650px;
      color: #cbd5e1;
      font-size: 14px;
      line-height: 1.55;
    }
    .pbe-reader-form {
      display: flex;
      align-items: stretch;
      gap: 9px;
      max-width: 600px;
    }
    .pbe-reader-form input {
      flex: 1;
      min-width: 0;
      border: 1px solid rgba(255,255,255,.17);
      border-radius: 8px;
      background: rgba(255,255,255,.08);
      color: #fff;
      padding: 12px 13px;
      font: inherit;
      outline: none;
    }
    .pbe-reader-form input:focus { border-color: rgba(255,210,74,.75); box-shadow: 0 0 0 3px rgba(255,210,74,.10); }
    .pbe-reader-form input::placeholder { color: #94a3b8; }
    .pbe-reader-form button {
      border: 0;
      border-radius: 8px;
      background: #ffd24a;
      color: #111827;
      padding: 0 17px;
      font: inherit;
      font-size: 12px;
      font-weight: 900;
      cursor: pointer;
      white-space: nowrap;
    }
    .pbe-reader-form button:disabled { opacity: .55; cursor: wait; }
    .pbe-reader-status {
      min-height: 18px;
      margin-top: 10px;
      color: #b8c4d6;
      font-size: 12px;
    }
    .pbe-reader-status.ok { color: #86efac; }
    .pbe-reader-status.error { color: #fca5a5; }
    .pbe-reader-note {
      margin-top: 13px;
      color: #7f8ca3;
      font-size: 10px;
      line-height: 1.4;
    }
    @media (max-width: 560px) {
      .pbe-reader-wall-inner { padding: 22px 18px; }
      .pbe-reader-brand { align-items: flex-start; }
      .pbe-reader-brand img { width: 132px; }
      .pbe-reader-form { flex-direction: column; }
      .pbe-reader-form button { min-height: 44px; }
      .pbe-story-entity { width: 100%; border-radius: 12px; }
      .pbe-story-entity-name { max-width: calc(100vw - 150px); }
    }
  `;
  document.head.appendChild(style);
}

function handleImageError(event) {
  const img = event.target;
  if (!(img instanceof HTMLImageElement)) return;

  const nflTile = img.closest?.('.pss-tile[data-sport="nfl"]');
  if (nflTile && img.classList.contains('pss-team-logo') && img.dataset.pbeNflRetry !== '1') {
    const row = img.closest('.pss-team-row');
    const abbr = getScoreRowAbbr(row);
    const fallback = nflLogoUrl(abbr);
    if (fallback && fallback !== img.src) {
      event.stopImmediatePropagation();
      img.dataset.pbeNflRetry = '1';
      img.onerror = null;
      img.src = fallback;
      return;
    }
  }

  const original = originalFromProxy(img.src);
  if (original && img.dataset.pbeDirectRetry !== '1') {
    event.stopImmediatePropagation();
    img.dataset.pbeDirectRetry = '1';
    img.classList.remove('img-broken');
    img.src = original;
  }
}

function originalFromProxy(src) {
  try {
    const url = new URL(src, window.location.href);
    if (url.hostname !== IMAGE_PROXY_HOST) return null;
    return url.searchParams.get('url');
  } catch {
    return null;
  }
}

function healNflLogos() {
  document.querySelectorAll('.pss-tile[data-sport="nfl"] .pss-team-row').forEach((row) => {
    if (row.dataset.pbeNflLogoAttempted === '1') return;
    const existing = row.querySelector('.pss-team-logo');
    if (existing) return;
    const placeholder = row.querySelector('.pss-team-logo-placeholder');
    if (!placeholder) return;

    const abbr = getScoreRowAbbr(row);
    const src = nflLogoUrl(abbr);
    if (!src) return;

    row.dataset.pbeNflLogoAttempted = '1';
    const img = document.createElement('img');
    img.className = 'pss-team-logo';
    img.alt = abbr;
    img.loading = 'lazy';
    img.dataset.pbeNflRetry = '1';
    img.src = src;
    img.addEventListener('error', () => {
      const fallback = document.createElement('div');
      fallback.className = 'pss-team-logo-placeholder';
      fallback.textContent = abbr.slice(0, 3);
      img.replaceWith(fallback);
    }, { once: true });
    placeholder.replaceWith(img);
  });
}

function getScoreRowAbbr(row) {
  if (!row) return '';
  const name = row.querySelector('.pss-team-name');
  const firstTextNode = [...(name?.childNodes || [])].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
  const raw = (firstTextNode?.textContent || name?.textContent || '').trim().split(/\s+/)[0];
  return raw.replace(/[^A-Za-z]/g, '').toUpperCase();
}

function nflLogoUrl(abbr) {
  const clean = String(abbr || '').replace(/[^A-Za-z]/g, '').toLowerCase();
  if (!clean || clean.length > 4) return null;
  return `https://a.espncdn.com/i/teamlogos/nfl/500/${clean}.png`;
}

function brandImageFallbacks() {
  document.querySelectorAll('.img-fallback:not([data-pbe-branded])').forEach((fallback) => {
    const sportEmoji = fallback.textContent?.trim() || 'PBE';
    fallback.dataset.pbeBranded = '1';
    fallback.innerHTML = `
      <img class="pbe-fallback-mark" src="${PBE_MARK}" alt="PropBetEdge" />
      <span class="pbe-fallback-sport">${escapeHtml(sportEmoji)}</span>
    `;
  });
}

function scheduleArticleEnhancements() {
  clearTimeout(articleEnhancementTimer);
  articleEnhancementTimer = setTimeout(runArticleEnhancements, 60);
}

async function runArticleEnhancements() {
  const match = window.location.pathname.match(/^\/news\/(mlb|nfl|nba|nhl)\/([^/]+)\/?$/i);
  if (!match) {
    articleEnhancementKey = '';
    paywallRunKey = '';
    return;
  }

  const sport = match[1].toLowerCase();
  const slug = decodeURIComponent(match[2]);
  const key = `${sport}:${slug}`;
  const bodyReady = document.querySelector('.article-page .article-body');
  if (!bodyReady) return;

  if (articleEnhancementKey !== key) {
    articleEnhancementKey = key;
    enhanceArticleEntities(sport, slug).catch(() => {});
  }

  if (paywallRunKey !== key) {
    paywallRunKey = key;
    mountReaderPass(key).catch(() => {
      unlockReaderBodies();
    });
  }
}

async function enhanceArticleEntities(sport, slug) {
  if (document.querySelector('.pbe-story-entities')) return;
  const response = await fetch(`${NEWS_API}/news/article/${encodeURIComponent(slug)}`, { credentials: 'omit' });
  if (!response.ok) return;
  const data = await response.json();
  const article = data?.article;
  if (!article) return;

  const candidates = [];
  const seen = new Set();
  const add = (kind, name) => {
    const clean = String(name || '').trim();
    const id = `${kind}:${clean.toLowerCase()}`;
    if (!clean || seen.has(id)) return;
    seen.add(id);
    candidates.push({ kind, name: clean });
  };

  for (const name of (article.take?.players || []).slice(0, 3)) add('player', name);
  for (const name of (article.take?.teams || []).slice(0, 3)) add('team', name);
  if (!candidates.length) return;

  const resolved = (await Promise.all(candidates.slice(0, 5).map(async (entity) => {
    try {
      const url = `/api/sports-media?kind=${encodeURIComponent(entity.kind)}&sport=${encodeURIComponent(sport)}&name=${encodeURIComponent(entity.name)}`;
      const r = await fetch(url, { credentials: 'omit' });
      if (!r.ok) return null;
      const media = await r.json();
      return media?.image ? { ...entity, ...media } : null;
    } catch {
      return null;
    }
  }))).filter(Boolean);

  if (!resolved.length) return;
  const anchor = document.querySelector('.ai-take-callout') || document.querySelector('.article-hero');
  if (!anchor || !anchor.parentNode || document.querySelector('.pbe-story-entities')) return;

  const section = document.createElement('aside');
  section.className = 'pbe-story-entities';
  section.setAttribute('aria-label', 'Players and teams in this story');
  section.innerHTML = `
    <div class="pbe-story-entities-head">
      <img src="${PBE_MARK}" alt="" />
      <span>In this story</span>
    </div>
    <div class="pbe-story-entities-grid">
      ${resolved.map((entity) => `
        <div class="pbe-story-entity ${escapeAttr(entity.kind)}">
          <img src="${escapeAttr(entity.image)}" alt="${escapeAttr(entity.name)}" loading="lazy" onerror="this.closest('.pbe-story-entity')?.remove()" />
          <span class="pbe-story-entity-text">
            <span class="pbe-story-entity-kind">${entity.kind === 'player' ? 'Player' : 'Team'}</span>
            <span class="pbe-story-entity-name">${escapeHtml(entity.name)}</span>
          </span>
        </div>
      `).join('')}
    </div>
  `;
  anchor.insertAdjacentElement('afterend', section);
}

async function mountReaderPass(key) {
  const bodies = [...document.querySelectorAll('.article-page .article-body')];
  if (bodies.length < 2 || document.querySelector('.pbe-reader-wall')) return;

  let status;
  try {
    const response = await fetch('/api/paywall?action=status', { credentials: 'include', cache: 'no-store' });
    if (!response.ok) return;
    status = await response.json();
  } catch {
    return;
  }

  if (!status?.enabled || status?.unlocked) {
    unlockReaderBodies();
    return;
  }

  bodies.slice(1).forEach((body) => body.classList.add('pbe-reader-locked'));
  const wall = document.createElement('aside');
  wall.className = 'pbe-reader-wall';
  wall.dataset.articleKey = key;
  wall.innerHTML = `
    <div class="pbe-reader-wall-inner">
      <div class="pbe-reader-brand">
        <img src="${PBE_FULL}" alt="PropBetEdge" />
        <span class="pbe-reader-badge">Reader Pass</span>
      </div>
      <h3>Unlock the full story.</h3>
      <p>Enter your email and we’ll send a secure PropBetEdge Reader Pass. No password to remember.</p>
      <form class="pbe-reader-form" novalidate>
        <input type="email" name="email" autocomplete="email" inputmode="email" placeholder="you@example.com" aria-label="Email address" required />
        <button type="submit">Email my pass</button>
      </form>
      <div class="pbe-reader-status" aria-live="polite"></div>
      <div class="pbe-reader-note">The access link is time-limited. Once verified, this browser stays unlocked for 30 days.</div>
    </div>
  `;
  bodies[1].insertAdjacentElement('beforebegin', wall);

  const form = wall.querySelector('.pbe-reader-form');
  const input = wall.querySelector('input[type="email"]');
  const button = wall.querySelector('button[type="submit"]');
  const message = wall.querySelector('.pbe-reader-status');

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = input?.value?.trim() || '';
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setReaderStatus(message, 'Enter a valid email address.', 'error');
      return;
    }

    button.disabled = true;
    setReaderStatus(message, 'Sending your secure link…', '');
    try {
      const response = await fetch('/api/paywall?action=request', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, returnTo: window.location.pathname + window.location.search }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Could not send the Reader Pass.');
      setReaderStatus(message, 'Check your inbox — your PropBetEdge Reader Pass is on the way.', 'ok');
      if (input) input.disabled = true;
      button.textContent = 'Sent';
    } catch (error) {
      setReaderStatus(message, error?.message || 'Could not send the Reader Pass.', 'error');
      button.disabled = false;
    }
  });
}

function setReaderStatus(element, text, state) {
  if (!element) return;
  element.textContent = text;
  element.className = `pbe-reader-status${state ? ` ${state}` : ''}`;
}

function unlockReaderBodies() {
  document.querySelectorAll('.article-body.pbe-reader-locked').forEach((body) => body.classList.remove('pbe-reader-locked'));
  document.querySelectorAll('.pbe-reader-wall').forEach((wall) => wall.remove());
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
