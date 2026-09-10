/**
 * src/components/header.js
 * Editorial masthead with PBE chrome logo + header banner ad
 */
import { ad_header_banner, PROPBET_LINKS } from '../ads-config.js';
import { renderScoreStripShell, mountScoreStrip } from './score-strip.js';

const EV_FINDER_URL = 'https://propbetedge-ev-finder.sales-fd3.workers.dev/edges-today';
const UFC_API_BASE = 'https://ufc-api.propbetedge.ai/v1/ufc';
const FIGHT_WEEK_CACHE_MS = 5 * 60 * 1000;
let _edgeCountFetched = false;
let _fightWeekPromise = null;
let _fightWeekCache = null;
let _fightWeekCachedAt = 0;

const INTELLIGENCE_PRODUCTS = Object.freeze([
  {
    key: 'mlb',
    emoji: '⚾',
    label: 'MLB Intelligence',
    href: PROPBET_LINKS.picks_mlb,
    domain: 'mlb.propbetedge.ai',
    blurb: 'Live models, player research, props and game context',
  },
  {
    key: 'nfl',
    emoji: '🏈',
    label: 'NFL Intelligence',
    href: PROPBET_LINKS.picks_nfl,
    domain: 'nfl.propbetedge.ai',
    blurb: 'Market Board, Model Lab, simulation and live football context',
  },
  {
    key: 'ufc',
    emoji: '🥊',
    label: 'UFC Intelligence',
    href: PROPBET_LINKS.picks_ufc,
    domain: 'ufc.propbetedge.ai',
    blurb: 'Fight DNA, matchup research, rankings and fight-week intelligence',
  },
]);

export function renderHeader() {
  const path = window.location.pathname;
  const isLive = path === '/games' || path.startsWith('/games/');
  const isLeaders = path === '/leaders' || path.startsWith('/leaders/');
  const isOdds = path === '/odds';
  const sport = inferSport(path);

  if (typeof window !== 'undefined') {
    queueMicrotask(() => {
      if (document.getElementById('pbe-score-strip')) {
        mountScoreStrip().catch(err => console.warn('[header] score strip mount failed:', err));
      }
      if (document.getElementById('pbe-ufc-fight-week')) {
        mountUfcFightWeek().catch(err => console.warn('[header] UFC fight-week mount failed:', err));
      }
      if (!_edgeCountFetched) {
        _edgeCountFetched = true;
        fetchEdgeCount().catch(err => console.warn('[header] edge count fetch failed:', err));
      }
    });
  }

  return `
    ${renderScoreStripShell()}
    ${ad_header_banner(sport ? { sport } : {})}
    <header class="masthead">
      <div class="container masthead-inner">
        <div class="masthead-left masthead-leagues" aria-label="League coverage and search">
          <button type="button" class="nav-link pbe-search-trigger masthead-search" data-pbe-search-open aria-label="Search PropBetEdge" aria-keyshortcuts="Control+K Meta+K /">
            <span class="masthead-search-icon" aria-hidden="true">⌕</span><span class="pbe-search-label">Search</span><kbd>/</kbd>
          </button>
          <span class="masthead-nav-divider" aria-hidden="true"></span>
          <a href="/news" class="nav-link ${path === '/news' ? 'active' : ''}">All News</a>
          <a href="/news/mlb" class="nav-link ${sportPathActive(path, 'mlb') ? 'active' : ''}">MLB</a>
          <a href="/news/nfl" class="nav-link ${sportPathActive(path, 'nfl') ? 'active' : ''}">NFL</a>
          <a href="${PROPBET_LINKS.news_ufc}" class="nav-link" target="_blank" rel="noopener">UFC</a>
          <a href="/news/nba" class="nav-link ${sportPathActive(path, 'nba') ? 'active' : ''}">NBA</a>
          <a href="/news/nhl" class="nav-link ${sportPathActive(path, 'nhl') ? 'active' : ''}">NHL</a>
        </div>
        <div class="masthead-logo" aria-label="PropBetEdge">
          <img
            src="/logo/pbe-mark-160.png"
            srcset="/logo/pbe-mark-80.png 1x, /logo/pbe-mark-160.png 2x, /logo/pbe-mark-240.png 3x"
            alt="PropBetEdge"
            class="masthead-mark"
            width="207" height="80"
          />
          <span class="tagline">Sports News &middot; Prop-Bet Intelligence</span>
        </div>
        <div class="masthead-right masthead-tools" aria-label="PropBetEdge tools">
          <a href="/games" class="nav-link live-link ${isLive ? 'active' : ''}">PBEcast</a>
          <a href="/leaders" class="nav-link ${isLeaders ? 'active' : ''}">Leaders</a>
          <a href="/odds" class="nav-link edges-link ${isOdds ? 'active' : ''}">
            <span class="edges-bolt">⚡</span><span class="edges-label">Edges</span><span class="edges-count" id="edges-count" aria-live="polite"></span>
          </a>
          ${renderIntelligenceSwitcher(sport)}
        </div>
      </div>
    </header>
    ${renderUfcFightWeekShell()}
  `;
}

function renderUfcFightWeekShell() {
  return `
    <a id="pbe-ufc-fight-week" class="pbe-fight-week" href="${PROPBET_LINKS.picks_ufc}" target="_blank" rel="noopener" hidden aria-label="Open UFC Fight Week on PropBetEdge">
      <div class="pbe-fight-week-inner">
        <span class="pbe-fight-week-kicker"><span class="pbe-fight-week-dot" aria-hidden="true"></span><span id="pbe-ufc-fight-week-kicker">UFC FIGHT WEEK</span></span>
        <span class="pbe-fight-week-event" id="pbe-ufc-fight-week-event"></span>
        <span class="pbe-fight-week-matchup" id="pbe-ufc-fight-week-matchup"></span>
        <span class="pbe-fight-week-date" id="pbe-ufc-fight-week-date"></span>
        <span class="pbe-fight-week-cta" id="pbe-ufc-fight-week-cta">OPEN FIGHT WEEK ↗</span>
      </div>
    </a>
  `;
}

function renderIntelligenceSwitcher(activeSport) {
  const selectedProduct = INTELLIGENCE_PRODUCTS.find(product => product.key === activeSport)
    || INTELLIGENCE_PRODUCTS.find(product => product.key === 'nfl')
    || INTELLIGENCE_PRODUCTS[0];

  return `
    <details class="pbe-intel-switcher">
      <summary class="pbe-intel-summary" aria-label="Switch live PropBetEdge intelligence product">
        <span class="pbe-intel-live-dot" aria-hidden="true"></span>
        <span class="pbe-intel-summary-sport" aria-hidden="true">${selectedProduct.emoji}</span>
        <span>${selectedProduct.label}</span>
        <span class="pbe-intel-chevron" aria-hidden="true">⌄</span>
      </summary>
      <div class="pbe-intel-menu" role="menu" aria-label="Choose a live PropBetEdge intelligence product">
        <div class="pbe-intel-menu-head">
          <span>PROP BET EDGE NETWORK</span>
          <strong>Switch live intelligence product</strong>
        </div>
        ${INTELLIGENCE_PRODUCTS.map(product => `
          <a class="pbe-intel-option${selectedProduct.key === product.key ? ' is-active' : ''}" href="${product.href}" target="_blank" rel="noopener" role="menuitem">
            <span class="pbe-intel-option-icon" aria-hidden="true">${product.emoji}</span>
            <span class="pbe-intel-option-copy">
              <strong>${product.label}</strong>
              <small>${product.blurb}</small>
              <em>${product.domain}</em>
            </span>
            <span class="pbe-intel-option-live">LIVE ↗</span>
          </a>
        `).join('')}
      </div>
    </details>
  `;
}

function sportPathActive(path, sport) {
  return inferSport(path) === sport;
}

function inferSport(path) {
  const match = String(path || '').match(/\/(?:news|games|leaders|team|standings|player)\/(mlb|nfl|ufc|nba|nhl)(?:\/|$)/i);
  return match?.[1]?.toLowerCase() || null;
}

async function fetchEdgeCount() {
  try {
    const r = await fetch(EV_FINDER_URL, { cache: 'no-store' });
    if (!r.ok) return;
    const data = await r.json();
    const count = data.total_alerts || 0;
    const el = document.getElementById('edges-count');
    if (!el) return;
    if (count > 0) {
      el.textContent = String(count);
      el.classList.add('has-edges');
    } else {
      el.textContent = '';
      el.classList.remove('has-edges');
    }
  } catch {
    // Silent fail — count badge just won't appear
  }
}

async function mountUfcFightWeek() {
  const rail = document.getElementById('pbe-ufc-fight-week');
  if (!rail) return;

  const data = await getUfcFightWeek();
  if (!data?.event) return;

  const { event, mainEvent, daysOut } = data;
  const isFightWeek = daysOut >= 0 && daysOut <= 6;
  const kicker = document.getElementById('pbe-ufc-fight-week-kicker');
  const eventEl = document.getElementById('pbe-ufc-fight-week-event');
  const matchupEl = document.getElementById('pbe-ufc-fight-week-matchup');
  const dateEl = document.getElementById('pbe-ufc-fight-week-date');
  const ctaEl = document.getElementById('pbe-ufc-fight-week-cta');

  if (kicker) kicker.textContent = isFightWeek ? 'UFC FIGHT WEEK' : 'NEXT UFC CARD';
  if (eventEl) eventEl.textContent = event.name || 'UFC';
  if (matchupEl) {
    const a = mainEvent?.fighter_a?.name;
    const b = mainEvent?.fighter_b?.name;
    matchupEl.textContent = a && b ? `${a} vs ${b}` : 'Fight intelligence · card research · Fight DNA';
  }
  if (dateEl) dateEl.textContent = fightWeekDateLabel(event.event_date, daysOut);
  if (ctaEl) ctaEl.textContent = isFightWeek ? 'OPEN FIGHT WEEK ↗' : 'EXPLORE UFC ↗';

  const destination = eventDestination(event);
  rail.href = destination;
  rail.setAttribute('aria-label', `${isFightWeek ? 'Open UFC Fight Week' : 'Explore the next UFC card'}: ${event.name || 'UFC'}`);
  rail.classList.toggle('is-fight-week', isFightWeek);
  rail.hidden = false;
}

async function getUfcFightWeek() {
  const now = Date.now();
  if (_fightWeekCache && now - _fightWeekCachedAt < FIGHT_WEEK_CACHE_MS) return _fightWeekCache;
  if (_fightWeekPromise) return _fightWeekPromise;

  _fightWeekPromise = fetchUfcFightWeek()
    .then(data => {
      if (data) {
        _fightWeekCache = data;
        _fightWeekCachedAt = Date.now();
      }
      return data;
    })
    .finally(() => {
      _fightWeekPromise = null;
    });

  return _fightWeekPromise;
}

async function fetchUfcFightWeek() {
  const easternToday = easternDateKey(new Date());
  const urls = [
    `${UFC_API_BASE}/events?date=${encodeURIComponent(easternToday)}&limit=20`,
    `${UFC_API_BASE}/events?status=upcoming&limit=20`,
  ];

  const responses = await Promise.all(urls.map(url => fetchJson(url)));
  const rows = responses.flatMap(body => Array.isArray(body?.data) ? body.data : []);
  if (!rows.length) return null;

  const unique = new Map();
  for (const event of rows) {
    if (!event?.id || unique.has(event.id)) continue;
    unique.set(event.id, event);
  }

  const events = [...unique.values()]
    .filter(event => event.event_date && event.event_date >= easternToday)
    .filter(event => String(event.card_status || '').toLowerCase() !== 'complete')
    .filter(event => !/contender series|road to ufc/i.test(String(event.name || '')))
    .sort((a, b) => String(a.event_date).localeCompare(String(b.event_date)));

  const event = events[0];
  if (!event) return null;

  let mainEvent = null;
  try {
    const card = await fetchJson(`${UFC_API_BASE}/events/${encodeURIComponent(event.id)}/card`);
    const bouts = Array.isArray(card?.data?.bouts) ? card.data.bouts : [];
    mainEvent = bouts.find(bout => String(bout?.status || '').toLowerCase() !== 'cancelled') || null;
  } catch {
    // Event-level rail still renders if the card endpoint is temporarily unavailable.
  }

  return {
    event,
    mainEvent,
    daysOut: dateDiffDays(easternToday, event.event_date),
  };
}

async function fetchJson(url) {
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function easternDateKey(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function dateDiffDays(fromDate, toDate) {
  const parse = value => {
    const [year, month, day] = String(value || '').split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  };
  const a = parse(fromDate);
  const b = parse(toDate);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 99;
  return Math.round((b - a) / 86400000);
}

function fightWeekDateLabel(date, daysOut) {
  if (!date) return 'DATE TBA';
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${date}T12:00:00Z`)).toUpperCase();
  if (daysOut === 0) return `${formatted} · TONIGHT`;
  if (daysOut === 1) return `${formatted} · TOMORROW`;
  if (daysOut > 1 && daysOut <= 6) return `${formatted} · ${daysOut} DAYS`;
  return formatted;
}

function eventDestination(event) {
  const name = slugifyEvent(String(event?.name || 'ufc'));
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(event?.event_date || '')) ? event.event_date : 'tbd';
  const url = new URL(`/events/${name}-${date}`, PROPBET_LINKS.picks_ufc);
  url.searchParams.set('utm_source', 'propbetedge');
  url.searchParams.set('utm_medium', 'fight_week_rail');
  url.searchParams.set('utm_campaign', 'ufc_fight_week');
  return url.toString();
}

function slugifyEvent(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’.]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
