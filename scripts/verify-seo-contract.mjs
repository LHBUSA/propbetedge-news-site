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
const articlePage = read('src/pages/article.js');
const schemaModule = read('src/entity-graph/article-seo.js');
const linkify = read('src/entity-graph/linkify.js');
const entities = read('src/entity-graph/entities.js');
const shareImage = read('src/entity-graph/share-image.js');
const socialCard = read('api/social-card.js');
const teamPage = read('src/pages/team.js');

/** The body of renderEntityAnchor, which is the markup entity links emit. */
function anchorBody(source) {
  const start = source.indexOf('export function renderEntityAnchor');
  if (start === -1) return 'MISSING';
  const end = source.indexOf('\n}', start);
  return source.slice(start, end === -1 ? source.length : end);
}

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

  // ── PropBetEdge content graph ──────────────────────────────────────────
  ['article SEO has exactly one builder', schemaModule.includes('export function buildArticleSeo')],
  ['middleware renders articles through the shared SEO builder', middleware.includes('buildArticleSeo(article, manifest)')],
  ['the client renders articles through the same SEO builder', articlePage.includes('graph.buildArticleSeo(article, manifest)')],
  ['middleware no longer carries a second article schema builder', !middleware.includes('function buildArticleSchema')],
  ['the client never appends a competing NewsArticle node', articlePage.includes("getElementById('pbe-server-primary-schema')")],
  ['entity manifests are built by the shared module on the server', middleware.includes("from './src/entity-graph/manifest.js'")],
  ['entity manifests are built by the shared module on the client', articlePage.includes('graph.buildEntityManifest(article)')],
  ['server and client linkify with the same function', middleware.includes('linkifyArticleHtml(') && articlePage.includes('graph.linkifyArticleHtml(')],
  ['server and client build body markup with the same function', middleware.includes('articleBodyHtml(article)') && articlePage.includes('graph.articleBodyHtml(article)')],
  ['body entity links are server-visible', middleware.includes('buildServerArticleHtml') && middleware.includes('linkifyArticleHtml')],
  ['the In this story bar is server-visible', middleware.includes('renderInThisStory(manifest)')],
  ['share controls are server-visible', middleware.includes('renderShareBar(')],
  ['related coverage is entity-scored, not sport-only', middleware.includes('rankRelated(') && articlePage.includes('graph.rankRelated(')],
  ['related coverage uses structured entity queries', middleware.includes('/news/by-player/') && middleware.includes('/news/by-team/')],
  ['team pages use the structured team query, not text matching', teamPage.includes('api.byTeamEntity(') && !teamPage.includes('function articleMatchesTeam')],
  ['team coverage asks for every tag spelling, not just ESPN\'s', entities.includes('export function teamQueryAbbreviations') && teamPage.includes('teamQueryAbbreviations(') && middleware.includes('teamQueryAbbreviations(')],
  // Assert on the emitted anchor, not on the file text: the policy comment
  // above renderEntityAnchor names both attributes on purpose.
  ['entity links carry no rel attribute (no nofollow)', !anchorBody(linkify).includes('rel=')],
  ['entity links never open in a new tab', !anchorBody(linkify).includes('target=')],
  ['anchors cannot nest: anchors open a skip region', linkify.includes("SKIP_ELEMENTS") && linkify.includes("'a',")],
  ['entity ids are never invented', entities.includes('reason: \'unknown\'') && entities.includes('reason: \'ambiguous\'')],
  ['ambiguous namesakes are reported, not guessed', entities.includes("return { entity: null, reason: 'ambiguous'")],
  ['common-word nicknames are excluded from link surfaces', entities.includes('RISKY_TEAM_NICKNAMES')],
  ['a persisted manifest is preferred when present', read('src/entity-graph/manifest.js').includes('adoptPersistedManifest')],
  ['the house logo is never an article social image', shareImage.includes('HOUSE_BRAND_MARKERS') && shareImage.includes("'/logo/'")],
  ['share images are a stable PropBetEdge URL', shareImage.includes('/api/social-card?')],
  ['the social card always answers with an image', socialCard.includes('res.status(200).send') && !socialCard.includes('res.status(404)')],
  ['the social card runs where its WASM fits', !socialCard.includes("runtime: 'edge'")],
  ['og image dimensions are declared', schemaModule.includes("'og:image:width'") && schemaModule.includes("'og:image:height'")],
  ['og image alt text is declared', schemaModule.includes("'og:image:alt'")],
  ['twitter uses a large summary card', schemaModule.includes("'twitter:card', 'summary_large_image'")],
  ['schema connects real entities via about/mentions', schemaModule.includes('newsArticle.about') && schemaModule.includes('newsArticle.mentions')],
  ['dateModified is never manufactured', schemaModule.includes('const modified = isoDate(article?.updated_at) || published')],
  ['the news sitemap still publishes first-publication dates', sitemap.includes('<news:publication_date>${esc(article.published_at)}</news:publication_date>')],

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
