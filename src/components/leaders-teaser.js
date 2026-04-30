/**
 * src/components/leaders-teaser.js
 *
 * Compact stat leaders teaser shown on the /games hub between the scoreboard
 * and the edge strip. Sport-aware — shows the active sport's top stats.
 *
 * Public APIs (CORS open):
 *   MLB → statsapi.mlb.com
 *   NHL → api-web.nhle.com
 *   NBA → site.api.espn.com
 */

const TEASER_CONFIG = {
  mlb: [
    { stat: 'homeRuns',           group: 'hitting',  label: 'HR',  color: '#FF6B6B' },
    { stat: 'battingAverage',     group: 'hitting',  label: 'AVG', color: '#7FB3FF', fmt: v => parseFloat(v).toFixed(3).replace(/^0/, '') },
    { stat: 'strikeouts',         group: 'pitching', label: 'K',   color: '#FF6B6B' },
    { stat: 'earnedRunAverage',   group: 'pitching', label: 'ERA', color: '#5FD38D', fmt: v => parseFloat(v).toFixed(2) },
  ],
  nhl: [
    { stat: 'goals',   label: 'Goals',   color: '#FF6B6B' },
    { stat: 'assists', label: 'Assists', color: '#7FB3FF' },
    { stat: 'points',  label: 'Points',  color: 'var(--gold)' },
  ],
  nba: [
    { stat: 'avgPoints',   label: 'PPG', color: '#FF6B6B', fmt: v => parseFloat(v).toFixed(1) },
    { stat: 'avgRebounds', label: 'RPG', color: '#7FB3FF', fmt: v => parseFloat(v).toFixed(1) },
    { stat: 'avgAssists',  label: 'APG', color: 'var(--gold)', fmt: v => parseFloat(v).toFixed(1) },
  ],
};

export function renderLeadersTeaserSlot() {
  return `
    <section id="games-leaders-teaser" class="games-leaders-teaser" style="display:none">
      <div class="games-leaders-teaser-head">
        <div>
          <h2 class="games-leaders-teaser-title">Stat Leaders</h2>
          <div class="games-leaders-teaser-subtitle" id="games-leaders-teaser-sub">Top performers · live from league API</div>
        </div>
        <a href="/leaders" class="games-leaders-teaser-link">Full leaderboard →</a>
      </div>
      <div id="games-leaders-teaser-grid" class="games-leaders-teaser-grid"></div>
    </section>
  `;
}

export async function loadLeadersTeaser(sport) {
  const root = document.getElementById('games-leaders-teaser');
  const grid = document.getElementById('games-leaders-teaser-grid');
  const sub = document.getElementById('games-leaders-teaser-sub');
  if (!root || !grid) return;

  if (sport === 'nfl' || !TEASER_CONFIG[sport]) {
    root.style.display = 'none';
    return;
  }

  root.style.display = 'block';
  if (sub) sub.textContent = `${sport.toUpperCase()} top performers · live from league API`;
  grid.innerHTML = '<div class="games-loading"><div class="games-loading-dot"></div><div class="games-loading-dot"></div><div class="games-loading-dot"></div></div>';

  try {
    const cards = await loadForSport(sport);
    if (!cards || !cards.length) {
      grid.innerHTML = '<div class="leader-empty">Leaders updating — check back shortly</div>';
      return;
    }
    grid.innerHTML = cards.join('');
  } catch (e) {
    console.warn('[leaders-teaser]', e);
    grid.innerHTML = '<div class="leader-empty">Couldn\'t load leaders</div>';
  }
}

async function loadForSport(sport) {
  if (sport === 'mlb') return loadMlbTeaser();
  if (sport === 'nhl') return loadNhlTeaser();
  if (sport === 'nba') return loadNbaTeaser();
  return [];
}

// ─── MLB ─────────────────────────────────────────────────────────────────
async function loadMlbTeaser() {
  const cats = TEASER_CONFIG.mlb;
  const season = new Date().getFullYear();
  const tryYear = async (year) => {
    const results = await Promise.all(cats.map((cat) =>
      fetch(`https://statsapi.mlb.com/api/v1/stats/leaders?leaderCategories=${cat.stat}&statGroup=${cat.group}&season=${year}&limit=3`)
        .then((r) => r.ok ? r.json() : null)
        .catch(() => null)
    ));
    return results;
  };

  let results = await tryYear(season);
  let useYear = season;
  if (!results.some((r) => r?.leagueLeaders?.[0]?.leaders?.length)) {
    results = await tryYear(season - 1);
    useYear = season - 1;
  }

  return cats.map((cat, i) => {
    const leaders = (results[i]?.leagueLeaders?.[0]?.leaders || []).slice(0, 3);
    if (!leaders.length) {
      return `
        <div class="teaser-card">
          <div class="teaser-card-stat" style="color:${cat.color}">${cat.label}</div>
          <div class="leader-empty" style="padding:8px 0;font-size:11px">No data</div>
        </div>
      `;
    }
    return `
      <div class="teaser-card">
        <div class="teaser-card-stat" style="color:${cat.color}">${cat.label}${useYear !== season ? ` · ${useYear}` : ''}</div>
        ${leaders.map((l, rank) => {
          const id = l.person?.id;
          const name = l.person?.fullName || '—';
          const photo = id ? `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_60,q_auto:best/v1/people/${id}/headshot/67/current` : null;
          const val = cat.fmt ? cat.fmt(l.value) : l.value;
          return `
            <a href="${id ? `/player/mlb/${id}` : '#'}" class="teaser-row">
              <span class="teaser-rank">${rank + 1}</span>
              ${photo ? `<img src="${photo}" alt="" class="teaser-photo" loading="lazy" onerror="this.style.display='none'" />` : ''}
              <span class="teaser-name">${escapeHtml(name)}</span>
              <span class="teaser-value" style="color:${cat.color}">${val}</span>
            </a>
          `;
        }).join('')}
      </div>
    `;
  });
}

// ─── NHL ─────────────────────────────────────────────────────────────────
async function loadNhlTeaser() {
  const cats = TEASER_CONFIG.nhl;
  const season = nhlSeasonString();
  const url = `https://api-web.nhle.com/v1/skater-stats-leaders/${season}/2?categories=${cats.map((c) => c.stat).join(',')}&limit=3`;
  const data = await fetch(url).then((r) => r.ok ? r.json() : null);
  if (!data) return null;

  return cats.map((cat) => {
    const leaders = (data[cat.stat] || []).slice(0, 3);
    if (!leaders.length) {
      return `
        <div class="teaser-card">
          <div class="teaser-card-stat" style="color:${cat.color}">${cat.label}</div>
          <div class="leader-empty" style="padding:8px 0;font-size:11px">No data</div>
        </div>
      `;
    }
    return `
      <div class="teaser-card">
        <div class="teaser-card-stat" style="color:${cat.color}">${cat.label}</div>
        ${leaders.map((l, rank) => {
          const id = l.id;
          const first = l.firstName?.default || '';
          const last = l.lastName?.default || '';
          const name = `${first} ${last}`.trim() || '—';
          const photo = l.headshot;
          const val = cat.fmt ? cat.fmt(l.value) : l.value;
          return `
            <a href="${id ? `/player/nhl/${id}` : '#'}" class="teaser-row">
              <span class="teaser-rank">${rank + 1}</span>
              ${photo ? `<img src="${photo}" alt="" class="teaser-photo" loading="lazy" onerror="this.style.display='none'" />` : ''}
              <span class="teaser-name">${escapeHtml(name)}</span>
              <span class="teaser-value" style="color:${cat.color}">${val}</span>
            </a>
          `;
        }).join('')}
      </div>
    `;
  });
}

function nhlSeasonString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (m >= 8) return `${y}${y + 1}`;
  return `${y - 1}${y}`;
}

// ─── NBA ─────────────────────────────────────────────────────────────────
async function loadNbaTeaser() {
  const season = new Date().getFullYear();
  const url = `https://site.api.espn.com/apis/v2/sports/basketball/nba/leaders?season=${season}&seasontype=2`;
  const data = await fetch(url).then((r) => r.ok ? r.json() : null);
  const categories = data?.categories || [];
  if (!categories.length) return null;

  return TEASER_CONFIG.nba.map((cat) => {
    const cat_data = categories.find((c) => c.name === cat.stat);
    const leaders = (cat_data?.leaders || []).slice(0, 3);
    if (!leaders.length) {
      return `
        <div class="teaser-card">
          <div class="teaser-card-stat" style="color:${cat.color}">${cat.label}</div>
          <div class="leader-empty" style="padding:8px 0;font-size:11px">No data</div>
        </div>
      `;
    }
    return `
      <div class="teaser-card">
        <div class="teaser-card-stat" style="color:${cat.color}">${cat.label}</div>
        ${leaders.map((l, rank) => {
          const ath = l.athlete || {};
          const id = ath.id;
          const name = ath.displayName || '—';
          const photo = ath.headshot?.href || ath.headshot;
          const val = cat.fmt ? cat.fmt(l.value) : parseFloat(l.value || 0).toFixed(1);
          return `
            <a href="${id ? `/player/nba/${id}` : '#'}" class="teaser-row">
              <span class="teaser-rank">${rank + 1}</span>
              ${photo ? `<img src="${photo}" alt="" class="teaser-photo" loading="lazy" onerror="this.style.display='none'" />` : ''}
              <span class="teaser-name">${escapeHtml(name)}</span>
              <span class="teaser-value" style="color:${cat.color}">${val}</span>
            </a>
          `;
        }).join('')}
      </div>
    `;
  });
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
