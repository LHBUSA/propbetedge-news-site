/**
 * src/pages/odds.js
 * Cross-sport public sampler for the PropBetEdge network.
 *
 * Contract:
 *   - MLB: up to 2 free current HR model picks when qualified picks are published
 *   - NFL: up to 2 current PBE picks / validation signals
 *   - UFC: up to 2 current PBE Algo calls — Best Bet + Underdog Value
 *
 * The board is intentionally small. Full cards, research and track records
 * stay inside each sport product. Each source fails independently so one sport
 * can never take the whole funnel down.
 */

import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { escapeHtml } from '../components/article-card.js';
import { PROPBET_LINKS, proxyImage } from '../ads-config.js';
import {
  organizationSchema, websiteSchema, breadcrumbSchema, injectSchemas,
} from '../schema.js';

const MLB_HR_SAMPLE_URL = 'https://mlb.propbetedge.ai/api/free-hr-sample';
const MLB_ODDS_CACHE_URL = 'https://propbetedge-odds-cache.sales-fd3.workers.dev';
const NFL_SAMPLE_URL = 'https://nfl.propbetedge.ai/api/pbe-picks?view=free-sample';
const UFC_SAMPLE_URL = 'https://ufc.propbetedge.ai/api/ufc/free-sample';
const WNBA_SAMPLE_URL = 'https://wnba-api.propbetedge.ai/v1/pbe/free-sample';
const NHL_SAMPLE_URL = 'https://nhl-api.propbetedge.ai/nhl/picks/free-sample';
const NHL_PRESEASON_URL = (date) => `https://nhl-api.propbetedge.ai/nhl/picks/preseason?date=${encodeURIComponent(date)}`;
const FREE_TRACKER_URL = 'https://tkmlnhmylqnttmnsnief.supabase.co/functions/v1/free-picks-tracker';
// Keep the multi-sport board on its natural one-minute cadence, but NHL result
// receipts are a live proof surface and poll independently every 10 seconds.
// MLB identity exposure remains capped by its own publisher, so no extra MLB
// picks can rotate through from the NHL-specific refresh.
const REFRESH_INTERVAL_MS = 60 * 1000;
const NHL_REFRESH_INTERVAL_MS = 10 * 1000;
const TRACKER_REFRESH_INTERVAL_MS = 10 * 1000;
const NHL_MAX_FREE_PICKS = 2;
let _refreshTimer = null;
let _nhlRefreshTimer = null;
let _trackerTimer = null;
let _lastPayload = null;
let _lastTracker = null;
let _nhlRefreshInFlight = false;
let _trackerRefreshInFlight = false;

const SPORTS = Object.freeze({
  mlb: {
    label: 'MLB',
    emoji: '⚾',
    href: PROPBET_LINKS.picks_mlb,
    cta: 'Open MLB Intelligence',
    deck: 'Up to 2 free home run props from the current MLB model.',
    cadence: 'Up to 2 free HR props · refreshed on the MLB publishing cadence',
  },
  nfl: {
    label: 'NFL',
    emoji: '🏈',
    href: PROPBET_LINKS.picks_nfl,
    cta: 'Open NFL Intelligence',
    deck: 'Game-market decisions from the PBE Picks engine.',
    cadence: 'Weekly slate · refreshed as markets move',
  },
  ufc: {
    label: 'UFC',
    emoji: '🥊',
    href: PROPBET_LINKS.picks_ufc,
    cta: 'Open UFC Intelligence',
    deck: 'Up to 2 free fight-model calls from the current PBE model.',
    cadence: 'Fight week · refreshed as the card and market move',
  },
  wnba: {
    label: 'WNBA',
    emoji: '🏀',
    href: PROPBET_LINKS.picks_wnba,
    cta: 'Open WNBA Intelligence',
    deck: 'Current game-prediction calls from the WNBA model.',
    cadence: 'Up to 2 daily free picks · published calls stay locked all day',
  },
  nhl: {
    label: 'NHL',
    emoji: '🏒',
    href: PROPBET_LINKS.picks_nhl,
    cta: 'Open NHL Intelligence',
    deck: 'Locked NHL algo calls with public result receipts as games finish.',
    cadence: 'NHL board checks every 10s · preseason and official calls stay visibly graded',
  },
  nba: {
    label: 'NBA',
    emoji: '🏀',
    href: PROPBET_LINKS.picks_nba,
    cta: 'Open NBA Preview',
    deck: 'NBA joins the free board with the new season next month.',
    cadence: 'Coming next month',
    comingSoon: true,
  },
});

export async function renderOdds(root) {
  root.innerHTML = `
    ${renderHeader()}
    <main class="odds-page free-board-page">
      <div class="container" style="padding-top:32px">
        ${renderHero()}
        <div id="odds-board">${renderSkeleton()}</div>
        ${renderHowItWorks()}
        ${renderNetworkCta()}
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

  await loadAndRender();

  if (_refreshTimer) clearInterval(_refreshTimer);
  if (_nhlRefreshTimer) clearInterval(_nhlRefreshTimer);
  if (_trackerTimer) clearInterval(_trackerTimer);
  _refreshTimer = setInterval(loadAndRender, REFRESH_INTERVAL_MS);
  _nhlRefreshTimer = setInterval(refreshNhlOnly, NHL_REFRESH_INTERVAL_MS);
  _trackerTimer = setInterval(refreshTrackerOnly, TRACKER_REFRESH_INTERVAL_MS);
}

async function loadAndRender() {
  const [mlbHr, nfl, ufc, wnba, nhl] = await Promise.allSettled([
    fetchCachedSampleJson(`${MLB_HR_SAMPLE_URL}?date=${encodeURIComponent(todayEtDate())}`),
    fetchJson(NFL_SAMPLE_URL),
    fetchJson(UFC_SAMPLE_URL),
    fetchJson(WNBA_SAMPLE_URL),
    loadNhlSource(),
  ]);

  const mlbOdds = await loadMlbOddsSnapshots(mlbHr);

  const payload = {
    mlb: buildMlbSource(mlbHr, mlbOdds),
    nfl: nfl.status === 'fulfilled' ? normalizeNfl(nfl.value) : sourceFailure('nfl', nfl.reason),
    ufc: ufc.status === 'fulfilled' ? normalizeUfc(ufc.value) : sourceFailure('ufc', ufc.reason),
    wnba: wnba.status === 'fulfilled' ? normalizeWnba(wnba.value) : sourceFailure('wnba', wnba.reason),
    nhl: nhl.status === 'fulfilled' ? nhl.value : sourceFailure('nhl', nhl.reason),
  };

  await Promise.all([
    enrichMlbMedia(payload.mlb),
    enrichUfcMedia(payload.ufc),
  ]);
  _lastPayload = payload;
  try {
    _lastTracker = await fetchJson(FREE_TRACKER_URL);
  } catch (error) {
    console.warn('[odds] Free Picks Track Record unavailable:', error);
  }
  pinWnbaDailyFreeBoard(payload, _lastTracker);
  applyTrackerOutcomes(payload, _lastTracker);
  renderBoard(payload, _lastTracker);
  injectEdgeSchema(payload);
}

async function refreshNhlOnly() {
  if (_nhlRefreshInFlight || !_lastPayload || !document.getElementById('odds-board')) return;
  _nhlRefreshInFlight = true;
  try {
    const nhl = await loadNhlSource();
    _lastPayload = { ..._lastPayload, nhl };
    applyTrackerOutcomes(_lastPayload, _lastTracker);
    renderBoard(_lastPayload, _lastTracker);
    injectEdgeSchema(_lastPayload);
  } catch (error) {
    console.warn('[odds] NHL rapid refresh unavailable:', error);
  } finally {
    _nhlRefreshInFlight = false;
  }
}

async function refreshTrackerOnly() {
  if (_trackerRefreshInFlight || !_lastPayload || !document.getElementById('odds-board')) return;
  _trackerRefreshInFlight = true;
  try {
    const tracker = await fetchJson(FREE_TRACKER_URL);
    if (tracker?.ok) _lastTracker = tracker;
    pinWnbaDailyFreeBoard(_lastPayload, _lastTracker);
    applyTrackerOutcomes(_lastPayload, _lastTracker);
    renderBoard(_lastPayload, _lastTracker);
  } catch (error) {
    console.warn('[odds] Free Picks Track Record refresh unavailable:', error);
  } finally {
    _trackerRefreshInFlight = false;
  }
}

async function loadNhlSource() {
  const date = todayEtDate();
  const [official, preseason] = await Promise.allSettled([
    fetchJson(NHL_SAMPLE_URL),
    fetchJson(NHL_PRESEASON_URL(date)),
  ]);
  return normalizeNhlSources({ official, preseason, date });
}

function todayEtDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type) => parts.find((x) => x.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store', credentials: 'omit' });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

async function fetchCachedSampleJson(url) {
  const response = await fetch(url, { cache: 'no-store', credentials: 'omit' });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

function sourceFailure(sport, error) {
  console.warn(`[odds] ${sport} source unavailable:`, error);
  return { sport, cards: [], generatedAt: null, unavailable: true };
}

function buildMlbSource(hrResult, oddsSnapshots = {}) {
  const available = hrResult.status === 'fulfilled';
  const data = available ? hrResult.value : {};
  const rawPicks = Array.isArray(data?.picks)
    ? data.picks
    : [data?.early_bird, data?.featured].filter(Boolean);

  const seen = new Set();
  const picks = rawPicks.filter((pick) => {
    const key = String(pick?.mlb_player_id || pick?.player_name || pick?.id || '').trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 2);

  const cards = picks.map((pick, index) => normalizeMlbHrPick(
    pick,
    data,
    oddsSnapshots.batter_home_runs,
    index,
  )).filter(Boolean);

  return {
    sport: 'mlb',
    cards,
    generatedAt: latestTimestamp([
      available ? data?.generated_at : null,
      oddsSnapshots.batter_home_runs?.cachedAt || oddsSnapshots.batter_home_runs?.snapshot?.captured_at || null,
    ]),
    unavailable: !available,
    stateTitle: cards.length ? null : 'No free MLB HR props right now',
    stateCopy: cards.length
      ? null
      : 'The MLB board publishes only current home run picks. It will repopulate from the next model cycle.',
  };
}

function normalizeMlbHrPick(pick, data, oddsSnapshot, index = 0) {
  if (!pick?.player_name) return null;

  const score = Number(pick.model_score);
  const context = [
    pick.team,
    pick.opponent ? `vs ${pick.opponent}` : null,
    Number.isFinite(Number(pick.batting_order)) ? `Batting #${pick.batting_order}` : null,
  ].filter(Boolean).join(' · ');
  const live = findBestMlbOffer(oddsSnapshot, 'batter_home_runs', pick.player_name, 0.5, 'Over');
  const marketProbability = live?.fairProbability ?? live?.impliedProbability ?? null;
  const snapshotStamp = oddsSnapshot?.cachedAt || oddsSnapshot?.snapshot?.captured_at || null;

  return {
    sport: 'mlb',
    variant: 'hr-spotlight',
    eyebrow: `MLB · FREE HR PICK #${index + 1}`,
    title: pick.player_name,
    selection: 'TO HIT A HOME RUN',
    context,
    odds: live ? americanOdds(live.price) : 'PENDING',
    oddsLabel: live ? (live.bookTitle || live.bookKey || 'LIVE ODDS') : 'LIVE ODDS',
    metrics: [
      { label: 'HR PROB', value: probabilityPct(pick.hr_probability) },
      { label: 'PBE SCORE', value: Number.isFinite(score) ? `${Math.round(score)}/100` : '—' },
      { label: 'MARKET', value: live ? probabilityPct(marketProbability) : 'Pending' },
    ],
    detail: live
      ? `Free HR prop · live market matched${snapshotStamp ? ` · ${formatRelativeStamp(snapshotStamp)}` : ''}`
      : 'Free HR prop · live market pricing pending',
    timestamp: latestTimestamp([data?.generated_at, snapshotStamp]),
    trackerPeriod: pick.game_date || data?.game_date || null,
    trackerSourceRecordId: pick.id || null,
    trackerPlayerId: pick.mlb_player_id ? String(pick.mlb_player_id) : null,
    href: data?.full_product_url || PROPBET_LINKS.hr_targets || SPORTS.mlb.href,
    media: pick.player_image ? {
      kind: 'portrait',
      images: [pick.player_image],
      alt: `${pick.player_name} MLB player photo`,
      credit: 'MLB',
    } : null,
  };
}

function normalizeNfl(data) {
  const cards = (Array.isArray(data?.picks) ? data.picks : []).slice(0, 2).map((pick) => {
    const matchup = pick.matchup?.away_team && pick.matchup?.home_team
      ? `${pick.matchup.away_team} @ ${pick.matchup.home_team}`
      : 'NFL matchup';
    const scope = pick.scope_label || (pick.publication_scope === 'tracking' ? 'PBE VALIDATION SIGNAL' : 'PBE PICK');

    return {
      sport: 'nfl',
      eyebrow: `NFL · ${scope}`,
      title: pick.selection || 'NFL pick',
      selection: matchup,
      context: [prettyMarket(pick.market), formatDateTime(pick.kickoff_ts)].filter(Boolean).join(' · '),
      odds: americanOdds(pick.odds),
      oddsLabel: 'Market at issue',
      model: probabilityPct(pick.model_probability),
      market: probabilityPct(pick.market_probability),
      edge: probabilityPointEdge(pick.edge_pct),
      detail: [pick.confidence ? `Confidence ${pick.confidence}` : null, pick.lifecycle].filter(Boolean).join(' · '),
      timestamp: data.generated_at || pick.issued_at || null,
      trackerEventStartAt: pick.kickoff_ts || null,
      href: SPORTS.nfl.href,
      media: {
        kind: 'team',
        images: [pick.selected_team_logo_url || pick.matchup?.away_logo_url, pick.selected_team_logo_url ? null : pick.matchup?.home_logo_url].filter(Boolean),
        alt: pick.selected_team ? `${pick.selected_team} team logo` : matchup,
      },
    };
  });

  return {
    sport: 'nfl',
    cards,
    generatedAt: data?.generated_at || null,
    unavailable: false,
  };
}

function normalizeUfc(data) {
  const rawPicks = Array.isArray(data?.picks) && data.picks.length
    ? data.picks
    : data?.pick
      ? [data.pick]
      : [];

  const cards = rawPicks.slice(0, 2).map((pick, index) => {
    const slot = pick.slot || (index === 0 ? 'BEST_BET' : pick.is_upset_pick ? 'UNDERDOG_VALUE' : 'NEXT_BEST');
    const slotLabel = slot === 'UNDERDOG_VALUE'
      ? 'UNDERDOG VALUE'
      : slot === 'NEXT_BEST'
        ? 'NEXT BEST'
        : 'BEST BET';

    return {
      sport: 'ufc',
      variant: slot === 'UNDERDOG_VALUE' ? 'ufc-top-upset' : null,
      eyebrow: `UFC · ${slotLabel}`,
      title: pick.pick_name || 'UFC pick',
      selection: pick.opponent_name ? `vs ${pick.opponent_name}` : pick.matchup || 'Fight pick',
      context: [pick.event_name, formatDate(pick.event_date)].filter(Boolean).join(' · '),
      odds: ufcAmericanOdds(pick.best_odds ?? pick.consensus_odds),
      oddsLabel: pick.best_book || (pick.best_odds != null ? 'Best available' : 'Consensus'),
      model: probabilityPct(pick.model_probability),
      market: probabilityPct(pick.market_probability),
      edge: pointEdge(pick.edge_pts),
      detail: slot === 'UNDERDOG_VALUE'
        ? [
            'PBE +money underdog value',
            pick.upset_rank ? `Upset Radar #${pick.upset_rank}` : null,
            pick.lifecycle,
          ].filter(Boolean).join(' · ')
        : [
            pick.confidence ? `Confidence ${pick.confidence}` : null,
            pick.lifecycle,
            pick.observed_at ? `Market ${formatRelativeStamp(pick.observed_at)}` : null,
          ].filter(Boolean).join(' · '),
      timestamp: data.generated_at || pick.observed_at || null,
      trackerEventDate: pick.event_date || null,
      href: data.full_product_url || SPORTS.ufc.href,
      media: pick.media?.image_url ? {
        kind: 'portrait',
        images: [pick.media.image_url],
        alt: `${pick.pick_name || 'UFC fighter'} fighter portrait`,
        credit: pick.media.attribution_text || null,
      } : null,
    };
  });

  return {
    sport: 'ufc',
    cards,
    generatedAt: data?.generated_at || null,
    unavailable: false,
    stateTitle: cards.length ? null : 'No qualifying UFC free picks right now',
    stateCopy: cards.length
      ? null
      : 'The UFC model only publishes current eligible calls. It will not manufacture an underdog or filler pick.',
  };
}

async function enrichMlbMedia(source) {
  if (!source?.cards?.length) return;
  await Promise.all(source.cards.map(async (card) => {
    if (card.media?.images?.length) return;
    try {
      const media = await fetchJson(`/api/mlb-media?name=${encodeURIComponent(card.title)}`);
      if (media?.image) {
        card.media = {
          kind: 'portrait',
          images: [media.image],
          alt: `${card.title} player photo`,
          credit: media.source || null,
        };
      }
    } catch {
      // No exact identity-safe image is better than the wrong player's face.
    }
  }));
}

async function enrichUfcMedia(source) {
  if (!source?.cards?.length) return;
  await Promise.all(source.cards.map(async (card) => {
    if (card.media?.images?.length) return;
    try {
      const media = await fetchJson(`/api/ufc-media?name=${encodeURIComponent(card.title)}`);
      if (media?.image_url) {
        card.media = {
          kind: 'portrait',
          images: [media.image_url],
          alt: `${card.title} fighter portrait`,
          credit: media.attribution_text || media.license || null,
        };
      }
    } catch {
      // The fighter card remains useful without a portrait.
    }
  }));
}

function wnbaTrackerCards(tracker) {
  if (!tracker?.ok || !Array.isArray(tracker.entries)) return [];
  const today = todayEtDate();
  return tracker.entries
    .filter((entry) => (
      String(entry?.sport || '').toUpperCase() === 'WNBA'
      && String(entry?.period_start || '') === today
      && entry?.evidence?.suppressed !== true
    ))
    .sort((a, b) => Number(a.slot || 0) - Number(b.slot || 0))
    .slice(0, 2)
    .map((entry) => {
      const snap = entry.snapshot || {};
      const selectedTeamId = snap.selected_team_id || snap.pick_team?.team_id || null;
      const modelProbability = snap.model_probability ?? snap.win_probability ?? null;
      const marketProbability = snap.market_probability
        ?? snap.market_devig_probability
        ?? snap.market_at_lock?.pick?.devig_probability
        ?? null;
      const rawEdge = snap.edge_pts
        ?? snap.market_at_lock?.pbe_edge_pts
        ?? (Number.isFinite(Number(snap.pbe_edge_at_lock)) ? Number(snap.pbe_edge_at_lock) * 100 : null);
      const lockOdds = snap.odds
        ?? snap.market_at_lock?.pick?.consensus_moneyline
        ?? null;
      const title = entry.selection || snap.pick_team?.name || snap.pick_team?.abbr || 'WNBA pick';
      const opponent = entry.opponent || snap.opponent?.name || snap.opponent?.abbr || null;
      const matchup = entry.matchup || [
        snap.away?.abbr || snap.away?.name,
        snap.home?.abbr || snap.home?.name,
      ].filter(Boolean).join(' @ ');

      return {
        sport: 'wnba',
        variant: 'wnba-daily-locked',
        trackerKey: entry.public_key || null,
        eyebrow: `WNBA · DAILY FREE PICK #${Number(entry.slot || 1)}`,
        title,
        selection: opponent ? `vs ${opponent}` : matchup,
        context: [matchup, formatDateTime(entry.event_start_at)].filter(Boolean).join(' · '),
        odds: lockOdds != null ? americanOdds(lockOdds) : 'LOCKED',
        oddsLabel: lockOdds != null ? 'At publication' : 'Published pick',
        model: probabilityPct(modelProbability),
        market: probabilityPct(marketProbability),
        edge: pointEdge(rawEdge),
        detail: [
          snap.confidence ? `Confidence ${snap.confidence}` : null,
          entry.published_at ? `Published ${formatRelativeStamp(entry.published_at)}` : null,
        ].filter(Boolean).join(' · '),
        timestamp: entry.result_at || entry.published_at || tracker.generated_at || null,
        href: SPORTS.wnba.href,
        media: {
          kind: 'team',
          images: [
            snap.pick_team?.logo,
            selectedTeamId ? `https://wnba.propbetedge.ai/media/teams/${selectedTeamId}/128.webp` : null,
          ].filter(Boolean),
          alt: title ? `${title} team logo` : 'WNBA team logo',
        },
        trackerEntry: entry,
      };
    });
}

function pinWnbaDailyFreeBoard(payload, tracker) {
  if (!payload?.wnba) return;
  const cards = wnbaTrackerCards(tracker);
  if (!cards.length) return;

  payload.wnba = {
    ...payload.wnba,
    cards,
    generatedAt: latestTimestamp([payload.wnba.generatedAt, tracker.generated_at]),
    unavailable: false,
    stateTitle: null,
    stateCopy: null,
    pinnedToDailyLedger: true,
  };
}

function normalizeWnba(data) {
  const body = data?.data || data || {};
  const cards = (Array.isArray(body.picks) ? body.picks : []).slice(0, 2).map((pick) => {
    const home = pick.home?.abbr || pick.home?.name || 'HOME';
    const away = pick.away?.abbr || pick.away?.name || 'AWAY';
    const pickName = pick.pick_team?.name || pick.pick_team?.short_name || pick.pick_team?.abbr || 'WNBA pick';
    const opponent = pick.opponent?.name || pick.opponent?.short_name || pick.opponent?.abbr || null;
    return {
      sport: 'wnba',
      eyebrow: `WNBA · ${pick.phase === 'LOCKED' ? 'LOCKED PBE PICK' : 'PBE MODEL CALL'}`,
      title: pickName,
      selection: opponent ? `vs ${opponent}` : `${away} @ ${home}`,
      context: [`${away} @ ${home}`, formatDateTime(pick.scheduled_tip_utc)].filter(Boolean).join(' · '),
      odds: americanOdds(pick.odds),
      oddsLabel: pick.odds != null ? 'Consensus' : 'Market pending',
      model: probabilityPct(pick.model_probability),
      market: probabilityPct(pick.market_probability),
      edge: pointEdge(pick.edge_pts),
      detail: [pick.confidence ? `Confidence ${pick.confidence}` : null, pick.phase].filter(Boolean).join(' · '),
      timestamp: body.generated_at || pick.locked_at || null,
      gameId: pick.game_id || null,
      href: body.full_product_url || SPORTS.wnba.href,
      media: {
        kind: 'team',
        images: [pick.pick_team?.logo].filter(Boolean),
        alt: pickName,
      },
    };
  });

  return {
    sport: 'wnba',
    cards,
    generatedAt: body.generated_at || null,
    unavailable: false,
    stateTitle: body.published === false ? 'Model not published yet' : null,
    stateCopy: body.published === false ? 'The WNBA model remains fail-closed until its publication contract is live.' : null,
  };
}

function normalizeNhlSources({ official, preseason, date }) {
  const officialSource = official.status === 'fulfilled'
    ? normalizeNhlOfficial(official.value)
    : sourceFailure('nhl', official.reason);
  const preseasonSource = preseason.status === 'fulfilled'
    ? normalizeNhlPreseason(preseason.value, date)
    : sourceFailure('nhl', preseason.reason);

  const seen = new Set();
  const cards = [...officialSource.cards, ...preseasonSource.cards].filter((card) => {
    const key = String(card.gameId || `${card.title}|${card.selection}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, NHL_MAX_FREE_PICKS);

  const validating = official.value?.reason === 'no_official_model'
    || official.value?.publish_gate?.open === false;

  return {
    sport: 'nhl',
    cards,
    generatedAt: latestTimestamp([officialSource.generatedAt, preseasonSource.generatedAt]),
    unavailable: official.status === 'rejected' && preseason.status === 'rejected',
    stateTitle: cards.length ? null : validating ? 'Official model in validation' : 'No NHL algo calls on the free board yet',
    stateCopy: cards.length
      ? null
      : validating
        ? 'Official regular-season calls remain gated, but published preseason rehearsal calls will appear here automatically when locked.'
        : 'The NHL sampler only shows real locked calls. It does not manufacture a pick to fill the board.',
  };
}

function normalizeNhlOfficial(data) {
  const cards = (Array.isArray(data?.picks) ? data.picks : []).map((pick) => {
    const away = pick.matchup?.away || 'AWAY';
    const home = pick.matchup?.home || 'HOME';
    const outcome = nhlOutcome(pick.result, {
      away,
      home,
      awayScore: pick.final_score?.away,
      homeScore: pick.final_score?.home,
      gradedAt: pick.graded_at,
    });
    return {
      sport: 'nhl',
      gameId: pick.game_id || null,
      eyebrow: 'NHL · LOCKED PBE PICK',
      title: pick.pick_team || 'NHL pick',
      selection: pick.opponent_team ? `vs ${pick.opponent_team}` : `${away} @ ${home}`,
      context: [`${away} @ ${home}`, formatDateTime(pick.start_utc)].filter(Boolean).join(' · '),
      odds: americanOdds(pick.odds),
      oddsLabel: pick.book || (pick.odds != null ? 'Best at lock' : 'Unpriced'),
      model: probabilityPct(pick.model_probability),
      market: probabilityPct(pick.market_probability),
      edge: pointEdge(pick.edge_pts),
      detail: outcome
        ? [outcome.score, outcome.gradedAt ? `Graded ${formatRelativeStamp(outcome.gradedAt)}` : null].filter(Boolean).join(' · ')
        : [pick.confidence ? `Confidence ${pick.confidence}` : null, pick.locked_at ? `Locked ${formatRelativeStamp(pick.locked_at)}` : null].filter(Boolean).join(' · '),
      outcome,
      timestamp: latestTimestamp([pick.graded_at, data.fetched_at, pick.locked_at]),
      href: data.full_product_url || SPORTS.nhl.href,
      media: {
        kind: 'team',
        images: [
          pick.pick_team_logo_url || nhlLogoUrl(pick.pick_team),
          pick.opponent_team_logo_url || nhlLogoUrl(pick.opponent_team),
        ].filter(Boolean),
        alt: pick.pick_team ? `${pick.pick_team} vs ${pick.opponent_team || 'opponent'} team logos` : 'NHL team logos',
      },
    };
  });

  return {
    sport: 'nhl',
    cards,
    generatedAt: data?.fetched_at || null,
    unavailable: false,
  };
}

function normalizeNhlPreseason(data, date) {
  const games = Array.isArray(data?.games) ? data.games : [];
  const cards = games
    .filter((game) => game?.is_call === true && game?.pick_team)
    .map((game) => {
      const away = String(game.away || 'AWAY').toUpperCase();
      const home = String(game.home || 'HOME').toUpperCase();
      const pickTeam = String(game.pick_team || '').toUpperCase();
      const opponent = pickTeam === home ? away : home;
      const outcome = nhlOutcome(game.result, {
        away,
        home,
        awayScore: game.away_score,
        homeScore: game.home_score,
        gradedAt: game.graded_at,
      });
      return {
        sport: 'nhl',
        gameId: game.game_id || null,
        variant: 'nhl-preseason-call',
        eyebrow: outcome?.result === 'WIN'
          ? 'NHL · PRESEASON PBE ALGO HIT'
          : 'NHL · PRESEASON PBE ALGO CALL',
        title: pickTeam || 'NHL pick',
        selection: opponent ? `vs ${opponent}` : `${away} @ ${home}`,
        context: [`${away} @ ${home}`, formatDateTime(game.puck_drop_utc)].filter(Boolean).join(' · '),
        odds: americanOdds(game.best_price),
        oddsLabel: game.best_book || (game.best_price != null ? 'Best at lock' : 'Unpriced'),
        metrics: [
          { label: 'MODEL', value: probabilityPct(game.probability) },
          { label: 'LOCK ODDS', value: game.best_price != null ? americanOdds(game.best_price) : 'Unpriced' },
          { label: outcome ? 'RESULT' : 'STATE', value: outcome?.label || 'LOCKED', edge: outcome?.result === 'WIN' },
        ],
        detail: outcome
          ? [outcome.score, outcome.gradedAt ? `Graded ${formatRelativeStamp(outcome.gradedAt)}` : null, 'Preseason rehearsal'].filter(Boolean).join(' · ')
          : [game.locked_at ? `Locked ${formatRelativeStamp(game.locked_at)}` : 'Locked before puck drop', 'Preseason rehearsal'].join(' · '),
        outcome,
        timestamp: latestTimestamp([game.graded_at, data.fetched_at, game.locked_at]),
        href: SPORTS.nhl.href,
        media: {
          kind: 'team',
          images: [
            game.pick_team_logo_url || nhlLogoUrl(pickTeam),
            game.opponent_team_logo_url || nhlLogoUrl(opponent),
          ].filter(Boolean),
          alt: `${pickTeam || 'NHL'} vs ${opponent || 'opponent'} team logos`,
        },
      };
    });

  return {
    sport: 'nhl',
    cards,
    generatedAt: data?.fetched_at || null,
    unavailable: data?.ok === false,
    stateTitle: cards.length ? null : `No locked NHL preseason calls for ${date}`,
    stateCopy: cards.length ? null : 'When the preseason model locks a real call, it appears here automatically.',
  };
}

function nhlLogoUrl(abbr) {
  const clean = String(abbr || '').toUpperCase().replace(/[^A-Z]/g, '');
  return clean ? `https://assets.nhle.com/logos/nhl/svg/${clean}_dark.svg` : null;
}

function nhlOutcome(result, { away, home, awayScore, homeScore, gradedAt } = {}) {
  const value = String(result || '').toUpperCase();
  if (!['WIN', 'LOSS', 'PUSH', 'VOID'].includes(value)) return null;
  const labels = {
    WIN: { label: 'HIT', headline: 'PBE ALGO CALLED IT', tone: 'hit' },
    LOSS: { label: 'MISS', headline: 'PBE ALGO RESULT', tone: 'miss' },
    PUSH: { label: 'PUSH', headline: 'PBE ALGO RESULT', tone: 'push' },
    VOID: { label: 'VOID', headline: 'PBE ALGO RESULT', tone: 'void' },
  };
  const meta = labels[value];
  const hasScore = Number.isFinite(Number(awayScore)) && Number.isFinite(Number(homeScore));
  return {
    result: value,
    ...meta,
    score: hasScore ? `${away} ${awayScore} · ${home} ${homeScore}` : null,
    gradedAt: gradedAt || null,
  };
}

function renderHero() {
  return `
    <header class="odds-hero free-board-hero">
      <div class="kicker kicker-gold" style="margin-bottom:8px">⚡ FREE SPORTS INTELLIGENCE BOARD</div>
      <h1 class="odds-title">Free Picks</h1>
      <p class="odds-dek">
        A visual live sample from the PropBetEdge network — MLB home run props, game calls and fight picks,
        each published on the cadence that actually fits the sport.
      </p>
      <div class="free-board-pills" aria-label="Sports on the free board">
        <span>⚾ MLB · up to 2 free HR props</span>
        <span>🏈 NFL · game calls</span>
        <span>🥊 UFC · fight pick</span>
        <span>🏀 WNBA · game calls</span>
        <span>🏒 NHL · live algo calls + results</span>
        <span>🏀 NBA · next month</span>
      </div>
      <div class="odds-meta-row">
        <span class="odds-meta-item" id="odds-updated"><span class="pulse-dot"></span> Loading current model feeds...</span>
        <span class="odds-meta-divider">·</span>
        <span class="odds-meta-item" id="odds-counts">—</span>
        <span class="odds-meta-divider">·</span>
        <span class="odds-meta-item">Odds are snapshots and can move</span>
      </div>
    </header>
  `;
}

function renderSkeleton() {
  return `
    <div class="free-sport-stack">
      ${['MLB', 'NFL', 'UFC', 'WNBA', 'NHL'].map((label) => `
        <section class="free-sport-section">
          <div class="free-sport-head">
            <div><span class="free-sport-kicker">${label}</span><h2>Loading current model output...</h2></div>
          </div>
          <div class="edge-grid">
            <div class="edge-card skel-card"><div class="skel skel-line" style="width:42%;height:12px"></div><div class="skel skel-line" style="width:76%;height:24px;margin-top:12px"></div><div class="skel skel-line" style="width:100%;height:90px;margin-top:14px"></div></div>
          </div>
        </section>
      `).join('')}
    </div>
  `;
}

function renderBoard(payload, tracker = _lastTracker) {
  const all = Object.values(payload);
  const total = all.reduce((sum, source) => sum + source.cards.length, 0);
  const latest = latestTimestamp(all.map((source) => source.generatedAt));

  const updatedEl = document.getElementById('odds-updated');
  const countEl = document.getElementById('odds-counts');
  if (updatedEl) {
    updatedEl.innerHTML = latest
      ? `<span class="pulse-dot"></span> Refreshed ${escapeHtml(formatUpdatedAt(latest))}`
      : '<span class="pulse-dot pulse-dot-muted"></span> Waiting on live model feeds';
  }
  if (countEl) countEl.textContent = `${total} free sample${total === 1 ? '' : 's'} live`;

  document.getElementById('odds-board').innerHTML = `
    ${renderFreeTrackRecord(tracker)}
    <div class="free-sport-stack">
      ${renderSportSection('mlb', payload.mlb)}
      ${renderSportSection('nfl', payload.nfl)}
      ${renderSportSection('ufc', payload.ufc)}
      ${renderSportSection('wnba', payload.wnba)}
      ${renderSportSection('nhl', payload.nhl)}
      ${renderComingSport('nba')}
    </div>
    <div class="free-board-truth">
      <strong>This is a sampler, not the full card.</strong>
      <span>Every sport keeps its own model, release gate and refresh cadence. Empty space stays empty instead of being filled with placeholder picks.</span>
    </div>
  `;
}

function trackerOutcome(entry) {
  const result = String(entry?.result || '').toUpperCase();
  if (result === 'PENDING') {
    const status = String(entry?.evidence?.status || '');
    if (/postpon/i.test(status)) {
      return { result, label:'POSTPONED', headline:'GRADING PAUSED', tone:'push', score:null, gradedAt:null };
    }
    if (/suspend/i.test(status)) {
      return { result, label:'SUSPENDED', headline:'GRADING PAUSED', tone:'push', score:null, gradedAt:null };
    }
    if (/delay|rain|weather/i.test(status)) {
      return { result, label:'WEATHER DELAY', headline:'GRADING PAUSED', tone:'push', score:null, gradedAt:null };
    }
    return null;
  }
  if (!['WIN','LOSS','PUSH','VOID'].includes(result)) return null;
  const labels = {
    WIN: { label:'HIT', headline:'PBE ALGO CALLED IT', tone:'hit' },
    LOSS: { label:'MISS', headline:'PBE ALGO RESULT', tone:'miss' },
    PUSH: { label:'PUSH', headline:'PBE ALGO RESULT', tone:'push' },
    VOID: { label:'VOID', headline:'PBE ALGO RESULT', tone:'void' },
  };
  return {
    result,
    ...labels[result],
    score: entry.score || null,
    gradedAt: entry.result_at || null,
  };
}

function normTrackerText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function trackerEntryMatchesCard(entry, card) {
  if (!entry || !card || String(entry.sport || '').toLowerCase() !== String(card.sport || '').toLowerCase()) return false;
  if (card.trackerKey && entry.public_key && String(card.trackerKey) === String(entry.public_key)) return true;

  const sport = String(card.sport || '').toLowerCase();
  const snap = entry.snapshot || {};

  // Never let a historical settled result bleed onto a current card just because
  // the player/team text happens to be the same.
  if (sport === 'mlb') {
    if (card.trackerSourceRecordId && entry.source_record_id) {
      return String(card.trackerSourceRecordId) === String(entry.source_record_id);
    }
    const cardPeriod = String(card.trackerPeriod || '');
    const entryPeriod = String(entry.period_start || snap.game_date || '');
    if (!cardPeriod || !entryPeriod || cardPeriod !== entryPeriod) return false;

    const cardPlayerId = String(card.trackerPlayerId || '');
    const entryPlayerId = String(snap.mlb_player_id || '');
    if (cardPlayerId && entryPlayerId) return cardPlayerId === entryPlayerId;

    return normTrackerText(entry.selection) === normTrackerText(card.title);
  }

  if (sport === 'nfl' && card.trackerEventStartAt && entry.event_start_at) {
    if (Date.parse(card.trackerEventStartAt) !== Date.parse(entry.event_start_at)) return false;
  }

  if (sport === 'ufc' && card.trackerEventDate && snap.event_date) {
    if (String(card.trackerEventDate) !== String(snap.event_date)) return false;
  }

  if ((sport === 'nhl' || sport === 'wnba') && card.gameId && snap.game_id) {
    if (String(card.gameId) !== String(snap.game_id)) return false;
  }

  const pick = normTrackerText(entry.selection);
  const title = normTrackerText(card.title);
  if (pick && title && pick === title) return true;

  // NHL cards often use abbreviations while the ledger uses full team names,
  // but only after the game-id gate above when both sides expose one.
  if (sport === 'nhl') {
    const matchup = normTrackerText(entry.matchup);
    const context = normTrackerText(card.context);
    return Boolean(matchup && context && (context.includes(matchup) || matchup.includes(context)));
  }
  return false;
}

function applyTrackerOutcomes(payload, tracker) {
  if (!tracker?.ok || !payload) return;
  const today = todayEtDate();
  const trackable = (Array.isArray(tracker.entries) ? tracker.entries : [])
    .filter((entry) => {
      if (entry?.evidence?.suppressed === true) return false;
      if (String(entry.sport || '').toUpperCase() === 'MLB' && String(entry.period_start || '') !== today) return false;
      const result = String(entry.result || '').toUpperCase();
      return ['WIN','LOSS','PUSH','VOID','PENDING'].includes(result);
    });

  for (const source of Object.values(payload)) {
    for (const card of (source?.cards || [])) {
      const embedded = card.trackerEntry || null;
      const entry = embedded || trackable.find((candidate) => trackerEntryMatchesCard(candidate, card));
      if (!entry) continue;
      const outcome = trackerOutcome(entry);

      // A previously-settled MLB card can be reopened if the official game
      // state is corrected to postponed/suspended/delayed/non-final.
      if (!outcome) {
        if (String(entry.result || '').toUpperCase() === 'PENDING' && card.sport === 'mlb') {
          card.outcome = null;
        }
        continue;
      }

      card.outcome = outcome;
      if (outcome.result === 'WIN') {
        card.eyebrow = `${card.sport.toUpperCase()} · PBE ALGO HIT`;
      } else if (outcome.result === 'PENDING') {
        card.eyebrow = `${card.sport.toUpperCase()} · GAME STATUS`;
      }
      card.detail = outcome.result === 'PENDING'
        ? 'Not counted in the Free Picks record until the game is officially final'
        : [
            outcome.score,
            outcome.gradedAt ? `Graded ${formatRelativeStamp(outcome.gradedAt)}` : null,
          ].filter(Boolean).join(' · ') || card.detail;
    }
  }
}

function trackerSportLine(tracker, sportKey) {
  const key = String(sportKey || '').toUpperCase();
  const s = tracker?.by_sport?.[key] || { wins:0, losses:0, pushes:0, pending:0 };
  const wins = Number(s.wins || 0);
  const losses = Number(s.losses || 0);
  const pushes = Number(s.pushes || 0);
  const pendingCount = Number(s.pending || 0);
  const record = `${wins}–${losses}${pushes ? `–${pushes}P` : ''}`;
  const pending = pendingCount
    ? `${pendingCount} pending`
    : (wins || losses || pushes) ? 'settled' : 'no picks yet';
  return { record, pending };
}

function renderTrackerSport(tracker, sportKey, cadenceLabel) {
  const stat = trackerSportLine(tracker, sportKey);
  const sport = SPORTS[sportKey];
  return `<div class="pbe-free-track-sport">
    <span class="pbe-free-track-sport__icon" aria-hidden="true">${sport.emoji}</span>
    <div class="pbe-free-track-sport__body">
      <b>${sport.label}</b>
      <small>${cadenceLabel}</small>
    </div>
    <strong>${stat.record}</strong>
    <em>${stat.pending}</em>
  </div>`;
}

function renderTrackerReceipt(entry) {
  const isWin = entry.result === 'WIN';
  const resultLabel = isWin ? 'HIT' : entry.result;
  return `<article class="pbe-free-track-receipt is-${escapeHtml(String(entry.result || 'pending').toLowerCase())}">
    <div class="pbe-free-track-receipt__sport">${escapeHtml(entry.sport)}</div>
    <div class="pbe-free-track-receipt__main">
      <span>${isWin ? 'PBE ALGO CALLED IT' : 'FREE PICK RESULT'}</span>
      <strong>${escapeHtml(entry.selection || 'Free pick')}</strong>
      <small>${escapeHtml(entry.matchup || entry.opponent || entry.pick_type || '')}</small>
    </div>
    <div class="pbe-free-track-receipt__result">
      <b>${escapeHtml(resultLabel)}</b>
      ${entry.score ? `<small>${escapeHtml(entry.score)}</small>` : ''}
    </div>
  </article>`;
}

function renderFreeTrackRecord(tracker) {
  if (!tracker?.ok) {
    return `<section class="pbe-free-track">
      <div class="pbe-free-track__head">
        <div><span class="kicker kicker-gold">FREE PICKS TRACK RECORD</span><h2>Public proof ledger</h2></div>
        <div class="pbe-free-track__actions">
          <span class="pbe-free-track__epoch">STARTED 09/20/26 · NO BACKFILL</span>
          <a class="pbe-free-track__history-link" href="/odds/history">View Full History →</a>
        </div>
      </div>
      <div class="pbe-free-track__offline">Track Record is reconnecting. Live sport cards remain independent.</div>
    </section>`;
  }

  const record = tracker.record || {};
  const wins = Number(record.wins || 0);
  const losses = Number(record.losses || 0);
  const pushes = Number(record.pushes || 0);
  const pending = Number(record.pending || 0);
  const entries = Array.isArray(tracker.entries) ? tracker.entries : [];
  const receipts = entries
    .filter((entry) => ['WIN','LOSS','PUSH'].includes(entry.result))
    .sort((a, b) => Date.parse(b.result_at || b.published_at || 0) - Date.parse(a.result_at || a.published_at || 0))
    .slice(0, 6);

  return `<section class="pbe-free-track">
    <div class="pbe-free-track__head">
      <div>
        <span class="kicker kicker-gold">FREE PICKS TRACK RECORD</span>
        <h2>Every public call stays on the board.</h2>
        <p>Separate from all Pro-platform model records. This ledger tracks only picks published on the Free Picks board; once published here, the pick is frozen and only its result can change.</p>
      </div>
      <div class="pbe-free-track__actions">
        <span class="pbe-free-track__epoch">STARTED 09/20/26 · NO BACKFILL</span>
        <a class="pbe-free-track__history-link" href="/odds/history">View Full Free Picks History →</a>
      </div>
    </div>

    <div class="pbe-free-track__scoreline">
      <div class="pbe-free-track__record">
        <span>OVERALL FREE RECORD</span>
        <strong>${wins}–${losses}${pushes ? `–${pushes}P` : ''}</strong>
        <small>${pending} pending · updates independently from live cards</small>
      </div>
      <div class="pbe-free-track__cadence">
        <div><b>WEEKLY</b><span>NFL · UFC</span></div>
        <div><b>DAILY</b><span>MLB · WNBA · NHL · NBA</span></div>
      </div>
    </div>

    <div class="pbe-free-track__sports">
      ${renderTrackerSport(tracker, 'nfl', 'WEEKLY')}
      ${renderTrackerSport(tracker, 'ufc', 'WEEKLY')}
      ${renderTrackerSport(tracker, 'mlb', 'DAILY')}
      ${renderTrackerSport(tracker, 'wnba', 'DAILY')}
      ${renderTrackerSport(tracker, 'nhl', 'DAILY')}
      ${renderTrackerSport(tracker, 'nba', 'DAILY')}
    </div>

    ${receipts.length ? `<div class="pbe-free-track__receipts">
      <div class="pbe-free-track__receipts-head"><b>LATEST SETTLED FREE PICKS</b><span>immutable public receipts</span></div>
      <div class="pbe-free-track__receipt-grid">${receipts.map(renderTrackerReceipt).join('')}</div>
    </div>` : ''}
  </section>`;
}

function renderSportSection(sportKey, source) {
  const sport = SPORTS[sportKey];
  return `
    <section class="free-sport-section free-sport-${sportKey}">
      <div class="free-sport-head">
        <div class="free-sport-title-wrap">
          <span class="free-sport-icon" aria-hidden="true">${sport.emoji}</span>
          <div>
            <span class="free-sport-kicker">${sport.label} FREE BOARD</span>
            <h2>${sport.deck}</h2>
            <span class="free-sport-cadence">${sport.cadence}</span>
          </div>
        </div>
        <a class="free-sport-link" href="${sport.href}" target="_blank" rel="noopener">${sport.cta} →</a>
      </div>
      ${source.unavailable
        ? renderSportState(sport, 'Feed temporarily unavailable', 'This sport is isolated from the rest of the board, so the other live samples stay online.')
        : source.cards.length
          ? `<div class="edge-grid free-edge-grid">${source.cards.map(renderFreeCard).join('')}</div>`
          : renderSportState(
              sport,
              source.stateTitle || 'No public sample right now',
              source.stateCopy || 'The model only publishes when its current rules are satisfied. We do not manufacture a pick to fill the space.'
            )}
    </section>
  `;
}

function renderComingSport(sportKey) {
  const sport = SPORTS[sportKey];
  return `
    <section class="free-sport-section free-sport-${sportKey} is-coming">
      <div class="free-sport-head">
        <div class="free-sport-title-wrap">
          <span class="free-sport-icon" aria-hidden="true">${sport.emoji}</span>
          <div>
            <span class="free-sport-kicker">${sport.label} · COMING NEXT MONTH</span>
            <h2>${sport.deck}</h2>
            <span class="free-sport-cadence">${sport.cadence}</span>
          </div>
        </div>
        <a class="free-sport-link" href="${sport.href}" target="_blank" rel="noopener">${sport.cta} →</a>
      </div>
      <div class="free-coming-panel">
        <strong>Same contract, new league.</strong>
        <span>NBA will join this board when the season model starts publishing. No placeholder picks before then.</span>
      </div>
    </section>
  `;
}

function renderSportState(sport, title, copy) {
  return `
    <div class="free-sport-empty">
      <div>
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(copy)}</span>
      </div>
      <a href="${sport.href}" target="_blank" rel="noopener">Open ${sport.label} product →</a>
    </div>
  `;
}

function renderCardAvatar(card) {
  const images = (card.media?.images || []).filter(Boolean);
  const image = images[0] || null;
  const isPortrait = card.media?.kind === 'portrait';
  const isNhlPair = card.sport === 'nhl' && images.length > 1;
  const fallback = isPortrait
    ? String(card.title || '?').split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase()
    : (SPORTS[card.sport]?.emoji || '⚡');

  if (isNhlPair) {
    return `
      <div class="free-edge-avatar-wrap free-edge-avatar-wrap--nhl">
        <div class="free-edge-avatar is-team-pair" aria-label="${escapeHtml(card.media?.alt || card.title || '')}">
          <img class="team-logo-1" src="${escapeHtml(images[0])}" alt="" loading="lazy" decoding="async" onerror="this.style.display='none'">
          <span class="team-pair-vs" aria-hidden="true">VS</span>
          <img class="team-logo-2" src="${escapeHtml(images[1])}" alt="" loading="lazy" decoding="async" onerror="this.style.display='none'">
        </div>
      </div>
    `;
  }

  // UFC free-sample media is already identity-verified by the UFC product.
  // Use that source directly first so a proxy/cache hiccup cannot blank a fighter.
  const primaryImage = image && card.sport === 'ufc' ? image : proxyImage(image);
  const fallbackImage = image && card.sport === 'ufc' ? proxyImage(image) : null;
  const onError = fallbackImage && fallbackImage !== primaryImage
    ? `if(!this.dataset.fallbackUsed){this.dataset.fallbackUsed='1';this.src='${escapeHtml(fallbackImage)}';}else{this.style.display='none';}`
    : "this.style.display='none'";

  return `
    <div class="free-edge-avatar-wrap">
      <div class="free-edge-avatar ${isPortrait ? 'is-headshot' : 'is-team-logo'}" aria-label="${escapeHtml(card.media?.alt || card.title || '')}">
        <span class="free-edge-avatar-fallback" aria-hidden="true">${escapeHtml(fallback || '⚡')}</span>
        ${primaryImage ? `<img src="${escapeHtml(primaryImage)}" alt="${escapeHtml(card.media?.alt || card.title || '')}" loading="lazy" decoding="async" onerror="${onError}">` : ''}
      </div>
      ${card.media?.credit ? `<small class="free-edge-avatar-credit">${escapeHtml(card.media.credit)}</small>` : ''}
    </div>
  `;
}

function renderFreeCard(card) {
  const variantClass = card.variant === 'hr-spotlight'
    ? ' is-hr-spotlight'
    : card.variant === 'ufc-top-upset'
      ? ' is-ufc-top-upset'
      : card.variant === 'nhl-preseason-call'
        ? ' is-nhl-preseason-call'
        : '';
  const outcomeClass = card.outcome ? ` has-outcome is-${card.outcome.tone}` : '';
  const metrics = Array.isArray(card.metrics) && card.metrics.length
    ? card.metrics
    : [
        { label: 'Model', value: card.model || '—' },
        { label: 'Market', value: card.market || '—' },
        { label: 'Edge', value: card.edge || '—', edge: true },
      ];

  return `
    <article class="free-edge-card has-media${variantClass}${outcomeClass}" data-sport="${escapeHtml(card.sport)}">
      <div class="free-edge-card-body">
        ${card.outcome ? `<div class="free-edge-result free-edge-result--${escapeHtml(card.outcome.tone)}">
          <span>${escapeHtml(card.outcome.label)}</span>
          <strong>${escapeHtml(card.outcome.headline)}</strong>
          ${card.outcome.score ? `<small>${escapeHtml(card.outcome.score)}</small>` : ''}
        </div>` : ''}
        <div class="free-edge-compact-head">
          ${renderCardAvatar(card)}
          <div class="free-edge-identity">
            <span class="free-edge-eyebrow">${escapeHtml(card.eyebrow)}</span>
            <div class="free-edge-main">
              <h3>${escapeHtml(card.title)}</h3>
              <div class="free-edge-selection">${escapeHtml(card.selection || '')}</div>
              ${card.context ? `<div class="free-edge-context">${escapeHtml(card.context)}</div>` : ''}
            </div>
          </div>
          <span class="free-edge-odds">
            <small>${escapeHtml(card.oddsLabel || 'Odds')}</small>
            <strong>${escapeHtml(card.odds || '—')}</strong>
          </span>
        </div>
        <div class="free-edge-metrics">
          ${metrics.slice(0, 3).map((metric) => `
            <div class="${metric.edge ? 'is-edge' : ''}">
              <span>${escapeHtml(metric.label || '')}</span>
              <strong>${escapeHtml(metric.value || '—')}</strong>
            </div>
          `).join('')}
        </div>
        <div class="free-edge-foot">
          <span>${escapeHtml(card.detail || 'Current model sample')}</span>
          <a href="${card.href}" target="_blank" rel="noopener">Full intelligence →</a>
        </div>
      </div>
    </article>
  `;
}

function renderHowItWorks() {
  return `
    <section class="odds-explainer free-board-explainer">
      <div class="kicker kicker-gold" style="margin-bottom:8px">HOW THE FREE BOARD WORKS</div>
      <h2 class="odds-explainer-title">Different sports. Different models. One public preview.</h2>
      <div class="odds-explainer-grid">
        <div class="explainer-step">
          <div class="explainer-step-num">1</div>
          <div class="explainer-step-body">
            <h3>Sport-specific model output</h3>
            <p>MLB, NFL, UFC, WNBA and NHL are not forced through one universal algorithm. Each product publishes from its own data, model and eligibility contract.</p>
          </div>
        </div>
        <div class="explainer-step">
          <div class="explainer-step-num">2</div>
          <div class="explainer-step-body">
            <h3>Each league keeps its natural cadence</h3>
            <p>Baseball and basketball can move day to day, football is slate-driven, UFC follows event week, and hockey is lock-aware. The board updates from each sport's own source instead of forcing one global schedule.</p>
          </div>
        </div>
        <div class="explainer-step">
          <div class="explainer-step-num">3</div>
          <div class="explainer-step-body">
            <h3>The free board stays deliberately small</h3>
            <p>This page is the front door. Full sport products carry the deeper card, research tools, model context, live experiences and performance records.</p>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderNetworkCta() {
  return `
    <section class="odds-subscribe free-network-cta">
      <div class="free-network-copy">
        <div class="kicker kicker-gold" style="margin-bottom:8px">⚡ GO DEEPER</div>
        <h2>Pick the sport. Open the full intelligence layer.</h2>
        <p>No stale bundle promise and no fake scarcity. The free board shows a sample; each live sport product carries its complete experience.</p>
      </div>
      <div class="free-network-buttons">
        <a href="${SPORTS.mlb.href}" target="_blank" rel="noopener"><span>⚾</span> MLB Intelligence</a>
        <a href="${SPORTS.nfl.href}" target="_blank" rel="noopener"><span>🏈</span> NFL Intelligence</a>
        <a href="${SPORTS.ufc.href}" target="_blank" rel="noopener"><span>🥊</span> UFC Intelligence</a>
        <a href="${SPORTS.wnba.href}" target="_blank" rel="noopener"><span>🏀</span> WNBA Intelligence</a>
        <a href="${SPORTS.nhl.href}" target="_blank" rel="noopener"><span>🏒</span> NHL Intelligence</a>
        <a href="${SPORTS.nba.href}" target="_blank" rel="noopener"><span>🏀</span> NBA · next month</a>
      </div>
      <div class="free-board-responsible">21+ where applicable · Odds can change · Model output is not a guarantee · Bet responsibly</div>
    </section>
  `;
}

function injectEdgeSchema(payload) {
  const cards = Object.values(payload).flatMap((source) => source.cards);
  const existing = document.getElementById('jsonld-odds-edges');
  if (existing) existing.remove();
  if (!cards.length) return;

  const sportName = { mlb: 'Baseball', nfl: 'American Football', ufc: 'Mixed Martial Arts', wnba: 'Basketball', nhl: 'Ice Hockey' };
  const items = cards.map((card, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    item: {
      '@type': 'SportsEvent',
      name: `${card.title} — ${card.selection}`,
      description: `PropBetEdge free ${card.sport.toUpperCase()} model sample`,
      sport: sportName[card.sport] || card.sport.toUpperCase(),
    },
  }));

  const tag = document.createElement('script');
  tag.id = 'jsonld-odds-edges';
  tag.type = 'application/ld+json';
  tag.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'PropBetEdge Free Picks',
    description: 'A live public sample of MLB, NFL, UFC, WNBA and NHL model output from PropBetEdge.',
    numberOfItems: items.length,
    itemListElement: items,
  });
  document.head.appendChild(tag);
}

async function loadMlbOddsSnapshots(hrResult) {
  const data = hrResult.status === 'fulfilled' ? hrResult.value : null;
  const picks = Array.isArray(data?.picks)
    ? data.picks
    : [data?.early_bird, data?.featured].filter(Boolean);

  if (!picks.some((pick) => pick?.player_name)) return {};

  try {
    const snapshot = await fetchJson(`${MLB_ODDS_CACHE_URL}?market=batter_home_runs&limit=20`);
    return { batter_home_runs: snapshot };
  } catch (error) {
    console.warn('[odds] MLB live home-run market unavailable:', error);
    return {};
  }
}

function findBestMlbOffer(snapshot, marketKey, playerName, expectedLine, side = 'Over') {
  const events = Array.isArray(snapshot?.data) ? snapshot.data : [];
  const target = normalizeMlbPlayerName(playerName);
  const line = Number(expectedLine);
  const hasLine = Number.isFinite(line);
  const wantedSide = String(side || 'Over').toLowerCase();
  const offers = [];

  for (const event of events) {
    for (const book of (event.bookmakers || [])) {
      for (const market of (book.markets || [])) {
        if (market.key !== marketKey) continue;
        const playerOutcomes = (market.outcomes || []).filter((outcome) => {
          if (!sameMlbPlayer(outcome.description, target)) return false;
          if (!hasLine) return true;
          const point = Number(outcome.point);
          return Number.isFinite(point) && Math.abs(point - line) < 0.001;
        });
        const selected = playerOutcomes.find((outcome) => String(outcome.name || '').toLowerCase() === wantedSide);
        if (!selected || !Number.isFinite(Number(selected.price))) continue;
        const oppositeName = wantedSide === 'over' ? 'under' : wantedSide === 'under' ? 'over' : null;
        const opposite = oppositeName
          ? playerOutcomes.find((outcome) => String(outcome.name || '').toLowerCase() === oppositeName)
          : null;
        const impliedProbability = americanToProbability(selected.price);
        const oppositeProbability = opposite ? americanToProbability(opposite.price) : null;
        const fairProbability = impliedProbability != null && oppositeProbability != null
          ? impliedProbability / (impliedProbability + oppositeProbability)
          : impliedProbability;

        offers.push({
          price: Number(selected.price),
          point: selected.point,
          bookKey: book.key,
          bookTitle: book.title,
          impliedProbability,
          fairProbability,
          eventId: event.id,
        });
      }
    }
  }

  return offers.sort((a, b) => b.price - a.price)[0] || null;
}

function normalizeMlbPlayerName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv)\b\.?/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function sameMlbPlayer(value, normalizedTarget) {
  if (!normalizedTarget) return false;
  return normalizeMlbPlayerName(value) === normalizedTarget;
}

function americanToProbability(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return null;
  return n > 0 ? 100 / (n + 100) : (-n) / ((-n) + 100);
}

function percentNumber(value) {
  if (value == null || value === '') return null;
  const n = Number(String(value).replace('%', '').trim());
  if (!Number.isFinite(n)) return null;
  return Math.abs(n) <= 1 ? n * 100 : n;
}

function isSyntheticMlbMarket(edge) {
  const book = String(edge?.best_book || '').toLowerCase();
  const odds = Number(String(edge?.book_odds_str ?? bestRawOdds(edge) ?? '').replace('+', '').trim());
  const marketPct = percentNumber(edge?.book_prob_pct);
  return /propbetedge|model/.test(book) && odds === 100 && marketPct === 50;
}

function bestRawOdds(edge) {
  const options = [edge?.dk_odds, edge?.fd_odds].filter((value) => Number.isFinite(Number(value))).map(Number);
  if (!options.length) return null;
  return options.sort((a, b) => b - a)[0];
}

function americanOdds(value) {
  if (value == null || value === '') return '—';
  const raw = String(value).trim();
  if (/^[+-]\d+$/.test(raw)) return raw;
  const n = Number(value);
  if (!Number.isFinite(n)) return raw || '—';
  return n > 0 ? `+${Math.round(n)}` : String(Math.round(n));
}

function ufcAmericanOdds(value) {
  const label = americanOdds(value);
  const n = Number(value);
  if (!Number.isFinite(n)) return label;
  const role = Math.abs(n) === 100 || n === 0 ? 'EVEN' : n < 0 ? 'FAV' : 'DOG';
  return `${label} · ${role}`;
}

function cleanPct(value) {
  if (value == null || value === '') return '—';
  const s = String(value).trim();
  if (s.endsWith('%')) return s;
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(1)}%` : s;
}

function probabilityPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const pct = Math.abs(n) <= 1 ? n * 100 : n;
  return `${pct.toFixed(1)}%`;
}

function cleanEdge(value, mode = 'auto') {
  if (value == null || value === '') return '—';
  const s = String(value).trim();
  if (mode === 'pct-string' && s.endsWith('%')) return s.startsWith('-') ? s : `+${s.replace(/^\+/, '')}`;
  const n = Number(String(value).replace('%', ''));
  if (!Number.isFinite(n)) return s;
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}${s.includes('%') ? '%' : ' pp'}`;
}

function probabilityPointEdge(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const pts = Math.abs(n) <= 1 ? n * 100 : n;
  return `${pts > 0 ? '+' : ''}${pts.toFixed(1)} pp`;
}

function pointEdge(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
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
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

function formatDate(value) {
  if (!value) return '';
  const d = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatRelativeStamp(value) {
  const ts = Date.parse(value || '');
  if (!Number.isFinite(ts)) return 'snapshot';
  const minutes = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`;
  return `${Math.round(minutes / 1440)}d ago`;
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
  return d.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
  }) + ' ET';
}

export function teardownOdds() {
  if (_refreshTimer) {
    clearInterval(_refreshTimer);
    _refreshTimer = null;
  }
}
