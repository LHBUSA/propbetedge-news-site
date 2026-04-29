/**
 * src/components/article-card.js
 * Editorial photo-forward card — magazine style
 *
 * v3.9: image error fallback uses CSS + data attributes instead of inline JS,
 * eliminating the broken `'" />` leak that appeared below cards.
 */

import { proxyImage } from '../ads-config.js';

const SPORT_FALLBACK = {
  mlb: '⚾',
  nfl: '🏈',
  nba: '🏀',
  nhl: '🏒',
};

export function renderArticleCard(article, opts = {}) {
  const featured = opts.featured ? ' featured' : '';
  const date = new Date(article.published_at);
  const dateStr = formatRelative(date);
  const url = article.url || `/news/${article.sport}/${article.slug}`;
  const fallbackEmoji = SPORT_FALLBACK[article.sport] || '◆';

  // Image block: render BOTH the img and the fallback, hide fallback by default.
  // If <img> fails, the onerror handler ONLY toggles classes — no innerHTML rewrite.
  const imageBlock = article.image_url
    ? `<div class="card-image">
         <img
           src="${escapeAttr(proxyImage(article.image_url))}"
           alt="${escapeAttr(article.title)}"
           loading="lazy"
           class="card-image-img"
           onerror="this.classList.add('img-broken')"
         />
         <div class="img-fallback" data-emoji="${fallbackEmoji}">${fallbackEmoji}</div>
         ${impactBadge(article)}
       </div>`
    : `<div class="card-image">
         <div class="img-fallback" data-emoji="${fallbackEmoji}">${fallbackEmoji}</div>
         ${impactBadge(article)}
       </div>`;

  return `
    <a href="${escapeAttr(url)}" class="article-card${featured}">
      ${imageBlock}
      <div class="card-meta">
        <span class="sport-tag">${escapeHtml(article.sport.toUpperCase())}</span>
        <span class="dot">·</span>
        <span class="timestamp">${dateStr}</span>
      </div>
      <h3 class="card-headline">${escapeHtml(article.title)}</h3>
      ${article.summary ? `<p class="card-dek">${escapeHtml(article.summary)}</p>` : ''}
      ${article.take?.summary ? `
        <div class="card-take">
          <span class="card-take-icon">⚡</span>
          <span class="card-take-text">${escapeHtml(article.take.summary)}</span>
        </div>
      ` : ''}
    </a>
  `;
}

function impactBadge(article) {
  if (!article.take?.impact_score) return '';
  const score = article.take.impact_score;
  if (score < 3) return '';
  const cls = score >= 4 ? 'high' : '';
  return `<div class="impact-badge ${cls}">Impact ${score}/5</div>`;
}

// Sidebar story (used in lead grid)
export function renderSidebarStory(article) {
  const url = article.url || `/news/${article.sport}/${article.slug}`;
  const date = new Date(article.published_at);
  return `
    <a href="${escapeAttr(url)}" class="sidebar-story">
      <div class="sport-tag">${escapeHtml(article.sport.toUpperCase())}</div>
      <h3 class="sidebar-headline">${escapeHtml(article.title)}</h3>
      <span class="sidebar-time">${formatRelative(date)}</span>
    </a>
  `;
}

// Helpers
export function formatRelative(date) {
  const now = new Date();
  const diffMs = now - date;
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, '&quot;');
}
