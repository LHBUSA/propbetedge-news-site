/**
 * src/search/client.js — the palette's query engine, DOM-free so node tests
 * can drive it with a fake fetch and a fake clock.
 *
 * Guarantees:
 *   - debounced (default 110ms) and starts at MIN_QUERY_LENGTH characters
 *   - every new query aborts the previous request (AbortController)
 *   - a monotonically increasing sequence number is captured per query; a
 *     response whose sequence is not the latest is dropped, so an older, slow
 *     answer can never overwrite a newer query
 *   - small in-memory LRU of recent answers
 *   - a timed-out request is retried once (a cold edge isolate can be slow);
 *     a timeout alone never blinds search to the edge
 *   - only a hard failure (network error or 5xx) starts a short cool-down
 *     (8s) during which queries answer from the local static index
 *     (destinations + teams); the first distinct query after the cool-down
 *     goes back to the edge
 *   - while the edge is unavailable, local results keep navigation working
 */

import { searchDocs, toResult, normalizeQuery, MIN_QUERY_LENGTH } from './rank.js';

export const DEFAULT_SEARCH_API = 'https://pbe-entity-hub.sales-fd3.workers.dev';

export function latencyBucket(ms) {
  if (!Number.isFinite(ms)) return 'unknown';
  if (ms < 100) return '<100ms';
  if (ms < 300) return '100-300ms';
  if (ms < 1000) return '300-1000ms';
  return '>1s';
}

export function createSearchController({
  apiBase = DEFAULT_SEARCH_API,
  fetchImpl = (...args) => fetch(...args),
  localDocs = () => [],
  onState = () => {},
  debounceMs = 110,
  timeoutMs = 3500,
  retryTimeoutMs = 5000,
  cooldownMs = 8_000,
  limit = 20,
  lruSize = 40,
  now = () => Date.now(),
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (id) => clearTimeout(id),
} = {}) {
  let seq = 0;
  let debounceId = null;
  let inflight = null;
  let downUntil = 0;
  const lru = new Map();

  function lruGet(key) {
    if (!lru.has(key)) return null;
    const value = lru.get(key);
    lru.delete(key);
    lru.set(key, value);
    return value;
  }

  function lruSet(key, value) {
    lru.set(key, value);
    while (lru.size > lruSize) lru.delete(lru.keys().next().value);
  }

  function localResults(normalized) {
    return searchDocs(localDocs(), normalized, { limit: Math.min(limit, 12), now: now() }).map(toResult);
  }

  function emit(state) {
    onState(state);
  }

  function abortInflight() {
    if (inflight) {
      try { inflight.abort(); } catch { /* ignore */ }
      inflight = null;
    }
  }

  /** Run a query immediately (no debounce). Resolves when its state is final. */
  async function run(rawQuery) {
    const mySeq = ++seq;
    const normalized = normalizeQuery(rawQuery);
    if (normalized.length < MIN_QUERY_LENGTH) {
      abortInflight();
      emit({ seq: mySeq, query: rawQuery, normalized, status: 'idle', results: [], source: 'none' });
      return;
    }

    const cached = lruGet(normalized);
    if (cached) {
      abortInflight();
      emit({ seq: mySeq, query: rawQuery, normalized, status: 'ready', results: cached, source: 'cache', latencyMs: 0 });
      return;
    }

    const local = localResults(normalized);
    if (now() < downUntil) {
      abortInflight();
      emit({ seq: mySeq, query: rawQuery, normalized, status: 'fallback', results: local, source: 'local', latencyMs: 0 });
      return;
    }

    // Instant, honest first paint from the static index while the edge answers.
    emit({ seq: mySeq, query: rawQuery, normalized, status: 'loading', results: local, source: 'local' });

    const started = now();
    const url = `${String(apiBase).replace(/\/+$/, '')}/v1/search?q=${encodeURIComponent(normalized)}&limit=${limit}`;
    let lastError = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      abortInflight();
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      inflight = controller;
      let timedOut = false;
      const timer = setTimer(() => { timedOut = true; try { controller?.abort(); } catch { /* ignore */ } }, attempt ? retryTimeoutMs : timeoutMs);
      try {
        const res = await fetchImpl(url, { signal: controller?.signal, credentials: 'omit', headers: { Accept: 'application/json' } });
        if (!res.ok) {
          const err = new Error(`search_http_${res.status}`);
          err.status = res.status;
          throw err;
        }
        const body = await res.json();
        if (!body || !Array.isArray(body.results)) throw new Error('search_bad_payload');
        if (mySeq !== seq) return; // a newer query owns the screen
        // A cold-isolate answer without the story archive is shown but not
        // remembered, so the next identical query asks again.
        if (!body.partial) lruSet(normalized, body.results);
        emit({ seq: mySeq, query: rawQuery, normalized, status: 'ready', results: body.results, source: 'edge', latencyMs: now() - started, attempts: attempt + 1 });
        return;
      } catch (error) {
        if (mySeq !== seq) return; // superseded (including our own abort)
        if (error?.name === 'AbortError' && !timedOut) return;
        lastError = timedOut ? Object.assign(new Error('search_timeout'), { timeout: true }) : error;
        // Retry once, and only after a timeout: a slow cold start is not an outage.
        if (!timedOut) break;
      } finally {
        clearTimer(timer);
        if (inflight === controller) inflight = null;
      }
    }

    if (mySeq !== seq) return;
    // Cool-down only on a hard failure: network error or 5xx. Timeouts and 4xx
    // (e.g. a hub without the route yet) fall back for this query only.
    const status = Number(lastError?.status) || 0;
    const hard = !lastError?.timeout && (status >= 500 || !status);
    if (hard) downUntil = now() + cooldownMs;
    emit({ seq: mySeq, query: rawQuery, normalized, status: 'fallback', results: local, source: 'local', latencyMs: now() - started, error: String(lastError?.message || lastError), cooldown: hard });
  }

  /** Debounced entry point for keystrokes. */
  function setQuery(rawQuery) {
    if (debounceId !== null) clearTimer(debounceId);
    const normalized = normalizeQuery(rawQuery);
    if (normalized.length < MIN_QUERY_LENGTH) {
      debounceId = null;
      return run(rawQuery);
    }
    return new Promise((resolve) => {
      debounceId = setTimer(() => {
        debounceId = null;
        resolve(run(rawQuery));
      }, debounceMs);
    });
  }

  function reset() {
    if (debounceId !== null) clearTimer(debounceId);
    debounceId = null;
    abortInflight();
    seq += 1;
  }

  return {
    run,
    setQuery,
    reset,
    get sequence() { return seq; },
    get serviceDown() { return now() < downUntil; },
  };
}
