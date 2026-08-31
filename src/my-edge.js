import { api } from './api.js';
import { getSportConfig } from './sport-config.js';

const FOLLOW_KEY = 'pbe_followed_teams_v1';
let timer = null;
let renderKey = '';

export function initMyEdge() {
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(syncMyEdge, 100);
  };

  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('popstate', schedule);
  window.addEventListener('pbe:team-follow-changed', () => {
    renderKey = '';
    schedule();
  });
  schedule();
}

async function syncMyEdge() {
  if (window.location.pathname !== '/') {
    renderKey = '';
    return;
  }

  const lead = document.querySelector('.lead-section');
  if (!lead) return;

  const followed = getFollowed().slice(0, 8);
  const key = JSON.stringify(followed.map((item) => item.id));
  if (document.getElementById('pbe-my-edge') && key === renderKey) return;
  renderKey = key;

  document.getElementById('pbe-my-edge')?.remove();
  const section = document.createElement('section');
  section.id = 'pbe-my-edge';
  section.className = 'pbe-my-edge';
  section.setAttribute('aria-label', 'My Edge personalized teams');
  lead.insertAdjacentElement('afterend', section);

  if (!followed.length) {
    section.innerHTML = renderOnboarding();
    return;
  }

  section.innerHTML = `
    <div class="pbe-my-edge-head">
      <div><span>MY EDGE</span><h2>Your teams. One intelligence desk.</h2></div>
      <small>Stored on this device</small>
    </div>
    <div class="pbe-my-edge-loading">Building your board…</div>
  `;

  const articlesBySport = await loadSportArticles(followed);
  if (!document.getElementById('pbe-my-edge')) return;

  section.innerHTML = `
    <div class="pbe-my-edge-head">
      <div><span>MY EDGE</span><h2>Your teams. One intelligence desk.</h2></div>
      <small>${followed.length} followed ${followed.length === 1 ? 'team' : 'teams'}</small>
    </div>
    <div class="pbe-my-edge-grid">
      ${followed.slice(0, 4).map((team) => renderTeamCard(team, articlesBySport[team.sport] || [])).join('')}
    </div>
    <div class="pbe-my-edge-foot">
      <span>Follow or unfollow teams from any team intelligence page.</span>
      <a href="/standings/nfl">Explore team hubs →</a>
    </div>
  `;
}

function renderOnboarding() {
  const sports = ['nfl', 'mlb', 'nba', 'nhl'];
  return `
    <div class="pbe-my-edge-onboard">
      <div>
        <span>MY EDGE</span>
        <h2>Make PropBetEdge yours.</h2>
        <p>Follow teams and this space becomes your personal sports intelligence desk — team hubs, current stories, games and the data that matters to you.</p>
      </div>
      <div class="pbe-my-edge-sports">
        ${sports.map((sport) => {
          const config = getSportConfig(sport);
          return `<a href="/standings/${sport}" data-pbe-personalization="start">${config.emoji} ${config.label}</a>`;
        }).join('')}
      </div>
    </div>
  `;
}

async function loadSportArticles(followed) {
  const sports = [...new Set(followed.map((item) => item.sport).filter(Boolean))];
  const pairs = await Promise.all(sports.map(async (sport) => {
    try {
      const data = await api.newsBySport(sport, 30, 1);
      return [sport, data?.articles || []];
    } catch {
      return [sport, []];
    }
  }));
  return Object.fromEntries(pairs);
}

function renderTeamCard(team, articles) {
  const config = getSportConfig(team.sport);
  const article = articles.find((candidate) => articleMatchesTeam(candidate, team));
  const hub = `/team/${team.sport}/${team.slug}`;
  return `
    <article class="pbe-my-edge-card">
      <div class="pbe-my-edge-teamline">
        ${team.logo ? `<img src="${escapeAttr(team.logo)}" alt="" loading="lazy" onerror="this.style.display='none'" />` : ''}
        <div><span>${escapeHtml(config?.label || String(team.sport || '').toUpperCase())}</span><strong>${escapeHtml(team.name)}</strong></div>
      </div>
      ${article ? `
        <a class="pbe-my-edge-story" href="/news/${team.sport}/${escapeAttr(article.slug)}" data-pbe-personalization="story">
          <span>LATEST CONNECTED STORY</span>
          <strong>${escapeHtml(article.title)}</strong>
          <small>${formatRelative(article.published_at)}</small>
        </a>
      ` : `
        <div class="pbe-my-edge-story is-empty">
          <span>CURRENT FEED</span>
          <strong>No fresh team-specific story matched.</strong>
          <small>The hub stays connected as new coverage lands.</small>
        </div>
      `}
      <a class="pbe-my-edge-hub" href="${hub}" data-pbe-personalization="team_hub">Open team intelligence →</a>
    </article>
  `;
}

function articleMatchesTeam(article, team) {
  const target = String(team.name || '').toLowerCase();
  const short = target.split(/\s+/).slice(-1)[0] || target;
  const explicit = (article?.take?.teams || []).map((value) => String(value).toLowerCase());
  if (explicit.some((value) => value.includes(target) || target.includes(value) || value.includes(short))) return true;
  const haystack = `${article?.title || ''} ${article?.summary || ''}`.toLowerCase();
  return haystack.includes(target) || (short.length > 3 && haystack.includes(short));
}

function getFollowed() {
  try {
    const value = JSON.parse(localStorage.getItem(FOLLOW_KEY) || '[]');
    return Array.isArray(value) ? value.filter((item) => item?.sport && item?.name && item?.slug) : [];
  } catch {
    return [];
  }
}

function formatRelative(value) {
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return '';
  const minutes = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function escapeAttr(value) {
  return escapeHtml(value);
}
