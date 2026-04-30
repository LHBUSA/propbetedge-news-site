/**
 * src/pages/leaders-nfl.js — /leaders/nfl
 *
 * v3.12 — NFL is in offseason (Apr 2026). Placeholder page with:
 *   - "Coming this fall" framing
 *   - Reference to past season leaders (rough static list, optional)
 *   - Link to NFL news + Picks app
 *
 * Will be wired to ESPN's NFL leaders endpoint when training camp opens
 * (late July / early August).
 */

import { leadersPageShell } from './leaders-shared.js';

export async function renderNflLeadersPage(root) {
  const dek = "NFL season starts in September. Leaderboards return when training camp opens — until then, follow the news beat or check picks across the active sports.";
  root.innerHTML = leadersPageShell('nfl', 'NFL', dek, `
    <div class="nfl-offseason">
      <div class="nfl-offseason-icon">🏈</div>
      <h2 class="nfl-offseason-title">Leaderboards return this fall</h2>
      <p class="nfl-offseason-dek">
        Training camps open in late July. Preseason starts mid-August. Regular season Week 1 kicks off in September.
        We'll have full passing, rushing, receiving, and defensive leaderboards from kickoff onward —
        plus advanced metrics and prop-bet impact analysis.
      </p>

      <div class="nfl-offseason-nav">
        <a href="/news/nfl" class="nfl-offseason-link">
          <div class="nfl-offseason-link-icon">📰</div>
          <div class="nfl-offseason-link-title">NFL News</div>
          <div class="nfl-offseason-link-dek">Offseason moves, draft analysis, training camp updates</div>
        </a>
        <a href="/leaders/mlb" class="nfl-offseason-link">
          <div class="nfl-offseason-link-icon">⚾</div>
          <div class="nfl-offseason-link-title">MLB Leaders</div>
          <div class="nfl-offseason-link-dek">In-season action — batting, pitching, and advanced sabermetrics</div>
        </a>
        <a href="/leaders/nhl" class="nfl-offseason-link">
          <div class="nfl-offseason-link-icon">🏒</div>
          <div class="nfl-offseason-link-title">NHL Leaders</div>
          <div class="nfl-offseason-link-dek">Stanley Cup playoff scoring + season totals</div>
        </a>
        <a href="/leaders/nba" class="nfl-offseason-link">
          <div class="nfl-offseason-link-icon">🏀</div>
          <div class="nfl-offseason-link-title">NBA Leaders</div>
          <div class="nfl-offseason-link-dek">Finals run + season averages with TS%/eFG%</div>
        </a>
      </div>
    </div>
  `, 'OFFSEASON');
}
