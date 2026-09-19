/**
 * /leaders/wnba — live WNBA regular-season leaderboards.
 */

import {
  leadersPageShell,
  renderLeaderRow,
  renderEmptyStatCard,
  renderLeaderLoading,
  renderLeaderLiveStatus,
  markLeaderUpdated,
  startLeaderAutoRefresh,
} from './leaders-shared.js';

const CATEGORIES = [
  { key: 'pointsPerGame',       label: 'PPG',  color: '#FF6B6B' },
  { key: 'reboundsPerGame',     label: 'RPG',  color: '#7FB3FF' },
  { key: 'assistsPerGame',      label: 'APG',  color: 'var(--gold)' },
  { key: 'stealsPerGame',       label: 'SPG',  color: '#5FD38D' },
  { key: 'blocksPerGame',       label: 'BPG',  color: '#FF8C42' },
  { key: 'fieldGoalPercentage', label: 'FG%',  color: '#9A7BFF' },
  { key: '3PointPct',           label: '3P%',  color: '#51C4D3' },
  { key: 'PER',                 label: 'PER',   color: '#E96BA8' },
];

let _payload = null;
let _loading = null;

export async function renderWnbaLeadersPage(root) {
  const season = new Date().getFullYear();
  root.innerHTML = leadersPageShell(
    'wnba',
    'WNBA',
    `${season} regular-season scoring, rebounding, playmaking and defensive leaders — live from ESPN.`,
    `
      ${renderLeaderLiveStatus('ESPN', 60)}
      <div id="leaders-body">${renderLeaderLoading()}</div>
    `,
    'UPDATED LIVE',
  );

  await loadData({ force: true });
  renderActive();
  markLeaderUpdated('ESPN');

  startLeaderAutoRefresh('wnba', async () => {
    await loadData({ force: true });
    renderActive();
    markLeaderUpdated('ESPN');
  }, 60000);
}

async function loadData({ force = false } = {}) {
  if (_payload && !force) return _payload;
  if (_loading) return _loading;

  const season = new Date().getFullYear();
  _loading = fetch(`/api/wnba-leaders?season=${season}&t=${Date.now()}`, {
    cache: 'no-store',
    credentials: 'omit',
  })
    .then((r) => {
      if (!r.ok) throw new Error(`WNBA leaders ${r.status}`);
      return r.json();
    })
    .then((data) => {
      _payload = data;
      return data;
    })
    .catch((error) => {
      console.warn('[leaders/wnba] unavailable', error);
      return null;
    })
    .finally(() => {
      _loading = null;
    });

  return _loading;
}

function renderActive() {
  const body = document.getElementById('leaders-body');
  if (!body) return;

  if (!_payload?.categories?.length) {
    body.innerHTML = `
      <div class="games-empty">
        <h3>WNBA leaders temporarily unavailable</h3>
        <p>The live regular-season leader feed could not be loaded. This page retries automatically.</p>
      </div>
    `;
    return;
  }

  body.innerHTML = `
    <div class="leaders-banner">🏀 ${_payload.season} regular season · ${_payload.source || 'ESPN'} · Top 10 in each category</div>
    <div class="leaders-grid">
      ${CATEGORIES.map((cat) => renderCard(cat, findCategory(cat.key))).join('')}
    </div>
  `;
}

function findCategory(key) {
  return _payload?.categories?.find((category) => category.name === key) || null;
}

function renderCard(cat, category) {
  const leaders = Array.isArray(category?.leaders) ? category.leaders.slice(0, 10) : [];
  if (!leaders.length) return renderEmptyStatCard(cat.label, cat.color);

  const rows = leaders.map((leader, rank) => {
    const athlete = leader.athlete || {};
    const team = leader.team || {};
    return renderLeaderRow({
      rank,
      color: cat.color,
      name: athlete.displayName || '—',
      team: team.abbreviation || '',
      photo: athlete.headshot || null,
      teamLogo: team.logo || null,
      value: formatValue(cat.key, leader.displayValue ?? leader.value),
      meta1: athlete.position || null,
      meta2: athlete.jersey ? `#${athlete.jersey}` : null,
      href: athlete.id ? `https://wnba.propbetedge.ai/players/${athlete.id}` : null,
    });
  });

  return `
    <section class="leader-card">
      <div class="leader-card-head" style="border-color:${cat.color}33">
        <span class="leader-card-stat" style="color:${cat.color}">${cat.label}</span>
        <span class="leader-card-meta">Top ${rows.length}</span>
      </div>
      ${rows.join('')}
    </section>
  `;
}

function formatValue(key, value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return value ?? '—';
  if (key.includes('Percentage') || key.includes('Pct')) return `${n.toFixed(1)}%`;
  return Number.isInteger(n) ? n.toLocaleString('en-US') : n.toFixed(1);
}
