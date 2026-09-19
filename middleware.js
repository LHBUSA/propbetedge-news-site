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
import { assessArticleIntegrity, applyArticlePublicationPolicy } from './news-integrity.js';

export const config = {
  matcher: [
    '/((?!api|_next|_vercel|favicon|logo|src|public|assets|manifest|sitemap|news-sitemap|robots|.*\\..*).*)',
  ],
};

const SITE = 'https://propbetedge.ai';
const NEWS_API = 'https://propbet-news-api.sales-fd3.workers.dev';

const SPORT_LABELS = { mlb: 'MLB', nfl: 'NFL', nba: 'NBA', nhl: 'NHL' };
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

  // News index — page 1
  if (pathname === '/news') {
    return {
      canonical: `${SITE}/news`,
      title: 'Latest Sports News — PropBetEdge',
      description: 'Breaking sports news with AI prop-bet impact analysis across MLB, NFL, NBA, and NHL.',
      image: `${SITE}/logo/pbe-full-600.png`,
    };
  }

  // News index pagination: every page is a distinct crawl path into older stories.
  const newsPagedMatch = pathname.match(/^\/news\/page\/(\d+)$/);
  if (newsPagedMatch) {
    const page = parseInt(newsPagedMatch[1], 10);
    return {
      canonical: `${SITE}/news/page/${page}`,
      title: `Latest Sports News (Page ${page}) — PropBetEdge`,
      description: `Page ${page} of PropBetEdge sports news and analysis across MLB, NFL, NBA, and NHL.`,
      image: `${SITE}/logo/pbe-full-600.png`,
      robots: DEFAULT_ROBOTS,
    };
  }

  // Sport pages — page 1
  const sportMatch = pathname.match(/^\/news\/(mlb|nfl|nba|nhl)$/);
  if (sportMatch) {
    const sport = sportMatch[1];
    const label = SPORT_LABELS[sport];
    return {
      canonical: `${SITE}/news/${sport}`,
      title: `${label} News — PropBetEdge`,
      description: `Latest ${label} news with AI prop-bet impact analysis.`,
      image: `${SITE}/logo/pbe-full-600.png`,
    };
  }

  // Sport pagination: self-canonical and indexable so older articles stay linked.
  const sportPagedMatch = pathname.match(/^\/news\/(mlb|nfl|nba|nhl)\/page\/(\d+)$/);
  if (sportPagedMatch) {
    const sport = sportPagedMatch[1];
    const page = parseInt(sportPagedMatch[2], 10);
    const label = SPORT_LABELS[sport];
    return {
      canonical: `${SITE}/news/${sport}/page/${page}`,
      title: `${label} News (Page ${page}) — PropBetEdge`,
      description: `Page ${page} of ${label} news, player updates, game context and PropBetEdge analysis.`,
      image: `${SITE}/logo/pbe-full-600.png`,
      robots: DEFAULT_ROBOTS,
    };
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
          const canonical = `${SITE}/news/${sport}/${slug}`;
          return {
            canonical,
            title: `${article.title} — PropBetEdge`,
            description: article.take?.summary || article.summary || `Latest ${SPORT_LABELS[sport]} news.`,
            image: article.image_url || `${SITE}/logo/pbe-full-600.png`,
            type: 'article',
            robots: DEFAULT_ROBOTS,
            publishedTime: article.published_at || null,
            modifiedTime: article.updated_at || article.published_at || null,
            section: SPORT_LABELS[sport],
            jsonLd: buildArticleSchema(article, sport, canonical),
            ssrHtml: buildServerArticleHtml(article, sport, canonical),
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

  const standingsMatch = pathname.match(/^\/standings\/(mlb|nfl|nba|nhl)$/);
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
    return {
      canonical: `${SITE}/authors/${slug}`,
      title: `${author.name} — ${author.role} · PropBetEdge`,
      description: `Articles by ${author.name} on PropBetEdge.`,
      image: `${SITE}/logo/pbe-full-600.png`,
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

  // Leaders
  if (pathname === '/leaders' || pathname.match(/^\/leaders\/(mlb|nfl|nba|nhl)$/)) {
    return {
      canonical: `${SITE}${pathname}`,
      title: 'Stat Leaders — PropBetEdge',
      description: 'Top performers across MLB, NFL, NBA, and NHL.',
      image: `${SITE}/logo/pbe-full-600.png`,
    };
  }

  // Games
  if (pathname === '/games') {
    return {
      canonical: `${SITE}/games`,
      title: 'Live Games — PropBetEdge',
      description: 'Live scores across MLB, NBA, NHL, and NFL.',
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

  // Replace OpenGraph tags
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

  // Twitter
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

function buildArticleSchema(article, sport, canonical) {
  const authorName = article.author || 'PropBetEdge Editorial Team';
  const authorSlug = String(authorName)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    '@id': `${canonical}#article`,
    url: canonical,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    headline: article.title,
    description: article.summary || article.take?.summary || article.title,
    datePublished: article.published_at || undefined,
    dateModified: article.updated_at || article.published_at || undefined,
    articleSection: SPORT_LABELS[sport],
    inLanguage: 'en-US',
    isAccessibleForFree: true,
    author: {
      '@type': authorName === 'PropBetEdge Editorial Team' ? 'Organization' : 'Person',
      name: authorName,
      url: `${SITE}/authors/${authorSlug}`,
    },
    publisher: {
      '@type': 'NewsMediaOrganization',
      '@id': `${SITE}/#organization`,
      name: 'PropBetEdge',
      url: SITE,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE}/logo/pbe-full-400.png`,
      },
    },
  };

  if (article.image_url) {
    schema.image = {
      '@type': 'ImageObject',
      url: article.image_url,
      contentUrl: article.image_url,
      caption: article.title,
    };
  }

  const keywords = [
    SPORT_LABELS[sport],
    article.category,
    ...(article.take?.teams || []),
    ...(article.take?.players || []),
    ...(article.take?.prop_types || []),
  ].filter(Boolean);
  if (keywords.length) schema.keywords = [...new Set(keywords)].join(', ');

  return schema;
}

async function resolveTeamMeta(sport, slug) {
  const api = SPORT_API[sport];
  if (!api) return { notFound: true };
  const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${api.category}/${api.league}/teams?limit=100`);
  if (res.status === 404) return { notFound: true };
  if (!res.ok) return { unavailable: true };
  const data = await res.json();
  const teams = data?.sports?.[0]?.leagues?.[0]?.teams?.map((entry) => entry?.team || entry).filter(Boolean) || [];
  const target = slugify(slug);
  const team = teams.find((candidate) => {
    const names = [
      candidate.displayName,
      candidate.shortDisplayName,
      candidate.name,
      candidate.abbreviation,
    ].filter(Boolean).map(slugify);
    return names.includes(target);
  });
  if (!team) return { notFound: true };
  return {
    name: team.displayName || team.shortDisplayName || titleFromSlug(slug),
    image: team.logos?.[0]?.href || null,
  };
}

async function resolvePlayerMeta(sport, id) {
  if (!/^\d+$/.test(String(id))) return { notFound: true };

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

function buildServerArticleHtml(article, sport, canonical) {
  const title = escapeHtml(article.title || `${SPORT_LABELS[sport]} News`);
  const summary = escapeHtml(article.summary || article.take?.summary || '');
  const author = escapeHtml(article.author || 'PropBetEdge Editorial Team');
  const authorSlug = String(article.author || 'PropBetEdge Editorial Team')
    .toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
  const published = article.published_at ? String(article.published_at) : '';
  const body = articlePlainText(article).slice(0, 30000);
  const paragraphs = body
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 80)
    .map((part) => `<p>${escapeHtml(part)}</p>`)
    .join('');

  return `<article class="pbe-ssr-article" data-server-rendered="1">
    <nav aria-label="Breadcrumb"><a href="/">PropBetEdge</a> &rsaquo; <a href="/news/${sport}">${SPORT_LABELS[sport]} News</a></nav>
    <header>
      <h1>${title}</h1>
      <p>By <a href="/authors/${escapeAttr(authorSlug)}">${author}</a>${published ? ` · <time datetime="${escapeAttr(published)}">${escapeHtml(formatServerDate(published))}</time>` : ''}</p>
      ${summary ? `<p>${summary}</p>` : ''}
      ${article.image_url ? `<img src="${escapeAttr(article.image_url)}" alt="${title}" width="1200" loading="eager" />` : ''}
    </header>
    <section>${paragraphs || (summary ? `<p>${summary}</p>` : '')}</section>
    <footer>
      <a href="${escapeAttr(canonical)}">Permalink</a>
      ${safeHttpUrl(article.source_url) ? ` · <a href="${escapeAttr(article.source_url)}" rel="nofollow noopener">Original source</a>` : ''}
    </footer>
  </article>`;
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
