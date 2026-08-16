const API_BASE = 'https://propbet-news-api.sales-fd3.workers.dev';

async function get(path) {
  const r = await fetch(`${API_BASE}${path}`, { credentials: 'omit' });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`API ${r.status}: ${text.slice(0, 200)}`);
  }
  return await r.json();
}

// Homepage lead ranking is driven by published_at. A bad future timestamp can
// therefore make an old story look like the newest story forever. Normalize
// clearly-future/invalid dates first, then keep the homepage itself fresh by
// excluding stories older than 24 hours. Older stories remain available via
// /news and per-sport archive endpoints; they just cannot occupy homepage hero,
// Top Stories, or Latest slots.
function normalizeHomepageDates(data) {
  if (!data || !Array.isArray(data.articles)) return data;

  const now = Date.now();
  const FUTURE_SKEW_MS = 2 * 60 * 1000;
  const STALE_FALLBACK_MS = 7 * 24 * 60 * 60 * 1000;
  const MAX_HOME_AGE_MS = 24 * 60 * 60 * 1000;

  const validPastTs = (value) => {
    const ts = new Date(value).getTime();
    return Number.isFinite(ts) && ts <= now + FUTURE_SKEW_MS ? ts : null;
  };

  const normalized = data.articles.map((article) => {
    const publishedTs = new Date(article.published_at).getTime();
    const isClearlyFuture = Number.isFinite(publishedTs) && publishedTs > now + FUTURE_SKEW_MS;
    const isInvalid = !Number.isFinite(publishedTs);

    if (!isClearlyFuture && !isInvalid) return article;

    const fallbackFields = [
      article.source_published_at,
      article.original_published_at,
      article.created_at,
      article.ingested_at,
      article.updated_at,
    ];
    const fallbackTimes = fallbackFields
      .map(validPastTs)
      .filter((ts) => ts !== null);

    const correctedTs = fallbackTimes.length
      ? Math.max(...fallbackTimes)
      : now - STALE_FALLBACK_MS;

    return {
      ...article,
      published_at: new Date(correctedTs).toISOString(),
      _published_at_corrected: true,
    };
  });

  const articles = normalized.filter((article) => {
    const ts = new Date(article.published_at).getTime();
    if (!Number.isFinite(ts)) return false;
    const ageMs = now - ts;
    return ageMs >= -FUTURE_SKEW_MS && ageMs <= MAX_HOME_AGE_MS;
  });

  return { ...data, articles };
}

export const api = {
  homepage:    async () => normalizeHomepageDates(await get('/news/homepage')),
  breaking:    () => get('/news/breaking'),

  // Returns { page, limit, total, totalPages, hasMore, articles, ... }
  newsAll:     (limit = 20, page = 1) => get(`/news?limit=${limit}&page=${page}`),

  // v3.15: now accepts page param + returns pagination metadata
  newsBySport: (sport, limit = 20, page = 1) =>
    get(`/news/by-sport/${encodeURIComponent(sport)}?limit=${limit}&page=${page}`),

  article:     (slug) => get(`/news/article/${encodeURIComponent(slug)}`),
  sports:      () => get('/news/sports'),

  // v3.9.4: client-side author filter (uses /news endpoint, filters in browser)
  byAuthor: async (authorName, limit = 20) => {
    const all = await get(`/news?limit=100&page=1`);
    const matches = (all.articles || []).filter((a) =>
      a.author && a.author.toLowerCase() === authorName.toLowerCase()
    );
    return { articles: matches.slice(0, limit), total: matches.length };
  },
};
