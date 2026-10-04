/**
 * PropBetEdge automated-access policy.
 *
 * Search discovery is intentionally allowed. Model-development crawlers named
 * in our Terms/robots policy are denied at the HTML edge. Common scraping and
 * headless-browser signatures are observed only; they are not blocked here
 * because user-agent strings are spoofable and some legitimate tooling uses
 * them. Stateful throttling belongs in the platform firewall.
 */

export const SEARCH_DISCOVERY_CRAWLERS = Object.freeze([
  'Googlebot',
  'Googlebot-News',
  'Bingbot',
  'OAI-SearchBot',
  'Claude-SearchBot',
]);

export const DENIED_MODEL_CRAWLERS = Object.freeze([
  'GPTBot',
  'ClaudeBot',
  'CCBot',
  'Bytespider',
  'meta-externalagent',
  'Applebot-Extended',
  // Google-Extended is primarily a robots product token rather than a normal
  // browser UA, but keep it here defensively if it is ever presented as one.
  'Google-Extended',
]);

export const OBSERVED_AUTOMATION_SIGNATURES = Object.freeze([
  'HeadlessChrome',
  'Playwright',
  'Puppeteer',
  'Selenium',
  'Scrapy',
  'python-requests',
  'aiohttp',
  'curl/',
  'Wget/',
  'Go-http-client',
  'node-fetch',
  'undici',
]);

function findToken(userAgent, tokens) {
  const haystack = String(userAgent || '').toLowerCase();
  return tokens.find((token) => haystack.includes(token.toLowerCase())) || null;
}

export function classifyAutomatedAccess(userAgent = '') {
  const denied = findToken(userAgent, DENIED_MODEL_CRAWLERS);
  if (denied) return { action: 'deny', category: 'model_development', matched: denied };

  const search = findToken(userAgent, SEARCH_DISCOVERY_CRAWLERS);
  if (search) return { action: 'allow', category: 'search_discovery', matched: search };

  const observed = findToken(userAgent, OBSERVED_AUTOMATION_SIGNATURES);
  if (observed) return { action: 'observe', category: 'automation_signature', matched: observed };

  return { action: 'allow', category: 'ordinary', matched: null };
}
