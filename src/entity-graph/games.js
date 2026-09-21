/**
 * src/entity-graph/games.js
 *
 * Optional game enrichment for an entity manifest.
 *
 * Kept separate from buildEntityManifest() on purpose: the manifest itself is
 * pure and synchronous, so article text, links, schema and the entity bar never
 * wait on a network call. A game is attached only when it is genuinely
 * confident, and a failure here is always silent — a missing game entity costs
 * one chip, a wrong one costs trust.
 *
 * Exactly one request. /api/game-lookup searches the publication day and its
 * neighbours itself, in parallel, so this never puts three sequential round
 * trips in front of a page render.
 *
 * Confidence rules (enforced by the endpoint):
 *   - the story must resolve to exactly two teams
 *   - those two teams must play exactly one game in the date window
 *   - a doubleheader, or the same pairing twice in the window, is ambiguous
 *     and therefore attaches nothing
 */

import { toGameManifest } from './manifest.js';

export const GAME_LOOKUP_PATH = '/api/game-lookup';

/**
 * @param {object} article
 * @param {object} manifest
 * @param {object} [options]
 * @param {string} [options.origin]     absolute origin for the lookup endpoint
 * @param {Function} [options.fetchImpl]
 * @param {number} [options.timeoutMs]
 * @returns {Promise<object>} the manifest, with games populated when confident
 */
export async function enrichManifestWithGame(article, manifest, options = {}) {
  if (!manifest || manifest.games?.length) return manifest;

  const teams = manifest.teams || [];
  if (teams.length !== 2) return manifest;

  const sport = String(manifest.sport || '').toLowerCase();
  const published = new Date(article?.published_at || '');
  if (!sport || !Number.isFinite(published.getTime())) return manifest;

  const fetchImpl = options.fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!fetchImpl) return manifest;

  const abbrs = teams.map((t) => t.abbreviation).filter(Boolean);
  if (abbrs.length !== 2) return manifest;

  const stamp = `${published.getUTCFullYear()}`
    + `${pad(published.getUTCMonth() + 1)}`
    + `${pad(published.getUTCDate())}`;

  const url = `${options.origin || ''}${GAME_LOOKUP_PATH}`
    + `?sport=${encodeURIComponent(sport)}`
    + `&date=${stamp}`
    + `&teams=${encodeURIComponent(abbrs.join(','))}`;

  const game = await safeLookup(fetchImpl, url, options.timeoutMs ?? 1500);
  if (!game) return manifest;

  return { ...manifest, games: [toGameManifest({ ...game, sport })] };
}

async function safeLookup(fetchImpl, url, timeoutMs) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetchImpl(url, {
      headers: { Accept: 'application/json' },
      ...(controller ? { signal: controller.signal } : {}),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.ok && data?.game?.id ? data.game : null;
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function pad(value) {
  return String(value).padStart(2, '0');
}
