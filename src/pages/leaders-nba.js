/**
 * /leaders/nba — live-ready NBA leaderboards.
 *
 * The page probes the upcoming/current ESPN season first. Before opening night,
 * it falls back to the last completed season and keeps probing every 60 seconds.
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

let _activeType = 'basic';
let _payload = null;
let _loading = null;
let _usingSeason = null;

const BASIC_CATS = [
  { key: 'pointsPerGame',   label: 'PPG', color: '#FF6B6B' },
  { key: 'reboundsPerGame', label: 'RPG', color: '#7FB3FF' },
  { key: 'assistsPerGame',  label: 'APG', color: 'var(--gold)' },
  { key: 'stealsPerGame',   label: 'SPG', color: '#5FD38D' },
  { key: 'blocksPerGame',   label: 'BPG', color: '#FF8C42' },
];

const ADVANCED_CATS = [
  { key: 'fieldGoalPercentage', label: 'FG%', color: '#9A7BFF', pct: true },
  { key: '3PointPct',           label: '3P%', color: '#51C4D3', pct: true },
  { key: 'FreeThrowPct',        label: 'FT%', color: '#5FD38D', pct: true },
  { key: 'PER',                 label: 'PER', color: 'var(--gold)' },
  { key: '3PointsMadePerGame',  label: '3PM', color: '#E96BA8' },
  { key: 'doubleDouble',        label: 'Double-Doubles', color: '#FF8C42' },
];

export async function renderNbaLeadersPage(root) {
  const targetSeason = currentNbaSeason();
  root.innerHTML = leadersPageShell('nba', 'NBA',
    `${formatNbaSeason(targetSeason)} leaderboards are pre-wired and will activate automatically when the regular-season feed opens.`,
    `
      <div class="leaders-subtabs">
        <button class="leaders-subtab ${_activeType === 'basic' ? 'active' : ''}" data-type="basic">Leaders</button>
        <button class="leaders-subtab ${_activeType === 'advanced' ? 'active' : ''}" data-type="advanced">Shooting + Advanced</button>
      </div>
      ${renderLeaderLiveStatus('ESPN', 60)}
      <div id="leaders-body">${renderLeaderLoading()}</div>
    `,
    'AUTO-READY',
  );

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

  startLeaderAutoRefresh('nba', async () => {
    await loadData({ force: true });
    renderActive();
    markLeaderUpdated('ESPN');
  }, 60000);
}

async function loadData({ force = false } = {}) {
  if (_payload && !force) return _payload;
  if (_loading) return _loading;

  _loading = (async () => {
    const target = currentNbaSeason();
    const current = await fetchSeason(target);
    if (current?.categories?.length) {
      _payload = current;
      _usingSeason = target;
      return current;
    }

    const fallback = await fetchSeason(target - 1);
    if (fallback?.categories?.length) {
      _payload = fallback;
      _usingSeason = target - 1;
      return fallback;
    }

    return null;
  })().finally(() => {
    _loading = null;
  });

  return _loading;
}

async function fetchSeason(season) {
  try {
    const response = await fetch(`/api/nba-leaders?season=${season}`, {
        credentials: 'omit',
    });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

function renderActive() {
  const body = document.getElementById('leaders-body');
  if (!body) return;

  if (!_payload?.categories?.length) {
    body.innerHTML = `
      <div class="games-empty">
        <h3>NBA leaders waiting for the season feed</h3>
        <p>This page checks automatically every 60 seconds and will populate as soon as the regular-season feed opens.</p>
      </div>
    `;
    return;
  }

  const target = currentNbaSeason();
  const fallback = _usingSeason !== target;
  const cats = _activeType === 'advanced' ? ADVANCED_CATS : BASIC_CATS;

  body.innerHTML = `
    <div class="leaders-banner">
      🏀 ${fallback
        ? `Showing ${formatNbaSeason(_usingSeason)} · ${formatNbaSeason(target)} activates automatically when ESPN publishes it`
        : `${formatNbaSeason(_usingSeason)} regular season · live leaderboard feed`}
    </div>
    <div class="leaders-grid">
      ${cats.map((cat) => renderCard(cat, findCategory(cat.key))).join('')}
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
      value: formatValue(cat, leader.displayValue ?? leader.value),
      meta1: athlete.position || null,
      meta2: athlete.jersey ? `#${athlete.jersey}` : null,
      href: athlete.id ? `/player/nba/${athlete.id}` : null,
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

function formatValue(cat, value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return value ?? '—';
  if (cat.pct) return `${n.toFixed(1)}%`;
  return Number.isInteger(n) ? n.toLocaleString('en-US') : n.toFixed(1);
}

function currentNbaSeason() {
  const now = new Date();
  const year = now.getFullYear();
  return now.getMonth() >= 6 ? year + 1 : year;
}

function formatNbaSeason(season) {
  const start = season - 1;
  return `${start}–${String(season).slice(-2)}`;
}
