/**
 * src/route-integrity.js
 *
 * Two guarantees for the client-rendered routes (owner P0 2026-10-04: an open tab showed the retired
 * "Go deeper than the article." footer CTA under an article whose server HTML no longer had it):
 *
 * 1. A route render can never write into a later route. Every page renderer is async: it paints a skeleton,
 *    awaits data, then assigns root.innerHTML. If the visitor navigates while that await is pending, the late
 *    assignment used to land in the shared #app and resurrect the previous route's markup. freshRouteRoot()
 *    swaps #app for a new element on every route, so a stale renderer only writes into a detached node, and
 *    renderers check isLiveRoot(root) before touching document-level slots.
 *
 * 2. An open tab does not keep running a retired bundle. In-app navigation reuses the JS that was loaded when
 *    the tab opened, so markup removed by a later deployment keeps rendering in that tab indefinitely. The
 *    watcher compares this page's entry script with the one /index.html currently ships (revalidated, never
 *    cached: max-age=0, must-revalidate) and, once they differ, the next navigation is a full page load.
 */

const ENTRY_RE = /<script[^>]+type="module"[^>]+src="(\/assets\/index-[^"]+\.js)"/;
const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const MIN_GAP_MS = 60 * 1000;

/** Entry script path from an index.html document, or null. */
export function parseEntryScript(html) {
  const m = ENTRY_RE.exec(String(html || ''));
  return m ? m[1] : null;
}

/** True only when both entries are known and differ (unknown never forces a reload). */
export function isDeploymentStale(current, latest) {
  return Boolean(current && latest && current !== latest);
}

/** Replace #app with an empty twin so pending renders of the previous route write into a detached node. */
export function freshRouteRoot(doc = document) {
  const old = doc.getElementById('app');
  const next = doc.createElement('div');
  next.id = 'app';
  if (old) {
    if (old.className) next.className = old.className;
    old.removeAttribute('id');
    old.replaceWith(next);
  } else {
    doc.body.appendChild(next);
  }
  return next;
}

/** A renderer's root is still the visible route. */
export function isLiveRoot(root) {
  return Boolean(root && root.isConnected);
}

let currentEntry = null;
let stale = false;
let lastCheck = 0;
let inflight = null;

export function deploymentIsStale() {
  return stale;
}

export async function checkDeployment({ force = false } = {}) {
  if (stale || !currentEntry) return stale;
  const now = Date.now();
  if (!force && now - lastCheck < MIN_GAP_MS) return stale;
  if (inflight) return inflight;
  lastCheck = now;
  inflight = fetch('/index.html', { cache: 'no-store', credentials: 'same-origin' })
    .then((r) => (r.ok ? r.text() : ''))
    .then((html) => { stale = isDeploymentStale(currentEntry, parseEntryScript(html)); return stale; })
    .catch(() => stale)
    .finally(() => { inflight = null; });
  return inflight;
}

export function initDeploymentWatch() {
  const own = document.querySelector('script[type="module"][src*="/assets/index-"]');
  currentEntry = own ? new URL(own.getAttribute('src'), window.location.origin).pathname : null;
  if (!currentEntry) return; // dev server / unknown shell: never force reloads
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkDeployment(); });
  window.setInterval(() => { if (document.visibilityState === 'visible') checkDeployment(); }, CHECK_INTERVAL_MS);
}
