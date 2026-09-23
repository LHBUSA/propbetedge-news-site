/**
 * PropBetEdge article visual intelligence — v2.
 *
 * Editorial rule: the module can re-present facts, never manufacture them.
 * Static story visuals are deterministic from the frozen article + entity graph.
 * Live form is a separate, labeled layer from first-party/league data adapters.
 */

import {
  espnCategories,
  espnGameLog,
  nhlCategories,
  nhlGameLog,
  number as toNumber,
} from './pages/player-history-core.js';

const PROP_LABELS = {
  k_prop: 'Strikeouts',
  hr: 'Home Runs',
  altprop_hits: 'Hits',
  altprop_total_bases: 'Total Bases',
  altprop_doubles: 'Doubles',
  altprop_rbi: 'RBI',
  altprop_runs: 'Runs',
  altprop_walks: 'Walks',
  stolen_bases: 'Stolen Bases',
  team_total: 'Team Total',
  spread: 'Spread',
  moneyline: 'Moneyline',
  first_5_innings: 'First 5',
  nrfi: 'NRFI',
  passing_yards: 'Passing Yards',
  passing_tds: 'Passing TDs',
  rushing_yards: 'Rushing Yards',
  rushing_tds: 'Rushing TDs',
  receiving_yards: 'Receiving Yards',
  receptions: 'Receptions',
  receiving_tds: 'Receiving TDs',
  anytime_td: 'Anytime TD',
  sacks: 'Sacks',
  points: 'Points',
  rebounds: 'Rebounds',
  assists: 'Assists',
  threes_made: '3PM',
  pra: 'PRA',
  shots_on_goal: 'Shots on Goal',
  goals: 'Goals',
  saves: 'Saves',
};

const STORY_LABELS = {
  availability: {
    kicker: 'PBE DATA INTELLIGENCE',
    title: 'Here’s the data.',
    sub: 'Availability, role redistribution, and the markets connected to the change.',
  },
  transaction: {
    kicker: 'PBE DATA INTELLIGENCE',
    title: 'Here’s the data.',
    sub: 'The personnel move, the depth-chart response, and the markets attached to it.',
  },
  trend: {
    kicker: 'PBE DATA INTELLIGENCE',
    title: 'Here’s the data.',
    sub: 'The strongest numbers behind the trend, with the surrounding context kept visible.',
  },
  recap: {
    kicker: 'PBE DATA INTELLIGENCE',
    title: 'Here’s the data.',
    sub: 'The numbers that shaped the result and the signals worth carrying forward.',
  },
  preview: {
    kicker: 'PBE DATA INTELLIGENCE',
    title: 'Here’s the data.',
    sub: 'The matchup numbers, player context, and markets most connected to the game.',
  },
  analysis: {
    kicker: 'PBE DATA INTELLIGENCE',
    title: 'Here’s the data.',
    sub: 'Published facts first, with verified current context only where the data supports it.',
  },
};

const METRIC_PATTERNS = {
  mlb: [
    ['CAREER K', /((?:\d{1,3}(?:,\d{3})+|\d+))(?:st|nd|rd|th)?\s+(?:career\s+)?strikeouts?\b/i],
    ['ERA', /((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s+ERA\b/i],
    ['K/9', /strikeout rate[^.!?]{0,40}?((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s+per nine\b/i],
    ['K/9', /(?:fanned|struck out)[^.!?]{0,40}?((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s+per nine\b/i],
    ['OPP K%', /strike out at\s+((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)%\s+clip\b/i],
    ['VELOCITY', /((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s*mph\b/i],
    ['K', /((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s+(?:strikeouts?|Ks?)\b/i],
    ['IP', /((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s+innings?(?: pitched)?\b/i],
    ['HR', /((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s+(?:home runs?|HRs?)\b/i],
    ['H', /((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s+hits?\b/i],
    ['RBI', /((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s+RBIs?\b/i],
    ['TB', /((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s+total bases?\b/i],
    ['OPS', /(?:OPS(?:\s+(?:of|at|was|is))?\s*)(\d?\.\d{3})\b/i],
    ['ERA', /(?:ERA(?:\s+(?:of|at|was|is))?\s*)((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\b/i],
  ],
  nfl: [
    ['SNAP SHARE', /snap share(?:\s+\w+){0,4}\s+(?:at|of)\s+((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)%/i],
    ['SNAPS', /((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s+snaps?\b/i],
    ['PRESSURES', /((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s+pressures?\b/i],
    ['HURRIES', /((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s+hurries\b/i],
    ['QB HIT', /((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s+quarterback hits?\b/i],
    ['SACKS', /((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s+sacks?\b/i],
    ['PASS YDS', /((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s+passing yards?\b/i],
    ['RUSH YDS', /((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s+rushing yards?\b/i],
    ['REC YDS', /(-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s+(?:receiving )?yards?\b/i],
    ['REC', /((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s+receptions?\b/i],
    ['TGT', /((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s+targets?\b/i],
    ['TD', /((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s+(?:touchdowns?|TDs?)\b/i],
  ],
  nba: [
    ['MIN', /((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s+minutes?\b/i],
    ['PTS', /((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s+points?\b/i],
    ['REB', /((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s+rebounds?\b/i],
    ['AST', /((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s+assists?\b/i],
    ['3PM', /((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s+(?:three-pointers?|3-pointers?|threes?)\b/i],
    ['USAGE', /(?:usage(?: rate)?(?:\s+(?:of|at|was|is))?\s*)((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)%/i],
    ['FG%', /(?:field[- ]goal(?: percentage| pct)?(?:\s+(?:of|at|was|is))?\s*)((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)%/i],
  ],
  nhl: [
    ['TOI', /((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s+minutes?(?: of ice time| TOI)?\b/i],
    ['SOG', /((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s+shots?(?: on goal)?\b/i],
    ['G', /((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s+goals?\b/i],
    ['A', /((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s+assists?\b/i],
    ['PTS', /((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s+points?\b/i],
    ['SV', /((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s+saves?\b/i],
    ['SV%', /(?:save percentage|SV%)(?:\s+(?:of|at|was|is))?\s*(\.\d{3})\b/i],
  ],
};

const RECENT_METRIC = {
  mlb: {
    k_prop: ['strikeOuts', 'Strikeouts'],
    hr: ['homeRuns', 'Home Runs'],
    altprop_hits: ['hits', 'Hits'],
    altprop_total_bases: ['totalBases', 'Total Bases'],
    stolen_bases: ['stolenBases', 'Stolen Bases'],
  },
  nfl: {
    passing_yards: ['passingYards', 'Passing Yards'],
    passing_tds: ['passingTouchdowns', 'Passing TDs'],
    rushing_yards: ['rushingYards', 'Rushing Yards'],
    rushing_tds: ['rushingTouchdowns', 'Rushing TDs'],
    receiving_yards: ['receivingYards', 'Receiving Yards'],
    receptions: ['receptions', 'Receptions'],
    receiving_tds: ['receivingTouchdowns', 'Receiving TDs'],
  },
  nba: {
    points: ['points', 'Points'],
    rebounds: ['rebounds', 'Rebounds'],
    assists: ['assists', 'Assists'],
    threes_made: ['threePointFieldGoalsMade', '3PM'],
  },
  nhl: {
    shots_on_goal: ['shots', 'Shots on Goal'],
    goals: ['goals', 'Goals'],
    saves: ['saves', 'Saves'],
    points: ['points', 'Points'],
  },
};

const FALLBACK_METRIC = {
  mlb: ['hits', 'Hits'],
  nfl: ['receivingYards', 'Receiving Yards'],
  nba: ['points', 'Points'],
  nhl: ['shots', 'Shots on Goal'],
};

const STATUS_RULES = [
  { kind: 'out', label: 'OUT / IR', re: /(?:placed|lands?|heads?|moved)\s+(?:on|to)\s+(?:injured reserve|IR)|\b(?:ruled|deemed)\s+out\b|\bwon't return\b|\bwill miss\b|\bsidelined\b|season-ending/i },
  { kind: 'limited', label: 'LIMITED', re: /week-to-week|day-to-day|questionable|doubtful|limited participant|unclear status|return timeline/i },
  { kind: 'return', label: 'RETURNING', re: /activated|return(?:ing)? from|cleared to|back from|set to return/i },
  { kind: 'role', label: 'ROLE UP', re: /promoted|elevated|expanded duty|larger role|more snaps|absorb|shoulder(?:ing)?|will now fall to|behind (?:him|her|them) are|fill the roster gaps/i },
  { kind: 'added', label: 'ADDED', re: /signed|acquired|claimed|traded for|added to the roster|practice squad/i },
];

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

function strip(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function articleText(article) {
  return strip(article?.body_html || article?.body || article?.summary || '');
}

function fullStoryText(article) {
  return [article?.title, article?.summary, articleText(article)].filter(Boolean).join(' ');
}

function detectStoryType(article) {
  const text = fullStoryText(article);
  if (/injur|injured reserve|\bIR\b|ruled out|season-ending|week-to-week|day-to-day|surgery|sidelined/i.test(text)) return 'availability';
  if (/\btrade(?:d)?\b|\bsign(?:ed|ing)?\b|waiv|claim(?:ed)?|promot(?:ed|ion)|practice squad|acquir(?:ed|es)|extension|release(?:d)?/i.test(text)) return 'transaction';
  if (/last\s+\d+|streak|\bover\b|\bunder\b|trend|average|rate|percentage|\bpct\b|\d+(?:\.\d+)?%/i.test(text)) return 'trend';
  if (/\bfinal\b|\bwin\b|\bloss\b|beat(?:s|en)?|defeat(?:s|ed)?|overtime|\bOT\b|recap/i.test(text)) return 'recap';
  if (/\bvs\.?\b|against|matchup|preview|tonight|week\s+\d+/i.test(text)) return 'preview';
  return 'analysis';
}

function sentenceAround(text, index, max = 128) {
  const left = Math.max(text.lastIndexOf('. ', index), text.lastIndexOf('! ', index), text.lastIndexOf('? ', index));
  const rest = text.slice(index);
  const ends = ['. ', '! ', '? '].map((x) => rest.indexOf(x)).filter((x) => x >= 0);
  const right = ends.length ? index + Math.min(...ends) + 1 : Math.min(text.length, index + max + 40);
  const value = text.slice(left >= 0 ? left + 2 : Math.max(0, index - 70), right).trim();
  return value.length > max ? value.slice(0, max - 1).trim() + '…' : value;
}

const PERCENT_EVIDENCE_LABELS = new Set(['SNAP SHARE', 'USAGE', 'FG%', 'OPP K%']);

function evidenceNumber(raw) {
  const normalized = String(raw || '').replace(/,/g, '');
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function formatEvidenceValue(label, raw) {
  const numeric = evidenceNumber(raw);
  if (numeric == null) return String(raw || '');
  if (PERCENT_EVIDENCE_LABELS.has(label)) return `${numeric}%`;
  if (Number.isInteger(numeric) && Math.abs(numeric) >= 1000) return numeric.toLocaleString('en-US');
  if (/^\.\d+/.test(String(raw || ''))) return String(raw);
  return String(numeric);
}

function evidenceContextIsSpeculative(context) {
  const text = String(context || '');
  if (/\b(?:typically|expected?|project(?:ed|ion)?|forecast|estimated?|likely)\b/i.test(text)) return true;
  if (/\b(?:could|may|might|would|should)\b/i.test(text) && /\b(?:line|market|price|prop|range|threshold)\b/i.test(text)) return true;
  if (/\d+(?:\.\d+)?\s*(?:to|[-–—])\s*\d+(?:\.\d+)?\s+(?:strikeouts?|points?|yards?|rebounds?|assists?|saves?|shots?)/i.test(text)) return true;
  return false;
}

function keyNumbers(article) {
  const sport = String(article?.sport || '').toLowerCase();
  const patterns = METRIC_PATTERNS[sport] || [];
  const text = articleText(article);
  if (!text) return [];

  const found = [];
  const seenLabels = new Set();

  for (const [label, re] of patterns) {
    if (seenLabels.has(label)) continue;
    const flags = re.flags.includes('g') ? re.flags : re.flags + 'g';
    const global = new RegExp(re.source, flags);
    let match;

    while ((match = global.exec(text)) && found.length < 12) {
      const raw = match[1];
      const numeric = evidenceNumber(raw);
      const context = sentenceAround(text, match.index, 180);

      if (evidenceContextIsSpeculative(context)) continue;
      if (label === 'K' && numeric != null && numeric > 30) continue;

      found.push({
        label,
        value: formatEvidenceValue(label, raw),
        context,
      });
      seenLabels.add(label);
      break;
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
  const pct = Math.max(0, Math.min(100, (score / 5) * 100));
  return `<div class="pbe-av-impact" aria-label="Story impact ${esc(score)} out of 5">
    <div class="pbe-av-impact-dial" style="--impact:${pct.toFixed(1)}%">
      <span><strong>${esc(score)}</strong><b>/5</b></span>
    </div>
    <div class="pbe-av-impact-copy"><span>STORY IMPACT</span><small>PropBetEdge signal</small></div>
  </div>`;
}

function contextForName(text, name) {
  if (!name) return '';
  const lower = text.toLowerCase();
  const needle = String(name).toLowerCase();
  let idx = lower.indexOf(needle);
  if (idx < 0) {
    const last = needle.split(/\s+/).pop();
    idx = last?.length > 3 ? lower.indexOf(last) : -1;
  }
  if (idx < 0) return '';
  const start = Math.max(0, idx - 165);
  const end = Math.min(text.length, idx + needle.length + 230);
  return text.slice(start, end);
}

function classifyPlayers(article, manifest) {
  const text = fullStoryText(article);
  const out = [];
  for (const player of manifest?.players || []) {
    const context = contextForName(text, player.name);
    if (!context) continue;
    const rule = STATUS_RULES.find((candidate) => candidate.re.test(context));
    if (!rule) continue;
    out.push({
      player,
      kind: rule.kind,
      label: rule.label,
      context: sentenceAround(text, Math.max(0, text.toLowerCase().indexOf(String(player.name || '').toLowerCase())), 105),
    });
  }

  const priority = { out: 0, limited: 1, return: 2, role: 3, added: 4 };
  return out.sort((a, b) => (priority[a.kind] ?? 9) - (priority[b.kind] ?? 9));
}

function playerChip(row) {
  const p = row.player;
  const cls = `is-${row.kind}`;
  return `<a class="pbe-av-person ${cls}" href="${esc(p.path || '#')}">
    <div class="pbe-av-person-photo">
      ${p.image_url ? `<img src="${esc(p.image_url)}" alt="" loading="lazy" />` : '<span>•</span>'}
      <i></i>
    </div>
    <div class="pbe-av-person-copy">
      <span>${esc(row.label)}</span>
      <b>${esc(p.name)}</b>
      ${p.position ? `<small>${esc(p.position)}</small>` : ''}
    </div>
  </a>`;
}

function marketWatch(article) {
  const props = [...new Set((article?.take?.prop_types || []).map((x) => String(x || '').trim()).filter(Boolean))].slice(0, 4);
  if (!props.length) return '';
  return `<aside class="pbe-av-market-watch">
    <div class="pbe-av-minihead"><span>MARKET WATCH</span><small>Tagged by the story analysis</small></div>
    <div class="pbe-av-market-list">
      ${props.map((prop, idx) => `<div class="pbe-av-market-row">
        <span>${String(idx + 1).padStart(2, '0')}</span>
        <b>${esc(PROP_LABELS[prop] || prop.replace(/_/g, ' '))}</b>
        <i>→</i>
      </div>`).join('')}
    </div>
  </aside>`;
}

function renderRosterMap(article, manifest, statuses) {
  if (!statuses.length) return '';

  const affected = statuses.filter((x) => ['out', 'limited'].includes(x.kind)).slice(0, 4);
  const roleUp = statuses.filter((x) => ['role', 'added', 'return'].includes(x.kind)).slice(0, 4);
  const team = manifest?.teams?.[0];

  return `<div class="pbe-av-ripple-grid">
    <div class="pbe-av-ripple">
      <div class="pbe-av-ripple-head">
        <div class="pbe-av-team-lockup">
          ${team?.logo_url ? `<img src="${esc(team.logo_url)}" alt="" loading="lazy" />` : ''}
          <div><span>ROSTER RIPPLE</span><b>${esc(team?.name || article?.sport?.toUpperCase() || 'Team impact')}</b></div>
        </div>
        <small>Availability → role redistribution</small>
      </div>
      <div class="pbe-av-ripple-body">
        <div class="pbe-av-ripple-side is-loss">
          <div class="pbe-av-ripple-label"><i></i><span>AVAILABILITY HIT</span></div>
          <div class="pbe-av-people">
            ${affected.length ? affected.map(playerChip).join('') : '<div class="pbe-av-empty">No explicit unavailable player resolved.</div>'}
          </div>
        </div>
        <div class="pbe-av-ripple-arrow" aria-hidden="true"><span>→</span></div>
        <div class="pbe-av-ripple-side is-gain">
          <div class="pbe-av-ripple-label"><i></i><span>ROLE SHIFT</span></div>
          <div class="pbe-av-people">
            ${roleUp.length ? roleUp.map(playerChip).join('') : '<div class="pbe-av-empty">Role redistribution is described in the article text.</div>'}
          </div>
        </div>
      </div>
    </div>
    ${marketWatch(article)}
  </div>`;
}

function renderSignalGrid(article, manifest) {
  const props = [...new Set((article?.take?.prop_types || []).map((x) => String(x || '').trim()).filter(Boolean))].slice(0, 4);
  const players = (manifest?.players || []).slice(0, 3);
  const team = manifest?.teams?.[0];
  if (!props.length && !players.length && !team) return '';

  return `<div class="pbe-av-signal-grid">
    ${team ? `<a href="${esc(team.path || '#')}" class="pbe-av-team-feature">
      <span>TEAM CONTEXT</span>
      <div>${team.logo_url ? `<img src="${esc(team.logo_url)}" alt="" loading="lazy" />` : ''}<b>${esc(team.name)}</b></div>
      <small>Open team hub →</small>
    </a>` : ''}
    ${players.length ? `<div class="pbe-av-focus">
      <div class="pbe-av-minihead"><span>PEOPLE IN FOCUS</span><small>Resolved from this story</small></div>
      <div class="pbe-av-focus-row">
        ${players.map((p) => `<a href="${esc(p.path || '#')}" title="${esc(p.name)}">
          ${p.image_url ? `<img src="${esc(p.image_url)}" alt="" loading="lazy" />` : ''}
          <b>${esc(p.name)}</b>
          ${p.position ? `<small>${esc(p.position)}</small>` : ''}
        </a>`).join('')}
      </div>
    </div>` : ''}
    ${props.length ? marketWatch(article) : ''}
  </div>`;
}

function renderKeyNumbers(article) {
  const rows = keyNumbers(article);
  if (!rows.length) return '';

  return `<div class="pbe-av-evidence">
    <div class="pbe-av-minihead"><span>STORY EVIDENCE</span><small>Numbers stated in the published article</small></div>
    <div class="pbe-av-evidence-grid">
      ${rows.map((row, idx) => `<div class="pbe-av-evidence-card">
        <span class="pbe-av-evidence-index">${String(idx + 1).padStart(2, '0')}</span>
        <div><strong>${esc(row.value)}</strong><b>${esc(row.label)}</b></div>
        <p>${esc(row.context)}</p>
      </div>`).join('')}
    </div>
  </div>`;
}

function archetypeShell(article, manifest, type) {
  const labels = STORY_LABELS[type] || STORY_LABELS.analysis;
  const statuses = classifyPlayers(article, manifest);
  const roster = (type === 'availability' || type === 'transaction') ? renderRosterMap(article, manifest, statuses) : '';
  const signal = roster ? '' : renderSignalGrid(article, manifest);

  return {
    labels,
    statuses,
    inner: `
      <div class="pbe-av-stage" aria-hidden="true"></div>
      <header class="pbe-av-head">
        <div class="pbe-av-title">
          <span class="pbe-av-kicker">${esc(labels.kicker)}</span>
          <h2>${esc(labels.title)}</h2>
          <p>${esc(labels.sub)}</p>
        </div>
        ${impactVisual(impactScore(article))}
      </header>
      ${renderKeyNumbers(article)}
      ${roster}
      ${signal}
    `,
  };
}

function chartPlayerFor(article, manifest, statuses, type) {
  const players = manifest?.players || [];
  if (!players.length) return null;
  const sport = String(article?.sport || '').toLowerCase();
  const props = article?.take?.prop_types || [];

  if (sport === 'nfl') {
    const skill = (p) => ['QB', 'RB', 'FB', 'WR', 'TE'].includes(String(p.position || '').toUpperCase());
    if (type === 'availability') {
      const affectedIds = new Set(statuses.filter((x) => ['out', 'limited'].includes(x.kind)).map((x) => x.player.id));
      const hit = players.find((p) => affectedIds.has(p.id) && skill(p));
      if (hit) return hit;
    }
    if (props.some((p) => String(p).startsWith('passing_'))) {
      const qb = players.find((p) => String(p.position || '').toUpperCase() === 'QB');
      if (qb) return qb;
    }
    if (props.some((p) => String(p).startsWith('receiving_') || p === 'receptions')) {
      const receiver = players.find((p) => ['WR', 'TE', 'RB'].includes(String(p.position || '').toUpperCase()));
      if (receiver) return receiver;
    }
    if (props.some((p) => String(p).startsWith('rushing_'))) {
      const runner = players.find((p) => ['RB', 'QB'].includes(String(p.position || '').toUpperCase()));
      if (runner) return runner;
    }
    return players.find(skill) || null;
  }

  if (type === 'availability') {
    const affectedIds = new Set(statuses.filter((x) => ['out', 'limited'].includes(x.kind)).map((x) => x.player.id));
    const hit = players.find((p) => affectedIds.has(p.id));
    if (hit) return hit;
  }

  return players[0] || null;
}

export function renderArticleVisuals(article, manifest) {
  const score = impactScore(article);
  const nums = keyNumbers(article);
  const type = detectStoryType(article);
  const shell = archetypeShell(article, manifest, type);
  const selectedPlayer = chartPlayerFor(article, manifest, shell.statuses, type);
  const hasStatic = score != null || nums.length || shell.statuses.length
    || (article?.take?.prop_types || []).length
    || (manifest?.players || []).length
    || (manifest?.teams || []).length;

  if (!hasStatic && !selectedPlayer) return '';

  const id = `pbe-av-${String(article?.id || article?.slug || 'story').replace(/[^a-z0-9_-]/gi, '')}`;
  return `<section
    class="pbe-article-visuals"
    id="${esc(id)}"
    data-pbe-article-visuals
    data-sport="${esc(String(article?.sport || '').toLowerCase())}"
    data-archetype="${esc(type)}"
    data-player-id="${esc(selectedPlayer?.id || '')}"
    aria-label="PropBetEdge story intelligence"
  >
    ${shell.inner}
    ${selectedPlayer ? `<div class="pbe-av-player" data-pbe-player-chart><div class="pbe-av-loading"><span></span><span></span><span></span></div></div>` : ''}
    <div class="pbe-av-source-note">
      <span></span>
      Article facts are frozen to publication. Current-form charts are verified live context and may update.
    </div>
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
    ? [['ERA', seasonRow?.era], ['WHIP', seasonRow?.whip], ['K', seasonRow?.strikeOuts], ['IP', seasonRow?.inningsPitched]]
    : [['AVG', seasonRow?.avg], ['HR', seasonRow?.homeRuns], ['RBI', seasonRow?.rbi], ['OPS', seasonRow?.ops]];

  return { name: person.fullName || player.name, image: player.image_url, label, rows, seasonStats };
}

function firstUsableCategory(categories, preferred) {
  return categories.find((c) => c.key === preferred && c.rows?.length)
    || categories.find((c) => c.rows?.length)
    || null;
}

async function espnContext(player, article, sport) {
  const season = currentSeason(sport);
  const [statsPayload, logPayload] = await Promise.all([
    fetchJson(`/api/player-data?sport=${sport}&id=${encodeURIComponent(player.id)}&kind=stats&type=2`).then((x) => x.data),
    fetchJson(`/api/player-data?sport=${sport}&id=${encodeURIComponent(player.id)}&kind=gamelog&type=2&season=${encodeURIComponent(season)}`)
      .then((x) => x.data)
      .catch(() => null),
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
    : cat?.key === 'passing'
      ? ['passingYards', 'passingTouchdowns', 'interceptions', 'completionPct']
      : cat?.key === 'rushing'
        ? ['rushingYards', 'rushingTouchdowns', 'yardsPerRushAttempt', 'rushingAttempts']
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
    fetchJson(`/api/player-data?sport=nhl&id=${encodeURIComponent(player.id)}&kind=gamelog&type=2&season=${encodeURIComponent(season)}`)
      .then((x) => x.data)
      .catch(() => null),
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
  return Number.isFinite(d.getTime())
    ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '';
}

function renderPlayerContext(data) {
  if (!data) return '';
  const rows = (data.rows || []).filter((r) => r.value != null);
  const stats = (data.seasonStats || []).filter((x) => x?.[1] != null && x?.[1] !== '');
  if (!rows.length && !stats.length) return '';

  const max = Math.max(1, ...rows.map((r) => Number(r.value) || 0));
  const avg = rows.length
    ? rows.reduce((sum, row) => sum + Number(row.value || 0), 0) / rows.length
    : null;

  return `<div class="pbe-av-player-card">
    <header class="pbe-av-player-head">
      <div class="pbe-av-player-id">
        ${data.image ? `<img src="${esc(data.image)}" alt="" loading="lazy" />` : ''}
        <div>
          <span>VERIFIED CURRENT FORM</span>
          <h3>${esc(data.name)}</h3>
          <small>Live context · separate from the frozen article record</small>
        </div>
      </div>
      ${avg != null ? `<div class="pbe-av-recent-avg">
        <strong>${esc(avg.toFixed(avg >= 10 ? 1 : 2).replace(/\.00$/, '').replace(/\.0$/, ''))}</strong>
        <span>LAST ${rows.length} AVG</span>
        <small>${esc(data.label)}</small>
      </div>` : ''}
    </header>

    ${stats.length ? `<div class="pbe-av-season-stats">
      ${stats.map(([label, value]) => `<div><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('')}
    </div>` : ''}

    ${rows.length ? `<div class="pbe-av-form">
      <div class="pbe-av-form-head">
        <div><span>RECENT FORM</span><b>${esc(data.label)}</b></div>
        <small>${rows.length} verified games</small>
      </div>
      <div class="pbe-av-bars">
        ${rows.map((row) => {
          const height = Math.max(7, Math.min(100, Number(row.value) / max * 100));
          return `<div class="pbe-av-bar-col" title="${esc(compactDate(row.date))} ${esc(row.opponent)} · ${esc(row.value)} ${esc(data.label)}">
            <span class="pbe-av-bar-value">${esc(row.value)}</span>
            <div class="pbe-av-bar-track"><i style="height:${height.toFixed(1)}%"></i></div>
            <small>${esc(compactDate(row.date))}</small>
          </div>`;
        }).join('')}
      </div>
    </div>` : ''}
  </div>`;
}

export async function mountArticleVisuals(article, manifest) {
  const root = document.querySelector('[data-pbe-article-visuals]');
  const slot = root?.querySelector('[data-pbe-player-chart]');
  const selectedId = root?.getAttribute('data-player-id');
  const player = (manifest?.players || []).find((p) => String(p.id) === String(selectedId));
  if (!root || !slot || !player) {
    slot?.remove();
    return;
  }

  try {
    const data = await playerContext(player, article);
    const html = renderPlayerContext(data);
    if (html) slot.innerHTML = html;
    else slot.remove();
  } catch {
    slot.remove();
  }
}
