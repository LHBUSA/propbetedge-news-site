/**
 * Vercel Edge Middleware
 *
 * Runs at the edge BEFORE serving index.html. Looks at the URL pattern
 * and rewrites <link rel="canonical">, <title>, <meta property="og:*">
 * and <meta name="robots"> in the HTML response so first-pass crawlers
 * (Googlebot pre-render) see the correct per-page metadata.
 *
 * SEO v3:
 *   - Article metadata + NewsArticle schema are emitted in the first HTML response
 *   - Missing article slugs return real HTTP 404 + noindex
 *   - Pagination uses self-canonicals so archive pages remain crawlable
 *   - Player/team routes receive server-visible entity metadata
 *   - All indexable pages allow large image previews
 */

import { next } from '@vercel/edge';
import { assessArticleIntegrity, applyArticlePublicationPolicy, filterPublicArticles } from './news-integrity.js';
import { buildEntityManifest } from './src/entity-graph/manifest.js';
import { enrichManifestWithGame } from './src/entity-graph/games.js';
import { buildArticleSeo } from './src/entity-graph/article-seo.js';
import { articleBodyHtml } from './src/entity-graph/article-body.js';
import { linkifyArticleHtml } from './src/entity-graph/linkify.js';
import { renderInThisStory } from './src/entity-graph/in-this-story.js';
import { renderShareBar } from './src/entity-graph/share-bar.js';
import { rankRelated } from './src/entity-graph/related.js';
import { teamQueryAbbreviations } from './src/entity-graph/entities.js';
import { liveCastUrl } from './src/live-cast-routes.js';

export const config = {
  matcher: [
    '/((?!api|_next|_vercel|favicon|logo|src|public|assets|manifest|sitemap|news-sitemap|robots|.*\\..*).*)',
  ],
};

const SITE = 'https://propbetedge.ai';
const NEWS_API = 'https://propbet-news-api.sales-fd3.workers.dev';

const SPORT_LABELS = { mlb: 'MLB', nfl: 'NFL', nba: 'NBA', wnba: 'WNBA', nhl: 'NHL' };
const SPORT_API = {
  mlb: { category: 'baseball', league: 'mlb' },
  nfl: { category: 'football', league: 'nfl' },
  nba: { category: 'basketball', league: 'nba' },
  nhl: { category: 'hockey', league: 'nhl' },
};
const DEFAULT_ROBOTS = 'index, follow, max-image-preview:large';
const AUTHOR_META = {
  'justin-erickson': { name: 'Justin Erickson', role: 'Founder & CTO' },
  'erik-schwartz': { name: 'Erik Schwartz', role: 'Senior Editorial Contributor' },
  'ty-whitney': { name: 'Ty Whitney', role: 'Senior Research Analyst' },
  'propbetedge-editorial-team': { name: 'PropBetEdge Editorial Team', role: 'Editorial Operations' },
};


export default async function middleware(request) {
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, '') || '/';

  // Canonical standings entry point. Keep the redirect on the current host so
  // preview stays in preview and production stays on production.
  if (pathname === '/standings') {
    return Response.redirect(new URL('/standings/mlb', request.url), 308);
  }

  // NFL/NHL/WNBA already own richer, canonical live-game products. Legacy
  // main-site game detail URLs redirect at the edge so readers never land on
  // a weaker duplicate page or a route with no real play-by-play.
  const castMatch = pathname.match(/^\/games\/(nfl|nhl|wnba)\/(\d{6,12})$/);
  if (castMatch) {
    const target = liveCastUrl(castMatch[1], castMatch[2]);
    if (target) return Response.redirect(target, 308);
  }

  // Collapse duplicate page-1 archive URLs before any rendering work.
  const newsPageOne = pathname === '/news/page/1';
  const sportPageOne = pathname.match(/^\/news\/(mlb|nfl|nba|nhl)\/page\/1$/);
  if (newsPageOne) return Response.redirect(`${SITE}/news`, 308);
  if (sportPageOne) return Response.redirect(`${SITE}/news/${sportPageOne[1]}`, 308);

  const meta = await resolveMeta(pathname);
  if (!meta) return next();

  const response = await fetch(request);
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('text/html')) {
    return response;
  }

  let html = await response.text();
  html = injectMeta(html, meta);

  const headers = {
    ...Object.fromEntries(response.headers.entries()),
    'content-type': 'text/html; charset=utf-8',
  };
  if (meta.robots?.includes('noindex')) headers['x-robots-tag'] = 'noindex, follow';
  if (meta.status === 503) headers['retry-after'] = '300';

  return new Response(html, {
    status: meta.status || response.status,
    headers,
  });
}

async function resolveMeta(pathname) {
  // Homepage
  if (pathname === '/' || pathname === '') {
    return {
      canonical: `${SITE}/`,
      title: 'PropBetEdge — Sports News & Prop-Bet Intelligence',
      description: 'Editorial sports journalism with AI prop-bet impact analysis. MLB, NFL, NBA, NHL.',
      image: `${SITE}/logo/pbe-full-600.png`,
    };
  }

  // News index — server-visible archive listing.
  if (pathname === '/news') {
    return buildNewsListingMeta({ page: 1 });
  }

  // News index pagination: every page is a distinct crawl path into older stories.
  const newsPagedMatch = pathname.match(/^\/news\/page\/(\d+)$/);
  if (newsPagedMatch) {
    const page = parseInt(newsPagedMatch[1], 10);
    if (page < 1) return notFoundMeta(pathname, 'News page not found');
    return buildNewsListingMeta({ page });
  }

  // Sport pages — server-visible league archive.
  const sportMatch = pathname.match(/^\/news\/(mlb|nfl|nba|nhl)$/);
  if (sportMatch) {
    return buildNewsListingMeta({ sport: sportMatch[1], page: 1 });
  }

  // Sport pagination: self-canonical and indexable so older articles stay linked.
  const sportPagedMatch = pathname.match(/^\/news\/(mlb|nfl|nba|nhl)\/page\/(\d+)$/);
  if (sportPagedMatch) {
    const sport = sportPagedMatch[1];
    const page = parseInt(sportPagedMatch[2], 10);
    if (page < 1) return notFoundMeta(pathname, 'News page not found');
    return buildNewsListingMeta({ sport, page });
  }

  // Individual articles — fetch from the internal news API so crawlers receive
  // the real story metadata and NewsArticle JSON-LD before client JavaScript runs.
  const articleMatch = pathname.match(/^\/news\/(mlb|nfl|nba|nhl)\/([^\/]+)$/);
  if (articleMatch) {
    const sport = articleMatch[1];
    const slug = articleMatch[2];
    try {
      const res = await fetchInternalNews(`/news/article/${encodeURIComponent(slug)}`, pathname);
      if (res.status === 404) {
        return notFoundMeta(pathname, 'Article not found');
      }
      if (res.ok) {
        const data = await res.json();
        const article = applyArticlePublicationPolicy(data.article);
        if (!article && data.article) {
          return notFoundMeta(pathname, 'Article unavailable');
        }
        if (article) {
          const integrity = assessArticleIntegrity(article);
          if (!integrity.ok) {
            console.warn('[seo middleware] withheld corrupt article', slug, integrity.reason);
            return notFoundMeta(pathname, 'Article unavailable');
          }

          // The entity manifest is derived synchronously; the game lookup and
          // the related-coverage pool run in parallel so the story's own
          // markup never waits on either of them in series.
          const baseManifest = buildEntityManifest(article);
          const [manifest, relatedPool] = await Promise.all([
            // Short budget on purpose: the lookup is cached for a day, so a warm hit
            // costs milliseconds. A cold miss loses the game chip in the server
            // render and the client fills it in after paint, which is a far better
            // trade than holding up TTFB on every two-team story.
            enrichManifestWithGame(article, baseManifest, { origin: SITE, timeoutMs: 900 })
              .catch(() => baseManifest),
            loadRelatedCandidates(article, baseManifest, pathname).catch(() => []),
          ]);

          const seo = buildArticleSeo(article, manifest);
          const related = rankRelated(article, manifest, relatedPool, { limit: 6 });

          return {
            canonical: seo.canonical,
            title: seo.title,
            description: seo.description,
            image: seo.image.url,
            type: 'article',
            sport,
            robots: seo.robots,
            publishedTime: seo.publishedTime,
            modifiedTime: seo.modifiedTime,
            section: seo.section,
            socialTags: [...seo.openGraph, ...seo.twitter],
            jsonLd: seo.jsonLd,
            ssrHtml: buildServerArticleHtml(article, sport, seo, manifest, related),
          };
        }
      }
    } catch (e) {
      console.warn('[seo middleware] article metadata fetch failed', e);
      return serviceUnavailableMeta(pathname, 'Article temporarily unavailable');
    }
    return serviceUnavailableMeta(pathname, 'Article temporarily unavailable');
  }

  // Team entity hubs.
  const teamMatch = pathname.match(/^\/team\/(mlb|nfl|nba|nhl)\/([^\/]+)$/);
  if (teamMatch) {
    const sport = teamMatch[1];
    const slug = teamMatch[2];
    const entity = await resolveTeamMeta(sport, slug).catch(() => ({ unavailable: true }));
    if (entity?.notFound) return notFoundMeta(pathname, 'Team not found');
    if (!entity || entity?.unavailable) return serviceUnavailableMeta(pathname, 'Team data temporarily unavailable');
    const name = entity.name || titleFromSlug(slug);
    const canonical = `${SITE}/team/${sport}/${slug}`;
    return {
      canonical,
      title: `${name} — ${SPORT_LABELS[sport]} Team Intelligence | PropBetEdge`,
      description: `${name} team hub with schedule, roster, standings context and connected PropBetEdge coverage.`,
      image: entity?.image || `${SITE}/logo/pbe-full-600.png`,
      robots: DEFAULT_ROBOTS,
      jsonLd: buildTeamSchema(name, sport, canonical, entity?.image || null),
      ssrHtml: buildServerEntityHtml({
        kind: 'team',
        name,
        sport,
        canonical,
        image: entity?.image || null,
        description: `${name} team hub with schedule, roster, standings context and connected PropBetEdge coverage.`,
      }),
    };
  }

  // Player entity hubs. Resolve the actual name server-side when the league API
  // supports the numeric player id used by the route.
  const playerMatch = pathname.match(/^\/player\/(mlb|nfl|nba|nhl)\/([^\/]+)$/);
  if (playerMatch) {
    const sport = playerMatch[1];
    const id = playerMatch[2];
    const entity = await resolvePlayerMeta(sport, id).catch(() => ({ unavailable: true }));
    if (entity?.notFound) return notFoundMeta(pathname, 'Player not found');
    if (!entity || entity?.unavailable) return serviceUnavailableMeta(pathname, 'Player data temporarily unavailable');
    const name = entity.name || `${SPORT_LABELS[sport]} Player`;
    const canonical = `${SITE}/player/${sport}/${id}`;
    return {
      canonical,
      title: `${name} — ${SPORT_LABELS[sport]} Player Intelligence | PropBetEdge`,
      description: `${name} player profile with current stats, recent form, game logs and connected PropBetEdge coverage.`,
      image: entity?.image || `${SITE}/logo/pbe-full-600.png`,
      robots: DEFAULT_ROBOTS,
      jsonLd: buildPlayerSchema(name, sport, canonical, entity?.image || null),
      ssrHtml: buildServerEntityHtml({
        kind: 'player',
        name,
        sport,
        canonical,
        image: entity?.image || null,
        description: `${name} player profile with current stats, recent form, game logs and connected PropBetEdge coverage.`,
      }),
    };
  }

  // Permanent game/event pages: server-resolved metadata, SportsEvent schema,
  // and crawlable matchup content for every supported league.
  const gameMatch = pathname.match(/^\/games\/(mlb|nfl|nba|nhl)\/(\d+)$/);
  if (gameMatch) {
    const sport = gameMatch[1];
    const gameId = gameMatch[2];
    const game = await resolveGameMeta(sport, gameId).catch(() => ({ unavailable: true }));
    if (game?.notFound) return notFoundMeta(pathname, 'Game not found');
    if (!game || game?.unavailable) return serviceUnavailableMeta(pathname, 'Game data temporarily unavailable');

    const canonical = `${SITE}/games/${sport}/${gameId}`;
    const title = `${game.away.name} at ${game.home.name} — ${SPORT_LABELS[sport]} Game Center | PropBetEdge`;
    const description = buildGameDescription(game, sport);

    return {
      canonical,
      title,
      description,
      image: game.image || `${SITE}/logo/pbe-full-600.png`,
      robots: DEFAULT_ROBOTS,
      jsonLd: buildGameSchema(game, sport, canonical),
      ssrHtml: buildServerGameHtml(game, sport, canonical),
    };
  }

  const standingsMatch = pathname.match(/^\/standings\/(mlb|nfl|nba|wnba|nhl)$/);
  if (standingsMatch) {
    const sport = standingsMatch[1];
    return {
      canonical: `${SITE}/standings/${sport}`,
      title: `${SPORT_LABELS[sport]} Standings — PropBetEdge`,
      description: `Current ${SPORT_LABELS[sport]} standings with team intelligence and connected news coverage.`,
      image: `${SITE}/logo/pbe-full-600.png`,
      robots: DEFAULT_ROBOTS,
    };
  }

  // Editorial masthead — a real parent entity for every contributor profile.
  if (pathname === '/authors') {
    const canonical = `${SITE}/authors`;
    return {
      canonical,
      title: 'Editorial Team — PropBetEdge',
      description: 'Meet the PropBetEdge editorial team, research analysts and transparent AI-assisted editorial operation behind our sports coverage.',
      image: `${SITE}/logo/pbe-full-600.png`,
      robots: DEFAULT_ROBOTS,
      jsonLd: buildAuthorsSchema(canonical),
      ssrHtml: buildServerAuthorsHtml(),
    };
  }

  // Author pages — only registered current authors are indexable.
  const authorMatch = pathname.match(/^\/authors?\/([a-z0-9-]+)$/);
  if (authorMatch) {
    const slug = authorMatch[1];
    const author = AUTHOR_META[slug];
    if (!author) {
      return {
        canonical: `${SITE}/authors/propbetedge-editorial-team`,
        title: 'Not found — PropBetEdge',
        description: 'This author page is not available.',
        image: `${SITE}/logo/pbe-full-600.png`,
        robots: 'noindex, follow',
        status: 404,
      };
    }
    const canonical = `${SITE}/authors/${slug}`;
    return {
      canonical,
      title: `${author.name} — ${author.role} · PropBetEdge`,
      description: `Articles by ${author.name} on PropBetEdge.`,
      image: `${SITE}/logo/pbe-full-600.png`,
      robots: DEFAULT_ROBOTS,
      jsonLd: buildAuthorSchema(slug, author, canonical),
      ssrHtml: buildServerAuthorHtml(slug, author),
    };
  }

  // Publisher identity / ownership / contact.
  if (pathname === '/about') {
    const canonical = `${SITE}/about`;
    return {
      canonical,
      title: 'About PropBetEdge — Sports News & Intelligence',
      description: 'About PropBetEdge: ownership, editorial operation, sports-intelligence network, standards, and contact information.',
      image: `${SITE}/logo/pbe-full-600.png`,
      robots: DEFAULT_ROBOTS,
      jsonLd: buildAboutSchema(canonical),
      ssrHtml: buildServerAboutHtml(),
    };
  }

  // Editorial standards
  if (pathname === '/editorial-standards') {
    return {
      canonical: `${SITE}/editorial-standards`,
      title: 'Editorial Standards — PropBetEdge',
      description: 'How PropBetEdge produces editorial content. AI-assisted journalism with editorial review.',
      image: `${SITE}/logo/pbe-full-600.png`,
    };
  }

  // Leaders + UFC champions
  const leadersMatch = pathname.match(/^\/leaders\/(mlb|wnba|nfl|nhl|nba|ufc)$/);
  if (pathname === '/leaders' || leadersMatch) {
    const sport = leadersMatch?.[1] || null;
    const labels = { mlb: 'MLB', wnba: 'WNBA', nfl: 'NFL', nhl: 'NHL', nba: 'NBA', ufc: 'UFC' };
    const isUfc = sport === 'ufc';
    return {
      canonical: `${SITE}${pathname}`,
      title: isUfc
        ? 'UFC Champions — PropBetEdge'
        : sport
          ? `${labels[sport]} Stat Leaders — PropBetEdge`
          : 'Stat Leaders & UFC Champions — PropBetEdge',
      description: isUfc
        ? 'Current UFC divisional champions from the verified official rankings snapshot.'
        : sport
          ? `Live ${labels[sport]} player leaderboards with automatic in-page refresh and connected PropBetEdge intelligence.`
          : 'Live leaderboards across MLB, WNBA, NFL, NHL and NBA, plus current UFC divisional champions.',
      image: `${SITE}/logo/pbe-full-600.png`,
      robots: DEFAULT_ROBOTS,
    };
  }

  // Games
  if (pathname === '/games') {
    return {
      canonical: `${SITE}/games`,
      title: 'Live Games — PropBetEdge',
      description: 'Live scores across MLB, NFL, NBA, WNBA and NHL, with NFL, WNBA and NHL games connected to their live PBEcast experiences.',
      image: `${SITE}/logo/pbe-full-600.png`,
    };
  }

  // Default fallback
  return {
    canonical: `${SITE}${pathname}`,
    title: 'PropBetEdge — Sports News & Prop-Bet Intelligence',
    description: 'Editorial sports journalism with AI prop-bet impact analysis.',
    image: `${SITE}/logo/pbe-full-600.png`,
  };
}

function injectMeta(html, meta) {
  // First paint must already know the league. The browser selector may later
  // honor a user's manual scene choice, but a non-MLB article must never flash
  // the old baseball fallback before JavaScript boots.
  if (meta?.sport && /^(mlb|nfl|nba|nhl|wnba|ufc)$/.test(String(meta.sport))) {
    if (/<body\b[^>]*data-pbe-scene=/i.test(html)) {
      html = html.replace(/(<body\b[^>]*data-pbe-scene=["'])[^"']*(["'][^>]*>)/i, `$1${escapeAttr(meta.sport)}$2`);
    } else {
      html = html.replace(/<body\b([^>]*)>/i, `<body$1 data-pbe-scene="${escapeAttr(meta.sport)}">`);
    }
  }

  // Replace canonical
  html = html.replace(
    /<link\s+rel="canonical"[^>]*>/i,
    `<link rel="canonical" href="${escapeAttr(meta.canonical)}" />`
  );

  // Replace <title>
  html = html.replace(
    /<title>[^<]*<\/title>/i,
    `<title>${escapeHtml(meta.title)}</title>`
  );

  // Replace meta description
  html = html.replace(
    /<meta\s+name="description"[^>]*>/i,
    `<meta name="description" content="${escapeAttr(meta.description)}" />`
  );

  // Robots. Every indexable page explicitly opts into large image previews.
  const robots = meta.robots || DEFAULT_ROBOTS;
  if (/<meta\s+name="robots"[^>]*>/i.test(html)) {
    html = html.replace(
      /<meta\s+name="robots"[^>]*>/i,
      `<meta name="robots" content="${escapeAttr(robots)}" />`
    );
  } else {
    html = html.replace(
      /<\/head>/i,
      `  <meta name="robots" content="${escapeAttr(robots)}" />\n</head>`
    );
  }

  // Social metadata. When a page supplies a complete tag set (articles do), the
  // shipped defaults are stripped and replaced wholesale so no stale og:image
  // or duplicate og:title can survive next to the real one.
  if (Array.isArray(meta.socialTags) && meta.socialTags.length) {
    html = applySocialTags(html, meta.socialTags);
  } else {
    html = html.replace(
      /<meta\s+property="og:url"[^>]*>/i,
      `<meta property="og:url" content="${escapeAttr(meta.canonical)}" />`
    );
    html = html.replace(
      /<meta\s+property="og:title"[^>]*>/i,
      `<meta property="og:title" content="${escapeAttr(meta.title)}" />`
    );
    html = html.replace(
      /<meta\s+property="og:description"[^>]*>/i,
      `<meta property="og:description" content="${escapeAttr(meta.description)}" />`
    );
    html = html.replace(
      /<meta\s+property="og:image"[^>]*>/i,
      `<meta property="og:image" content="${escapeAttr(meta.image)}" />`
    );
    if (meta.type) {
      html = html.replace(
        /<meta\s+property="og:type"[^>]*>/i,
        `<meta property="og:type" content="${escapeAttr(meta.type)}" />`
      );
    }
    html = html.replace(
      /<meta\s+name="twitter:title"[^>]*>/i,
      `<meta name="twitter:title" content="${escapeAttr(meta.title)}" />`
    );
    html = html.replace(
      /<meta\s+name="twitter:description"[^>]*>/i,
      `<meta name="twitter:description" content="${escapeAttr(meta.description)}" />`
    );
    html = html.replace(
      /<meta\s+name="twitter:image"[^>]*>/i,
      `<meta name="twitter:image" content="${escapeAttr(meta.image)}" />`
    );

    if (meta.publishedTime) {
      html = upsertPropertyMeta(html, 'article:published_time', meta.publishedTime);
    }
    if (meta.modifiedTime) {
      html = upsertPropertyMeta(html, 'article:modified_time', meta.modifiedTime);
    }
    if (meta.section) {
      html = upsertPropertyMeta(html, 'article:section', meta.section);
    }
  }
  if (meta.jsonLd) {
    const serialized = JSON.stringify(meta.jsonLd).replace(/<\/script/gi, '<\\/script');
    html = html.replace(
      /<\/head>/i,
      `  <script type="application/ld+json" id="pbe-server-primary-schema">${serialized}</script>\n</head>`
    );
  }

  if (meta.ssrHtml) {
    html = html.replace(
      /<div\s+id="app"\s*><\/div>/i,
      `<div id="app">${meta.ssrHtml}</div>`
    );
  }

  return html;
}

/**
 * Replace the managed social tag set in one pass.
 *
 * `article:tag` is intentionally repeatable — every resolved player, team,
 * league and category gets its own tag — so this clears the whole managed
 * namespace first rather than trying to edit tags in place.
 */
function applySocialTags(html, pairs) {
  const managed = new Set(pairs.map(([name]) => name));
  let out = html;

  for (const name of managed) {
    const attribute = name.startsWith('twitter:') ? 'name' : 'property';
    const pattern = new RegExp(
      `[ \\t]*<meta\\s+${attribute}=["']${escapeRegex(name)}["'][^>]*>[ \\t]*\\n?`,
      'gi',
    );
    out = out.replace(pattern, '');
  }

  const block = pairs
    .map(([name, content]) => {
      const attribute = name.startsWith('twitter:') ? 'name' : 'property';
      return `  <meta ${attribute}="${name}" content="${escapeAttr(content)}" />`;
    })
    .join('\n');

  return out.replace(/<\/head>/i, block + '\n</head>');
}

/**
 * Candidate pool for entity-aware related coverage.
 *
 * Structured entity queries first — the news API can answer "stories tagged
 * with this player" and "stories tagged with this team" directly — with the
 * league feed as a backstop so the section is never empty. All three run in
 * parallel and any of them may fail without affecting the page.
 */
async function loadRelatedCandidates(article, manifest, requestPath) {
  const sport = String(article?.sport || '').toLowerCase();
  const player = (manifest.players || []).find((p) => p.origin !== 'text') || (manifest.players || [])[0];
  const team = (manifest.teams || []).find((t) => t.origin !== 'text') || (manifest.teams || [])[0];

  const paths = [];
  if (player?.name) paths.push(`/news/by-player/${encodeURIComponent(player.name)}`);
  for (const abbreviation of teamQueryAbbreviations(sport, team?.abbreviation)) {
    const sportQuery = sport ? `?sport=${encodeURIComponent(sport)}` : '';
    paths.push(`/news/by-team/${encodeURIComponent(abbreviation)}${sportQuery}`);
  }
  if (sport) paths.push(`/news/by-sport/${encodeURIComponent(sport)}?limit=12&page=1`);
  if (!paths.length) return [];

  const responses = await Promise.all(paths.map((path) => fetchInternalNews(path, requestPath)
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null)));

  const seen = new Set([article.slug]);
  const pool = [];
  for (const data of responses) {
    for (const row of filterPublicArticles(data?.articles || [])) {
      if (!row?.slug || seen.has(row.slug)) continue;
      if (sport && String(row.sport || '').toLowerCase() !== sport) continue;
      seen.add(row.slug);
      pool.push(row);
    }
  }
  return pool;
}

function escapeAttr(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}


async function buildNewsListingMeta({ sport = null, page = 1 }) {
  const label = sport ? SPORT_LABELS[sport] : 'Sports';
  const path = sport
    ? `/news/by-sport/${encodeURIComponent(sport)}?limit=12&page=${page}`
    : `/news?limit=12&page=${page}`;
  const requestPath = sport
    ? (page === 1 ? `/news/${sport}` : `/news/${sport}/page/${page}`)
    : (page === 1 ? '/news' : `/news/page/${page}`);

  let data;
  try {
    const res = await fetchInternalNews(path, requestPath);
    if (!res.ok) return serviceUnavailableMeta(requestPath, 'News archive temporarily unavailable');
    data = await res.json();
  } catch (error) {
    console.warn('[seo middleware] news listing fetch failed', requestPath, error);
    return serviceUnavailableMeta(requestPath, 'News archive temporarily unavailable');
  }

  const totalPages = Number(data?.totalPages || 0);
  if (page > 1 && totalPages > 0 && page > totalPages) {
    return notFoundMeta(requestPath, 'News page not found');
  }

  const articles = filterPublicArticles(data?.articles || []);
  if (page > 1 && !articles.length && data?.hasMore === false) {
    return notFoundMeta(requestPath, 'News page not found');
  }

  const canonical = `${SITE}${requestPath}`;
  const title = sport
    ? (page === 1 ? `${label} News — PropBetEdge` : `${label} News (Page ${page}) — PropBetEdge`)
    : (page === 1 ? 'Latest Sports News — PropBetEdge' : `Latest Sports News (Page ${page}) — PropBetEdge`);
  const description = sport
    ? (page === 1
      ? `Latest ${label} news, player updates, game context and PropBetEdge sports intelligence.`
      : `Page ${page} of ${label} news, player updates, game context and PropBetEdge analysis.`)
    : (page === 1
      ? 'Latest sports news and PropBetEdge analysis across MLB, NFL, NBA, and NHL.'
      : `Page ${page} of PropBetEdge sports news and analysis across MLB, NFL, NBA, and NHL.`);

  return {
    canonical,
    title,
    description,
    image: articles[0]?.image_url || `${SITE}/logo/pbe-full-600.png`,
    robots: DEFAULT_ROBOTS,
    jsonLd: buildNewsCollectionSchema({ sport, page, canonical, title, description, articles }),
    ssrHtml: buildServerNewsListingHtml({ sport, page, articles, totalPages, canonical }),
  };
}

function buildNewsCollectionSchema({ sport, page, canonical, title, description, articles }) {
  const itemList = articles.map((article, index) => {
    const articleSport = String(article?.sport || sport || '').toLowerCase();
    if (!SPORT_LABELS[articleSport] || !article?.slug) return null;
    return {
      '@type': 'ListItem',
      position: index + 1,
      url: `${SITE}/news/${articleSport}/${article.slug}`,
      name: article.title || 'PropBetEdge News',
    };
  }).filter(Boolean);

  const breadcrumbs = [
    { '@type': 'ListItem', position: 1, name: 'PropBetEdge', item: `${SITE}/` },
    { '@type': 'ListItem', position: 2, name: 'News', item: `${SITE}/news` },
  ];
  if (sport) {
    breadcrumbs.push({
      '@type': 'ListItem',
      position: 3,
      name: `${SPORT_LABELS[sport]} News`,
      item: `${SITE}/news/${sport}`,
    });
  }
  if (page > 1) {
    breadcrumbs.push({
      '@type': 'ListItem',
      position: breadcrumbs.length + 1,
      name: `Page ${page}`,
      item: canonical,
    });
  }

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${canonical}#page`,
        url: canonical,
        name: title,
        description,
        isPartOf: { '@id': `${SITE}/#website` },
        publisher: { '@id': `${SITE}/#organization` },
        mainEntity: {
          '@type': 'ItemList',
          itemListOrder: 'https://schema.org/ItemListOrderDescending',
          numberOfItems: itemList.length,
          itemListElement: itemList,
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbs,
      },
    ],
  };
}

function buildServerNewsListingHtml({ sport, page, articles, totalPages, canonical }) {
  const label = sport ? `${SPORT_LABELS[sport]} News` : 'Latest Sports News';
  const storyRows = articles.map((article) => {
    const articleSport = String(article?.sport || sport || '').toLowerCase();
    if (!SPORT_LABELS[articleSport] || !article?.slug) return '';
    const href = `/news/${articleSport}/${article.slug}`;
    const summary = article.summary || article.take?.summary || '';
    const published = article.published_at ? formatServerDate(article.published_at) : '';
    return `<li>
      <article>
        ${article.image_url ? `<a href="${escapeAttr(href)}"><img src="${escapeAttr(article.image_url)}" alt="" width="480" loading="lazy" /></a>` : ''}
        <p>${SPORT_LABELS[articleSport]}${published ? ` · ${escapeHtml(published)}` : ''}</p>
        <h2><a href="${escapeAttr(href)}">${escapeHtml(article.title || 'PropBetEdge News')}</a></h2>
        ${summary ? `<p>${escapeHtml(summary)}</p>` : ''}
      </article>
    </li>`;
  }).filter(Boolean).join('');

  const prev = page > 1
    ? (page === 2
      ? (sport ? `/news/${sport}` : '/news')
      : (sport ? `/news/${sport}/page/${page - 1}` : `/news/page/${page - 1}`))
    : null;
  const next = totalPages > page
    ? (sport ? `/news/${sport}/page/${page + 1}` : `/news/page/${page + 1}`)
    : null;

  return `<main class="pbe-ssr-news-index" data-server-rendered="1">
    <nav aria-label="Breadcrumb"><a href="/">PropBetEdge</a> &rsaquo; ${sport ? `<a href="/news">News</a> &rsaquo; ${SPORT_LABELS[sport]}` : 'News'}</nav>
    <header>
      <p>PropBetEdge Newsroom</p>
      <h1>${escapeHtml(label)}${page > 1 ? ` — Page ${page}` : ''}</h1>
    </header>
    <ol>${storyRows}</ol>
    <nav aria-label="News pagination">
      ${prev ? `<a rel="prev" href="${escapeAttr(prev)}">← Newer stories</a>` : ''}
      ${next ? `<a rel="next" href="${escapeAttr(next)}">Older stories →</a>` : ''}
    </nav>
    <p><a href="${escapeAttr(canonical)}">Permanent archive page</a></p>
  </main>`;
}

function fetchInternalNews(path, requestPath = '/news') {
  return fetch(`${NEWS_API}${path}`, {
    headers: {
      Accept: 'application/json',
      Origin: SITE,
      Referer: `${SITE}${requestPath}`,
    },
  });
}

function notFoundMeta(pathname, label) {
  return {
    canonical: `${SITE}${pathname}`,
    title: `${label} — PropBetEdge`,
    description: 'The requested PropBetEdge page is not available.',
    image: `${SITE}/logo/pbe-full-600.png`,
    robots: 'noindex, follow',
    status: 404,
  };
}

function serviceUnavailableMeta(pathname, label) {
  return {
    canonical: `${SITE}${pathname}`,
    title: `${label} — PropBetEdge`,
    description: 'This PropBetEdge page is temporarily unavailable while its source data is refreshed.',
    image: `${SITE}/logo/pbe-full-600.png`,
    robots: 'noindex, follow',
    status: 503,
  };
}

async function resolveTeamMeta(sport, slug) {
  if (!SPORT_API[sport]) return { notFound: true };

  // Resolve through the app's serverless media gateway instead of calling ESPN
  // directly from Edge Middleware. That gateway is cacheable, runs in the Node
  // runtime and already owns provider normalization/error semantics.
  const query = titleFromSlug(slug);
  const endpoint = `${SITE}/api/sports-media?kind=team&sport=${encodeURIComponent(sport)}&name=${encodeURIComponent(query)}`;
  const res = await fetch(endpoint, { headers: { Accept: 'application/json' } });
  if (res.status === 404) return { notFound: true };
  if (!res.ok) return { unavailable: true };

  const team = await res.json();
  if (!team?.name) return { notFound: true };
  if (slugify(team.name) !== slugify(slug) && slugify(team.abbreviation) !== slugify(slug)) {
    return { notFound: true };
  }
  return {
    name: team.name,
    image: team.image || null,
  };
}

async function resolvePlayerMeta(sport, id) {
  if (!/^\d{1,9}$/.test(String(id))) return { notFound: true };

  if (sport === 'mlb') {
    const res = await fetch(`https://statsapi.mlb.com/api/v1/people/${encodeURIComponent(id)}`);
    if (res.status === 404) return { notFound: true };
    if (!res.ok) return { unavailable: true };
    const person = (await res.json())?.people?.[0];
    if (!person) return { notFound: true };
    return {
      name: person.fullName,
      image: `https://img.mlbstatic.com/mlb-photos/image/upload/w_600,q_90/v1/people/${id}/headshot/67/current`,
    };
  }

  if (sport === 'nhl') {
    const res = await fetch(`https://api-web.nhle.com/v1/player/${encodeURIComponent(id)}/landing`);
    if (res.status === 404) return { notFound: true };
    if (!res.ok) return { unavailable: true };
    const player = await res.json();
    const name = `${player?.firstName?.default || ''} ${player?.lastName?.default || ''}`.trim();
    if (!name) return { notFound: true };
    return { name, image: player.headshot || null };
  }

  const api = SPORT_API[sport];
  const res = await fetch(`https://site.web.api.espn.com/apis/common/v3/sports/${api.category}/${api.league}/athletes/${encodeURIComponent(id)}`);
  if (res.status === 404) return { notFound: true };
  if (!res.ok) return { unavailable: true };
  const athlete = (await res.json())?.athlete;
  if (!athlete) return { notFound: true };
  return {
    name: athlete.displayName || athlete.fullName || `${SPORT_LABELS[sport]} Player`,
    image: athlete.headshot?.href || null,
  };
}

function upsertPropertyMeta(html, property, content) {
  const escaped = escapeAttr(content);
  const re = new RegExp(`<meta\\s+property=["']${escapeRegex(property)}["'][^>]*>`, 'i');
  if (re.test(html)) {
    return html.replace(re, `<meta property="${property}" content="${escaped}" />`);
  }
  return html.replace(
    /<\/head>/i,
    `  <meta property="${property}" content="${escaped}" />\n</head>`
  );
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function titleFromSlug(value) {
  return String(value || '')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * Server-rendered article.
 *
 * This is what a crawler receives before a single byte of application
 * JavaScript runs: the real headline, the real byline and publication time,
 * the entity bar, the body with its internal entity links already in place,
 * and entity-aware related coverage. The client renders the same graph from
 * the same modules, so nothing here is a special crawler-only view.
 */
function buildServerArticleHtml(article, sport, seo, manifest, related) {
  const title = escapeHtml(article.title || `${SPORT_LABELS[sport]} News`);
  const summary = escapeHtml(article.summary || article.take?.summary || '');
  const author = escapeHtml(article.author || 'PropBetEdge Editorial Team');
  const authorSlugValue = String(article.author || 'PropBetEdge Editorial Team')
    .toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
  const published = article.published_at ? String(article.published_at) : '';
  const updated = seo.modifiedTime && seo.publishedTime && seo.modifiedTime !== seo.publishedTime
    ? seo.modifiedTime
    : '';

  const linked = linkifyArticleHtml(articleBodyHtml(article), manifest, {
    excludeUrls: [seo.canonical],
  });
  const bodyHtml = linked.html || (summary ? `<p>${summary}</p>` : '');

  const crumbs = seo.breadcrumbs.map((crumb, index) => (crumb.url && index < seo.breadcrumbs.length - 1
    ? `<a href="${escapeAttr(relativeUrl(crumb.url))}">${escapeHtml(crumb.name)}</a>`
    : `<span aria-current="page">${escapeHtml(crumb.name)}</span>`)).join(' &rsaquo; ');

  const heroAlt = escapeAttr(seo.image.alt || article.title || '');
  const hero = article.image_url
    ? `<figure class="pbe-ssr-hero"><img src="${escapeAttr(article.image_url)}" alt="${heroAlt}" width="1200" height="675" loading="eager" decoding="async" /></figure>`
    : '';

  return `<article class="pbe-ssr-article" data-server-rendered="1">
    <nav class="pbe-breadcrumb" aria-label="Breadcrumb">${crumbs}</nav>
    <header>
      <p class="pbe-ssr-eyebrow">${SPORT_LABELS[sport]}${article.category && article.category !== 'general' ? ` · ${escapeHtml(article.category)}` : ''}</p>
      <h1>${title}</h1>
      ${summary ? `<p class="pbe-ssr-dek">${summary}</p>` : ''}
      <p class="pbe-ssr-byline">By <a href="/authors/${escapeAttr(authorSlugValue)}">${author}</a>${published ? ` · <time datetime="${escapeAttr(published)}">${escapeHtml(formatServerDate(published))}</time>` : ''}${updated ? ` · <span>Updated <time datetime="${escapeAttr(updated)}">${escapeHtml(formatServerDate(updated))}</time></span>` : ''}</p>
      ${renderShareBar(seo.canonical, article.title || '')}
    </header>
    ${renderInThisStory(manifest)}
    ${hero}
    <section class="pbe-ssr-body">${bodyHtml}</section>
    ${buildServerRelatedHtml(related, sport)}
    <footer>
      <a href="${escapeAttr(seo.canonical)}">Permalink</a>
      ${safeHttpUrl(article.source_url) ? ` · <a href="${escapeAttr(article.source_url)}" rel="nofollow noopener">Original source</a>` : ''}
    </footer>
  </article>`;
}

/**
 * Related coverage, server-side. Every row is a crawlable link into the same
 * topical cluster, which is the point: the entity graph has to be navigable
 * without JavaScript or it is not a graph.
 */
function buildServerRelatedHtml(related, sport) {
  const items = related?.items || [];
  const explore = (related?.explore || [])
    .map((link) => `<a href="${escapeAttr(link.href)}">${escapeHtml(link.label)}</a>`)
    .join(' · ');

  if (!items.length) {
    return explore ? `<nav class="pbe-ssr-explore" aria-label="More coverage">${explore}</nav>` : '';
  }

  const rows = items.map(({ article }) => {
    const rowSport = String(article.sport || sport).toLowerCase();
    if (!SPORT_LABELS[rowSport] || !article.slug) return '';
    const href = `/news/${rowSport}/${article.slug}`;
    const when = article.published_at ? formatServerDate(article.published_at) : '';
    return `<li><article>
      <p>${SPORT_LABELS[rowSport]}${when ? ` · ${escapeHtml(when)}` : ''}</p>
      <h3><a href="${escapeAttr(href)}">${escapeHtml(article.title || 'PropBetEdge News')}</a></h3>
    </article></li>`;
  }).filter(Boolean).join('');

  if (!rows) return explore ? `<nav class="pbe-ssr-explore" aria-label="More coverage">${explore}</nav>` : '';

  return `<section class="pbe-ssr-related" aria-labelledby="pbe-ssr-related-heading">
    <h2 id="pbe-ssr-related-heading">${escapeHtml(related.heading || 'Related coverage')}</h2>
    <ol>${rows}</ol>
    ${explore ? `<nav class="pbe-ssr-explore" aria-label="More coverage">${explore}</nav>` : ''}
  </section>`;
}

/** Same-origin absolute URLs render as paths so SSR markup stays compact. */
function relativeUrl(url) {
  const value = String(url || '');
  return value.startsWith(SITE) ? (value.slice(SITE.length) || '/') : value;
}

function buildServerEntityHtml({ kind, name, sport, canonical, image, description }) {
  const label = kind === 'player' ? 'Player Intelligence' : 'Team Intelligence';
  return `<main class="pbe-ssr-entity" data-server-rendered="1">
    <nav aria-label="Breadcrumb"><a href="/">PropBetEdge</a> &rsaquo; <a href="/news/${sport}">${SPORT_LABELS[sport]}</a></nav>
    <article>
      ${image ? `<img src="${escapeAttr(image)}" alt="${escapeAttr(name)}" width="600" loading="eager" />` : ''}
      <p>${SPORT_LABELS[sport]} · ${label}</p>
      <h1>${escapeHtml(name)}</h1>
      <p>${escapeHtml(description)}</p>
      <p><a href="/news/${sport}">Latest ${SPORT_LABELS[sport]} news</a> · <a href="/standings/${sport}">${SPORT_LABELS[sport]} standings</a> · <a href="${escapeAttr(canonical)}">Permanent profile</a></p>
    </article>
  </main>`;
}

function articlePlainText(article) {
  const raw = article.body || stripHtmlText(article.body_html || '') || article.summary || '';
  return String(raw)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/[*_~`]+/g, '')
    .replace(/\r/g, '')
    .trim();
}

function stripHtmlText(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|h[1-6]|li|section|article|blockquote)>/gi, '\n\n')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .trim();
}

function safeHttpUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return /^https?:$/.test(url.protocol);
  } catch {
    return false;
  }
}

function formatServerDate(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

async function resolveGameMeta(sport, gameId) {
  if (!/^\d{1,12}$/.test(String(gameId))) return { notFound: true };

  // Game identity is normalized by the Node-side gateway. This avoids provider
  // differences in the Edge runtime and keeps ESPN ids consistent across
  // NFL/NBA/NHL team schedules, game pages and sitemaps.
  const endpoint = `${SITE}/api/game-meta?sport=${encodeURIComponent(sport)}&id=${encodeURIComponent(gameId)}`;
  const res = await fetch(endpoint, { headers: { Accept: 'application/json' } });
  if (res.status === 404 || res.status === 400) return { notFound: true };
  if (!res.ok) return { unavailable: true };

  const game = await res.json();
  if (!game?.home?.name || !game?.away?.name) return { notFound: true };
  return {
    ...game,
    image: game?.home?.image || game?.away?.image || null,
  };
}

function buildGameDescription(game, sport) {
  const scoreKnown = game.away.score != null && game.home.score != null
    && String(game.away.score) !== '' && String(game.home.score) !== '';
  const score = scoreKnown ? ` Score: ${game.away.name} ${game.away.score}, ${game.home.name} ${game.home.score}.` : '';
  const status = game.statusDetail || game.status;
  return `${game.away.name} at ${game.home.name} ${SPORT_LABELS[sport]} game center with matchup, score, status and connected PropBetEdge intelligence.${score}${status ? ` Status: ${status}.` : ''}`;
}

function buildGameSchema(game, sport, canonical) {
  const status = String(game.status || '').toLowerCase();
  let eventStatus = 'https://schema.org/EventScheduled';
  if (status.includes('post') || status.includes('final') || status.includes('off')) {
    eventStatus = 'https://schema.org/EventCompleted';
  } else if (status.includes('cancel')) {
    eventStatus = 'https://schema.org/EventCancelled';
  } else if (status.includes('postpone')) {
    eventStatus = 'https://schema.org/EventPostponed';
  }

  const teamNode = (team) => ({
    '@type': 'SportsTeam',
    name: team.name,
    url: `${SITE}/team/${sport}/${slugify(team.name)}`,
    image: team.image || undefined,
  });

  return {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    '@id': `${canonical}#event`,
    url: canonical,
    name: `${game.away.name} at ${game.home.name}`,
    description: buildGameDescription(game, sport),
    startDate: game.startDate || undefined,
    eventStatus,
    homeTeam: teamNode(game.home),
    awayTeam: teamNode(game.away),
    location: game.venue ? { '@type': 'Place', name: game.venue } : undefined,
    organizer: {
      '@type': 'SportsOrganization',
      name: SPORT_LABELS[sport],
    },
    isAccessibleForFree: true,
  };
}

function buildServerGameHtml(game, sport, canonical) {
  const scoreKnown = game.away.score != null && game.home.score != null
    && String(game.away.score) !== '' && String(game.home.score) !== '';
  const status = game.statusDetail || game.status || '';
  const when = game.startDate ? formatServerDateTime(game.startDate) : '';

  const team = (side, label) => `<section>
    ${side.image ? `<img src="${escapeAttr(side.image)}" alt="${escapeAttr(side.name)}" width="160" />` : ''}
    <p>${label}</p>
    <h2><a href="/team/${sport}/${slugify(side.name)}">${escapeHtml(side.name)}</a></h2>
    ${scoreKnown ? `<p>Score: <strong>${escapeHtml(String(side.score))}</strong></p>` : ''}
  </section>`;

  return `<main class="pbe-ssr-game" data-server-rendered="1">
    <nav aria-label="Breadcrumb"><a href="/">PropBetEdge</a> &rsaquo; <a href="/games">Games</a> &rsaquo; ${SPORT_LABELS[sport]}</nav>
    <article>
      <header>
        <p>${SPORT_LABELS[sport]} Game Center</p>
        <h1>${escapeHtml(game.away.name)} at ${escapeHtml(game.home.name)}</h1>
        ${when ? `<time datetime="${escapeAttr(game.startDate)}">${escapeHtml(when)}</time>` : ''}
        ${status ? `<p>${escapeHtml(status)}</p>` : ''}
        ${game.venue ? `<p>${escapeHtml(game.venue)}</p>` : ''}
      </header>
      <div>
        ${team(game.away, 'Away')}
        ${team(game.home, 'Home')}
      </div>
      <p><a href="${escapeAttr(canonical)}">Permanent game page</a> · <a href="/news/${sport}">Latest ${SPORT_LABELS[sport]} news</a></p>
    </article>
  </main>`;
}

function formatServerDateTime(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toISOString().replace('T', ' ').replace(/\.000Z$/, ' UTC');
}

function buildAboutSchema(canonical) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'AboutPage',
        '@id': `${canonical}#page`,
        url: canonical,
        name: 'About PropBetEdge',
        description: 'Ownership, editorial operation, sports-intelligence network, standards, and contact information for PropBetEdge.',
        mainEntity: { '@id': `${SITE}/#organization` },
        isPartOf: { '@id': `${SITE}/#website` },
        inLanguage: 'en-US',
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'PropBetEdge', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'About PropBetEdge', item: canonical },
        ],
      },
    ],
  };
}

function buildServerAboutHtml() {
  return `<main class="pbe-ssr-about" data-server-rendered="1">
    <nav aria-label="Breadcrumb"><a href="/">PropBetEdge</a> &rsaquo; About</nav>
    <article>
      <p>Publisher</p>
      <h1>About PropBetEdge</h1>
      <p><strong>PropBetEdge is owned, built, and operated by PropTechUSA.ai.</strong> Its newsroom, sports-intelligence products, APIs, models, automation, and technical infrastructure operate within the broader PropTechUSA.ai organization.</p>
      <h2>Editorial operation</h2>
      <p>PropBetEdge uses a hybrid human-and-AI editorial workflow with public standards covering source verification, AI assistance, human review, corrections, feedback, ethics, and coverage inclusivity.</p>
      <p><a href="/authors">Editorial Team</a> · <a href="/editorial-standards">Editorial Standards</a></p>
      <h2>Contact</h2>
      <p>Editorial: <a href="mailto:editorial@proptechusa.ai">editorial@proptechusa.ai</a><br>
      Business: <a href="mailto:hello@proptechusa.ai">hello@proptechusa.ai</a><br>
      Press: <a href="mailto:press@proptechusa.ai">press@proptechusa.ai</a></p>
    </article>
  </main>`;
}

function buildAuthorSchema(slug, author, canonical) {
  const isTeam = slug === 'propbetedge-editorial-team';
  const entity = {
    '@type': isTeam ? 'Organization' : 'Person',
    '@id': `${canonical}#author`,
    name: author.name,
    url: canonical,
    worksFor: isTeam ? undefined : { '@id': `${SITE}/#organization` },
    jobTitle: isTeam ? undefined : author.role,
    memberOf: isTeam ? { '@id': `${SITE}/#organization` } : undefined,
  };

  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    '@id': `${canonical}#profile`,
    url: canonical,
    name: `${author.name} — PropBetEdge`,
    mainEntity: entity,
    isPartOf: { '@id': `${SITE}/#website` },
    publisher: { '@id': `${SITE}/#organization` },
  };
}

function buildServerAuthorHtml(slug, author) {
  return `<main class="pbe-ssr-author" data-server-rendered="1">
    <nav aria-label="Breadcrumb"><a href="/">PropBetEdge</a> &rsaquo; <a href="/authors">Editorial Team</a> &rsaquo; ${escapeHtml(author.name)}</nav>
    <article>
      <p>${escapeHtml(author.role)}</p>
      <h1>${escapeHtml(author.name)}</h1>
      <p>${escapeHtml(author.name)} contributes to PropBetEdge sports journalism and intelligence coverage.</p>
      <p><a href="/editorial-standards">Editorial Standards</a> · <a href="/authors">Full masthead</a></p>
    </article>
  </main>`;
}

function buildAuthorsSchema(canonical) {
  const items = Object.entries(AUTHOR_META).map(([slug, author], index) => ({
    '@type': 'ListItem',
    position: index + 1,
    item: {
      '@type': slug === 'propbetedge-editorial-team' ? 'Organization' : 'Person',
      '@id': `${SITE}/authors/${slug}#author`,
      name: author.name,
      jobTitle: author.role,
      url: `${SITE}/authors/${slug}`,
      worksFor: { '@id': `${SITE}/#organization` },
    },
  }));

  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${canonical}#page`,
    url: canonical,
    name: 'PropBetEdge Editorial Team',
    description: 'PropBetEdge masthead and editorial contributor profiles.',
    isPartOf: { '@id': `${SITE}/#website` },
    publisher: { '@id': `${SITE}/#organization` },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: items,
    },
  };
}

function buildServerAuthorsHtml() {
  const rows = Object.entries(AUTHOR_META).map(([slug, author]) => `
    <li>
      <h2><a href="/authors/${escapeAttr(slug)}">${escapeHtml(author.name)}</a></h2>
      <p>${escapeHtml(author.role)}</p>
    </li>
  `).join('');

  return `<main class="pbe-ssr-authors" data-server-rendered="1">
    <nav aria-label="Breadcrumb"><a href="/">PropBetEdge</a> &rsaquo; Editorial Team</nav>
    <article>
      <h1>PropBetEdge Editorial Team</h1>
      <p>Meet the people and editorial operation behind PropBetEdge sports journalism and intelligence.</p>
      <ul>${rows}</ul>
      <p><a href="/editorial-standards">Read our Editorial Standards</a></p>
    </article>
  </main>`;
}

function buildPlayerSchema(name, sport, canonical, image) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    '@id': `${canonical}#profile`,
    url: canonical,
    name: `${name} — ${SPORT_LABELS[sport]} Player Intelligence`,
    mainEntity: {
      '@type': 'Person',
      '@id': `${canonical}#person`,
      name,
      url: canonical,
      image: image || undefined,
      knowsAbout: [SPORT_LABELS[sport], 'sports statistics', 'player performance'],
    },
    isPartOf: { '@id': `${SITE}/#website` },
    publisher: { '@id': `${SITE}/#organization` },
    inLanguage: 'en-US',
  };
}

function buildTeamSchema(name, sport, canonical, image) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SportsTeam',
    '@id': `${canonical}#team`,
    name,
    sport: SPORT_LABELS[sport],
    url: canonical,
    image: image || undefined,
    memberOf: {
      '@type': 'SportsOrganization',
      name: SPORT_LABELS[sport],
    },
  };
}
