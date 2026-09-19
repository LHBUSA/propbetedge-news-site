/**
 * Shared PropBetEdge newsroom integrity gate.
 *
 * This is deliberately conservative: it only withholds rows when there is
 * strong evidence that the editorial attached to the URL belongs to another
 * story. It never rewrites or guesses replacement content.
 */

const STOP = new Set([
  'about','after','again','against','ahead','before','being','between','could',
  'debut','during','first','from','game','games','have','having','into','latest',
  'make','makes','more','news','night','over','report','season','sunday','monday',
  'tuesday','wednesday','thursday','friday','saturday','than','that','their',
  'there','these','they','this','those','through','today','tomorrow','tonight',
  'under','update','week','will','with','year','years','your','mlb','nfl','nba',
  'nhl','propbetedge'
]);

export function assessArticleIntegrity(article, peers = []) {
  if (!article || typeof article !== 'object') return { ok: false, reason: 'missing_article' };

  const title = clean(article.title || article.headline || '');
  if (!title) return { ok: false, reason: 'missing_title' };

  const summary = clean(article.summary || article.description || article.take?.summary || '');
  const body = articleBodyText(article);

  if (summary.length >= 80 && Array.isArray(peers) && peers.length > 1) {
    const target = normalize(summary);
    let count = 0;
    for (const peer of peers) {
      const peerSummary = normalize(peer?.summary || peer?.description || peer?.take?.summary || '');
      if (peerSummary && peerSummary === target) count += 1;
      if (count > 1) return { ok: false, reason: 'duplicate_summary' };
    }
  }

  if (body.length >= 300) {
    const anchors = titleAnchorTokens(title);
    if (anchors.length >= 2) {
      const haystack = normalize(`${summary} ${body.slice(0, 6000)}`);
      const matches = anchors.filter((token) => containsToken(haystack, token));
      if (matches.length === 0) {
        return { ok: false, reason: 'title_body_mismatch', anchors };
      }
    }
  }

  return { ok: true, reason: null };
}

export function applyArticlePublicationPolicy(article) {
  if (!article || typeof article !== 'object') return null;
  const author = String(article.author || '').trim().toLowerCase();

  // Match the site's existing public contributor policy.
  if (author === 'donneal green') return null;
  if (author === 'eric esters') {
    return { ...article, author: 'PropBetEdge Editorial Team', _author_reattributed: true };
  }
  return article;
}

export function filterPublicArticles(items) {
  const publicRows = (Array.isArray(items) ? items : [])
    .map(applyArticlePublicationPolicy)
    .filter(Boolean);
  return filterIntegritySafeArticles(publicRows);
}

export function filterIntegritySafeArticles(items) {
  const list = Array.isArray(items) ? items : [];
  return list.filter((article) => assessArticleIntegrity(article, list).ok);
}

export function articleBodyText(article) {
  const raw = article?.body || stripHtml(article?.body_html || '') || '';
  return clean(
    String(raw)
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^[-*+]\s+/gm, '')
      .replace(/[*_~`]+/g, ' ')
  );
}

export function titleAnchorTokens(title) {
  const tokens = normalize(title)
    .split(' ')
    .filter((token) => token.length >= 5 && !STOP.has(token));

  return [...new Set(tokens)].slice(0, 14);
}

function containsToken(haystack, token) {
  return (` ${haystack} `).includes(` ${token} `);
}

function normalize(value) {
  return clean(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}
