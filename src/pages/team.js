import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { renderArticleCard } from '../components/article-card.js';
import { api } from '../api.js';
import { getSportConfig, slugifyEntity } from '../sport-config.js';

const FOLLOW_KEY = 'pbe_followed_teams_v1';

async function fetchJson(url) {
  const response = await fetch(url, { credentials: 'omit' });
  if (!response.ok) throw new Error(`${response.status}`);
  return response.json();
}

function allTeamsFrom(data) {
  const leagues = data?.sports?.flatMap((sport) => sport.leagues || []) || [];
  return leagues.flatMap((league) => league.teams || []).map((item) => item.team || item).filter(Boolean);
}

function teamMatches(team, slug) {
  const candidates = [
    team?.displayName,
    team?.shortDisplayName,
    team?.name,
    team?.location,
    team?.abbreviation,
    team?.slug,
  ].filter(Boolean).map(slugifyEntity);
  return candidates.includes(slugifyEntity(slug));
}

function teamLogo(team) {
  return team?.logos?.find((logo) => logo?.href)?.href || team?.logo || '';
}

function teamRecord(team, schedule) {
  const record = team?.record?.items?.find((item) => item?.summary)?.summary
    || team?.record?.items?.[0]?.summary
    || schedule?.team?.recordSummary
    || schedule?.team?.record
    || '';
  return typeof record === 'string' ? record : record?.summary || '';
}

function normalizeRoster(data) {
  const groups = Array.isArray(data?.athletes) ? data.athletes : [];
  return groups.flatMap((group) => {
    if (Array.isArray(group?.items)) return group.items;
    if (Array.isArray(group?.athletes)) return group.athletes;
    return group?.fullName ? [group] : [];
  }).filter(Boolean);
}

function playerHeadshot(player) {
  return player?.headshot?.href || player?.headshot || '';
}

function renderRoster(players) {
  if (!players.length) return '<div class="pbe-intel-empty compact"><strong>Roster unavailable</strong><span>The source did not return a current roster.</span></div>';
  return `
    <div class="pbe-team-roster">
      ${players.slice(0, 16).map((player) => {
        const photo = playerHeadshot(player);
        const position = player?.position?.abbreviation || player?.position?.name || '';
        const jersey = player?.jersey ? `#${player.jersey}` : '';
        return `
          <div class="pbe-team-player">
            ${photo ? `<img src="${escapeAttr(photo)}" alt="${escapeAttr(player.fullName || player.displayName || '')}" loading="lazy" onerror="this.style.display='none'" />` : '<span class="pbe-team-player-fallback">PBE</span>'}
            <span>
              <strong>${escapeHtml(player.fullName || player.displayName || 'Player')}</strong>
              <small>${escapeHtml([position, jersey].filter(Boolean).join(' · '))}</small>
            </span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function normalizeEvents(schedule) {
  return (schedule?.events || []).filter(Boolean).sort((a, b) => new Date(a.date) - new Date(b.date));
}

function opponentFor(event, teamId) {
  const competition = event?.competitions?.[0] || {};
  const competitors = competition.competitors || [];
  return competitors.find((item) => String(item?.team?.id || item?.id) !== String(teamId)) || competitors[1] || {};
}

function renderSchedule(events, team, sport) {
  if (!events.length) return '<div class="pbe-intel-empty compact"><strong>No schedule returned</strong><span>Games will appear here when available.</span></div>';
  const now = Date.now();
  const ordered = [...events]
    .sort((a, b) => Math.abs(new Date(a.date).getTime() - now) - Math.abs(new Date(b.date).getTime() - now))
    .slice(0, 6)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  return `<div class="pbe-team-schedule">${ordered.map((event) => {
    const opponent = opponentFor(event, team.id);
    const opp = opponent?.team || {};
    const logo = teamLogo(opp);
    const comp = event?.competitions?.[0] || {};
    const status = comp?.status?.type?.shortDetail || event?.status?.type?.shortDetail || '';
    const date = new Date(event.date);
    const when = Number.isFinite(date.getTime()) ? date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
    return `
      <a class="pbe-team-game" href="/games/${sport}/${escapeAttr(event.id)}">
        <span class="pbe-team-game-date">${escapeHtml(when)}</span>
        <span class="pbe-team-game-opponent">
          ${logo ? `<img src="${escapeAttr(logo)}" alt="" loading="lazy" />` : ''}
          <strong>${escapeHtml(opp.displayName || opp.name || event.shortName || 'Game')}</strong>
        </span>
        <span class="pbe-team-game-status">${escapeHtml(status || 'Game center →')}</span>
      </a>
    `;
  }).join('')}</div>`;
}

function articleMatchesTeam(article, team) {
  const names = [team.displayName, team.shortDisplayName, team.name, team.location, team.abbreviation]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
  const explicit = (article?.take?.teams || []).map((value) => String(value).toLowerCase());
  if (explicit.some((value) => names.some((name) => value.includes(name) || name.includes(value)))) return true;
  const haystack = `${article?.title || ''} ${article?.summary || ''}`.toLowerCase();
  return names.some((name) => name.length > 2 && haystack.includes(name));
}

async function loadTeamNews(sport, team) {
  try {
    const data = await api.newsBySport(sport, 60, 1);
    return (data?.articles || []).filter((article) => articleMatchesTeam(article, team)).slice(0, 6);
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
  return `${sport}:${team.id || slugifyEntity(team.displayName)}`;
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
    else followed.push({ id, sport, teamId: String(team.id || ''), name: team.displayName, slug: slugifyEntity(team.displayName), logo: teamLogo(team) });
    setFollowed(followed);
    sync();
    window.dispatchEvent(new CustomEvent('pbe:team-follow-changed', { detail: { sport, team: team.displayName } }));
  });
  sync();
}

export async function renderTeamPage(root, sport, teamSlug, setMeta) {
  const config = getSportConfig(sport);
  if (!config) return;

  root.innerHTML = `
    ${renderHeader()}
    <main class="pbe-intelligence-page">
      <div class="container">
        <div id="pbe-team-root" class="pbe-intel-loading">Resolving ${config.label} team intelligence…</div>
      </div>
    </main>
    ${renderFooter()}
  `;

  const mount = document.getElementById('pbe-team-root');
  try {
    const teamsData = await fetchJson(`https://site.api.espn.com/apis/site/v2/sports/${config.espnPath}/teams?limit=100`);
    const team = allTeamsFrom(teamsData).find((candidate) => teamMatches(candidate, teamSlug));
    if (!team) {
      mount.innerHTML = `<div class="pbe-intel-empty"><strong>Team not found.</strong><span><a href="/standings/${sport}">Open ${config.label} standings</a> to choose a current team.</span></div>`;
      return;
    }

    const teamId = team.id;
    const [detailResult, scheduleResult, rosterResult, news] = await Promise.all([
      fetchJson(`https://site.api.espn.com/apis/site/v2/sports/${config.espnPath}/teams/${teamId}`).catch(() => null),
      fetchJson(`https://site.api.espn.com/apis/site/v2/sports/${config.espnPath}/teams/${teamId}/schedule`).catch(() => null),
      fetchJson(`https://site.api.espn.com/apis/site/v2/sports/${config.espnPath}/teams/${teamId}/roster`).catch(() => null),
      loadTeamNews(sport, team),
    ]);

    const detailedTeam = detailResult?.team || team;
    const logo = teamLogo(detailedTeam) || teamLogo(team);
    const record = teamRecord(detailedTeam, scheduleResult);
    const events = normalizeEvents(scheduleResult);
    const roster = normalizeRoster(rosterResult);

    setMeta?.({
      title: `${detailedTeam.displayName || team.displayName} — ${config.label} Intelligence | PropBetEdge`,
      description: `${config.label} team hub for ${detailedTeam.displayName || team.displayName}: schedule, roster, latest stories and connected PropBetEdge intelligence.`,
      canonical: `https://propbetedge.ai/team/${sport}/${slugifyEntity(detailedTeam.displayName || team.displayName)}`,
      ogImage: logo || undefined,
    });

    mount.className = '';
    mount.innerHTML = `
      <section class="pbe-team-hero">
        <div class="pbe-team-hero-bg" style="--team-color:#${escapeAttr(detailedTeam.color || team.color || 'd4af37')};--team-alt:#${escapeAttr(detailedTeam.alternateColor || team.alternateColor || '14110d')}"></div>
        <div class="pbe-team-hero-content">
          <div class="pbe-team-identity">
            ${logo ? `<img src="${escapeAttr(logo)}" alt="${escapeAttr(detailedTeam.displayName || team.displayName)} logo" />` : ''}
            <div>
              <div class="pbe-intel-kicker">${config.emoji} ${config.label} TEAM INTELLIGENCE</div>
              <h1>${escapeHtml(detailedTeam.displayName || team.displayName)}</h1>
              <p>${escapeHtml([record, detailedTeam.standingSummary].filter(Boolean).join(' · ') || `${config.label} entity hub`)}</p>
            </div>
          </div>
          <div class="pbe-intel-actions">
            <button type="button" class="btn btn-primary" data-pbe-team-follow aria-pressed="false">+ Follow Team</button>
            <a href="/standings/${sport}" class="btn btn-ghost">${config.label} Standings</a>
            <a href="/news/${sport}" class="btn btn-ghost">Latest News</a>
          </div>
        </div>
      </section>

      <section class="pbe-intel-ribbon" aria-label="PropBetEdge intelligence graph">
        <span>TEAM</span><b>→</b><span>PLAYERS</span><b>→</b><span>GAMES</span><b>→</b><span>STORIES</span><b>→</b><span>MARKETS</span><b>→</b><span>MODEL</span>
      </section>

      <div class="pbe-team-layout">
        <div class="pbe-team-main">
          <section class="pbe-intel-section">
            <div class="pbe-intel-section-head"><div><span>Schedule intelligence</span><h2>Games around now</h2></div><a href="/games">All games →</a></div>
            ${renderSchedule(events, team, sport)}
          </section>

          <section class="pbe-intel-section">
            <div class="pbe-intel-section-head"><div><span>News graph</span><h2>Latest ${escapeHtml(team.shortDisplayName || team.name || '')} stories</h2></div><a href="/news/${sport}">All ${config.label} →</a></div>
            ${news.length ? `<div class="article-grid fade-stagger">${news.map((article) => renderArticleCard(article)).join('')}</div>` : '<div class="pbe-intel-empty compact"><strong>No recent team-specific stories matched.</strong><span>As stories arrive, they will connect to this team hub automatically.</span></div>'}
          </section>
        </div>

        <aside class="pbe-team-side">
          <section class="pbe-intel-section">
            <div class="pbe-intel-section-head"><div><span>Current entity</span><h2>Roster</h2></div></div>
            ${renderRoster(roster)}
          </section>
          <section class="pbe-team-model-card">
            <span>PROP BET EDGE</span>
            <h3>The intelligence layer attaches here.</h3>
            <p>This team identity is now a stable destination for stories, games and players. Live market movement, model reactions and “what happened next” can attach to the same entity instead of living in disconnected pages.</p>
            <a href="${escapeAttr(config.productUrl)}" target="_blank" rel="noopener">${escapeHtml(config.primaryCta)} →</a>
          </section>
        </aside>
      </div>
    `;

    mountFollowButton(sport, detailedTeam);
  } catch (error) {
    mount.innerHTML = `<div class="pbe-intel-empty"><strong>Team intelligence is temporarily unavailable.</strong><span>${escapeHtml(error.message)}</span></div>`;
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function escapeAttr(value) {
  return escapeHtml(value);
}
