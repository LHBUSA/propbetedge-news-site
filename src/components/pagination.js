/**
 * src/components/pagination.js
 *
 * Reusable pagination component for /news and /news/[sport].
 * Renders prev/next + numbered page links with ellipsis for big counts.
 */

export function renderPagination({ currentPage, totalPages, baseHref }) {
  if (!totalPages || totalPages < 2) return '';

  const cur = Math.max(1, Math.min(currentPage, totalPages));
  const pageHref = (n) => (n === 1 ? baseHref : `${baseHref}/page/${n}`);

  const items = buildPaginationItems(cur, totalPages);

  const prev = cur > 1
    ? `<a href="${pageHref(cur - 1)}" class="pagination-link pagination-prev" rel="prev" aria-label="Previous page">
         <span aria-hidden="true">&larr;</span> Prev
       </a>`
    : `<span class="pagination-link pagination-prev pagination-disabled" aria-disabled="true">
         <span aria-hidden="true">&larr;</span> Prev
       </span>`;

  const next = cur < totalPages
    ? `<a href="${pageHref(cur + 1)}" class="pagination-link pagination-next" rel="next" aria-label="Next page">
         Next <span aria-hidden="true">&rarr;</span>
       </a>`
    : `<span class="pagination-link pagination-next pagination-disabled" aria-disabled="true">
         Next <span aria-hidden="true">&rarr;</span>
       </span>`;

  const numbers = items.map((it) => {
    if (it === '...') {
      return `<span class="pagination-ellipsis" aria-hidden="true">&hellip;</span>`;
    }
    if (it === cur) {
      return `<span class="pagination-link pagination-current" aria-current="page">${it}</span>`;
    }
    return `<a href="${pageHref(it)}" class="pagination-link">${it}</a>`;
  }).join('');

  return `
    <nav class="pagination" aria-label="Article list pagination">
      ${prev}
      <div class="pagination-numbers">${numbers}</div>
      ${next}
    </nav>
  `;
}

function buildPaginationItems(cur, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const items = [];
  const window = 1;
  items.push(1);
  if (cur - window > 2) items.push('...');
  const left = Math.max(2, cur - window);
  const right = Math.min(total - 1, cur + window);
  for (let i = left; i <= right; i++) items.push(i);
  if (cur + window < total - 1) items.push('...');
  items.push(total);
  return items;
}

export function injectPaginationLinkTags({ currentPage, totalPages, baseUrl }) {
  document.querySelectorAll('link[rel="prev"], link[rel="next"]').forEach((el) => el.remove());

  const cur = Math.max(1, Math.min(currentPage, totalPages));
  const pageUrl = (n) => (n === 1 ? baseUrl : `${baseUrl}/page/${n}`);

  if (cur > 1) {
    const prev = document.createElement('link');
    prev.rel = 'prev';
    prev.href = pageUrl(cur - 1);
    document.head.appendChild(prev);
  }
  if (cur < totalPages) {
    const next = document.createElement('link');
    next.rel = 'next';
    next.href = pageUrl(cur + 1);
    document.head.appendChild(next);
  }
}
