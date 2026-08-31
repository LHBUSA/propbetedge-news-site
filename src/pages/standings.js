import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { getSportConfig, slugifyEntity } from '../sport-config.js';

async function fetchJson(url) {
  const response = await fetch(url, { credentials: 'omit' });
  if (!response.ok) throw new Error(`Standings source returned ${response.status}`);
  return response.json();
}

function valueFor(entry, names) {
  const stats = entry?.stats || [];
  for (const name of names) {
    const hit = stats.find((stat) => stat?.name === name || stat?.abbreviation === name);
    if (hit) return hit.displayValue ?? hit.value ?? '—';
  }
  return '—';
}

const STANDING_COLUMNS = Object.freeze({
  nfl: [
    { label: 'W', names: ['wins', 'W'] },
    { label: 'L', names: ['losses', 'L'] },
    { label: 'T', names: ['ties', 'T'] },
    { label: 'PCT', names: ['winPercent', 'winPercentage', 'PCT'] },
    { label: 'SEED', names: ['playoffSeed', 'seed'] },
  ],
  mlb: [
    { label: 'W', names: ['wins', 'W'] },
    { label: 'L', names: ['losses', 'L'] },
    { label: 'PCT', names: ['winPercent', 'winPercentage', 'PCT'] },
    { label: 'GB', names: ['gamesBehind', 'GB'] },
    { label: 'DIFF', names: ['differential', 'runDifferential', 'DIFF'] },
  ],
  nba: [
    { label: 'W', names: ['wins', 'W'] },
    { label: 'L', names: ['losses', 'L'] },
    { label: 'PCT', names: ['winPercent', 'winPercentage', 'PCT'] },
    { label: 'GB', names: ['gamesBehind', 'GB'] },
    { label: 'SEED', names: ['playoffSeed', 'seed'] },
  ],
  nhl: [
    { label: 'W', names: ['wins', 'W'] },
    { label: 'L', names: ['losses', 'L'] },
    { label: 'OTL', names: ['overtimeLosses', 'OTL'] },
    { label: 'PTS', names: ['points', 'PTS'] },
    { label: 'PCT', names: ['pointPct', 'pointPercentage', 'winPercent', 'PCT'] },
  ],
});

function columnsFor(sport) {
  return STANDING_COLUMNS[sport] || STANDING_COLUMNS.nfl;
}

function normalizeGroups(data) {
  const groups = [];
  const visit = (node, ancestry = []) => {
    if (!node) return;
    const name = node.name || node.abbreviation || '';
    const next = name ? [...ancestry, name] : ancestry;
    if (Array.isArray(node.standings?.entries) && node.standings.entries.length) {
      groups.push({
        name: next[next.length - 1] || 'Standings',
        parent: next.length > 1 ? next[next.length - 2] : '',
        entries: node.standings.entries,
      });
    }
    for (const child of node.children || []) visit(child, next);
  };

  if (Array.isArray(data?.children)) {
    for (const child of data.children) visit(child);
  } else {
    visit(data);
  }

  return groups;
}

function rowGrid(columns) {
  return `grid-template-columns:minmax(200px,1.8fr) repeat(${columns.length},minmax(48px,.45fr))`;
}

function renderRow(entry, sport, columns) {
  const team = entry?.team || {};
  const name = team.displayName || team.name || team.abbreviation || 'Team';
  const logo = team.logos?.[0]?.href || team.logo || '';
  const slug = slugifyEntity(name);
  return `
    <a class="pbe-standings-row" style="${rowGrid(columns)}" href="/team/${sport}/${slug}">
      <span class="pbe-standings-team">
        ${logo ? `<img src="${escapeAttr(logo)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'" />` : ''}
        <span>
          <strong>${escapeHtml(name)}</strong>
          <small>${escapeHtml(team.abbreviation || '')}</small>
        </span>
      </span>
      ${columns.map((column) => `<span>${escapeHtml(valueFor(entry, column.names))}</span>`).join('')}
    </a>
  `;
}

function renderGroup(group, sport) {
  const columns = columnsFor(sport);
  return `
    <section class="pbe-standings-card">
      <div class="pbe-standings-card-head">
        <div>
          ${group.parent ? `<span>${escapeHtml(group.parent)}</span>` : ''}
          <h2>${escapeHtml(group.name)}</h2>
        </div>
        <span>LIVE TABLE</span>
      </div>
      <div class="pbe-standings-table" role="table" aria-label="${escapeAttr(group.name)} standings">
        <div class="pbe-standings-row pbe-standings-labels" style="${rowGrid(columns)}" role="row">
          <span>Team</span>${columns.map((column) => `<span>${escapeHtml(column.label)}</span>`).join('')}
        </div>
        ${group.entries.map((entry) => renderRow(entry, sport, columns)).join('')}
      </div>
    </section>
  `;
}

export async function renderStandingsPage(root, sport, setMeta) {
  const config = getSportConfig(sport);
  if (!config) return;

  setMeta?.({
    title: `${config.label} Standings — PropBetEdge`,
    description: `Live ${config.label} standings with direct links into team intelligence, news and game context.`,
    canonical: `https://propbetedge.ai/standings/${sport}`,
  });

  root.innerHTML = `
    ${renderHeader()}
    <main class="pbe-intelligence-page">
      <div class="container">
        <section class="pbe-intel-hero">
          <div class="pbe-intel-kicker">${config.emoji} ${config.label} INTELLIGENCE</div>
          <h1>${config.label} standings, connected to the story.</h1>
          <p>Records are only the starting point. Every team row leads into the PBE entity layer where schedule, roster, news and market context can live together.</p>
          <div class="pbe-intel-actions">
            <a href="/news/${sport}" class="btn btn-primary">Latest ${config.label} News →</a>
            <a href="/games" class="btn btn-ghost">Live Games</a>
          </div>
        </section>
        <div id="pbe-standings-root" class="pbe-intel-loading">Loading live ${config.label} standings…</div>
      </div>
    </main>
    ${renderFooter()}
  `;

  const mount = document.getElementById('pbe-standings-root');
  try {
    const data = await fetchJson(`https://site.api.espn.com/apis/v2/sports/${config.espnPath}/standings`);
    const groups = normalizeGroups(data);
    mount.innerHTML = groups.length
      ? `<div class="pbe-standings-grid">${groups.map((group) => renderGroup(group, sport)).join('')}</div>`
      : '<div class="pbe-intel-empty"><strong>No current standings returned.</strong><span>The page will populate automatically when the league source has a live table.</span></div>';
  } catch (error) {
    mount.innerHTML = `<div class="pbe-intel-empty"><strong>Standings are temporarily unavailable.</strong><span>${escapeHtml(error.message)}</span></div>`;
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function escapeAttr(value) {
  return escapeHtml(value);
}
