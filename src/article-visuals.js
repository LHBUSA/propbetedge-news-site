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
  passing_completions: 'Passing Completions',
  passing_attempts: 'Passing Attempts',
  completion_pct: 'Completion %',
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
    ['CAREER K', /((?:\d{1,3}(?:,\d{3})+|\d+))(?:st|nd|rd|th)?\s+career\s+strikeouts?\b/i],
    ['ERA', /((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s+ERA\b/i],
    ['K/9', /strikeout rate[^.!?]{0,40}?((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s+per nine\b/i],
    ['K/9', /(?:fanned|struck out)[^.!?]{0,40}?((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s+per nine\b/i],
    ['OPP K%', /strike out at\s+(?:a\s+)?((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)%\s+clip\b/i],
    ['VELOCITY', /((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s*mph\b/i],
    ['K', /\bstruck out\s+((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\b/i],
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
    ['PASS YDS', /(?:\b(?:threw|passed|passing)\b[^.!?]{0,90}?)?((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s+passing yards?\b/i],
    ['PASS YDS', /\b(?:threw|passed)\b[^.!?]{0,90}?((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s+yards?\b/i],
    ['RUSH YDS', /((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s+rushing yards?\b/i],
    ['RUSH YDS', /\b(?:rushed|rushing|carried|carries|carry)\b[^.!?]{0,110}?((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s+yards?\b/i],
    ['REC YDS', /((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s+receiving yards?\b/i],
    ['REC YDS', /\b(?:caught|catch|catches|receptions?|receiving)\b[^.!?]{0,110}?((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s+yards?\b/i],
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
    passing_completions: ['completions', 'Completions'],
    passing_attempts: ['passingAttempts', 'Passing Attempts'],
    completion_pct: ['completionPct', 'Completion %'],
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
  nba: ['points', 'Points'],
  nhl: ['shots', 'Shots on Goal'],
};

const NFL_PROP_GROUPS = {
  passing: new Set(['passing_yards', 'passing_tds', 'passing_completions', 'passing_attempts', 'completion_pct']),
  rushing: new Set(['rushing_yards', 'rushing_tds']),
  receiving: new Set(['receiving_yards', 'receptions', 'receiving_tds']),
};

function firstNflMetric(props, group) {
  for (const prop of props) {
    if (NFL_PROP_GROUPS[group]?.has(prop) && RECENT_METRIC.nfl[prop]) return RECENT_METRIC.nfl[prop];
  }
  return null;
}

export function nflRecentMetric(article, position) {
  const props = (article?.take?.prop_types || []).map((x) => String(x || '').trim()).filter(Boolean);
  const pos = String(position || '').toUpperCase();
  const subject = [article?.title, article?.summary].filter(Boolean).join(' ');

  const passing = firstNflMetric(props, 'passing');
  const rushing = firstNflMetric(props, 'rushing');
  const receiving = firstNflMetric(props, 'receiving');

  const explicitlyReceiving = /\breceiv(?:e|er|ers|ing)?\b|\breceptions?\b|\btargets?\b|pass[- ]catch/i.test(subject);
  const explicitlyRushing = /\brush(?:ing|es|ed)?\b|\bcarr(?:y|ies)\b|\bground game\b/i.test(subject);

  if (pos === 'QB') {
    if (passing) return passing;
    if (explicitlyRushing && rushing) return rushing;
    return ['passingYards', 'Passing Yards'];
  }

  if (pos === 'RB' || pos === 'FB') {
    // Market tags are intentionally broad. For backs, do not let an incidental
    // receiving prop turn the live-form card into a receiver card. Receiving
    // becomes primary only when the headline/dek is explicitly about that role.
    if (explicitlyReceiving && !explicitlyRushing && receiving) return receiving;
    return rushing || ['rushingYards', 'Rushing Yards'];
  }

  if (pos === 'WR' || pos === 'TE') {
    return receiving || ['receivingYards', 'Receiving Yards'];
  }

  return passing || rushing || receiving || null;
}

const DEPARTURE_RULE = {
  kind: 'departed',
  label: 'DEPARTED',
  re: /\b(?:gone|departed)\s+from\b|\bdepart(?:ed|ure)\b|\bleft\s+(?:for|to)\b|\bsigned\s+with\b|\bjoined\b|\bdealt\s+to\b|\btraded\s+to\b|\bsent\s+to\b|\bmoved\s+to\b|\breleased\s+by\b|\bwaived\s+by\b/i,
};

const TRANSACTION_ACTION_RE = /\b(?:signed|signs|signing|acquired|claimed|traded|trade|waived|released|joined|left|departed|moved|sent)\b/i;

const STATUS_RULES = [
  { kind: 'out', label: 'OUT / IR', re: /(?:placed|lands?|heads?|moved)\s+(?:on|to)\s+(?:injured reserve|IR)|\b(?:ruled|deemed)\s+out\b|\bwon't return\b|\bwill miss\b|\bsidelined\b|season-ending/i },
  { kind: 'limited', label: 'LIMITED', re: /week-to-week|day-to-day|questionable|doubtful|limited participant|unclear status|return timeline|held (?:him|her|them)?\s*out of (?:practice|training)|\bnursing\b[^.!?]{0,45}\binjur|\blimp(?:s|ing|ed)?\b|status[^.!?]{0,45}\buncertain\b/i },
  { kind: 'return', label: 'RETURNING', re: /activated|return(?:ing)? from|cleared to|back from|set to return/i },
  { kind: 'role', label: 'ROLE UP', re: /promoted|elevated|expanded duty|larger role|more snaps|absorb|shoulder(?:ing)?|will now fall to|behind (?:him|her|them) are|fill the roster gaps|redistribut(?:e|ed|ing)[^.!?]{0,55}\btouches?\b|\btouches?\b[^.!?]{0,55}\bshift(?:ing|ed)?\b/i },
  { kind: 'added', label: 'ADDED', re: /\bsigned\b|\bacquired\b|\bclaimed\b|\btraded for\b|\badded to the roster\b|\bpractice squad\b/i },
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
  // Story type must come from the editorial subject, not incidental context.
  // A performance story can mention three injured teammates without becoming
  // an injury story. Headline + dek therefore own availability/transaction
  // classification; the body only helps with analytical story shapes.
  const headline = [article?.title, article?.summary].filter(Boolean).join(' ');
  const text = fullStoryText(article);

  if (/injur|injured reserve|\bIR\b|ruled out|season-ending|week-to-week|day-to-day|surgery|sidelined/i.test(headline)) return 'availability';
  if (/\btrade(?:d)?\b|\bsign(?:ed|ing)?\b|waiv|claim(?:ed)?|promot(?:ed|ion)|practice squad|acquir(?:ed|es)|extension|release(?:d)?/i.test(headline)) return 'transaction';
  if (/\bfinal\b|\bwin\b|\bloss\b|beat(?:s|en)?|defeat(?:s|ed)?|overtime|\bOT\b|recap/i.test(headline)) return 'recap';
  if (/\bvs\.?\b|matchup|preview|tonight|week\s+\d+/i.test(headline)) return 'preview';
  if (/last\s+\d+|streak|trend|average|rate|percentage|\bpct\b|form|on a roll|efficien|volume|trajectory|improv|best season|\d+(?:\.\d+)?%/i.test(headline)) return 'trend';

  if (/last\s+\d+|streak|\bover\b|\bunder\b|trend|average|rate|percentage|\bpct\b|efficien|trajectory|\d+(?:\.\d+)?%/i.test(text)) return 'trend';
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

function evidenceSentenceAround(text, index) {
  const left = Math.max(text.lastIndexOf('. ', index), text.lastIndexOf('! ', index), text.lastIndexOf('? ', index));
  const rest = text.slice(index);
  const ends = ['. ', '! ', '? '].map((x) => rest.indexOf(x)).filter((x) => x >= 0);
  const right = ends.length ? index + Math.min(...ends) + 1 : text.length;

  // Evidence cards are explanatory, so they must never clip a published
  // sentence to fit a visual card. Return the complete sentence containing the
  // metric and let layout height expand naturally. If the source has no later
  // sentence terminator, preserve the remaining source text rather than
  // inventing an ellipsis or silently dropping context.
  return text.slice(left >= 0 ? left + 2 : 0, right).trim();
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

function evidenceContextKey(context) {
  return String(context || '')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

const EVIDENCE_METRIC_PRIORITY = {
  nhl: ['PTS', 'G', 'A', 'SOG', 'TOI', 'SV%', 'SV'],
  nba: ['PTS', 'REB', 'AST', '3PM', 'USAGE', 'FG%', 'MIN'],
  nfl: ['PASS YDS', 'RUSH YDS', 'REC YDS', 'TD', 'REC', 'TGT', 'SNAP SHARE', 'SNAPS', 'SACKS', 'PRESSURES', 'HURRIES', 'QB HIT'],
  mlb: ['ERA', 'K/9', 'K', 'IP', 'HR', 'RBI', 'TB', 'H', 'OPS', 'CAREER K', 'OPP K%', 'VELOCITY'],
};

function editorializeEvidence(rows, sport) {
  const groups = new Map();

  for (const row of rows) {
    const key = evidenceContextKey(row.context);
    if (!key) continue;

    let group = groups.get(key);
    if (!group) {
      group = { context: row.context, metrics: [] };
      groups.set(key, group);
    }

    if (!group.metrics.some((metric) => metric.label === row.label && metric.value === row.value)) {
      group.metrics.push({ label: row.label, value: row.value });
    }
  }

  // One published thought should read as one editorial evidence unit. If a
  // sentence contains a stat line (30 PTS, 5 G, 25 A), keep those numbers
  // together and print the supporting sentence once instead of cloning the
  // same paragraph under three separate cards.
  const priority = EVIDENCE_METRIC_PRIORITY[sport] || [];
  for (const group of groups.values()) {
    group.metrics.sort((a, b) => {
      const ai = priority.indexOf(a.label);
      const bi = priority.indexOf(b.label);
      return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
    });
  }

  return [...groups.values()].slice(0, 4);
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

    while ((match = global.exec(text)) && found.length < 16) {
      const raw = match[1];
      const numeric = evidenceNumber(raw);
      const context = evidenceSentenceAround(text, match.index);

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

  return editorializeEvidence(found, sport);
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

function contextsForName(text, name) {
  if (!name) return [];
  const lower = String(text || '').toLowerCase();
  const full = String(name).toLowerCase();
  const last = full.split(/\s+/).pop();
  const needles = [full, last?.length > 3 ? last : null].filter(Boolean);
  const seen = new Set();
  const contexts = [];

  for (const needle of needles) {
    let from = 0;
    while (from < lower.length) {
      const idx = lower.indexOf(needle, from);
      if (idx < 0) break;
      const sentence = evidenceSentenceAround(text, idx);
      const key = evidenceContextKey(sentence);
      if (sentence && key && !seen.has(key)) {
        seen.add(key);
        contexts.push(sentence);
      }
      from = idx + needle.length;
    }
  }

  const fallback = contextForName(text, name);
  if (!contexts.length && fallback) contexts.push(fallback);
  return contexts;
}


function localContextForName(context, name) {
  const text = String(context || '');
  const lower = text.toLowerCase();
  const needle = String(name || '').toLowerCase();
  let idx = lower.indexOf(needle);
  if (idx < 0) {
    const last = needle.split(/\s+/).pop();
    idx = last?.length > 3 ? lower.indexOf(last) : -1;
  }
  if (idx < 0) return text;

  const leftBreaks = [
    text.lastIndexOf(';', idx),
    text.lastIndexOf('. ', idx),
    text.lastIndexOf('! ', idx),
    text.lastIndexOf('? ', idx),
  ];
  let left = Math.max(...leftBreaks);
  left = left < 0 ? 0 : left + 1;

  const tail = text.slice(idx);
  const candidates = ['; ', '. ', '! ', '? ']
    .map((token) => tail.indexOf(token))
    .filter((pos) => pos >= 0);
  const right = candidates.length ? idx + Math.min(...candidates) + 1 : text.length;

  // Keep the named player's own clause and immediate predicate. This prevents
  // "Jordan Mason remains sidelined ..., and Demond Claiborne remains healthy"
  // from assigning Mason's status to Claiborne.
  let local = text.slice(left, right).trim();
  const namePos = local.toLowerCase().indexOf(needle);
  if (namePos >= 0) {
    const before = local.slice(0, namePos);
    const conjunction = Math.max(before.lastIndexOf(', and '), before.lastIndexOf(', while '), before.lastIndexOf(', but '));
    if (conjunction >= 0) local = local.slice(conjunction + 2).trim();
  }
  return local;
}

function teamAliases(team) {
  return [
    team?.name,
    team?.location,
    team?.nickname,
    team?.abbreviation,
    ...(Array.isArray(team?.aliases) ? team.aliases : []),
  ].map((v) => String(v || '').trim()).filter((v) => v.length >= 2);
}

function teamMentionedInContext(context, team) {
  const text = String(context || '').toLowerCase();
  return teamAliases(team).some((alias) => {
    const normalized = alias.toLowerCase();
    return normalized && text.includes(normalized);
  });
}

function statusTeamId(rule, player, context, manifest) {
  const current = String(player?.team_id || '').toUpperCase();
  const teams = manifest?.teams || [];

  if (rule?.kind === 'departed') {
    // A departure is attributed to the team being left, not the player's new
    // current team. Prefer an explicitly named story team.
    const sourceTeam = teams.find((team) => teamMentionedInContext(context, team)
      && String(team?.id || team?.abbreviation || '').toUpperCase() !== current);
    if (sourceTeam) return String(sourceTeam.id || sourceTeam.abbreviation || '').toUpperCase();

    const primary = teams[0];
    if (primary && String(primary?.id || primary?.abbreviation || '').toUpperCase() !== current) {
      return String(primary.id || primary.abbreviation || '').toUpperCase();
    }
  }

  return current || String(teams[0]?.id || teams[0]?.abbreviation || '').toUpperCase() || null;
}

function teamForStatus(teamId, manifest) {
  const wanted = String(teamId || '').toUpperCase();
  return (manifest?.teams || []).find((team) =>
    String(team?.id || team?.abbreviation || '').toUpperCase() === wanted
  ) || null;
}

function classifyPlayers(article, manifest, storyType = null) {
  const text = fullStoryText(article);
  const type = storyType || detectStoryType(article);
  const out = [];

  for (const player of manifest?.players || []) {
    const contexts = contextsForName(text, player.name);
    if (!contexts.length) continue;

    let rule = null;
    let matchedContext = '';

    for (const context of contexts) {
      const local = localContextForName(context, player.name);

      // Departure language wins in every story archetype. A player being
      // traded/released is a roster state, never a medical absence.
      if (DEPARTURE_RULE.re.test(local)) {
        rule = DEPARTURE_RULE;
        matchedContext = local;
        break;
      }

      const candidate = STATUS_RULES.find((status) => status.re.test(local));
      if (!candidate) continue;

      // Ignore historical availability statements when the same clause makes
      // clear the player has already returned/emerged. Do not turn last year's
      // injury history into today's OUT badge.
      if (
        ['out','limited'].includes(candidate.kind)
        && /\b(?:last season|in 20\d{2}|had limited|previously|earlier this year)\b/i.test(local)
        && /\b(?:returned|emerged|back|healthy|erased that doubt)\b/i.test(context)
      ) {
        continue;
      }

      rule = candidate;
      matchedContext = local;
      break;
    }

    if (!rule) continue;

    const teamId = statusTeamId(rule, player, matchedContext, manifest);
    out.push({
      player,
      kind: rule.kind,
      label: rule.label,
      teamId,
      context: matchedContext,
      evidence: matchedContext,
    });
  }

  const priority = { departed: 0, out: 1, limited: 2, return: 3, role: 4, added: 5 };
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

function renderRosterMap(article, manifest, statuses, type) {
  if (!statuses.length) return '';

  const grouped = new Map();
  for (const row of statuses) {
    const key = String(row.teamId || row.player?.team_id || 'unknown').toUpperCase();
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }

  const cards = [];
  for (const [teamId, rows] of grouped) {
    const team = teamForStatus(teamId, manifest);
    const affected = rows.filter((x) => ['departed', 'out', 'limited'].includes(x.kind)).slice(0, 4);
    const roleUp = rows.filter((x) => ['role', 'added', 'return'].includes(x.kind)).slice(0, 4);
    if (!affected.length && !roleUp.length) continue;

    const hasDeparture = affected.some((x) => x.kind === 'departed');
    const movementLabel = hasDeparture ? 'ROSTER LOSS' : 'AVAILABILITY HIT';
    const responseLabel = hasDeparture ? 'DEPTH RESPONSE' : 'ROLE SHIFT';
    const movementNote = hasDeparture ? 'Roster movement → role redistribution' : 'Availability → role redistribution';

    cards.push(`<div class="pbe-av-ripple">
      <div class="pbe-av-ripple-head">
        <div class="pbe-av-team-lockup">
          ${team?.logo_url ? `<img src="${esc(team.logo_url)}" alt="" loading="lazy" />` : ''}
          <div><span>ROSTER RIPPLE</span><b>${esc(team?.name || teamId || article?.sport?.toUpperCase() || 'Team impact')}</b></div>
        </div>
        <small>${movementNote}</small>
      </div>
      <div class="pbe-av-ripple-body${!affected.length || !roleUp.length ? ' is-single' : ''}">
        ${affected.length ? `<div class="pbe-av-ripple-side is-loss">
          <div class="pbe-av-ripple-label"><i></i><span>${movementLabel}</span></div>
          <div class="pbe-av-people">${affected.map(playerChip).join('')}</div>
        </div>` : ''}
        ${affected.length && roleUp.length ? '<div class="pbe-av-ripple-arrow" aria-hidden="true"><span>→</span></div>' : ''}
        ${roleUp.length ? `<div class="pbe-av-ripple-side is-gain">
          <div class="pbe-av-ripple-label"><i></i><span>${responseLabel}</span></div>
          <div class="pbe-av-people">${roleUp.map(playerChip).join('')}</div>
        </div>` : ''}
      </div>
    </div>`);
  }

  if (!cards.length) return '';
  return `<div class="pbe-av-ripple-grid">${cards.join('')}${marketWatch(article)}</div>`;
}

function primaryStoryPlayers(article, manifest, limit = 3) {
  const players = manifest?.players || [];
  if (!players.length) return [];

  const title = String(article?.title || '').toLowerCase();
  const summary = String(article?.summary || '').toLowerCase();
  const primary = players.filter((player) => {
    const name = String(player?.name || '').toLowerCase();
    if (!name) return false;
    const last = name.split(/\s+/).pop();
    return title.includes(name) || summary.includes(name)
      || (last?.length > 3 && (title.includes(last) || summary.includes(last)));
  });

  return (primary.length ? primary : players).slice(0, limit);
}

function renderSignalGrid(article, manifest) {
  const props = [...new Set((article?.take?.prop_types || []).map((x) => String(x || '').trim()).filter(Boolean))].slice(0, 4);
  const players = primaryStoryPlayers(article, manifest, 3);
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


function evidenceLabel(label, value) {
  const numeric = evidenceNumber(value);
  if (label === 'QB HIT') return numeric === 1 ? 'QB HIT' : 'QB HITS';
  return label;
}

function renderKeyNumbers(article) {
  const rows = keyNumbers(article);
  if (!rows.length) return '';

  return `<div class="pbe-av-evidence">
    <div class="pbe-av-minihead"><span>STORY EVIDENCE</span><small>Distinct facts from the published story</small></div>
    <div class="pbe-av-evidence-grid" data-count="${Math.min(rows.length, 4)}">
      ${rows.map((row, idx) => {
        const statline = row.metrics.length > 1;
        return `<div class="pbe-av-evidence-card${statline ? ' is-statline' : ''}">
          <span class="pbe-av-evidence-index">${String(idx + 1).padStart(2, '0')}</span>
          <div class="pbe-av-evidence-stats">
            ${row.metrics.map((metric) => `<span class="pbe-av-evidence-stat">
              <strong>${esc(metric.value)}</strong>
              <b>${esc(evidenceLabel(metric.label, metric.value))}</b>
            </span>`).join('')}
          </div>
          <p>${esc(row.context)}</p>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

function archetypeShell(article, manifest, type) {
  const labels = STORY_LABELS[type] || STORY_LABELS.analysis;
  const statuses = classifyPlayers(article, manifest, type);
  const roster = (type === 'availability' || type === 'transaction') ? renderRosterMap(article, manifest, statuses, type) : '';
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

    const primary = primaryStoryPlayers(article, manifest, players.length);
    if (props.some((p) => String(p).startsWith('passing_') || p === 'completion_pct')) {
      const qb = primary.find((p) => String(p.position || '').toUpperCase() === 'QB')
        || players.find((p) => String(p.position || '').toUpperCase() === 'QB');
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

function chooseMetric(article, sport, player = null) {
  if (sport === 'nfl') return nflRecentMetric(article, player?.position);

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

  const metricLive = metricSummary(
    [...games].reverse().map((g) => ({
      date: g.date || g.game?.gameDate || '',
      opponent: g.opponent?.abbreviation || g.opponent?.name || '',
      result: g.isWin === true ? 'W' : g.isWin === false ? 'L' : '',
      stat: g.stat || {},
    })),
    (g) => g.stat?.[key],
  );
  const rows = metricLive.rows;

  const seasonStats = pitcher
    ? [['ERA', seasonRow?.era], ['WHIP', seasonRow?.whip], ['K', seasonRow?.strikeOuts], ['IP', seasonRow?.inningsPitched]]
    : [['AVG', seasonRow?.avg], ['HR', seasonRow?.homeRuns], ['RBI', seasonRow?.rbi], ['OPS', seasonRow?.ops]];

  return { sport: 'mlb', name: person.fullName || player.name, image: player.image_url, label, rows, seasonStats, metricLive };
}

export function metricSummary(sourceRows, valueFor, limit = 8) {
  const all = (sourceRows || []).map((row) => {
    const value = toNumber(valueFor(row));
    return value == null ? null : {
      date: row.date || row.gameDate || '',
      opponent: row.opponent || '',
      result: row.result || '',
      value,
    };
  }).filter(Boolean);

  const recentNewest = all.slice(0, limit);
  const rows = [...recentNewest].reverse();
  const average = (items) => items.length
    ? items.reduce((sum, row) => sum + Number(row.value || 0), 0) / items.length
    : null;
  const recentAverage = average(recentNewest);
  const seasonAverage = average(all);
  const recentHigh = recentNewest.length
    ? Math.max(...recentNewest.map((row) => Number(row.value) || 0))
    : null;
  const baselineAvailable = all.length > recentNewest.length && seasonAverage != null;
  const deltaPct = baselineAvailable && seasonAverage !== 0 && recentAverage != null
    ? ((recentAverage - seasonAverage) / Math.abs(seasonAverage)) * 100
    : null;

  return {
    rows,
    recentAverage,
    seasonAverage,
    recentHigh,
    seasonGames: all.length,
    baselineAvailable,
    deltaPct,
  };
}

function formatMetricNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const digits = Math.abs(n) >= 10 ? 1 : 2;
  return n.toFixed(digits).replace(/\.00$/, '').replace(/\.0$/, '');
}

function compactOpponent(value) {
  const raw = String(value || '').trim();
  if (!raw) return '—';
  const prefixed = /^(@|vs\.?)/i.test(raw);
  const parts = raw.replace(/^vs\.?\s*/i, '').replace(/^@\s*/i, '').trim().split(/\s+/);
  const team = parts.length === 1
    ? parts[0]
    : parts.map((part) => part[0]).join('').slice(0, 4).toUpperCase();
  return `${raw.startsWith('@') ? '@ ' : prefixed ? 'vs ' : ''}${team}`;
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
  const requestedMetric = chooseMetric(article, sport, player);
  const position = String(player?.position || '').toUpperCase();
  const requestedKey = requestedMetric?.[0] || '';
  const preferred = sport === 'nfl'
    ? (position === 'QB'
      ? (requestedKey.startsWith('rushing') ? 'rushing' : 'passing')
      : ['RB', 'FB'].includes(position)
        ? (requestedKey.startsWith('receiving') || requestedKey === 'receptions' ? 'receiving' : 'rushing')
        : ['WR', 'TE'].includes(position) ? 'receiving'
          : 'defensive')
    : 'averages';

  const cat = firstUsableCategory(categories, preferred);
  const seasonRow = cat?.rows?.[0] || null;
  const log = logPayload ? espnGameLog(logPayload, season, '2') : { rows: [] };

  const fallbackMetric = sport === 'nba'
    ? ['points', 'Points']
    : cat?.key === 'passing' ? ['completions', 'Completions']
      : cat?.key === 'rushing' ? ['rushingYards', 'Rushing Yards']
        : cat?.key === 'receiving' ? ['receivingYards', 'Receiving Yards']
          : null;
  const metric = requestedMetric && (log.names || []).includes(requestedMetric[0])
    ? requestedMetric
    : fallbackMetric;
  const key = metric?.[0];
  const label = metric?.[1] || 'Recent form';

  const metricLive = key
    ? metricSummary(log.rows || [], (g) => g.values?.[key])
    : metricSummary([], () => null);
  const rows = metricLive.rows;

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

  return { sport, name: player.name, image: player.image_url, label, rows, seasonStats, metricLive };
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

  const metricLive = metricSummary(log.rows || [], (g) => g.values?.[key]);
  const rows = metricLive.rows;

  const preferred = bio?.position === 'G'
    ? ['savePctg', 'goalsAgainstAvg', 'wins', 'shutouts']
    : ['goals', 'assists', 'points', 'shots'];

  const seasonStats = preferred.map((keyName) => {
    const idx = cat?.names?.indexOf(keyName);
    return idx >= 0 ? [cat.labels?.[idx] || keyName, seasonRow?.values?.[keyName]] : null;
  }).filter(Boolean).slice(0, 4);

  return { sport: 'nhl', name: player.name, image: player.image_url, label, rows, seasonStats, metricLive };
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

export function renderPlayerContext(data) {
  if (!data) return '';
  const rows = (data.rows || []).filter((r) => r.value != null);
  const stats = (data.seasonStats || []).filter((x) => x?.[1] != null && x?.[1] !== '');
  if (!rows.length && !stats.length) return '';

  const live = data.metricLive || {};
  const avg = live.recentAverage ?? (rows.length
    ? rows.reduce((sum, row) => sum + Number(row.value || 0), 0) / rows.length
    : null);
  const seasonAvg = live.seasonAverage ?? null;
  const baselineAvailable = live.baselineAvailable === true && seasonAvg != null;
  const max = Math.max(1, ...rows.map((r) => Number(r.value) || 0), baselineAvailable ? Number(seasonAvg) || 0 : 0);
  const baselinePct = baselineAvailable ? Math.max(0, Math.min(100, Number(seasonAvg) / max * 100)) : null;
  const deltaPct = Number.isFinite(Number(live.deltaPct)) ? Number(live.deltaPct) : null;
  const trendTone = deltaPct == null ? 'sample' : deltaPct > 5 ? 'up' : deltaPct < -5 ? 'down' : 'steady';
  const trendText = deltaPct == null
    ? `${live.seasonGames || rows.length} GAME SAMPLE`
    : `${deltaPct > 0 ? '+' : ''}${deltaPct.toFixed(0)}% VS SEASON`;

  const sportClass = ['mlb', 'nfl', 'nba', 'nhl'].includes(String(data.sport || '').toLowerCase())
    ? ` is-${String(data.sport).toLowerCase()}`
    : '';
  const averageExplainer = avg != null
    ? `Average ${data.label} per game over the last ${rows.length} verified game${rows.length === 1 ? '' : 's'}`
    : '';

  return `<div class="pbe-av-player-card${sportClass}">
    <header class="pbe-av-player-head">
      <div class="pbe-av-player-id">
        ${data.image ? `<img class="pbe-av-player-photo" src="${esc(data.image)}" alt="" loading="lazy" />` : ''}
        <div>
          <span>VERIFIED CURRENT FORM</span>
          <h3>${esc(data.name)}</h3>
          <small>Live context · separate from the frozen article record</small>
        </div>
      </div>
      ${avg != null ? `<div class="pbe-av-recent-avg" title="${esc(averageExplainer)}" aria-label="${esc(averageExplainer)}">
        <strong>${esc(formatMetricNumber(avg))}</strong>
        <span>LAST ${rows.length} GAME AVG</span>
        <small>${esc(data.label)} per game</small>
      </div>` : ''}
    </header>

    ${stats.length ? `<div class="pbe-av-season-stats">
      ${stats.map(([label, value]) => `<div><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('')}
    </div>` : ''}

    ${rows.length ? `<div class="pbe-av-live-insights">
      <div><span>RECENT HIGH</span><strong>${esc(formatMetricNumber(live.recentHigh))}</strong><small>${esc(data.label)}</small></div>
      <div><span>${baselineAvailable ? 'SEASON AVG' : 'SEASON SAMPLE'}</span><strong>${esc(baselineAvailable ? formatMetricNumber(seasonAvg) : String(live.seasonGames || rows.length))}</strong><small>${baselineAvailable ? esc(data.label) : 'verified games'}</small></div>
      <div class="is-${trendTone}"><span>FORM SIGNAL</span><strong>${esc(trendText)}</strong><small>${deltaPct == null ? 'Build the sample before calling a trend' : 'Recent average vs full-season game log'}</small></div>
    </div>
    <div class="pbe-av-form">
      <div class="pbe-av-form-head">
        <div><span>RECENT FORM</span><b>${esc(data.label)}</b></div>
        <small>${rows.length} recent · ${live.seasonGames || rows.length} season games</small>
      </div>
      <div class="pbe-av-bars">
        ${rows.map((row, idx) => {
          const height = Math.max(7, Math.min(100, Number(row.value) / max * 100));
          const latest = idx === rows.length - 1;
          return `<div class="pbe-av-bar-col${latest ? ' is-latest' : ''}" title="${esc(compactDate(row.date))} ${esc(row.opponent)} · ${esc(row.value)} ${esc(data.label)}">
            <span class="pbe-av-bar-value">${esc(row.value)}</span>
            <div class="pbe-av-bar-track">
              ${baselinePct != null ? `<span class="pbe-av-baseline-tick" style="bottom:${baselinePct.toFixed(1)}%" aria-hidden="true"></span>` : ''}
              <i style="height:${height.toFixed(1)}%"></i>
            </div>
            <span class="pbe-av-bar-meta"><b>${esc(compactOpponent(row.opponent))}</b><small>${esc(compactDate(row.date))}</small></span>
          </div>`;
        }).join('')}
      </div>
      ${baselineAvailable ? `<div class="pbe-av-baseline-key"><i></i><span>Season average · ${esc(formatMetricNumber(seasonAvg))} ${esc(data.label)}</span></div>` : ''}
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
