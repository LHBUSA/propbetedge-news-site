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
 *   - if the edge service fails or times out, results come from the local
 *     static index (destinations + teams) and navigation keeps working; the
 *     network is not retried for a short cool-down so a dead endpoint does not
 *     tax every keystroke
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
  cooldownMs = 30_000,
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

    abortInflight();
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    inflight = controller;
    const started = now();
    let timedOut = false;
    const timer = setTimer(() => { timedOut = true; try { controller?.abort(); } catch { /* ignore */ } }, timeoutMs);

    try {
      const url = `${String(apiBase).replace(/\/+$/, '')}/v1/search?q=${encodeURIComponent(normalized)}&limit=${limit}`;
      const res = await fetchImpl(url, { signal: controller?.signal, credentials: 'omit', headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`search_http_${res.status}`);
      const body = await res.json();
      if (!body || !Array.isArray(body.results)) throw new Error('search_bad_payload');
      if (mySeq !== seq) return; // a newer query owns the screen
      lruSet(normalized, body.results);
      emit({ seq: mySeq, query: rawQuery, normalized, status: 'ready', results: body.results, source: 'edge', latencyMs: now() - started });
    } catch (error) {
      if (mySeq !== seq) return; // superseded (including our own abort)
      if (error?.name === 'AbortError' && !timedOut) return;
      downUntil = now() + cooldownMs;
      emit({ seq: mySeq, query: rawQuery, normalized, status: 'fallback', results: local, source: 'local', latencyMs: now() - started, error: String(error?.message || error) });
    } finally {
      clearTimer(timer);
      if (inflight === controller) inflight = null;
    }
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
