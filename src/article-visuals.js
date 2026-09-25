/**
 * PropBetEdge article intelligence — Data Intelligence V3.
 *
 * Editorial rule: the module can re-present facts, never manufacture them.
 * "Here’s the data." is a promise: it renders only when the module holds
 * verified quantitative data (published evidence, a verified live team/player
 * surface, or PBE model data read from a documented contract). Team names,
 * people, impact scores and market tags are context and are labeled as such.
 *
 * Layers:
 *   PUBLISHED EVIDENCE      frozen numbers stated in the article (evidence.js)
 *   VERIFIED LIVE CONTEXT   team/player adapters (adapters.js, team-data.js)
 *   ROLE / ROSTER IMPACT    authoritative relation contract (below)
 *   MARKETS AFFECTED        story-analysis tags, never a forecast
 */

import {
  extractPublishedEvidence,
  evidenceLabel,
  evidenceSentenceAround,
  evidenceContextKey,
  isDisplayableValue,
  quantitativeEvidenceCount,
} from './article-intelligence/evidence.js';
import { renderTeamData, updatedLabel } from './article-intelligence/team-data.js';
import {
  adapterFor,
  currentSeason,
  metricSummary,
  nflRecentMetric,
  NFL_DEFENSE,
  NFL_DEFENSIVE_PROPS,
  NFL_OFFENSE_SKILL,
} from './article-intelligence/adapters.js';

export { metricSummary, nflRecentMetric };
export { ARTICLE_DATA_ADAPTERS } from './article-intelligence/adapters.js';
export { extractPublishedEvidence } from './article-intelligence/evidence.js';

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
  rushing_attempts: 'Rushing Attempts',
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

const RELATION_TEAM_ALIASES = {
  nba: { NYK: 'NY', GSW: 'GS', NOP: 'NO', SAS: 'SA', UTA: 'UTAH', WAS: 'WSH' },
  nfl: { WAS: 'WSH', LA: 'LAR' },
};

const PRACTICE_DNP_RE = /\b(?:did not practice|didn't practice|did not participate|non[- ]participant|missed practice|DNP)\b/i;
const GAME_ABSENCE_RE = /\b(?:ruled out|inactive|will miss|won't play|will not play|not expected to play|out for (?:the )?(?:game|season)|out (?:through|until)\b|injured reserve|\bIR\b|\bPUP\b|season[- ]ending|out indefinitely|remains sidelined)\b/i;

const RELATION_STATE = {
  medical_absence: { kind: 'out', label: 'OUT / IR' },
  practice_dnp: { kind: 'limited', label: 'DNP' },
  medical_limited: { kind: 'limited', label: 'LIMITED' },
  returning: { kind: 'return', label: 'RETURNING' },
  role_increase: { kind: 'role', label: 'ROLE UP' },
  added: { kind: 'added', label: 'ADDED' },
  departed: { kind: 'departed', label: 'DEPARTED' },
};

function relationPresentation(state, evidence = '') {
  const key = String(state || '').toLowerCase();
  const text = String(evidence || '');

  // Defensive presentation guard for 3.18.0 rows produced before the
  // practice_dnp state existed. A Wednesday DNP is a practice designation,
  // not a claim that the player is ruled out or on IR.
  if (key === 'medical_absence' && PRACTICE_DNP_RE.test(text) && !GAME_ABSENCE_RE.test(text)) {
    return RELATION_STATE.practice_dnp;
  }

  return RELATION_STATE[key] || null;
}

function relationTeamCode(sport, value) {
  const code = String(value || '').trim().toUpperCase();
  return RELATION_TEAM_ALIASES[String(sport || '').toLowerCase()]?.[code] || code;
}

const GIVEN_NAME_GROUPS = [
  ['michael', 'mike'], ['matthew', 'matt'], ['christopher', 'chris'], ['nicholas', 'nick'],
  ['joseph', 'joe'], ['joshua', 'josh'], ['daniel', 'dan', 'danny'], ['william', 'will', 'bill', 'billy'],
  ['robert', 'rob', 'bob', 'bobby'], ['james', 'jim', 'jimmy'], ['anthony', 'tony'], ['benjamin', 'ben'],
  ['alexander', 'alex'], ['andrew', 'drew', 'andy'], ['zachary', 'zach', 'zack'], ['jonathan', 'jon'],
  ['cameron', 'cam'], ['thomas', 'tom', 'tommy'], ['samuel', 'sam'], ['timothy', 'tim'],
  ['gregory', 'greg'], ['patrick', 'pat'], ['kenneth', 'ken', 'kenny'], ['nathaniel', 'nate'],
  ['jacob', 'jake'], ['david', 'dave'], ['steven', 'steve'], ['stephen', 'steve'], ['edward', 'ed', 'eddie'],
  ['richard', 'rich', 'rick', 'ricky'], ['charles', 'charlie', 'chuck'], ['frederick', 'fred'],
  ['kristopher', 'kris'], ['maxwell', 'max'], ['theodore', 'ted', 'teddy'], ['jeffrey', 'jeff'],
];

function nicknameEquivalent(a, b) {
  const pa = String(a || '').split(' ');
  const pb = String(b || '').split(' ');
  if (pa.length < 2 || pb.length < 2) return false;
  if (pa.slice(1).join(' ') !== pb.slice(1).join(' ')) return false;
  if (pa[0] === pb[0]) return true;
  return GIVEN_NAME_GROUPS.some((group) => group.includes(pa[0]) && group.includes(pb[0]));
}

function relationPersonName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[.’']/g, '')
    .replace(/\b(?:jr|sr|ii|iii|iv)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function teamForStatus(teamId, manifest, sport = '') {
  const wanted = relationTeamCode(sport, teamId);
  return (manifest?.teams || []).find((team) =>
    relationTeamCode(sport, team?.id || team?.abbreviation) === wanted
  ) || null;
}

const CONTRACT_MIN_PROMPT = [3, 18, 0];

function promptVersionTuple(value) {
  const m = String(value || '').match(/^(\d+)\.(\d+)\.(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/**
 * Prompt >= 3.18.0 articles were written under Publication Contract V2: their
 * relation array is the only roster truth. They must never drop into the
 * legacy heuristic classification, even if the array is missing.
 */
export function isStrictContractArticle(article) {
  const v = promptVersionTuple(article?.take?.prompt_version);
  if (!v) return false;
  for (let i = 0; i < 3; i++) {
    if (v[i] > CONTRACT_MIN_PROMPT[i]) return true;
    if (v[i] < CONTRACT_MIN_PROMPT[i]) return false;
  }
  return true;
}

/**
 * Relation arrays are the authoritative v2 contract. null means a legacy
 * article whose writer pre-dates the contract; [] means the writer explicitly
 * found no roster relation and the UI must render no roster ripple. A strict
 * (3.18+) article without an array is an invalid payload: no ripple, no
 * heuristics.
 */
function classifyStructuredRelations(article, manifest) {
  const relations = article?.take?.relations;
  if (!Array.isArray(relations)) return isStrictContractArticle(article) ? [] : null;

  const sport = String(article?.sport || '').toLowerCase();
  const players = manifest?.players || [];
  const out = [];

  for (const relation of relations) {
    if (!relation || typeof relation !== 'object') continue;
    const state = String(relation.state || '').toLowerCase();
    if (state === 'neutral') continue;
    const rule = relationPresentation(state, relation.evidence);
    if (!rule) continue;

    const wanted = relationPersonName(relation.player);
    if (!wanted) continue;
    let candidates = players.filter((player) => relationPersonName(player?.name) === wanted);
    if (!candidates.length) {
      // Writers use full given names ("Michael Onwenu") where the dictionary
      // carries the playing name ("Mike Onwenu"). Accept only a known
      // nickname pair, the same surname, and the relation's own team.
      const relTeam = relationTeamCode(sport, relation.team);
      candidates = players.filter((player) => nicknameEquivalent(relationPersonName(player?.name), wanted)
        && (!relTeam || relationTeamCode(sport, player?.team_id) === relTeam));
    }
    if (candidates.length !== 1) continue;

    const teamId = relationTeamCode(sport, relation.team);
    if (!teamId) continue;

    out.push({
      player: candidates[0],
      kind: rule.kind,
      label: rule.label,
      teamId,
      context: String(relation.evidence || ''),
      evidence: String(relation.evidence || ''),
      destinationTeamId: relationTeamCode(sport, relation.destination_team),
      authoritative: true,
    });
  }

  const priority = { departed: 0, out: 1, limited: 2, return: 3, role: 4, added: 5 };
  return out.sort((a, b) => (priority[a.kind] ?? 9) - (priority[b.kind] ?? 9));
}

function classifyPlayers(article, manifest, storyType = null) {
  const structured = classifyStructuredRelations(article, manifest);
  if (structured !== null) return structured;
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

function marketLabel(value) {
  const key = String(value || '').trim();
  if (PROP_LABELS[key]) return PROP_LABELS[key];
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function storyMarkets(article) {
  return [...new Set((article?.take?.prop_types || []).map((x) => String(x || '').trim()).filter(Boolean))].slice(0, 4);
}

/**
 * Markets are an editorial classification. They are rendered as plain chips
 * with an explicit qualifier so two prop names never read as observed stats.
 */
function renderMarkets(markets) {
  if (!markets.length) return '';
  return `<div class="pbe-av-block pbe-av-markets" data-pbe-markets>
    <div class="pbe-av-minihead"><span>MARKETS AFFECTED</span><small>Tagged by the published story analysis · not a model forecast</small></div>
    <ul class="pbe-av-market-chips">
      ${markets.map((prop) => `<li>${esc(marketLabel(prop))}</li>`).join('')}
    </ul>
  </div>`;
}

function renderRosterMap(article, manifest, statuses) {
  if (!statuses.length) return '';

  const grouped = new Map();
  for (const row of statuses) {
    const key = String(row.teamId || row.player?.team_id || 'unknown').toUpperCase();
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }

  const cards = [];
  for (const [teamId, rows] of grouped) {
    const team = teamForStatus(teamId, manifest, article?.sport);
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
  return `<div class="pbe-av-block pbe-av-roster" data-pbe-roster>
    <div class="pbe-av-minihead"><span>ROLE / ROSTER IMPACT</span><small>From the published story's roster relations</small></div>
    <div class="pbe-av-ripple-grid" data-count="${cards.length}">${cards.join('')}</div>
  </div>`;
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

function renderPeopleInFocus(players) {
  if (!players.length) return '';
  return `<div class="pbe-av-block pbe-av-focus" data-pbe-focus>
    <div class="pbe-av-minihead"><span>PEOPLE IN FOCUS</span><small>Resolved from this story</small></div>
    <div class="pbe-av-focus-row" data-count="${players.length}">
      ${players.map((p) => `<a href="${esc(p.path || '#')}" title="${esc(p.name)}">
        ${p.image_url ? `<img src="${esc(p.image_url)}" alt="" loading="lazy" />` : '<span class="pbe-av-focus-mono" aria-hidden="true">•</span>'}
        <b>${esc(p.name)}</b>
        ${p.position ? `<small>${esc(p.position)}</small>` : ''}
      </a>`).join('')}
    </div>
  </div>`;
}

function renderEvidence(rows) {
  if (!rows.length) return '';
  return `<div class="pbe-av-block pbe-av-evidence" data-pbe-evidence>
    <div class="pbe-av-minihead"><span>PUBLISHED EVIDENCE</span><small>Numbers stated in the story · frozen at publication</small></div>
    <div class="pbe-av-evidence-grid" data-count="${Math.min(rows.length, 4)}">
      ${rows.map((row, idx) => {
        const statline = row.metrics.length > 1;
        return `<div class="pbe-av-evidence-card${statline ? ' is-statline' : ''}" data-pbe-quant="evidence">
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

function renderTeamCard(team, { expectLive = false, pending = true, live = null } = {}) {
  if (!team) return '';
  const data = live ? renderTeamData(live) : '';
  const label = data ? 'TEAM SNAPSHOT' : 'TEAM CONTEXT';
  const sub = data && (live.division || live.conference)
    ? `${live.division || live.conference}${live.seasonState === 'prior_season' ? ' · last season' : ''}`
    : 'Open team hub';
  return `<div class="pbe-av-team-card${data ? ' has-data' : ''}" data-pbe-team-card>
    <a class="pbe-av-team-id" href="${esc(team.path || '#')}">
      ${team.logo_url ? `<img src="${esc(team.logo_url)}" alt="" loading="lazy" />` : ''}
      <div><span data-pbe-team-label>${label}</span><b>${esc(team.name)}</b><small data-pbe-team-sub>${esc(sub)} →</small></div>
    </a>
    ${data || (expectLive && pending ? '<div class="pbe-av-team-slot" data-pbe-team-slot aria-hidden="true"><i></i><i></i><i></i><i></i></div>' : '')}
  </div>`;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Players the headline or dek is actually about (whole-word name match). */
function headlinePlayers(article, players) {
  const text = `${article?.title || ''} ${article?.summary || ''}`.toLowerCase();
  return (players || []).filter((player) => {
    const name = String(player?.name || '').toLowerCase().trim();
    if (!name) return false;
    if (text.includes(name)) return true;
    const last = name.replace(/\s+(?:jr\.?|sr\.?|ii|iii|iv)$/, '').split(/\s+/).pop();
    return last?.length > 3 && new RegExp(`\\b${escapeRegExp(last)}\\b`).test(text);
  });
}

/**
 * The live player chart belongs to the story's subject, never a bystander.
 * Candidates: players named in the headline/dek, then players the roster
 * relations mark as affected. If neither yields a chartable role, no chart —
 * except when the story resolves exactly one person.
 */
function chartPlayerFor(article, manifest, statuses, type, adapter) {
  if (!adapter?.player) return null;
  const all = manifest?.players || [];
  const supports = (p) => adapter.playerSupports(p);
  const players = all.filter(supports);
  if (!players.length) return null;
  const sport = String(article?.sport || '').toLowerCase();
  const props = article?.take?.prop_types || [];
  const affectedIds = new Set(statuses.filter((x) => ['out', 'limited'].includes(x.kind)).map((x) => x.player.id));
  const named = headlinePlayers(article, all).filter(supports);
  const affected = players.filter((p) => affectedIds.has(p.id));
  const candidates = [...new Set([...(type === 'availability' ? affected : []), ...named, ...affected])];
  if (!candidates.length) return all.length === 1 ? players[0] : null;
  const pos = (p) => String(p.position || '').toUpperCase();

  if (sport === 'nfl' && !(type === 'availability' && affected.length)) {
    const pick = (test) => candidates.find((p) => test(pos(p)));
    if (props.some((p) => String(p).startsWith('passing_') || p === 'completion_pct')) {
      const qb = pick((x) => x === 'QB');
      if (qb) return qb;
    }
    if (props.some((p) => String(p).startsWith('receiving_') || p === 'receptions')) {
      const receiver = pick((x) => ['WR', 'TE', 'RB'].includes(x));
      if (receiver) return receiver;
    }
    if (props.some((p) => String(p).startsWith('rushing_'))) {
      const runner = pick((x) => ['RB', 'QB'].includes(x));
      if (runner) return runner;
    }
    if (props.some((p) => NFL_DEFENSIVE_PROPS.has(p))) {
      const defender = pick((x) => NFL_DEFENSE.has(x));
      if (defender) return defender;
    }
    return pick((x) => NFL_OFFENSE_SKILL.has(x)) || candidates[0];
  }
  return candidates[0];
}

function primaryTeam(article, manifest, statuses) {
  const sport = String(article?.sport || '').toLowerCase();
  const first = statuses.find((s) => s.authoritative) || null;
  if (first) {
    const team = teamForStatus(first.teamId, manifest, sport);
    if (team) return team;
  }
  return manifest?.teams?.[0] || null;
}

/** A live player payload counts only if it renders real, verified numbers. */
function playerHasQuant(data) {
  return Boolean(data) && renderPlayerContext(data) !== '';
}

const HEADLINES = {
  story: {
    kicker: 'PBE STORY INTELLIGENCE',
    title: 'What changed.',
    sub: 'Who is affected, who absorbs the role, and the markets the story ties to the change.',
  },
  impact: {
    kicker: 'PBE IMPACT MAP',
    title: 'What it affects.',
    sub: 'The people, team and markets this story touches — structured context, not a forecast.',
  },
};

/**
 * Data Intelligence V3 contract. Quantitative data and structured context are
 * separate layers; the headline follows what actually exists.
 *
 * level 0 → render nothing
 * level 1 → context only ("What changed." / "What it affects.")
 * level 2 → at least one verified quantitative surface ("Here's the data.")
 * level 3 → published evidence + verified live context
 */
export function buildArticleIntelligence(article, manifest, live = null) {
  const sport = String(article?.sport || '').toLowerCase();
  const archetype = detectStoryType(article);
  const adapter = adapterFor(sport);
  const publishedEvidence = extractPublishedEvidence(article);
  const statuses = classifyPlayers(article, manifest, archetype);
  const authoritative = statuses.some((status) => status?.authoritative);
  const rosterEligible = authoritative || archetype === 'availability' || archetype === 'transaction';
  const rosterHtml = rosterEligible ? renderRosterMap(article, manifest, statuses) : '';
  const rosterImpact = rosterHtml ? statuses : [];
  const marketConnections = storyMarkets(article);
  const focusPlayers = rosterHtml ? [] : primaryStoryPlayers(article, manifest, 3);
  const team = primaryTeam(article, manifest, statuses);
  const chartPlayer = chartPlayerFor(article, manifest, statuses, archetype, adapter);
  const expectTeam = Boolean(adapter?.team && team?.slug);

  const liveTeamData = live?.team?.metrics?.length ? [live.team] : [];
  const livePlayerData = playerHasQuant(live?.player) ? [live.player] : [];
  const evidenceCount = quantitativeEvidenceCount(publishedEvidence);
  const liveCount = liveTeamData.reduce((n, t) => n + t.metrics.length, 0)
    + livePlayerData.reduce((n, p) => n + (p.seasonStats?.length || 0) + (p.rows?.length ? 1 : 0) + (p.modelMetrics?.length || 0), 0);
  const quantitativeCount = evidenceCount + liveCount;
  const contextCount = (rosterImpact.length ? 1 : 0) + (marketConnections.length ? 1 : 0) + (focusPlayers.length ? 1 : 0) + (team ? 1 : 0);
  const hasQuantitativeData = quantitativeCount > 0;
  const hasLiveData = liveCount > 0;

  let mode = null;
  if (hasQuantitativeData) mode = 'data';
  else if (contextCount >= 2 && (rosterImpact.length || marketConnections.length || focusPlayers.length)) {
    mode = rosterImpact.length || archetype === 'availability' || archetype === 'transaction' ? 'story' : 'impact';
  }
  const level = !mode ? 0 : mode !== 'data' ? 1 : evidenceCount && hasLiveData ? 3 : 2;

  const headline = mode === 'data'
    ? { kicker: 'PBE DATA INTELLIGENCE', title: 'Here’s the data.', sub: (STORY_LABELS[archetype] || STORY_LABELS.analysis).sub }
    : HEADLINES[mode] || null;

  const liveAt = liveTeamData[0]?.observedAt || (hasLiveData ? live?.fetchedAt : null) || null;
  return {
    sport,
    archetype,
    adapter: adapter ? adapter.sport : null,
    publishedEvidence,
    livePlayerData,
    liveTeamData,
    liveGameData: [],
    modelData: livePlayerData.flatMap((p) => p.modelMetrics || []),
    rosterImpact,
    entities: { team, players: focusPlayers, chartPlayer },
    marketConnections,
    quantitativeCount,
    contextCount,
    hasQuantitativeData,
    hasLiveData,
    level,
    mode,
    headline,
    expect: { team: expectTeam, player: chartPlayer },
    freshness: hasLiveData
      ? { state: 'live', at: liveAt, label: liveAt ? updatedLabel(liveAt) : 'Verified live' }
      : evidenceCount ? { state: 'frozen', at: article?.published_at || null, label: 'Frozen at publication' }
        : { state: 'context', at: article?.published_at || null, label: 'Story context' },
    provenance: {
      publishedEvidence: 'frozen_article_text',
      liveTeam: expectTeam ? 'pbe-entity-hub/1 via /api/team-intelligence' : null,
      livePlayer: chartPlayer ? `${sport} player adapter` : null,
      markets: 'story_analysis_tags',
    },
    _html: { roster: rosterHtml },
  };
}

function freshnessChip(intel) {
  const f = intel.freshness;
  const text = f.state === 'live' ? `LIVE · ${f.label.replace(/^Updated\s+/i, '')}` : f.state === 'frozen' ? 'FROZEN · PUBLISHED' : 'STORY CONTEXT';
  return `<span class="pbe-av-freshness is-${f.state}" data-pbe-av-freshness><i aria-hidden="true"></i>${esc(text)}</span>`;
}

function renderSourceNote(intel, settled = false) {
  const parts = [];
  if (intel.publishedEvidence.length) parts.push('Published evidence is frozen to the story as published.');
  if (settled ? intel.hasLiveData : (intel.expect.team || intel.expect.player || intel.hasLiveData)) parts.push('Verified live context is read from league and PropBetEdge sources when the page loads and can change.');
  if (intel.modelData.length) parts.push('PBE model data is labeled with its model version.');
  if (intel.marketConnections.length) parts.push('Markets are an editorial classification, not a live forecast.');
  if (!parts.length) return '';
  return `<div class="pbe-av-source-note" data-pbe-av-source><span></span><p>${esc(parts.join(' '))}</p></div>`;
}

function renderFooterLinks(intel) {
  const adapter = adapterFor(intel.sport);
  const links = [];
  if (adapter?.intelligenceUrl) links.push(`<a class="pbe-av-open" href="${esc(adapter.intelligenceUrl)}" rel="noopener">OPEN ${esc(adapter.label)} INTELLIGENCE <span aria-hidden="true">→</span></a>`);
  if (intel.entities.team?.path) links.push(`<a class="pbe-av-open is-secondary" href="${esc(intel.entities.team.path)}">${esc(intel.entities.team.name)} hub <span aria-hidden="true">→</span></a>`);
  return links.length ? `<nav class="pbe-av-foot" aria-label="Deeper PropBetEdge intelligence">${links.join('')}</nav>` : '';
}

/**
 * Render the module. `options.live` = { team, player, fetchedAt } renders the
 * post-hydration state (used by the canary and tests); without it the static
 * state renders with reserved slots for adapters that are expected to hydrate.
 */
export function renderArticleVisuals(article, manifest, options = {}) {
  const live = options.live || null;
  const intel = buildArticleIntelligence(article, manifest, live);
  if (!intel.level) return '';

  const score = impactScore(article);
  const team = intel.entities.team;
  const chartPlayer = intel.expect.player;
  const pending = !live;
  const expectLive = intel.expect.team || Boolean(chartPlayer);
  const liveTeam = intel.liveTeamData[0] || null;
  const livePlayer = intel.livePlayerData[0] || null;
  const showLiveHead = pending ? expectLive : Boolean(liveTeam || livePlayer);

  const playerHtml = pending
    ? (chartPlayer ? '<div class="pbe-av-player" data-pbe-player-chart><div class="pbe-av-loading is-compact" aria-hidden="true"><span></span><span></span><span></span></div></div>' : '')
    : (livePlayer ? `<div class="pbe-av-player" data-pbe-player-chart>${renderPlayerContext(livePlayer)}</div>` : '');

  const id = `pbe-av-${String(article?.id || article?.slug || 'story').replace(/[^a-z0-9_-]/gi, '')}`;
  return `<section
    class="pbe-article-visuals is-${esc(intel.mode)}"
    id="${esc(id)}"
    data-pbe-article-visuals
    data-sport="${esc(intel.sport)}"
    data-archetype="${esc(intel.archetype)}"
    data-intel-mode="${esc(intel.mode)}"
    data-intel-level="${intel.level}"
    data-player-id="${esc(chartPlayer?.id || '')}"
    data-team-slug="${esc(intel.expect.team ? team.slug : '')}"
    aria-label="PropBetEdge story intelligence"
  >
    <div class="pbe-av-stage" aria-hidden="true"></div>
    <header class="pbe-av-head">
      <div class="pbe-av-title">
        <span class="pbe-av-kicker" data-pbe-av-kicker>${esc(intel.headline.kicker)}</span>
        <h2 data-pbe-av-title>${esc(intel.headline.title)}</h2>
        <p data-pbe-av-sub>${esc(intel.headline.sub)}</p>
      </div>
      <div class="pbe-av-head-side">
        ${impactVisual(score)}
        ${freshnessChip(intel)}
      </div>
    </header>
    ${renderEvidence(intel.publishedEvidence)}
    ${team || playerHtml ? `<div class="pbe-av-block pbe-av-live" data-pbe-av-live>
      ${showLiveHead ? `<div class="pbe-av-minihead" data-pbe-av-live-head><span>VERIFIED LIVE CONTEXT</span><small data-pbe-av-live-updated>${esc(pending ? 'Checking current data…' : intel.freshness.label)}</small></div>` : ''}
      ${renderTeamCard(team, { expectLive: intel.expect.team, pending, live: pending ? null : liveTeam })}
      ${playerHtml}
    </div>` : ''}
    ${intel._html.roster || renderPeopleInFocus(livePlayer && chartPlayer
      ? intel.entities.players.filter((p) => String(p.id) !== String(chartPlayer.id))
      : intel.entities.players)}
    ${renderMarkets(intel.marketConnections)}
    ${renderFooterLinks(intel)}
    ${renderSourceNote(intel, !pending)}
  </section>`;
}

export { currentSeason };

/** Fetch every live module the static render reserved. Never throws. */
export async function loadLiveContext(article, manifest, ctx = {}) {
  const intel = buildArticleIntelligence(article, manifest);
  const adapter = adapterFor(intel.sport);
  const out = { team: null, player: null, fetchedAt: null };
  if (!intel.level || !adapter) return out;
  const [team, player] = await Promise.all([
    intel.expect.team ? adapter.team(ctx, intel.entities.team).catch(() => null) : null,
    intel.expect.player ? adapter.player(ctx, intel.expect.player, article).catch(() => null) : null,
  ]);
  out.team = team || null;
  out.player = playerHasQuant(player) ? player : null;
  out.fetchedAt = new Date().toISOString();
  return out;
}

function compactDate(value) {
  const d = new Date(value);
  return Number.isFinite(d.getTime())
    ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '';
}

function formatMetricNumber(value) {
  const n = Number(value);
  if (value == null || !Number.isFinite(n)) return '—';
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

export function renderPlayerContext(data) {
  if (!data) return '';
  const rows = (data.rows || []).filter((r) => r.value != null && Number.isFinite(Number(r.value)));
  const stats = (data.seasonStats || []).filter((x) => isDisplayableValue(x?.[1]));
  const model = (data.modelMetrics || []).filter((m) => isDisplayableValue(m?.value));
  if (!rows.length && !stats.length && !model.length) return '';

  const live = data.metricLive || {};
  const avg = rows.length
    ? (live.recentAverage ?? rows.reduce((sum, row) => sum + Number(row.value || 0), 0) / rows.length)
    : null;
  const seasonAvg = live.seasonAverage ?? null;
  const baselineAvailable = live.baselineAvailable === true && seasonAvg != null;
  const max = Math.max(1, ...rows.map((r) => Number(r.value) || 0), baselineAvailable ? Number(seasonAvg) || 0 : 0);
  const baselinePct = baselineAvailable ? Math.max(0, Math.min(100, Number(seasonAvg) / max * 100)) : null;
  const deltaPct = live.deltaPct != null && Number.isFinite(Number(live.deltaPct)) ? Number(live.deltaPct) : null;
  const trendTone = deltaPct == null ? 'sample' : deltaPct > 5 ? 'up' : deltaPct < -5 ? 'down' : 'steady';
  const trendText = deltaPct == null
    ? `${live.seasonGames || rows.length} GAME SAMPLE`
    : `${deltaPct > 0 ? '+' : ''}${deltaPct.toFixed(0)}% VS SEASON`;

  const sportClass = ['mlb', 'nfl', 'nba', 'wnba', 'nhl'].includes(String(data.sport || '').toLowerCase())
    ? ` is-${String(data.sport).toLowerCase()}`
    : '';
  const averageExplainer = avg != null
    ? `Average ${data.label} per game over the last ${rows.length} verified game${rows.length === 1 ? '' : 's'}`
    : '';
  const current = data.seasonCurrent !== false;
  const eyebrow = rows.length || current ? 'VERIFIED CURRENT FORM' : 'VERIFIED PLAYER DATA';
  const seasonNote = data.seasonLabel
    ? `${current ? '' : 'Last completed · '}${data.seasonLabel}`
    : '';

  return `<div class="pbe-av-player-card${sportClass}" data-pbe-quant="player">
    <header class="pbe-av-player-head">
      <div class="pbe-av-player-id">
        ${data.image ? `<img class="pbe-av-player-photo" src="${esc(data.image)}" alt="" loading="lazy" />` : ''}
        <div>
          <span>${eyebrow}</span>
          <h3>${esc(data.name)}</h3>
          <small>Live context · separate from the frozen article record${seasonNote ? ` · ${esc(seasonNote)}` : ''}</small>
        </div>
      </div>
      ${avg != null ? `<div class="pbe-av-recent-avg" title="${esc(averageExplainer)}" aria-label="${esc(averageExplainer)}">
        <strong>${esc(formatMetricNumber(avg))}</strong>
        <span>LAST ${rows.length} GAME AVG</span>
        <small>${esc(data.label)} per game</small>
      </div>` : ''}
    </header>

    ${stats.length ? `<div class="pbe-av-season-stats" data-count="${stats.length}">
      ${stats.map(([label, value]) => `<div><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('')}
    </div>` : ''}

    ${model.length ? `<div class="pbe-av-model">
      <div class="pbe-av-minihead"><span>PBE MODEL DATA</span><small>${esc(model.map((m) => m.version).filter(Boolean).join(' · ') || 'PropBetEdge model')}</small></div>
      <div class="pbe-av-model-row">
        ${model.map((m) => `<div><span>${esc(m.label)}</span><strong>${esc(m.value)}</strong>${m.note ? `<small>${esc(m.note)}</small>` : ''}</div>`).join('')}
      </div>
    </div>` : ''}

    ${rows.length ? `<div class="pbe-av-live-insights">
      <div><span>RECENT HIGH</span><strong>${esc(formatMetricNumber(live.recentHigh ?? Math.max(...rows.map((r) => Number(r.value)))))}</strong><small>${esc(data.label)}</small></div>
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

/* ---------------- client hydration ---------------- */

function applyHeadline(root, intel) {
  if (!intel.headline) return;
  const set = (sel, text) => { const el = root.querySelector(sel); if (el && el.textContent !== text) el.textContent = text; };
  set('[data-pbe-av-kicker]', intel.headline.kicker);
  set('[data-pbe-av-title]', intel.headline.title);
  set('[data-pbe-av-sub]', intel.headline.sub);
  root.setAttribute('data-intel-mode', intel.mode);
  root.setAttribute('data-intel-level', String(intel.level));
  root.classList.remove('is-data', 'is-story', 'is-impact');
  root.classList.add(`is-${intel.mode}`);
  const chip = root.querySelector('[data-pbe-av-freshness]');
  if (chip) {
    const holder = document.createElement('div');
    holder.innerHTML = freshnessChip(intel);
    chip.replaceWith(holder.firstElementChild);
  }
}

function settleLiveHead(root, intel, done) {
  const head = root.querySelector('[data-pbe-av-live-head]');
  if (!head) return;
  if (intel.hasLiveData) {
    const small = head.querySelector('[data-pbe-av-live-updated]');
    if (small) small.textContent = intel.freshness.label;
  } else if (done) {
    head.remove();
  }
}

export async function mountArticleVisuals(article, manifest) {
  const root = document.querySelector('[data-pbe-article-visuals]');
  if (!root) return;
  const intel = buildArticleIntelligence(article, manifest);
  const adapter = adapterFor(intel.sport);
  const live = { team: null, player: null, fetchedAt: null };
  const pending = [];

  const refresh = (done = false) => {
    const next = buildArticleIntelligence(article, manifest, live);
    if (next.level) applyHeadline(root, next);
    settleLiveHead(root, next, done);
    if (done) {
      const note = root.querySelector('[data-pbe-av-source]');
      const html = renderSourceNote(next, true);
      if (note && !html) note.remove();
      else if (note && html) {
        const holder = document.createElement('div');
        holder.innerHTML = html;
        note.replaceWith(holder.firstElementChild);
      }
    }
  };

  const teamSlot = root.querySelector('[data-pbe-team-slot]');
  if (teamSlot && intel.expect.team && adapter?.team) {
    pending.push(adapter.team({}, intel.entities.team)
      .catch(() => null)
      .then((team) => {
        const html = team ? renderTeamData(team) : '';
        if (!html) { teamSlot.remove(); return; }
        live.team = team;
        live.fetchedAt = new Date().toISOString();
        teamSlot.outerHTML = html;
        const card = root.querySelector('[data-pbe-team-card]');
        card?.classList.add('has-data');
        const label = card?.querySelector('[data-pbe-team-label]');
        if (label) label.textContent = 'TEAM SNAPSHOT';
        const sub = card?.querySelector('[data-pbe-team-sub]');
        if (sub && (team.division || team.conference)) sub.textContent = `${team.division || team.conference}${team.seasonState === 'prior_season' ? ' · last season' : ''} →`;
        refresh();
      }));
  } else {
    teamSlot?.remove();
  }

  const playerSlot = root.querySelector('[data-pbe-player-chart]');
  if (playerSlot && intel.expect.player && adapter?.player) {
    pending.push(adapter.player({}, intel.expect.player, article)
      .catch(() => null)
      .then((data) => {
        const html = renderPlayerContext(data);
        if (!html) { playerSlot.remove(); return; }
        live.player = data;
        live.fetchedAt = live.fetchedAt || new Date().toISOString();
        playerSlot.innerHTML = html;
        // The charted player now has a full card; don't repeat them as a chip.
        const focus = root.querySelector('[data-pbe-focus]');
        const chip = focus && intel.expect.player.path
          ? [...focus.querySelectorAll('.pbe-av-focus-row a')].find((a) => a.getAttribute('href') === intel.expect.player.path)
          : null;
        if (chip) {
          chip.remove();
          const row = focus.querySelector('.pbe-av-focus-row');
          if (!row?.children.length) focus.remove();
          else row.setAttribute('data-count', String(row.children.length));
        }
        refresh();
      }));
  } else {
    playerSlot?.remove();
  }

  await Promise.all(pending);
  refresh(true);
  root.setAttribute('data-intel-hydrated', 'true');
}
