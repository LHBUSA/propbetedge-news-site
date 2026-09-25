/**
 * PropBetEdge Search — the network-wide search palette.
 *
 * Results come from the edge search service (pbe-entity-hub /v1/search), which
 * ranks players, fighters, teams, UFC events and bouts, intelligence tools and
 * the full newsroom archive. The browser never downloads an index. If the
 * service is unreachable, a small static index (verified destinations + every
 * team) answers locally, so navigation always works.
 *
 * Configure the endpoint with VITE_PBE_SEARCH_API at build time, or
 * window.PBE_SEARCH_API at runtime.
 */

import { groupResults, normalizeQuery, MIN_QUERY_LENGTH } from './search/rank.js';
import { TOOL_DOCS, EMPTY_STATE, SPORT_LABEL, dictionaryTeamDocs, wnbaTeamDocs } from './search/destinations.js';
import { createSearchController, latencyBucket, DEFAULT_SEARCH_API } from './search/client.js';
import { TEAMS } from './entity-graph/dictionary.js';

const LISTBOX_ID = 'pbe-search-listbox';
const TITLE_ID = 'pbe-search-title';

let installed = false;
let overlay = null;
let input = null;
let list = null;
let status = null;
let controller = null;
let options = [];          // flat, in display order
let selectedIndex = 0;
let lastFocused = null;
let lastTracked = '';
let localIndex = null;

const SPORT_GLYPH = { mlb: '⚾', nfl: '🏈', nba: '🏀', wnba: '🏀', nhl: '🏒', ufc: '🥊' };
const TYPE_GLYPH = { player: '◉', team: '◆', event: '✪', tool: '⚡', learn: '◈', story: '✦' };

function searchApiBase() {
  if (typeof window !== 'undefined' && typeof window.PBE_SEARCH_API === 'string' && window.PBE_SEARCH_API) {
    return window.PBE_SEARCH_API;
  }
  const fromEnv = import.meta.env?.VITE_PBE_SEARCH_API;
  return fromEnv || DEFAULT_SEARCH_API;
}

function localDocs() {
  if (!localIndex) localIndex = [...TOOL_DOCS, ...dictionaryTeamDocs(TEAMS), ...wnbaTeamDocs()];
  return localIndex;
}

export function initSearchPalette() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  document.addEventListener('click', handleDocumentClick, true);
  document.addEventListener('keydown', handleGlobalKeydown, true);
  window.addEventListener('pbe:open-search', openSearch);
}

function handleDocumentClick(event) {
  const trigger = event.target?.closest?.('[data-pbe-search-open]');
  if (trigger) {
    event.preventDefault();
    openSearch();
  }
}

function isOpen() {
  return Boolean(overlay?.classList.contains('is-open'));
}

function handleGlobalKeydown(event) {
  if (isOpen()) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeSearch();
      return;
    }
    if (event.key === 'Tab') {
      trapFocus(event);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveSelection(event.key === 'ArrowDown' ? 1 : -1);
      if (document.activeElement !== input) input.focus({ preventScroll: true });
      return;
    }
    if (event.key === 'Enter' && document.activeElement === input) {
      event.preventDefault();
      activate(selectedIndex, { newTab: event.metaKey || event.ctrlKey });
    }
    return;
  }

  const target = event.target;
  const editing = target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
    || target?.isContentEditable;
  if (editing) return;

  const commandK = (event.metaKey || event.ctrlKey) && String(event.key).toLowerCase() === 'k';
  const slash = event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey;
  if (commandK || slash) {
    event.preventDefault();
    openSearch();
  }
}

function ensurePalette() {
  if (overlay) return;
  overlay = document.createElement('div');
  overlay.className = 'pbe-search-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = `
    <div class="pbe-search-backdrop" data-pbe-search-close></div>
    <section class="pbe-search-dialog" role="dialog" aria-modal="true" aria-labelledby="${TITLE_ID}">
      <div class="pbe-search-topline">
        <div class="pbe-search-brand">
          <span aria-hidden="true">⚡</span>
          <span class="pbe-search-brand-copy"><strong id="${TITLE_ID}">PropBetEdge Search</strong><small>Across every sport and intelligence product</small></span>
        </div>
        <button type="button" class="pbe-search-close" data-pbe-search-close aria-label="Close search">ESC</button>
      </div>
      <div class="pbe-search-input-wrap">
        <span class="pbe-search-icon" aria-hidden="true">⌕</span>
        <input type="search" role="combobox" autocomplete="off" autocapitalize="off" spellcheck="false"
          aria-autocomplete="list" aria-expanded="true" aria-controls="${LISTBOX_ID}" aria-haspopup="listbox"
          aria-label="Search PropBetEdge"
          placeholder="Search players, teams, fights, stories and intelligence…" />
        <kbd aria-hidden="true">↵</kbd>
      </div>
      <div class="pbe-search-status" role="status" aria-live="polite"></div>
      <div class="pbe-search-results" id="${LISTBOX_ID}" role="listbox" aria-label="Search results"></div>
      <div class="pbe-search-footer" aria-hidden="true">
        <span><kbd>↑</kbd><kbd>↓</kbd> move</span>
        <span><kbd>↵</kbd> open</span>
        <span><kbd>esc</kbd> close</span>
        <span class="pbe-search-footer-network">PropBetEdge intelligence network</span>
      </div>
    </section>
  `;
  document.body.appendChild(overlay);
  input = overlay.querySelector('input');
  list = overlay.querySelector('.pbe-search-results');
  status = overlay.querySelector('.pbe-search-status');

  controller = createSearchController({
    apiBase: searchApiBase(),
    localDocs,
    onState: renderState,
  });

  overlay.addEventListener('click', (event) => {
    if (event.target?.closest?.('[data-pbe-search-close]')) {
      closeSearch();
      return;
    }
    const row = event.target?.closest?.('[data-search-index]');
    if (row) {
      event.preventDefault();
      activate(Number(row.dataset.searchIndex) || 0, { newTab: event.metaKey || event.ctrlKey });
    }
  });
  list.addEventListener('mousemove', (event) => {
    const row = event.target?.closest?.('[data-search-index]');
    if (row) {
      const index = Number(row.dataset.searchIndex) || 0;
      if (index !== selectedIndex) selectIndex(index, { scroll: false });
    }
  });
  input.addEventListener('input', () => {
    const value = input.value;
    if (normalizeQuery(value).length < MIN_QUERY_LENGTH) {
      controller.reset();
      renderEmptyState();
      return;
    }
    controller.setQuery(value);
  });
}

function openSearch() {
  ensurePalette();
  if (!isOpen()) lastFocused = document.activeElement;
  overlay.classList.add('is-open');
  overlay.setAttribute('aria-hidden', 'false');
  document.documentElement.classList.add('pbe-search-open');
  controller.reset();
  input.value = '';
  renderEmptyState();
  input.focus({ preventScroll: true });
}

function closeSearch() {
  if (!overlay) return;
  controller?.reset();
  overlay.classList.remove('is-open');
  overlay.setAttribute('aria-hidden', 'true');
  document.documentElement.classList.remove('pbe-search-open');
  const target = lastFocused;
  lastFocused = null;
  if (target instanceof HTMLElement && document.contains(target)) {
    window.setTimeout(() => target.focus({ preventScroll: true }), 0);
  }
}

function trapFocus(event) {
  const dialog = overlay?.querySelector('.pbe-search-dialog');
  if (!dialog) return;
  const focusable = [...dialog.querySelectorAll('button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')]
    .filter((node) => !node.hidden && node.getClientRects().length);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;
  if (!dialog.contains(active)) {
    event.preventDefault();
    first.focus();
  } else if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

// ─── rendering ───────────────────────────────────────────────────────────────

function renderEmptyState() {
  if (!list) return;
  const live = EMPTY_STATE.live.map((d) => ({ ...d, type: 'tool', glyph: SPORT_GLYPH[d.sport] }));
  const popular = EMPTY_STATE.popular.map((d) => ({ ...d, type: 'tool', glyph: d.sport ? SPORT_GLYPH[d.sport] : '⚡' }));
  options = [...live, ...popular];
  let index = 0;
  const chipGroup = (id, label, items) => `
    <div class="pbe-search-group pbe-search-group--chips" role="group" aria-labelledby="${id}">
      <div class="pbe-search-section-label" id="${id}">${escapeHtml(label)}</div>
      <div class="pbe-search-chips" role="presentation">
        ${items.map((item) => renderChip(item, index++)).join('')}
      </div>
    </div>`;
  list.innerHTML = chipGroup('pbe-sg-live', 'Live intelligence', live) + chipGroup('pbe-sg-popular', 'Popular', popular);
  status.textContent = 'Live intelligence: MLB · NFL · NBA · WNBA · NHL · UFC';
  selectIndex(-1);
}

function renderChip(item, index) {
  return `
    <div class="pbe-search-chip${item.sport ? ` is-${item.sport}` : ''}" role="option" id="pbe-opt-${index}" aria-selected="false" data-search-index="${index}">
      <span aria-hidden="true">${item.glyph || '⚡'}</span><strong>${escapeHtml(item.title)}</strong>
    </div>`;
}

function renderState(state) {
  if (!list || !isOpen()) return;
  if (state.status === 'idle') {
    renderEmptyState();
    return;
  }

  const results = state.results || [];
  const groups = groupResults(results);
  options = groups.flatMap((g) => g.items);
  let index = 0;
  const now = Date.now();

  if (!options.length) {
    list.innerHTML = state.status === 'loading'
      ? '<div class="pbe-search-empty" role="presentation"><span>Searching the PropBetEdge network…</span></div>'
      : `<div class="pbe-search-empty" role="presentation"><strong>No match for “${escapeHtml(state.query.trim())}”.</strong><span>Try a player, fighter, team, event, “Fight Simulator”, “PBE Picks”, a concept like “Brier score” or a headline.</span></div>`;
  } else {
    list.innerHTML = groups.map((g) => `
      <div class="pbe-search-group" role="group" aria-labelledby="pbe-sg-${g.key}">
        <div class="pbe-search-section-label" id="pbe-sg-${g.key}">${escapeHtml(g.label)}</div>
        ${g.items.map((r) => renderResult(r, index++, now)).join('')}
      </div>`).join('');
    list.querySelectorAll('img[data-fallback]').forEach((img) => {
      img.addEventListener('error', () => {
        const span = document.createElement('span');
        span.textContent = img.dataset.fallback || '✦';
        img.replaceWith(span);
      }, { once: true });
    });
  }

  if (state.status === 'fallback') {
    status.textContent = 'Live search is unavailable — showing network destinations and teams.';
  } else if (state.status === 'loading') {
    status.textContent = 'Searching players, teams, events, tools and news…';
  } else {
    status.textContent = options.length
      ? `${options.length} result${options.length === 1 ? '' : 's'} across the PropBetEdge network`
      : 'No results';
  }

  selectIndex(options.length ? 0 : -1);
  if (state.status === 'ready' || state.status === 'fallback') trackSearch(state);
}

function renderResult(r, index, now) {
  const glyph = r.sport ? (SPORT_GLYPH[r.sport] || TYPE_GLYPH[r.type]) : TYPE_GLYPH[r.type] || '✦';
  const icon = r.image
    ? `<img src="${escapeAttr(r.image)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-fallback="${escapeAttr(glyph)}" />`
    : `<span>${glyph}</span>`;
  const { kicker, detail } = resultLabel(r, now);
  return `
    <div class="pbe-search-row is-${escapeAttr(r.type)}" role="option" id="pbe-opt-${index}" aria-selected="false" data-search-index="${index}" data-type="${escapeAttr(r.type)}">
      <span class="pbe-search-row-icon${r.type === 'player' && r.image ? ' is-photo' : ''}" aria-hidden="true">${icon}</span>
      <span class="pbe-search-row-copy">
        <strong>${escapeHtml(r.title)}</strong>
        <small><b class="pbe-search-kicker">${escapeHtml(kicker)}</b>${detail ? ` · ${escapeHtml(shorten(detail, 90))}` : ''}</small>
      </span>
      <span class="pbe-search-row-open" aria-hidden="true">${isExternal(r.href) ? '↗' : '→'}</span>
    </div>`;
}

/** The type line under every result — the type is always the first words. */
export function resultLabel(r, now = Date.now()) {
  const S = SPORT_LABEL[r.sport] || (r.sport ? String(r.sport).toUpperCase() : 'PROPBETEDGE');
  switch (r.type) {
    case 'player':
      return { kicker: `${S} ${r.sport === 'ufc' ? 'FIGHTER' : 'PLAYER'}`, detail: r.sport === 'ufc' ? '' : r.subtitle };
    case 'team':
      return { kicker: `${S} TEAM`, detail: '' };
    case 'event': {
      const when = shortDate(r.date, now);
      if (r.kind === 'fight') return { kicker: `${S} FIGHT${when ? ` · ${when}` : ''}`, detail: r.subtitle };
      return { kicker: `${S} EVENT${when ? ` · ${when}` : ''}`, detail: '' };
    }
    case 'tool':
      return { kicker: r.label || r.subtitle || `${S} INTELLIGENCE`, detail: '' };
    case 'learn':
      return { kicker: r.label || 'LEARN', detail: r.subtitle };
    case 'story':
      return { kicker: `${S} NEWS${r.date ? ` · ${timeAgo(r.date, now)}` : ''}`, detail: '' };
    default:
      return { kicker: S, detail: r.subtitle };
  }
}

function selectIndex(index, { scroll = true } = {}) {
  selectedIndex = index;
  const rows = list ? [...list.querySelectorAll('[data-search-index]')] : [];
  rows.forEach((row, i) => {
    const active = i === index;
    row.classList.toggle('is-selected', active);
    row.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  const activeRow = rows[index];
  if (activeRow) {
    input?.setAttribute('aria-activedescendant', activeRow.id);
    if (scroll) activeRow.scrollIntoView({ block: 'nearest' });
  } else {
    input?.removeAttribute('aria-activedescendant');
  }
}

function moveSelection(delta) {
  if (!options.length) return;
  const next = selectedIndex < 0
    ? (delta > 0 ? 0 : options.length - 1)
    : (selectedIndex + delta + options.length) % options.length;
  selectIndex(next);
}

function activate(index, { newTab = false } = {}) {
  const record = options[index < 0 ? 0 : index];
  if (!record?.href) return;
  trackOpen(record, index < 0 ? 0 : index);
  closeSearch();
  const href = record.href.replace(/^https:\/\/(?:www\.)?propbetedge\.ai(?=\/|$)/, '') || '/';
  if (newTab) {
    window.open(href.startsWith('/') ? `${window.location.origin}${href}` : href, '_blank', 'noopener');
    return;
  }
  if (href.startsWith('/')) {
    window.history.pushState({}, '', href);
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.scrollTo?.(0, 0);
  } else {
    window.location.assign(href);
  }
}

// ─── analytics (no user-identifying data: normalized query + counts only) ───

function gtagEvent(name, params) {
  if (typeof window.gtag !== 'function') return;
  window.gtag('event', name, params);
}

function trackSearch(state) {
  const key = `${state.normalized}|${state.source}`;
  if (key === lastTracked) return;
  lastTracked = key;
  gtagEvent('site_search', {
    search_term: String(state.normalized || '').slice(0, 60),
    result_count: (state.results || []).length,
    top_result_type: state.results?.[0]?.type || 'none',
    latency_bucket: state.source === 'cache' ? 'cache' : latencyBucket(state.latencyMs),
    search_source: state.source,
  });
}

function trackOpen(record, index) {
  gtagEvent('site_search_result_open', {
    search_term: normalizeQuery(input?.value || '').slice(0, 60),
    result_type: record.type || '',
    result_sport: record.sport || '',
    result_title: record.title || '',
    result_url: record.href || '',
    result_position: index + 1,
  });
}

// ─── formatting ──────────────────────────────────────────────────────────────

function isExternal(href) {
  return /^https?:\/\//i.test(href || '') && !/^https:\/\/(?:www\.)?propbetedge\.ai(?:\/|$)/i.test(href);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function shortDate(value, now = Date.now()) {
  const t = Date.parse(value || '');
  if (!Number.isFinite(t)) return '';
  const d = new Date(t);
  const sameYear = d.getUTCFullYear() === new Date(now).getUTCFullYear();
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}${sameYear ? '' : `, ${d.getUTCFullYear()}`}`;
}

export function timeAgo(value, now = Date.now()) {
  const t = Date.parse(value || '');
  if (!Number.isFinite(t)) return '';
  const diff = Math.max(0, now - t);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return shortDate(value, now);
}

function shorten(value, max) {
  const text = String(value || '');
  return text.length > max ? `${text.slice(0, max - 1).trim()}…` : text;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function escapeAttr(value) {
  return escapeHtml(value);
}
