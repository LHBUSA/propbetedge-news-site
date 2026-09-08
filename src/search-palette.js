import { api } from './api.js';
import { SPORT_CONFIG, slugifyEntity } from './sport-config.js';

const MAX_RESULTS = 12;
const TEAM_CACHE_TTL = 30 * 60 * 1000;
let installed = false;
let overlay = null;
let input = null;
let list = null;
let status = null;
let records = [];
let selectedIndex = 0;
let indexPromise = null;
let teamCacheAt = 0;
let lastFocused = null;

const LIVE_PRODUCTS = Object.freeze([
  Object.freeze({
    type: 'product',
    sport: 'mlb',
    eyebrow: '⚾ MLB · LIVE INTELLIGENCE',
    title: 'MLB Intelligence',
    subtitle: 'Live game context, player research, props, model analysis and picks',
    href: 'https://mlb.propbetedge.ai',
    domain: 'mlb.propbetedge.ai',
    external: true,
    keywords: ['mlb', 'baseball', 'live intelligence', 'model', 'props', 'picks', 'player research', 'market'],
  }),
  Object.freeze({
    type: 'product',
    sport: 'nfl',
    eyebrow: '🏈 NFL · LIVE INTELLIGENCE',
    title: 'NFL Intelligence',
    subtitle: 'Market Board, Model Lab, line simulation, matchup and live game intelligence',
    href: 'https://nfl.propbetedge.ai',
    domain: 'nfl.propbetedge.ai',
    external: true,
    keywords: ['nfl', 'football', 'live intelligence', 'market board', 'model lab', 'simulation', 'props', 'matchups'],
  }),
  Object.freeze({
    type: 'product',
    sport: 'ufc',
    eyebrow: '🥊 UFC · LIVE INTELLIGENCE',
    title: 'UFC Intelligence',
    subtitle: 'Fight DNA, matchup research, rankings, cards and fight-week intelligence',
    href: 'https://ufc.propbetedge.ai',
    domain: 'ufc.propbetedge.ai',
    external: true,
    keywords: ['ufc', 'mma', 'fight', 'fighter', 'fight dna', 'rankings', 'cards', 'live intelligence', 'matchup'],
  }),
]);

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

function handleGlobalKeydown(event) {
  if (overlay?.classList.contains('is-open')) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeSearch();
      return;
    }
    if (event.key === 'Tab') {
      trapFocus(event);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveSelection(1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveSelection(-1);
      return;
    }
    if (event.key === 'Enter' && document.activeElement === input) {
      event.preventDefault();
      activateSelected();
    }
    return;
  }

  const target = event.target;
  const editing = target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target?.isContentEditable;
  if (editing) return;

  const commandK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
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
    <section class="pbe-search-dialog" role="dialog" aria-modal="true" aria-label="Search PropBetEdge">
      <div class="pbe-search-topline">
        <div class="pbe-search-brand">
          <span>⚡</span>
          <span class="pbe-search-brand-copy"><strong>PBE NETWORK SEARCH</strong><small>News · teams · live intelligence</small></span>
        </div>
        <button type="button" class="pbe-search-close" data-pbe-search-close aria-label="Close search">ESC</button>
      </div>
      ${renderNetworkShortcuts()}
      <label class="pbe-search-input-wrap">
        <span class="pbe-search-icon">⌕</span>
        <input type="search" autocomplete="off" spellcheck="false" placeholder="Search Mahomes, UFC, injuries, standings, teams, headlines…" aria-label="Search PropBetEdge" />
        <kbd>↵</kbd>
      </label>
      <div class="pbe-search-prompts" aria-label="Suggested searches">
        <span>Try</span>
        <button type="button" data-search-query="NFL">NFL</button>
        <button type="button" data-search-query="UFC">UFC</button>
        <button type="button" data-search-query="injuries">Injuries</button>
        <button type="button" data-search-query="standings">Standings</button>
      </div>
      <div class="pbe-search-status" aria-live="polite"></div>
      <div class="pbe-search-results" role="listbox"></div>
      <div class="pbe-search-footer">
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

  overlay.addEventListener('click', (event) => {
    if (event.target?.closest?.('[data-pbe-search-close]')) {
      closeSearch();
      return;
    }

    const prompt = event.target?.closest?.('[data-search-query]');
    if (prompt) {
      event.preventDefault();
      input.value = prompt.dataset.searchQuery || '';
      input.focus({ preventScroll: true });
      renderResults();
      return;
    }

    const row = event.target?.closest?.('[data-search-index]');
    if (row) {
      selectedIndex = Number(row.dataset.searchIndex) || 0;
      activateSelected();
    }
  });
  input.addEventListener('input', renderResults);
}

function renderNetworkShortcuts() {
  return `
    <nav class="pbe-search-network" aria-label="Live PropBetEdge intelligence products">
      <span class="pbe-search-network-label"><i></i> LIVE INTELLIGENCE</span>
      <div class="pbe-search-network-links">
        ${LIVE_PRODUCTS.map((product) => `
          <a href="${product.href}" target="_blank" rel="noopener" class="pbe-search-network-link ${product.sport}">
            <span>${iconFor('product', product.sport)}</span>
            <strong>${product.sport.toUpperCase()}</strong>
            <small>Open ↗</small>
          </a>
        `).join('')}
      </div>
    </nav>
  `;
}

async function openSearch() {
  ensurePalette();
  if (!overlay.classList.contains('is-open')) lastFocused = document.activeElement;
  overlay.classList.add('is-open');
  overlay.setAttribute('aria-hidden', 'false');
  document.documentElement.classList.add('pbe-search-open');
  selectedIndex = 0;
  input.value = '';
  input.focus({ preventScroll: true });
  renderQuickLinks();

  status.textContent = 'Loading the PBE intelligence index…';
  try {
    await buildIndex();
    if (!overlay.classList.contains('is-open')) return;
    status.textContent = `${records.length} live destinations indexed across the PBE network`;
    renderResults();
  } catch {
    status.textContent = 'Live search index partially unavailable — core destinations still work.';
    renderResults();
  }
}

function closeSearch() {
  if (!overlay) return;
  overlay.classList.remove('is-open');
  overlay.setAttribute('aria-hidden', 'true');
  document.documentElement.classList.remove('pbe-search-open');
  if (lastFocused instanceof HTMLElement && document.contains(lastFocused)) {
    window.setTimeout(() => lastFocused.focus({ preventScroll: true }), 0);
  }
}

function trapFocus(event) {
  const dialog = overlay?.querySelector('.pbe-search-dialog');
  if (!dialog) return;
  const focusable = [...dialog.querySelectorAll('button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')]
    .filter((node) => !node.hidden && node.getClientRects().length);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

async function buildIndex() {
  if (indexPromise && Date.now() - teamCacheAt < TEAM_CACHE_TTL) return indexPromise;
  indexPromise = (async () => {
    const staticRecords = buildStaticRecords();
    const [newsResult, ...teamResults] = await Promise.allSettled([
      api.newsAll(100, 1),
      ...Object.values(SPORT_CONFIG).map((config) => loadTeams(config)),
    ]);

    const articles = newsResult.status === 'fulfilled'
      ? (newsResult.value?.articles || []).map(articleRecord)
      : [];
    const teams = teamResults.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
    records = dedupe([...staticRecords, ...teams, ...articles]);
    teamCacheAt = Date.now();
    return records;
  })().finally(() => {
    if (!records.length) indexPromise = null;
  });
  return indexPromise;
}

async function loadTeams(config) {
  const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${config.espnPath}/teams?limit=100`, { credentials: 'omit' });
  if (!response.ok) return [];
  const data = await response.json();
  const teams = (data?.sports || [])
    .flatMap((sport) => sport.leagues || [])
    .flatMap((league) => league.teams || [])
    .map((entry) => entry?.team || entry)
    .filter(Boolean);

  return teams.map((team) => ({
    type: 'team',
    sport: config.key,
    eyebrow: `${config.label} TEAM`,
    title: team.displayName || team.name || team.abbreviation || 'Team',
    subtitle: 'Team intelligence · roster · schedule · connected stories',
    href: `/team/${config.key}/${slugifyEntity(team.displayName || team.name || team.abbreviation)}`,
    image: team.logos?.[0]?.href || team.logo || '',
    keywords: [team.displayName, team.shortDisplayName, team.name, team.location, team.abbreviation, config.label].filter(Boolean),
  }));
}

function articleRecord(article) {
  const config = SPORT_CONFIG[article?.sport] || null;
  const players = article?.take?.players || [];
  const teams = article?.take?.teams || [];
  const props = article?.take?.prop_types || [];
  return {
    type: 'story',
    sport: article?.sport || '',
    eyebrow: `${config?.label || String(article?.sport || '').toUpperCase()} STORY`,
    title: article?.title || 'Story',
    subtitle: article?.summary || article?.take?.summary || formatDate(article?.published_at),
    href: `/news/${article?.sport}/${article?.slug}`,
    image: article?.image_url || '',
    keywords: [article?.title, article?.summary, article?.category, article?.author, ...players, ...teams, ...props].filter(Boolean),
    publishedAt: article?.published_at || '',
  };
}

function buildStaticRecords() {
  const core = [
    ...LIVE_PRODUCTS,
    { type: 'home', eyebrow: 'PROPBETEDGE', title: 'PropBetEdge Home', subtitle: 'Your sports news and intelligence front page', href: '/', keywords: ['home', 'front page', 'my edge', 'propbetedge'] },
    { type: 'tool', eyebrow: 'PBE TOOL', title: 'PBEcast Live Games', subtitle: 'Live scores and game centers across every league', href: '/games', keywords: ['scores', 'live games', 'game center', 'pbecast'] },
    { type: 'tool', eyebrow: 'PBE TOOL', title: 'Stat Leaders', subtitle: 'League leaders, advanced stats and player intelligence', href: '/leaders', keywords: ['leaders', 'stats', 'players'] },
    { type: 'tool', eyebrow: 'PBE TOOL', title: 'Today’s Edges', subtitle: 'Current +EV intelligence and model edges', href: '/odds', keywords: ['odds', 'edges', 'ev', 'props', 'model'] },
    { type: 'news', eyebrow: 'NEWSROOM', title: 'All News', subtitle: 'The complete PropBetEdge sports newsroom', href: '/news', keywords: ['news', 'stories', 'latest'] },
    { type: 'news', sport: 'ufc', eyebrow: 'UFC DESK', title: 'UFC News', subtitle: 'Fight-week coverage connected to UFC Intelligence', href: 'https://ufc.propbetedge.ai/news', external: true, keywords: ['ufc', 'mma', 'fight', 'news', 'fighters'] },
  ];

  const leagues = Object.values(SPORT_CONFIG).flatMap((config) => [
    { type: 'news', sport: config.key, eyebrow: `${config.label} DESK`, title: `${config.label} News`, subtitle: `Latest ${config.label} reporting and betting impact`, href: `/news/${config.key}`, keywords: [config.label, config.name, 'news'] },
    { type: 'standings', sport: config.key, eyebrow: `${config.label} INTELLIGENCE`, title: `${config.label} Standings`, subtitle: 'Live table connected to team intelligence hubs', href: `/standings/${config.key}`, keywords: [config.label, config.name, 'standings', 'records'] },
    { type: 'leaders', sport: config.key, eyebrow: `${config.label} INTELLIGENCE`, title: `${config.label} Leaders`, subtitle: 'Top performers and connected player context', href: `/leaders/${config.key}`, keywords: [config.label, config.name, 'leaders', 'stats'] },
  ]);
  return [...core, ...leagues];
}

function quickRecords() {
  return buildStaticRecords().filter((record) => record.type !== 'product').slice(0, 8);
}

function renderQuickLinks() {
  const quick = quickRecords();
  selectedIndex = 0;
  list.innerHTML = `
    <div class="pbe-search-section-label">Jump anywhere</div>
    ${quick.map((record, index) => renderRecord(record, index)).join('')}
  `;
  paintSelection();
}

function renderResults() {
  if (!list || !input) return;
  const query = normalize(input.value);
  if (!query) {
    renderQuickLinks();
    return;
  }

  const ranked = rankedResults(query);
  selectedIndex = 0;
  status.textContent = ranked.length ? `${ranked.length} best matches across news, teams and intelligence` : 'No exact match in the current PBE index';
  list.innerHTML = ranked.length
    ? ranked.map((record, index) => renderRecord(record, index)).join('')
    : `<div class="pbe-search-empty"><strong>No match yet.</strong><span>Try a player, team, league, headline, “UFC”, “injuries”, “standings”, “leaders”, or “edges”.</span></div>`;
  paintSelection();
}

function rankedResults(query) {
  return records
    .map((record) => ({ record, score: scoreRecord(record, query) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || recentFirst(a.record, b.record))
    .slice(0, MAX_RESULTS)
    .map((item) => item.record);
}

function scoreRecord(record, query) {
  const terms = query.split(/\s+/).filter(Boolean);
  const title = normalize(record.title);
  const eyebrow = normalize(record.eyebrow);
  const keywords = normalize((record.keywords || []).join(' '));
  const subtitle = normalize(record.subtitle);
  const domain = normalize(record.domain);
  let score = 0;

  if (title === query) score += 160;
  if (title.startsWith(query)) score += 110;
  if (title.includes(query)) score += 75;
  if (keywords.includes(query)) score += 48;
  if (eyebrow.includes(query)) score += 28;
  if (subtitle.includes(query)) score += 16;
  if (domain.includes(query)) score += 32;

  for (const term of terms) {
    if (title.startsWith(term)) score += 25;
    else if (title.includes(term)) score += 16;
    if (keywords.includes(term)) score += 12;
    if (subtitle.includes(term)) score += 4;
    if (domain.includes(term)) score += 8;
  }

  if (record.type === 'product') score += 14;
  if (record.type === 'team') score += 6;
  return score;
}

function renderRecord(record, index) {
  const icon = iconFor(record.type, record.sport);
  const openLabel = record.type === 'product' ? '<b>LIVE</b> ↗' : '↗';
  return `
    <button type="button" class="pbe-search-row${record.type === 'product' ? ' is-product' : ''}" role="option" aria-selected="${index === selectedIndex ? 'true' : 'false'}" data-search-index="${index}">
      <span class="pbe-search-row-icon">${record.image ? `<img src="${escapeAttr(record.image)}" alt="" loading="lazy" onerror="this.remove()" />` : icon}</span>
      <span class="pbe-search-row-copy">
        <span class="pbe-search-row-eyebrow">${escapeHtml(record.eyebrow || record.type)}</span>
        <strong>${escapeHtml(record.title)}</strong>
        <small>${escapeHtml(shorten(record.subtitle || '', 115))}${record.domain ? ` · ${escapeHtml(record.domain)}` : ''}</small>
      </span>
      <span class="pbe-search-row-open">${openLabel}</span>
    </button>
  `;
}

function moveSelection(delta) {
  const rows = [...(list?.querySelectorAll('[data-search-index]') || [])];
  if (!rows.length) return;
  selectedIndex = (selectedIndex + delta + rows.length) % rows.length;
  paintSelection();
  rows[selectedIndex]?.scrollIntoView({ block: 'nearest' });
}

function paintSelection() {
  [...(list?.querySelectorAll('[data-search-index]') || [])].forEach((row, index) => {
    const active = index === selectedIndex;
    row.classList.toggle('is-selected', active);
    row.setAttribute('aria-selected', active ? 'true' : 'false');
  });
}

function activateSelected() {
  const rows = [...(list?.querySelectorAll('[data-search-index]') || [])];
  const row = rows[selectedIndex];
  if (!row) return;
  const query = normalize(input?.value || '');
  const resultSet = query ? rankedResults(query) : quickRecords();
  const record = resultSet[selectedIndex];
  if (!record) return;

  sendSearchEvent(record, query);
  closeSearch();
  if (/^https?:\/\//i.test(record.href)) {
    window.open(record.href, '_blank', 'noopener');
  } else {
    window.history.pushState({}, '', record.href);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
}

function sendSearchEvent(record, query) {
  if (typeof window.gtag !== 'function') return;
  window.gtag('event', 'site_search_result_open', {
    search_term: query,
    result_type: record.type || '',
    result_title: record.title || '',
    result_url: record.href || '',
  });
}

function dedupe(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.type}:${item.href}`;
    if (!item.href || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function recentFirst(a, b) {
  return new Date(b?.publishedAt || 0).getTime() - new Date(a?.publishedAt || 0).getTime();
}

function iconFor(type, sport) {
  if (sport === 'ufc') return '🥊';
  if (sport && SPORT_CONFIG[sport]) return SPORT_CONFIG[sport].emoji;
  if (type === 'home') return '⌂';
  if (type === 'story' || type === 'news') return '✦';
  if (type === 'team') return '◆';
  if (type === 'standings') return '▥';
  if (type === 'leaders') return '↑';
  return '⚡';
}

function normalize(value) {
  return String(value || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function shorten(value, max) {
  const text = String(value || '');
  return text.length > max ? `${text.slice(0, max - 1).trim()}…` : text;
}

function formatDate(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function escapeAttr(value) {
  return escapeHtml(value);
}
