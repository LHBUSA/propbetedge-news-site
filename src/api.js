const API_BASE = 'https://propbet-news-api.sales-fd3.workers.dev';

async function get(path) {
  const r = await fetch(`${API_BASE}${path}`, { credentials: 'omit' });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`API ${r.status}: ${text.slice(0, 200)}`);
  }
  return await r.json();
}

const FUTURE_SKEW_MS = 2 * 60 * 1000;
const STALE_FALLBACK_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_HOME_AGE_MS = 24 * 60 * 60 * 1000;
const RETIRED_AUTHOR_FINGERPRINTS = new Set([2793981073]);

function validPastTs(value, now = Date.now()) {
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) && ts <= now + FUTURE_SKEW_MS ? ts : null;
}

function authorFingerprint(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;

  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}

function isRetiredAuthor(article) {
  const fingerprint = authorFingerprint(article?.author);
  return fingerprint !== null && RETIRED_AUTHOR_FINGERPRINTS.has(fingerprint);
}

// Correct invalid/future published_at values using a trustworthy timestamp
// already carried by the article. If none exists, deliberately make it stale
// instead of allowing bogus future data to rank as current news.
function normalizeArticleDate(article, now = Date.now()) {
  if (!article) return article;

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
    .map((value) => validPastTs(value, now))
    .filter((ts) => ts !== null);

  const correctedTs = fallbackTimes.length
    ? Math.max(...fallbackTimes)
    : now - STALE_FALLBACK_MS;

  return {
    ...article,
    published_at: new Date(correctedTs).toISOString(),
    _published_at_corrected: true,
  };
}

function isHouseBrandImageUrl(raw) {
  const value = String(raw || '').toLowerCase();
  if (!value) return false;
  return value.includes('/logo/')
    || value.includes('pbe-mark')
    || value.includes('pbe-full')
    || value.includes('propbetedge-logo')
    || value.includes('propbetedge_logo')
    || value.includes('placeholder-pbe');
}

// A house logo is branding, not editorial photography. Treat it exactly like a
// missing image so the media-backfill layer can recover contextual player/team
// imagery or use the restrained sport fallback instead.
function normalizeArticleImage(article) {
  if (!article) return article;
  if (!isHouseBrandImageUrl(article.image_url)) return article;
  return {
    ...article,
    image_url: null,
    _image_url_rejected: 'house_brand_asset',
  };
}

function normalizeArticleList(data, { maxAgeMs = null, limit = null } = {}) {
  if (!data || !Array.isArray(data.articles)) return data;

  const now = Date.now();
  let articles = data.articles
    .filter((article) => !isRetiredAuthor(article))
    .map((article) => normalizeArticleImage(normalizeArticleDate(article, now)))
    .filter(Boolean)
    .sort((a, b) => {
      const aTs = new Date(a.published_at).getTime();
      const bTs = new Date(b.published_at).getTime();
      return (Number.isFinite(bTs) ? bTs : 0) - (Number.isFinite(aTs) ? aTs : 0);
    });

  if (maxAgeMs != null) {
    articles = articles.filter((article) => {
      const ts = new Date(article.published_at).getTime();
      if (!Number.isFinite(ts)) return false;
      const ageMs = now - ts;
      return ageMs >= -FUTURE_SKEW_MS && ageMs <= maxAgeMs;
    });
  }

  if (limit != null) articles = articles.slice(0, limit);

  return { ...data, articles };
}

export const api = {
  // Homepage hero / Top Stories / Latest: never surface >24h-old stories.
  homepage: async () => normalizeArticleList(
    await get('/news/homepage'),
    { maxAgeMs: MAX_HOME_AGE_MS }
  ),

  breaking: async () => normalizeArticleList(await get('/news/breaking')),

  // Returns { page, limit, total, totalPages, hasMore, articles, ... }
  // Normalize bogus future dates globally, but preserve archive history.
  newsAll: async (limit = 20, page = 1) => normalizeArticleList(
    await get(`/news?limit=${limit}&page=${page}`)
  ),

  // v3.15: now accepts page param + returns pagination metadata.
  // Homepage sport rails call limit=4,page=1. For that compact rail only,
  // fetch a deeper candidate pool so a stale/badly dated record cannot consume
  // one of the four slots, then restrict the rail to the last 24 hours.
  // Full sport pages retain their normal historical archive behavior.
  newsBySport: async (sport, limit = 20, page = 1) => {
    const isHomeRail = limit === 4 && page === 1;
    const fetchLimit = isHomeRail ? 12 : limit;
    const data = await get(`/news/by-sport/${encodeURIComponent(sport)}?limit=${fetchLimit}&page=${page}`);

    return normalizeArticleList(data, isHomeRail
      ? { maxAgeMs: MAX_HOME_AGE_MS, limit }
      : {}
    );
  },

  article: async (slug) => {
    const data = await get(`/news/article/${encodeURIComponent(slug)}`);
    if (!data?.article || isRetiredAuthor(data.article)) {
      return data ? { ...data, article: null } : data;
    }
    return { ...data, article: normalizeArticleImage(normalizeArticleDate(data.article)) };
  },

  sports: () => get('/news/sports'),

  // v3.9.4: client-side author filter (uses /news endpoint, filters in browser)
  byAuthor: async (authorName, limit = 20) => {
    const all = normalizeArticleList(await get(`/news?limit=100&page=1`));
    const matches = (all.articles || []).filter((a) =>
      a.author && a.author.toLowerCase() === authorName.toLowerCase()
    );
    return { articles: matches.slice(0, limit), total: matches.length };
  },
};
