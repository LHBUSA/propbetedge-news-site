/**
 * Article-native visual intelligence for PropBetEdge newsroom stories.
 *
 * Rules:
 * - Never invent a number.
 * - Static visuals use only the article payload + deterministic entity manifest.
 * - Live player context is optional, read-only, and labeled as current context.
 * - If source data is missing, the chart disappears instead of filling with zeroes.
 */

import { espnCategories, espnGameLog, nhlCategories, nhlGameLog, number as toNumber } from './pages/player-history-core.js';

const PROP_LABELS = {
  k_prop: 'Strikeouts', hr: 'Home Runs', altprop_hits: 'Hits', altprop_total_bases: 'Total Bases',
  altprop_doubles: 'Doubles', altprop_rbi: 'RBI', altprop_runs: 'Runs', altprop_walks: 'Walks',
  stolen_bases: 'Stolen Bases', team_total: 'Team Total', spread: 'Spread', moneyline: 'Moneyline',
  first_5_innings: 'First 5', nrfi: 'NRFI', passing_yards: 'Passing Yards', passing_tds: 'Passing TDs',
  rushing_yards: 'Rushing Yards', rushing_tds: 'Rushing TDs', receiving_yards: 'Receiving Yards',
  receptions: 'Receptions', receiving_tds: 'Receiving TDs', anytime_td: 'Anytime TD', sacks: 'Sacks',
  points: 'Points', rebounds: 'Rebounds', assists: 'Assists', threes_made: '3PM', pra: 'PRA',
  shots_on_goal: 'Shots on Goal', goals: 'Goals', saves: 'Saves',
};

const METRIC_PATTERNS = {
  mlb: [
    ['HR', /(\d+(?:\.\d+)?)\s+(?:home runs?|HRs?)\b/i],
    ['K', /(\d+(?:\.\d+)?)\s+(?:strikeouts?|Ks?)\b/i],
    ['H', /(\d+(?:\.\d+)?)\s+hits?\b/i],
    ['TB', /(\d+(?:\.\d+)?)\s+total bases?\b/i],
    ['RBI', /(\d+(?:\.\d+)?)\s+RBIs?\b/i],
    ['IP', /(\d+(?:\.\d+)?)\s+innings?(?: pitched)?\b/i],
  ],
  nfl: [
    ['PASS YDS', /(\d+(?:\.\d+)?)\s+passing yards?\b/i],
    ['RUSH YDS', /(\d+(?:\.\d+)?)\s+rushing yards?\b/i],
    ['REC YDS', /(\d+(?:\.\d+)?)\s+receiving yards?\b/i],
    ['REC', /(\d+(?:\.\d+)?)\s+receptions?\b/i],
    ['TD', /(\d+(?:\.\d+)?)\s+(?:touchdowns?|TDs?)\b/i],
    ['TGT', /(\d+(?:\.\d+)?)\s+targets?\b/i],
    ['CAR', /(\d+(?:\.\d+)?)\s+carries\b/i],
  ],
  nba: [
    ['PTS', /(\d+(?:\.\d+)?)\s+points?\b/i],
    ['REB', /(\d+(?:\.\d+)?)\s+rebounds?\b/i],
    ['AST', /(\d+(?:\.\d+)?)\s+assists?\b/i],
    ['MIN', /(\d+(?:\.\d+)?)\s+minutes?\b/i],
    ['3PM', /(\d+(?:\.\d+)?)\s+(?:three-pointers?|3-pointers?|threes?)\b/i],
  ],
  nhl: [
    ['SOG', /(\d+(?:\.\d+)?)\s+shots?(?: on goal)?\b/i],
    ['G', /(\d+(?:\.\d+)?)\s+goals?\b/i],
    ['A', /(\d+(?:\.\d+)?)\s+assists?\b/i],
    ['PTS', /(\d+(?:\.\d+)?)\s+points?\b/i],
    ['SV', /(\d+(?:\.\d+)?)\s+saves?\b/i],
    ['MIN', /(\d+(?:\.\d+)?)\s+minutes?\b/i],
  ],
};

const RECENT_METRIC = {
  mlb: {
    k_prop: ['strikeOuts', 'Strikeouts'], hr: ['homeRuns', 'Home Runs'], altprop_hits: ['hits', 'Hits'],
    altprop_total_bases: ['totalBases', 'Total Bases'], stolen_bases: ['stolenBases', 'Stolen Bases'],
  },
  nfl: {
    passing_yards: ['passingYards', 'Passing Yards'], passing_tds: ['passingTouchdowns', 'Passing TDs'],
    rushing_yards: ['rushingYards', 'Rushing Yards'], rushing_tds: ['rushingTouchdowns', 'Rushing TDs'],
    receiving_yards: ['receivingYards', 'Receiving Yards'], receptions: ['receptions', 'Receptions'],
    receiving_tds: ['receivingTouchdowns', 'Receiving TDs'],
  },
  nba: {
    points: ['points', 'Points'], rebounds: ['rebounds', 'Rebounds'], assists: ['assists', 'Assists'],
    threes_made: ['threePointFieldGoalsMade', '3PM'],
  },
  nhl: {
    shots_on_goal: ['shots', 'Shots on Goal'], goals: ['goals', 'Goals'], saves: ['saves', 'Saves'],
    points: ['points', 'Points'],
  },
};

const FALLBACK_METRIC = {
  mlb: ['hits', 'Hits'],
  nfl: ['receivingYards', 'Receiving Yards'],
  nba: ['points', 'Points'],
  nhl: ['shots', 'Shots on Goal'],
};

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function strip(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function articleText(article) {
  return strip(article?.body_html || article?.body || article?.summary || '');
}

function sentenceAround(text, index) {
  const left = Math.max(text.lastIndexOf('. ', index), text.lastIndexOf('! ', index), text.lastIndexOf('? ', index));
  const rest = text.slice(index);
  const ends = ['. ', '! ', '? '].map((x) => rest.indexOf(x)).filter((x) => x >= 0);
  const right = ends.length ? index + Math.min(...ends) + 1 : Math.min(text.length, index + 150);
  const value = text.slice(left >= 0 ? left + 2 : Math.max(0, index - 65), right).trim();
  return value.length > 115 ? value.slice(0, 112).trim() + '…' : value;
}

function keyNumbers(article) {
  const sport = String(article?.sport || '').toLowerCase();
  const patterns = METRIC_PATTERNS[sport] || [];
  const text = articleText(article);
  if (!text) return [];
  const found = [];
  const seen = new Set();

  for (const [label, re] of patterns) {
    const flags = re.flags.includes('g') ? re.flags : re.flags + 'g';
    const global = new RegExp(re.source, flags);
    let match;
    while ((match = global.exec(text)) && found.length < 8) {
      const value = match[1];
      const key = `${label}:${value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({ label, value, context: sentenceAround(text, match.index) });
    }
  }
  return found.slice(0, 4);
}

function impactScore(article) {
  const raw = Number(article?.take?.impact_score);
  return Number.isFinite(raw) ? Math.max(0, Math.min(5, raw)) : null;
}

function impactVisual(score) {
  if (score == null) return '';
  const rounded = Math.max(0, Math.min(5, Math.round(score)));
  return `<div class="pbe-av-impact" aria-label="Story impact ${esc(score)} out of 5">
    <div class="pbe-av-impact-score"><strong>${esc(score)}</strong><span>/5</span></div>
    <div class="pbe-av-impact-bars">${[1,2,3,4,5].map((n) => `<i class="${n <= rounded ? 'is-on' : ''}"></i>`).join('')}</div>
    <small>Story impact</small>
  </div>`;
}

function renderKeyNumbers(article) {
  const rows = keyNumbers(article);
  if (!rows.length) return '';
  return `<div class="pbe-av-keynums">
    ${rows.map((row) => `<div class="pbe-av-keynum">
      <strong>${esc(row.value)}</strong>
      <span>${esc(row.label)}</span>
      <small>${esc(row.context)}</small>
    </div>`).join('')}
  </div>`;
}

function renderFootprint(article, manifest) {
  const props = [...new Set((article?.take?.prop_types || []).map((x) => String(x || '').trim()).filter(Boolean))].slice(0, 5);
  const players = (manifest?.players || []).slice(0, 3);
  const teams = (manifest?.teams || []).slice(0, 2);
  if (!props.length && !players.length && !teams.length) return '';

  return `<div class="pbe-av-footprint">
    <div class="pbe-av-footprint-head"><span>MARKET FOOTPRINT</span><small>Entities and prop markets tagged to this story</small></div>
    <div class="pbe-av-footprint-flow">
      ${teams.map((team) => `<a href="${esc(team.path || '#')}" class="pbe-av-node pbe-av-node--team">${team.logo_url ? `<img src="${esc(team.logo_url)}" alt="" loading="lazy" />` : ''}<span>TEAM</span><b>${esc(team.abbreviation || team.name)}</b></a>`).join('')}
      ${players.map((player) => `<a href="${esc(player.path || '#')}" class="pbe-av-node pbe-av-node--player">${player.image_url ? `<img src="${esc(player.image_url)}" alt="" loading="lazy" />` : ''}<span>PLAYER</span><b>${esc(player.name)}</b></a>`).join('')}
      ${props.map((prop) => `<div class="pbe-av-node pbe-av-node--prop"><span>PROP</span><b>${esc(PROP_LABELS[prop] || prop.replace(/_/g, ' '))}</b></div>`).join('')}
    </div>
  </div>`;
}

export function renderArticleVisuals(article, manifest) {
  const score = impactScore(article);
  const nums = keyNumbers(article);
  const hasPlayer = Boolean(manifest?.players?.[0]?.id);
  const hasFootprint = Boolean((article?.take?.prop_types || []).length || (manifest?.players || []).length || (manifest?.teams || []).length);
  if (score == null && !nums.length && !hasPlayer && !hasFootprint) return '';

  const id = `pbe-av-${String(article?.id || article?.slug || 'story').replace(/[^a-z0-9_-]/gi, '')}`;
  return `<section class="pbe-article-visuals" id="${esc(id)}" data-pbe-article-visuals aria-label="PropBetEdge story data">
    <div class="pbe-av-head">
      <div><span class="pbe-av-kicker">PBE DATA VIEW</span><h2>The story, visualized.</h2></div>
      ${impactVisual(score)}
    </div>
    ${nums.length ? renderKeyNumbers(article) : ''}
    ${renderFootprint(article, manifest)}
    ${hasPlayer ? `<div class="pbe-av-player" data-pbe-player-chart><div class="pbe-av-loading"><span></span><span></span><span></span></div></div>` : ''}
    <div class="pbe-av-source-note">Visuals use numbers already in this story plus verified current player data when available. Missing data stays missing.</div>
  </section>`;
}

function currentSeason(sport, now = new Date()) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  if (sport === 'nba') return String(month >= 7 ? year + 1 : year);
  if (sport === 'nfl') return String(month >= 7 ? year : year - 1);
  if (sport === 'nhl') {
    const start = month >= 7 ? year : year - 1;
    return `${start}${start + 1}`;
  }
  return String(year);
}

function chooseMetric(article, sport) {
  const props = article?.take?.prop_types || [];
  for (const prop of props) {
    if (RECENT_METRIC[sport]?.[prop]) return RECENT_METRIC[sport][prop];
  }
  return FALLBACK_METRIC[sport] || null;
}

async function fetchJson(url) {
  const res = await fetch(url, { credentials: 'omit' });
  if (!res.ok) throw new Error(`source ${res.status}`);
  return res.json();
}

async function mlbContext(player, article) {
  const season = currentSeason('mlb');
  const data = await fetchJson(`https://statsapi.mlb.com/api/v1/people/${encodeURIComponent(player.id)}?hydrate=stats(group=[hitting,pitching],type=[season,gameLog],season=${season},sportId=1),currentTeam`);
  const person = data?.people?.[0];
  if (!person) return null;
  const pitcher = String(person.primaryPosition?.abbreviation || player.position || '').toUpperCase() === 'P';
  const group = pitcher ? 'pitching' : 'hitting';
  const stats = person.stats || [];
  const seasonRow = stats.find((s) => s.group?.displayName === group && s.type?.displayName === 'season')?.splits?.[0]?.stat || null;
  const games = stats.find((s) => s.group?.displayName === group && s.type?.displayName === 'gameLog')?.splits || [];
  const metric = chooseMetric(article, 'mlb');
  const key = metric?.[0] || (pitcher ? 'strikeOuts' : 'hits');
  const label = metric?.[1] || (pitcher ? 'Strikeouts' : 'Hits');
  const rows = [...games].reverse().slice(0, 8).map((g) => ({
    date: g.date || g.game?.gameDate || '',
    opponent: g.opponent?.name || g.opponent?.abbreviation || '',
    value: toNumber(g.stat?.[key]),
  })).filter((x) => x.value != null);
  const seasonStats = pitcher
    ? [
        ['ERA', seasonRow?.era], ['WHIP', seasonRow?.whip], ['K', seasonRow?.strikeOuts],
        ['IP', seasonRow?.inningsPitched],
      ]
    : [
        ['AVG', seasonRow?.avg], ['HR', seasonRow?.homeRuns], ['RBI', seasonRow?.rbi], ['OPS', seasonRow?.ops],
      ];
  return { name: person.fullName || player.name, image: player.image_url, label, rows, seasonStats };
}

function firstUsableCategory(categories, preferred) {
  return categories.find((c) => c.key === preferred && c.rows?.length) || categories.find((c) => c.rows?.length) || null;
}

async function espnContext(player, article, sport) {
  const season = currentSeason(sport);
  const [statsPayload, logPayload] = await Promise.all([
    fetchJson(`/api/player-data?sport=${sport}&id=${encodeURIComponent(player.id)}&kind=stats&type=2`).then((x) => x.data),
    fetchJson(`/api/player-data?sport=${sport}&id=${encodeURIComponent(player.id)}&kind=gamelog&type=2&season=${encodeURIComponent(season)}`).then((x) => x.data).catch(() => null),
  ]);
  const categories = espnCategories(statsPayload, '2');
  const metric = chooseMetric(article, sport);
  const preferred = sport === 'nfl'
    ? ((article?.take?.prop_types || []).some((p) => String(p).startsWith('passing_')) ? 'passing'
      : (article?.take?.prop_types || []).some((p) => String(p).startsWith('rushing_')) ? 'rushing'
      : 'receiving')
    : 'averages';
  const cat = firstUsableCategory(categories, preferred);
  const seasonRow = cat?.rows?.[0] || null;
  const log = logPayload ? espnGameLog(logPayload, season, '2') : { rows: [] };
  const key = metric?.[0] || (sport === 'nba' ? 'points' : 'receivingYards');
  const label = metric?.[1] || (sport === 'nba' ? 'Points' : 'Receiving Yards');
  const rows = (log.rows || []).slice(0, 8).reverse().map((g) => ({
    date: g.date,
    opponent: g.opponent,
    value: toNumber(g.values?.[key]),
  })).filter((x) => x.value != null);

  const preferredKeys = sport === 'nba'
    ? ['avgPoints', 'avgRebounds', 'avgAssists', 'threePointFieldGoalPct']
    : cat?.key === 'passing' ? ['passingYards', 'passingTouchdowns', 'interceptions', 'completionPct']
      : cat?.key === 'rushing' ? ['rushingYards', 'rushingTouchdowns', 'yardsPerRushAttempt', 'rushingAttempts']
        : ['receptions', 'receivingYards', 'receivingTouchdowns', 'receivingTargets'];
  const seasonStats = preferredKeys.map((keyName) => {
    const idx = cat?.names?.indexOf(keyName);
    return idx >= 0 ? [cat.labels?.[idx] || keyName, seasonRow?.values?.[keyName]] : null;
  }).filter(Boolean).slice(0, 4);

  return { name: player.name, image: player.image_url, label, rows, seasonStats };
}

async function nhlContext(player, article) {
  const season = currentSeason('nhl');
  const [bio, logPayload] = await Promise.all([
    fetchJson(`/api/player-data?sport=nhl&id=${encodeURIComponent(player.id)}&kind=bio`).then((x) => x.data),
    fetchJson(`/api/player-data?sport=nhl&id=${encodeURIComponent(player.id)}&kind=gamelog&type=2&season=${encodeURIComponent(season)}`).then((x) => x.data).catch(() => null),
  ]);
  const cat = nhlCategories(bio, '2')[0];
  const seasonRow = cat?.rows?.[0] || null;
  const metric = chooseMetric(article, 'nhl');
  const key = metric?.[0] || (bio?.position === 'G' ? 'saves' : 'shots');
  const label = metric?.[1] || (bio?.position === 'G' ? 'Saves' : 'Shots on Goal');
  const log = logPayload ? nhlGameLog(logPayload, season, '2', bio?.position === 'G') : { rows: [] };
  const rows = (log.rows || []).slice(0, 8).reverse().map((g) => ({
    date: g.date,
    opponent: g.opponent,
    value: toNumber(g.values?.[key]),
  })).filter((x) => x.value != null);
  const preferred = bio?.position === 'G'
    ? ['savePctg', 'goalsAgainstAvg', 'wins', 'shutouts']
    : ['goals', 'assists', 'points', 'shots'];
  const seasonStats = preferred.map((keyName) => {
    const idx = cat?.names?.indexOf(keyName);
    return idx >= 0 ? [cat.labels?.[idx] || keyName, seasonRow?.values?.[keyName]] : null;
  }).filter(Boolean).slice(0, 4);
  return { name: player.name, image: player.image_url, label, rows, seasonStats };
}

async function playerContext(player, article) {
  const sport = String(article?.sport || '').toLowerCase();
  if (!player?.id) return null;
  if (sport === 'mlb') return mlbContext(player, article);
  if (sport === 'nfl' || sport === 'nba') return espnContext(player, article, sport);
  if (sport === 'nhl') return nhlContext(player, article);
  return null;
}

function compactDate(value) {
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
}

function renderPlayerContext(data) {
  if (!data) return '';
  const rows = (data.rows || []).filter((r) => r.value != null);
  const stats = (data.seasonStats || []).filter((x) => x?.[1] != null && x?.[1] !== '');
  if (!rows.length && !stats.length) return '';

  const max = Math.max(1, ...rows.map((r) => Number(r.value) || 0));
  const avg = rows.length ? rows.reduce((s, r) => s + Number(r.value || 0), 0) / rows.length : null;

  return `<div class="pbe-av-player-card">
    <div class="pbe-av-player-head">
      <div class="pbe-av-player-id">
        ${data.image ? `<img src="${esc(data.image)}" alt="" loading="lazy" />` : ''}
        <div><span>CURRENT PLAYER CONTEXT</span><h3>${esc(data.name)}</h3></div>
      </div>
      ${avg != null ? `<div class="pbe-av-recent-avg"><strong>${esc(avg.toFixed(avg >= 10 ? 1 : 2).replace(/\.00$/, '').replace(/\.0$/, ''))}</strong><span>RECENT AVG · ${esc(data.label)}</span></div>` : ''}
    </div>
    ${stats.length ? `<div class="pbe-av-season-stats">${stats.map(([label, value]) => `<div><strong>${esc(value)}</strong><span>${esc(label)}</span></div>`).join('')}</div>` : ''}
    ${rows.length ? `<div class="pbe-av-form">
      <div class="pbe-av-form-head"><b>Recent form · ${esc(data.label)}</b><span>${rows.length} verified games</span></div>
      <div class="pbe-av-bars">
        ${rows.map((row) => {
          const h = Math.max(7, Math.min(100, Number(row.value) / max * 100));
          return `<div class="pbe-av-bar-col" title="${esc(compactDate(row.date))} ${esc(row.opponent)} · ${esc(row.value)} ${esc(data.label)}">
            <span class="pbe-av-bar-value">${esc(row.value)}</span>
            <div class="pbe-av-bar-track"><i style="height:${h.toFixed(1)}%"></i></div>
            <small>${esc(compactDate(row.date))}</small>
          </div>`;
        }).join('')}
      </div>
    </div>` : ''}
    <div class="pbe-av-context-note">Current season/recent-form context is separate from the frozen article record and may update after publication.</div>
  </div>`;
}

export async function mountArticleVisuals(article, manifest) {
  const root = document.querySelector('[data-pbe-article-visuals]');
  const slot = root?.querySelector('[data-pbe-player-chart]');
  const player = manifest?.players?.[0];
  if (!root || !slot || !player) return;
  try {
    const data = await playerContext(player, article);
    const html = renderPlayerContext(data);
    if (html) slot.innerHTML = html;
    else slot.remove();
  } catch {
    slot.remove();
  }
}
