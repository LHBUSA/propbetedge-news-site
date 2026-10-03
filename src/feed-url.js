// Same-origin PropSports feed gateway (api/feed.js). Browser data never goes straight to a provider host.
export function feedUrl(feed, params = {}) {
  const qs = new URLSearchParams({ feed });
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) qs.set(k, String(v));
  return `/api/feed?${qs}`;
}
