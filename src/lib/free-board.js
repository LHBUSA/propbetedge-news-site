/**
 * src/lib/free-board.js
 * Free Picks V3 board contract — pure functions, no DOM, no fetch.
 *
 * The public tracker ledger (free-picks-tracker) IS the board:
 *   - a card may render as a free pick only if it is a ledger entry;
 *   - sport feeds only enrich ledger entries (media, live price, lifecycle);
 *   - a feed pick with no ledger entry is reported as unrecorded, never drawn;
 *   - validation / tracking / shadow / research output never renders as a pick.
 *
 * States:
 *   PRE-LOCK · LOCKED · IN PLAY   → current board
 *   AWAITING                      → still pending, event over, grade not in yet
 *   SETTLED (HIT/MISS/PUSH/VOID)  → Latest Results + public record only
 */

export const FREE_SPORTS = Object.freeze(['mlb', 'nfl', 'ufc', 'wnba', 'nhl']);
export const SETTLED_RESULTS = Object.freeze(['WIN', 'LOSS', 'PUSH', 'VOID']);
export const RESULT_LABELS = Object.freeze({ WIN: 'HIT', LOSS: 'MISS', PUSH: 'PUSH', VOID: 'VOID' });

// A started event with no grade stays IN PLAY for this long, then it is
// AWAITING a result: not actionable, not current, still pending in the record.
const IN_PLAY_WINDOW_MS = {
  mlb: 6 * 3600e3,
  nfl: 5 * 3600e3,
  ufc: 10 * 3600e3,
  wnba: 4 * 3600e3,
  nhl: 4 * 3600e3,
};

// Output classes that are never a published free pick.
const NON_PICK_SCOPES = new Set(['tracking', 'validation', 'shadow', 'research', 'rehearsal_shadow', 'unpublished']);

export function etDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (type) => parts.find((x) => x.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function sportOf(entry) {
  return String(entry?.sport || '').toLowerCase();
}

function upper(value) {
  return String(value || '').toUpperCase();
}

export function isSuppressed(entry) {
  return entry?.evidence?.suppressed === true;
}

// Product-version boundary (ET). Before it the MLB free pick was an official Algo HR selection and the NFL free pick
// was a team pick. On/after it: MLB = Featured Player (editorial, NOT an Algo pick, own record namespace) and
// NFL = up to two official TD Targets per slate day (own record namespace). Legacy rows are never relabelled.
export const PRODUCT_BOUNDARY = '2026-09-28';

/** Structural product of a ledger entry (tracker v4 sets it; older payloads are derived exactly like the tracker). */
export function selectionType(entry) {
  const explicit = entry?.selection_type || entry?.snapshot?.selection_type;
  if (explicit) return String(explicit);
  const sport = sportOf(entry);
  if (sport === 'mlb') return 'algo';
  if (sport === 'nfl') return 'team_pick';
  return 'model_pick';
}

export function isFeaturedPlayer(entry) {
  return selectionType(entry) === 'featured_player';
}

export function isTdTarget(entry) {
  return selectionType(entry) === 'td_target';
}

/** Human product label for receipts/history. Legacy products say so. */
export function productLabel(entry) {
  switch (selectionType(entry)) {
    case 'featured_player': return 'FEATURED PLAYER · NOT AN ALGO PICK';
    case 'td_target': return 'FREE TD TARGET';
    case 'algo': return 'ALGO HR PICK · LEGACY FREE PRODUCT';
    case 'team_pick': return 'TEAM PICK · LEGACY FREE PRODUCT';
    default: return 'FREE PICK';
  }
}

/** A namespaced record from the tracker (records.<key>), or null on an older tracker. */
export function namespacedRecord(tracker, key) {
  const node = key.startsWith('legacy.') ? tracker?.records?.legacy?.[key.slice(7)] : tracker?.records?.[key];
  const r = node?.lifetime;
  if (!r) return null;
  const wins = Number(r.wins || 0);
  const losses = Number(r.losses || 0);
  return { wins, losses, pushes: Number(r.pushes || 0), voids: Number(r.voids || 0), pending: Number(r.pending || 0), record: `${wins}–${losses}`, hitRate: wins + losses ? (wins / (wins + losses)) * 100 : null };
}

/** The publication class of a ledger entry or a raw feed item. */
export function publicationScope(item) {
  const snap = item?.snapshot || item || {};
  return String(snap.publication_scope || '').toLowerCase() || null;
}

/** True when the output is validation/tracking/shadow/research — never a free pick. */
export function isNonPickOutput(item) {
  const scope = publicationScope(item);
  if (scope && NON_PICK_SCOPES.has(scope)) return true;
  const label = upper(item?.snapshot?.scope_label || item?.scope_label);
  return /VALIDATION|SHADOW|RESEARCH/.test(label);
}

/**
 * Does this ledger entry count toward the FREE PICKS record? Legacy
 * validation/tracking rows stay in the ledger for audit but never count,
 * never render as a current pick and never appear in Latest Results.
 */
export function countsTowardRecord(entry) {
  // The MLB Featured Player has its own record namespace and never counts toward the FREE PICKS record.
  if (isFeaturedPlayer(entry)) return false;
  if (entry?.counts_toward_record === false && entry?.record_class !== 'withdrawn') return false;
  return !isNonPickOutput(entry);
}

/** Ledger entries that are real public free picks (the record's population). */
export function publicPickEntries(tracker) {
  return ledgerEntries(tracker).filter(countsTowardRecord);
}

export function isSettled(entry) {
  return SETTLED_RESULTS.includes(upper(entry?.result));
}

/** Best-known event start (ISO) for a ledger entry, or null for date-only events. */
export function eventStart(entry) {
  const snap = entry?.snapshot || {};
  return entry?.event_start_at
    || snap.kickoff_ts
    || snap.puck_drop_utc
    || snap.start_utc
    || snap.scheduled_tip_utc
    || null;
}

/** Event calendar date (ET) for date-only sports (MLB game_date, UFC event_date). */
export function eventDate(entry) {
  const snap = entry?.snapshot || {};
  if (sportOf(entry) === 'ufc') return snap.event_date || null;
  if (sportOf(entry) === 'mlb') return snap.game_date || entry?.period_start || null;
  const start = eventStart(entry);
  return start ? etDate(new Date(start)) : entry?.period_start || null;
}

function publishedPhase(entry, live = null) {
  const snap = entry?.snapshot || {};
  const raw = upper(live?.lifecycle || live?.phase || snap.lifecycle || snap.phase);
  if (raw === 'LOCKED' || snap.locked_at || sportOf(entry) === 'nhl') return 'LOCKED';
  if (raw === 'FINAL') return 'LOCKED';
  return 'PRE-LOCK';
}

/**
 * Classify one ledger entry.
 * @param {object} entry  tracker entry
 * @param {Date}   now
 * @param {object} [live] optional live feed hints: { lifecycle, phase }
 */
export function entryState(entry, now = new Date(), live = null) {
  if (isSettled(entry)) return 'SETTLED';
  const sport = sportOf(entry);
  const nowMs = now.getTime();
  const start = Date.parse(eventStart(entry) || '');
  if (Number.isFinite(start)) {
    if (nowMs < start) return publishedPhase(entry, live);
    return nowMs - start <= (IN_PLAY_WINDOW_MS[sport] || 5 * 3600e3) ? 'IN PLAY' : 'AWAITING';
  }
  const date = eventDate(entry);
  const today = etDate(now);
  if (date && date < today) return 'AWAITING';
  return publishedPhase(entry, live);
}

export const CURRENT_STATES = Object.freeze(['PRE-LOCK', 'LOCKED', 'IN PLAY']);

/** Visible (non-suppressed) ledger entries. */
export function ledgerEntries(tracker) {
  if (!tracker?.ok || !Array.isArray(tracker.entries)) return [];
  return tracker.entries.filter((entry) => entry && !isSuppressed(entry));
}

/**
 * Build the board model from the ledger.
 * Returns current picks (actionable/in play), settled-today, awaiting and
 * per-sport status, all derived from ledger entries only.
 */
export function buildFreeBoard(tracker, now = new Date(), liveHints = new Map()) {
  const today = etDate(now);
  const entries = ledgerEntries(tracker);
  const current = [];
  const awaiting = [];
  const settledToday = [];
  const excluded = [];

  for (const entry of entries) {
    const hint = liveHints.get(entry.public_key) || null;
    const state = entryState(entry, now, hint);
    if (state === 'SETTLED') {
      if (!countsTowardRecord(entry) && !isFeaturedPlayer(entry)) { excluded.push({ entry, reason: 'non_pick_output' }); continue; }
      // Event date, not result_at: older MLB rows had result_at rewritten on
      // every recheck, so result_at cannot say which day a pick belonged to.
      if (eventDate(entry) === today) settledToday.push(entry);
      continue;
    }
    if (isNonPickOutput(entry)) {
      // Legacy validation rows stay in the historical record but can never be
      // presented as a current free pick.
      excluded.push({ entry, reason: 'non_pick_output' });
      continue;
    }
    if (state === 'AWAITING') { awaiting.push({ entry, state }); continue; }
    current.push({ entry, state });
  }

  const startMs = (row) => {
    const ts = Date.parse(eventStart(row.entry) || '');
    if (Number.isFinite(ts)) return ts;
    const d = eventDate(row.entry);
    return d ? Date.parse(`${d}T23:00:00Z`) : Number.MAX_SAFE_INTEGER;
  };
  const stateRank = { 'IN PLAY': 0, LOCKED: 1, 'PRE-LOCK': 2 };
  current.sort((a, b) => (stateRank[a.state] - stateRank[b.state]) || (startMs(a) - startMs(b)));

  const bySport = {};
  for (const sport of FREE_SPORTS) {
    bySport[sport] = {
      current: current.filter((row) => sportOf(row.entry) === sport),
      settledToday: settledToday.filter((entry) => sportOf(entry) === sport),
      awaiting: awaiting.filter((row) => sportOf(row.entry) === sport),
    };
  }

  return {
    today,
    current,
    awaiting,
    settledToday,
    excluded,
    bySport,
    counts: {
      current: current.filter((row) => row.state !== 'IN PLAY').length,
      inPlay: current.filter((row) => row.state === 'IN PLAY').length,
      settledToday: settledToday.length,
      awaiting: awaiting.length,
    },
  };
}

/**
 * Latest Results: newest event day first, then result_at; max N overall,
 * max K per sport so one sport can never fill the proof strip.
 */
export function latestResults(tracker, { max = 6, perSport = 2 } = {}) {
  const ts = (entry) => Date.parse(entry.result_at || entry.published_at || 0) || 0;
  // Featured Player receipts are shown (labelled) but live in their own record namespace.
  const settled = ledgerEntries(tracker).filter((entry) => countsTowardRecord(entry) || isFeaturedPlayer(entry))
    .filter((entry) => ['WIN', 'LOSS', 'PUSH', 'VOID'].includes(upper(entry.result)))
    .sort((a, b) => String(eventDate(b) || '').localeCompare(String(eventDate(a) || '')) || ts(b) - ts(a));
  const taken = new Map();
  const out = [];
  for (const entry of settled) {
    const sport = sportOf(entry);
    const n = taken.get(sport) || 0;
    if (n >= perSport) continue;
    taken.set(sport, n + 1);
    out.push(entry);
    if (out.length >= max) break;
  }
  return out;
}

/** Record summary straight from the tracker aggregate. */
export function recordSummary(tracker) {
  const r = tracker?.record || {};
  const wins = Number(r.wins || 0);
  const losses = Number(r.losses || 0);
  const pushes = Number(r.pushes || 0);
  const pending = Number(r.pending || 0);
  const decided = wins + losses;
  return {
    wins, losses, pushes, pending,
    record: `${wins}–${losses}${pushes ? `–${pushes}` : ''}`,
    hitRate: decided ? (wins / decided) * 100 : null,
  };
}

export function sportRecord(tracker, sport) {
  const s = tracker?.by_sport?.[upper(sport)] || {};
  const wins = Number(s.wins || 0);
  const losses = Number(s.losses || 0);
  const pushes = Number(s.pushes || 0);
  return { wins, losses, pushes, pending: Number(s.pending || 0), record: `${wins}–${losses}${pushes ? `–${pushes}` : ''}` };
}

/**
 * Recount a sport straight from ledger entries. Used by the invariant: the
 * aggregate the page prints must equal the entries the page can show.
 */
export function recountSport(tracker, sport) {
  const rows = publicPickEntries(tracker).filter((entry) => sportOf(entry) === String(sport).toLowerCase());
  return {
    wins: rows.filter((e) => upper(e.result) === 'WIN').length,
    losses: rows.filter((e) => upper(e.result) === 'LOSS').length,
    pushes: rows.filter((e) => upper(e.result) === 'PUSH').length,
    pending: rows.filter((e) => upper(e.result) === 'PENDING').length,
  };
}

/**
 * Free Pick contract invariant.
 *   displayed: [{ public_key, sport, label }] — every card the page renders as a pick
 *   tracker:   tracker payload
 *   feedItems: [{ sport, identity, scope, label }] — raw public sport-feed picks
 *
 * PASS requires:
 *   - every displayed card maps to exactly one ledger entry;
 *   - no displayed card is non-pick output;
 *   - by_sport aggregate == recount of ledger entries for every sport;
 *   - displayed current count == ledger current count.
 * Feed picks absent from the ledger are reported (unrecorded), never rendered.
 */
export function checkFreePickInvariant({ displayed = [], tracker, board, feedItems = [] }) {
  const entries = ledgerEntries(tracker);
  const byKey = new Map();
  for (const entry of entries) {
    const key = String(entry.public_key || '');
    byKey.set(key, (byKey.get(key) || 0) + 1);
  }
  const failures = [];
  for (const card of displayed) {
    const n = byKey.get(String(card.public_key || '')) || 0;
    if (n !== 1) failures.push(`${card.sport}:${card.label || card.public_key} has ${n} ledger entries`);
    if (card.nonPick) failures.push(`${card.sport}:${card.label} is non-pick output`);
  }
  for (const [key, n] of byKey) if (n > 1) failures.push(`duplicate ledger key ${key}`);
  for (const sport of FREE_SPORTS) {
    const agg = sportRecord(tracker, sport);
    const live = recountSport(tracker, sport);
    if (agg.wins !== live.wins || agg.losses !== live.losses || agg.pushes !== live.pushes || agg.pending !== live.pending) {
      failures.push(`${sport} aggregate ${agg.wins}-${agg.losses} (${agg.pending} pending) != ledger ${live.wins}-${live.losses} (${live.pending} pending)`);
    }
  }
  const all = publicPickEntries(tracker);
  const rec = tracker?.record || {};
  const recount = {
    wins: all.filter((e) => upper(e.result) === 'WIN').length,
    losses: all.filter((e) => upper(e.result) === 'LOSS').length,
    pushes: all.filter((e) => upper(e.result) === 'PUSH').length,
    pending: all.filter((e) => upper(e.result) === 'PENDING').length,
  };
  if (Number(rec.wins || 0) !== recount.wins || Number(rec.losses || 0) !== recount.losses
    || Number(rec.pushes || 0) !== recount.pushes || Number(rec.pending || 0) !== recount.pending) {
    failures.push(`global record ${rec.wins}-${rec.losses} (${rec.pending} pending) != recount(publicPickEntries) ${recount.wins}-${recount.losses} (${recount.pending} pending)`);
  }
  if (board && displayed.length !== board.current.length) {
    failures.push(`displayed ${displayed.length} current cards != ledger current ${board.current.length}`);
  }
  const unrecorded = feedItems.filter((item) => !item.nonPick && !item.recorded);
  return {
    pass: failures.length === 0,
    failures,
    unrecorded,
    blockedNonPicks: feedItems.filter((item) => item.nonPick),
  };
}

function normText(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Does a sport-feed card describe this ledger entry? Identity gates first
 * (source id, date, event, game id) so a historical result can never bleed
 * onto a current card on a name collision.
 */
export function trackerEntryMatchesCard(entry, card) {
  if (!entry || !card || sportOf(entry) !== String(card.sport || '').toLowerCase()) return false;
  if (card.trackerKey && entry.public_key && String(card.trackerKey) === String(entry.public_key)) return true;

  const sport = sportOf(entry);
  const snap = entry.snapshot || {};

  if (sport === 'mlb') {
    if (card.trackerSourceRecordId && entry.source_record_id) {
      return String(card.trackerSourceRecordId) === String(entry.source_record_id);
    }
    const cardPeriod = String(card.trackerPeriod || '');
    const entryPeriod = String(entry.period_start || snap.game_date || '');
    if (!cardPeriod || !entryPeriod || cardPeriod !== entryPeriod) return false;
    const cardPlayerId = String(card.trackerPlayerId || '');
    const entryPlayerId = String(snap.mlb_player_id || '');
    if (cardPlayerId && entryPlayerId) return cardPlayerId === entryPlayerId;
    return normText(entry.selection) === normText(card.title);
  }

  if (sport === 'nfl' && card.trackerEventStartAt && entry.event_start_at) {
    if (Date.parse(card.trackerEventStartAt) !== Date.parse(entry.event_start_at)) return false;
  }
  if (sport === 'ufc' && card.trackerEventDate && snap.event_date) {
    if (String(card.trackerEventDate) !== String(snap.event_date)) return false;
  }
  if ((sport === 'nhl' || sport === 'wnba') && card.gameId && snap.game_id) {
    if (String(card.gameId) !== String(snap.game_id)) return false;
  }

  const pick = normText(entry.selection);
  const title = normText(card.title);
  if (pick && title && pick === title) return true;
  if (sport === 'nhl') {
    const pickTeam = normText(snap.pick_team);
    return Boolean(card.gameId && snap.game_id && pickTeam && pickTeam === title);
  }
  return false;
}
