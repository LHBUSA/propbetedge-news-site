/**
 * src/pages/leaders-mlb.js — /leaders/mlb
 *
 * v3.12 — deep MLB leaderboard with computed advanced stats:
 *   Batting: AVG, HR, RBI, OPS, SB, R, H, 2B, BABIP*, ISO*, K%*, BB%*
 *   Pitching: ERA, K, W, WHIP, SV, K/9
 *   Premium teases: wOBA, xFIP, wRC+ (CORS-blocked sources)
 *
 * (* = computed client-side from MLB Stats API hitting stats endpoint)
 *
 * Each card shows top 10. Each player row shows:
 *   - Headshot with team logo overlay
 *   - Name (clickable to /player/mlb/:id)
 *   - Team · Position · Age
 *   - GP (games played)
 *   - Stat value
 */

import {
  leadersPageShell, renderStatCard, renderLeaderRow,
  renderEmptyStatCard, renderPremiumStatCard, renderLeaderLoading,
  computeBABIP, computeISO, computeKPct, computeBBPct,
  fmtAvg, fmtPct, fmtDec, fmtInt,
} from './leaders-shared.js';

let _activeType = 'batting'; // batting | pitching | advanced

// ─── Stat catalogs ──────────────────────────────────────────────────────

// Standard hitting categories (live from MLB Stats API leaders endpoint)
const BATTING_CATS = [
  { key: 'battingAverage',     label: 'AVG',  color: '#7FB3FF', fmt: fmtAvg },
  { key: 'homeRuns',           label: 'HR',   color: '#FF6B6B', fmt: fmtInt },
  { key: 'rbi',                label: 'RBI',  color: 'var(--gold)', fmt: fmtInt },
  { key: 'onBasePlusSlugging', label: 'OPS',  color: '#5FD38D', fmt: fmtAvg },
  { key: 'stolenBases',        label: 'SB',   color: '#FF8C42', fmt: fmtInt },
  { key: 'runs',               label: 'R',    color: '#7FB3FF', fmt: fmtInt },
  { key: 'hits',               label: 'H',    color: 'var(--paper-dim)', fmt: fmtInt },
  { key: 'doubles',            label: '2B',   color: 'var(--paper-dim)', fmt: fmtInt },
];

const PITCHING_CATS = [
  { key: 'earnedRunAverage',  label: 'ERA',  color: '#5FD38D', fmt: (v) => fmtDec(v, 2) },
  { key: 'strikeouts',        label: 'K',    color: '#FF6B6B', fmt: fmtInt },
  { key: 'wins',              label: 'W',    color: 'var(--gold)', fmt: fmtInt },
  { key: 'whip',              label: 'WHIP', color: '#7FB3FF', fmt: (v) => fmtDec(v, 2) },
  { key: 'saves',             label: 'SV',   color: '#FF8C42', fmt: fmtInt },
  { key: 'strikeoutsPer9Inn', label: 'K/9',  color: '#FF6B6B', fmt: (v) => fmtDec(v, 1) },
];

// Advanced stats — computed from `stats=season` endpoint, qualified hitters only
const ADVANCED_CATS = [
  { key: 'babip', label: 'BABIP', color: '#7FB3FF', dek: 'Batting average on balls in play', fmt: fmtAvg, compute: computeBABIP, sortDesc: true },
  { key: 'iso',   label: 'ISO',   color: '#FF6B6B', dek: 'Isolated power (SLG − AVG)',          fmt: fmtAvg, compute: computeISO,   sortDesc: true },
  { key: 'kpct',  label: 'K%',    color: '#FF8C42', dek: 'Strikeout rate (lower = better contact)', fmt: (v) => fmtPct(v, 1), compute: computeKPct, sortDesc: false },
  { key: 'bbpct', label: 'BB%',   color: '#5FD38D', dek: 'Walk rate (higher = better eye)',          fmt: (v) => fmtPct(v, 1), compute: computeBBPct, sortDesc: true },
];

// Premium teases (CORS-blocked sources)
const PREMIUM_CATS = [
  { label: 'wOBA',   color: '#5FD38D', statName: 'Weighted On-Base Average', dek: 'Single most predictive offensive stat. Sourced from FanGraphs.' },
  { label: 'xFIP',   color: '#FF6B6B', statName: 'Expected Fielding Indep. Pitching', dek: 'Strips luck from ERA. Sourced from FanGraphs.' },
  { label: 'wRC+',   color: 'var(--gold)', statName: 'Weighted Runs Created Plus', dek: 'Park-and-league-adjusted offense. 100 = league avg.' },
];

// ─── Mount ──────────────────────────────────────────────────────────────
export async function renderMlbLeadersPage(root) {
  // Initial shell with sub-tabs + body placeholder
  const dek = 'Batting, pitching, and advanced sabermetrics — sourced from MLB Stats API. Tap any player for detail.';
  root.innerHTML = leadersPageShell('mlb', 'MLB', dek, `
    <div class="leaders-subtabs">
      <button class="leaders-subtab ${_activeType === 'batting' ? 'active' : ''}" data-type="batting">Batting</button>
      <button class="leaders-subtab ${_activeType === 'pitching' ? 'active' : ''}" data-type="pitching">Pitching</button>
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

  if (_activeType === 'batting') return loadBatting(body);
  if (_activeType === 'pitching') return loadPitching(body);
  if (_activeType === 'advanced') return loadAdvanced(body);
}

// ─── Batting (basic categories) ────────────────────────────────────────
async function loadBatting(body) {
  const season = currentMlbSeason();
  const tryYear = (year) => Promise.all(BATTING_CATS.map((cat) =>
    fetch(`https://statsapi.mlb.com/api/v1/stats/leaders?leaderCategories=${cat.key}&statGroup=hitting&season=${year}&limit=10`)
      .then((r) => r.ok ? r.json() : null)
      .catch(() => null)
  ));

  let results = await tryYear(season);
  let useYear = season;
  if (!results.some((r) => r?.leagueLeaders?.[0]?.leaders?.length)) {
    results = await tryYear(season - 1);
    useYear = season - 1;
  }

  const banner = useYear !== season ? `
    <div class="leaders-banner">⚡ Showing ${useYear} season — ${season} stats populate as games are played.</div>
  ` : '';

  body.innerHTML = `
    ${banner}
    <div class="leaders-grid">
      ${BATTING_CATS.map((cat, i) => {
        const leaders = (results[i]?.leagueLeaders?.[0]?.leaders || []).slice(0, 10);
        if (!leaders.length) return renderEmptyStatCard(cat.label, cat.color);
        const rows = leaders.map((l, rank) => {
          const id = l.person?.id;
          const photo = id ? `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/c_fill,g_face,h_200,w_200,q_auto:best/v1/people/${id}/headshot/67/current` : null;
          const teamLogo = l.team?.id ? `https://www.mlbstatic.com/team-logos/${l.team.id}.svg` : null;
          return renderLeaderRow({
            rank, color: cat.color,
            name: l.person?.fullName || '—',
            team: l.team?.abbreviation || '',
            photo, teamLogo,
            value: cat.fmt(l.value),
            href: id ? `/player/mlb/${id}` : null,
          });
        });
        return renderStatCard(cat.label, cat.color, rows);
      }).join('')}
    </div>
  `;
}

// ─── Pitching (basic categories) ───────────────────────────────────────
async function loadPitching(body) {
  const season = currentMlbSeason();
  const tryYear = (year) => Promise.all(PITCHING_CATS.map((cat) =>
    fetch(`https://statsapi.mlb.com/api/v1/stats/leaders?leaderCategories=${cat.key}&statGroup=pitching&season=${year}&limit=10`)
      .then((r) => r.ok ? r.json() : null)
      .catch(() => null)
  ));

  let results = await tryYear(season);
  let useYear = season;
  if (!results.some((r) => r?.leagueLeaders?.[0]?.leaders?.length)) {
    results = await tryYear(season - 1);
    useYear = season - 1;
  }

  const banner = useYear !== season ? `
    <div class="leaders-banner">⚡ Showing ${useYear} season — ${season} stats populate as games are played.</div>
  ` : '';

  body.innerHTML = `
    ${banner}
    <div class="leaders-grid">
      ${PITCHING_CATS.map((cat, i) => {
        const leaders = (results[i]?.leagueLeaders?.[0]?.leaders || []).slice(0, 10);
        if (!leaders.length) return renderEmptyStatCard(cat.label, cat.color);
        const rows = leaders.map((l, rank) => {
          const id = l.person?.id;
          const photo = id ? `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/c_fill,g_face,h_200,w_200,q_auto:best/v1/people/${id}/headshot/67/current` : null;
          const teamLogo = l.team?.id ? `https://www.mlbstatic.com/team-logos/${l.team.id}.svg` : null;
          return renderLeaderRow({
            rank, color: cat.color,
            name: l.person?.fullName || '—',
            team: l.team?.abbreviation || '',
            photo, teamLogo,
            value: cat.fmt(l.value),
            href: id ? `/player/mlb/${id}` : null,
          });
        });
        return renderStatCard(cat.label, cat.color, rows);
      }).join('')}
    </div>
  `;
}

// ─── Advanced (computed client-side + premium teases) ──────────────────
async function loadAdvanced(body) {
  const season = currentMlbSeason();
  // Pull top 50 by OPS and run computations on that pool
  const tryYear = (year) => fetch(
    `https://statsapi.mlb.com/api/v1/stats/leaders?leaderCategories=onBasePlusSlugging&statGroup=hitting&season=${year}&limit=50`
  ).then((r) => r.ok ? r.json() : null).catch(() => null);

  let data = await tryYear(season);
  let useYear = season;
  if (!data?.leagueLeaders?.[0]?.leaders?.length) {
    data = await tryYear(season - 1);
    useYear = season - 1;
  }

  const pool = data?.leagueLeaders?.[0]?.leaders || [];
  if (!pool.length) {
    body.innerHTML = `<div class="games-empty"><h3>Advanced stats unavailable</h3><p>Check back after the season opens.</p></div>`;
    return;
  }

  // Each leader from `/leaders` only has one stat value — to compute BABIP/ISO/K%/BB%
  // we need full season stat lines per player. Fetch them in parallel (capped at 30).
  const ids = pool.slice(0, 30).map((l) => l.person?.id).filter(Boolean);
  const players = await Promise.all(ids.map(async (id) => {
    const r = await fetch(`https://statsapi.mlb.com/api/v1/people/${id}/stats?stats=season&group=hitting&season=${useYear}&sportId=1`)
      .then((r) => r.ok ? r.json() : null).catch(() => null);
    const stat = r?.stats?.[0]?.splits?.[0]?.stat;
    if (!stat) return null;
    const seedRow = pool.find((l) => l.person?.id === id);
    return {
      id,
      name: seedRow?.person?.fullName,
      team: seedRow?.team?.abbreviation,
      teamId: seedRow?.team?.id,
      stat,
    };
  })).then((arr) => arr.filter(Boolean));

  const banner = useYear !== season
    ? `<div class="leaders-banner">⚡ Showing ${useYear} season · advanced stats computed from MLB Stats API · qualified hitters only.</div>`
    : `<div class="leaders-banner">⚡ Advanced stats computed from MLB Stats API · top 30 by OPS qualifying.</div>`;

  body.innerHTML = `
    ${banner}
    <div class="leaders-grid">
      ${ADVANCED_CATS.map((cat) => renderAdvancedCard(cat, players)).join('')}
      ${PREMIUM_CATS.map((p) => renderPremiumStatCard(p.label, p.color, p.statName, p.dek)).join('')}
    </div>
  `;
}

function renderAdvancedCard(cat, players) {
  // Compute the stat for each player, drop nulls, sort
  const computed = players
    .map((p) => ({
      ...p,
      computed: cat.compute(p.stat),
    }))
    .filter((p) => p.computed != null && isFinite(p.computed));

  computed.sort((a, b) => cat.sortDesc ? b.computed - a.computed : a.computed - b.computed);
  const top = computed.slice(0, 10);
  if (!top.length) return renderEmptyStatCard(cat.label, cat.color, 'Insufficient sample size');

  const rows = top.map((p, rank) => {
    const photo = p.id ? `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/c_fill,g_face,h_200,w_200,q_auto:best/v1/people/${p.id}/headshot/67/current` : null;
    const teamLogo = p.teamId ? `https://www.mlbstatic.com/team-logos/${p.teamId}.svg` : null;
    return renderLeaderRow({
      rank, color: cat.color,
      name: p.name || '—',
      team: p.team || '',
      photo, teamLogo,
      value: cat.fmt(p.computed),
      meta1: `GP: ${p.stat.gamesPlayed || '?'}`,
      meta2: `AB: ${p.stat.atBats || '?'}`,
      href: p.id ? `/player/mlb/${p.id}` : null,
    });
  });

  return `
    <div class="leader-card">
      <div class="leader-card-head" style="border-color:${cat.color}33">
        <span class="leader-card-stat" style="color:${cat.color}">${cat.label}</span>
        <span class="leader-card-meta">${cat.dek}</span>
      </div>
      ${rows.join('')}
    </div>
  `;
}

function currentMlbSeason() {
  // MLB season runs Mar–Oct. Before March, last year's season is the "current" data.
  const now = new Date();
  if (now.getMonth() < 2) return now.getFullYear() - 1;
  return now.getFullYear();
}
