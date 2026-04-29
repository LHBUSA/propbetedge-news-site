/**
 * src/components/breaking-banner.js
 * Editorial breaking ribbon — bold red bar
 */

import { escapeHtml } from './article-card.js';

export function renderBreakingBanner(article) {
  if (!article) return '';
  const sport = article.sport?.toUpperCase() || '';
  const url = article.url || `/news/${article.sport}/${article.slug}`;
  return `
    <div class="breaking">
      <div class="container breaking-inner">
        <span class="breaking-tag"><span class="blink"></span>Breaking · ${escapeHtml(sport)}</span>
        <span class="breaking-text">
          <a href="${url}">${escapeHtml(article.title)}</a>
        </span>
      </div>
    </div>
  `;
}
