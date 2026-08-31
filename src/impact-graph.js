import { getSportConfig, entityHref } from './sport-config.js';

const NEWS_API = 'https://propbet-news-api.sales-fd3.workers.dev';
let activeKey = '';
let timer = null;

export function initImpactGraph() {
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(syncImpactGraph, 90);
  };

  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('popstate', schedule);
  schedule();
}

async function syncImpactGraph() {
  const match = window.location.pathname.match(/^\/news\/(mlb|nfl|nba|nhl)\/([^/]+)\/?$/i);
  if (!match) {
    activeKey = '';
    return;
  }

  const sport = match[1].toLowerCase();
  const slug = decodeURIComponent(match[2]);
  const key = `${sport}:${slug}`;
  const anchor = document.querySelector('.pbe-story-entities') || document.querySelector('.ai-take-callout');
  if (!anchor || document.querySelector('.pbe-impact-graph')) return;
  if (activeKey === key) return;
  activeKey = key;

  try {
    const response = await fetch(`${NEWS_API}/news/article/${encodeURIComponent(slug)}`, { credentials: 'omit' });
    if (!response.ok) return;
    const payload = await response.json();
    const article = payload?.article;
    if (!article?.take) return;
    renderGraph(anchor, article, sport);
  } catch {
    // The article stays fully usable when the intelligence graph cannot load.
  }
}

function renderGraph(anchor, article, sport) {
  if (document.querySelector('.pbe-impact-graph')) return;
  const take = article.take || {};
  const config = getSportConfig(sport);
  if (!config) return;

  const players = unique(take.players).slice(0, 4);
  const teams = unique(take.teams).slice(0, 3);
  const props = unique(take.prop_types).slice(0, 5);
  const score = Number.isFinite(Number(take.impact_score)) ? Math.max(0, Math.min(5, Number(take.impact_score))) : null;
  const hasEntities = players.length || teams.length || props.length;
  if (!hasEntities && score == null && !take.advice) return;

  const section = document.createElement('section');
  section.className = 'pbe-impact-graph';
  section.setAttribute('aria-label', 'PropBetEdge impact graph');
  section.innerHTML = `
    <div class="pbe-impact-head">
      <div>
        <span>THE IMPACT GRAPH</span>
        <h2>How this story connects to the market.</h2>
      </div>
      ${score == null ? '' : `<div class="pbe-impact-score"><strong>${escapeHtml(score)}</strong><span>/5 IMPACT</span></div>`}
    </div>

    <div class="pbe-impact-flow">
      <div class="pbe-impact-node pbe-impact-story">
        <span>STORY</span>
        <strong>${escapeHtml(shorten(article.title || 'Current story', 62))}</strong>
      </div>
      ${teams.map((name) => `
        <span class="pbe-impact-arrow">→</span>
        <a class="pbe-impact-node" href="${entityHref('team', sport, name)}">
          <span>TEAM</span><strong>${escapeHtml(name)}</strong>
        </a>
      `).join('')}
      ${players.map((name) => `
        <span class="pbe-impact-arrow">→</span>
        <div class="pbe-impact-node"><span>PLAYER</span><strong>${escapeHtml(name)}</strong></div>
      `).join('')}
      ${props.map((prop) => `
        <span class="pbe-impact-arrow">→</span>
        <div class="pbe-impact-node pbe-impact-prop"><span>PROP</span><strong>${escapeHtml(formatProp(prop))}</strong></div>
      `).join('')}
      <span class="pbe-impact-arrow">→</span>
      <a class="pbe-impact-node pbe-impact-market" href="${escapeAttr(config.picksUrl || config.productUrl)}" target="_blank" rel="noopener">
        <span>PBE INTELLIGENCE</span><strong>Live model + market view</strong>
      </a>
    </div>

    ${take.advice ? `<div class="pbe-impact-read"><span>MODEL READ</span><p>${escapeHtml(take.advice)}</p></div>` : ''}

    <div class="pbe-impact-footer">
      <span>Known nodes are rendered from the current story analysis. Line movement and outcome history attach only when verified data is available.</span>
      <a href="${escapeAttr(config.productUrl)}" target="_blank" rel="noopener">${escapeHtml(config.primaryCta)} →</a>
    </div>
  `;

  anchor.insertAdjacentElement('afterend', section);
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || '').trim()).filter(Boolean))];
}

function formatProp(value) {
  const map = {
    passing_yards: 'Passing Yards',
    passing_tds: 'Passing TDs',
    rushing_yards: 'Rushing Yards',
    rushing_tds: 'Rushing TDs',
    receiving_yards: 'Receiving Yards',
    receptions: 'Receptions',
    receiving_tds: 'Receiving TDs',
    anytime_td: 'Anytime TD',
    sacks: 'Sacks',
    k_prop: 'Strikeouts',
    hr: 'Home Runs',
    altprop_hits: 'Hits',
    altprop_total_bases: 'Total Bases',
    stolen_bases: 'Stolen Bases',
    points: 'Points',
    rebounds: 'Rebounds',
    assists: 'Assists',
    shots_on_goal: 'Shots on Goal',
    goals: 'Goals',
    saves: 'Saves',
    moneyline: 'Moneyline',
    spread: 'Spread',
    team_total: 'Team Total',
  };
  const key = String(value || '');
  return map[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function shorten(value, max) {
  const text = String(value || '');
  return text.length > max ? `${text.slice(0, max - 1).trim()}…` : text;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function escapeAttr(value) {
  return escapeHtml(value);
}
