import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const vercel = read('vercel.json');
const index = read('index.html');
const middleware = read('middleware.js');
const sitemap = read('api/sitemap.js');
const rss = read('api/rss.js');
const robots = read('api/robots.js');
const integrity = read('news-integrity.js');
const standards = read('src/pages/editorial-standards.js');
const router = read('src/router.js');

const checks = [
  ['sitemap index is owned by the app', /"source": "\/sitemap\.xml"[\s\S]*?"destination": "\/api\/sitemap\?type=index"/.test(vercel)],
  ['Google News sitemap is owned by the app', /"source": "\/news-sitemap\.xml"[\s\S]*?"destination": "\/api\/sitemap\?type=news"/.test(vercel)],
  ['robots is owned by the app', /"source": "\/robots\.txt"[\s\S]*?"destination": "\/api\/robots"/.test(vercel)],
  ['old sitemap worker is not crawler-critical', !vercel.includes('propbet-news-sitemap.sales-fd3.workers.dev')],
  ['player sitemaps are exposed', vercel.includes('/sitemaps/players-:sport.xml')],
  ['game sitemaps are exposed', vercel.includes('/sitemaps/games-:sport.xml')],
  ['archive sitemap chunks are exposed', vercel.includes('/sitemaps/archive-:chunk.xml')],

  ['global publisher schema is present', index.includes('"@type": "NewsMediaOrganization"')],
  ['unsupported SearchAction is absent from first-response schema', !index.includes('"SearchAction"')],
  ['brand is not mislabeled as a legal entity', !index.includes('"legalName"')],
  ['sport sites are represented as connected WebSites', index.includes('"hasPart"') && index.includes('"PropBetEdge UFC"')],
  ['publisher contact points are in first-response schema', index.includes('"contactPoint"') && index.includes('editorial@proptechusa.ai')],

  ['article integrity gate is in middleware', middleware.includes('assessArticleIntegrity(article)')],
  ['public publication policy is in middleware', middleware.includes('applyArticlePublicationPolicy')],
  ['article bodies are server-visible', middleware.includes('buildServerArticleHtml')],
  ['news archives are server-visible', middleware.includes('buildServerNewsListingHtml')],
  ['news archive CollectionPage schema exists', middleware.includes('buildNewsCollectionSchema')],
  ['page-one archive duplicates redirect', middleware.includes("Response.redirect") && middleware.includes("'/news/page/1'")],
  ['permanent game SportsEvent schema exists', middleware.includes("'@type': 'SportsEvent'")],
  ['player ProfilePage schema exists', middleware.includes("'@type': 'ProfilePage'")],
  ['real missing routes can be 404', middleware.includes('status: 404') && middleware.includes("'noindex, follow'")],
  ['upstream failures fail closed as 503', middleware.includes('status: 503') && middleware.includes("'retry-after'")],

  ['News sitemap uses publication policy', sitemap.includes('filterPublicArticles')],
  ['News sitemap exposes lead images', sitemap.includes('sitemap-image') && sitemap.includes('<image:image>')],
  ['full archive uses chunked sitemaps', sitemap.includes('ARCHIVE_CHUNK_PAGES')],
  ['player entity sitemap generator exists', sitemap.includes('async function playerSitemap')],
  ['game entity sitemap generator exists', sitemap.includes('async function gameSitemap')],
  ['static sitemap does not invent lastmod', /function staticSitemap\(\)[\s\S]*?return urlset\(urls\.map\(\(path\)/.test(sitemap) && !/function staticSitemap\(\)[\s\S]*?<lastmod>/.test(sitemap.split('async function entitySitemap')[0])],

  ['RSS uses integrity-safe public rows', rss.includes('filterPublicArticles')],
  ['RSS is noindex/follow', rss.includes("'X-Robots-Tag', 'noindex, follow'")],
  ['robots advertises primary sitemap', robots.includes('Sitemap: https://propbetedge.ai/sitemap.xml')],
  ['robots advertises News sitemap', robots.includes('Sitemap: https://propbetedge.ai/news-sitemap.xml')],
  ['robots keeps API paths out of crawl', robots.includes('Disallow: /api/')],

  ['integrity gate detects title/body mismatch', integrity.includes("'title_body_mismatch'")],
  ['integrity gate rejects duplicate summaries', integrity.includes("'duplicate_summary'")],
  ['retired contributor policy is centralized', integrity.includes("author === 'donneal green'")],
  ['reattribution policy is centralized', integrity.includes("author === 'eric esters'")],

  ['editorial policy dateModified is not generated at runtime', !standards.includes("dateModified: new Date()")],
  ['about page is routable', router.includes("path === '/about'")],
  ['masthead page is routable', router.includes("path === '/authors'")],
];

const failures = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) {
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${name}\n`);
}

if (failures.length) {
  console.error(`\nSEO contract failed: ${failures.length} check(s).\n`);
  process.exit(1);
}

console.log(`\nSEO contract PASS: ${checks.length}/${checks.length}.\n`);
