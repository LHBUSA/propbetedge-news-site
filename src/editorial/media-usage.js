/**
 * Newsroom media-usage policy (owner 2026-10-06: the same Chris Sale headshot appeared on three Braves–Dodgers stories
 * in one day; several promo stories shared one DraftKings graphic).
 *
 * One exact image is ONE story's prominent media inside a window — on a page (homepage, /news, /news/<sport>, the
 * article rail) and, upstream, in the newsroom writer (12 h per sport). A repeat is never "fixed" with a random photo:
 * the next CONTEXTUALLY CORRECT candidate is used (the story's other players, the opponent, the teams), and when every
 * contextual image is already in use the restrained sport fallback is shown instead of a repeat.
 *
 * DOM-free and dependency-free: src/media-backfill.js (browser) and the propbet-news-enrich Worker ask the same
 * questions.
 */

export const SAME_IMAGE_WINDOW_HOURS = 12;

const PROXY_PREFIXES = ['https://propbet-img-proxy.sales-fd3.workers.dev/?url=', '/api/img?url='];

/** Identity of an image regardless of the proxy wrapper, scheme, host case, or size/cache query strings. */
export function imageKey(raw) {
  let s = String(raw || '').trim();
  if (!s) return '';
  for (const p of PROXY_PREFIXES) {
    if (s.startsWith(p)) { try { s = decodeURIComponent(s.slice(p.length)); } catch { s = s.slice(p.length); } break; }
  }
  let u;
  try { u = new URL(s, 'https://propbetedge.ai'); } catch { return s.toLowerCase(); }
  // ESPN's combiner carries the real photo in ?img=; elsewhere the query is size/crop/cache noise.
  const img = u.searchParams.get('img');
  if (img) return `${u.hostname.toLowerCase()}${img}`.toLowerCase();
  const nested = u.searchParams.get('url');
  if (nested && /^https?:/i.test(nested)) return imageKey(nested);
  return `${u.hostname.toLowerCase().replace(/^www\./, '')}${u.pathname}`.toLowerCase();
}

/**
 * Pick the media for one story from its resolved contextual candidates (in preference order: lead player, other
 * players incl. the opponent, teams), skipping any image another story on the surface already shows.
 * `used` = Map(imageKey -> storyId) or Set(imageKey). The same story may reuse its own image (a genuine update /
 * the same story rendered twice). Returns the chosen candidate, or null = use the sport fallback, never a repeat.
 */
export function chooseStoryMedia(candidates, used, storyId = null) {
  for (const c of Array.isArray(candidates) ? candidates : []) {
    const key = imageKey(c?.image);
    if (!key) continue;
    const owner = used instanceof Map ? used.get(key) : (used?.has?.(key) ? '__used__' : undefined);
    if (owner === undefined || (storyId && owner === storyId)) return c;
  }
  return null;
}

/**
 * Writer-side rule: may this image become a story's stored hero? `recent` = rows [{ id, image_url, canonical_article_id }]
 * already published in the same sport inside SAME_IMAGE_WINDOW_HOURS. Allowed when no other story uses it, or when
 * the only users are the same canonical story (a genuine update).
 */
export function heroImageAllowed(imageUrl, recent, { articleId = null, canonicalId = null } = {}) {
  const key = imageKey(imageUrl);
  if (!key) return true;
  const family = new Set([articleId, canonicalId].filter(Boolean));
  return !(Array.isArray(recent) ? recent : []).some((r) => {
    if (!r || imageKey(r.image_url) !== key) return false;
    if (family.has(r.id) || (r.canonical_article_id && family.has(r.canonical_article_id))) return false;
    return true;
  });
}
