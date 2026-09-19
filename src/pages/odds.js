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
import { PROPBET_LINKS } from '../ads-config.js';
import {
  organizationSchema, websiteSchema, breadcrumbSchema, injectSchemas,
} from '../schema.js';

const MLB_EDGES_URL = 'https://propbetedge-ev-finder.sales-fd3.workers.dev/edges-today';
const NFL_SAMPLE_URL = 'https://nfl.propbetedge.ai/api/pbe-picks?view=free-sample';
const UFC_SAMPLE_URL = 'https://ufc.propbetedge.ai/api/ufc/free-sample';
const REFRESH_INTERVAL_MS = 60 * 1000;
let _refreshTimer = null;

const SPORTS = Object.freeze({
  mlb: {
    label: 'MLB',
    emoji: '⚾',
    href: PROPBET_LINKS.picks_mlb,
    cta: 'Open MLB Intelligence',
    deck: 'Player-prop model edges from the live baseball board.',
  },
  nfl: {
    label: 'NFL',
    emoji: '🏈',
    href: PROPBET_LINKS.picks_nfl,
    cta: 'Open NFL Intelligence',
    deck: 'Game-market decisions from the PBE Picks engine.',
  },
  ufc: {
    label: 'UFC',
    emoji: '🥊',
    href: PROPBET_LINKS.picks_ufc,
    cta: 'Open UFC Intelligence',
    deck: 'One current fight-model call with the market snapshot behind it.',
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
  const [mlb, nfl, ufc] = await Promise.allSettled([
    fetchJson(MLB_EDGES_URL),
    fetchJson(NFL_SAMPLE_URL),
    fetchJson(UFC_SAMPLE_URL),
  ]);

  const payload = {
    mlb: mlb.status === 'fulfilled' ? normalizeMlb(mlb.value) : sourceFailure('mlb', mlb.reason),
    nfl: nfl.status === 'fulfilled' ? normalizeNfl(nfl.value) : sourceFailure('nfl', nfl.reason),
    ufc: ufc.status === 'fulfilled' ? normalizeUfc(ufc.value) : sourceFailure('ufc', ufc.reason),
  };

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
  }] : [];

  return {
    sport: 'ufc',
    cards,
    generatedAt: data?.generated_at || null,
    unavailable: false,
  };
}

function renderHero() {
  return `
    <header class="odds-hero free-board-hero">
      <div class="kicker kicker-gold" style="margin-bottom:8px">⚡ FREE PREVIEW · MLB · NFL · UFC</div>
      <h1 class="odds-title">Free Picks & Model Edges</h1>
      <p class="odds-dek">
        A small live sample from the PropBetEdge sports intelligence network.
        Two baseball edges, two football calls, and one UFC pick when each model has something publishable.
      </p>
      <div class="free-board-pills" aria-label="Free board limits">
        <span>⚾ MLB · up to 2</span>
        <span>🏈 NFL · up to 2</span>
        <span>🥊 UFC · up to 1</span>
        <span>Always free</span>
      </div>
      <div class="odds-meta-row">
        <span class="odds-meta-item" id="odds-updated"><span class="pulse-dot"></span> Loading live model feeds...</span>
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
      ${['MLB', 'NFL', 'UFC'].map((label) => `
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
    </div>
    <div class="free-board-truth">
      <strong>This is a sampler, not the full card.</strong>
      <span>Each sport uses its own model and publication rules. Nothing is filled with placeholder picks when a model has no qualifying call.</span>
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
          </div>
        </div>
        <a class="free-sport-link" href="${sport.href}" target="_blank" rel="noopener">${sport.cta} →</a>
      </div>
      ${source.unavailable
        ? renderSportState(sport, 'Feed temporarily unavailable', 'The rest of the free board stays live while this source reconnects.')
        : source.cards.length
          ? `<div class="edge-grid free-edge-grid">${source.cards.map(renderFreeCard).join('')}</div>`
          : renderSportState(sport, 'No public sample right now', 'The model only publishes when its current rules are satisfied. We do not manufacture a pick to fill the space.')}
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

function renderFreeCard(card) {
  return `
    <article class="free-edge-card" data-sport="${escapeHtml(card.sport)}">
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
        <span>${escapeHtml(card.detail || 'Live model sample')}</span>
        <a href="${card.href}" target="_blank" rel="noopener">Full intelligence →</a>
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
            <p>MLB, NFL and UFC are not forced through one universal algorithm. Each product publishes from its own data, model and eligibility contract.</p>
          </div>
        </div>
        <div class="explainer-step">
          <div class="explainer-step-num">2</div>
          <div class="explainer-step-body">
            <h3>Market context stays attached</h3>
            <p>When a public sample includes odds, model probability or market probability, those values come from the model's current or locked market snapshot.</p>
          </div>
        </div>
        <div class="explainer-step">
          <div class="explainer-step-num">3</div>
          <div class="explainer-step-body">
            <h3>The free board stays deliberately small</h3>
            <p>This page is the front door. Full sport products carry the deeper card, research tools, model context and performance records.</p>
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

  const sportName = { mlb: 'Baseball', nfl: 'American Football', ufc: 'Mixed Martial Arts' };
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
    description: 'A live public sample of MLB, NFL and UFC model output from PropBetEdge.',
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
