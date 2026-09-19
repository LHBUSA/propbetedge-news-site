import { filterPublicArticles } from '../news-integrity.js';

const SITE = 'https://propbetedge.ai';
const NEWS_API = 'https://propbet-news-api.sales-fd3.workers.dev';
const VALID_SPORTS = new Set(['mlb', 'nfl', 'nba', 'nhl']);

export default async function handler(req, res) {
  const mode = String(req.query?.mode || 'all').toLowerCase();
  const sport = String(req.query?.sport || '').toLowerCase();

  res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=900');

  try {
    let data;
    let selfPath = '/news/rss.xml';
    let title = 'PropBetEdge — Sports News';
    let description = 'PropBetEdge sports journalism and intelligence across MLB, NFL, NBA, and NHL.';

    if (mode === 'breaking') {
      data = await fetchNews('/news/breaking');
      selfPath = '/news/breaking/rss.xml';
      title = 'PropBetEdge — Breaking Sports News';
      description = 'Breaking sports news from PropBetEdge.';
    } else if (sport && VALID_SPORTS.has(sport)) {
      data = await fetchNews(`/news/by-sport/${encodeURIComponent(sport)}?limit=50&page=1`);
      selfPath = `/news/${sport}/rss.xml`;
      title = `PropBetEdge — ${sport.toUpperCase()} News`;
      description = `Latest ${sport.toUpperCase()} news and analysis from PropBetEdge.`;
    } else {
      data = await fetchNews('/news?limit=50&page=1');
    }

    const articles = filterPublicArticles(data?.articles || []).slice(0, 50);
    return res.status(200).send(buildRss({ articles, selfPath, title, description }));
  } catch (error) {
    console.error('[rss]', error?.message || error);
    return res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><error>rss_generation_failed</error>');
  }
}

async function fetchNews(path) {
  const response = await fetch(`${NEWS_API}${path}`, {
    headers: {
      Accept: 'application/json',
      Origin: SITE,
      Referer: `${SITE}/news`,
    },
  });
  if (!response.ok) throw new Error(`news_api_${response.status}`);
  return response.json();
}

function buildRss({ articles, selfPath, title, description }) {
  const items = articles.map((article) => {
    const sport = String(article.sport || '').toLowerCase();
    const link = article.url || `${SITE}/news/${sport}/${article.slug}`;
    const summary = article.summary || article.take?.summary || '';
    const take = article.take?.summary || '';
    const pubDate = validDate(article.published_at);
    const descriptionParts = [summary, take && take !== summary ? `PropBetEdge take: ${take}` : '']
      .filter(Boolean)
      .join('\n\n');

    return `<item>
      <title>${xml(article.title || 'PropBetEdge News')}</title>
      <link>${xml(link)}</link>
      <guid isPermaLink="true">${xml(link)}</guid>
      ${pubDate ? `<pubDate>${xml(pubDate)}</pubDate>` : ''}
      <description>${xml(descriptionParts)}</description>
      ${sport ? `<category>${xml(sport.toUpperCase())}</category>` : ''}
      ${article.author ? `<dc:creator>${xml(article.author)}</dc:creator>` : ''}
    </item>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${xml(title)}</title>
    <link>${SITE}/news</link>
    <atom:link href="${xml(SITE + selfPath)}" rel="self" type="application/rss+xml" />
    <description>${xml(description)}</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <generator>PropBetEdge News Engine</generator>
    ${items}
  </channel>
</rss>`;
}

function validDate(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toUTCString() : '';
}

function xml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
