import { filterPublicArticles } from '../news-integrity.js';

const SITE = 'https://propbetedge.ai';
const NEWS_API = 'https://propbet-news-api.sales-fd3.workers.dev';
const SPORTS = {
  mlb: { label: 'MLB', category: 'baseball', league: 'mlb' },
  nfl: { label: 'NFL', category: 'football', league: 'nfl' },
  nba: { label: 'NBA', category: 'basketball', league: 'nba' },
  nhl: { label: 'NHL', category: 'hockey', league: 'nhl' },
};
const PAGE_SIZE = 50;
const ARCHIVE_CHUNK_PAGES = 20; // 1,000 article URLs per child sitemap
const MAX_PAGES = 1000;

export default async function handler(req, res) {
  const type = String(req.query?.type || 'index').toLowerCase();
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', type === 'news' ? 'public, s-maxage=300, stale-while-revalidate=900' : 'public, s-maxage=3600, stale-while-revalidate=86400');

  try {
    if (type === 'index') return send(res, await sitemapIndex());
    if (type === 'static') return send(res, staticSitemap());
    if (type === 'entities') return send(res, await entitySitemap());
    if (type === 'players') return send(res, await playerSitemap(String(req.query?.sport || '').toLowerCase()));
    if (type === 'news') return send(res, await newsSitemap());
    if (type === 'article-chunk') return send(res, await articleChunkSitemap(req.query?.chunk));
    if (type === 'articles') return send(res, await articleSitemap(req.query?.month));
    return res.status(404).send(xmlError('unknown_sitemap'));
  } catch (error) {
    console.error('[sitemap]', type, error?.message || error);
    return res.status(500).send(xmlError('sitemap_generation_failed'));
  }
}

async function sitemapIndex() {
  const today = dateOnly(new Date());
  const first = await fetchNewsPage(1).catch(() => ({ total: 0, totalPages: 0 }));
  const totalPages = Math.max(
    Number(first?.totalPages || 0),
    first?.total ? Math.ceil(Number(first.total) / PAGE_SIZE) : 0,
  );
  const archiveChunks = Math.max(1, Math.ceil(totalPages / ARCHIVE_CHUNK_PAGES));
  const archiveRefs = Array.from({ length: archiveChunks }, (_, index) =>
    sitemapRef(`/sitemaps/archive-${index + 1}.xml`, today)
  ).join('\n');

  return xml(`<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    ${sitemapRef('/sitemaps/news-current.xml', today)}
    ${sitemapRef('/sitemaps/static.xml', today)}
    ${sitemapRef('/sitemaps/entities.xml', today)}
    ${sitemapRef('/sitemaps/players-mlb.xml', today)}
    ${sitemapRef('/sitemaps/players-nfl.xml', today)}
    ${sitemapRef('/sitemaps/players-nba.xml', today)}
    ${sitemapRef('/sitemaps/players-nhl.xml', today)}
    ${archiveRefs}
  </sitemapindex>`);
}

function staticSitemap() {
  const today = dateOnly(new Date());
  const urls = [
    ['/', 'hourly', '1.0'],
    ['/news', 'hourly', '0.95'],
    ['/news/mlb', 'hourly', '0.90'],
    ['/news/nfl', 'hourly', '0.90'],
    ['/news/nba', 'hourly', '0.90'],
    ['/news/nhl', 'hourly', '0.90'],
    ['/leaders', 'daily', '0.75'],
    ['/leaders/mlb', 'daily', '0.75'],
    ['/leaders/nfl', 'daily', '0.75'],
    ['/leaders/nba', 'daily', '0.75'],
    ['/leaders/nhl', 'daily', '0.75'],
    ['/standings/mlb', 'daily', '0.75'],
    ['/standings/nfl', 'daily', '0.75'],
    ['/standings/nba', 'daily', '0.75'],
    ['/standings/nhl', 'daily', '0.75'],
    ['/games', 'daily', '0.70'],
    ['/editorial-standards', 'monthly', '0.55'],
    ['/authors/justin-erickson', 'weekly', '0.60'],
    ['/authors/propbetedge-editorial-team', 'weekly', '0.60'],
    ['/authors/ty-whitney', 'weekly', '0.60'],
  ];
  return urlset(urls.map(([path, freq, priority]) =>
    `<url><loc>${esc(SITE + path)}</loc><lastmod>${today}</lastmod><changefreq>${freq}</changefreq><priority>${priority}</priority></url>`
  ).join('\n'));
}

async function entitySitemap() {
  const entries = [];
  for (const [sport, config] of Object.entries(SPORTS)) {
    const teams = await fetchTeams(config).catch(() => []);
    for (const team of teams) {
      const name = team.displayName || team.shortDisplayName || team.name;
      if (!name) continue;
      entries.push(`<url><loc>${esc(`${SITE}/team/${sport}/${slugify(name)}`)}</loc><changefreq>daily</changefreq><priority>0.70</priority></url>`);
    }
  }
  return urlset(entries.join('\n'));
}

async function playerSitemap(sport) {
  if (!SPORTS[sport]) throw new Error('unsupported_player_sport');
  let players = [];

  if (sport === 'mlb') players = await fetchMlbPlayers();
  else if (sport === 'nhl') players = await fetchNhlPlayers();
  else players = await fetchEspnPlayers(sport);

  const seen = new Set();
  const body = players.map((player) => {
    const id = String(player?.id || '').trim();
    const name = String(player?.name || '').trim();
    if (!/^\d+$/.test(id) || !name || seen.has(id)) return '';
    seen.add(id);
    return `<url><loc>${esc(`${SITE}/player/${sport}/${id}`)}</loc><changefreq>daily</changefreq><priority>0.68</priority></url>`;
  }).filter(Boolean).join('\n');

  return urlset(body);
}

async function fetchMlbPlayers() {
  const season = new Date().getUTCFullYear();
  const response = await fetch(`https://statsapi.mlb.com/api/v1/sports/1/players?season=${season}`);
  if (!response.ok) throw new Error(`mlb_players_${response.status}`);
  const data = await response.json();
  return (data?.people || [])
    .filter((person) => person?.id && person?.fullName && person?.active !== false)
    .map((person) => ({ id: person.id, name: person.fullName }));
}

async function fetchEspnPlayers(sport) {
  const config = SPORTS[sport];
  const teams = await fetchTeams(config);
  const out = [];

  for (let start = 0; start < teams.length; start += 8) {
    const batch = teams.slice(start, start + 8);
    const results = await Promise.all(batch.map(async (team) => {
      const id = team?.id;
      if (!id) return [];
      const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${config.category}/${config.league}/teams/${encodeURIComponent(id)}/roster`);
      if (!response.ok) return [];
      const data = await response.json();
      const groups = Array.isArray(data?.athletes) ? data.athletes : [];
      return groups.flatMap((group) => {
        if (Array.isArray(group?.items)) return group.items;
        if (Array.isArray(group?.athletes)) return group.athletes;
        return group?.id ? [group] : [];
      }).map((athlete) => ({
        id: athlete?.id,
        name: athlete?.fullName || athlete?.displayName,
      }));
    }));
    for (const rows of results) out.push(...rows);
  }
  return out;
}

async function fetchNhlPlayers() {
  const standingsResponse = await fetch('https://api-web.nhle.com/v1/standings/now');
  if (!standingsResponse.ok) throw new Error(`nhl_standings_${standingsResponse.status}`);
  const standings = await standingsResponse.json();
  const abbreviations = [...new Set((standings?.standings || [])
    .map((row) => row?.teamAbbrev?.default || row?.teamAbbrev)
    .filter(Boolean))];

  const out = [];
  for (let start = 0; start < abbreviations.length; start += 8) {
    const batch = abbreviations.slice(start, start + 8);
    const results = await Promise.all(batch.map(async (abbr) => {
      const response = await fetch(`https://api-web.nhle.com/v1/roster/${encodeURIComponent(abbr)}/current`);
      if (!response.ok) return [];
      const data = await response.json();
      return ['forwards', 'defensemen', 'goalies']
        .flatMap((key) => Array.isArray(data?.[key]) ? data[key] : [])
        .map((player) => ({
          id: player?.id,
          name: `${player?.firstName?.default || ''} ${player?.lastName?.default || ''}`.trim(),
        }));
    }));
    for (const rows of results) out.push(...rows);
  }
  return out;
}

async function newsSitemap() {
  const cutoff = Date.now() - 2 * 24 * 60 * 60 * 1000;
  const articles = await fetchArticlesUntil((article) => {
    const ts = new Date(article.published_at).getTime();
    return Number.isFinite(ts) && ts < cutoff;
  }, 10);

  const fresh = filterPublicArticles(articles)
    .filter((article) => {
      const ts = new Date(article.published_at).getTime();
      return Number.isFinite(ts) && ts >= cutoff;
    })
    .slice(0, 1000);

  const body = fresh.map((article) => {
    const sport = normalizeSport(article.sport);
    if (!sport || !article.slug || !article.title || !article.published_at) return '';
    const keywords = [
      SPORTS[sport].label,
      article.category,
      ...(article.take?.teams || []),
      ...(article.take?.players || []),
    ].filter(Boolean).slice(0, 12).join(', ');
    return `<url>
      <loc>${esc(`${SITE}/news/${sport}/${article.slug}`)}</loc>
      <news:news>
        <news:publication><news:name>PropBetEdge</news:name><news:language>en</news:language></news:publication>
        <news:publication_date>${esc(article.published_at)}</news:publication_date>
        <news:title>${esc(article.title)}</news:title>
        ${keywords ? `<news:keywords>${esc(keywords)}</news:keywords>` : ''}
      </news:news>
    </url>`;
  }).filter(Boolean).join('\n');

  return xml(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">${body}</urlset>`);
}

async function articleChunkSitemap(chunkRaw) {
  const chunk = Math.max(1, parseInt(String(chunkRaw || '1'), 10) || 1);
  const startPage = (chunk - 1) * ARCHIVE_CHUNK_PAGES + 1;

  const requests = [];
  for (let page = startPage; page < startPage + ARCHIVE_CHUNK_PAGES; page++) {
    requests.push(fetchNewsPage(page).catch(() => ({ articles: [], hasMore: false })));
  }
  const pages = await Promise.all(requests);
  const articles = filterPublicArticles(
    dedupeArticles(pages.flatMap((data) => data?.articles || []))
  );

  const body = articles.map((article) => {
    const sport = normalizeSport(article.sport);
    if (!sport || !article.slug) return '';
    const lastmod = article.updated_at || article.published_at || null;
    return `<url><loc>${esc(`${SITE}/news/${sport}/${article.slug}`)}</loc>${lastmod ? `<lastmod>${esc(dateOnly(lastmod))}</lastmod>` : ''}<changefreq>weekly</changefreq><priority>0.65</priority></url>`;
  }).filter(Boolean).join('\n');

  return urlset(body);
}

async function articleSitemap(monthRaw) {
  const month = normalizeMonth(monthRaw);
  const articles = filterPublicArticles(await fetchArticleArchive(month));
  const body = articles.map((article) => {
    const sport = normalizeSport(article.sport);
    if (!sport || !article.slug) return '';
    const lastmod = article.updated_at || article.published_at || null;
    return `<url><loc>${esc(`${SITE}/news/${sport}/${article.slug}`)}</loc>${lastmod ? `<lastmod>${esc(dateOnly(lastmod))}</lastmod>` : ''}<changefreq>weekly</changefreq><priority>0.65</priority></url>`;
  }).filter(Boolean).join('\n');
  return urlset(body);
}

async function fetchArticleArchive(month) {
  if (!month) return fetchAllArticles();

  const start = Date.parse(`${month}-01T00:00:00Z`);
  const [year, monthNum] = month.split('-').map(Number);
  const end = Date.UTC(year, monthNum, 1);
  const out = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const data = await fetchNewsPage(page);
    const articles = data.articles || [];
    if (!articles.length) break;

    let passedMonth = false;
    for (const article of articles) {
      const ts = new Date(article.published_at).getTime();
      if (!Number.isFinite(ts)) continue;
      if (ts >= start && ts < end) out.push(article);
      if (ts < start) passedMonth = true;
    }

    if (passedMonth || data.hasMore === false || page >= Number(data.totalPages || MAX_PAGES)) break;
  }
  return filterPublicArticles(dedupeArticles(out));
}

async function fetchAllArticles() {
  const first = await fetchNewsPage(1);
  const all = [...(first.articles || [])];
  const totalPages = Math.min(MAX_PAGES, Math.max(1, Number(first.totalPages || 1)));

  for (let start = 2; start <= totalPages; start += 8) {
    const pages = [];
    for (let page = start; page < Math.min(start + 8, totalPages + 1); page++) pages.push(fetchNewsPage(page));
    const batch = await Promise.all(pages);
    for (const data of batch) all.push(...(data.articles || []));
  }
  return filterPublicArticles(dedupeArticles(all));
}

async function fetchArticlesUntil(stop, maxPages) {
  const out = [];
  for (let page = 1; page <= maxPages; page++) {
    const data = await fetchNewsPage(page);
    const articles = data.articles || [];
    if (!articles.length) break;
    out.push(...articles);
    if (articles.some(stop) || data.hasMore === false) break;
  }
  return filterPublicArticles(dedupeArticles(out));
}

async function fetchNewsPage(page) {
  const response = await fetch(`${NEWS_API}/news?limit=${PAGE_SIZE}&page=${page}`, {
    headers: {
      Accept: 'application/json',
      Origin: SITE,
      Referer: `${SITE}/news`,
    },
  });
  if (!response.ok) throw new Error(`news_api_${response.status}`);
  return response.json();
}

async function fetchTeams(config) {
  const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${config.category}/${config.league}/teams?limit=100`);
  if (!response.ok) throw new Error(`teams_${config.league}_${response.status}`);
  const data = await response.json();
  return data?.sports?.[0]?.leagues?.[0]?.teams?.map((entry) => entry?.team || entry).filter(Boolean) || [];
}

function dedupeArticles(articles) {
  const seen = new Set();
  return articles.filter((article) => {
    const key = `${article.sport || ''}:${article.slug || ''}`;
    if (!article.slug || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeSport(value) {
  const sport = String(value || '').toLowerCase();
  return SPORTS[sport] ? sport : null;
}

function normalizeMonth(value) {
  const raw = String(value || '').replace(/\.xml$/i, '');
  return /^20\d{2}-(0[1-9]|1[0-2])$/.test(raw) ? raw : null;
}

function urlset(body) {
  return xml(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`);
}

function sitemapRef(path, lastmod) {
  return `<sitemap><loc>${esc(SITE + path)}</loc><lastmod>${lastmod}</lastmod></sitemap>`;
}

function xml(body) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${body}`;
}

function xmlError(code) {
  return xml(`<error>${esc(code)}</error>`);
}

function send(res, body) {
  return res.status(200).send(body);
}

function dateOnly(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : '';
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
