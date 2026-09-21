/**
 * src/entity-graph/article-body.js
 *
 * The one place article body copy becomes HTML.
 *
 * Both Edge Middleware and the browser call articleBodyHtml(), so the server
 * and the client linkify byte-identical markup. If these were two renderers,
 * a crawler and a reader could end up with different entity graphs on the same
 * story — which is exactly the failure this module exists to prevent.
 *
 * This never rewrites editorial copy. It only turns the stored body into the
 * markup the page has always shown.
 */

export function articleBodyHtml(article) {
  if (article?.body_html) return String(article.body_html);
  if (article?.body) return renderBodyMarkdown(article.body);
  if (article?.source_url) {
    return `<p>${escapeHtml(article.summary || 'No summary available.')}</p>`
      + `<p><a href="${escapeAttr(article.source_url)}" target="_blank" rel="noopener nofollow">`
      + `Read the full story at ${escapeHtml(extractDomain(article.source_url))} →</a></p>`;
  }
  return '';
}

export function renderBodyMarkdown(md) {
  if (!md) return '';
  let h = String(md).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  h = h.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  h = h.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
  h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
  h = h.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  h = h.replace(/^- (.+)$/gm, '<li>$1</li>');
  h = h.replace(/(<li>[\s\S]+?<\/li>)/g, (m) => `<ul>${m}</ul>`);
  h = h.replace(/<\/ul>\s*<ul>/g, '');
  h = h.split(/\n\n+/).map((p) => {
    if (/^<(h\d|ul|ol|blockquote|pre)/i.test(p.trim())) return p;
    if (!p.trim()) return '';
    return `<p>${p.replace(/\n/g, '<br>')}</p>`;
  }).join('\n');
  return h;
}

export function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return String(url || '');
  }
}

export function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function escapeAttr(value) {
  return escapeHtml(value).replace(/"/g, '&quot;');
}
