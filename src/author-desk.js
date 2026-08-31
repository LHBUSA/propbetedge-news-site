import { api } from './api.js';
import { getAuthorBySlug } from './pages/author.js';
import { getSportConfig } from './sport-config.js';

const FOLLOW_KEY = 'pbe_followed_authors_v1';
let timer = null;
let activeKey = '';

export function initAuthorDesks() {
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(sync, 100);
  };
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('popstate', schedule);
  schedule();
}

async function sync() {
  const match = window.location.pathname.match(/^\/authors\/([a-z0-9-]+)\/?$/i);
  if (!match) {
    activeKey = '';
    return;
  }
  const slug = match[1].toLowerCase();
  const author = getAuthorBySlug(slug);
  const hero = document.querySelector('.author-hero');
  const articlesSection = document.querySelector('.author-articles-section');
  if (!author || !hero || !articlesSection) return;

  mountFollow(hero, slug, author);
  if (document.querySelector('.pbe-author-desk')) return;
  if (activeKey === slug) return;
  activeKey = slug;

  const desk = document.createElement('section');
  desk.className = 'pbe-author-desk';
  desk.innerHTML = '<div class="pbe-author-desk-loading">Building desk pulse…</div>';
  articlesSection.insertAdjacentElement('beforebegin', desk);

  try {
    const response = await api.byAuthor(author.name, 24);
    if (!document.contains(desk)) return;
    const articles = response?.articles || [];
    const total = Number.isFinite(Number(response?.total)) ? Number(response.total) : articles.length;
    desk.innerHTML = renderDesk(author, articles, total);
  } catch {
    desk.remove();
    activeKey = '';
  }
}

function mountFollow(hero, slug, author) {
  let button = hero.querySelector('[data-pbe-author-follow]');
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'pbe-author-follow';
    button.dataset.pbeAuthorFollow = slug;
    hero.appendChild(button);
    button.addEventListener('click', () => toggleFollow(slug, author, button));
  }
  paintFollow(button, slug);
}

function toggleFollow(slug, author, button) {
  const items = getFollowed();
  const index = items.findIndex((item) => item.slug === slug);
  const following = index < 0;
  if (index >= 0) items.splice(index, 1);
  else items.push({ slug, name: author.name, role: author.role, initials: author.initials, accent: author.accent });
  saveFollowed(items);
  paintFollow(button, slug);
  window.dispatchEvent(new CustomEvent('pbe:author-follow-changed', { detail: { slug, author: author.name, following } }));
  if (typeof window.gtag === 'function') {
    window.gtag('event', 'author_follow_changed', { author_slug: slug, author_name: author.name, following });
  }
}

function paintFollow(button, slug) {
  const active = getFollowed().some((item) => item.slug === slug);
  button.dataset.following = active ? '1' : '0';
  button.setAttribute('aria-pressed', active ? 'true' : 'false');
  button.textContent = active ? '✓ Following Writer' : '+ Follow Writer';
}

function renderDesk(author, articles, total) {
  const recent = [...articles].sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
  const counts = new Map();
  for (const article of recent) {
    const sport = String(article.sport || '').toLowerCase();
    if (sport) counts.set(sport, (counts.get(sport) || 0) + 1);
  }
  const coverage = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const highImpact = recent
    .map((article) => ({ article, score: impactScore(article) }))
    .filter((item) => item.score != null)
    .sort((a, b) => b.score - a.score || new Date(b.article.published_at) - new Date(a.article.published_at))[0];
  const latest = recent[0];

  return `
    <div class="pbe-author-desk-head">
      <div><span>AUTHOR DESK</span><h2>${escapeHtml(author.name)} · current pulse</h2></div>
      <small>Based on the latest ${Math.min(articles.length, 24)} loaded stories</small>
    </div>
    <div class="pbe-author-desk-grid">
      <div class="pbe-author-desk-stat"><span>PUBLISHED</span><strong>${escapeHtml(String(total))}</strong><small>articles in the author feed</small></div>
      <div class="pbe-author-desk-stat"><span>LATEST</span><strong>${latest ? escapeHtml(formatRelative(latest.published_at)) : '—'}</strong><small>${latest ? escapeHtml(shorten(latest.title, 62)) : 'No recent story returned'}</small></div>
      <div class="pbe-author-desk-stat pbe-author-desk-coverage">
        <span>RECENT COVERAGE MIX</span>
        <div>${coverage.length ? coverage.map(([sport, count]) => {
          const config = getSportConfig(sport);
          return `<b>${config?.emoji || '◆'} ${escapeHtml(config?.label || sport.toUpperCase())}<i>${count}</i></b>`;
        }).join('') : '<small>No league mix available</small>'}</div>
      </div>
      <div class="pbe-author-desk-stat">
        <span>HIGHEST RECENT IMPACT</span>
        ${highImpact ? `<a href="/news/${escapeAttr(highImpact.article.sport)}/${escapeAttr(highImpact.article.slug)}"><strong>${escapeHtml(String(highImpact.score))}/5</strong><small>${escapeHtml(shorten(highImpact.article.title, 70))}</small></a>` : '<strong>—</strong><small>No scored story in the loaded sample</small>'}
      </div>
    </div>
    <div class="pbe-author-desk-note">This desk reports published activity and story metadata only. It does not manufacture betting records or analyst hit rates.</div>
  `;
}

function impactScore(article) {
  const raw = article?.take?.impact_score;
  if (raw == null || raw === '') return null;
  const score = Number(raw);
  return Number.isFinite(score) ? score : null;
}
function getFollowed() {
  try {
    const parsed = JSON.parse(localStorage.getItem(FOLLOW_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
function saveFollowed(items) { try { localStorage.setItem(FOLLOW_KEY, JSON.stringify(items)); } catch {} }
function formatRelative(value) {
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return '';
  const minutes = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`;
  return `${Math.round(minutes / 1440)}d ago`;
}
function shorten(value, max) { const text = String(value || ''); return text.length > max ? `${text.slice(0, max - 1).trim()}…` : text; }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
function escapeAttr(value) { return escapeHtml(value); }
