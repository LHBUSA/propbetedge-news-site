/**
 * src/pages/leaders.js — /leaders (root)
 *
 * v3.12 — /leaders now redirects to /leaders/mlb (default landing).
 * The actual sport pages live in leaders-mlb.js, leaders-nhl.js,
 * leaders-nba.js, leaders-nfl.js.
 *
 * Kept as a router target so existing links to /leaders still work.
 */

export async function renderLeadersPage(root) {
  // Soft redirect — replace state so browser back button doesn't loop
  if (typeof window !== 'undefined') {
    window.history.replaceState({}, '', '/leaders/mlb');
    // Lazy-load the MLB page module and render it
    const mod = await import('./leaders-mlb.js');
    return mod.renderMlbLeadersPage(root);
  }
}
