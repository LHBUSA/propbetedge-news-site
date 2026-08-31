import { api } from './api.js';

const FOLLOW_KEY = 'pbe_followed_authors_v1';
let timer = null;
let renderKey = '';

export function initMyWriters() {
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(sync, 120);
  };
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('popstate', schedule);
  window.addEventListener('pbe:author-follow-changed', () => {
    renderKey = '';
    schedule();
  });
  schedule();
}

async function sync() {
  if (window.location.pathname !== '/') {
    renderKey = '';
    return;
  }
  const myEdge = document.getElementById('pbe-my-edge');
  if (!myEdge) return;
  const followed = getFollowed().slice(0, 4);
  const key = followed.map((item) => item.slug).join('|');
  const existing = document.getElementById('pbe-my-writers');
  if (!followed.length) {
    existing?.remove();
    renderKey = '';
    return;
  }
  if (existing && key === renderKey) return;
  renderKey = key;
  existing?.remove();

  const section = document.createElement('section');
  section.id = 'pbe-my-writers';
  section.className = 'pbe-my-writers';
  myEdge.insertAdjacentElement('afterend', section);
  section.innerHTML = '<div class="pbe-my-writers-loading">Loading followed writers…</div>';

  const rows = await Promise.all(followed.map(async (author) => {
    try {
      const data = await api.byAuthor(author.name, 3);
      return { author, article: data?.articles?.[0] || null };
    } catch {
      return { author, article: null };
    }
  }));
  if (!document.contains(section)) return;

  section.innerHTML = `
    <div class="pbe-my-writers-head">
      <div><span>MY WRITERS</span><h2>Follow the desks you trust.</h2></div>
      <small>${followed.length} followed</small>
    </div>
    <div class="pbe-my-writers-grid">
      ${rows.map(renderWriter).join('')}
    </div>
  `;
}

function renderWriter({ author, article }) {
  return `
    <article class="pbe-my-writer-card">
      <a href="/authors/${escapeAttr(author.slug)}" class="pbe-my-writer-id">
        <span class="pbe-my-writer-avatar pbe-my-writer-avatar-${escapeAttr(author.accent || 'gold')}">${escapeHtml(author.initials || initials(author.name))}</span>
        <span><small>${escapeHtml(author.role || 'PropBetEdge')}</small><strong>${escapeHtml(author.name)}</strong></span>
      </a>
      ${article ? `<a class="pbe-my-writer-story" href="/news/${escapeAttr(article.sport)}/${escapeAttr(article.slug)}"><span>LATEST</span><strong>${escapeHtml(article.title)}</strong><small>${formatRelative(article.published_at)}</small></a>` : '<div class="pbe-my-writer-story"><span>LATEST</span><strong>No current story returned.</strong></div>'}
    </article>
  `;
}

function getFollowed() {
  try {
    const parsed = JSON.parse(localStorage.getItem(FOLLOW_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((item) => item?.slug && item?.name) : [];
  } catch { return []; }
}
function initials(name) { return String(name || '').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(); }
function formatRelative(value) {
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return '';
  const minutes = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`;
  return `${Math.round(minutes / 1440)}d ago`;
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
function escapeAttr(value) { return escapeHtml(value); }
