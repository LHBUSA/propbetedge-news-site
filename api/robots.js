export default function handler(req, res) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');

  return res.status(200).send([
    // Default: public pages are crawlable for legitimate discovery. APIs stay out.
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    '',
    // Search and news discovery. These remain allowed.
    'User-agent: Googlebot',
    'Allow: /',
    'Disallow: /api/',
    '',
    'User-agent: Googlebot-News',
    'Allow: /news/',
    'Disallow: /api/',
    '',
    'User-agent: Bingbot',
    'Allow: /',
    'Disallow: /api/',
    '',
    'User-agent: OAI-SearchBot',
    'Allow: /',
    'Disallow: /api/',
    '',
    'User-agent: Claude-SearchBot',
    'Allow: /',
    'Disallow: /api/',
    '',
    // Model-training / bulk-model-development crawlers are not authorized.
    // Search discovery is intentionally controlled separately above.
    'User-agent: GPTBot',
    'Disallow: /',
    '',
    'User-agent: ClaudeBot',
    'Disallow: /',
    '',
    'User-agent: Google-Extended',
    'Disallow: /',
    '',
    'User-agent: CCBot',
    'Disallow: /',
    '',
    'User-agent: Bytespider',
    'Disallow: /',
    '',
    'User-agent: meta-externalagent',
    'Disallow: /',
    '',
    'User-agent: Applebot-Extended',
    'Disallow: /',
    '',
    'Sitemap: https://propbetedge.ai/sitemap.xml',
    'Sitemap: https://propbetedge.ai/news-sitemap.xml',
    '',
  ].join('\n'));
}
