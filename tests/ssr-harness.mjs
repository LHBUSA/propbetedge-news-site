/**
 * tests/ssr-harness.mjs
 *
 * Runs the real Edge Middleware against the real index.html and the real news
 * API, so tests inspect exactly the bytes a crawler receives — not a
 * reimplementation of what we hope it receives.
 *
 * The only thing stubbed is the network plumbing Vercel would normally provide:
 *   - a request for the app shell is served from the local index.html
 *   - /api/* requests are dispatched to the local function handlers
 *   - everything else (the news API, ESPN, MLB, NHL) goes to the live source
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://propbetedge.ai';

const INDEX_HTML = readFileSync(resolve(ROOT, 'index.html'), 'utf8');

let middlewarePromise = null;
let gameLookupPromise = null;

function loadMiddleware() {
  if (!middlewarePromise) middlewarePromise = import('../middleware.js');
  return middlewarePromise;
}

function loadGameLookup() {
  if (!gameLookupPromise) gameLookupPromise = import('../api/game-lookup.js');
  return gameLookupPromise;
}

const realFetch = globalThis.fetch;

/** Minimal Node-function shim so api/*.js handlers can answer inside a fetch. */
async function callNodeHandler(handler, url) {
  const query = Object.fromEntries(new URL(url).searchParams.entries());
  let statusCode = 200;
  const headers = new Headers();
  let body = '';

  const res = {
    setHeader(name, value) { headers.set(name, String(value)); },
    status(code) { statusCode = code; return res; },
    json(payload) { body = JSON.stringify(payload); headers.set('content-type', 'application/json'); return res; },
    send(payload) { body = String(payload); return res; },
    end(payload) { if (payload) body = String(payload); return res; },
  };

  await handler({ method: 'GET', query, url }, res);
  return new Response(body, { status: statusCode, headers });
}

export function installHarnessFetch() {
  globalThis.fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const url = new URL(request.url);

    if (url.origin === SITE) {
      if (url.pathname === '/api/game-lookup') {
        const { default: handler } = await loadGameLookup();
        return callNodeHandler(handler, request.url);
      }
      if (url.pathname.startsWith('/api/')) {
        // Other app endpoints are not exercised by the SSR path under test.
        return new Response(JSON.stringify({ ok: false, error: 'not_stubbed' }), {
          status: 503,
          headers: { 'content-type': 'application/json' },
        });
      }
      // The app shell Vercel would have served.
      return new Response(INDEX_HTML, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }

    return realFetch(request);
  };
}

export function restoreFetch() {
  globalThis.fetch = realFetch;
}

/** Fetch one page exactly as the edge would return it. */
export async function renderPage(path) {
  installHarnessFetch();
  try {
    const { default: middleware } = await loadMiddleware();
    const response = await middleware(new Request(`${SITE}${path}`));
    const contentType = response.headers.get('content-type') || '';
    const html = contentType.includes('text/html') ? await response.text() : '';
    return { status: response.status, headers: response.headers, html };
  } finally {
    restoreFetch();
  }
}

export async function fetchNews(path) {
  const res = await realFetch(`https://propbet-news-api.sales-fd3.workers.dev${path}`, {
    headers: { Accept: 'application/json', Origin: SITE, Referer: `${SITE}/news` },
  });
  if (!res.ok) throw new Error(`news api ${res.status} ${path}`);
  return res.json();
}

export { SITE };
