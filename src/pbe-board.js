import { api } from './api.js';
import { sports } from './api-sports.js';
import { getSportConfig } from './sport-config.js';

const EV_URL = 'https://propbetedge-ev-finder.sales-fd3.workers.dev/edges-today';
const REFRESH_MS = 3 * 60 * 1000;
let timer = null;
let refreshHandle = null;
let rendering = false;

export function initPbeBoard() {
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(sync, 120);
  };
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('popstate', schedule);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && window.location.pathname === '/') refresh();
  });
  schedule();
}

async function sync() {
  if (window.location.pathname !== '/') {
    stopRefresh();
    return;
  }
  const lead = document.querySelector('.lead-section');
  if (!lead || rendering) return;

  let board = document.getElementById('pbe-live-board');
  if (!board) {
    board = document.createElement('section');
    board.id = 'pbe-live-board';
    board.className = 'pbe-live-board';
    board.setAttribute('aria-label', 'PropBetEdge live board');
    const anchor = document.getElementById('pbe-my-writers') || document.getElementById('pbe-my-edge') || lead;
    anchor.insertAdjacentElement('afterend', board);
    board.innerHTML = skeleton();
    await refresh();
  }
  startRefresh();
}

function startRefresh() {
  if (refreshHandle) return;
  refreshHandle = setInterval(() => {
    if (window.location.pathname !== '/' || document.hidden) return;
    refresh();
  }, REFRESH_MS);
}

function stopRefresh() {
  if (refreshHandle) clearInterval(refreshHandle);
  refreshHandle = null;
}

async function refresh() {
  const mount = document.getElementById('pbe-live-board');
  if (!mount || rendering) return;
  rendering = true;
  try {
    const [newsResult, scoresResult, edgesResult] = await Promise.allSettled([
      api.homepage(),
      sports.allTodayScoreboards(),
      fetch(EV_URL, { cache: 'no-store', credentials: 'omit' }).then((r) => r.ok ? r.json() : Promise.reject(new Error(`edges ${r.status}`))),
    ]);
    const articles = newsResult.status === 'fulfilled' ? newsResult.value?.articles || [] : [];
    const scoreboards = scoresResult.status === 'fulfilled' ? scoresResult.value || {} : {};
    const edges = edgesResult.status === 'fulfilled' ? edgesResult.value || {} : {};
    mount.innerHTML = renderBoard(articles, scoreboards, edges);
  } finally {
    rendering = false;
  }
}

function renderBoard(articles, scoreboards, edges) {
  const stories = [...articles]
    .sort((a, b) => storyScore(b) - storyScore(a) || new Date(b.published_at) - new Date(a.published_at))
    .slice(0, 4);
  const games = normalizeGames(scoreboards).slice(0, 5);
  const edgeList = (edges.edges || []).slice(0, 4);

  return `
    <div class="pbe-board-head">
      <div><span>⚡ THE PBE BOARD</span><h2>What matters right now.</h2></div>
      <div class="pbe-board-live"><i></i><span>LIVE INTELLIGENCE</span></div>
    </div>
    <div class="pbe-board-grid">
      <section class="pbe-board-panel pbe-board-news">
        <div class="pbe-board-panel-head"><span>NEWS IMPACT</span><a href="/news">All news →</a></div>
        ${stories.length ? stories.map(renderStory).join('') : empty('No current stories returned.')}
      </section>
      <section class="pbe-board-panel pbe-board-games">
        <div class="pbe-board-panel-head"><span>ON DECK</span><a href="/games">PBEcast →</a></div>
        ${games.length ? games.map(renderGame).join('') : empty('No current games returned.')}
      </section>
      <section class="pbe-board-panel pbe-board-model">
        <div class="pbe-board-panel-head"><span>MODEL BOARD</span><a href="/odds">All edges →</a></div>
        ${edgeList.length ? edgeList.map(renderEdge).join('') : empty('No verified +EV edges are live right now.')}
        ${edges.generated_at_et ? `<div class="pbe-board-source">Edge feed: ${escapeHtml(edges.generated_at_et)}</div>` : ''}
      </section>
    </div>
    <div class="pbe-board-truth">
      <span>News impact comes from published PBE analysis. Games come from live league scoreboards. Model edges appear only when the verified edge feed returns them.</span>
      <button type="button" data-pbe-board-refresh>Refresh board ↻</button>
    </div>
  `;
}

function storyScore(article) {
  const rawImpact = article?.take?.impact_score;
  const impact = rawImpact == null || rawImpact === '' ? 0 : Number(rawImpact);
  const safeImpact = Number.isFinite(impact) ? impact : 0;
  const published = new Date(article?.published_at || 0).getTime();
  const ageHours = Number.isFinite(published) ? Math.max(0, (Date.now() - published) / 3600000) : 24;
  return safeImpact * 30 + Math.max(0, 24 - ageHours);
}

function renderStory(article) {
  const config = getSportConfig(article.sport);
  const rawImpact = article?.take?.impact_score;
  const impact = rawImpact == null || rawImpact === '' ? null : Number(rawImpact);
  return `
    <a class="pbe-board-story" href="/news/${escapeAttr(article.sport)}/${escapeAttr(article.slug)}" data-pbe-board-kind="story">
      <span>${config?.emoji || '◆'} ${escapeHtml(config?.label || String(article.sport || '').toUpperCase())}</span>
      <strong>${escapeHtml(article.title)}</strong>
      <small>${Number.isFinite(impact) ? `Impact ${impact}/5 · ` : ''}${formatRelative(article.published_at)}</small>
    </a>
  `;
}

function normalizeGames(scoreboards) {
  const now = Date.now();
  const rows = [];
  for (const sport of ['nfl', 'mlb', 'nba', 'nhl']) {
    for (const game of scoreboards?.[sport]?.games || []) {
      const date = new Date(game.date).getTime();
      const state = String(game.statusState || game.status || '').toLowerCase();
      const completed = state.includes('post') || state.includes('final') || state.includes('off');
      rows.push({ ...game, sport, date, completed, distance: Number.isFinite(date) ? Math.abs(date - now) : Number.MAX_SAFE_INTEGER });
    }
  }
  return rows.sort((a, b) => Number(a.completed) - Number(b.completed) || a.distance - b.distance);
}

function renderGame(game) {
  const config = getSportConfig(game.sport);
  const status = game.statusDetail || game.status || formatGameTime(game.date);
  return `
    <a class="pbe-board-game" href="/games/${escapeAttr(game.sport)}/${escapeAttr(game.id)}" data-pbe-board-kind="game">
      <span>${config?.emoji || '◆'} ${escapeHtml(config?.label || '')}</span>
      <strong>${escapeHtml(shortName(game.away, game.awayAbbr))} <b>${score(game.awayScore)}</b> <em>at</em> ${escapeHtml(shortName(game.home, game.homeAbbr))} <b>${score(game.homeScore)}</b></strong>
      <small>${escapeHtml(status)}</small>
    </a>
  `;
}

function renderEdge(edge) {
  return `
    <a class="pbe-board-edge" href="/odds" data-pbe-board-kind="edge">
      <span>${escapeHtml(edge.tier_label || 'MODEL EDGE')}</span>
      <strong>${escapeHtml(edge.player_name || 'Player')} · OVER ${escapeHtml(String(edge.line ?? '—'))} ${escapeHtml(edge.market_label || '')}</strong>
      <small>+${escapeHtml(edge.edge_pct || '—')} edge · ${escapeHtml(edge.best_book || 'best available')}</small>
    </a>
  `;
}

function empty(message) { return `<div class="pbe-board-empty">${escapeHtml(message)}</div>`; }
function shortName(name, abbr) { return abbr || name || 'TBD'; }
function score(value) { return value == null || value === '' ? '' : escapeHtml(String(value)); }
function formatGameTime(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Schedule';
}
function formatRelative(value) {
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return '';
  const minutes = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`;
  return `${Math.round(minutes / 1440)}d ago`;
}
function skeleton() { return `<div class="pbe-board-head"><div><span>⚡ THE PBE BOARD</span><h2>What matters right now.</h2></div></div><div class="pbe-board-skeleton">Building the live board…</div>`; }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
function escapeAttr(value) { return escapeHtml(value); }

if (typeof document !== 'undefined') {
  document.addEventListener('click', (event) => {
    const refreshButton = event.target?.closest?.('[data-pbe-board-refresh]');
    if (refreshButton) {
      refreshButton.disabled = true;
      refresh().finally(() => { refreshButton.disabled = false; });
      return;
    }
    const link = event.target?.closest?.('#pbe-live-board a[href]');
    if (link && typeof window.gtag === 'function') {
      window.gtag('event', 'intelligence_click', {
        surface: 'pbe_board',
        item_kind: link.dataset.pbeBoardKind || 'navigation',
        link_url: link.href || '',
        link_text: String(link.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160),
      });
    }
  });
}
