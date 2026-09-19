/**
 * src/pages/odds.js
 * Cross-sport public sampler for the PropBetEdge network.
 *
 * Contract:
 *   - MLB: up to 2 current +EV player-prop edges
 *   - NFL: up to 2 current PBE picks / validation signals
 *   - UFC: up to 1 current PBE Algo call with market odds
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

const MLB_EDGES_URL = 'https://propbetedge-ev-finder.sales-fd3.workers.dev/edges-today';
const NFL_SAMPLE_URL = 'https://nfl.propbetedge.ai/api/pbe-picks?view=free-sample';
const UFC_SAMPLE_URL = 'https://ufc.propbetedge.ai/api/ufc/free-sample';
const WNBA_SAMPLE_URL = 'https://wnba-api.propbetedge.ai/v1/pbe/free-sample';
const NHL_SAMPLE_URL = 'https://nhl-api.propbetedge.ai/nhl/picks/free-sample';
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
let _refreshTimer = null;

const SPORTS = Object.freeze({
  mlb: {
    label: 'MLB',
    emoji: '⚾',
    href: PROPBET_LINKS.picks_mlb,
    cta: 'Open MLB Intelligence',
    deck: 'Player-prop model edges from the live baseball board.',
    cadence: 'Game-day · refreshed throughout the slate',
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
    deck: 'A current fight-model call with the market snapshot behind it.',
    cadence: 'Fight week · refreshed as the card and market move',
  },
  wnba: {
    label: 'WNBA',
    emoji: '🏀',
    href: PROPBET_LINKS.picks_wnba,
    cta: 'Open WNBA Intelligence',
    deck: 'Current game-prediction calls from the WNBA model.',
    cadence: 'Game-day · refreshed through the active slate',
  },
  nhl: {
    label: 'NHL',
    emoji: '🏒',
    href: PROPBET_LINKS.picks_nhl,
    cta: 'Open NHL Intelligence',
    deck: 'The hockey model pipeline, wired to publish when its release gate opens.',
    cadence: 'Daily slate · lock-aware publication',
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
      { name: 'Free Picks & Edges' },
    ]),
  ], 'jsonld-odds');

  await loadAndRender();

  if (_refreshTimer) clearInterval(_refreshTimer);
  _refreshTimer = setInterval(loadAndRender, REFRESH_INTERVAL_MS);
}

async function loadAndRender() {
  const [mlb, nfl, ufc, wnba, nhl] = await Promise.allSettled([
    fetchJson(MLB_EDGES_URL),
    fetchJson(NFL_SAMPLE_URL),
    fetchJson(UFC_SAMPLE_URL),
    fetchJson(WNBA_SAMPLE_URL),
    fetchJson(NHL_SAMPLE_URL),
  ]);

  const payload = {
    mlb: mlb.status === 'fulfilled' ? normalizeMlb(mlb.value) : sourceFailure('mlb', mlb.reason),
    nfl: nfl.status === 'fulfilled' ? normalizeNfl(nfl.value) : sourceFailure('nfl', nfl.reason),
    ufc: ufc.status === 'fulfilled' ? normalizeUfc(ufc.value) : sourceFailure('ufc', ufc.reason),
    wnba: wnba.status === 'fulfilled' ? normalizeWnba(wnba.value) : sourceFailure('wnba', wnba.reason),
    nhl: nhl.status === 'fulfilled' ? normalizeNhl(nhl.value) : sourceFailure('nhl', nhl.reason),
  };

  await enrichMlbMedia(payload.mlb);
  renderBoard(payload);
  injectEdgeSchema(payload);
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store', credentials: 'omit' });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

function sourceFailure(sport, error) {
  console.warn(`[odds] ${sport} source unavailable:`, error);
  return { sport, cards: [], generatedAt: null, unavailable: true };
}

function normalizeMlb(data) {
  const cards = (Array.isArray(data?.edges) ? data.edges : []).slice(0, 2).map((edge) => ({
    sport: 'mlb',
    eyebrow: edge.tier_label ? `MLB · ${edge.tier_label}` : 'MLB · MODEL EDGE',
    title: edge.player_name || 'MLB edge',
    selection: `OVER ${edge.line ?? '—'} ${edge.market_label || 'prop'}`,
    context: [edge.team, edge.opponent ? `vs ${edge.opponent}` : null].filter(Boolean).join(' · '),
    odds: americanOdds(edge.book_odds_str ?? bestRawOdds(edge)),
    oddsLabel: edge.best_book || 'Best available',
    model: cleanPct(edge.model_prob_pct),
    market: cleanPct(edge.book_prob_pct),
    edge: cleanEdge(edge.edge_pct, 'pct-string'),
    detail: edge.pbe_score ? `PBE Score ${edge.pbe_score}/100` : null,
    timestamp: data.generated_at || null,
    href: SPORTS.mlb.href,
    media: null,
  }));

  return {
    sport: 'mlb',
    cards,
    generatedAt: data?.generated_at || null,
    unavailable: false,
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
  const pick = data?.pick;
  const cards = pick ? [{
    sport: 'ufc',
    eyebrow: `UFC · ${pick.lifecycle === 'LOCKED' ? 'LOCKED PBE PICK' : 'PBE MODEL CALL'}`,
    title: pick.pick_name || 'UFC pick',
    selection: pick.opponent_name ? `vs ${pick.opponent_name}` : pick.matchup || 'Fight pick',
    context: [pick.event_name, formatDate(pick.event_date)].filter(Boolean).join(' · '),
    odds: americanOdds(pick.best_odds ?? pick.consensus_odds),
    oddsLabel: pick.best_book || (pick.best_odds != null ? 'Best available' : 'Consensus'),
    model: probabilityPct(pick.model_probability),
    market: probabilityPct(pick.market_probability),
    edge: pointEdge(pick.edge_pts),
    detail: [pick.confidence ? `Confidence ${pick.confidence}` : null, pick.observed_at ? `Market ${formatRelativeStamp(pick.observed_at)}` : null].filter(Boolean).join(' · '),
    timestamp: data.generated_at || pick.observed_at || null,
    href: data.full_product_url || SPORTS.ufc.href,
    media: {
      kind: 'portrait',
      images: [pick.fighter_image?.card_url || pick.fighter_image?.image_url || pick.fighter_image?.thumb_url].filter(Boolean),
      alt: pick.pick_name ? `${pick.pick_name} fighter portrait` : 'UFC fighter portrait',
      credit: pick.fighter_image?.attribution_text || null,
    },
  }] : [];

  return {
    sport: 'ufc',
    cards,
    generatedAt: data?.generated_at || null,
    unavailable: false,
  };
}

async function enrichMlbMedia(source) {
  if (!source?.cards?.length) return;
  await Promise.all(source.cards.map(async (card) => {
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

function normalizeNhl(data) {
  const cards = (Array.isArray(data?.picks) ? data.picks : []).slice(0, 2).map((pick) => {
    const away = pick.matchup?.away || 'AWAY';
    const home = pick.matchup?.home || 'HOME';
    return {
      sport: 'nhl',
      eyebrow: 'NHL · LOCKED PBE PICK',
      title: pick.pick_team || 'NHL pick',
      selection: pick.opponent_team ? `vs ${pick.opponent_team}` : `${away} @ ${home}`,
      context: [`${away} @ ${home}`, formatDateTime(pick.start_utc)].filter(Boolean).join(' · '),
      odds: americanOdds(pick.odds),
      oddsLabel: pick.book || (pick.odds != null ? 'Best at lock' : 'Unpriced'),
      model: probabilityPct(pick.model_probability),
      market: probabilityPct(pick.market_probability),
      edge: pointEdge(pick.edge_pts),
      detail: [pick.confidence ? `Confidence ${pick.confidence}` : null, pick.locked_at ? `Locked ${formatRelativeStamp(pick.locked_at)}` : null].filter(Boolean).join(' · '),
      timestamp: data.fetched_at || pick.locked_at || null,
      href: data.full_product_url || SPORTS.nhl.href,
      media: {
        kind: 'team',
        images: [pick.pick_team_logo_url].filter(Boolean),
        alt: pick.pick_team ? `${pick.pick_team} team logo` : 'NHL team logo',
      },
    };
  });

  const validating = data?.reason === 'no_official_model' || data?.publish_gate?.open === false;
  return {
    sport: 'nhl',
    cards,
    generatedAt: data?.fetched_at || null,
    unavailable: false,
    stateTitle: validating ? 'Model in validation' : null,
    stateCopy: validating
      ? 'NHL is fully wired into the free board. Picks stay hidden until the official model release gate opens.'
      : null,
  };
}

function renderHero() {
  return `
    <header class="odds-hero free-board-hero">
      <div class="kicker kicker-gold" style="margin-bottom:8px">⚡ FREE SPORTS INTELLIGENCE BOARD</div>
      <h1 class="odds-title">Free Picks & Model Edges</h1>
      <p class="odds-dek">
        A visual live sample from the PropBetEdge network — player props, game calls and fight picks,
        each published on the cadence that actually fits the sport.
      </p>
      <div class="free-board-pills" aria-label="Sports on the free board">
        <span>⚾ MLB · player edges</span>
        <span>🏈 NFL · game calls</span>
        <span>🥊 UFC · fight pick</span>
        <span>🏀 WNBA · game calls</span>
        <span>🏒 NHL · wired</span>
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

function renderBoard(payload) {
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

function renderCardMedia(card) {
  const images = (card.media?.images || []).filter(Boolean).slice(0, 2);
  if (!images.length) {
    return `<div class="free-edge-media is-fallback" aria-hidden="true"><span>${SPORTS[card.sport]?.emoji || '⚡'}</span><b>${escapeHtml(String(card.title || '').slice(0, 3).toUpperCase())}</b></div>`;
  }
  return `
    <div class="free-edge-media ${card.media?.kind === 'portrait' ? 'is-portrait' : 'is-team'}">
      <div class="free-edge-media-images ${images.length > 1 ? 'is-pair' : ''}">
        ${images.map((url) => `<img src="${escapeHtml(proxyImage(url))}" alt="${escapeHtml(card.media?.alt || card.title || '')}" loading="lazy" decoding="async" onerror="this.style.display='none'">`).join('')}
      </div>
      ${card.media?.credit ? `<small>${escapeHtml(card.media.credit)}</small>` : ''}
    </div>
  `;
}

function renderFreeCard(card) {
  return `
    <article class="free-edge-card has-media" data-sport="${escapeHtml(card.sport)}">
      ${renderCardMedia(card)}
      <div class="free-edge-card-body">
        <div class="free-edge-topline">
          <span class="free-edge-eyebrow">${escapeHtml(card.eyebrow)}</span>
          <span class="free-edge-odds">
            <small>${escapeHtml(card.oddsLabel || 'Odds')}</small>
            <strong>${escapeHtml(card.odds || '—')}</strong>
          </span>
        </div>
        <div class="free-edge-main">
          <h3>${escapeHtml(card.title)}</h3>
          <div class="free-edge-selection">${escapeHtml(card.selection || '')}</div>
          ${card.context ? `<div class="free-edge-context">${escapeHtml(card.context)}</div>` : ''}
        </div>
        <div class="free-edge-metrics">
          <div><span>Model</span><strong>${escapeHtml(card.model || '—')}</strong></div>
          <div><span>Market</span><strong>${escapeHtml(card.market || '—')}</strong></div>
          <div class="is-edge"><span>Edge</span><strong>${escapeHtml(card.edge || '—')}</strong></div>
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
    name: 'PropBetEdge Free Picks & Model Edges',
    description: 'A live public sample of MLB, NFL, UFC, WNBA and NHL model output from PropBetEdge.',
    numberOfItems: items.length,
    itemListElement: items,
  });
  document.head.appendChild(tag);
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
