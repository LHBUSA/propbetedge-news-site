/**
 * src/pages/odds.js
 * Free Picks V3 — one cross-sport board, driven by the public ledger.
 *
 * Contract (see src/lib/free-board.js):
 *   - Every card drawn as a free pick IS a free-picks-tracker ledger entry.
 *   - Sport feeds only enrich those entries (media, live price, lifecycle).
 *     A feed pick without a ledger entry is reported, never drawn.
 *   - Validation / tracking / shadow / research output never renders as a pick.
 *   - Settled picks leave the current board for Latest Results + the record.
 *
 * Page order: hero → current picks → public record → latest results →
 * how it works → All Access → footer.
 */

import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { escapeHtml, escapeAttr } from '../components/article-card.js';
import { PROPBET_LINKS, proxyImage } from '../ads-config.js';
import {
  organizationSchema, websiteSchema, breadcrumbSchema, injectSchemas,
} from '../schema.js';
import {
  FREE_SPORTS, RESULT_LABELS, buildFreeBoard, checkFreePickInvariant, etDate,
  eventDate, eventStart, isFeaturedPlayer, isNonPickOutput, isTdTarget, latestResults, namespacedRecord,
  productLabel, recordSummary, sportRecord, trackerEntryMatchesCard,
} from '../lib/free-board.js';

// MLB free product = Featured Player (NOT an Algo pick). NFL free product = up to two official TD Targets.
const MLB_FEATURED_URL = 'https://mlb.propbetedge.ai/api/free-featured-player';
const MLB_OFFICIAL_PICKS_URL = 'https://mlb.propbetedge.ai/hr-picks';
const NFL_TD_URL = 'https://nfl.propbetedge.ai/api/pbe-touchdown-targets?view=free-sample';
const NFL_TD_PRODUCT_URL = PROPBET_LINKS.picks_nfl;
const UFC_SAMPLE_URL = 'https://ufc.propbetedge.ai/api/ufc/free-sample';
const WNBA_SAMPLE_URL = 'https://wnba-api.propbetedge.ai/v1/pbe/free-sample';
const NHL_SAMPLE_URL = 'https://nhl-api.propbetedge.ai/nhl/picks/free-sample';
const NHL_PRESEASON_URL = (date) => `https://nhl-api.propbetedge.ai/nhl/picks/preseason?date=${encodeURIComponent(date)}`;
const FREE_TRACKER_URL = 'https://tkmlnhmylqnttmnsnief.supabase.co/functions/v1/free-picks-tracker';
// Feeds only enrich ledger entries, so they refresh on a one-minute cadence.
// The ledger is the board: it polls every 10 seconds so HIT/MISS lands fast.
const REFRESH_INTERVAL_MS = 60 * 1000;
const TRACKER_REFRESH_INTERVAL_MS = 10 * 1000;
const NHL_MAX_FREE_PICKS = 2;
let _refreshTimer = null;
let _trackerTimer = null;
let _lastPayload = null;
let _lastTracker = null;
let _trackerRefreshInFlight = false;
let _filter = 'all';
const _mediaCache = new Map();

const SPORTS = Object.freeze({
  mlb: { label: 'MLB', emoji: '⚾', href: PROPBET_LINKS.picks_mlb },
  nfl: { label: 'NFL', emoji: '🏈', href: PROPBET_LINKS.picks_nfl },
  ufc: { label: 'UFC', emoji: '🥊', href: PROPBET_LINKS.picks_ufc },
  wnba: { label: 'WNBA', emoji: '🏀', href: PROPBET_LINKS.picks_wnba },
  nhl: { label: 'NHL', emoji: '🏒', href: PROPBET_LINKS.picks_nhl },
  nba: { label: 'NBA', emoji: '🏀', href: PROPBET_LINKS.picks_nba },
});

export async function renderOdds(root) {
  _filter = initialFilter();
  root.innerHTML = `
    ${renderHeader()}
    <main class="odds-page fp-page">
      <div class="container fp-container">
        ${renderHero()}
        <div id="odds-board">${renderSkeleton()}</div>
        ${renderHowItWorks()}
        ${renderAllAccessCta()}
      </div>
    </main>
    ${renderFooter()}
  `;

  injectSchemas([
    organizationSchema(),
    websiteSchema(),
    breadcrumbSchema([
      { name: 'Home', url: '/' },
      { name: 'Free Picks' },
    ]),
  ], 'jsonld-odds');

  root.querySelector('#odds-board')?.addEventListener('click', onBoardClick);

  await loadAndRender();

  teardownOdds();
  _refreshTimer = setInterval(loadAndRender, REFRESH_INTERVAL_MS);
  _trackerTimer = setInterval(refreshTrackerOnly, TRACKER_REFRESH_INTERVAL_MS);
}

function initialFilter() {
  try {
    const wanted = new URLSearchParams(window.location.search).get('sport');
    if (wanted && FREE_SPORTS.includes(wanted.toLowerCase())) return wanted.toLowerCase();
  } catch { /* default below */ }
  return 'all';
}

function onBoardClick(event) {
  const tab = event.target.closest('[data-fp-filter]');
  if (!tab || tab.disabled) return;
  _filter = tab.dataset.fpFilter;
  try {
    const url = new URL(window.location.href);
    if (_filter === 'all') url.searchParams.delete('sport'); else url.searchParams.set('sport', _filter);
    window.history.replaceState(window.history.state, '', url);
  } catch { /* URL sync is a convenience */ }
  renderBoard();
}

async function loadAndRender() {
  if (_lastPayload && !document.getElementById('odds-board')) {
    teardownOdds();
    return;
  }
  // The tracker GET captures the current public picks into the ledger before
  // it answers, so it runs alongside the feeds rather than after them.
  const [tracker, mlb, nfl, ufc, wnba, nhl] = await Promise.allSettled([
    fetchJson(FREE_TRACKER_URL),
    fetchJson(MLB_FEATURED_URL),
    fetchJson(NFL_TD_URL),
    fetchJson(UFC_SAMPLE_URL),
    fetchJson(WNBA_SAMPLE_URL),
    loadNhlSource(),
  ]);

  _lastPayload = {
    mlb: mlb.status === 'fulfilled' ? normalizeMlbFeatured(mlb.value) : sourceFailure('mlb', mlb.reason),
    nfl: nfl.status === 'fulfilled' ? normalizeNfl(nfl.value) : sourceFailure('nfl', nfl.reason),
    ufc: ufc.status === 'fulfilled' ? normalizeUfc(ufc.value) : sourceFailure('ufc', ufc.reason),
    wnba: wnba.status === 'fulfilled' ? normalizeWnba(wnba.value) : sourceFailure('wnba', wnba.reason),
    nhl: nhl.status === 'fulfilled' ? nhl.value : sourceFailure('nhl', nhl.reason),
  };
  if (tracker.status === 'fulfilled' && tracker.value?.ok) {
    _lastTracker = tracker.value;
  } else if (tracker.status === 'rejected') {
    console.warn('[odds] Free Picks ledger unavailable:', tracker.reason);
  }

  renderBoard();
  if (await enrichMedia()) renderBoard();
}

async function refreshTrackerOnly() {
  if (_trackerRefreshInFlight || !_lastPayload || !document.getElementById('odds-board')) return;
  _trackerRefreshInFlight = true;
  try {
    const tracker = await fetchJson(FREE_TRACKER_URL);
    if (tracker?.ok) _lastTracker = tracker;
    renderBoard();
  } catch (error) {
    console.warn('[odds] Free Picks ledger refresh unavailable:', error);
  } finally {
    _trackerRefreshInFlight = false;
  }
}

async function loadNhlSource() {
  const date = etDate();
  const [official, preseason] = await Promise.allSettled([
    fetchJson(NHL_SAMPLE_URL),
    fetchJson(NHL_PRESEASON_URL(date)),
  ]);
  return normalizeNhlSources({ official, preseason });
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store', credentials: 'omit' });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

function sourceFailure(sport, error) {
  console.warn(`[odds] ${sport} feed unavailable:`, error);
  return { sport, cards: [], generatedAt: null, unavailable: true };
}

/* ------------------------------------------------------------------ feeds
 * Feed cards are enrichment + diagnostics only. They are never drawn. */

function normalizeMlbFeatured(data) {
  const f = data?.featured;
  // Structural guard: only a non-Algo Featured Player payload can enrich the MLB free card.
  const ok = data?.contract === 'pbe-mlb-free-featured-player-v1' && data?.official_algo === false && f?.official_algo === false;
  const cards = ok && f?.player_name ? [{
    sport: 'mlb',
    title: f.player_name,
    trackerKey: f.featured_id,
    trackerPeriod: data.game_date || null,
    trackerPlayerId: f.player_id ? String(f.player_id) : null,
    href: f.player_dna_url || SPORTS.mlb.href,
    media: f.player_image ? { kind: 'portrait', images: [f.player_image], credit: 'MLB' } : null,
  }] : [];
  return { sport: 'mlb', cards, generatedAt: data?.generated_at || null, unavailable: false, emptyState: data?.empty_state || null };
}

function normalizeNfl(data) {
  const ok = data?.contract === 'pbe-nfl-free-td-targets-v1';
  const cards = (ok && Array.isArray(data?.targets) ? data.targets : []).slice(0, 2).map((t) => ({
    sport: 'nfl',
    title: t.player_name || 'TD Target',
    trackerKey: t.target_id ? `NFL-TD:${t.target_id}` : null,
    trackerEventStartAt: t.kickoff_ts || null,
    publication_scope: t.publication_scope || null,
    href: data?.full_product_url || NFL_TD_PRODUCT_URL,
    media: t.headshot_url ? { kind: 'portrait', images: [t.headshot_url], credit: 'NFL' } : null,
  }));
  return {
    sport: 'nfl', cards, generatedAt: data?.generated_at || null, unavailable: !ok,
    eligibility: data?.eligibility || null, emptyState: data?.empty_state || null,
    productUrl: data?.full_product_url || NFL_TD_PRODUCT_URL,
  };
}

function normalizeUfc(data) {
  const rawPicks = Array.isArray(data?.picks) && data.picks.length
    ? data.picks
    : data?.pick ? [data.pick] : [];
  const cards = rawPicks.slice(0, 2).map((pick) => ({
    sport: 'ufc',
    title: pick.pick_name || 'UFC pick',
    lifecycle: pick.lifecycle || null,
    trackerEventDate: pick.event_date || null,
    href: data.full_product_url || SPORTS.ufc.href,
    media: pick.media?.image_url ? {
      kind: 'portrait',
      images: [pick.media.image_url],
      credit: pick.media.attribution_text || null,
    } : null,
  }));
  return { sport: 'ufc', cards, generatedAt: data?.generated_at || null, unavailable: false };
}

function normalizeWnba(data) {
  const body = data?.data || data || {};
  const cards = (Array.isArray(body.picks) ? body.picks : []).slice(0, 2).map((pick) => ({
    sport: 'wnba',
    title: pick.pick_team?.name || pick.pick_team?.short_name || pick.pick_team?.abbr || 'WNBA pick',
    lifecycle: pick.phase || null,
    gameId: pick.game_id || null,
    href: body.full_product_url || SPORTS.wnba.href,
    media: pick.pick_team?.logo ? { kind: 'team', images: [pick.pick_team.logo] } : null,
  }));
  return { sport: 'wnba', cards, generatedAt: body.generated_at || null, unavailable: false };
}

function normalizeNhlSources({ official, preseason }) {
  const rows = [];
  if (official.status === 'fulfilled') {
    for (const pick of (official.value?.picks || [])) {
      rows.push({ sport: 'nhl', gameId: pick.game_id || null, title: pick.pick_team || 'NHL pick', href: official.value.full_product_url || SPORTS.nhl.href });
    }
  }
  if (preseason.status === 'fulfilled') {
    for (const game of (preseason.value?.games || [])) {
      if (game?.is_call !== true || !game?.pick_team) continue;
      rows.push({ sport: 'nhl', gameId: game.game_id || null, title: String(game.pick_team).toUpperCase(), href: SPORTS.nhl.href });
    }
  }
  const seen = new Set();
  const cards = rows.filter((card) => {
    const key = String(card.gameId || card.title);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, NHL_MAX_FREE_PICKS);
  return {
    sport: 'nhl',
    cards,
    generatedAt: latestTimestamp([official.value?.fetched_at, preseason.value?.fetched_at]),
    unavailable: official.status === 'rejected' && preseason.status === 'rejected',
  };
}

function nhlLogoUrl(abbr) {
  const clean = String(abbr || '').toUpperCase().replace(/[^A-Z]/g, '');
  return clean ? `https://assets.nhle.com/logos/nhl/svg/${clean}_dark.svg` : null;
}

/* ----------------------------------------------------------- board model */

function feedCards(payload) {
  return FREE_SPORTS.flatMap((sport) => payload?.[sport]?.cards || []);
}

function matchFeedCard(entry, payload) {
  return (payload?.[String(entry.sport || '').toLowerCase()]?.cards || [])
    .find((card) => trackerEntryMatchesCard(entry, card)) || null;
}

function liveHints(tracker, payload) {
  const hints = new Map();
  for (const entry of (tracker?.entries || [])) {
    const card = matchFeedCard(entry, payload);
    if (card?.lifecycle) hints.set(entry.public_key, { lifecycle: card.lifecycle });
  }
  return hints;
}

const STATE_TONE = { 'PRE-LOCK': 'prelock', LOCKED: 'locked', 'IN PLAY': 'live' };

/** One visual anatomy for every sport, built from the frozen ledger snapshot. */
function cardFromEntry(entry, state, payload) {
  const sport = String(entry.sport || '').toLowerCase();
  const snap = entry.snapshot || {};
  const feed = matchFeedCard(entry, payload);
  const start = eventStart(entry);
  const base = {
    sport,
    publicKey: entry.public_key,
    state,
    tone: STATE_TONE[state] || 'prelock',
    selection: entry.selection || 'Free pick',
    href: feed?.href || SPORTS[sport]?.href,
    media: feed?.media || null,
    nonPick: isNonPickOutput(entry),
  };

  if (sport === 'mlb' && isFeaturedPlayer(entry)) {
    const pitcher = snap.opposing_pitcher?.name ? `vs ${snap.opposing_pitcher.name}${snap.opposing_pitcher.hand ? ` (${snap.opposing_pitcher.hand}HP)` : ''}` : null;
    return {
      ...base,
      kicker: 'MLB · FREE PLAYER PICK',
      label: "Today's Featured Player",
      matchup: [entry.matchup, formatDateTime(start)].filter(Boolean).join(' · '),
      detail: [snap.position, snap.lineup_slot ? `Batting ${ordinal(snap.lineup_slot)}` : null, pitcher].filter(Boolean).join(' · '),
      insights: (Array.isArray(snap.insights) ? snap.insights : []).slice(0, 4),
      insightsTitle: 'Why this player is interesting today',
      metrics: [],
      note: 'Editorial showcase from public season, Player DNA and matchup data. Not an official Algo Pick; no model probability.',
      media: base.media || (snap.player_image ? { kind: 'portrait', images: [snap.player_image], credit: 'MLB' } : null),
      portrait: true,
      ctaLabel: "See today's official Algo Picks →",
      ctaHref: snap.official_picks_url || MLB_OFFICIAL_PICKS_URL,
      secondary: snap.player_dna_url ? { label: 'Player DNA', href: snap.player_dna_url } : null,
    };
  }
  if (sport === 'nfl' && isTdTarget(entry)) {
    const official = String(snap.publication_scope || '').toLowerCase() === 'official';
    return {
      ...base,
      kicker: 'NFL · FREE TD TARGET',
      label: official ? 'Official target' : 'Tracking target · validation phase',
      note: official ? null : 'Named before kickoff and graded from the official final box score. Touchdown Targets is still completing its validation window.',
      matchup: [entry.matchup, formatDateTime(start)].filter(Boolean).join(' · '),
      detail: [snap.position, snap.team].filter(Boolean).join(' · '),
      insights: (Array.isArray(snap.insights) ? snap.insights : []).slice(0, 3),
      insightsTitle: 'Why this target',
      metrics: [],
      media: base.media || (snap.headshot_url ? { kind: 'portrait', images: [snap.headshot_url], credit: 'NFL' } : null),
      portrait: true,
      ctaLabel: 'Unlock all TD Targets →',
      ctaHref: _lastPayload?.nfl?.productUrl || NFL_TD_PRODUCT_URL,
    };
  }
  if (sport === 'mlb') {
    const cached = _mediaCache.get(`mlb:${entry.selection}`);
    return {
      ...base,
      kicker: 'MLB · ALGO HR PICK (LEGACY)',
      matchup: [entry.matchup, 'To hit a home run'].filter(Boolean).join(' · '),
      market: { value: '—', note: 'Legacy free product' },
      model: probabilityPct(snap.hr_probability),
      media: base.media || cached || null,
      portrait: true,
    };
  }
  if (sport === 'nfl') {
    return {
      ...base,
      kicker: `NFL · ${prettyMarket(snap.market).toUpperCase() || 'GAME'} PICK (LEGACY)`,
      matchup: [entry.matchup, formatDateTime(start)].filter(Boolean).join(' · '),
      market: { value: americanOdds(snap.odds), note: 'At publication' },
      model: probabilityPct(snap.model_probability),
      edge: probabilityPointEdge(snap.edge_pct),
      media: { kind: 'team', images: [snap.selected_team_logo_url].filter(Boolean) },
    };
  }
  if (sport === 'ufc') {
    const slot = String(snap.slot || entry.pick_type || '').toUpperCase();
    const cached = _mediaCache.get(`ufc:${entry.selection}`);
    return {
      ...base,
      kicker: `UFC · ${slot === 'UNDERDOG_VALUE' ? 'UNDERDOG VALUE' : slot === 'NEXT_BEST' ? 'NEXT BEST' : 'BEST BET'}`,
      matchup: [entry.opponent ? `vs ${entry.opponent}` : null, snap.event_name, formatDate(snap.event_date)].filter(Boolean).join(' · '),
      market: { value: americanOdds(snap.best_odds ?? snap.consensus_odds), note: [oddsRole(snap.best_odds ?? snap.consensus_odds), snap.best_book || 'At publication'].filter(Boolean).join(' · ') },
      model: probabilityPct(snap.model_probability),
      edge: pointEdge(snap.edge_pts),
      media: base.media || cached || null,
      portrait: true,
    };
  }
  if (sport === 'wnba') {
    // WNBA free picks are official straight-up winner calls, not value bets:
    // price is context, and a model-vs-market "edge" is deliberately not shown.
    const teamId = snap.selected_team_id || snap.pick_team?.team_id || null;
    const lockOdds = snap.odds ?? snap.market_at_lock?.pick?.consensus_moneyline ?? null;
    return {
      ...base,
      kicker: 'WNBA · MODEL PICK',
      matchup: [entry.opponent ? `vs ${entry.opponent}` : entry.matchup, formatDateTime(start), 'To win'].filter(Boolean).join(' · '),
      market: { value: lockOdds != null ? americanOdds(lockOdds) : '—', note: 'ML at publication' },
      model: probabilityPct(snap.model_probability ?? snap.win_probability),
      media: {
        kind: 'team',
        images: [snap.pick_team?.logo, teamId ? `https://wnba.propbetedge.ai/media/teams/${teamId}/128.webp` : null].filter(Boolean),
      },
    };
  }
  // NHL: straight-up winner calls (official or preseason rehearsal).
  const pickTeam = String(snap.pick_team || entry.selection || '').toUpperCase();
  const price = snap.best_price ?? snap.odds ?? null;
  return {
    ...base,
    kicker: snap.preseason ? 'NHL · PRESEASON CALL' : 'NHL · PBE PICK',
    matchup: [entry.matchup, formatDateTime(start), 'To win'].filter(Boolean).join(' · '),
    market: { value: price != null ? americanOdds(price) : '—', note: snap.best_book || snap.book || 'At lock' },
    model: probabilityPct(snap.probability ?? snap.model_probability),
    media: { kind: 'team', images: [snap.pick_team_logo_url || nhlLogoUrl(pickTeam)].filter(Boolean) },
  };
}

async function enrichMedia() {
  if (!_lastTracker) return false;
  const board = buildFreeBoard(_lastTracker, new Date());
  const jobs = [];
  for (const { entry } of board.current) {
    const sport = String(entry.sport || '').toLowerCase();
    if ((sport !== 'mlb' && sport !== 'ufc') || isFeaturedPlayer(entry)) continue;
    const key = `${sport}:${entry.selection}`;
    if (_mediaCache.has(key) || matchFeedCard(entry, _lastPayload)?.media) continue;
    _mediaCache.set(key, null);
    const endpoint = sport === 'mlb' ? '/api/mlb-media' : '/api/ufc-media';
    jobs.push(fetchJson(`${endpoint}?name=${encodeURIComponent(entry.selection)}`).then((media) => {
      const image = sport === 'mlb' ? media?.image : media?.image_url;
      if (!image) return false;
      // Identity-safe lookups only: no image is better than the wrong face.
      _mediaCache.set(key, {
        kind: 'portrait',
        images: [image],
        credit: sport === 'mlb' ? media.source || null : media.attribution_text || media.license || null,
      });
      return true;
    }).catch(() => false));
  }
  return (await Promise.all(jobs)).some(Boolean);
}

/* ---------------------------------------------------------------- render */

function renderHero() {
  return `
    <header class="fp-hero">
      <h1 class="fp-hero__title">Free Picks</h1>
      <p class="fp-hero__lede">Real public calls. Permanent results.</p>
      <p class="fp-hero__sub">MLB Featured Player, 2 free NFL TD Targets and free UFC, WNBA and NHL model picks. Every card is frozen when published and stays in the public ledger.</p>
      <div class="fp-hero__meta">
        <span id="odds-counts">Loading the public ledger…</span>
        <span class="fp-dot" aria-hidden="true">·</span>
        <span id="odds-updated">—</span>
      </div>
    </header>
  `;
}

function renderSkeleton() {
  return `
    ${renderFilter(null)}
    <section class="fp-section fp-current" aria-busy="true">
      <div class="fp-grid">
        ${[0, 1, 2].map(() => '<div class="fp-card fp-card--skel"><div class="skel skel-line" style="width:40%;height:11px"></div><div class="skel skel-line" style="width:70%;height:22px;margin-top:14px"></div><div class="skel skel-line" style="width:100%;height:54px;margin-top:16px"></div></div>').join('')}
      </div>
    </section>
  `;
}

function renderFilter(board) {
  const tabs = [
    { key: 'all', label: 'All', count: board?.current.length },
    ...FREE_SPORTS.map((sport) => ({ key: sport, label: SPORTS[sport].label, count: board?.bySport[sport].current.length })),
  ];
  return `
    <nav class="fp-filter" aria-label="Filter free picks by sport">
      ${tabs.map((tab) => `
        <button type="button" class="fp-filter__tab${_filter === tab.key ? ' is-active' : ''}" data-fp-filter="${tab.key}" aria-pressed="${_filter === tab.key}">
          ${escapeHtml(tab.label)}${Number.isFinite(tab.count) ? `<span class="fp-filter__count">${tab.count}</span>` : ''}
        </button>`).join('')}
      <button type="button" class="fp-filter__tab is-disabled" disabled title="NBA free picks start with the new season">NBA<span class="fp-filter__soon">new season</span></button>
    </nav>
  `;
}

function renderBoard() {
  const boardEl = document.getElementById('odds-board');
  if (!boardEl) return;
  const tracker = _lastTracker;
  const countEl = document.getElementById('odds-counts');
  const updatedEl = document.getElementById('odds-updated');

  if (!tracker?.ok) {
    if (countEl) countEl.textContent = 'Public ledger reconnecting';
    boardEl.innerHTML = `
      ${renderFilter(null)}
      <section class="fp-section fp-current">
        <div class="fp-empty-board">
          <strong>The public ledger is reconnecting.</strong>
          <span>Free picks only appear once they are recorded in the ledger, so nothing is shown until it answers.</span>
        </div>
      </section>`;
    boardEl.dataset.invariant = 'unavailable';
    return;
  }

  const now = new Date();
  const board = buildFreeBoard(tracker, now, liveHints(tracker, _lastPayload));
  const cards = board.current.map(({ entry, state }) => cardFromEntry(entry, state, _lastPayload));
  const visible = _filter === 'all' ? cards : cards.filter((card) => card.sport === _filter);

  if (countEl) {
    const parts = [`${board.counts.current} current`];
    if (board.counts.inPlay) parts.push(`${board.counts.inPlay} in play`);
    parts.push(`${board.counts.settledToday} settled today`);
    countEl.textContent = parts.join(' · ');
  }
  if (updatedEl) updatedEl.textContent = `Updated ${formatUpdatedAt(tracker.generated_at)}`;

  const statusSports = (_filter === 'all' ? FREE_SPORTS : [_filter])
    .filter((sport) => !board.bySport[sport].current.length);

  boardEl.innerHTML = `
    ${renderFilter(board)}
    <section class="fp-section fp-current" aria-labelledby="fp-current-title">
      <h2 id="fp-current-title" class="fp-section__title">Current free picks</h2>
      ${visible.length ? `<div class="fp-grid">${visible.map(renderCard).join('')}</div>` : ''}
      ${statusSports.length ? `<div class="fp-status-list">${statusSports.map((sport) => renderSportStatus(sport, board, tracker)).join('')}</div>` : ''}
    </section>
    ${renderRecord(tracker)}
    ${renderLatestResults(tracker)}
  `;

  const invariant = checkFreePickInvariant({
    displayed: cards.map((card) => ({ public_key: card.publicKey, sport: card.sport, label: card.selection, nonPick: card.nonPick })),
    tracker,
    board,
    feedItems: feedCards(_lastPayload).map((card) => ({
      sport: card.sport,
      label: card.title,
      nonPick: isNonPickOutput(card),
      recorded: (tracker.entries || []).some((entry) => trackerEntryMatchesCard(entry, card)),
    })),
  });
  boardEl.dataset.invariant = invariant.pass ? 'pass' : 'fail';
  window.__PBE_FREE_PICKS = { invariant, counts: board.counts, displayed: cards.map((c) => c.publicKey) };
  if (!invariant.pass) console.warn('[odds] Free pick invariant FAILED:', invariant.failures);
  if (invariant.unrecorded.length) console.info('[odds] Feed picks not in the public ledger (not shown):', invariant.unrecorded.map((x) => `${x.sport}:${x.label}`));

  injectEdgeSchema(cards);
}

function renderAvatar(card) {
  const images = (card.media?.images || []).filter(Boolean);
  const image = images[0] || null;
  const portrait = card.media?.kind === 'portrait' || card.portrait;
  const initials = String(card.selection || '?').split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase();
  const fallback = portrait ? initials : (SPORTS[card.sport]?.emoji || '⚡');
  // UFC media is identity-verified upstream: load it direct first so a proxy
  // hiccup cannot blank a fighter, then fall back through the proxy.
  const primary = image && card.sport === 'ufc' ? image : proxyImage(image);
  const secondary = image && card.sport === 'ufc' ? proxyImage(image) : null;
  const onError = secondary && secondary !== primary
    ? `if(!this.dataset.fb){this.dataset.fb='1';this.src='${escapeAttr(secondary)}';}else{this.remove();}`
    : 'this.remove()';
  return `
    <div class="fp-avatar ${portrait ? 'is-portrait' : 'is-logo'}" aria-hidden="true">
      <span class="fp-avatar__fallback">${escapeHtml(fallback)}</span>
      ${primary ? `<img src="${escapeAttr(primary)}" alt="" loading="lazy" decoding="async" onerror="${onError}">` : ''}
    </div>
  `;
}

function renderCard(card) {
  const metrics = card.metrics || [
    { label: 'Market', value: card.market?.value || '—', note: card.market?.note || '' },
    { label: 'Model', value: card.model || '—' },
  ];
  if (!card.metrics && card.edge) metrics.push({ label: 'Edge', value: card.edge, edge: true });
  const insights = (card.insights || []).filter((i) => i?.label && i?.value);
  return `
    <article class="fp-card" data-sport="${escapeAttr(card.sport)}" data-state="${escapeAttr(card.tone)}" data-public-key="${escapeAttr(card.publicKey)}">
      <header class="fp-card__top">
        <span class="fp-card__kicker">${escapeHtml(card.kicker)}</span>
        <span class="fp-state fp-state--${escapeAttr(card.tone)}">${escapeHtml(card.state)}</span>
      </header>
      <div class="fp-card__id">
        ${renderAvatar(card)}
        <div class="fp-card__names">
          ${card.label ? `<span class="fp-card__label">${escapeHtml(card.label)}</span>` : ''}
          <h3 class="fp-card__selection">${escapeHtml(card.selection)}</h3>
          <p class="fp-card__matchup">${escapeHtml(card.matchup || '')}</p>
          ${card.detail ? `<p class="fp-card__detail">${escapeHtml(card.detail)}</p>` : ''}
        </div>
      </div>
      ${insights.length ? `
      <div class="fp-card__insights">
        <h4>${escapeHtml(card.insightsTitle || 'Why this pick')}</h4>
        <ul>${insights.map((i) => `<li><b>${escapeHtml(i.label)}</b><span>${escapeHtml(i.value)}</span></li>`).join('')}</ul>
      </div>` : ''}
      ${metrics.length ? `
      <dl class="fp-card__metrics fp-card__metrics--${metrics.length}">
        ${metrics.map((m) => `
          <div class="${m.edge ? 'is-edge' : ''}">
            <dt>${escapeHtml(m.label)}</dt>
            <dd>${escapeHtml(m.value)}</dd>
            ${m.note ? `<small>${escapeHtml(m.note)}</small>` : ''}
          </div>`).join('')}
      </dl>` : ''}
      ${card.note ? `<p class="fp-card__note">${escapeHtml(card.note)}</p>` : ''}
      <div class="fp-card__actions">
        <a class="fp-card__cta" href="${escapeAttr(card.ctaHref || card.href)}" target="_blank" rel="noopener" data-pbe-placement="free_picks_card_${escapeAttr(card.sport)}">${escapeHtml(card.ctaLabel || 'Open full intelligence →')}</a>
        ${card.secondary ? `<a class="fp-card__cta fp-card__cta--ghost" href="${escapeAttr(card.secondary.href)}" target="_blank" rel="noopener">${escapeHtml(card.secondary.label)}</a>` : ''}
      </div>
    </article>
  `;
}

function renderSportStatus(sport, board, tracker) {
  const meta = SPORTS[sport];
  const settled = board.bySport[sport].settledToday;
  const feed = _lastPayload?.[sport];
  let copy;
  if (settled.length) {
    const wins = settled.filter((e) => e.result === 'WIN').length;
    const losses = settled.filter((e) => e.result === 'LOSS').length;
    copy = `Today's ${settled.length} free ${settled.length === 1 ? 'call is' : 'calls are'} settled (${wins}–${losses}). Results are below and in the record.`;
  } else if (sport === 'mlb') {
    copy = feed?.emptyState?.code === 'no_games'
      ? 'No MLB games today, so no Featured Player. It returns with the next slate.'
      : "Today's Featured Player posts before first pitch. Official Algo Picks are members-only.";
  } else if (sport === 'nfl') {
    copy = 'No qualified free TD targets yet. Up to two primary TD Targets post automatically once they are named for the slate.';
  } else {
    copy = `No current ${meta.label} free pick. The next published call appears here automatically.`;
  }
  const rec = sportRecord(tracker, sport);
  return `
    <div class="fp-status" data-sport="${sport}">
      <span class="fp-status__sport"><span aria-hidden="true">${meta.emoji}</span> ${meta.label}</span>
      <span class="fp-status__copy">${escapeHtml(copy)}</span>
      <span class="fp-status__rec">${escapeHtml(rec.record)}</span>
    </div>
  `;
}

function renderNamespacedRecords(tracker) {
  const featured = namespacedRecord(tracker, 'free_featured_player_record');
  const td = namespacedRecord(tracker, 'free_td_target_record');
  const mlbAlgo = namespacedRecord(tracker, 'legacy.mlb_algo_free_picks');
  const nflTeam = namespacedRecord(tracker, 'legacy.nfl_team_picks');
  if (!featured && !td) return '';
  const row = (label, rec, note) => rec ? `<li><span>${escapeHtml(label)}</span><b>${escapeHtml(rec.record)}</b>${rec.pending ? `<small>${rec.pending} pending</small>` : ''}${note ? `<small>${escapeHtml(note)}</small>` : ''}</li>` : '';
  return `
      <div class="fp-record__products">
        <h3>Free products · separate records</h3>
        <ul class="fp-record__sports">
          ${row('MLB Featured Player', featured, 'Engagement record · not an Algo record')}
          ${row('NFL Free TD Targets', td, 'Since Sep 27, 2026')}
          ${row('MLB Algo free picks (legacy)', mlbAlgo, 'Before Sep 28, 2026')}
          ${row('NFL team picks (legacy)', nflTeam, 'Before Sep 27, 2026')}
        </ul>
      </div>`;
}

function renderRecord(tracker) {
  const r = recordSummary(tracker);
  return `
    <section class="fp-section fp-record" aria-labelledby="fp-record-title">
      <div class="fp-record__main">
        <h2 id="fp-record-title" class="fp-record__label">Public free record</h2>
        <strong class="fp-record__value">${escapeHtml(r.record)}</strong>
        <span class="fp-record__sub">${r.hitRate == null ? 'No settled picks yet' : `${r.hitRate.toFixed(1)}% of settled picks hit`} · ${r.pending} pending</span>
      </div>
      <ul class="fp-record__sports">
        ${FREE_SPORTS.map((sport) => {
          const s = sportRecord(tracker, sport);
          return `<li><span>${SPORTS[sport].label}</span><b>${escapeHtml(s.record)}</b>${s.pending ? `<small>${s.pending} pending</small>` : ''}</li>`;
        }).join('')}
      </ul>
      ${renderNamespacedRecords(tracker)}
      <div class="fp-record__foot">
        <a href="/odds/history">Full history →</a>
        <span>Started Sep 20, 2026 · no backfill</span>
      </div>
    </section>
  `;
}

function renderLatestResults(tracker) {
  const receipts = latestResults(tracker, { max: 6, perSport: 2 });
  if (!receipts.length) return '';
  return `
    <section class="fp-section fp-results" aria-labelledby="fp-results-title">
      <h2 id="fp-results-title" class="fp-section__title">Latest results</h2>
      <ol class="fp-receipts">
        ${receipts.map((entry) => {
          const label = RESULT_LABELS[entry.result] || entry.result;
          return `
          <li class="fp-receipt" data-sport="${escapeAttr(String(entry.sport || '').toLowerCase())}">
            <span class="fp-receipt__badge is-${escapeAttr(label.toLowerCase())}">${escapeHtml(label)}</span>
            <div class="fp-receipt__body">
              <b>${escapeHtml(entry.selection || 'Free pick')}</b>
              <small>${escapeHtml([entry.sport, isFeaturedPlayer(entry) || isTdTarget(entry) ? productLabel(entry).split(' · ')[0] : null, entry.matchup || (entry.opponent ? `vs ${entry.opponent}` : null), entry.score].filter(Boolean).join(' · '))}</small>
            </div>
            <time datetime="${escapeAttr(eventDate(entry) || '')}">${escapeHtml(formatDate(eventDate(entry)))}</time>
          </li>`;
        }).join('')}
      </ol>
    </section>
  `;
}

function renderHowItWorks() {
  return `
    <section class="fp-section fp-how" aria-labelledby="fp-how-title">
      <h2 id="fp-how-title" class="fp-section__title">How it works</h2>
      <ul class="fp-how__list">
        <li><b>MLB Featured Player.</b> One established hitter a day, chosen from public season, Player DNA and matchup data. It is not an official Algo Pick: its results count in the free record and its own Featured Player record, never in any Algo record. Official Algo Picks are members-only.</li>
        <li><b>NFL: 2 Free TD Targets.</b> Up to two primary Touchdown Targets per slate, official targets first, then tracking targets while the model completes its validation window. Tracking targets are labelled and never count as official. Own record; never padded.</li>
        <li><b>UFC, WNBA and NHL.</b> Each publishes from its own model and rules. No filler picks.</li>
        <li><b>Frozen on publication.</b> Each card is recorded the moment it appears here. Only the result can change.</li>
        <li><b>Graded from official results.</b> HIT, MISS, PUSH or VOID lands in the public record automatically.</li>
      </ul>
    </section>
  `;
}

function renderAllAccessCta() {
  return `
    <section class="fp-cta">
      <div>
        <strong>Want the full card?</strong>
        <span>All Access unlocks every official Algo Pick and Game Best, the full TD Target board, probabilities, Matchup DNA and every sport's model picks.</span>
      </div>
      <a class="fp-cta__btn" href="/pro" data-pbe-placement="free_picks_all_access">See All Access</a>
      <small class="fp-cta__fine">21+ where applicable · Odds move · Model output is not a guarantee · Bet responsibly</small>
    </section>
  `;
}

function injectEdgeSchema(cards) {
  const existing = document.getElementById('jsonld-odds-edges');
  if (existing) existing.remove();
  if (!cards.length) return;
  const sportName = { mlb: 'Baseball', nfl: 'American Football', ufc: 'Mixed Martial Arts', wnba: 'Basketball', nhl: 'Ice Hockey' };
  const tag = document.createElement('script');
  tag.id = 'jsonld-odds-edges';
  tag.type = 'application/ld+json';
  tag.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'PropBetEdge Free Picks',
    description: 'Current public free picks from PropBetEdge, recorded in a permanent public ledger.',
    numberOfItems: cards.length,
    itemListElement: cards.map((card, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'SportsEvent',
        name: `${card.selection} — ${card.matchup}`,
        description: card.kicker === 'MLB · FREE PLAYER PICK'
          ? 'PropBetEdge free MLB Featured Player (editorial showcase, not an official Algo Pick)'
          : card.kicker === 'NFL · FREE TD TARGET' ? 'PropBetEdge free NFL TD Target' : `PropBetEdge free ${card.sport.toUpperCase()} pick`,
        sport: sportName[card.sport] || card.sport.toUpperCase(),
      },
    })),
  });
  document.head.appendChild(tag);
}


/* ------------------------------------------------------------ formatting */

function ordinal(n) {
  const v = Number(n);
  const s = ['th', 'st', 'nd', 'rd'];
  const m = v % 100;
  return `${v}${s[(m - 20) % 10] || s[m] || s[0]}`;
}

function americanOdds(value) {
  if (value == null || value === '') return '—';
  const raw = String(value).trim();
  if (/^[+-]\d+$/.test(raw)) return raw;
  const n = Number(value);
  if (!Number.isFinite(n)) return raw || '—';
  return n > 0 ? `+${Math.round(n)}` : String(Math.round(n));
}

function oddsRole(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.abs(n) === 100 || n === 0 ? 'EVEN' : n < 0 ? 'FAV' : 'DOG';
}

function probabilityPct(value) {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const pct = Math.abs(n) <= 1 ? n * 100 : n;
  return `${pct.toFixed(1)}%`;
}

function probabilityPointEdge(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const pts = Math.abs(n) <= 1 ? n * 100 : n;
  return `${pts > 0 ? '+' : ''}${pts.toFixed(1)} pp`;
}

function pointEdge(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return `${n > 0 ? '+' : ''}${n.toFixed(1)} pp`;
}

function prettyMarket(value) {
  const market = String(value || '').toLowerCase();
  if (market === 'moneyline') return 'Moneyline';
  if (market === 'spread') return 'Spread';
  if (market === 'total') return 'Total';
  return value ? String(value) : '';
}

function formatDateTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleString('en-US', {
    timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  });
}

function formatDate(value) {
  if (!value) return '';
  const d = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' });
}

function latestTimestamp(values) {
  const valid = values
    .map((value) => ({ value, ts: Date.parse(value || '') }))
    .filter((row) => Number.isFinite(row.ts))
    .sort((a, b) => b.ts - a.ts);
  return valid[0]?.value || null;
}

function formatUpdatedAt(iso) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return 'recently';
  return d.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }) + ' ET';
}

export function teardownOdds() {
  if (_refreshTimer) clearInterval(_refreshTimer);
  if (_trackerTimer) clearInterval(_trackerTimer);
  _refreshTimer = null;
  _trackerTimer = null;
}
