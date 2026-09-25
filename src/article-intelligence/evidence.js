/**
 * PUBLISHED EVIDENCE — numbers explicitly written in the frozen article.
 *
 * Rules (Data Intelligence V3):
 *  - Semantic, sport-specific patterns only. We never regex "every number".
 *  - A captured number span is claimed once. Two patterns can never turn the
 *    same digits into two different stats ("stopped 27 of 29 shots" is one
 *    SV/SA fact, not SV + SOG).
 *  - Speculative / projected / line-setting sentences never become evidence.
 *  - The complete supporting sentence travels with every card, unclipped.
 */

const WORD_NUMBERS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
};
const WORDS = Object.keys(WORD_NUMBERS).join('|');

// Numeric token (1,234 / 12 / 12.5) and numeric-or-word token.
const N = '\\b(\\d{1,3}(?:,\\d{3})+|\\d+(?:\\.\\d+)?)';
const NW = `\\b(\\d{1,3}(?:,\\d{3})+|\\d+(?:\\.\\d+)?|${WORDS})`;
const REC = '(\\d{1,2}-\\d{1,2}(?:-\\d{1,2})?)';
const CLOCK = '(\\d{1,2}:\\d{2})';

const ORDINAL_ROUND = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5 };

const ALLOWED_BEFORE = /(?:allowed|surrendered|gave up|yielded|conceded)\s+(?:just\s+|only\s+|a\s+)?$/i;
const NOT_AT_BATS_AFTER = /^\s*(?:success|on stolen|in stolen|stolen|on steal|in steal|on save|in save|conversion|on field goals?|on kicks?)/i;

// Applied to EVERY pattern. A number that is the top of a range ("8-10
// targets"), a threshold ("fewer than 200 yards"), an approximation ("close
// to 19 minutes") or a rate denominator ("per 36 minutes") is not a stat and
// cannot be shown without the words around it.
const GLOBAL_BEFORE_REJECT = [
  /\d\s*(?:[-–—]|to)\s*$/i,
  /(?:fewer than|less than|more than|greater than|at least|at most|upwards of|north of|south of|in excess of|\bnearly|\balmost|\bclose to|\baround|\broughly|\bapproximately|\babout)\s+$/i,
  /\bper\s+$/i,
];

// Count stats: a decimal is only legitimate as a per-game average, which is
// then labeled as such. Anything else ("a 1.05 interception rate") is a rate
// mislabeled as a count and is dropped.
const COUNT_LABELS = new Set([
  'TD', 'PASS TD', 'RUSH TD', 'REC TD', 'INT', 'REC', 'TGT', 'CAR', 'TKL', 'TFL', 'STARTS', 'GAMES', 'SNAPS',
  'PRESSURES', 'HURRIES', 'QB HIT', 'PASS YDS', 'RUSH YDS', 'REC YDS',
  'HR', 'H', 'RBI', 'K', 'BB', 'ER', 'TB', 'SB',
  'G', 'A', 'SOG', 'SV', 'GA',
  'TAKEDOWNS', 'SIG STR',
]);
const HALF_ALLOWED = new Set(['SACKS', 'SACKS ALLOWED']);
const PER_GAME_AFTER = /^[\s-]*(?:per|a)[\s-]+(?:game|contest|start|outing)\b/i;

export function evidenceNumber(raw) {
  const text = String(raw ?? '').trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(WORD_NUMBERS, text)) return WORD_NUMBERS[text];
  const normalized = text.replace(/,/g, '');
  if (!/^-?\d*\.?\d+$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function digits(raw) {
  const n = evidenceNumber(raw);
  return n == null ? String(raw ?? '') : String(n);
}

function pair(sep) {
  return (m) => `${digits(m[1])}${sep}${digits(m[2])}`;
}

function roundValue(raw) {
  const key = String(raw || '').toLowerCase().replace(/^(\d)(?:st|nd|rd|th)$/, '$1');
  const n = ORDINAL_ROUND[key] ?? evidenceNumber(key);
  return n == null ? null : `R${n}`;
}

function methodValue(raw) {
  const t = String(raw || '').toLowerCase();
  if (/technical knockout|\btko\b/.test(t)) return 'TKO';
  if (/knockout|\bko\b/.test(t)) return 'KO';
  if (/submission/.test(t)) return 'SUB';
  if (/unanimous/.test(t)) return 'UD';
  if (/split/.test(t)) return 'SD';
  if (/majority/.test(t)) return 'MD';
  if (/doctor/.test(t)) return 'TKO (DOC)';
  return null;
}

/**
 * Pattern entry:
 *   label   primary label (used for priority + default emit)
 *   re      source regex (compiled with d+g+i)
 *   emit    (m) => [[label, value, groupIndex?], ...]   default: [[label, m[1], 1]]
 *   before  regex tested on the 40 chars preceding the match → reject
 *   within  regex tested on the whole sentence → reject
 *   test    (value, m) => boolean extra guard
 */
const P = (label, source, extra = {}) => ({ label, source, ...extra });

const NFL = [
  P('CMP/ATT', `\\bcomplet(?:ed|es|ing)\\s+${NW}\\s+(?:of|for|out of)\\s+${NW}\\s+(?:passes|pass attempts|throws|attempts)(?:[^.!?]{0,24}?\\bfor\\s+${N}\\s+yards)?`, {
    emit: (m) => [['CMP/ATT', pair('/')(m), 1, 2], ...(m[3] ? [['PASS YDS', m[3], 3]] : [])],
  }),
  P('CMP%', `\\bcomplet(?:ed|es|ing)\\s+${N}%\\s+of\\s+(?:his\\s+|their\\s+)?(?:passes|throws|attempts|pass attempts)`),
  P('CAR', `\\b(?:rushed|ran)\\s+(?:the ball\\s+)?${NW}\\s+times\\s+for\\s+${N}\\s+(?:rushing\\s+)?yards`, {
    emit: (m) => [['CAR', m[1], 1], ['RUSH YDS', m[2], 2]],
  }),
  P('CAR', `${NW}\\s+(?:carries|rushes|rushing attempts|totes)\\s+for\\s+${N}\\s+(?:rushing\\s+)?yards`, {
    emit: (m) => [['CAR', m[1], 1], ['RUSH YDS', m[2], 2]],
  }),
  P('REC', `\\b(?:caught|hauled in|had|posted|recorded|finished with)\\s+${NW}\\s+(?:passes|balls|catches|receptions)\\s+(?:on\\s+${NW}\\s+targets\\s+)?for\\s+${N}\\s+(?:receiving\\s+)?yards`, {
    emit: (m) => [['REC', m[1], 1], ...(m[2] ? [['TGT', m[2], 2]] : []), ['REC YDS', m[3], 3]],
  }),
  P('REC', `${NW}\\s+(?:catches|receptions)\\s+for\\s+${N}\\s+(?:receiving\\s+)?yards`, {
    emit: (m) => [['REC', m[1], 1], ['REC YDS', m[2], 2]],
  }),
  P('SNAP SHARE', `\\bplayed\\s+${N}%\\s+of\\s+(?:the\\s+)?(?:team's\\s+|his\\s+team's\\s+)?(?:offensive\\s+|defensive\\s+)?snaps`),
  P('SNAP SHARE', `${N}%\\s+(?:offensive\\s+|defensive\\s+)?snap\\s+(?:share|rate)`),
  P('SNAP SHARE', `snap share(?:\\s+\\w+){0,4}\\s+(?:at|of)\\s+${N}%`),
  P('SNAPS', `\\bplayed\\s+${N}\\s+of\\s+(?:the\\s+)?(?:team's\\s+)?${N}\\s+(?:offensive\\s+|defensive\\s+)?snaps`, {
    emit: (m) => [['SNAPS', pair('/')(m), 1, 2]],
  }),
  P('SNAPS', `${N}\\s+(?:offensive\\s+|defensive\\s+|special[- ]teams\\s+)?snaps?\\b`),
  P('PRESS ALLOWED', `\\b(?:allowed|surrendered|gave up|yielded)\\s+(?:just\\s+|only\\s+)?${NW}\\s+(?:quarterback\\s+|QB\\s+)?pressures?\\b`),
  P('SACKS ALLOWED', `\\b(?:allowed|surrendered|gave up|yielded)\\s+(?:just\\s+|only\\s+)?${NW}\\s+sacks?\\b`),
  P('SACKS ALLOWED', `${NW}\\s+sacks?\\s+allowed\\b`),
  P('PRESSURES', `${NW}\\s+(?:quarterback\\s+|QB\\s+)?pressures?\\b`, { before: ALLOWED_BEFORE }),
  P('HURRIES', `${NW}\\s+hurries\\b`, { before: ALLOWED_BEFORE }),
  P('QB HIT', `${NW}\\s+(?:quarterback|QB)\\s+hits?\\b`, { before: ALLOWED_BEFORE }),
  P('TFL', `${NW}\\s+tackles?\\s+for\\s+(?:a\\s+)?loss`),
  P('SACKS', `${NW}\\s+sacks?\\b(?!\\s+allowed)`, { before: ALLOWED_BEFORE }),
  P('PASS YDS', `${N}\\s+passing\\s+yards?\\b`),
  P('PASS YDS', `\\b(?:threw|passed)\\s+for\\s+${N}\\s+yards?\\b`),
  P('RUSH YDS', `${N}\\s+rushing\\s+yards?\\b`),
  P('RUSH YDS', `\\b(?:rushed|ran)\\s+for\\s+${N}\\s+yards?\\b`),
  P('REC YDS', `${N}\\s+receiving\\s+yards?\\b`),
  P('REC', `${NW}\\s+(?:receptions|catches)\\b`),
  P('TGT', `${NW}\\s+targets?\\b`),
  P('PASS TD', `${NW}\\s+touchdown\\s+pass(?:es)?\\b`),
  P('TD', `${NW}\\s+(passing\\s+|rushing\\s+|receiving\\s+|total\\s+)?(?:touchdowns?|TDs?)\\b`, {
    emit: (m) => [[{ passing: 'PASS TD', rushing: 'RUSH TD', receiving: 'REC TD' }[String(m[2] || '').trim().toLowerCase()] || 'TD', m[1], 1]],
  }),
  P('INT', `${NW}\\s+interceptions?\\b`),
  P('TKL', `${NW}\\s+(?:total\\s+|combined\\s+|solo\\s+)?tackles\\b`),
  P('STARTS', `${N}\\s+(?:of them\\s+)?(?:career\\s+|NFL\\s+|regular[- ]season\\s+|consecutive\\s+)?starts\\b`, { before: /\bweek\s+$/i }),
  P('GAMES', `${N}\\s+(?:[a-z-]+\\s+){0,5}?appearances\\b`),
  P('GAMES', `${N}\\s+(?:career\\s+)?games\\s+played\\b`),
];

const MLB = [
  P('H-AB', `\\bwent\\s+${NW}[- ]for[- ]${NW}\\b`, { emit: (m) => [['H-AB', pair('-for-')(m), 1, 2]], after: NOT_AT_BATS_AFTER }),
  P('H-AB', `\\b(\\d{1,2})-for-(\\d{1,3})\\b`, { emit: (m) => [['H-AB', pair('-for-')(m), 1, 2]], after: NOT_AT_BATS_AFTER }),
  P('CAREER K', `${N}(?:st|nd|rd|th)?\\s+career\\s+strikeouts?\\b`),
  P('ERA', `${N}\\s+ERA\\b`),
  P('ERA', `\\bERA(?:\\s+(?:of|at|was|is|to))?\\s+${N}\\b`),
  P('WHIP', `(\\d\\.\\d{2})\\s+WHIP\\b`),
  P('WHIP', `\\bWHIP(?:\\s+(?:of|at|was|is|to))?\\s+(\\d\\.\\d{2})\\b`),
  P('K/9', `strikeout rate[^.!?]{0,40}?${N}\\s+per nine\\b`),
  P('K/9', `(?:fanned|struck out)[^.!?]{0,40}?${N}\\s+per nine\\b`),
  P('OPP K%', `strike out at\\s+(?:a\\s+)?${N}%\\s+clip\\b`),
  P('EXIT VELO', `exit velocit(?:y|ies)[^.!?]{0,30}?(\\d{2,3}(?:\\.\\d)?)\\s*mph\\b`),
  P('EXIT VELO', `(\\d{2,3}(?:\\.\\d)?)[- ]?mph\\s+exit velocit(?:y|ies)`),
  P('VELO', `(?:fastball|four-seamer|four-seam|sinker|heater|cutter|velo(?:city)?)[^.!?]{0,40}?(\\d{2,3}(?:\\.\\d)?)\\s*mph\\b`, { within: /\b(?:wind|gusts?|breeze)\b/i }),
  P('VELO', `(\\d{2,3}(?:\\.\\d)?)[- ]?mph\\s+(?:fastball|four-seamer|sinker|heater|cutter|slider)`, { within: /\b(?:wind|gusts?|breeze)\b/i }),
  P('VELO', `(\\d{2,3}\\.\\d)\\s*mph\\b`, { within: /\b(?:wind|gusts?|breeze|car|highway)\b/i, test: (v) => v >= 70 && v <= 106 }),
  P('K/9', `${N}\\s+K/9\\b`),
  P('K', `\\b(?:struck out|fanned|punched out)\\s+${NW}\\b(?!\\s+(?:per|percent|%))`),
  P('K', `${NW}\\s+(?:strikeouts?|Ks?)\\b(?!\\s*[/%]|\\s+(?:per|rate)\\b)`, { test: (v) => v <= 30 }),
  P('BB', `${NW}\\s+walks?\\b(?!-)`),
  P('IP', `${NW}(?:\\s+(1/3|2/3))?\\s+(?:scoreless\\s+|shutout\\s+|strong\\s+|quality\\s+)?innings?(?:\\s+pitched|\\s+of work)?\\b`, {
    before: /\b(?:first|last|final|next|opening|early|late|middle|after|through|thru|past|by)\s+$/i,
    emit: (m) => [['IP', m[2] ? `${digits(m[1])} ${m[2]}` : m[1], 1]],
  }),
  P('ER', `${NW}\\s+earned runs?\\b`),
  P('HR', `${NW}\\s+(?:home runs?|homers?|HRs?)\\b`),
  P('RBI', `${NW}\\s+(?:RBIs?|runs batted in)\\b`),
  P('H', `${NW}\\s+hits?\\b(?!-)`),
  P('TB', `${NW}\\s+total bases?\\b`),
  P('SB', `${NW}\\s+(?:stolen bases|steals)\\b`),
  P('AVG', `\\b(?:batting|hitting)\\s+(\\.\\d{3})\\b`),
  P('AVG', `(\\.\\d{3})\\s+(?:batting\\s+)?average\\b`),
  P('OBP', `(\\.\\d{3})\\s+(?:OBP|on-base percentage)\\b`),
  P('SLG', `(\\.\\d{3})\\s+(?:SLG|slugging(?: percentage)?)\\b`),
  P('OPS', `(\\d?\\.\\d{3})\\s+OPS\\b`),
  P('OPS', `\\bOPS(?:\\s+(?:of|at|was|is|to))?\\s*(\\d?\\.\\d{3})\\b`),
];

const PTS_AFTER = /^[\s-]*(?:per\s+(?:goal|assist|shot|win|save|block|hit)|below|above|higher|lower|better|worse)\b/i;
const BASKETBALL_AFTER = /^\s+per\s+(?:100|36|48|40)\b/i;
const PTS_BEFORE = /(?:\bare|\bis|\bworth|\bby|lead of|deficit of|margin of|trail(?:ed|ing|s)? by|down|up|outscored[^.]{0,24}by|won by|lost by|spread of)\s+$/i;

const BASKETBALL = [
  P('3P', `\\b${NW}[- ]of[- ]${NW}\\s+(?:from three|from deep|from beyond the arc|from 3|on threes|on 3-pointers|from three-point range|from long range)`, {
    emit: (m) => [['3P', pair('-')(m), 1, 2]],
  }),
  P('FG', `\\b${NW}[- ]of[- ]${NW}\\s+(?:shooting|from the field|from the floor|FG)\\b`, {
    emit: (m) => [['FG', pair('-')(m), 1, 2]],
  }),
  P('3P%', `\\bshot\\s+${N}%\\s+from\\s+(?:three|deep|beyond the arc|3)`),
  P('FG%', `\\bshot\\s+${N}%(?!\\s+from\\s+(?:three|deep|beyond|3|the line|the free))`),
  P('FG%', `${N}%\\s+(?:shooting\\s+)?from the field\\b`),
  P('FG%', `(?:field[- ]goal(?: percentage| pct)?(?:\\s+(?:of|at|was|is))?\\s*)${N}%`),
  P('MIN', `\\bplayed\\s+${NW}\\s+minutes\\b`),
  P('MIN', `${N}\\s+minutes\\b`, { before: /(?:final|last|first|remaining|over the|opening|closing)\s+$/i }),
  P('PTS', `${NW}\\s+points?\\b`, { before: PTS_BEFORE, after: PTS_AFTER }),
  P('REB', `${NW}\\s+(?:rebounds?|boards)\\b`),
  P('AST', `${NW}\\s+assists?\\b`),
  P('STL', `${NW}\\s+steals?\\b`),
  P('BLK', `${NW}\\s+(?:blocks|blocked shots)\\b`),
  P('3PM', `\\b(?:made|hit|drained|knocked down|buried|sank|connected on)\\s+${NW}\\s+(?:three-pointers?|3-pointers?|threes|triples|3s)\\b`),
  P('3PM', `${NW}\\s+(?:three-pointers?|3-pointers?|threes|triples)\\b`),
  P('USAGE', `(?:usage(?: rate)?(?:\\s+(?:of|at|was|is))?\\s*)${N}%`),
];

const NHL = [
  P('TOI', `${CLOCK}\\s+(?:of\\s+)?(?:TOI|ice time|time on ice)\\b`),
  P('TOI', `\\b(?:TOI|ice time|time on ice)\\s+(?:of\\s+)?${CLOCK}`),
  P('TOI', `${N}\\s+minutes\\s+of\\s+(?:ice time|TOI)\\b`),
  P('SV/SA', `\\b(?:stopped|turned aside|saved|made)\\s+${NW}\\s+of\\s+${NW}\\s+shots\\b`, {
    emit: (m) => [['SV/SA', pair('/')(m), 1, 2]],
  }),
  P('SV%', `(?:save percentage|SV%)(?:\\s+(?:of|at|was|is))?\\s*(\\.\\d{3})\\b`),
  P('SV%', `(\\.\\d{3})\\s+(?:save percentage|SV%|sv pct)\\b`),
  P('GAA', `(\\d\\.\\d{2})\\s+(?:GAA|goals[- ]against average)\\b`),
  P('GAA', `\\b(?:GAA|goals[- ]against average)(?:\\s+(?:of|at|was|is))?\\s+(\\d\\.\\d{2})\\b`),
  P('GA', `\\b(?:allowed|surrendered|gave up|yielded)\\s+(?:just\\s+|only\\s+)?${NW}\\s+goals?\\b`),
  P('SV', `${NW}\\s+saves?\\b`),
  P('SOG', `${NW}\\s+shots?(?:\\s+on\\s+goal)?\\b(?!\\s+against|-)`, { before: /(?:blocked|faced|stopped|allowed|turned aside)\s+(?:just\s+|only\s+)?$/i }),
  P('G', `${NW}\\s+goals?\\b(?!\\s+against|-)`, { before: ALLOWED_BEFORE }),
  P('A', `${NW}\\s+assists?\\b`),
  P('PTS', `${NW}\\s+points?\\b`, { before: PTS_BEFORE, after: PTS_AFTER }),
];

const METHOD = '(KO|TKO|knockout|technical knockout|submission|(?:unanimous|split|majority)\\s+decision|doctor stoppage)';
const ROUND = '(first|second|third|fourth|fifth|[1-5](?:st|nd|rd|th)?)';

const UFC = [
  P('FINISH', `\\b(?:via|by)\\s+${METHOD}\\b(?:[^.!?]{0,40}?\\bat\\s+${CLOCK})?[^.!?]{0,30}?\\b(?:of|in)\\s+(?:the\\s+)?${ROUND}[- ]round\\b`, {
    emit: (m) => [['METHOD', methodValue(m[1]), 1], ...(m[2] ? [['TIME', m[2], 2]] : []), ['ROUND', roundValue(m[3]), 3]],
  }),
  P('FINISH', `\\b${ROUND}[- ]round\\s+${METHOD}\\b`, {
    emit: (m) => [['ROUND', roundValue(m[1]), 1], ['METHOD', methodValue(m[2]), 2]],
  }),
  P('RECORD', `${REC}(?:\\s+\\(\\d+\\s+NC\\))?\\s+(?:pro(?:fessional)?\\s+|MMA\\s+|UFC\\s+|overall\\s+|career\\s+)?record\\b`),
  P('RECORD', `\\brecord\\s+(?:of|to|at|stands at|sits at|improved to|moved to|fell to|dropped to)\\s+${REC}\\b`),
  P('RECORD', `\\b(?:improv(?:ed|es|ing)|mov(?:ed|es|ing)|f(?:ell|alls|alling)|dropp(?:ed|s|ing))\\s+to\\s+${REC}\\b`),
  P('UFC RECORD', `${REC}\\s+in\\s+the\\s+UFC\\b`),
  P('SIG STR', `\\b${N}[- ]of[- ]${N}\\s+significant strikes\\b`, { emit: (m) => [['SIG STR', pair('/')(m), 1, 2]] }),
  P('SIG STR', `${N}\\s+(?:significant|sig\\.?)\\s+strikes\\b`),
  P('TAKEDOWNS', `\\b${NW}[- ]of[- ]${NW}\\s+takedowns?\\b`, { emit: (m) => [['TAKEDOWNS', pair('/')(m), 1, 2]] }),
  P('TAKEDOWNS', `${NW}\\s+takedowns?\\b`),
  P('CTRL TIME', `${CLOCK}\\s+of\\s+(?:ground\\s+|cage\\s+|top\\s+)?control(?:\\s+time)?\\b`),
  P('REACH', `(\\d{2}(?:\\.\\d)?)[- ]inch reach\\b`, { emit: (m) => [['REACH', `${m[1]}"`, 1]] }),
  P('REACH', `\\breach of\\s+(\\d{2}(?:\\.\\d)?)\\s*(?:inches|in\\.)`, { emit: (m) => [['REACH', `${m[1]}"`, 1]] }),
];

export const EVIDENCE_PATTERNS = {
  nfl: NFL,
  mlb: MLB,
  nba: BASKETBALL,
  wnba: BASKETBALL,
  nhl: NHL,
  ufc: UFC,
};

export const EVIDENCE_METRIC_PRIORITY = {
  nhl: ['PTS', 'G', 'A', 'SOG', 'SV/SA', 'SV', 'SV%', 'GAA', 'GA', 'TOI'],
  nba: ['PTS', 'REB', 'AST', '3PM', 'FG', '3P', 'FG%', '3P%', 'STL', 'BLK', 'USAGE', 'MIN'],
  nfl: ['CMP/ATT', 'CMP%', 'PASS YDS', 'PASS TD', 'CAR', 'RUSH YDS', 'RUSH TD', 'REC', 'REC YDS', 'REC TD', 'TGT', 'TD', 'INT', 'SNAP SHARE', 'SNAPS', 'SACKS', 'PRESSURES', 'HURRIES', 'QB HIT', 'TKL', 'TFL', 'PRESS ALLOWED', 'SACKS ALLOWED', 'GAMES', 'STARTS'],
  mlb: ['H-AB', 'ERA', 'WHIP', 'K/9', 'K', 'IP', 'BB', 'ER', 'HR', 'RBI', 'TB', 'H', 'SB', 'AVG', 'OBP', 'SLG', 'OPS', 'CAREER K', 'OPP K%', 'VELO', 'EXIT VELO'],
  ufc: ['RECORD', 'UFC RECORD', 'METHOD', 'ROUND', 'TIME', 'SIG STR', 'TAKEDOWNS', 'CTRL TIME', 'REACH'],
};
EVIDENCE_METRIC_PRIORITY.wnba = EVIDENCE_METRIC_PRIORITY.nba;

// Labels whose value is a label/category rather than a count. A card built
// only from these is not quantitative evidence.
const NON_NUMERIC_LABELS = new Set(['METHOD']);
const PERCENT_LABELS = new Set(['CMP%', 'SNAP SHARE', 'USAGE', 'FG%', '3P%', 'OPP K%']);
const RATE_LABELS = new Set(['ERA', 'WHIP', 'K/9', 'AVG', 'OBP', 'SLG', 'OPS', 'SV%', 'GAA', 'VELO', 'EXIT VELO', 'TOI', 'CTRL TIME', 'TIME']);
const MAX_PER_LABEL = 2;
const MAX_CARDS = 4;

const COMPILED = new Map();
function compiled(entry) {
  if (!COMPILED.has(entry)) COMPILED.set(entry, new RegExp(entry.source, 'dgi'));
  return COMPILED.get(entry);
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

export function articleText(article) {
  return strip(article?.body_html || article?.body || article?.summary || '');
}

export function evidenceSentenceAround(text, index) {
  const left = Math.max(text.lastIndexOf('. ', index), text.lastIndexOf('! ', index), text.lastIndexOf('? ', index));
  const rest = text.slice(index);
  const ends = ['. ', '! ', '? '].map((x) => rest.indexOf(x)).filter((x) => x >= 0);
  const right = ends.length ? index + Math.min(...ends) + 1 : text.length;
  // Evidence cards are explanatory, so they must never clip a published
  // sentence to fit a visual card. Return the complete sentence.
  return text.slice(left >= 0 ? left + 2 : 0, right).trim();
}

export function evidenceContextIsSpeculative(context) {
  const text = String(context || '');
  if (/\b(?:typically|expected?|project(?:ed|ion|ions|s)?|forecast|estimated?|likely|on pace (?:for|to)|pace to|would need|needs? (?:to|just)|over\/under|O\/U)\b/i.test(text)) return true;
  if (/\b(?:line|total|prop)\s+(?:of|at|is|sits at|set at|opened at|was set at)\s+\d/i.test(text)) return true;
  if (/\bset at\s+\d/i.test(text)) return true;
  if (/(?:^|[,;:—–]\s*)(?:but\s+|and\s+|so\s+|even\s+|conversely,?\s+)?if\b/i.test(text)) return true;
  if (/\b(?:over|under)\s+\d+\.5\b/i.test(text)) return true;
  if (/\b(?:ready to|readiness to|willing to|able to|ability to|capacity to|plans? to|planned to|intends? to|aims? to|hopes? to)\b/i.test(text)) return true;
  if (/\b(?:could|may|might|would|should)\b/i.test(text) && /\b(?:line|market|price|prop|range|threshold|odds)\b/i.test(text)) return true;
  if (/\d+(?:\.\d+)?\s*(?:to|[-–—])\s*\d+(?:\.\d+)?\s+(?:strikeouts?|points?|yards?|rebounds?|assists?|saves?|shots?|goals?|takedowns?)/i.test(text)) return true;
  return false;
}

export function evidenceContextKey(context) {
  return String(context || '')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function isYearLike(raw) {
  return /^(?:19|20)\d{2}$/.test(String(raw || '').trim());
}

export function formatEvidenceValue(label, raw) {
  const text = String(raw ?? '').trim();
  if (!text) return '';
  if (/[/:"]|-for-|^R\d$|^[A-Z]/.test(text) || /^\d+-\d+(?:-\d+)?$/.test(text)) return text;
  if (/^\d+ [12]\/3$/.test(text)) return text;
  const numeric = evidenceNumber(text);
  if (numeric == null) return '';
  if (PERCENT_LABELS.has(label)) return `${numeric}%`;
  if (/^\.\d+/.test(text)) return text;
  if (RATE_LABELS.has(label) && /\.\d/.test(text)) return text.replace(/,/g, '');
  if (Number.isInteger(numeric) && Math.abs(numeric) >= 1000) return numeric.toLocaleString('en-US');
  return String(numeric);
}

export function evidenceLabel(label, value) {
  const numeric = evidenceNumber(value);
  if (label === 'QB HIT') return numeric === 1 ? 'QB HIT' : 'QB HITS';
  return label;
}

/** A metric value is displayable only if it is a real, finite, non-placeholder value. */
export function isDisplayableValue(value) {
  const text = String(value ?? '').trim();
  if (!text) return false;
  if (/^(?:nan|undefined|null|infinity|-infinity|—|-|--)$/i.test(text)) return false;
  if (/\b(?:NaN|undefined|null)\b/.test(text)) return false;
  return true;
}

function metricIsNumeric(metric) {
  if (NON_NUMERIC_LABELS.has(metric.label)) return false;
  return /\d/.test(String(metric.value || ''));
}

function overlaps(claims, start, end) {
  return claims.some(([s, e]) => start < e && end > s);
}

/**
 * Extract grouped published evidence from the frozen article body.
 * Returns [{ context, metrics:[{label,value}], position }] — one card per sentence.
 */
export function extractPublishedEvidence(article) {
  const sport = String(article?.sport || '').toLowerCase();
  const patterns = EVIDENCE_PATTERNS[sport] || [];
  const text = articleText(article);
  if (!text || !patterns.length) return [];

  const claims = [];
  const perLabel = new Map();
  const seenLabelValue = new Set();
  const rows = [];

  for (const entry of patterns) {
    const re = compiled(entry);
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      if (m[0].length === 0) { re.lastIndex += 1; continue; }
      const before = text.slice(Math.max(0, m.index - 40), m.index);
      if (entry.before && entry.before.test(before)) continue;
      if (GLOBAL_BEFORE_REJECT.some((re2) => re2.test(before))) continue;
      const end = m.index + m[0].length;
      const after = text.slice(end, end + 40);
      if (entry.after && entry.after.test(after)) continue;
      if ((sport === 'nba' || sport === 'wnba') && BASKETBALL_AFTER.test(after)) continue;
      // "per 100 possessions", "per seven playoff games": an odd denominator
      // makes the number a rate that a bare label would misstate.
      if (/^[\s-]+per\s+(?!game|contest|start|outing|night|season|year|match|fight|nine)/i.test(after)) continue;
      const context = evidenceSentenceAround(text, m.index);
      if (!context || evidenceContextIsSpeculative(context)) continue;
      if (entry.within && entry.within.test(context)) continue;

      const emitted = entry.emit
        ? entry.emit(m)
        : [[entry.label, m[1], 1]];

      // Resolve the digits' spans for the claim check.
      const spans = [];
      for (const item of emitted) {
        for (const idx of item.slice(2)) {
          const span = m.indices?.[idx];
          if (span) spans.push(span);
        }
      }
      if (spans.some(([s, e]) => overlaps(claims, s, e))) continue;

      const metrics = [];
      for (let [label, raw, groupIdx] of emitted) {
        if (raw == null || raw === '') continue;
        const rawGroup = m[groupIdx];
        if (rawGroup && isYearLike(rawGroup) && !['CAREER K'].includes(label) && !/\//.test(String(raw))) continue;
        const numeric = evidenceNumber(rawGroup);
        if (entry.test && numeric != null && !entry.test(numeric, m)) continue;
        if (numeric != null && COUNT_LABELS.has(label) && raw === rawGroup
          && (/\baverag(?:e|ed|es|ing)\b(?:\s+\S+){0,4}\s*$/i.test(before) || PER_GAME_AFTER.test(after))) {
          label = `${label}/G`;
        } else if (numeric != null && !Number.isInteger(numeric) && typeof raw === 'string' && raw === rawGroup) {
          if (HALF_ALLOWED.has(label)) {
            if (!Number.isInteger(numeric * 2)) continue;
          } else if (COUNT_LABELS.has(label)) {
            if (!PER_GAME_AFTER.test(after)) continue;
            label = `${label}/G`;
          }
        }
        const value = formatEvidenceValue(label, raw);
        if (!isDisplayableValue(value)) continue;
        metrics.push({ label, value });
      }
      if (!metrics.length || !metrics.some(metricIsNumeric)) continue;

      // Per-label caps and article-wide label+value dedupe.
      const fresh = metrics.filter((metric) => {
        const key = `${metric.label}|${metric.value}`;
        if (seenLabelValue.has(key)) return false;
        if ((perLabel.get(metric.label) || 0) >= MAX_PER_LABEL) return false;
        return true;
      });
      if (!fresh.length || !fresh.some(metricIsNumeric)) continue;

      for (const metric of fresh) {
        seenLabelValue.add(`${metric.label}|${metric.value}`);
        perLabel.set(metric.label, (perLabel.get(metric.label) || 0) + 1);
      }
      for (const span of spans) claims.push(span);
      rows.push({ context, metrics: fresh, position: m.index });
    }
  }

  return groupEvidence(rows, sport);
}

function groupEvidence(rows, sport) {
  const groups = new Map();
  for (const row of rows) {
    const key = evidenceContextKey(row.context);
    if (!key) continue;
    let group = groups.get(key);
    if (!group) {
      group = { context: row.context, metrics: [], position: row.position };
      groups.set(key, group);
    }
    group.position = Math.min(group.position, row.position);
    // One value per label per card: "RUSH YDS 194 · RUSH YDS 17" is two
    // different subjects squeezed into one unit; the sentence carries both.
    for (const metric of row.metrics) {
      if (!group.metrics.some((x) => x.label === metric.label)) group.metrics.push(metric);
    }
  }

  // One published thought reads as one evidence unit; editorial totals lead.
  const priority = EVIDENCE_METRIC_PRIORITY[sport] || [];
  const rank = (label) => {
    const i = priority.indexOf(String(label || '').replace(/\/G$/, ''));
    return i < 0 ? 999 : i;
  };
  const list = [...groups.values()];
  for (const group of list) group.metrics.sort((a, b) => rank(a.label) - rank(b.label));
  list.sort((a, b) => (rank(a.metrics[0]?.label) - rank(b.metrics[0]?.label)) || (a.position - b.position));
  return list.slice(0, MAX_CARDS).map(({ context, metrics }) => ({ context, metrics }));
}

/** Count of quantitative metrics across evidence cards. */
export function quantitativeEvidenceCount(rows) {
  return (rows || []).reduce((sum, row) => sum + (row.metrics || []).filter(metricIsNumeric).length, 0);
}
