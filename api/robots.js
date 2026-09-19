export default function handler(req, res) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');

  return res.status(200).send([
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    '',
    'User-agent: Googlebot-News',
    'Allow: /news/',
    'Disallow: /api/',
    '',
    'Sitemap: https://propbetedge.ai/sitemap.xml',
    'Sitemap: https://propbetedge.ai/news-sitemap.xml',
    '',
  ].join('\n'));
}
