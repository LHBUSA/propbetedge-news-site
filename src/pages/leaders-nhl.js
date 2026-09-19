/**
 * /leaders/nhl — live-ready NHL leaderboards.
 *
 * Probes the current 2026-27 season first. Before the regular-season feed has
 * data, it shows the previous season and keeps checking every 60 seconds.
 */

import {
  leadersPageShell,
  renderLeaderRow,
  renderEmptyStatCard,
  renderPremiumStatCard,
  renderLeaderLoading,
  renderLeaderLiveStatus,
  markLeaderUpdated,
  startLeaderAutoRefresh,
  computeNhlShPct,
  computeNhlP60,
  fmtAvg,
  fmtPct,
  fmtDec,
} from './leaders-shared.js';

let _activeType = 'skater';

const SKATER_CATS = [
  { key: 'goals',     label: 'Goals',   color: '#FF6B6B' },
  { key: 'assists',   label: 'Assists', color: '#7FB3FF' },
  { key: 'points',    label: 'Points',  color: 'var(--gold)' },
  { key: 'plusMinus', label: '+/-',     color: '#5FD38D' },
];

const GOALIE_CATS = [
  { key: 'wins',                label: 'Wins',     color: 'var(--gold)' },
  { key: 'savePctg',            label: 'SV%',      color: '#5FD38D', fmt: (v) => fmtAvg(v) },
  { key: 'goalsAgainstAverage', label: 'GAA',      color: '#7FB3FF', fmt: (v) => fmtDec(v, 2) },
  { key: 'shutouts',            label: 'Shutouts', color: '#FF8C42' },
];

const PREMIUM_NHL_CATS = [
  { label: 'Corsi For %', color: '#7FB3FF', statName: 'CF% — Shot Attempt Differential', dek: 'Possession metric. % of all shot attempts taken by your team while on ice.' },
  { label: 'PDO', color: '#FF6B6B', statName: 'PDO — Luck Indicator', dek: 'Sum of team SH% and SV% while on ice. ~1.000 = average. Above = lucky.' },
  { label: 'xGF%', color: 'var(--gold)', statName: 'xGF% — Expected Goals For %', dek: 'Quality-weighted shot share. % of expected goals taken by your team.' },
];

export async function renderNhlLeadersPage(root) {
  const target = currentNhlSeasonString();
  root.innerHTML = leadersPageShell(
    'nhl',
    'NHL',
    `${formatNhlSeason(target)} skater and goalie leaderboards are pre-wired and will activate automatically when regular-season stats post.`,
    `
      <div class="leaders-subtabs">
        <button class="leaders-subtab ${_activeType === 'skater' ? 'active' : ''}" data-type="skater">Skaters</button>
        <button class="leaders-subtab ${_activeType === 'goalie' ? 'active' : ''}" data-type="goalie">Goalies</button>
        <button class="leaders-subtab ${_activeType === 'advanced' ? 'active' : ''}" data-type="advanced">Advanced</button>
      </div>
      ${renderLeaderLiveStatus('NHL API', 60)}
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
      loadActive();
    });
  });

  await loadActive();
  markLeaderUpdated('NHL API');

  startLeaderAutoRefresh('nhl', async () => {
    await loadActive({ silent: true });
    markLeaderUpdated('NHL API');
  }, 60000);
}

async function loadActive({ silent = false } = {}) {
  const body = document.getElementById('leaders-body');
  if (!body) return;
  if (!silent) body.innerHTML = renderLeaderLoading();

  if (_activeType === 'skater') return loadSkaters(body);
  if (_activeType === 'goalie') return loadGoalies(body);
  return loadAdvanced(body);
}

async function loadSkaters(body) {
  const target = currentNhlSeasonString();
  let data = await fetchSkaters(target);
  let using = target;

  if (!hasAny(data, SKATER_CATS)) {
    using = previousNhlSeasonString(target);
    data = await fetchSkaters(using);
  }

  if (!hasAny(data, SKATER_CATS)) {
    body.innerHTML = waitingState('NHL skater leaders');
    return;
  }

  body.innerHTML = `
    ${seasonBanner(target, using)}
    <div class="leaders-grid">
      ${SKATER_CATS.map((cat) => renderNhlCard(cat, data[cat.key] || [])).join('')}
    </div>
  `;
}

async function loadGoalies(body) {
  const target = currentNhlSeasonString();
  let data = await fetchGoalies(target);
  let using = target;

  if (!hasAny(data, GOALIE_CATS)) {
    using = previousNhlSeasonString(target);
    data = await fetchGoalies(using);
  }

  if (!hasAny(data, GOALIE_CATS)) {
    body.innerHTML = waitingState('NHL goalie leaders');
    return;
  }

  body.innerHTML = `
    ${seasonBanner(target, using)}
    <div class="leaders-grid">
      ${GOALIE_CATS.map((cat) => renderNhlCard(cat, data[cat.key] || [])).join('')}
    </div>
  `;
}

async function loadAdvanced(body) {
  const target = currentNhlSeasonString();
  let data = await fetchAdvanced(target);
  let using = target;

  if (!data?.points?.length) {
    using = previousNhlSeasonString(target);
    data = await fetchAdvanced(using);
  }

  if (!data?.points?.length) {
    body.innerHTML = waitingState('NHL advanced leaders');
    return;
  }

  const pool = {};
  ['points', 'goals', 'shots', 'timeOnIcePerGame'].forEach((key) => {
    (data[key] || []).forEach((p) => {
      const id = p.id;
      if (!id) return;
      if (!pool[id]) {
        pool[id] = {
          id,
          name: `${p.firstName?.default || ''} ${p.lastName?.default || ''}`.trim(),
          team: p.teamAbbrev,
          headshot: p.headshot,
          gamesPlayed: p.gamesPlayed,
          position: p.position,
        };
      }
      pool[id][key] = p.value;
    });
  });

  const players = Object.values(pool);
  const shPct = players
    .map((p) => ({ ...p, computed: computeNhlShPct({ goals: p.goals || 0, shots: p.shots || 0 }) }))
    .filter((p) => p.computed != null)
    .sort((a, b) => b.computed - a.computed)
    .slice(0, 10);

  const p60 = players
    .map((p) => ({ ...p, computed: computeNhlP60({ points: p.points || 0, timeOnIcePerGame: p.timeOnIcePerGame || 0 }) }))
    .filter((p) => p.computed != null)
    .sort((a, b) => b.computed - a.computed)
    .slice(0, 10);

  body.innerHTML = `
    ${seasonBanner(target, using)}
    <div class="leaders-banner">⚡ Advanced stats computed from NHL API leader pools.</div>
    <div class="leaders-grid">
      ${renderComputedCard('SH%', '#FF6B6B', shPct, (v) => fmtPct(v, 1))}
      ${renderComputedCard('P/60', 'var(--gold)', p60, (v) => fmtDec(v, 2))}
      ${PREMIUM_NHL_CATS.map((p) => renderPremiumStatCard(p.label, p.color, p.statName, p.dek)).join('')}
    </div>
  `;
}

async function fetchSkaters(season) {
  const cats = SKATER_CATS.map((c) => c.key).join(',');
  return fetchNhl(`https://api-web.nhle.com/v1/skater-stats-leaders/${season}/2?categories=${cats}&limit=10`);
}

async function fetchGoalies(season) {
  const cats = GOALIE_CATS.map((c) => c.key).join(',');
  return fetchNhl(`https://api-web.nhle.com/v1/goalie-stats-leaders/${season}/2?categories=${cats}&limit=10`);
}

async function fetchAdvanced(season) {
  return fetchNhl(`https://api-web.nhle.com/v1/skater-stats-leaders/${season}/2?categories=points,goals,shots,timeOnIcePerGame&limit=30`);
}

async function fetchNhl(url) {
  try {
    const join = url.includes('?') ? '&' : '?';
    const response = await fetch(`${url}${join}_=${Date.now()}`, { cache: 'no-store' });
    return response.ok ? response.json() : null;
  } catch {
    return null;
  }
}

function hasAny(data, cats) {
  return Boolean(data && cats.some((cat) => Array.isArray(data[cat.key]) && data[cat.key].length));
}

function renderNhlCard(cat, leaders) {
  if (!leaders.length) return renderEmptyStatCard(cat.label, cat.color);

  const rows = leaders.slice(0, 10).map((row, rank) => {
    const id = row.id;
    const name = `${row.firstName?.default || ''} ${row.lastName?.default || ''}`.trim() || '—';
    const team = row.teamAbbrev || '';
    const teamLogo = team ? `https://assets.nhle.com/logos/nhl/svg/${team}_light.svg` : null;
    return renderLeaderRow({
      rank,
      color: cat.color,
      name,
      team,
      photo: row.headshot || null,
      teamLogo,
      value: cat.fmt ? cat.fmt(row.value) : row.value,
      meta1: row.position || null,
      meta2: row.gamesPlayed != null ? `GP: ${row.gamesPlayed}` : null,
      href: id ? `/player/nhl/${id}` : null,
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

function renderComputedCard(label, color, list, formatter) {
  if (!list.length) return renderEmptyStatCard(label, color);
  const rows = list.map((p, rank) => {
    const teamLogo = p.team ? `https://assets.nhle.com/logos/nhl/svg/${p.team}_light.svg` : null;
    return renderLeaderRow({
      rank,
      color,
      name: p.name || '—',
      team: p.team || '',
      photo: p.headshot || null,
      teamLogo,
      value: formatter(p.computed),
      meta1: p.position || null,
      meta2: p.gamesPlayed ? `GP: ${p.gamesPlayed}` : null,
      href: p.id ? `/player/nhl/${p.id}` : null,
    });
  });

  return `
    <section class="leader-card">
      <div class="leader-card-head">
        <span class="leader-card-stat" style="color:${color}">${label}</span>
        <span class="leader-card-meta">Computed</span>
      </div>
      ${rows.join('')}
    </section>
  `;
}

function waitingState(label) {
  return `
    <div class="games-empty">
      <h3>${label} waiting for the season feed</h3>
      <p>This page checks automatically every 60 seconds and will populate when regular-season data is available.</p>
    </div>
  `;
}

function seasonBanner(target, using) {
  if (target === using) {
    return `<div class="leaders-banner">🏒 ${formatNhlSeason(using)} regular season · live NHL API feed</div>`;
  }
  return `<div class="leaders-banner">🏒 Showing ${formatNhlSeason(using)} · ${formatNhlSeason(target)} activates automatically when NHL posts regular-season leaders</div>`;
}

function currentNhlSeasonString() {
  const now = new Date();
  const year = now.getFullYear();
  return now.getMonth() >= 8 ? `${year}${year + 1}` : `${year - 1}${year}`;
}

function previousNhlSeasonString(season) {
  const start = Number(String(season).slice(0, 4)) - 1;
  return `${start}${start + 1}`;
}

function formatNhlSeason(season) {
  const raw = String(season || '');
  if (raw.length !== 8) return raw;
  return `${raw.slice(0, 4)}–${raw.slice(6, 8)}`;
}
