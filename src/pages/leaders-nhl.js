/**
 * src/pages/leaders-nhl.js — /leaders/nhl
 *
 * v3.12 — NHL leaderboard with skater/goalie split + computed advanced stats.
 *
 *   Skaters: G, A, P, +/-, P/60*, SH%*
 *   Goalies: W, SV%, GAA, SHO
 *   Premium teases: Corsi, PDO, xGF% (CORS-blocked sources)
 *
 * (* = computed client-side from api-web.nhle.com data)
 */

import {
  leadersPageShell, renderStatCard, renderLeaderRow,
  renderEmptyStatCard, renderPremiumStatCard, renderLeaderLoading,
  computeNhlShPct, computeNhlP60,
  fmtAvg, fmtPct, fmtDec, fmtInt,
} from './leaders-shared.js';

let _activeType = 'skater'; // skater | goalie | advanced

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
  { label: 'Corsi For %',      color: '#7FB3FF', statName: 'CF% — Shot Attempt Differential', dek: 'Possession metric. % of all shot attempts taken by your team while on ice.' },
  { label: 'PDO',              color: '#FF6B6B', statName: 'PDO — Luck Indicator',           dek: "Sum of team SH% and SV% while on ice. ~1.000 = average. Above = lucky." },
  { label: 'xGF%',             label2: 'Expected Goals For %', color: 'var(--gold)', statName: 'xGF% — Expected Goals For %', dek: 'Quality-weighted shot share. % of expected goals taken by your team.' },
];

export async function renderNhlLeadersPage(root) {
  const dek = 'Skater scoring, goalie performance, and advanced metrics — sourced from api-web.nhle.com.';
  root.innerHTML = leadersPageShell('nhl', 'NHL', dek, `
    <div class="leaders-subtabs">
      <button class="leaders-subtab ${_activeType === 'skater' ? 'active' : ''}" data-type="skater">Skaters</button>
      <button class="leaders-subtab ${_activeType === 'goalie' ? 'active' : ''}" data-type="goalie">Goalies</button>
      <button class="leaders-subtab ${_activeType === 'advanced' ? 'active' : ''}" data-type="advanced">Advanced</button>
    </div>
    <div id="leaders-body">${renderLeaderLoading()}</div>
  `, 'UPDATED LIVE');

  document.querySelectorAll('.leaders-subtab').forEach((btn) => {
    btn.addEventListener('click', () => {
      _activeType = btn.dataset.type;
      document.querySelectorAll('.leaders-subtab').forEach((b) => b.classList.toggle('active', b.dataset.type === _activeType));
      loadActive();
    });
  });

  loadActive();
}

async function loadActive() {
  const body = document.getElementById('leaders-body');
  if (!body) return;
  body.innerHTML = renderLeaderLoading();

  if (_activeType === 'skater') return loadSkaters(body);
  if (_activeType === 'goalie') return loadGoalies(body);
  if (_activeType === 'advanced') return loadAdvanced(body);
}

async function loadSkaters(body) {
  const season = nhlSeasonString();
  // gameType 2 = regular, 3 = playoffs — try playoffs first for active games
  const tryGameType = async (gt) => {
    const cats_param = SKATER_CATS.map((c) => c.key).join(',');
    return fetch(`https://api-web.nhle.com/v1/skater-stats-leaders/${season}/${gt}?categories=${cats_param}&limit=10`)
      .then((r) => r.ok ? r.json() : null).catch(() => null);
  };

  // Try playoffs (3) first for active leaders
  let data = await tryGameType(3);
  let usingPlayoffs = data && SKATER_CATS.some((c) => data[c.key]?.length);
  if (!usingPlayoffs) data = await tryGameType(2);

  if (!data) {
    body.innerHTML = `<div class="games-empty"><h3>NHL leaders unavailable</h3><p>Try refreshing in a moment.</p></div>`;
    return;
  }

  const banner = usingPlayoffs
    ? `<div class="leaders-banner">🏆 Showing playoff leaders · regular season available below the fold.</div>`
    : '';

  body.innerHTML = `
    ${banner}
    <div class="leaders-grid">
      ${SKATER_CATS.map((cat) => renderNhlSkaterCard(cat, data[cat.key] || [])).join('')}
    </div>
  `;
}

function renderNhlSkaterCard(cat, leaders) {
  if (!leaders.length) return renderEmptyStatCard(cat.label, cat.color);
  const rows = leaders.slice(0, 10).map((l, rank) => {
    const id = l.id;
    const first = l.firstName?.default || '';
    const last = l.lastName?.default || '';
    const name = `${first} ${last}`.trim() || '—';
    const team = l.teamAbbrev || '';
    const photo = l.headshot || (id ? `https://assets.nhle.com/mugs/nhl/20242025/${team}/${id}.png` : null);
    const teamLogo = team ? `https://assets.nhle.com/logos/nhl/svg/${team}_light.svg` : null;
    return renderLeaderRow({
      rank, color: cat.color,
      name, team,
      photo, teamLogo,
      value: cat.fmt ? cat.fmt(l.value) : l.value,
      meta1: l.position || null,
      meta2: l.gamesPlayed != null ? `GP: ${l.gamesPlayed}` : null,
      href: id ? `/player/nhl/${id}` : null,
    });
  });
  return `
    <div class="leader-card">
      <div class="leader-card-head" style="border-color:${cat.color}33">
        <span class="leader-card-stat" style="color:${cat.color}">${cat.label}</span>
        <span class="leader-card-meta">Top ${rows.length}</span>
      </div>
      ${rows.join('')}
    </div>
  `;
}

async function loadGoalies(body) {
  const season = nhlSeasonString();
  const tryGameType = async (gt) => {
    const cats_param = GOALIE_CATS.map((c) => c.key).join(',');
    return fetch(`https://api-web.nhle.com/v1/goalie-stats-leaders/${season}/${gt}?categories=${cats_param}&limit=10`)
      .then((r) => r.ok ? r.json() : null).catch(() => null);
  };

  let data = await tryGameType(3);
  let usingPlayoffs = data && GOALIE_CATS.some((c) => data[c.key]?.length);
  if (!usingPlayoffs) data = await tryGameType(2);

  if (!data) {
    body.innerHTML = `<div class="games-empty"><h3>NHL goalies unavailable</h3><p>Try refreshing in a moment.</p></div>`;
    return;
  }

  const banner = usingPlayoffs ? `<div class="leaders-banner">🏆 Showing playoff goalies.</div>` : '';

  body.innerHTML = `
    ${banner}
    <div class="leaders-grid">
      ${GOALIE_CATS.map((cat) => renderNhlSkaterCard(cat, data[cat.key] || [])).join('')}
    </div>
  `;
}

async function loadAdvanced(body) {
  // For advanced, pull top points-getters and compute SH% + P/60 from their stat lines
  const season = nhlSeasonString();
  const data = await fetch(`https://api-web.nhle.com/v1/skater-stats-leaders/${season}/2?categories=points,goals,shots,timeOnIcePerGame&limit=30`)
    .then((r) => r.ok ? r.json() : null).catch(() => null);

  if (!data?.points?.length) {
    body.innerHTML = `<div class="games-empty"><h3>Advanced data unavailable</h3><p>Coming soon · check back during the season.</p></div>`;
    return;
  }

  // Build a player pool with all stats merged
  const pool = {};
  ['points', 'goals', 'shots', 'timeOnIcePerGame'].forEach((key) => {
    (data[key] || []).forEach((p) => {
      const id = p.id;
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

  const players = Object.values(pool).filter((p) => p.points && p.shots && p.timeOnIcePerGame);

  const shPctLeaders = players
    .map((p) => ({ ...p, computed: computeNhlShPct({ goals: p.goals || 0, shots: p.shots }) }))
    .filter((p) => p.computed != null)
    .sort((a, b) => b.computed - a.computed)
    .slice(0, 10);

  const p60Leaders = players
    .map((p) => ({ ...p, computed: computeNhlP60({ points: p.points, timeOnIcePerGame: p.timeOnIcePerGame }) }))
    .filter((p) => p.computed != null)
    .sort((a, b) => b.computed - a.computed)
    .slice(0, 10);

  const renderComputedCard = (label, color, list, fmt) => {
    if (!list.length) return renderEmptyStatCard(label, color);
    const rows = list.map((p, rank) => {
      const teamLogo = p.team ? `https://assets.nhle.com/logos/nhl/svg/${p.team}_light.svg` : null;
      return renderLeaderRow({
        rank, color,
        name: p.name || '—',
        team: p.team || '',
        photo: p.headshot,
        teamLogo,
        value: fmt(p.computed),
        meta1: p.position || null,
        meta2: p.gamesPlayed ? `GP: ${p.gamesPlayed}` : null,
        href: p.id ? `/player/nhl/${p.id}` : null,
      });
    });
    return `
      <div class="leader-card">
        <div class="leader-card-head" style="border-color:${color}33">
          <span class="leader-card-stat" style="color:${color}">${label}</span>
          <span class="leader-card-meta">Computed</span>
        </div>
        ${rows.join('')}
      </div>
    `;
  };

  body.innerHTML = `
    <div class="leaders-banner">⚡ Advanced stats computed from api-web.nhle.com · top 30 by points qualifying.</div>
    <div class="leaders-grid">
      ${renderComputedCard('SH%', '#FF6B6B', shPctLeaders, (v) => fmtPct(v, 1))}
      ${renderComputedCard('P/60', 'var(--gold)', p60Leaders, (v) => fmtDec(v, 2))}
      ${PREMIUM_NHL_CATS.map((p) => renderPremiumStatCard(p.label, p.color, p.statName, p.dek)).join('')}
    </div>
  `;
}

function nhlSeasonString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (m >= 8) return `${y}${y + 1}`;
  return `${y - 1}${y}`;
}
