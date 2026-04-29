const API_BASE = 'https://propbet-news-api.sales-fd3.workers.dev';
async function get(path) {
  const r = await fetch(`${API_BASE}${path}`, { credentials: 'omit' });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`API ${r.status}: ${text.slice(0, 200)}`);
  }
  return await r.json();
}
export const api = {
  homepage:    () => get('/news/homepage'),
  breaking:    () => get('/news/breaking'),
  newsAll:     (limit = 20, page = 1) => get(`/news?limit=${limit}&page=${page}`),
  newsBySport: (sport, limit = 20) => get(`/news/by-sport/${encodeURIComponent(sport)}?limit=${limit}`),
  article:     (slug) => get(`/news/article/${encodeURIComponent(slug)}`),
  sports:      () => get('/news/sports'),

  // 🆕 v3.9.4: client-side author filter (uses /news endpoint, filters in browser)
  // Future upgrade: add a real /news/by-author/:slug endpoint to the API worker
  byAuthor: async (authorName, limit = 20) => {
    // Fetch a larger pool then filter — gives us enough matches for one author
    const all = await get(`/news?limit=100&page=1`);
    const matches = (all.articles || []).filter((a) =>
      a.author && a.author.toLowerCase() === authorName.toLowerCase()
    );
    return { articles: matches.slice(0, limit), total: matches.length };
  },
};
