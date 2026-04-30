/**
 * src/pages/leaders-mlb.js — /leaders/mlb
 *
 * v4.0 — VISUAL UPGRADE (matches games-hub v4 design language)
 *   - Self-contained styles injected inline (drop-in)
 *   - Pill subtabs with MLB-red active state
 *   - Glassmorphism stat cards with per-stat color accent + hover lift
 *   - Premium rows with gradient rank numerals, ring-on-hover headshots
 *   - Premium stat cards: locked/aspirational gold-tinted treatment
 *   - Refined banner with MLB-red accent line
 *   - Stagger card entrance, mobile responsive, reduced-motion aware
 *
 * v3.12 (preserved logic):
 *   Batting: AVG, HR, RBI, OPS, SB, R, H, 2B, BABIP*, ISO*, K%*, BB%*
 *   Pitching: ERA, K, W, WHIP, SV, K/9
 *   Premium teases: wOBA, xFIP, wRC+ (CORS-blocked sources)
 *   (* = computed client-side from MLB Stats API hitting stats endpoint)
 */

import {
  leadersPageShell, renderStatCard, renderLeaderRow,
  renderEmptyStatCard, renderPremiumStatCard, renderLeaderLoading,
  computeBABIP, computeISO, computeKPct, computeBBPct,
  fmtAvg, fmtPct, fmtDec, fmtInt,
} from './leaders-shared.js';

let _activeType = 'batting'; // batting | pitching | advanced

// ─── Visual Upgrade Styles ──────────────────────────────────────────────
function getEnhancedStyles() {
  return `
<style id="leaders-mlb-v4-styles">
/* === Leaders MLB v4 — Visual Upgrade ============================ */
:root {
  --lm-surface: rgba(255,255,255,0.03);
  --lm-surface-2: rgba(255,255,255,0.05);
  --lm-border: rgba(255,255,255,0.08);
  --lm-border-strong: rgba(255,255,255,0.16);
  --lm-text: #f5f5f7;
  --lm-text-dim: rgba(245,245,247,0.62);
  --lm-text-faint: rgba(245,245,247,0.4);
  --lm-gold: var(--gold, #d4af37);
  --lm-mlb: #ef4444;
  --lm-mlb-2: #b91c1c;
}

/* ── Sub-tabs (Batting / Pitching / Advanced) ──────────────────── */
.leaders-subtabs {
  display: flex; gap: 6px;
  margin: 24px 0 24px;
  flex-wrap: wrap; padding: 6px;
  background: rgba(255,255,255,0.03);
  border: 1px solid var(--lm-border);
  border-radius: 14px;
  backdrop-filter: blur(10px);
  width: fit-content; max-width: 100%;
}
.leaders-subtab {
  padding: 10px 20px;
  background: transparent;
  border: 1px solid transparent;
  color: var(--lm-text-dim);
  font-size: 14px; font-weight: 600;
  border-radius: 10px; cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}
.leaders-subtab:hover {
  color: var(--lm-text);
  background: rgba(255,255,255,0.05);
}
.leaders-subtab.active {
  background: linear-gradient(135deg, rgba(239,68,68,0.18), rgba(239,68,68,0.08));
  border-color: rgba(239,68,68,0.4);
  color: #fff;
  box-shadow:
    0 1px 0 rgba(255,255,255,0.1) inset,
    0 8px 24px rgba(239,68,68,0.18);
}

/* ── Banner ────────────────────────────────────────────────────── */
.leaders-banner {
  position: relative;
  padding: 14px 20px 14px 22px;
  margin: 0 0 24px;
  background: linear-gradient(90deg, rgba(239,68,68,0.10) 0%, rgba(255,255,255,0.02) 60%);
  border: 1px solid rgba(239,68,68,0.18);
  border-radius: 12px;
  font-size: 13px;
  color: var(--lm-text-dim);
  line-height: 1.5;
  overflow: hidden;
}
.leaders-banner::before {
  content: '';
  position: absolute;
  top: 0; bottom: 0; left: 0;
  width: 3px;
  background: linear-gradient(180deg, var(--lm-mlb), var(--lm-mlb-2));
}

/* ── Grid + cards ──────────────────────────────────────────────── */
.leaders-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 18px;
}
.leaders-grid > .leader-card,
.leaders-grid > * {
  animation: lm-enter 0.4s ease-out backwards;
}
.leaders-grid > *:nth-child(1)  { animation-delay: 0.02s; }
.leaders-grid > *:nth-child(2)  { animation-delay: 0.05s; }
.leaders-grid > *:nth-child(3)  { animation-delay: 0.08s; }
.leaders-grid > *:nth-child(4)  { animation-delay: 0.11s; }
.leaders-grid > *:nth-child(5)  { animation-delay: 0.14s; }
.leaders-grid > *:nth-child(6)  { animation-delay: 0.17s; }
.leaders-grid > *:nth-child(7)  { animation-delay: 0.20s; }
.leaders-grid > *:nth-child(8)  { animation-delay: 0.23s; }
.leaders-grid > *:nth-child(9)  { animation-delay: 0.26s; }
.leaders-grid > *:nth-child(10) { animation-delay: 0.29s; }
.leaders-grid > *:nth-child(11) { animation-delay: 0.32s; }
.leaders-grid > *:nth-child(12) { animation-delay: 0.35s; }
@keyframes lm-enter {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}

.leader-card {
  position: relative;
  padding: 0;
  background: linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%);
  border: 1px solid var(--lm-border);
  border-radius: 16px;
  overflow: hidden;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}
.leader-card:hover {
  transform: translateY(-2px);
  border-color: var(--lm-border-strong);
  box-shadow: 0 12px 32px rgba(0,0,0,0.35);
}

/* Card head — gradient accent bar on top */
.leader-card-head {
  position: relative;
  padding: 16px 20px 14px;
  border-bottom: 1px solid var(--lm-border) !important;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.leader-card-head::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: currentColor;
  opacity: 0.6;
}
.leader-card-stat {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.01em;
  text-shadow: 0 0 24px currentColor;
  filter: saturate(1.1);
}
.leader-card-meta {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--lm-text-faint);
  text-align: right;
  max-width: 60%;
}

/* ── Leader rows ───────────────────────────────────────────────── */
.leader-row,
a.leader-row {
  display: grid;
  grid-template-columns: 32px 40px 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 10px 20px;
  border-bottom: 1px solid var(--lm-border);
  text-decoration: none;
  color: inherit;
  transition: background 0.15s ease, transform 0.15s ease;
  position: relative;
}
.leader-row:last-child { border-bottom: none; }
a.leader-row:hover {
  background: rgba(255,255,255,0.04);
}
a.leader-row:hover .leader-photo,
a.leader-row:hover .leader-headshot {
  box-shadow: 0 0 0 2px rgba(239,68,68,0.5), 0 4px 12px rgba(239,68,68,0.25);
}
a.leader-row:hover .leader-name {
  color: #fff;
}

/* Rank — gradient number */
.leader-rank,
.leader-row .rank {
  font-size: 18px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  background: linear-gradient(180deg, rgba(255,255,255,0.85), rgba(255,255,255,0.35));
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent;
  text-align: center;
  line-height: 1;
}
.leader-row:nth-child(2) .leader-rank,
.leader-row:nth-child(2) .rank {
  background: linear-gradient(180deg, var(--lm-gold), #b8941f);
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent;
}
.leader-row:nth-child(3) .leader-rank,
.leader-row:nth-child(3) .rank {
  background: linear-gradient(180deg, #c0c0c0, #808080);
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent;
}
.leader-row:nth-child(4) .leader-rank,
.leader-row:nth-child(4) .rank {
  background: linear-gradient(180deg, #cd7f32, #8b5a2b);
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* Headshot */
.leader-photo,
.leader-headshot {
  width: 40px; height: 40px;
  border-radius: 50%;
  object-fit: cover;
  background: rgba(255,255,255,0.06);
  border: 1px solid var(--lm-border);
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}

/* Team logo */
.leader-team-logo {
  width: 16px; height: 16px;
  object-fit: contain;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.4));
}

/* Name + team */
.leader-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--lm-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.15s ease;
}
.leader-team {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--lm-text-faint);
}
.leader-meta {
  font-size: 11px;
  color: var(--lm-text-faint);
}

/* Stat value */
.leader-value,
.leader-row .value {
  font-size: 17px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  text-align: right;
  min-width: 56px;
  color: var(--lm-text);
}

/* ── Premium / locked stat cards ───────────────────────────────── */
.leader-card.premium,
.leader-card-premium {
  background: linear-gradient(180deg, rgba(212,175,55,0.06) 0%, rgba(0,0,0,0.25) 100%);
  border-color: rgba(212,175,55,0.25);
  position: relative;
  min-height: 280px;
}
.leader-card.premium::after,
.leader-card-premium::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(80% 100% at 50% 0%, rgba(212,175,55,0.10), transparent 60%);
  pointer-events: none;
}
.leader-card.premium:hover,
.leader-card-premium:hover {
  border-color: rgba(212,175,55,0.5);
  box-shadow: 0 12px 32px rgba(212,175,55,0.18);
}

/* ── Empty cards ────────────────────────────────────────────────── */
.leader-card.empty,
.leader-card-empty {
  opacity: 0.55;
  min-height: 180px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
}

/* ── Loading ───────────────────────────────────────────────────── */
.leader-loading,
.leaders-loading {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  padding: 80px 0;
}
.leader-loading-dot,
.leaders-loading-dot {
  width: 12px; height: 12px;
  border-radius: 50%;
  background: var(--lm-mlb);
  animation: lm-bounce 1.4s ease-in-out infinite;
}
.leader-loading-dot:nth-child(2),
.leaders-loading-dot:nth-child(2) { animation-delay: 0.2s; }
.leader-loading-dot:nth-child(3),
.leaders-loading-dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes lm-bounce {
  0%, 80%, 100% { transform: scale(0.5); opacity: 0.4; }
  40%           { transform: scale(1);   opacity: 1; }
}

/* ── Empty state ───────────────────────────────────────────────── */
.games-empty {
  padding: 60px 24px;
  text-align: center;
  background: var(--lm-surface);
  border: 1px solid var(--lm-border);
  border-radius: 16px;
}
.games-empty h3 {
  font-size: 20px; margin: 0 0 8px;
  color: var(--lm-text); font-weight: 700;
}
.games-empty p { color: var(--lm-text-dim); margin: 0; }

/* ── Mobile ────────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .leaders-grid { grid-template-columns: 1fr; gap: 14px; }
  .leaders-subtabs { width: 100%; overflow-x: auto; }
  .leaders-subtab { padding: 9px 16px; font-size: 13px; flex: 1; }
  .leader-card-head { padding: 14px 16px 12px; }
  .leader-card-stat { font-size: 19px; }
  .leader-row { padding: 9px 16px; gap: 10px; grid-template-columns: 28px 36px 1fr auto; }
  .leader-photo, .leader-headshot { width: 36px; height: 36px; }
  .leader-value, .leader-row .value { font-size: 15px; min-width: 48px; }
}
@media (prefers-reduced-motion: reduce) {
  .leaders-grid > *,
  .leader-loading-dot, .leaders-loading-dot {
    animation: none !important;
  }
}
</style>
  `;
}

// ─── Stat catalogs ──────────────────────────────────────────────────────

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

const ADVANCED_CATS = [
  { key: 'babip', label: 'BABIP', color: '#7FB3FF', dek: 'Batting average on balls in play', fmt: fmtAvg, compute: computeBABIP, sortDesc: true },
  { key: 'iso',   label: 'ISO',   color: '#FF6B6B', dek: 'Isolated power (SLG − AVG)',          fmt: fmtAvg, compute: computeISO,   sortDesc: true },
  { key: 'kpct',  label: 'K%',    color: '#FF8C42', dek: 'Strikeout rate (lower = better contact)', fmt: (v) => fmtPct(v, 1), compute: computeKPct, sortDesc: false },
  { key: 'bbpct', label: 'BB%',   color: '#5FD38D', dek: 'Walk rate (higher = better eye)',          fmt: (v) => fmtPct(v, 1), compute: computeBBPct, sortDesc: true },
];

const PREMIUM_CATS = [
  { label: 'wOBA',   color: '#5FD38D', statName: 'Weighted On-Base Average', dek: 'Single most predictive offensive stat. Sourced from FanGraphs.' },
  { label: 'xFIP',   color: '#FF6B6B', statName: 'Expected Fielding Indep. Pitching', dek: 'Strips luck from ERA. Sourced from FanGraphs.' },
  { label: 'wRC+',   color: 'var(--gold)', statName: 'Weighted Runs Created Plus', dek: 'Park-and-league-adjusted offense. 100 = league avg.' },
];

// ─── Mount ──────────────────────────────────────────────────────────────
export async function renderMlbLeadersPage(root) {
  const dek = 'Batting, pitching, and advanced sabermetrics — sourced from MLB Stats API. Tap any player for detail.';
  root.innerHTML = leadersPageShell('mlb', 'MLB', dek, `
    ${getEnhancedStyles()}
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
    <div class="leader-card" style="color:${cat.color}">
      <div class="leader-card-head">
        <span class="leader-card-stat" style="color:${cat.color}">${cat.label}</span>
        <span class="leader-card-meta">${cat.dek}</span>
      </div>
      ${rows.join('')}
    </div>
  `;
}

function currentMlbSeason() {
  const now = new Date();
  if (now.getMonth() < 2) return now.getFullYear() - 1;
  return now.getFullYear();
}
