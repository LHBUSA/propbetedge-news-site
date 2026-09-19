/**
 * src/pages/leaders-nfl.js — /leaders/nfl
 *
 * Live NFL regular-season leaderboards backed by the same-origin
 * /api/nfl-leaders endpoint, which normalizes ESPN's league-leaders feed.
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

let _activeType = 'offense'; // offense | defense

const OFFENSE_CATS = [
  { key: 'passingYards',       label: 'Passing Yards', color: '#7FB3FF' },
  { key: 'passingTouchdowns',  label: 'Passing TD',    color: '#FF6B6B' },
  { key: 'quarterbackRating',  label: 'QB Rating',     color: 'var(--gold)' },
  { key: 'rushingYards',       label: 'Rushing Yards', color: '#5FD38D' },
  { key: 'rushingTouchdowns',  label: 'Rushing TD',    color: '#FF8C42' },
  { key: 'receivingYards',     label: 'Receiving Yards', color: '#9A7BFF' },
  { key: 'receptions',         label: 'Receptions',    color: '#51C4D3' },
  { key: 'receivingTouchdowns',label: 'Receiving TD',  color: '#E96BA8' },
];

const DEFENSE_CATS = [
  { key: 'totalTackles',    label: 'Total Tackles',   color: '#7FB3FF' },
  { key: 'sacks',           label: 'Sacks',           color: '#FF6B6B' },
  { key: 'interceptions',   label: 'Interceptions',   color: 'var(--gold)' },
  { key: 'passesDefended',  label: 'Passes Defended', color: '#5FD38D' },
];

let _payload = null;
let _loadingPromise = null;

export async function renderNflLeadersPage(root) {
  const season = currentNflSeason();
  const dek = `${season} regular-season player leaderboards — live passing, rushing, receiving and defensive rankings sourced from ESPN.`;

  root.innerHTML = leadersPageShell('nfl', 'NFL', dek, `
    <div class="leaders-subtabs" aria-label="NFL leaderboard categories">
      <button class="leaders-subtab ${_activeType === 'offense' ? 'active' : ''}" data-type="offense">Offense</button>
      <button class="leaders-subtab ${_activeType === 'defense' ? 'active' : ''}" data-type="defense">Defense</button>
    </div>
    ${renderLeaderLiveStatus('ESPN', 60)}
    <div id="leaders-body">${renderLeaderLoading()}</div>
  `, 'UPDATED LIVE');

  document.querySelectorAll('.leaders-subtab').forEach((btn) => {
    btn.addEventListener('click', () => {
      _activeType = btn.dataset.type;
      document.querySelectorAll('.leaders-subtab').forEach((b) => {
        b.classList.toggle('active', b.dataset.type === _activeType);
      });
      renderActive();
    });
  });

  await loadData({ force: true });
  renderActive();
  markLeaderUpdated('ESPN');
  startLeaderAutoRefresh('nfl', async () => {
    await loadData({ force: true });
    renderActive();
    markLeaderUpdated('ESPN');
  }, 60000);
}

async function loadData({ force = false } = {}) {
  if (_payload && !force) return _payload;
  if (_loadingPromise) return _loadingPromise;

  const season = currentNflSeason();
  _loadingPromise = fetch(`/api/nfl-leaders?season=${season}&seasontype=2`, {
    credentials: 'omit',
    cache: 'no-store',
  })
    .then((response) => {
      if (!response.ok) throw new Error(`NFL leaders ${response.status}`);
      return response.json();
    })
    .then((data) => {
      _payload = data;
      return data;
    })
    .catch((error) => {
      console.warn('[leaders/nfl] live leaders unavailable:', error);
      return null;
    })
    .finally(() => {
      _loadingPromise = null;
    });

  return _loadingPromise;
}

function renderActive() {
  const body = document.getElementById('leaders-body');
  if (!body) return;

  if (!_payload?.categories?.length) {
    body.innerHTML = `
      <div class="games-empty">
        <h3>NFL leaders temporarily unavailable</h3>
        <p>The 2026 regular-season feed could not be loaded. Refresh in a moment.</p>
      </div>
    `;
    return;
  }

  const cats = _activeType === 'defense' ? DEFENSE_CATS : OFFENSE_CATS;
  const source = _payload.source || 'ESPN';
  const season = _payload.season || currentNflSeason();

  body.innerHTML = `
    <div class="leaders-banner">
      🏈 ${season} regular season · ${source} league leaders · Top 10 in each category
    </div>
    <div class="leaders-grid">
      ${cats.map((cat) => renderNflCard(cat, findCategory(cat.key))).join('')}
    </div>
  `;
}

function findCategory(key) {
  return _payload?.categories?.find((category) => category.name === key) || null;
}

function renderNflCard(cat, category) {
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
      value: leader.displayValue ?? formatValue(leader.value),
      meta1: athlete.position || null,
      meta2: athlete.jersey ? `#${athlete.jersey}` : null,
      href: athlete.id ? `/player/nfl/${athlete.id}` : null,
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

function formatValue(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return value ?? '—';
  return Number.isInteger(n) ? n.toLocaleString('en-US') : n.toFixed(1);
}

function currentNflSeason() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-based
  return month <= 1 ? year - 1 : year;
}
