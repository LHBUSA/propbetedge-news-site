import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { renderArticleCard } from '../components/article-card.js';
import { api } from '../api.js';
import { getSportConfig } from '../sport-config.js';
import { teamQueryAbbreviations } from '../entity-graph/entities.js';

const FOLLOW_KEY = 'pbe_followed_teams_v1';

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store', credentials: 'omit' });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) throw new Error(payload?.error || `Team API ${response.status}`);
  return payload;
}

async function loadTeamSnapshot(sport, slug) {
  return fetchJson(`/api/team-intelligence?sport=${encodeURIComponent(sport)}&slug=${encodeURIComponent(slug)}&contract=team-profile-v2`);
}

async function loadTeamNews(sport, team) {
  const keys = teamQueryAbbreviations(sport, team?.abbreviation);
  if (!keys.length) return [];
  try {
    const data = await api.byTeamEntity(keys, sport);
    return (data?.articles || []).filter((article) => article?.slug).slice(0, 6);
  } catch {
    return [];
  }
}

function getFollowed() {
  try {
    const value = JSON.parse(localStorage.getItem(FOLLOW_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function setFollowed(items) {
  try { localStorage.setItem(FOLLOW_KEY, JSON.stringify(items)); } catch {}
}

function teamFollowId(sport, team) {
  return `${sport}:${team.team_id || team.slug}`;
}

function mountFollowButton(sport, team) {
  const button = document.querySelector('[data-pbe-team-follow]');
  if (!button) return;
  const id = teamFollowId(sport, team);
  const sync = () => {
    const followed = getFollowed();
    const active = followed.some((item) => item?.id === id);
    button.dataset.following = active ? '1' : '0';
    button.textContent = active ? '✓ Following Team' : '+ Follow Team';
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  };
  button.addEventListener('click', () => {
    const followed = getFollowed();
    const index = followed.findIndex((item) => item?.id === id);
    if (index >= 0) followed.splice(index, 1);
    else followed.push({
      id,
      sport,
      teamId: String(team.team_id || ''),
      name: team.name,
      slug: team.slug,
      logo: team.logo || '',
    });
    setFollowed(followed);
    sync();
    window.dispatchEvent(new CustomEvent('pbe:team-follow-changed', { detail: { sport, team: team.name } }));
  });
  sync();
}

function formatDate(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function gameResult(game) {
  if (!game?.is_final || game.team_score == null || game.opponent_score == null) return game?.status || 'Game center →';
  const a = Number(game.team_score);
  const b = Number(game.opponent_score);
  const result = Number.isFinite(a) && Number.isFinite(b) && a !== b ? (a > b ? 'W' : 'L') : 'FINAL';
  return `${result} ${game.team_score}-${game.opponent_score}`;
}

function renderSchedule(games, sport, { emptyTitle = 'No games returned', emptyText = 'Games will appear here when available.' } = {}) {
  if (!games.length) return `<div class="pbe-intel-empty compact"><strong>${escapeHtml(emptyTitle)}</strong><span>${escapeHtml(emptyText)}</span></div>`;
  return `<div class="pbe-team-schedule">${games.map((game) => {
    const opponent = game?.opponent || {};
    const href = game?.path || (game?.game_id ? `/games/${sport}/${game.game_id}` : '#');
    return `
      <a class="pbe-team-game" href="${escapeAttr(href)}">
        <span class="pbe-team-game-date">${escapeHtml(formatDate(game.date))}</span>
        <span class="pbe-team-game-opponent">
          ${opponent.logo ? `<img src="${escapeAttr(opponent.logo)}" alt="" loading="lazy" />` : ''}
          <strong>${escapeHtml(opponent.name || 'Opponent')}</strong>
        </span>
        <span class="pbe-team-game-status">${escapeHtml(gameResult(game))}</span>
      </a>
    `;
  }).join('')}</div>`;
}

function renderRoster(players, sport) {
  if (!players.length) return '<div class="pbe-intel-empty compact"><strong>Roster unavailable</strong><span>The normalized team snapshot does not currently include a roster.</span></div>';
  return `
    <div class="pbe-team-roster">
      ${players.slice(0, 30).map((player) => {
        const href = player.path || (player.player_id ? `/player/${sport}/${player.player_id}` : null);
        const tag = href ? 'a' : 'div';
        const hrefAttr = href ? ` href="${escapeAttr(href)}"` : '';
        return `
          <${tag} class="pbe-team-player"${hrefAttr}>
            ${player.photo
              ? `<img src="${escapeAttr(player.photo)}" alt="${escapeAttr(player.name || '')}" loading="lazy" onerror="this.style.display='none'" />`
              : '<span class="pbe-team-player-fallback">PBE</span>'}
            <span>
              <strong>${escapeHtml(player.name || 'Player')}</strong>
              <small>${escapeHtml([player.position, player.jersey ? `#${player.jersey}` : null].filter(Boolean).join(' · '))}</small>
            </span>
          </${tag}>
        `;
      }).join('')}
    </div>
  `;
}

const STAT_LABELS = {
  runs: 'Runs',
  home_runs: 'Home runs',
  batting_average: 'Batting avg',
  on_base_percentage: 'On-base %',
  slugging: 'Slugging',
  era: 'Team ERA',
  runs_allowed: 'Runs allowed',
  strikeouts: 'Strikeouts',
  whip: 'WHIP',
  points_per_game: 'Points / game',
  goals_per_game: 'Goals / game',
  goals_against_per_game: 'Goals against',
};

function statLabel(key) {
  if (STAT_LABELS[key]) return STAT_LABELS[key];
  return String(key || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function currentSeasonLabel(sport, now = new Date()) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  if (sport === 'nba' || sport === 'nhl') {
    const start = month >= 7 ? year : year - 1;
    return `${start}–${String(start + 1).slice(-2)}`;
  }
  return String(year);
}

function renderTeamStats(stats, team, sport) {
  const rows = Object.entries(stats || {}).filter(([, value]) => value !== null && value !== undefined && value !== '').slice(0, 9);
  if (!rows.length && Number(team?.record?.games_played) === 0) {
    const season = currentSeasonLabel(sport);
    return `<div class="pbe-intel-empty compact"><strong>${escapeHtml(season)} team stats begin with the season</strong><span>No current-season team production sample exists yet. Roster, standings context, leaders and the upcoming schedule are already connected.</span></div>`;
  }
  if (!rows.length) return '<div class="pbe-intel-empty compact"><strong>Team stats unavailable</strong><span>The current snapshot does not publish a team-stat block.</span></div>';
  return `<div class="pbe-team-metric-grid">${rows.map(([key, value]) => `
    <div class="pbe-team-metric"><span>${escapeHtml(statLabel(key))}</span><strong>${escapeHtml(value)}</strong></div>
  `).join('')}</div>`;
}

function renderLeaders(leaders, sport) {
  if (!leaders.length) return '<div class="pbe-intel-empty compact"><strong>Leaders unavailable</strong><span>Leader cards will appear when the team snapshot publishes them.</span></div>';
  return `<div class="pbe-team-leaders">${leaders.slice(0, 12).map((leader) => {
    const href = leader.path || (leader.player_id ? `/player/${sport}/${leader.player_id}` : '#');
    const value = [leader.value, leader.unit && leader.unit !== leader.label ? leader.unit : null].filter((x) => x !== null && x !== undefined && x !== '').join(' ');
    return `
      <a class="pbe-team-leader" href="${escapeAttr(href)}">
        ${leader.photo ? `<img src="${escapeAttr(leader.photo)}" alt="${escapeAttr(leader.name || '')}" loading="lazy" />` : '<span class="pbe-team-player-fallback">PBE</span>'}
        <span><small>${escapeHtml(leader.label || leader.category || 'Leader')}</small><strong>${escapeHtml(leader.name || 'Player')}</strong></span>
        <b>${escapeHtml(value || '—')}</b>
      </a>
    `;
  }).join('')}</div>`;
}

function renderSnapshotCards(team) {
  const standings = team.standings || {};
  const form = team.recent_form || {};
  const cards = [
    ['Record', team.record?.summary || '—', team.record?.winning_percentage ? `${team.record.winning_percentage} win pct` : 'Season record'],
    ['Division', standings.division_rank ? `#${standings.division_rank}` : '—', team.league_context?.division || standings.division || 'Division standing'],
    ['Last 10', form.last10 || '—', 'Recent form'],
    ['Streak', form.streak || '—', standings.games_back != null ? `${standings.games_back} GB` : 'Current streak'],
  ];
  return `<div class="pbe-team-snapshot-grid">${cards.map(([label, value, note]) => `
    <div class="pbe-team-snapshot-stat"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></div>
  `).join('')}</div>`;
}

function readinessSummary(payload) {
  const fields = payload?.readiness?.fields || {};
  const total = Object.keys(fields).length;
  const ready = Object.values(fields).filter(Boolean).length;
  return total ? `${ready}/${total} TEAM FIELDS` : String(payload?.completeness || 'SNAPSHOT').toUpperCase();
}

export async function renderTeamPage(root, sport, teamSlug, setMeta) {
  const config = getSportConfig(sport);
  if (!config) return;

  root.innerHTML = `
    ${renderHeader()}
    <main class="pbe-intelligence-page">
      <div class="container">
        <div id="pbe-team-root" class="pbe-intel-loading">Loading ${config.label} team intelligence…</div>
      </div>
    </main>
    ${renderFooter()}
  `;

  const mount = document.getElementById('pbe-team-root');
  try {
    const payload = await loadTeamSnapshot(sport, teamSlug);
    const team = payload.snapshot;
    if (!team?.name) throw new Error('team_snapshot_missing_identity');

    const news = await loadTeamNews(sport, team);
    const recent = team.schedule?.recent || team.recent_games || [];
    const upcoming = team.schedule?.upcoming || team.upcoming_games || [];
    const sourceState = payload.freshness_state || 'UNKNOWN';

    setMeta?.({
      title: `${team.name} — ${config.label} Intelligence | PropBetEdge`,
      description: `${config.label} team intelligence for ${team.name}: record, standings, team stats, leaders, roster, schedule and connected PropBetEdge coverage.`,
      canonical: `https://propbetedge.ai/team/${sport}/${team.slug || teamSlug}`,
      ogImage: team.logo || undefined,
    });

    mount.className = '';
    mount.innerHTML = `
      <section class="pbe-team-hero">
        <div class="pbe-team-hero-bg" style="--team-color:#d4af37;--team-alt:#14110d"></div>
        <div class="pbe-team-hero-content">
          <div class="pbe-team-identity">
            ${team.logo ? `<img src="${escapeAttr(team.logo)}" alt="${escapeAttr(team.name)} logo" />` : ''}
            <div>
              <div class="pbe-intel-kicker">${config.emoji} ${config.label} TEAM INTELLIGENCE</div>
              <h1>${escapeHtml(team.name)}</h1>
              <p>${escapeHtml([
                team.record?.summary,
                team.league_context?.division || team.standings?.division,
                team.standings?.division_rank ? `#${team.standings.division_rank} division` : null,
              ].filter(Boolean).join(' · ') || `${config.label} entity hub`)}</p>
            </div>
          </div>
          <div class="pbe-intel-actions">
            <button type="button" class="btn btn-primary" data-pbe-team-follow aria-pressed="false">+ Follow Team</button>
            <a href="/standings/${sport}" class="btn btn-ghost">${config.label} Standings</a>
            <a href="/news/${sport}" class="btn btn-ghost">Latest News</a>
          </div>
        </div>
      </section>

      <section class="pbe-intel-ribbon" aria-label="PropBetEdge team snapshot status">
        <span>PBE ENTITY HUB</span><b>→</b><span>${escapeHtml(sourceState)}</span><b>→</b><span>${escapeHtml(readinessSummary(payload))}</span><b>→</b><span>ROSTER</span><b>→</b><span>GAMES</span><b>→</b><span>STATS</span><b>→</b><span>LEADERS</span>
      </section>

      ${renderSnapshotCards(team)}

      <div class="pbe-team-layout">
        <div class="pbe-team-main">
          <section class="pbe-intel-section">
            <div class="pbe-intel-section-head"><div><span>Team performance</span><h2>Season intelligence</h2></div><a href="/standings/${sport}">Standings →</a></div>
            ${renderTeamStats(team.team_stats, team, sport)}
          </section>

          <section class="pbe-intel-section">
            <div class="pbe-intel-section-head"><div><span>Recent results</span><h2>What just happened</h2></div><a href="/games">All games →</a></div>
            ${renderSchedule(recent, sport, Number(team?.record?.games_played) === 0
              ? { emptyTitle: `${currentSeasonLabel(sport)} results begin with the season`, emptyText: 'There are no completed current-season games yet. This is expected, not a missing feed.' }
              : { emptyTitle: 'No completed games in this snapshot', emptyText: 'Recent results will populate from the normalized team schedule.' })}
          </section>

          <section class="pbe-intel-section">
            <div class="pbe-intel-section-head"><div><span>Upcoming schedule</span><h2>What is next</h2></div><a href="/games">All games →</a></div>
            ${renderSchedule(upcoming, sport, { emptyTitle: 'No upcoming games in this snapshot', emptyText: 'Upcoming games will populate when scheduled.' })}
          </section>

          <section class="pbe-intel-section">
            <div class="pbe-intel-section-head"><div><span>Team leaders</span><h2>Who is driving the team</h2></div></div>
            ${renderLeaders(team.leaders || [], sport)}
          </section>

          <section class="pbe-intel-section">
            <div class="pbe-intel-section-head"><div><span>News graph</span><h2>Latest ${escapeHtml(team.name)} stories</h2></div><a href="/news/${sport}">All ${config.label} →</a></div>
            ${news.length ? `<div class="article-grid fade-stagger">${news.map((article) => renderArticleCard(article)).join('')}</div>` : '<div class="pbe-intel-empty compact"><strong>No recent team-specific stories matched.</strong><span>As stories arrive, they connect to this team hub automatically.</span></div>'}
          </section>
        </div>

        <aside class="pbe-team-side">
          <section class="pbe-intel-section">
            <div class="pbe-intel-section-head"><div><span>Current entity</span><h2>Roster</h2></div></div>
            ${renderRoster(team.roster || [], sport)}
          </section>
          <section class="pbe-team-model-card">
            <span>PROPBETEDGE TEAM GRAPH</span>
            <h3>One team. One intelligence destination.</h3>
            <p>Record, standings, roster, recent form, schedule, team production, leaders and newsroom coverage now resolve through the same normalized team snapshot instead of disconnected browser-side provider calls.</p>
            <a href="${escapeAttr(config.productUrl)}" target="_blank" rel="noopener">${escapeHtml(config.primaryCta)} →</a>
          </section>
        </aside>
      </div>
    `;

    mountFollowButton(sport, team);
  } catch (error) {
    mount.className = '';
    mount.innerHTML = `<div class="pbe-intel-empty"><strong>Team intelligence is temporarily unavailable.</strong><span>The PropBetEdge team snapshot could not be loaded. ${escapeHtml(error?.message || '')}</span></div>`;
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function escapeAttr(value) {
  return escapeHtml(value);
}
