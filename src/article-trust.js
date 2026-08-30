/* PropBetEdge article trust + distribution layer
 * Makes automated editorial provenance explicit and gives every article a
 * lightweight sharing surface without changing the underlying article renderer.
 */

const NEWS_API = 'https://propbet-news-api.sales-fd3.workers.dev';
const ARTICLE_RE = /^\/news\/(mlb|nfl|nba|nhl)\/([^/]+)\/?$/i;
let activeKey = '';
let runTimer = null;

export function initArticleTrustLayer() {
  injectStyles();
  schedule();
  window.addEventListener('popstate', schedule);
  document.addEventListener('click', handleShareClick);

  const observer = new MutationObserver(() => schedule());
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function schedule() {
  clearTimeout(runTimer);
  runTimer = setTimeout(run, 90);
}

async function run() {
  const match = window.location.pathname.match(ARTICLE_RE);
  if (!match) {
    activeKey = '';
    return;
  }

  const byline = document.querySelector('.article-page .article-byline');
  if (!byline) return;

  const sport = match[1].toLowerCase();
  const slug = decodeURIComponent(match[2]);
  const key = `${sport}:${slug}`;
  if (activeKey === key && document.querySelector('.pbe-article-trust')) return;
  activeKey = key;

  let article = null;
  try {
    const response = await fetch(`${NEWS_API}/news/article/${encodeURIComponent(slug)}`, {
      credentials: 'omit',
      cache: 'no-store',
    });
    if (response.ok) article = (await response.json())?.article || null;
  } catch {}

  if (!document.querySelector('.pbe-article-trust')) {
    byline.insertAdjacentHTML('afterend', renderTrust(article));
  }
}

function renderTrust(article) {
  const sourceUrl = safeHttpUrl(article?.source_url || article?.original_url || '');
  const sourceName = String(
    article?.source_name || article?.source || article?.publisher || domainLabel(sourceUrl) || 'Original reporting'
  ).trim();

  return `
    <aside class="pbe-article-trust" aria-label="Article sourcing and sharing">
      <div class="pbe-article-trust-main">
        <span class="pbe-trust-mark">PBE</span>
        <div class="pbe-trust-copy">
          <strong>PropBetEdge analysis layer</strong>
          <span>Automated sports intelligence built on verified source reporting · <a href="/editorial-standards">How we publish</a></span>
        </div>
      </div>
      ${sourceUrl ? `
        <a class="pbe-source-link" href="${escapeAttr(sourceUrl)}" target="_blank" rel="noopener nofollow">
          <span class="pbe-source-label">SOURCE REPORTING</span>
          <strong>${escapeHtml(sourceName)}</strong>
          <span aria-hidden="true">↗</span>
        </a>
      ` : ''}
      <div class="pbe-share-actions" aria-label="Share this story">
        <button type="button" data-pbe-share="copy">Copy link</button>
        <a data-pbe-share="x" href="${xShareUrl()}" target="_blank" rel="noopener">Share on X</a>
      </div>
    </aside>
  `;
}

function handleShareClick(event) {
  const target = event.target.closest?.('[data-pbe-share]');
  if (!target) return;

  const kind = target.dataset.pbeShare;
  if (kind === 'copy') {
    event.preventDefault();
    const value = window.location.href;
    navigator.clipboard?.writeText(value).then(() => {
      const prior = target.textContent;
      target.textContent = 'Copied';
      setTimeout(() => { target.textContent = prior; }, 1400);
    }).catch(() => {});
  }

  if (typeof window.gtag === 'function') {
    window.gtag('event', 'share', {
      method: kind === 'x' ? 'X' : 'Copy Link',
      content_type: 'article',
      item_id: window.location.pathname,
    });
  }
}

function xShareUrl() {
  const url = new URL('https://x.com/intent/post');
  url.searchParams.set('url', window.location.href);
  url.searchParams.set('text', document.title.replace(/\s*[—-]\s*PropBetEdge\s*$/, ''));
  return url.toString();
}

function safeHttpUrl(raw) {
  try {
    if (!raw) return '';
    const url = new URL(String(raw));
    return /^https?:$/.test(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function domainLabel(raw) {
  try {
    return new URL(raw).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function injectStyles() {
  if (document.getElementById('pbe-article-trust-styles')) return;
  const style = document.createElement('style');
  style.id = 'pbe-article-trust-styles';
  style.textContent = `
    .pbe-article-trust {
      margin: 22px 0 26px;
      padding: 14px 16px;
      display: grid;
      grid-template-columns: minmax(0,1fr) auto;
      gap: 12px 18px;
      align-items: center;
      border: 1px solid rgba(212,175,55,.19);
      border-radius: 10px;
      background: linear-gradient(135deg, rgba(212,175,55,.055), rgba(255,255,255,.018));
      font-family: var(--font-sans, Inter, sans-serif);
    }
    .pbe-article-trust-main { display:flex; align-items:center; gap:11px; min-width:0; }
    .pbe-trust-mark {
      width:34px; height:34px; flex:0 0 34px; display:grid; place-items:center;
      border-radius:50%; border:1px solid rgba(212,175,55,.45); color:var(--gold,#d4af37);
      font:800 9px/1 var(--font-mono,monospace); letter-spacing:.08em;
    }
    .pbe-trust-copy { min-width:0; display:flex; flex-direction:column; gap:2px; }
    .pbe-trust-copy strong { font-size:11px; color:var(--paper,#f5f1eb); letter-spacing:.035em; }
    .pbe-trust-copy span { font-size:10.5px; color:var(--paper-dim,#b8b3a8); line-height:1.4; }
    .pbe-trust-copy a { color:var(--gold,#d4af37); text-decoration:none; }
    .pbe-source-link {
      min-width:150px; padding-left:14px; border-left:1px solid rgba(255,255,255,.09);
      display:grid; grid-template-columns:1fr auto; column-gap:8px; align-items:center;
      color:var(--paper,#f5f1eb); text-decoration:none;
    }
    .pbe-source-link:hover strong { color:var(--gold,#d4af37); }
    .pbe-source-label { grid-column:1/-1; color:var(--paper-faint,#7e7a72); font:800 8px/1.4 var(--font-mono,monospace); letter-spacing:.12em; }
    .pbe-source-link strong { max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:11px; transition:color .15s; }
    .pbe-share-actions { grid-column:1/-1; padding-top:10px; border-top:1px solid rgba(255,255,255,.06); display:flex; gap:9px; }
    .pbe-share-actions button,.pbe-share-actions a {
      appearance:none; border:1px solid rgba(255,255,255,.12); background:transparent; color:var(--paper-dim,#b8b3a8);
      border-radius:999px; padding:6px 10px; font:700 9px/1 var(--font-sans,Inter,sans-serif); cursor:pointer; text-decoration:none;
    }
    .pbe-share-actions button:hover,.pbe-share-actions a:hover { border-color:rgba(212,175,55,.42); color:var(--paper,#f5f1eb); }
    @media (max-width:640px) {
      .pbe-article-trust { grid-template-columns:1fr; }
      .pbe-source-link { padding:10px 0 0; border-left:0; border-top:1px solid rgba(255,255,255,.07); }
    }
  `;
  document.head.appendChild(style);
}
