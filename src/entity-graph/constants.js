/**
 * src/entity-graph/constants.js
 *
 * Identity constants with no dictionary dependency.
 *
 * Kept separate so light consumers — the sitemap generator, the social-card
 * endpoint's fallback path — can build a canonical PropBetEdge URL without
 * pulling the 260 KB entity dictionary into their bundle.
 */

export const SITE = 'https://propbetedge.ai';
export const SUPPORTED_SPORTS = ['mlb', 'nfl', 'nba', 'nhl'];
export const SPORT_LABELS = { mlb: 'MLB', nfl: 'NFL', nba: 'NBA', nhl: 'NHL' };
