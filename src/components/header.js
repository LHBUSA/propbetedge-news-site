/**
 * src/components/header.js
 * Editorial masthead with PBE chrome logo + header banner ad
 */
import { PROPBET_LINKS } from '../ads-config.js';
import { renderScoreStripShell, mountScoreStrip } from './score-strip.js';
import { INTELLIGENCE_SPORTS, INTELLIGENCE_ORDER, ctaAttrs } from '../intelligence-cta.js';

const MLB_FEATURED_URL = 'https://mlb.propbetedge.ai/api/free-featured-player';
const NFL_TD_URL = 'https://nfl.propbetedge.ai/api/pbe-touchdown-targets?view=free-sample';
const UFC_SAMPLE_URL = 'https://ufc.propbetedge.ai/api/ufc/free-sample';
const WNBA_SAMPLE_URL = 'https://wnba-api.propbetedge.ai/v1/pbe/free-sample';
const NHL_SAMPLE_URL = 'https://nhl-api.propbetedge.ai/nhl/picks/free-sample';
const UFC_API_BASE = 'https://ufc-api.propbetedge.ai/v1/ufc';
const FIGHT_WEEK_CACHE_MS = 5 * 60 * 1000;
let _edgeCountFetched = false;
let _fightWeekPromise = null;
let _fightWeekCache = null;
let _fightWeekCachedAt = 0;

// Blurbs are header copy; destinations come from the one intelligence registry.
const INTELLIGENCE_BLURBS = Object.freeze({
  mlb: 'Live models, player research, props and game context',
  nfl: 'Market Board, Model Lab, simulation and live football context',
  nba: 'Player research, game context and live basketball intelligence',
  wnba: 'Live games, PBE Picks, player load and WNBA intelligence',
  nhl: 'Ice Board, PBE Picks, player research and hockey intelligence',
  ufc: 'Fight DNA, matchup research, rankings and fight-week intelligence',
  tennis: 'Live matches, player analytics and match data',
  soccer: 'Live matches, Player DNA, competitions and match intelligence',
  golf: 'Player DNA, Course DNA, tournaments and PBEcast',
});

// ONE News control (owner 2026-10-07): every newsroom in one dropdown, the four on-site desks first.
const NEWS_ORDER = Object.freeze(['mlb', 'nfl', 'nba', 'nhl', 'wnba', 'ufc', 'tennis', 'soccer', 'golf', 'f1']);

function newsHref(key) {
  return INTELLIGENCE_SPORTS[key]?.newsPath || '/news';
}

function newsTargetAttrs(key) {
  return /^https:\/\//.test(newsHref(key)) ? ' target="_blank" rel="noopener"' : '';
}

const INTELLIGENCE_PRODUCTS = Object.freeze(INTELLIGENCE_ORDER.map((key) => {
  const intel = INTELLIGENCE_SPORTS[key];
  return {
    key,
    emoji: intel.emoji,
    label: `${intel.label} Intelligence`,
    href: intel.href,
    domain: intel.domain,
    blurb: INTELLIGENCE_BLURBS[key],
  };
}));

// Account entry: the header has no session state, so this is always SIGN IN into the existing
// Members / All Access login flow (no second login system).
export const MEMBERS_SIGN_IN_URL = 'https://members.propbetedge.ai/';

// mode 'editorial': institutional / editorial pages (About, authors, masthead, Editorial Standards, Terms, Legal,
// Media, Support) render the masthead and navigation only — no live-score strip, no sport campaign banner, no
// UFC Fight Week rail — so the reader sees the page they asked for immediately. Sports pages keep the full chrome.
export const EDITORIAL_HEADER_MODE = 'editorial';

export function renderHeader({ mode = 'sports' } = {}) {
  const editorial = mode === EDITORIAL_HEADER_MODE;
  const path = window.location.pathname;
  const isLive = path === '/games' || path.startsWith('/games/');
  const isLeaders = path === '/leaders' || path.startsWith('/leaders/');
  const isStandings = path === '/standings' || path.startsWith('/standings/');
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
      initNavMenus();
      if (!_edgeCountFetched) {
        _edgeCountFetched = true;
        fetchEdgeCount().catch(err => console.warn('[header] edge count fetch failed:', err));
      }
    });
  }

  return `
    ${editorial ? '' : renderScoreStripShell()}
    <header class="masthead pbe-nav2${editorial ? ' masthead--editorial' : ''}">
      <div class="container masthead-inner">
        <nav class="masthead-left masthead-primary" aria-label="PropBetEdge sections">
          ${renderNewsSwitcher(sport)}
          <a href="/games" class="nav-link live-link ${isLive ? 'active' : ''}">PBEcast</a>
          <a href="/odds" class="nav-link edges-link ${isOdds ? 'active' : ''}">
            <span class="edges-bolt" aria-hidden="true">⚡</span><span class="edges-label">Free Picks</span><span class="edges-count" id="edges-count" aria-live="polite"></span>
          </a>
          ${renderStatsSwitcher(isLeaders, isStandings)}
          <a href="https://predictions.propbetedge.ai/" class="nav-link pbe-predictions-link" data-pbe-placement="masthead_predictions">Predictions</a>
        </nav>
        <a href="/" class="masthead-logo" aria-label="PropBetEdge home">
          <img
            src="/logo/pbe-mark-160.png"
            srcset="/logo/pbe-mark-80.png 1x, /logo/pbe-mark-160.png 2x, /logo/pbe-mark-240.png 3x"
            alt="PropBetEdge"
            class="masthead-mark"
            width="207" height="80"
          />
          <span class="tagline">Sports News &middot; Prop-Bet Intelligence</span>
        </a>
        <nav class="pbe-mobile-nav" aria-label="PropBetEdge mobile navigation">
          <a href="/pro" class="pbe-mobile-nav-link pbe-mobile-all-access ${path === '/pro' ? 'active' : ''}" data-pbe-placement="mobile_nav_all_access" aria-label="PropBetEdge All Access membership">All Access</a>
          <a href="${MEMBERS_SIGN_IN_URL}" class="pbe-mobile-nav-link pbe-mobile-signin" data-pbe-placement="mobile_nav_sign_in" aria-label="Sign in to PropBetEdge Members"><span class="pbe-mobile-signin-chip">Sign In</span></a>
          <button type="button" class="pbe-mobile-nav-link pbe-mobile-search" data-pbe-search-open aria-label="Search PropBetEdge">Search</button>
          <details class="pbe-mobile-more">
            <summary class="pbe-mobile-nav-link" aria-label="Open PropBetEdge navigation">More</summary>
            <div class="pbe-mobile-more-panel">
              <div class="pbe-mobile-more-group pbe-mobile-more-membership">
                <span class="pbe-mobile-more-label">Membership</span>
                <div class="pbe-mobile-more-links">
                  <a href="/pro" class="pbe-mobile-more-all-access ${path === '/pro' ? 'active' : ''}"><strong>All Access</strong><span>$29/mo · Every sport</span></a>
                  <a href="${MEMBERS_SIGN_IN_URL}" class="pbe-mobile-more-signin" data-pbe-placement="mobile_more_sign_in"><strong>Sign In</strong><span>Members · All Access</span></a>
                  <button type="button" class="pbe-mobile-more-search" data-pbe-search-open>Search</button>
                </div>
              </div>
              <div class="pbe-mobile-more-group pbe-mobile-more-sections">
                <span class="pbe-mobile-more-label">Sections</span>
                <div class="pbe-mobile-more-links">
                  <a href="/news" class="${path === '/news' ? 'active' : ''}">All News</a>
                  <a href="/games" class="${isLive ? 'active' : ''}">PBEcast · Scores</a>
                  <a href="/odds" class="${isOdds ? 'active' : ''}">Free Picks</a>
                  <a href="/leaders" class="${isLeaders ? 'active' : ''}">Stats</a>
                </div>
              </div>
              <div class="pbe-mobile-more-group">
                <span class="pbe-mobile-more-label">News</span>
                <div class="pbe-mobile-more-links">
                  ${NEWS_ORDER.map(key => `<a href="${newsHref(key)}"${newsTargetAttrs(key)}>${INTELLIGENCE_SPORTS[key].label}</a>`).join('')}
                </div>
              </div>
              <div class="pbe-mobile-more-group">
                <span class="pbe-mobile-more-label">Tools</span>
                <div class="pbe-mobile-more-links">
                  <a href="/standings">Standings</a>
                  <a href="/leaders">Leaders</a>
                </div>
              </div>
              <div class="pbe-mobile-more-group">
                <span class="pbe-mobile-more-label">Intelligence</span>
                <div class="pbe-mobile-more-links">
                  ${INTELLIGENCE_PRODUCTS.map(product => `<a href="${product.href}" ${ctaAttrs(INTELLIGENCE_SPORTS[product.key], { placement: 'mobile_more', pageType: pageTypeFor(path), slug: articleSlugFor(path) })}>${INTELLIGENCE_SPORTS[product.key].label}</a>`).join('')}
                  <a href="https://predictions.propbetedge.ai/" data-pbe-placement="mobile_more_predictions">Predictions</a>
                </div>
              </div>
            </div>
          </details>
        </nav>
        <div class="masthead-right masthead-tools" aria-label="PropBetEdge intelligence and account">
          ${renderIntelligenceSwitcher(sport, pageTypeFor(path), articleSlugFor(path))}
          <a href="/pro" class="nav-link pbe-all-access-link ${path === '/pro' ? 'active' : ''}" data-pbe-placement="masthead_all_access">All Access</a>
          <a href="${MEMBERS_SIGN_IN_URL}" class="nav-link pbe-signin-link" data-pbe-placement="masthead_sign_in" aria-label="Sign in to PropBetEdge Members">Sign In</a>
          <button type="button" class="nav-link pbe-search-trigger masthead-search" data-pbe-search-open aria-label="Search PropBetEdge" aria-keyshortcuts="Control+K Meta+K /">
            <span class="masthead-search-icon" aria-hidden="true">⌕</span>
          </button>
        </div>
      </div>
    </header>
    ${editorial ? '' : renderUfcFightWeekShell()}
  `;
}

/**
 * Contextual rail (owner 2026-10-07): at most ONE full-width rail under the masthead,
 * priority BREAKING > LIVE EVENT / FIGHT WEEK > nothing. While a Breaking ribbon is on the
 * page the UFC Fight Week rail yields (it stays mounted and returns when Breaking is gone).
 */
export function syncContextRail(doc = typeof document !== 'undefined' ? document : null) {
  const rail = doc?.getElementById?.('pbe-ufc-fight-week');
  if (!rail) return;
  if (typeof rail.toggleAttribute !== 'function' || typeof doc.querySelector !== 'function') return;
  rail.toggleAttribute('data-yield-breaking', Boolean(doc.querySelector('.breaking')));
}

// One open header menu at a time; outside click or Escape closes it.
let _navMenusReady = false;
function initNavMenus() {
  if (_navMenusReady || typeof document === 'undefined' || typeof document.addEventListener !== 'function') return;
  _navMenusReady = true;
  document.addEventListener('toggle', (event) => {
    const opened = event.target;
    if (!opened?.matches?.('details[data-pbe-nav-menu]') || !opened.open) return;
    document.querySelectorAll('details[data-pbe-nav-menu][open]').forEach((d) => { if (d !== opened) d.open = false; });
  }, true);
  document.addEventListener('click', (event) => {
    document.querySelectorAll('details[data-pbe-nav-menu][open]').forEach((d) => { if (!d.contains(event.target)) d.open = false; });
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    document.querySelectorAll('details[data-pbe-nav-menu][open]').forEach((d) => { d.open = false; });
  });
}

function renderUfcFightWeekShell() {
  return `
    <a id="pbe-ufc-fight-week" class="pbe-fight-week" href="${PROPBET_LINKS.picks_ufc}" target="_blank" rel="noopener" data-pbe-placement="fight_week_rail" hidden aria-label="Open UFC Fight Week on PropBetEdge">
      <div class="pbe-fight-week-inner">
        <span class="pbe-fight-week-zone is-left">
          <span class="pbe-fight-week-kicker"><span class="pbe-fight-week-dot" aria-hidden="true"></span><span id="pbe-ufc-fight-week-kicker">UFC FIGHT WEEK</span></span>
          <span class="pbe-fight-week-event" id="pbe-ufc-fight-week-event"></span>
        </span>
        <span class="pbe-fight-week-matchup" id="pbe-ufc-fight-week-matchup"></span>
        <span class="pbe-fight-week-zone is-right">
          <span class="pbe-fight-week-date" id="pbe-ufc-fight-week-date"></span>
          <span class="pbe-fight-week-cta" id="pbe-ufc-fight-week-cta">OPEN FIGHT WEEK ↗</span>
        </span>
      </div>
    </a>
  `;
}

function renderNewsSwitcher(activeSport) {
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  const active = path === '/news' || path.startsWith('/news/');
  return `
    <details class="pbe-sports-switcher pbe-news-switcher" data-pbe-nav-menu>
      <summary class="nav-link pbe-sports-summary ${active ? 'active' : ''}" aria-label="Open PropBetEdge newsrooms">
        <span>News</span><span class="pbe-sports-chevron" aria-hidden="true">⌄</span>
      </summary>
      <div class="pbe-sports-menu pbe-news-menu" role="menu" aria-label="PropBetEdge newsrooms">
        <div class="pbe-sports-menu-head">
          <span>SPORT NEWSROOMS</span>
          <strong>Every sport has its own news desk</strong>
          <small>Open the dedicated newsroom for that sport.</small>
        </div>
        <div class="pbe-sports-grid pbe-news-grid">
          ${NEWS_ORDER.map(key => {
            const intel = INTELLIGENCE_SPORTS[key];
            return `
              <a class="pbe-sports-option${activeSport === key ? ' is-active' : ''}" href="${newsHref(key)}" role="menuitem"${newsTargetAttrs(key)}>
                <span aria-hidden="true">${intel.emoji}</span>
                <strong>${intel.label}</strong>
                <small>News →</small>
              </a>
            `;
          }).join('')}
        </div>
        <a class="pbe-sports-all-news" href="/news">All Sports News <span aria-hidden="true">→</span></a>
      </div>
    </details>
  `;
}

function renderStatsSwitcher(isLeaders, isStandings) {
  const active = isLeaders || isStandings;
  return `
    <details class="pbe-stats-switcher" data-pbe-nav-menu>
      <summary class="nav-link pbe-stats-summary ${active ? 'active' : ''}" aria-label="Open PropBetEdge stats navigation">
        <span>Stats</span><span class="pbe-stats-chevron" aria-hidden="true">⌄</span>
      </summary>
      <div class="pbe-stats-menu" role="menu" aria-label="PropBetEdge stats">
        <a href="/leaders" role="menuitem" class="${isLeaders ? 'is-active' : ''}">
          <span>LEADERS</span>
          <strong>Stat Leaders</strong>
          <small>Top performers across every covered league</small>
        </a>
        <a href="/standings" role="menuitem" class="${isStandings ? 'is-active' : ''}">
          <span>STANDINGS</span>
          <strong>League Standings</strong>
          <small>MLB · NFL · NBA · WNBA · NHL · UFC rankings</small>
        </a>
      </div>
    </details>
  `;
}

function renderIntelligenceSwitcher(activeSport, pageType, slug) {
  // ONE sport/intelligence selector for all 10 sports. Neutral "Intelligence" unless the page is about one sport.
  const selectedProduct = INTELLIGENCE_PRODUCTS.find(product => product.key === activeSport) || null;

  return `
    <details class="pbe-intel-switcher" data-pbe-nav-menu>
      <summary class="pbe-intel-summary" aria-label="Switch live PropBetEdge intelligence product">
        <span class="pbe-intel-live-dot" aria-hidden="true"></span>
        ${selectedProduct ? `<span class="pbe-intel-summary-sport" aria-hidden="true">${selectedProduct.emoji}</span>` : ''}
        <span>${selectedProduct ? selectedProduct.label : 'Intelligence'}</span>
        <span class="pbe-intel-chevron" aria-hidden="true">⌄</span>
      </summary>
      <div class="pbe-intel-menu" role="menu" aria-label="Choose a live PropBetEdge intelligence product">
        <div class="pbe-intel-menu-head">
          <span>PROP BET EDGE NETWORK</span>
          <strong>Intelligence for all 10 sports</strong>
        </div>
        ${INTELLIGENCE_PRODUCTS.map(product => `
          <a class="pbe-intel-option${selectedProduct?.key === product.key ? ' is-active' : ''}" href="${product.href}" role="menuitem" ${ctaAttrs(INTELLIGENCE_SPORTS[product.key], { placement: 'header_switcher', pageType, slug })}>
            <span class="pbe-intel-option-icon" aria-hidden="true">${product.emoji}</span>
            <span class="pbe-intel-option-copy">
              <strong>${product.label}</strong>
              <small>${product.blurb}</small>
              <em>${product.domain}</em>
            </span>
            <span class="pbe-intel-option-live">LIVE ↗</span>
          </a>
        `).join('')}
        <a class="pbe-intel-option pbe-intel-option-predictions" href="https://predictions.propbetedge.ai/" role="menuitem" data-pbe-placement="header_switcher_predictions">
          <span class="pbe-intel-option-icon" aria-hidden="true">◎</span>
          <span class="pbe-intel-option-copy">
            <strong>Predictions</strong>
            <small>Real-world probability intelligence · included in All Access</small>
            <em>predictions.propbetedge.ai</em>
          </span>
          <span class="pbe-intel-option-live">LIVE ↗</span>
        </a>
      </div>
    </details>
  `;
}

// source_page_type for intelligence_cta_click.
function pageTypeFor(path) {
  if (path === '/' || path === '') return 'home';
  if (/^\/news\/?$/.test(path) || /^\/news\/page\/\d+$/.test(path)) return 'news_index';
  if (/^\/news\/[a-z]+(?:\/page\/\d+)?$/.test(path)) return 'sport_index';
  if (/^\/news\/[a-z]+\/[^/]+$/.test(path)) return 'article';
  const first = String(path).split('/').filter(Boolean)[0];
  return first ? first.replace(/[^a-z0-9_-]/gi, '') : 'other';
}

function articleSlugFor(path) {
  return pageTypeFor(path) === 'article' ? String(path).split('/').filter(Boolean)[2] || '' : '';
}

function sportPathActive(path, sport) {
  return inferSport(path) === sport;
}

function inferSport(path) {
  const match = String(path || '').match(/\/(?:news|games|leaders|team|standings|player)\/(mlb|nfl|ufc|nba|wnba|nhl|tennis|soccer|golf)(?:\/|$)/i);
  return match?.[1]?.toLowerCase() || null;
}

async function fetchEdgeCount() {
  try {
    const results = await Promise.allSettled([
      fetch(MLB_FEATURED_URL, { credentials: 'omit' }).then(r => r.ok ? r.json() : null),
      fetch(NFL_TD_URL, { cache: 'no-store', credentials: 'omit' }).then(r => r.ok ? r.json() : null),
      fetch(UFC_SAMPLE_URL, { cache: 'no-store', credentials: 'omit' }).then(r => r.ok ? r.json() : null),
      fetch(WNBA_SAMPLE_URL, { cache: 'no-store', credentials: 'omit' }).then(r => r.ok ? r.json() : null),
      fetch(NHL_SAMPLE_URL, { cache: 'no-store', credentials: 'omit' }).then(r => r.ok ? r.json() : null),
    ]);
    const body = (index) => results[index].status === 'fulfilled' ? results[index].value : null;
    const mlbFeatured = body(0);
    const nfl = body(1);
    const ufc = body(2);
    const wnba = body(3)?.data || body(3);
    const nhl = body(4);
    const count =
      (mlbFeatured?.featured ? 1 : 0)
      + Math.min(2, Array.isArray(nfl?.targets) ? nfl.targets.length : 0)
      + (ufc?.pick ? 1 : 0)
      + Math.min(2, Array.isArray(wnba?.picks) ? wnba.picks.length : 0)
      + Math.min(2, Array.isArray(nhl?.picks) ? nhl.picks.length : 0);

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
    // Silent fail — the Edges link remains usable without a badge.
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
  if (matchupEl) renderFightWeekMatchup(matchupEl, mainEvent);
  if (dateEl) dateEl.textContent = fightWeekDateLabel(event.event_date, daysOut);
  if (ctaEl) ctaEl.textContent = isFightWeek ? 'OPEN FIGHT WEEK ↗' : 'EXPLORE UFC ↗';

  const destination = eventDestination(event);
  rail.href = destination;
  rail.setAttribute('aria-label', `${isFightWeek ? 'Open UFC Fight Week' : 'Explore the next UFC card'}: ${event.name || 'UFC'}`);
  rail.classList.toggle('is-fight-week', isFightWeek);
  rail.hidden = false;
  syncContextRail();
}

// "[face] Joshua Van vs Alexandre Pantoja [face]". Faces are fixed-size chips so
// nothing moves while photos load; a missing or broken photo shows initials.
// The spaces between spans keep textContent reading "A vs B".
function renderFightWeekMatchup(el, bout) {
  const a = bout?.fighter_a;
  const b = bout?.fighter_b;
  el.replaceChildren();
  el.classList.toggle('has-faces', Boolean(a?.name && b?.name));
  if (!a?.name || !b?.name) {
    el.textContent = 'Fight intelligence · card research · Fight DNA';
    return;
  }
  el.append(
    fighterFace(a), ' ',
    fighterName(a.name), ' ',
    Object.assign(document.createElement('span'), { className: 'pbe-fw-vs', textContent: 'vs' }), ' ',
    fighterName(b.name), ' ',
    fighterFace(b),
  );
}

function fighterName(name) {
  return Object.assign(document.createElement('span'), { className: 'pbe-fw-name', textContent: name });
}

function fighterFace(fighter) {
  // The name sits right beside the chip, so the chip is decorative.
  const chip = document.createElement('span');
  chip.className = 'pbe-fw-face';
  chip.setAttribute('aria-hidden', 'true');
  // Initials render from CSS so they never enter the matchup's text content.
  chip.dataset.initials = fighterInitials(fighter.name);

  // display_image is the portrait ufc.propbetedge.ai shows (identity-verified);
  // primary_image is the older stored-catalog field, kept as a fallback.
  const image = fighter.display_image?.thumb_url ? fighter.display_image : fighter.primary_image;
  const src = image?.thumb_url;
  if (/^https:\/\//.test(String(src || ''))) {
    const img = Object.assign(document.createElement('img'), { alt: '', width: 28, height: 28, decoding: 'async' });
    img.style.objectPosition = faceObjectPosition(image);
    const credit = image.attribution_text || (image.author && image.license ? `${image.author} / ${image.license}` : '');
    if (credit) img.title = `${fighter.name} · Photo: ${credit}`;
    img.addEventListener('load', () => chip.classList.add('is-loaded'), { once: true });
    img.addEventListener('error', () => {
      img.remove();
      chip.classList.remove('has-photo', 'is-loaded');
    }, { once: true });
    img.src = src;
    chip.classList.add('has-photo');
    chip.append(img);
    if (img.complete && img.naturalWidth) chip.classList.add('is-loaded');
  }
  return chip;
}

// Same crop rules as ufc.propbetedge.ai's variant system: the image's detected
// focal point when it has one, else the avatar slot default. ESPN headshots are
// landscape head-and-shoulders PNGs, so they centre.
function faceObjectPosition(image) {
  const x = Number(image?.focal?.x);
  const y = Number(image?.focal?.y);
  if (image?.focal && Number.isFinite(x) && Number.isFinite(y)) return `${Math.round(x * 1000) / 10}% ${Math.round(y * 1000) / 10}%`;
  return image?.display_only ? '50% 50%' : '50% 24%';
}

function fighterInitials(name) {
  const words = String(name || '')
    .split(/\s+/)
    .map(word => word.replace(/[^\p{L}]/gu, ''))
    .filter(word => word && !/^(jr|sr|ii|iii|iv)$/i.test(word));
  if (!words.length) return '';
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return `${first}${last}`.toUpperCase();
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

// A clean, canonical UFC event URL. Marketing UTMs on a first-party link were
// being indexed by Google as duplicate ufc.propbetedge.ai URLs; attribution for
// this rail is the data-pbe-placement click event in src/analytics.js.
function eventDestination(event) {
  const name = slugifyEvent(String(event?.name || 'ufc'));
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(event?.event_date || '')) ? event.event_date : 'tbd';
  return new URL(`/events/${name}-${date}`, PROPBET_LINKS.picks_ufc).toString();
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
