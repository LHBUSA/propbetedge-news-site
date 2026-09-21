/*
 * NFL native-link safety.
 *
 * This file used to hijack generic PropBetEdge house ads and footer inventory
 * for an "NFL next launch" campaign. NFL is live now, and generic inventory is
 * destination-aware in ads-config.js, so this layer only prevents NFL pages
 * from leaking into MLB-only tools.
 */

const NFL_PROP_BOARD = 'https://nfl.propbetedge.ai/#propboard';
const NFL_MODEL_LAB = 'https://nfl.propbetedge.ai/#picks';

let timer = null;
let observer = null;

export function initNflLaunchPriority() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  schedule();
  window.addEventListener('popstate', schedule);

  observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(sync, 60);
}

function sync() {
  if (sportFromPath(window.location.pathname) === 'nfl') syncNflNativeCtas();
}

function syncNflNativeCtas() {
  document.querySelectorAll('a').forEach((link) => {
    const href = String(link.getAttribute('href') || '');
    const label = String(link.textContent || '').trim();
    const isAlgoLink = /askalgo/i.test(href) || /ask\s+the\s+algo/i.test(label);

    if (isAlgoLink) {
      link.href = NFL_PROP_BOARD;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = 'See Live Prop Board';
      link.dataset.pbeNflNativeCta = 'propboard';
      return;
    }

    if (/NFL\s+Picks\s+This\s+Week/i.test(label)) {
      link.href = NFL_MODEL_LAB;
      link.target = '_blank';
      link.rel = 'noopener';
      link.dataset.pbeNflNativeCta = 'modellab';
    }
  });
}

function sportFromPath(pathname) {
  const match = String(pathname || '').match(/\/(?:news|games|leaders|team|standings|player)\/(mlb|nfl|nba|nhl)(?:\/|$)/i);
  return match?.[1]?.toLowerCase() || null;
}
