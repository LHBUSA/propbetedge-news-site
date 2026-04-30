/**
 * src/pages/leaders-nba.js — /leaders/nba
 *
 * v3.12 — NBA leaderboard with basic + computed advanced stats.
 *
 *   Basic: PPG, RPG, APG, SPG, BPG, 3P%
 *   Advanced: TS%*, eFG%*  (computed from ESPN box-score stats)
 *   Premium teases: PER, BPM, Win Shares (sourced from Basketball-Reference)
 *
 * (* = computed client-side from ESPN data)
 */

import {
  leadersPageShell, renderStatCard, renderLeaderRow,
  renderEmptyStatCard, renderPremiumStatCard, renderLeaderLoading,
  computeTSPct, computeEFGPct,
  fmtAvg, fmtPct, fmtDec, fmtInt,
} from './leaders-shared.js';

let _activeType = 'basic'; // basic | advanced

const BASIC_CATS = [
  { espn: 'avgPoints',                   label: 'PPG',  color: '#FF6B6B', fmt: (v) => fmtDec(v, 1) },
  { espn: 'avgRebounds',                 label: 'RPG',  color: '#7FB3FF', fmt: (v) => fmtDec(v, 1) },
  { espn: 'avgAssists',                  label: 'APG',  color: 'var(--gold)', fmt: (v) => fmtDec(v, 1) },
  { espn: 'avgSteals',                   label: 'SPG',  color: '#5FD38D', fmt: (v) => fmtDec(v, 1) },
  { espn: 'avgBlocks',                   label: 'BPG',  color: '#FF8C42', fmt: (v) => fmtDec(v, 1) },
  { espn: 'threePointFieldGoalPct',      label: '3P%',  color: '#7FB3FF', fmt: (v) => fmtPct(v, 1) },
];

const PREMIUM_NBA_CATS = [
  { label: 'PER',         color: '#FF6B6B', statName: 'Player Efficiency Rating',   dek: 'Per-minute production composite. 15 = league avg, 25+ = All-Star.' },
  { label: 'BPM',         color: '#7FB3FF', statName: 'Box Plus/Minus',             dek: 'Per-100-possession contribution above average. Sourced from Basketball-Reference.' },
  { label: 'Win Shares',  color: 'var(--gold)', statName: 'Win Shares',             dek: 'Estimated wins contributed by a player. Career narrative stat.' },
];

export async function renderNbaLeadersPage(root) {
  const dek = 'Scoring, rebounding, playmaking, and shooting efficiency — sourced from ESPN. Tap any player for detail.';
  root.innerHTML = leadersPageShell('nba', 'NBA', dek, `
    <div class="leaders-subtabs">
      <button class="leaders-subtab ${_activeType === 'basic' ? 'active' : ''}" data-type="basic">Basic</button>
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

  if (_activeType === 'basic') return loadBasic(body);
  if (_activeType === 'advanced') return loadAdvanced(body);
}

async function loadBasic(body) {
  // ESPN's leaders endpoint returns all categories in one call
  const season = new Date().getFullYear();
  const url = `https://site.api.espn.com/apis/v2/sports/basketball/nba/leaders?season=${season}&seasontype=2`;
  const data = await fetch(url).then((r) => r.ok ? r.json() : null).catch(() => null);

  if (!data?.categories?.length) {
    body.innerHTML = `<div class="games-empty"><h3>NBA leaders loading</h3><p>If this persists, try reloading or check during active games.</p></div>`;
    return;
  }

  body.innerHTML = `
    <div class="leaders-grid">
      ${BASIC_CATS.map((cat) => {
        const c = data.categories.find((x) => x.name === cat.espn);
        const leaders = (c?.leaders || []).slice(0, 10);
        return renderNbaCard(cat, leaders);
      }).join('')}
    </div>
  `;
}

function renderNbaCard(cat, leaders) {
  if (!leaders.length) return renderEmptyStatCard(cat.label, cat.color);
  const rows = leaders.map((l, rank) => {
    const ath = l.athlete || {};
    const id = ath.id;
    const photo = ath.headshot?.href || ath.headshot;
    const team = ath.team?.abbreviation;
    const teamLogo = ath.team?.logos?.[0]?.href;
    const pos = ath.position?.abbreviation;
    const age = ath.age;
    return renderLeaderRow({
      rank, color: cat.color,
      name: ath.displayName || '—',
      team: team || '',
      photo, teamLogo,
      value: cat.fmt(l.value),
      meta1: pos || null,
      meta2: age ? `${age} yrs` : null,
      href: id ? `/player/nba/${id}` : null,
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

async function loadAdvanced(body) {
  // ESPN's leaders endpoint includes shooting stats we need to compute TS% and eFG%
  // Categories needed: avgPoints, avgFieldGoalsAttempted, avgFreeThrowsAttempted,
  //                    avgFieldGoalsMade, avgThreePointFieldGoalsMade
  const season = new Date().getFullYear();
  const url = `https://site.api.espn.com/apis/v2/sports/basketball/nba/leaders?season=${season}&seasontype=2`;
  const data = await fetch(url).then((r) => r.ok ? r.json() : null).catch(() => null);

  if (!data?.categories?.length) {
    body.innerHTML = `<div class="games-empty"><h3>Advanced data unavailable</h3><p>Coming soon · ESPN endpoint sometimes dark between games.</p></div>`;
    return;
  }

  // Build player pool from PPG leaders, cross-reference shooting stats
  const ppgList = data.categories.find((c) => c.name === 'avgPoints')?.leaders || [];
  const pool = ppgList.slice(0, 30).map((l) => {
    const ath = l.athlete || {};
    return {
      id: ath.id,
      name: ath.displayName,
      team: ath.team?.abbreviation,
      teamLogo: ath.team?.logos?.[0]?.href,
      photo: ath.headshot?.href || ath.headshot,
      position: ath.position?.abbreviation,
      age: ath.age,
      avgPoints: l.value,
    };
  });

  // For each shooting stat, fold it into the pool by athlete id
  const foldStat = (espnKey, ourKey) => {
    const list = data.categories.find((c) => c.name === espnKey)?.leaders || [];
    list.forEach((l) => {
      const id = l.athlete?.id;
      const target = pool.find((p) => p.id === id);
      if (target) target[ourKey] = l.value;
    });
  };
  foldStat('avgFieldGoalsAttempted',          'avgFieldGoalsAttempted');
  foldStat('avgFieldGoalsMade',               'avgFieldGoalsMade');
  foldStat('avgFreeThrowsAttempted',          'avgFreeThrowsAttempted');
  foldStat('avgThreePointFieldGoalsMade',     'avgThreePointFieldGoalsMade');

  const tsLeaders = pool
    .map((p) => ({ ...p, computed: computeTSPct(p) }))
    .filter((p) => p.computed != null && p.avgFieldGoalsAttempted >= 8) // min volume filter
    .sort((a, b) => b.computed - a.computed)
    .slice(0, 10);

  const efgLeaders = pool
    .map((p) => ({ ...p, computed: computeEFGPct(p) }))
    .filter((p) => p.computed != null && p.avgFieldGoalsAttempted >= 8)
    .sort((a, b) => b.computed - a.computed)
    .slice(0, 10);

  const renderComputed = (label, color, list, fmt, tagline) => {
    if (!list.length) return renderEmptyStatCard(label, color, 'Insufficient data');
    const rows = list.map((p, rank) => renderLeaderRow({
      rank, color,
      name: p.name || '—',
      team: p.team || '',
      photo: p.photo,
      teamLogo: p.teamLogo,
      value: fmt(p.computed),
      meta1: p.position || null,
      meta2: p.age ? `${p.age} yrs` : null,
      href: p.id ? `/player/nba/${p.id}` : null,
    }));
    return `
      <div class="leader-card">
        <div class="leader-card-head" style="border-color:${color}33">
          <span class="leader-card-stat" style="color:${color}">${label}</span>
          <span class="leader-card-meta">${tagline}</span>
        </div>
        ${rows.join('')}
      </div>
    `;
  };

  body.innerHTML = `
    <div class="leaders-banner">⚡ Advanced stats computed from ESPN per-game shooting splits · top 30 scorers, min 8 FGA/g.</div>
    <div class="leaders-grid">
      ${renderComputed('TS%',  '#5FD38D', tsLeaders,  (v) => fmtPct(v, 1), 'True Shooting Percentage')}
      ${renderComputed('eFG%', '#7FB3FF', efgLeaders, (v) => fmtPct(v, 1), 'Effective Field Goal %')}
      ${PREMIUM_NBA_CATS.map((p) => renderPremiumStatCard(p.label, p.color, p.statName, p.dek)).join('')}
    </div>
  `;
}
