/**
 * src/pages/leaders.js — /leaders
 * ESPN-style stat leaders across MLB · NHL · NBA · NFL.
 *
 * Adapted from the picks-app statleaders.js framework — extended to 4 sports,
 * direct public API calls (CORS-open), no auth required.
 *
 * MLB → statsapi.mlb.com/api/v1/stats/leaders   (CORS open)
 * NHL → api-web.nhle.com/v1/skater-stats-leaders + goalie-stats-leaders (CORS open)
 * NBA → site.api.espn.com athletes/leaders endpoints (CORS open)
 * NFL → placeholder for v2 (offseason)
 */

import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';

// ─── MLB stat categories ────────────────────────────────────────────────
const MLB_BATTING = [
  { key: 'battingAverage',     label: 'AVG',  color: '#7FB3FF', fmt: v => parseFloat(v).toFixed(3).replace(/^0/, '') },
  { key: 'homeRuns',           label: 'HR',   color: '#FF6B6B', fmt: v => v },
  { key: 'rbi',                label: 'RBI',  color: 'var(--gold)', fmt: v => v },
  { key: 'onBasePlusSlugging', label: 'OPS',  color: '#5FD38D', fmt: v => parseFloat(v).toFixed(3).replace(/^0/, '') },
  { key: 'stolenBases',        label: 'SB',   color: '#FF8C42', fmt: v => v },
  { key: 'runs',               label: 'R',    color: '#7FB3FF', fmt: v => v },
  { key: 'hits',               label: 'H',    color: 'var(--paper-dim)', fmt: v => v },
  { key: 'doubles',            label: '2B',   color: 'var(--paper-dim)', fmt: v => v },
];
const MLB_PITCHING = [
  { key: 'earnedRunAverage',  label: 'ERA',  color: '#5FD38D', fmt: v => parseFloat(v).toFixed(2) },
  { key: 'strikeouts',        label: 'K',    color: '#FF6B6B', fmt: v => v },
  { key: 'wins',              label: 'W',    color: 'var(--gold)', fmt: v => v },
  { key: 'whip',              label: 'WHIP', color: '#7FB3FF', fmt: v => parseFloat(v).toFixed(2) },
  { key: 'saves',             label: 'SV',   color: '#FF8C42', fmt: v => v },
  { key: 'strikeoutsPer9Inn', label: 'K/9',  color: '#FF6B6B', fmt: v => parseFloat(v).toFixed(1) },
];

// ─── NHL stat categories (api-web.nhle.com) ─────────────────────────────
const NHL_SKATER = [
  { key: 'goals',     label: 'Goals',   color: '#FF6B6B' },
  { key: 'assists',   label: 'Assists', color: '#7FB3FF' },
  { key: 'points',    label: 'Points',  color: 'var(--gold)' },
  { key: 'plusMinus', label: '+/-',     color: '#5FD38D' },
];
const NHL_GOALIE = [
  { key: 'wins',                  label: 'Wins',     color: 'var(--gold)' },
  { key: 'savePctg',              label: 'SV%',      color: '#5FD38D', fmt: v => parseFloat(v).toFixed(3).replace(/^0/, '') },
  { key: 'goalsAgainstAverage',   label: 'GAA',      color: '#7FB3FF', fmt: v => parseFloat(v).toFixed(2) },
  { key: 'shutouts',              label: 'Shutouts', color: '#FF8C42' },
];

// ─── NBA stat categories (ESPN) ─────────────────────────────────────────
const NBA_CATS = [
  { key: 'pointsPerGame',          label: 'PPG',  color: '#FF6B6B' },
  { key: 'reboundsPerGame',        label: 'RPG',  color: '#7FB3FF' },
  { key: 'assistsPerGame',         label: 'APG',  color: 'var(--gold)' },
  { key: 'stealsPerGame',          label: 'SPG',  color: '#5FD38D' },
  { key: 'blocksPerGame',          label: 'BPG',  color: '#FF8C42' },
  { key: 'threePointFieldGoalPct', label: '3P%',  color: '#7FB3FF' },
];

// ─── State ───────────────────────────────────────────────────────────────
let _activeSport = 'mlb';
let _activeMlbType = 'batting';   // batting | pitching
let _activeNhlType = 'skater';     // skater | goalie

export async function renderLeadersPage(root) {
  root.innerHTML = `
    ${renderHeader()}
    <main>
      <div class="container">

        <!-- Hero -->
        <section class="leaders-hero">
          <div class="leaders-hero-mesh"></div>
          <div class="leaders-hero-inner">
            <div class="leaders-hero-kicker">
              <span class="live-dot-big"></span>
              <span>STAT LEADERS · UPDATED LIVE</span>
            </div>
            <h1 class="leaders-hero-title">League Leaders</h1>
            <p class="leaders-hero-dek">
              Top performers across MLB, NHL, NBA, and NFL — sourced from official league APIs.
              Tap any player for detail.
            </p>
          </div>
        </section>

        <!-- Sport tabs -->
        <div class="leaders-sport-tabs">
          <button class="leaders-sport-tab active" data-sport="mlb">⚾ MLB</button>
          <button class="leaders-sport-tab" data-sport="nhl">🏒 NHL</button>
          <button class="leaders-sport-tab" data-sport="nba">🏀 NBA</button>
          <button class="leaders-sport-tab" data-sport="nfl">🏈 NFL</button>
        </div>

        <!-- Sub-tabs (sport-specific, e.g. Batting/Pitching for MLB) -->
        <div id="leaders-subtabs" class="leaders-subtabs"></div>

        <!-- Body -->
        <div id="leaders-body">
          <div class="games-loading"><div class="games-loading-dot"></div><div class="games-loading-dot"></div><div class="games-loading-dot"></div></div>
        </div>

        <!-- Edge plug -->
        <section class="games-edge-strip">
          <div class="games-edge-grid">
            <div class="games-edge-cell">
              <div class="games-edge-icon">🎯</div>
              <div class="games-edge-title">PropBetEdge Picks</div>
              <div class="games-edge-dek">Daily AI-scored prop picks built on live stats like these.</div>
              <a href="https://mlb.propbetedge.ai" class="games-edge-cta">See picks →</a>
            </div>
            <div class="games-edge-cell">
              <div class="games-edge-icon">📡</div>
              <div class="games-edge-title">PropSports API</div>
              <div class="games-edge-dek">47 endpoints across 4 sports — same data sources, your build, your auth.</div>
              <a href="https://propsports.proptechusa.ai" class="games-edge-cta">API docs →</a>
            </div>
            <div class="games-edge-cell">
              <div class="games-edge-icon">🔒</div>
              <div class="games-edge-title">Free MLB for life</div>
              <div class="games-edge-dek">Subscribe before May 15 to lock in MLB picks free forever. After: $29/mo.</div>
              <a href="https://mlb.propbetedge.ai" class="games-edge-cta">Subscribe →</a>
            </div>
          </div>
        </section>
      </div>
    </main>
    ${renderFooter()}
  `;

  // Wire sport tabs
  document.querySelectorAll('.leaders-sport-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.leaders-sport-tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      _activeSport = btn.dataset.sport;
      renderForSport();
    });
  });

  renderForSport();
}

function renderForSport() {
  const subtabs = document.getElementById('leaders-subtabs');
  const body = document.getElementById('leaders-body');
  if (!subtabs || !body) return;

  // Render sub-tabs per sport
  if (_activeSport === 'mlb') {
    subtabs.innerHTML = `
      <button class="leaders-subtab ${_activeMlbType === 'batting' ? 'active' : ''}" data-type="batting">Batting</button>
      <button class="leaders-subtab ${_activeMlbType === 'pitching' ? 'active' : ''}" data-type="pitching">Pitching</button>
    `;
    subtabs.querySelectorAll('.leaders-subtab').forEach((b) => {
      b.addEventListener('click', () => {
        _activeMlbType = b.dataset.type;
        renderForSport();
      });
    });
    loadMlb();
  } else if (_activeSport === 'nhl') {
    subtabs.innerHTML = `
      <button class="leaders-subtab ${_activeNhlType === 'skater' ? 'active' : ''}" data-type="skater">Skaters</button>
      <button class="leaders-subtab ${_activeNhlType === 'goalie' ? 'active' : ''}" data-type="goalie">Goalies</button>
    `;
    subtabs.querySelectorAll('.leaders-subtab').forEach((b) => {
      b.addEventListener('click', () => {
        _activeNhlType = b.dataset.type;
        renderForSport();
      });
    });
    loadNhl();
  } else if (_activeSport === 'nba') {
    subtabs.innerHTML = '';
    loadNba();
  } else {
    subtabs.innerHTML = '';
    body.innerHTML = `
      <div class="games-empty">
        <h3>🏈 NFL stat leaders coming this fall</h3>
        <p>NFL season starts in September. Check back when training camp opens, or follow the picks site for offseason news.</p>
        <p style="margin-top:14px"><a href="/news/nfl">NFL news →</a></p>
      </div>
    `;
  }
}

// ─── MLB ────────────────────────────────────────────────────────────────
async function loadMlb() {
  const body = document.getElementById('leaders-body');
  if (!body) return;
  body.innerHTML = `<div class="games-loading"><div class="games-loading-dot"></div><div class="games-loading-dot"></div><div class="games-loading-dot"></div></div>`;

  const cats = _activeMlbType === 'batting' ? MLB_BATTING : MLB_PITCHING;
  const group = _activeMlbType === 'batting' ? 'hitting' : 'pitching';
  const season = new Date().getFullYear();

  try {
    const results = await Promise.all(cats.map((cat) =>
      fetch(`https://statsapi.mlb.com/api/v1/stats/leaders?leaderCategories=${cat.key}&statGroup=${group}&season=${season}&limit=10`)
        .then((r) => r.ok ? r.json() : null)
        .catch(() => null)
    ));

    // Try previous season if current is empty
    let useSeason = season;
    if (!results.some((r) => r?.leagueLeaders?.[0]?.leaders?.length)) {
      const fallback = await Promise.all(cats.map((cat) =>
        fetch(`https://statsapi.mlb.com/api/v1/stats/leaders?leaderCategories=${cat.key}&statGroup=${group}&season=${season - 1}&limit=10`)
          .then((r) => r.ok ? r.json() : null)
          .catch(() => null)
      ));
      if (fallback.some((r) => r?.leagueLeaders?.[0]?.leaders?.length)) {
        results.splice(0, results.length, ...fallback);
        useSeason = season - 1;
      }
    }

    const fallbackBanner = useSeason !== season ? `
      <div class="leaders-banner">
        ⚡ Showing ${useSeason} season — ${season} stats populate as games are played.
      </div>
    ` : '';

    body.innerHTML = `
      ${fallbackBanner}
      <div class="leaders-grid">
        ${cats.map((cat, i) => renderMlbCard(cat, results[i])).join('')}
      </div>
    `;
  } catch (e) {
    body.innerHTML = `<div class="games-empty"><h3>Couldn't load leaders</h3><p>${e.message}</p></div>`;
  }
}

function renderMlbCard(cat, data) {
  const leaders = (data?.leagueLeaders?.[0]?.leaders || []).slice(0, 10);
  if (!leaders.length) {
    return `
      <div class="leader-card">
        <div class="leader-card-head" style="border-color:${cat.color}33">
          <span class="leader-card-stat" style="color:${cat.color}">${cat.label}</span>
        </div>
        <div class="leader-empty">No data yet</div>
      </div>
    `;
  }
  return `
    <div class="leader-card">
      <div class="leader-card-head" style="border-color:${cat.color}33">
        <span class="leader-card-stat" style="color:${cat.color}">${cat.label}</span>
        <span class="leader-card-meta">Top ${leaders.length}</span>
      </div>
      ${leaders.map((l, rank) => {
        const val = cat.fmt ? cat.fmt(l.value) : l.value;
        const id = l.person?.id;
        const name = l.person?.fullName || '—';
        const team = l.team?.abbreviation || '';
        const photo = id ? `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_120,q_auto:best/v1/people/${id}/headshot/67/current` : null;
        const isTop = rank === 0;
        const href = id ? `/player/mlb/${id}` : null;
        const tag = href ? 'a' : 'div';
        return `
          <${tag} ${href ? `href="${href}"` : ''} class="leader-row ${isTop ? 'is-top' : ''}">
            <span class="leader-rank" style="color:${rank < 3 ? cat.color : 'var(--paper-faint)'}">${rank + 1}</span>
            ${photo ? `<img src="${photo}" alt="${escapeAttr(name)}" class="leader-photo" loading="lazy" onerror="this.style.display='none'" />` : '<div class="leader-photo-fallback"></div>'}
            <div class="leader-info">
              <div class="leader-name">${escapeHtml(name)}</div>
              <div class="leader-team">${escapeHtml(team)}</div>
            </div>
            <span class="leader-value" style="color:${isTop ? cat.color : 'var(--paper)'}; font-size:${isTop ? '20px' : '15px'}">${val}</span>
          </${tag}>
        `;
      }).join('')}
    </div>
  `;
}

// ─── NHL ────────────────────────────────────────────────────────────────
async function loadNhl() {
  const body = document.getElementById('leaders-body');
  if (!body) return;
  body.innerHTML = `<div class="games-loading"><div class="games-loading-dot"></div><div class="games-loading-dot"></div><div class="games-loading-dot"></div></div>`;

  const season = nhlSeasonString();
  const isSkater = _activeNhlType === 'skater';
  const cats = isSkater ? NHL_SKATER : NHL_GOALIE;
  const endpoint = isSkater ? 'skater-stats-leaders' : 'goalie-stats-leaders';
  // gameType=2 regular season; if playoffs running, prefer 3
  const gameType = 2;

  try {
    const cats_param = cats.map((c) => c.key).join(',');
    const url = `https://api-web.nhle.com/v1/${endpoint}/${season}/${gameType}?categories=${cats_param}&limit=10`;
    const data = await fetch(url).then((r) => r.ok ? r.json() : null);

    if (!data) {
      body.innerHTML = `<div class="games-empty"><h3>NHL leaders unavailable</h3><p>Try refreshing in a moment.</p></div>`;
      return;
    }

    body.innerHTML = `
      <div class="leaders-grid">
        ${cats.map((cat) => renderNhlCard(cat, data[cat.key] || [])).join('')}
      </div>
    `;
  } catch (e) {
    body.innerHTML = `<div class="games-empty"><h3>Couldn't load NHL leaders</h3><p>${e.message}</p></div>`;
  }
}

function renderNhlCard(cat, leaders) {
  const top = leaders.slice(0, 10);
  if (!top.length) {
    return `
      <div class="leader-card">
        <div class="leader-card-head" style="border-color:${cat.color}33">
          <span class="leader-card-stat" style="color:${cat.color}">${cat.label}</span>
        </div>
        <div class="leader-empty">No data yet</div>
      </div>
    `;
  }
  return `
    <div class="leader-card">
      <div class="leader-card-head" style="border-color:${cat.color}33">
        <span class="leader-card-stat" style="color:${cat.color}">${cat.label}</span>
        <span class="leader-card-meta">Top ${top.length}</span>
      </div>
      ${top.map((l, rank) => {
        const val = cat.fmt ? cat.fmt(l.value) : l.value;
        const id = l.id;
        const first = l.firstName?.default || '';
        const last = l.lastName?.default || '';
        const name = `${first} ${last}`.trim() || '—';
        const team = l.teamAbbrev || '';
        const photo = l.headshot || (id ? `https://assets.nhle.com/mugs/nhl/20242025/${team}/${id}.png` : null);
        const isTop = rank === 0;
        const href = id ? `/player/nhl/${id}` : null;
        const tag = href ? 'a' : 'div';
        return `
          <${tag} ${href ? `href="${href}"` : ''} class="leader-row ${isTop ? 'is-top' : ''}">
            <span class="leader-rank" style="color:${rank < 3 ? cat.color : 'var(--paper-faint)'}">${rank + 1}</span>
            ${photo ? `<img src="${photo}" alt="${escapeAttr(name)}" class="leader-photo" loading="lazy" onerror="this.style.display='none'" />` : '<div class="leader-photo-fallback"></div>'}
            <div class="leader-info">
              <div class="leader-name">${escapeHtml(name)}</div>
              <div class="leader-team">${escapeHtml(team)}</div>
            </div>
            <span class="leader-value" style="color:${isTop ? cat.color : 'var(--paper)'}; font-size:${isTop ? '20px' : '15px'}">${val}</span>
          </${tag}>
        `;
      }).join('')}
    </div>
  `;
}

function nhlSeasonString() {
  // NHL season: Oct YYYY - Jun YYYY+1, formatted as YYYYYYYY+1
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-indexed
  if (m >= 8) return `${y}${y + 1}`;       // Sep onward = current season
  if (m >= 6) return `${y - 1}${y}`;       // Jul-Aug = previous season just ended
  return `${y - 1}${y}`;                   // Jan-Jun = current season (started prev fall)
}

// ─── NBA ────────────────────────────────────────────────────────────────
async function loadNba() {
  const body = document.getElementById('leaders-body');
  if (!body) return;
  body.innerHTML = `<div class="games-loading"><div class="games-loading-dot"></div><div class="games-loading-dot"></div><div class="games-loading-dot"></div></div>`;

  // ESPN's leaders endpoint
  const season = new Date().getFullYear();
  const url = `https://site.api.espn.com/apis/v2/sports/basketball/nba/leaders?season=${season}&seasontype=2`;

  try {
    const data = await fetch(url).then((r) => r.ok ? r.json() : null);
    const categories = data?.categories || [];

    if (!categories.length) {
      body.innerHTML = `
        <div class="games-empty">
          <h3>NBA leaders loading</h3>
          <p>If this persists, the season may be between regular and playoffs. Try checking <a href="/games">live games</a> for current scoreboard.</p>
        </div>
      `;
      return;
    }

    // Map ESPN category names to display
    const wantedCats = {
      'avgPoints':       { label: 'PPG', color: '#FF6B6B' },
      'avgRebounds':     { label: 'RPG', color: '#7FB3FF' },
      'avgAssists':      { label: 'APG', color: 'var(--gold)' },
      'avgSteals':       { label: 'SPG', color: '#5FD38D' },
      'avgBlocks':       { label: 'BPG', color: '#FF8C42' },
      'threePointFieldGoalPct': { label: '3P%', color: '#7FB3FF' },
    };

    const cards = categories
      .filter((c) => wantedCats[c.name])
      .map((c) => {
        const meta = wantedCats[c.name];
        const leaders = (c.leaders || []).slice(0, 10);
        return renderNbaCard(meta, c.displayName || meta.label, leaders);
      });

    if (!cards.length) {
      body.innerHTML = `<div class="games-empty"><h3>NBA leaders not available right now</h3><p>The ESPN endpoint returned no matching categories.</p></div>`;
      return;
    }

    body.innerHTML = `
      <div class="leaders-grid">
        ${cards.join('')}
      </div>
    `;
  } catch (e) {
    body.innerHTML = `<div class="games-empty"><h3>Couldn't load NBA leaders</h3><p>${e.message}</p></div>`;
  }
}

function renderNbaCard(cat, displayName, leaders) {
  if (!leaders.length) {
    return `
      <div class="leader-card">
        <div class="leader-card-head" style="border-color:${cat.color}33">
          <span class="leader-card-stat" style="color:${cat.color}">${cat.label}</span>
        </div>
        <div class="leader-empty">No data</div>
      </div>
    `;
  }
  return `
    <div class="leader-card">
      <div class="leader-card-head" style="border-color:${cat.color}33">
        <span class="leader-card-stat" style="color:${cat.color}">${cat.label}</span>
        <span class="leader-card-meta">Top ${leaders.length}</span>
      </div>
      ${leaders.map((l, rank) => {
        const val = formatNbaValue(l.value, cat.label);
        const ath = l.athlete || {};
        const name = ath.displayName || '—';
        const team = ath.team?.abbreviation || '';
        const photo = ath.headshot?.href || ath.headshot;
        const id = ath.id;
        const isTop = rank === 0;
        const href = id ? `/player/nba/${id}` : null;
        const tag = href ? 'a' : 'div';
        return `
          <${tag} ${href ? `href="${href}"` : ''} class="leader-row ${isTop ? 'is-top' : ''}">
            <span class="leader-rank" style="color:${rank < 3 ? cat.color : 'var(--paper-faint)'}">${rank + 1}</span>
            ${photo ? `<img src="${photo}" alt="${escapeAttr(name)}" class="leader-photo" loading="lazy" onerror="this.style.display='none'" />` : '<div class="leader-photo-fallback"></div>'}
            <div class="leader-info">
              <div class="leader-name">${escapeHtml(name)}</div>
              <div class="leader-team">${escapeHtml(team)}</div>
            </div>
            <span class="leader-value" style="color:${isTop ? cat.color : 'var(--paper)'}; font-size:${isTop ? '20px' : '15px'}">${val}</span>
          </${tag}>
        `;
      }).join('')}
    </div>
  `;
}

function formatNbaValue(v, label) {
  if (v == null) return '—';
  if (label === '3P%') return (parseFloat(v) * 100).toFixed(1) + '%';
  return parseFloat(v).toFixed(1);
}

// ─── Helpers ─────────────────────────────────────────────────────────────
function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escapeAttr(s) { return escapeHtml(s); }
