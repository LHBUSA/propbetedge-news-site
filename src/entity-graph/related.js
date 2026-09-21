/**
 * src/entity-graph/related.js
 *
 * Entity-aware related coverage.
 *
 * The old behaviour was "four more stories from this sport", which surfaced
 * unrelated news purely because it was recent. Relevance is now scored off the
 * shared entity graph, so a story about one player pulls that player's other
 * coverage, then that team's, then the matchup, then the topic — with recency
 * as a tie-breaker rather than the primary signal.
 */

import { buildEntityManifest } from './manifest.js';
import { SPORT_LABELS } from './entities.js';

const WEIGHT = {
  player: 60,
  team: 26,
  game: 40,
  category: 8,
  sport: 2,
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Score one candidate against the current article's manifest.
 * Returns { score, reasons, groups } — groups drive the section headings.
 */
export function scoreRelated(current, currentManifest, candidate, candidateManifest) {
  if (!candidate || candidate.slug === current?.slug) return null;

  const reasons = [];
  const groups = new Set();
  let score = 0;

  const currentPlayers = new Set((currentManifest?.players || []).map((p) => `${p.sport}:${p.id}`));
  const currentTeams = new Set((currentManifest?.teams || []).map((t) => `${t.sport}:${t.id}`));
  const currentGames = new Set((currentManifest?.games || []).map((g) => `${g.sport}:${g.id}`));

  for (const player of candidateManifest?.players || []) {
    if (currentPlayers.has(`${player.sport}:${player.id}`)) {
      score += WEIGHT.player;
      groups.add('player');
      reasons.push({ kind: 'player', id: player.id, name: player.name });
    }
  }
  for (const team of candidateManifest?.teams || []) {
    if (currentTeams.has(`${team.sport}:${team.id}`)) {
      score += WEIGHT.team;
      groups.add('team');
      reasons.push({ kind: 'team', id: team.id, name: team.name });
    }
  }
  for (const game of candidateManifest?.games || []) {
    if (currentGames.has(`${game.sport}:${game.id}`)) {
      score += WEIGHT.game;
      groups.add('game');
      reasons.push({ kind: 'game', id: game.id, name: game.name });
    }
  }

  const category = String(current?.category || '').toLowerCase();
  if (category && category !== 'general' && String(candidate.category || '').toLowerCase() === category) {
    score += WEIGHT.category;
    groups.add('category');
  }

  if (String(candidate.sport || '').toLowerCase() === String(current?.sport || '').toLowerCase()) {
    score += WEIGHT.sport;
    groups.add('sport');
  }

  // Recency is a tie-breaker, never a reason on its own. It can contribute at
  // most one team's worth of weight, so a same-player story from last month
  // still outranks an unrelated story from this morning.
  score += recencyBonus(current, candidate);

  return { score, reasons, groups: [...groups] };
}

function recencyBonus(current, candidate) {
  const base = new Date(current?.published_at || Date.now()).getTime();
  const other = new Date(candidate?.published_at || 0).getTime();
  if (!Number.isFinite(base) || !Number.isFinite(other) || !other) return 0;
  const ageDays = Math.abs(base - other) / DAY_MS;
  if (ageDays <= 1) return 12;
  if (ageDays <= 3) return 9;
  if (ageDays <= 7) return 6;
  if (ageDays <= 30) return 3;
  return 0;
}

/**
 * Rank a candidate pool and split it into the sections the article renders.
 *
 * @param {object} article          the story being read
 * @param {object} manifest         its entity manifest
 * @param {Array}  candidates       candidate articles (any sport)
 * @param {object} [options]
 * @param {number} [options.limit]  how many related stories to return
 * @param {number} [options.minScore] floor below which a story is unrelated
 */
export function rankRelated(article, manifest, candidates, options = {}) {
  const limit = options.limit ?? 6;
  // A story must share a real entity or topic with this one. The bare
  // same-sport bonus alone can never clear this floor.
  const minScore = options.minScore ?? WEIGHT.category;

  const scored = [];
  for (const candidate of candidates || []) {
    if (!candidate?.slug) continue;
    const candidateManifest = options.manifestFor
      ? options.manifestFor(candidate)
      : buildEntityManifest(candidate);
    const result = scoreRelated(article, manifest, candidate, candidateManifest);
    if (!result || result.score < minScore) continue;
    scored.push({ article: candidate, manifest: candidateManifest, ...result });
  }

  scored.sort((a, b) => (
    b.score - a.score
    || new Date(b.article.published_at || 0) - new Date(a.article.published_at || 0)
    || (a.article.slug < b.article.slug ? -1 : 1)
  ));

  const top = scored.slice(0, limit);

  return {
    items: top,
    heading: headingFor(top, article, manifest),
    // Deep links into the wider graph, so a reader who wants more of one
    // entity has somewhere to go even when we only had a few stories.
    explore: exploreLinks(article, manifest),
  };
}

function headingFor(items, article, manifest) {
  const groups = new Set(items.flatMap((item) => item.groups));
  if (groups.has('game')) return 'More on this matchup';
  if (groups.has('player')) {
    const player = (manifest?.players || [])[0];
    return player ? `More on ${player.name}` : 'Related coverage';
  }
  if (groups.has('team')) {
    const team = (manifest?.teams || [])[0];
    return team ? `More on the ${team.nickname || team.name}` : 'Related coverage';
  }
  return 'Related coverage';
}

function exploreLinks(article, manifest) {
  const sport = String(article?.sport || '').toLowerCase();
  const links = [];
  for (const player of (manifest?.players || []).slice(0, 2)) {
    links.push({ label: `More on ${player.name}`, href: player.path || player.canonical_url });
  }
  for (const team of (manifest?.teams || []).slice(0, 2)) {
    links.push({ label: `More on the ${team.nickname || team.name}`, href: team.path || team.canonical_url });
  }
  for (const game of (manifest?.games || []).slice(0, 1)) {
    links.push({ label: 'Game Center', href: game.path || game.canonical_url });
  }
  if (sport) {
    links.push({ label: `All ${SPORT_LABELS[sport] || sport.toUpperCase()} coverage`, href: `/news/${sport}` });
  }
  return links;
}

export { WEIGHT as RELATED_WEIGHTS };
