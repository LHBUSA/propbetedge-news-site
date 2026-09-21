/**
 * src/entity-hub/contract.js
 *
 * The normalized PropBetEdge entity contract.
 *
 * One shape for identity, provenance and freshness across every sport.
 * Statistics are NOT normalized: football, baseball, basketball and hockey do
 * not share a stat line, and flattening them would invent numbers that do not
 * exist. Each sport puts its own stats in `stats`, labelled, and says which
 * season they belong to.
 *
 * Identity is never minted here. Every id comes from
 * src/entity-graph/dictionary.js, which is the single identity spine for the
 * site, so a hub snapshot can always be joined back to the article graph.
 */

export const CONTRACT_VERSION = 'pbe-entity-hub/1';

/**
 * Freshness vocabulary. A snapshot is CURRENT until its ttl expires, STALE
 * until stale_after, and EXPIRED beyond that. A stale snapshot is still served
 * — a slightly old profile beats a 503 because one league backend is having a
 * bad hour — but it is labelled so the page can say so.
 */
export const FRESHNESS = { CURRENT: 'CURRENT', STALE: 'STALE', EXPIRED: 'EXPIRED' };

export function freshnessOf(source, now = Date.now()) {
  const observed = new Date(source?.observed_at || 0).getTime();
  if (!Number.isFinite(observed) || !observed) return FRESHNESS.EXPIRED;
  const ageS = (now - observed) / 1000;
  if (ageS <= (source.ttl_s ?? 900)) return FRESHNESS.CURRENT;
  if (ageS <= (source.stale_after_s ?? 86400)) return FRESHNESS.STALE;
  return FRESHNESS.EXPIRED;
}

/**
 * Provenance travels with every snapshot. The sports products sit on different
 * providers with different contracts, so "where did this number come from and
 * when" has to be answerable per field-group, not per site.
 */
export function provenance({ product, source, source_urls = [], observed_at, schema = null, ttl_s = 900, stale_after_s = 86400 }) {
  return {
    product,
    source,
    source_urls: Array.isArray(source_urls) ? source_urls.slice(0, 6) : [],
    schema,
    observed_at: observed_at || new Date().toISOString(),
    refreshed_at: new Date().toISOString(),
    ttl_s,
    stale_after_s,
  };
}

/**
 * Normalized player.
 *
 * `stats` is deliberately a bag of sport-native groups:
 *   { season: {label, stats:{…}}, career: {…}, recent: {last5, last10}, games: [] }
 * Every group carries its own season label so two seasons can never be mixed.
 */
export function playerSnapshot({
  sport, player_id, name, team = null, position = '', jersey = null, photo = null,
  bio = {}, stats = {}, status = null, special_metrics = null, coverage = null, source,
}) {
  return {
    contract: CONTRACT_VERSION,
    kind: 'player',
    sport,
    player_id: String(player_id),
    name,
    canonical_url: `https://propbetedge.ai/player/${sport}/${player_id}`,
    team,
    position: position || '',
    jersey: jersey == null ? null : String(jersey),
    photo: photo || null,
    bio: {
      height: bio.height ?? null,
      weight: bio.weight ?? null,
      age: bio.age ?? null,
      birth_date: bio.birth_date ?? null,
      birth_place: bio.birth_place ?? null,
      experience: bio.experience ?? null,
      throws: bio.throws ?? null,
      bats: bio.bats ?? null,
    },
    stats: {
      season: stats.season ?? null,
      career: stats.career ?? null,
      recent: stats.recent ?? null,
      games: Array.isArray(stats.games) ? stats.games : [],
    },
    status: status || null,
    special_metrics: special_metrics || null,
    coverage: coverage || null,
    source,
  };
}

/** Normalized team. */
export function teamSnapshot({
  sport, team_id, slug, name, abbreviation, logo = null,
  league_context = {}, record = null, standings = null, recent_form = null,
  team_stats = null, roster = [], leaders = [], recent_games = [],
  upcoming_games = [], injuries = [], schedule = null, source,
}) {
  return {
    contract: CONTRACT_VERSION,
    kind: 'team',
    sport,
    team_id: String(team_id),
    slug,
    name,
    abbreviation,
    canonical_url: `https://propbetedge.ai/team/${sport}/${slug}`,
    logo: logo || null,
    league_context: {
      conference: league_context.conference ?? null,
      division: league_context.division ?? null,
    },
    record,
    standings,
    recent_form,
    team_stats,
    roster: Array.isArray(roster) ? roster : [],
    leaders: Array.isArray(leaders) ? leaders : [],
    schedule: {
      recent: Array.isArray(schedule?.recent) ? schedule.recent : (Array.isArray(recent_games) ? recent_games : []),
      upcoming: Array.isArray(schedule?.upcoming) ? schedule.upcoming : (Array.isArray(upcoming_games) ? upcoming_games : []),
    },
    // Kept as aliases so nothing that already reads these breaks.
    recent_games: Array.isArray(schedule?.recent) ? schedule.recent : (Array.isArray(recent_games) ? recent_games : []),
    upcoming_games: Array.isArray(schedule?.upcoming) ? schedule.upcoming : (Array.isArray(upcoming_games) ? upcoming_games : []),
    injuries: Array.isArray(injuries) ? injuries : [],
    source,
  };
}

/** A roster entry always carries the id the player route resolves against. */
export function rosterEntry({ sport, player_id, name, position = '', jersey = null, photo = null }) {
  return {
    player_id: String(player_id),
    name,
    position: position || '',
    jersey: jersey == null ? null : String(jersey),
    photo: photo || null,
    path: `/player/${sport}/${player_id}`,
  };
}

/**
 * One scheduled or completed fixture.
 *
 * Carries the ids a page needs to link without another lookup: the event id
 * the /games route resolves against, and the opponent's canonical slug from
 * the dictionary. A fixture whose opponent cannot be resolved keeps the name
 * and drops the link rather than guessing a slug.
 */
export function scheduledGame({
  sport, game_id, date, home_away, opponent = null, status = null,
  team_score = null, opponent_score = null, venue = null, is_final = false,
}) {
  return {
    game_id: game_id == null ? null : String(game_id),
    path: game_id != null ? `/games/${sport}/${game_id}` : null,
    date: date || null,
    home_away: home_away || null,
    opponent: opponent
      ? {
        id: opponent.id ?? null,
        name: opponent.name ?? null,
        abbr: opponent.abbr ?? null,
        slug: opponent.slug ?? null,
        logo: opponent.logo ?? null,
        path: opponent.slug ? `/team/${sport}/${opponent.slug}` : null,
      }
      : null,
    status: status || null,
    is_final: Boolean(is_final),
    // Scores are null until they exist. A scheduled game has no 0-0 result.
    team_score: team_score ?? null,
    opponent_score: opponent_score ?? null,
    venue: venue || null,
  };
}

/** A team leader in one sport-native category, keyed on a real player id. */
export function teamLeader({ sport, player_id, name, category, label, value, unit = null, rank = null, photo = null, derived = false }) {
  return {
    player_id: player_id == null ? null : String(player_id),
    path: player_id != null ? `/player/${sport}/${player_id}` : null,
    name,
    category,
    label,
    value,
    unit,
    rank,
    photo: photo || null,
    // true when we computed it from stored snapshots rather than reading a
    // leaders endpoint the product publishes.
    derived,
  };
}

/** One row of a sport-native stat group. */
export function statGroup({ label, season = null, stats = {}, note = null }) {
  return { label, season, stats, note };
}

/**
 * Structural validation. Catches an adapter that silently produced a shell —
 * a snapshot with no name or a fabricated id — before it can reach a page.
 */
export function validatePlayerSnapshot(snapshot) {
  const problems = [];
  if (!snapshot || snapshot.kind !== 'player') problems.push('not_a_player_snapshot');
  if (!snapshot?.sport) problems.push('missing_sport');
  if (!/^\d+$/.test(String(snapshot?.player_id || ''))) problems.push('player_id_not_numeric');
  if (!String(snapshot?.name || '').trim()) problems.push('missing_name');
  if (!snapshot?.source?.product) problems.push('missing_provenance_product');
  if (!snapshot?.source?.observed_at) problems.push('missing_observed_at');
  if (snapshot?.team && !snapshot.team.slug) problems.push('team_without_slug');
  return { ok: problems.length === 0, problems };
}

export function validateTeamSnapshot(snapshot) {
  const problems = [];
  if (!snapshot || snapshot.kind !== 'team') problems.push('not_a_team_snapshot');
  if (!snapshot?.sport) problems.push('missing_sport');
  if (!String(snapshot?.slug || '').trim()) problems.push('missing_slug');
  if (!String(snapshot?.name || '').trim()) problems.push('missing_name');
  if (!snapshot?.source?.product) problems.push('missing_provenance_product');
  for (const entry of snapshot?.roster || []) {
    if (!/^\d+$/.test(String(entry.player_id || ''))) { problems.push('roster_entry_without_id'); break; }
  }
  return { ok: problems.length === 0, problems };
}

/**
 * Team page readiness, field by field.
 *
 * Deliberately separate from completeness(). completeness() is an INGESTION
 * state — did the adapter produce something usable — and it called a team
 * "full" on roster + record alone. That is not the same question as "is there
 * enough here to build the rich central team page", which also needs a
 * schedule, leaders and team stats.
 *
 * Conflating the two is how a team layer with zero schedule coverage read as
 * 30/30 full.
 */
export const TEAM_PROFILE_FIELDS = [
  'identity', 'logo', 'roster', 'record', 'standings',
  'recent_results', 'upcoming_schedule', 'recent_form', 'team_stats', 'leaders',
];

export function teamReadiness(snapshot) {
  const fields = {
    identity: Boolean(snapshot?.name && snapshot?.slug && snapshot?.abbreviation),
    logo: Boolean(snapshot?.logo),
    roster: (snapshot?.roster || []).length > 0,
    record: Boolean(snapshot?.record?.summary),
    standings: Boolean(snapshot?.standings),
    recent_results: (snapshot?.schedule?.recent || []).length > 0,
    upcoming_schedule: (snapshot?.schedule?.upcoming || []).length > 0,
    recent_form: Boolean(snapshot?.recent_form),
    team_stats: Boolean(snapshot?.team_stats && Object.keys(snapshot.team_stats).length),
    leaders: (snapshot?.leaders || []).length > 0,
  };

  // Everything except recent_results, which is legitimately empty before a
  // season starts and must not block a page the rest of the year.
  const required = TEAM_PROFILE_FIELDS.filter((f) => f !== 'recent_results');
  const missing = required.filter((f) => !fields[f]);

  return {
    fields,
    missing,
    page_ready: missing.length === 0,
    version: 'team_profile_v1',
  };
}

/**
 * Enrichment completeness, reported rather than hidden. A profile with a name
 * and a photo but no stats is PARTIAL, not a failure — and the backfill report
 * says so per sport instead of averaging it away.
 */
/**
 * Coverage states. `unsupported` is deliberately distinct from `identity_only`:
 * one means "this upstream does not cover this kind of entity at all", the
 * other means "it does, and there is simply nothing yet". Collapsing them would
 * make an NFL lineman look like a missing rookie.
 */
export const COVERAGE_STATES = ['full', 'partial', 'identity_only', 'unsupported', 'unresolved'];

export function completeness(snapshot) {
  if (!snapshot) return 'unresolved';
  // A snapshot may declare that its upstream does not cover this entity. That
  // is a fact about the source, not a gap in the pipeline, and it outranks any
  // inference from which fields happen to be populated.
  if (snapshot.coverage?.supported === false) return 'unsupported';
  if (snapshot.kind === 'player') {
    const hasStats = Boolean(snapshot.stats?.season || snapshot.stats?.career);
    const hasTeam = Boolean(snapshot.team?.slug);
    if (hasStats && hasTeam && snapshot.photo) return 'full';
    if (hasStats || hasTeam) return 'partial';
    return 'identity_only';
  }
  const hasRoster = (snapshot.roster || []).length > 0;
  const hasRecord = Boolean(snapshot.record);
  if (hasRoster && hasRecord) return 'full';
  if (hasRoster || hasRecord) return 'partial';
  return 'identity_only';
}
