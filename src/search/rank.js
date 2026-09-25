/**
 * src/search/rank.js — PropBetEdge network search relevance.
 *
 * Pure and deterministic: no I/O, no clock unless one is passed in, no LLM.
 * The pbe-entity-hub Worker ranks its /v1/search results with this module and
 * the browser palette ranks its offline fallback with the SAME module, so the
 * two can never disagree about what "best match" means.
 *
 * Tier ladder (a doc's score is the best tier it reaches, plus small, bounded
 * modifiers that only ever reorder docs inside a tier):
 *
 *   1000  exact entity name            "aaron judge"   -> Aaron Judge
 *    950  exact alias                  "nyy", "twins"  -> New York Yankees / Minnesota Twins
 *    800  full-name prefix             "aaron judg"    -> Aaron Judge
 *    700  token prefix (every token)   "judge", "pantoja van"
 *    600  initials / abbreviation      "sga"           -> Shai Gilgeous-Alexander
 *    380–560 fuzzy (Damerau-Levenshtein, 1–2 edits scaled by token length)
 *    ≤ 480 content / story keyword match (title words, player + team tags)
 *
 * Stories live in their own band: a headline that merely STARTS with a
 * player's name can never outrank the player, but an exact headline still
 * reaches the top tier, so an old story stays findable by its title.
 */

import { normalizeName } from '../entity-graph/text.js';

export const SEARCH_TYPES = Object.freeze(['player', 'team', 'event', 'tool', 'learn', 'story']);
export const SEARCH_SPORTS = Object.freeze(['mlb', 'nfl', 'nba', 'wnba', 'nhl', 'ufc']);
export const MIN_QUERY_LENGTH = 2;
export const MAX_QUERY_LENGTH = 80;

// Deterministic tie-break when two docs score identically. Network order, the
// same order the palette's "Live intelligence" row uses.
const SPORT_ORDER = Object.freeze({ mlb: 0, nfl: 1, nba: 2, wnba: 3, nhl: 4, ufc: 5 });
const TYPE_ORDER = Object.freeze({ player: 0, team: 1, event: 2, tool: 3, learn: 4, story: 5 });

// Words that name a league. In a multi-word query they scope and boost rather
// than having to appear in the doc's own title ("UFC Pantoja" -> Pantoja).
const SPORT_WORDS = Object.freeze({
  mlb: 'mlb', baseball: 'mlb',
  nfl: 'nfl', football: 'nfl',
  nba: 'nba', basketball: 'nba',
  wnba: 'wnba',
  nhl: 'nhl', hockey: 'nhl',
  ufc: 'ufc', mma: 'ufc',
});

const TIER = Object.freeze({
  EXACT: 1000,
  ALIAS: 950,
  PREFIX: 800,
  TOKEN_PREFIX: 700,
  INITIALS: 600,
  FUZZY: 560,
  STORY_TOP: 480,
});

/** Accent-folded, punctuation-free, lower-case form used for every comparison. */
export function normalizeQuery(value) {
  return normalizeName(String(value || '').slice(0, MAX_QUERY_LENGTH * 2)).slice(0, MAX_QUERY_LENGTH).trim();
}

export function tokenize(value) {
  const normalized = normalizeQuery(value);
  return normalized ? normalized.split(' ') : [];
}

/**
 * Optimal-string-alignment Damerau-Levenshtein distance with an early exit.
 * Returns max + 1 as soon as the distance is known to exceed `max`, so a scan
 * over thousands of names stays cheap.
 */
export function damerauLevenshtein(a, b, max = 2) {
  if (a === b) return 0;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > max) return max + 1;
  if (!la) return lb;
  if (!lb) return la;

  let prevPrev = new Array(lb + 1).fill(0);
  let prev = new Array(lb + 1);
  let curr = new Array(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;

  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= lb; j++) {
      const cb = b.charCodeAt(j - 1);
      const cost = ca === cb ? 0 : 1;
      let v = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && ca === b.charCodeAt(j - 2) && a.charCodeAt(i - 2) === cb) {
        v = Math.min(v, prevPrev[j - 2] + 1);
      }
      curr[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    const recycled = prevPrev;
    prevPrev = prev;
    prev = curr;
    curr = recycled;
  }
  return prev[lb];
}

/** Edits we tolerate for a query token of this length. */
export function allowedEdits(length) {
  if (length >= 7) return 2;
  if (length >= 4) return 1;
  return 0;
}

/**
 * Precompute the normalized forms of a search document once. Memoized per
 * object (WeakMap, so frozen docs work) so a warm isolate never re-tokenizes
 * its corpus.
 *
 * Doc shape (compact search document):
 *   { type, sport, id, title, subtitle, href, image?, aliases?: [], keywords?: [],
 *     date?: ISO, kind?: 'fight'|'event'|..., team?: string, position?: string,
 *     boost?: number }
 */
const PREPARED = new WeakMap();

export function prepareDoc(doc) {
  const cached = PREPARED.get(doc);
  if (cached) return cached;
  const title = normalizeQuery(doc.title);
  const titleTokens = title ? title.split(' ') : [];
  const aliases = [...new Set((doc.aliases || []).map(normalizeQuery).filter(Boolean))];
  const aliasTokens = new Set();
  for (const alias of aliases) for (const t of alias.split(' ')) aliasTokens.add(t);
  const keywordTokens = new Set();
  for (const kw of doc.keywords || []) for (const t of tokenize(kw)) keywordTokens.add(t);
  const nameTokens = [...new Set([...titleTokens, ...aliasTokens])];
  const prep = {
    title,
    compact: title.replace(/ /g, ''),
    titleTokens,
    aliases,
    nameTokens,
    keywordTokens: [...keywordTokens],
    initials: titleTokens.length >= 2 ? titleTokens.map((t) => t[0]).join('') : '',
    time: doc.date ? Date.parse(doc.date) || 0 : 0,
  };
  PREPARED.set(doc, prep);
  return prep;
}

/**
 * How well does one query token match one of the doc's tokens?
 *   3 exact token, 2 prefix, 1 fuzzy (with edit count), 0 none.
 */
function bestTokenMatch(qt, tokens, { fuzzy = true, isLast = false } = {}) {
  let best = { kind: 0, edits: 9, token: null };
  for (const t of tokens) {
    if (t === qt) return { kind: 3, edits: 0, token: t };
    if (t.startsWith(qt) && (qt.length >= 2 || isLast)) {
      if (best.kind < 2) best = { kind: 2, edits: 0, token: t };
      continue;
    }
    if (!fuzzy || best.kind >= 2) continue;
    const max = allowedEdits(qt.length);
    if (!max) continue;
    // Whole token typo ("ohtnai" -> "ohtani"), or a typo inside a partially
    // typed token ("mcdvai" -> "mcdavid" prefix).
    let edits = damerauLevenshtein(qt, t, max);
    if (edits > max && t.length > qt.length) edits = damerauLevenshtein(qt, t.slice(0, qt.length), max);
    if (edits <= max && edits < best.edits) best = { kind: 1, edits, token: t };
  }
  return best;
}

/**
 * Score one prepared doc against one normalized query (already stripped of
 * league words when `stripped` is true). Returns 0 when it does not match.
 */
function scoreAgainst(doc, prep, q, qTokens) {
  if (!q) return 0;
  const isStory = doc.type === 'story';

  // Exact name / exact alias. Exact headline included: an old story must stay
  // findable by the words it was published under.
  if (prep.title === q) return TIER.EXACT;
  if (!isStory && prep.aliases.includes(q)) return TIER.ALIAS;

  if (!isStory) {
    if (prep.title.startsWith(q) || prep.aliases.some((a) => a.startsWith(q))) {
      // Longer completions rank lower: "aaron judg" should prefer Aaron Judge
      // over "Aaron Judge Jr." were both to exist.
      return TIER.PREFIX - Math.min(40, Math.max(0, prep.title.length - q.length));
    }
    if (q.length >= 4 && prep.compact.startsWith(q.replace(/ /g, ''))) return TIER.PREFIX - 60;
  }

  // Token-level matching. Every query token must land on a distinct doc token.
  const nameTokens = prep.nameTokens;
  let exact = 0;
  let prefix = 0;
  let fuzzyEdits = 0;
  let fuzzyHits = 0;
  let allMatched = true;
  const used = new Set();
  for (let i = 0; i < qTokens.length; i++) {
    const qt = qTokens[i];
    const candidates = nameTokens.filter((t) => !used.has(t));
    const m = bestTokenMatch(qt, candidates, { fuzzy: !isStory, isLast: i === qTokens.length - 1 });
    if (!m.kind) { allMatched = false; break; }
    used.add(m.token);
    if (m.kind === 3) exact += 1;
    else if (m.kind === 2) prefix += 1;
    else { fuzzyHits += 1; fuzzyEdits += m.edits; }
  }

  if (allMatched && !isStory) {
    const coverage = used.size / Math.max(1, prep.titleTokens.length);
    if (!fuzzyHits) {
      return TIER.TOKEN_PREFIX + exact * 12 + Math.round(coverage * 60) - (prep.titleTokens.length > 6 ? 10 : 0);
    }
    // Fuzzy. Scaled by edits and by how much of the query was typo'd.
    const penalty = fuzzyEdits * 60 + fuzzyHits * 10;
    return Math.max(380, TIER.FUZZY - penalty + exact * 10 + Math.round(coverage * 20));
  }

  if (!isStory && prep.initials && q.length >= 2 && q.length <= 5 && !q.includes(' ') && prep.initials === q) {
    return TIER.INITIALS;
  }

  // Content band: title words + tags/keywords. Stories and tools live here
  // when the query is not their name.
  const haystack = isStory ? [...prep.titleTokens, ...prep.keywordTokens] : prep.keywordTokens;
  if (!haystack.length) return 0;
  let hits = 0;
  let exactHits = 0;
  for (let i = 0; i < qTokens.length; i++) {
    const m = bestTokenMatch(qTokens[i], haystack, { fuzzy: false, isLast: i === qTokens.length - 1 });
    if (m.kind) { hits += 1; if (m.kind === 3) exactHits += 1; }
  }
  if (!hits) return 0;
  const ratio = hits / qTokens.length;
  if (ratio < 1 && (qTokens.length < 3 || ratio < 0.66)) return 0;

  if (isStory) {
    const phrase = qTokens.length > 1 && (` ${prep.title} `).includes(` ${q} `);
    const tagged = (doc.aliases || []).length && prep.aliases.some((a) => a === q);
    let base = 300 + exactHits * 15;
    if (phrase) base = 420;
    if (tagged) base = Math.max(base, 450);
    return Math.min(TIER.STORY_TOP, Math.round(base * ratio));
  }
  // Tool/entity keyword match ("hr props" -> HR Targets, "injuries" -> Injuries).
  return Math.round((500 + exactHits * 20) * ratio);
}

/** Exact / alias / full-prefix only — the whole query read as one name. */
function wholeNameScore(doc, prep, q) {
  if (prep.title === q) return TIER.EXACT;
  if (doc.type === 'story') return 0;
  if (prep.aliases.includes(q)) return TIER.ALIAS;
  if (prep.title.startsWith(q) || prep.aliases.some((a) => a.startsWith(q))) {
    return TIER.PREFIX - Math.min(40, Math.max(0, prep.title.length - q.length));
  }
  return 0;
}

/** Split league words out of a multi-word query. */
export function analyzeQuery(query) {
  const q = normalizeQuery(query);
  const tokens = q ? q.split(' ') : [];
  const sports = [];
  const rest = [];
  for (const t of tokens) {
    if (SPORT_WORDS[t] && tokens.length > 1) sports.push(SPORT_WORDS[t]);
    else rest.push(t);
  }
  return { q, tokens, sports: [...new Set(sports)], stripped: rest.join(' '), strippedTokens: rest };
}

/**
 * Recency modifier for dated docs.
 *   stories: up to +60 for today, 45-day half-life (they live in their own band)
 *   events:  up to +15 — enough to order cards among themselves, never enough
 *            to lift a bout above the fighter the query named
 */
function recencyBoost(doc, prep, now) {
  if (!prep.time || !now) return 0;
  const ageDays = (now - prep.time) / 86_400_000;
  if (doc.type === 'story') return ageDays < 0 ? 0 : Math.round(60 * Math.pow(0.5, ageDays / 45));
  if (ageDays < 0) return ageDays > -120 ? 15 : 5;
  return Math.round(15 * Math.pow(0.5, ageDays / 45));
}

export function scoreDoc(doc, analysis, { now = 0 } = {}) {
  const prep = prepareDoc(doc);
  let full = scoreAgainst(doc, prep, analysis.q, analysis.tokens);
  let stripped = 0;
  let sportMatched = false;
  if (analysis.sports.length && analysis.stripped) {
    sportMatched = analysis.sports.includes(doc.sport);
    if (sportMatched) {
      stripped = scoreAgainst(doc, prep, analysis.stripped, analysis.strippedTokens);
      // The league word already earned the sport boost; it must not ALSO count
      // as a matched title token ("UFC Pantoja" -> the fighter, not every
      // "UFC 3xx: ... Pantoja" card). Whole-name hits ("UFC 320", "UFC
      // Rankings") still count in full.
      full = wholeNameScore(doc, prep, analysis.q);
    }
  }
  let score = Math.max(full, stripped);
  if (!score) return 0;
  if (sportMatched) score += 25;
  score += recencyBoost(doc, prep, now);
  score += Math.max(-40, Math.min(40, Number(doc.boost) || 0));
  return score;
}

function compareRanked(a, b) {
  return b.score - a.score
    || (TYPE_ORDER[a.doc.type] ?? 9) - (TYPE_ORDER[b.doc.type] ?? 9)
    || (SPORT_ORDER[a.doc.sport] ?? 9) - (SPORT_ORDER[b.doc.sport] ?? 9)
    || (prepareDoc(b.doc).time - prepareDoc(a.doc).time)
    || String(a.doc.title).localeCompare(String(b.doc.title))
    || String(a.doc.href).localeCompare(String(b.doc.href));
}

/**
 * Rank a corpus. Options:
 *   limit      1..50 (default 20)
 *   sport      restrict to one league
 *   types      restrict to these doc types
 *   now        epoch ms, for recency (omit for pure-text ranking)
 *   related    fn(doc) -> docs to surface right under a strong entity hit
 *              (e.g. a player's team). Deterministic, relationship-based.
 */
export function searchDocs(docs, query, { limit = 20, sport = null, types = null, now = 0, related = null } = {}) {
  const analysis = analyzeQuery(query);
  if (analysis.q.length < MIN_QUERY_LENGTH) return [];
  const max = Math.min(50, Math.max(1, Number(limit) || 20));
  const typeSet = types && types.length ? new Set(types) : null;

  const ranked = [];
  for (const doc of docs) {
    if (!doc || !doc.href || !doc.title) continue;
    if (sport && doc.sport !== sport) continue;
    if (typeSet && !typeSet.has(doc.type)) continue;
    const score = scoreDoc(doc, analysis, { now });
    if (score > 0) ranked.push({ doc, score });
  }
  ranked.sort(compareRanked);

  // Relationships: a strongly matched player pulls his team up directly
  // underneath him ("Aaron Judge" -> Aaron Judge, then the Yankees).
  if (related && ranked.length && ranked[0].score >= TIER.PREFIX - 40) {
    const top = ranked[0];
    for (const rel of related(top.doc) || []) {
      if (!rel || (sport && rel.sport !== sport) || (typeSet && !typeSet.has(rel.type))) continue;
      const existing = ranked.find((r) => r.doc === rel || (r.doc.type === rel.type && r.doc.href === rel.href));
      const lifted = top.score - 60;
      if (existing) existing.score = Math.max(existing.score, lifted);
      else ranked.push({ doc: rel, score: lifted });
    }
    ranked.sort(compareRanked);
  }

  // Drop the long tail of weak matches once something clearly matched: when
  // the best hit is a real name match, typo-level entity matches are noise
  // ("Judge" should not list every Jude); related stories stay.
  const best = ranked[0]?.score || 0;
  const entityFloor = best >= TIER.TOKEN_PREFIX ? TIER.FUZZY + 1 : best * 0.6;
  const storyFloor = best * 0.36;
  const seen = new Set();
  const out = [];
  for (const r of ranked) {
    if (r.score < (r.doc.type === 'story' ? storyFloor : entityFloor)) continue;
    const key = `${r.doc.type}|${r.doc.href}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
    if (out.length >= max) break;
  }
  return out;
}

/** Public result shape of /v1/search. */
export function toResult({ doc, score }) {
  const out = {
    type: doc.type,
    sport: doc.sport || null,
    id: String(doc.id ?? ''),
    title: doc.title,
    subtitle: doc.subtitle || '',
    href: doc.href,
    image: doc.image || null,
    score: Math.round(Math.min(1, score / 1000) * 1000) / 1000,
  };
  if (doc.kind) out.kind = doc.kind;
  if (doc.date) out.date = doc.date;
  if (doc.label) out.label = doc.label;
  return out;
}

export const GROUPS = Object.freeze([
  Object.freeze({ key: 'player', label: 'Players & Fighters' }),
  Object.freeze({ key: 'team', label: 'Teams' }),
  Object.freeze({ key: 'event', label: 'Events' }),
  Object.freeze({ key: 'tool', label: 'Intelligence & Tools' }),
  Object.freeze({ key: 'learn', label: 'Learn' }),
  Object.freeze({ key: 'story', label: 'News' }),
]);

/**
 * Group ranked results for display. Only non-empty groups are returned, and
 * groups are ordered by their best result so the #1 match is always the first
 * row a keyboard user lands on.
 */
export function groupResults(results) {
  const byType = new Map();
  results.forEach((r, i) => {
    if (!byType.has(r.type)) byType.set(r.type, { first: i, items: [] });
    byType.get(r.type).items.push(r);
  });
  return GROUPS
    .filter((g) => byType.has(g.key))
    .map((g) => ({ ...g, first: byType.get(g.key).first, items: byType.get(g.key).items }))
    .sort((a, b) => a.first - b.first)
    .map(({ first, ...g }) => g);
}

/** Validate and clamp the /v1/search parameters. */
export function parseSearchParams(params) {
  const get = (k) => (typeof params.get === 'function' ? params.get(k) : params[k]);
  const raw = String(get('q') || '');
  const q = normalizeQuery(raw);
  const limitRaw = Number(get('limit'));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(50, Math.max(1, Math.floor(limitRaw))) : 20;
  const sportRaw = String(get('sport') || '').toLowerCase();
  const sport = SEARCH_SPORTS.includes(sportRaw) ? sportRaw : null;
  const types = String(get('type') || '')
    .toLowerCase()
    .split(',')
    .map((t) => t.trim())
    .filter((t) => SEARCH_TYPES.includes(t));
  return { raw: raw.slice(0, MAX_QUERY_LENGTH), q, limit, sport, types: [...new Set(types)].sort() };
}

export { TIER };
