/**
 * src/pages/odds.js
 * Public-facing edge board — the page Discord links to
 *
 * v3.16: Initial release
 *   - Reads from propbetedge-ev-finder /edges-today endpoint
 *   - Radical transparency: every edge fully visible, no paywall
 *   - Auto-refreshes every 60s
 *   - Sport-coded by tier (diamond/strong/solid)
 *   - SEO-optimized with JSON-LD ItemList + SportsEvent schema
 */

import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { escapeHtml } from '../components/article-card.js';
import {
  organizationSchema, websiteSchema, breadcrumbSchema, injectSchemas,
} from '../schema.js';

const EV_FINDER_URL = 'https://propbetedge-ev-finder.sales-fd3.workers.dev/edges-today';
const REFRESH_INTERVAL_MS = 60 * 1000; // refetch every 60s
let _refreshTimer = null;

export async function renderOdds(root) {
  root.innerHTML = `
    ${renderHeader()}
    <main class="odds-page">
      <div class="container" style="padding-top:32px">
        ${renderHero()}
        <div id="odds-board">${renderSkeleton()}</div>
        ${renderHowItWorks()}
        ${renderSubscribeBlock()}
      </div>
    </main>
    ${renderFooter()}
  `;

  // Schema
  injectSchemas([
    organizationSchema(),
    websiteSchema(),
    breadcrumbSchema([
      { name: 'Home', url: '/' },
      { name: 'Live Edges' },
    ]),
  ], 'jsonld-odds');

  await loadAndRender();

  if (_refreshTimer) clearInterval(_refreshTimer);
  _refreshTimer = setInterval(loadAndRender, REFRESH_INTERVAL_MS);
}

async function loadAndRender() {
  try {
    const r = await fetch(EV_FINDER_URL, { cache: 'no-store' });
    if (!r.ok) throw new Error(`status ${r.status}`);
    const data = await r.json();
    renderBoard(data);
    injectEdgeSchema(data);
  } catch (e) {
    console.error('[odds] fetch failed:', e);
    renderError();
  }
}

function renderHero() {
  return `
    <header class="odds-hero">
      <div class="kicker kicker-gold" style="margin-bottom:8px">⚡ LIVE · MLB EDGES</div>
      <h1 class="odds-title">Today's +EV Board</h1>
      <p class="odds-dek">
        Every market where our Poisson model beats the book by 5% or more.
        No paywall on today's edges. First pitch closes them.
      </p>
      <div class="odds-meta-row">
        <span class="odds-meta-item" id="odds-updated">
          <span class="pulse-dot"></span> Loading...
        </span>
        <span class="odds-meta-divider">·</span>
        <span class="odds-meta-item" id="odds-counts">—</span>
        <span class="odds-meta-divider">·</span>
        <span class="odds-meta-item">
          <a href="https://learn.propbetedge.ai" target="_blank" rel="noopener" style="color:var(--gold);text-decoration:none">
            How we calculate edge →
          </a>
        </span>
      </div>
    </header>
  `;
}

function renderSkeleton() {
  let cards = '';
  for (let i = 0; i < 6; i++) {
    cards += `
      <div class="edge-card skel-card">
        <div class="skel skel-line" style="width:40%;height:12px"></div>
        <div class="skel skel-line" style="width:80%;height:24px;margin-top:12px"></div>
        <div class="skel skel-line" style="width:60%;height:16px;margin-top:10px"></div>
        <div class="skel skel-line" style="width:100%;height:80px;margin-top:14px"></div>
      </div>
    `;
  }
  return `<div class="edge-grid">${cards}</div>`;
}

function renderError() {
  document.getElementById('odds-board').innerHTML = `
    <div class="empty" style="margin-top:32px">
      <h3>Edge data temporarily unavailable</h3>
      <p>The model refreshes every 15 minutes. Try again in a moment, or check
        <a href="https://discord.gg/e9S6pFq9" style="color:var(--gold)">Discord</a>
        for the live feed.
      </p>
    </div>
  `;
  document.getElementById('odds-updated').innerHTML = 'Connection issue';
  document.getElementById('odds-counts').textContent = 'Retrying...';
}

function renderBoard(data) {
  const updated = data.generated_at_et || (data.generated_at ? formatUpdatedAt(data.generated_at) : null);

  document.getElementById('odds-updated').innerHTML = updated
    ? `<span class="pulse-dot"></span> Updated ${escapeHtml(updated)}`
    : `<span class="pulse-dot pulse-dot-muted"></span> No fresh data yet`;

  const counts = [];
  if (data.total_alerts) counts.push(`${data.total_alerts} edge${data.total_alerts !== 1 ? 's' : ''}`);
  if (data.diamond_count) counts.push(`<span class="tier-diamond-text">${data.diamond_count} 💎</span>`);
  if (data.strong_count) counts.push(`<span class="tier-strong-text">${data.strong_count} ⭐</span>`);
  document.getElementById('odds-counts').innerHTML = counts.length ? counts.join(' · ') : 'No edges right now';

  const board = document.getElementById('odds-board');

  if (!data.edges || !data.edges.length) {
    board.innerHTML = `
      <div class="empty" style="margin-top:32px">
        <h3>No +EV edges right now</h3>
        <p>The model only flags markets where it sees a real advantage. Check back closer to first pitch — lines move fast.</p>
        <p style="margin-top:16px">
          <a href="https://discord.gg/e9S6pFq9" style="color:var(--gold);text-decoration:none">
            Join Discord for instant alerts when edges land →
          </a>
        </p>
      </div>
    `;
    return;
  }

  const [hero, ...rest] = data.edges;
  board.innerHTML = `
    ${renderHeroEdge(hero)}
    <div class="edge-grid">
      ${rest.map(renderEdgeCard).join('')}
    </div>
  `;
}

function renderHeroEdge(edge) {
  const teamLogo = edge.team_logo
    ? `<img src="${escapeHtml(edge.team_logo)}" alt="${escapeHtml(edge.team || '')}" class="hero-edge-logo" onerror="this.style.display='none'" />`
    : '';
  const headshotImg = edge.headshot
    ? `<img src="${escapeHtml(edge.headshot)}" alt="${escapeHtml(edge.player_name)}" class="hero-edge-headshot" onerror="this.style.display='none'" />`
    : '';

  return `
    <article class="hero-edge tier-${escapeHtml(edge.tier)}">
      <div class="hero-edge-left">
        ${headshotImg}
      </div>
      <div class="hero-edge-body">
        <div class="hero-edge-tier">${escapeHtml(edge.tier_label)}</div>
        <div class="hero-edge-name-row">
          ${teamLogo}
          <h2 class="hero-edge-name">${escapeHtml(edge.player_name)}</h2>
        </div>
        <div class="hero-edge-line">
          OVER ${escapeHtml(String(edge.line))} ${escapeHtml(edge.market_label)}
        </div>
        <div class="hero-edge-pitch">
          Model sees <strong>${escapeHtml(edge.edge_pct)} more probability</strong> than the book is pricing.
        </div>
        <div class="hero-edge-stats">
          <div class="hero-stat">
            <div class="hero-stat-label">Model</div>
            <div class="hero-stat-value">${escapeHtml(edge.model_prob_pct)}</div>
            <div class="hero-stat-sub">${escapeHtml(edge.model_odds)}</div>
          </div>
          <div class="hero-stat">
            <div class="hero-stat-label">Book</div>
            <div class="hero-stat-value">${escapeHtml(edge.book_prob_pct)}</div>
            <div class="hero-stat-sub">${escapeHtml(edge.book_odds_str)}</div>
          </div>
          <div class="hero-stat hero-stat-edge">
            <div class="hero-stat-label">Edge</div>
            <div class="hero-stat-value">+${escapeHtml(edge.edge_pct)}</div>
            <div class="hero-stat-sub">${escapeHtml(edge.best_book || '')}</div>
          </div>
          ${edge.quarter_kelly_pct ? `
            <div class="hero-stat">
              <div class="hero-stat-label">¼ Kelly</div>
              <div class="hero-stat-value">${escapeHtml(edge.quarter_kelly_pct)}</div>
              <div class="hero-stat-sub">of bankroll</div>
            </div>
          ` : ''}
        </div>
        <div class="hero-edge-books">
          ${edge.dk_odds != null ? `<span class="book-chip">DK <strong>${edge.dk_odds > 0 ? '+' : ''}${edge.dk_odds}</strong></span>` : ''}
          ${edge.fd_odds != null ? `<span class="book-chip">FD <strong>${edge.fd_odds > 0 ? '+' : ''}${edge.fd_odds}</strong></span>` : ''}
          ${edge.pbe_score ? `<span class="book-chip book-chip-score">PBE Score <strong>${edge.pbe_score}/100</strong></span>` : ''}
        </div>
      </div>
    </article>
  `;
}

function renderEdgeCard(edge) {
  const teamLogo = edge.team_logo
    ? `<img src="${escapeHtml(edge.team_logo)}" alt="${escapeHtml(edge.team || '')}" class="edge-card-logo" onerror="this.style.display='none'" />`
    : '';
  const headshotImg = edge.headshot
    ? `<img src="${escapeHtml(edge.headshot)}" alt="${escapeHtml(edge.player_name)}" class="edge-card-headshot" onerror="this.style.display='none'" />`
    : '<div class="edge-card-headshot-placeholder">⚾</div>';

  return `
    <article class="edge-card tier-${escapeHtml(edge.tier)}">
      <div class="edge-card-tier">${escapeHtml(edge.tier_label)}</div>
      <div class="edge-card-head">
        ${headshotImg}
        <div class="edge-card-id">
          <div class="edge-card-name-row">
            ${teamLogo}
            <h3 class="edge-card-name">${escapeHtml(edge.player_name)}</h3>
          </div>
          <div class="edge-card-line">
            OVER ${escapeHtml(String(edge.line))} ${escapeHtml(edge.market_label)}
          </div>
        </div>
      </div>
      <div class="edge-card-edge-display">
        <span class="edge-card-edge-num">+${escapeHtml(edge.edge_pct)}</span>
        <span class="edge-card-edge-label">edge</span>
      </div>
      <div class="edge-card-stats">
        <div class="edge-card-stat">
          <div class="edge-card-stat-label">Model</div>
          <div class="edge-card-stat-value">${escapeHtml(edge.model_prob_pct)}</div>
        </div>
        <div class="edge-card-stat">
          <div class="edge-card-stat-label">Book</div>
          <div class="edge-card-stat-value">${escapeHtml(edge.book_prob_pct)}</div>
        </div>
        <div class="edge-card-stat">
          <div class="edge-card-stat-label">Best</div>
          <div class="edge-card-stat-value">${escapeHtml(edge.best_book || '—')}</div>
          <div class="edge-card-stat-sub">${escapeHtml(edge.book_odds_str)}</div>
        </div>
        ${edge.quarter_kelly_pct ? `
          <div class="edge-card-stat">
            <div class="edge-card-stat-label">¼ Kelly</div>
            <div class="edge-card-stat-value">${escapeHtml(edge.quarter_kelly_pct)}</div>
          </div>
        ` : ''}
      </div>
      <div class="edge-card-books">
        ${edge.dk_odds != null ? `<span class="book-chip-sm">DK <strong>${edge.dk_odds > 0 ? '+' : ''}${edge.dk_odds}</strong></span>` : ''}
        ${edge.fd_odds != null ? `<span class="book-chip-sm">FD <strong>${edge.fd_odds > 0 ? '+' : ''}${edge.fd_odds}</strong></span>` : ''}
      </div>
    </article>
  `;
}

function renderHowItWorks() {
  return `
    <section class="odds-explainer">
      <h2 class="odds-explainer-title">How an "edge" is calculated</h2>
      <div class="odds-explainer-grid">
        <div class="explainer-step">
          <div class="explainer-step-num">1</div>
          <div class="explainer-step-body">
            <h3>Our model prices each market</h3>
            <p>A custom Poisson model trained on Statcast and historical prop data outputs a probability for each player prop, independent of any sportsbook.</p>
          </div>
        </div>
        <div class="explainer-step">
          <div class="explainer-step-num">2</div>
          <div class="explainer-step-body">
            <h3>We pull live book lines</h3>
            <p>DraftKings, FanDuel, BetMGM, and Caesars are scanned for every market we model. We surface the best available price.</p>
          </div>
        </div>
        <div class="explainer-step">
          <div class="explainer-step-num">3</div>
          <div class="explainer-step-body">
            <h3>Edge = model prob − book prob</h3>
            <p>If our model says a player has a 65% chance to hit the over and the book is pricing it at 50%, that's a 15% edge. Compounded over hundreds of bets, positive edge equals long-term profit.</p>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderSubscribeBlock() {
  return `
    <section class="odds-subscribe">
      <div class="odds-subscribe-inner">
        <div class="odds-subscribe-text">
          <div class="kicker kicker-gold" style="margin-bottom:8px">⚡ TOMORROW'S EDGES</div>
          <h2>Get the next drop in your inbox at 6 AM ET.</h2>
          <p>Today's edges are public. Tomorrow's drop hits your inbox before this page updates. Plus The Algo, HR Targets, K Props, and the full Picks dashboard.</p>
          <div class="odds-subscribe-features">
            <div class="feat-line">✓ Edges delivered before they go public</div>
            <div class="feat-line">✓ Full Picks dashboard with PBE Scores</div>
            <div class="feat-line">✓ The Algo — chat with the model</div>
            <div class="feat-line">✓ Discord access — instant edge alerts</div>
          </div>
        </div>
        <div class="odds-subscribe-cta">
          <a href="https://mlb.propbetedge.ai" class="odds-cta-btn">
            Get PropBetEdge Pro →
          </a>
          <div class="odds-subscribe-note">
            $29/mo · Cancel anytime · 21+ · Bet responsibly
          </div>
        </div>
      </div>
    </section>
  `;
}

function injectEdgeSchema(data) {
  if (!data.edges || !data.edges.length) return;
  // Inject ItemList of betting edges as schema.org for SEO.
  // Each edge is a SportsEvent with a player Person as competitor.
  const items = data.edges.slice(0, 8).map((edge, idx) => ({
    '@type': 'ListItem',
    position: idx + 1,
    item: {
      '@type': 'SportsEvent',
      name: `${edge.player_name} OVER ${edge.line} ${edge.market_label}`,
      description: `Model edge of ${edge.edge_pct} on ${edge.player_name}'s ${edge.market_label} prop`,
      sport: 'Baseball',
      competitor: edge.player_name ? [{ '@type': 'Person', name: edge.player_name }] : undefined,
      startDate: data.game_date,
    },
  }));
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `MLB +EV Edges — ${data.game_date}`,
    description: 'Today\'s player prop edges where PropBetEdge\'s model beats the book',
    numberOfItems: items.length,
    itemListElement: items,
  };
  const existing = document.getElementById('jsonld-odds-edges');
  if (existing) existing.remove();
  const tag = document.createElement('script');
  tag.id = 'jsonld-odds-edges';
  tag.type = 'application/ld+json';
  tag.textContent = JSON.stringify(schema);
  document.head.appendChild(tag);
}

function formatUpdatedAt(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
    }) + ' ET';
  } catch {
    return null;
  }
}

// Cleanup if user navigates away
export function teardownOdds() {
  if (_refreshTimer) {
    clearInterval(_refreshTimer);
    _refreshTimer = null;
  }
}
