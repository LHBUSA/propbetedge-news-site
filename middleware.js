/**
 * Vercel Edge Middleware
 *
 * Runs at the edge BEFORE serving index.html. Looks at the URL pattern
 * and rewrites <link rel="canonical">, <title>, <meta property="og:*">
 * and <meta name="robots"> in the HTML response so first-pass crawlers
 * (Googlebot pre-render) see the correct per-page metadata.
 *
 * v2 changes:
 *   ✅ Pagination canonicals — pages 2+ canonical to page 1, robots noindex
 *   ✅ Same for /news/page/N and /news/:sport/page/N
 */

import { next } from '@vercel/edge';

export const config = {
  matcher: [
    '/((?!api|_next|_vercel|favicon|logo|src|public|assets|manifest|sitemap|news-sitemap|robots|.*\\..*).*)',
  ],
};

const SITE = 'https://propbetedge.ai';
const NEWS_API = 'https://propbet-news-api.sales-fd3.workers.dev';

const SPORT_LABELS = { mlb: 'MLB', nfl: 'NFL', nba: 'NBA', nhl: 'NHL' };

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

  return new Response(html, {
    status: response.status,
    headers: {
      ...Object.fromEntries(response.headers.entries()),
      'content-type': 'text/html; charset=utf-8',
    },
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

  // 🆕 News index — paginated (page 2+) → canonical to page 1, noindex
  const newsPagedMatch = pathname.match(/^\/news\/page\/(\d+)$/);
  if (newsPagedMatch) {
    const page = parseInt(newsPagedMatch[1], 10);
    return {
      canonical: `${SITE}/news`,
      title: `Latest Sports News (Page ${page}) — PropBetEdge`,
      description: 'Breaking sports news with AI prop-bet impact analysis across MLB, NFL, NBA, and NHL.',
      image: `${SITE}/logo/pbe-full-600.png`,
      robots: 'noindex, follow',
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

  // 🆕 Sport pages — paginated (page 2+) → canonical to page 1, noindex
  const sportPagedMatch = pathname.match(/^\/news\/(mlb|nfl|nba|nhl)\/page\/(\d+)$/);
  if (sportPagedMatch) {
    const sport = sportPagedMatch[1];
    const page = parseInt(sportPagedMatch[2], 10);
    const label = SPORT_LABELS[sport];
    return {
      canonical: `${SITE}/news/${sport}`,
      title: `${label} News (Page ${page}) — PropBetEdge`,
      description: `Latest ${label} news with AI prop-bet impact analysis.`,
      image: `${SITE}/logo/pbe-full-600.png`,
      robots: 'noindex, follow',
    };
  }

  // Individual articles — fetch from API to get real title/description/image
  const articleMatch = pathname.match(/^\/news\/(mlb|nfl|nba|nhl)\/([^\/]+)$/);
  if (articleMatch) {
    const sport = articleMatch[1];
    const slug = articleMatch[2];
    try {
      const res = await fetch(`${NEWS_API}/news/article/${slug}`, {
        cf: { cacheTtl: 300 },
      });
      if (res.ok) {
        const data = await res.json();
        const article = data.article;
        if (article) {
          return {
            canonical: `${SITE}/news/${sport}/${slug}`,
            title: `${article.title} — PropBetEdge`,
            description: article.take?.summary || article.summary || `Latest ${SPORT_LABELS[sport]} news.`,
            image: article.image_url || `${SITE}/logo/pbe-full-600.png`,
            type: 'article',
          };
        }
      }
    } catch (e) {
      // fall through
    }
    return {
      canonical: `${SITE}/news/${sport}/${slug}`,
      title: `${SPORT_LABELS[sport]} News — PropBetEdge`,
      description: `Latest ${SPORT_LABELS[sport]} news with AI prop-bet impact analysis.`,
      image: `${SITE}/logo/pbe-full-600.png`,
      type: 'article',
    };
  }

  // Author pages
  const authorMatch = pathname.match(/^\/authors?\/([a-z0-9-]+)$/);
  if (authorMatch) {
    const slug = authorMatch[1];
    const name = slug.split('-').map((s) => s[0].toUpperCase() + s.slice(1)).join(' ');
    return {
      canonical: `${SITE}${pathname}`,
      title: `${name} — PropBetEdge`,
      description: `Articles by ${name} on PropBetEdge.`,
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

  // 🆕 Inject robots meta if specified (e.g. for paginated pages)
  if (meta.robots) {
    if (/<meta\s+name="robots"[^>]*>/i.test(html)) {
      html = html.replace(
        /<meta\s+name="robots"[^>]*>/i,
        `<meta name="robots" content="${escapeAttr(meta.robots)}" />`
      );
    } else {
      html = html.replace(
        /<\/head>/i,
        `  <meta name="robots" content="${escapeAttr(meta.robots)}" />\n</head>`
      );
    }
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
