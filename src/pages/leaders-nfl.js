/**
 * src/pages/leaders-nfl.js — /leaders/nfl
 *
 * Pre-Week 1 production state. PropBetEdge intentionally excludes preseason
 * exhibition totals from regular-season leaderboards; live 2026 passing,
 * rushing, receiving and defensive leaderboards activate with Week 1.
 */

import { leadersPageShell } from './leaders-shared.js';

export async function renderNflLeadersPage(root) {
  const dek = '2026 regular-season leaderboards activate with Week 1. Preseason exhibition totals are intentionally excluded from the production rankings.';

  root.innerHTML = leadersPageShell('nfl', 'NFL', dek, `
    <div class="nfl-offseason">
      <div class="nfl-offseason-icon">🏈</div>
      <h2 class="nfl-offseason-title">2026 leaderboards go live with Week 1</h2>
      <p class="nfl-offseason-dek">
        PropBetEdge keeps preseason exhibition stats separate from the regular-season record.
        Once Week 1 begins, this page will surface live passing, rushing, receiving and defensive leaders
        with the same player-level research and prop-market context used across the NFL intelligence product.
      </p>

      <div class="nfl-offseason-nav">
        <a href="https://nfl.propbetedge.ai" class="nfl-offseason-link" target="_blank" rel="noopener">
          <div class="nfl-offseason-link-icon">⚡</div>
          <div class="nfl-offseason-link-title">NFL Intelligence</div>
          <div class="nfl-offseason-link-dek">Model Lab, Market Watch, line simulation, SGP research and deeper football intelligence</div>
        </a>
        <a href="/news/nfl" class="nfl-offseason-link">
          <div class="nfl-offseason-link-icon">📰</div>
          <div class="nfl-offseason-link-title">NFL News</div>
          <div class="nfl-offseason-link-dek">Roster moves, injuries, depth-chart changes and the stories shaping Week 1 markets</div>
        </a>
        <a href="/games" class="nfl-offseason-link">
          <div class="nfl-offseason-link-icon">📊</div>
          <div class="nfl-offseason-link-title">Game Center</div>
          <div class="nfl-offseason-link-dek">Scores and live game context across the PropBetEdge sports network</div>
        </a>
        <a href="/leaders/mlb" class="nfl-offseason-link">
          <div class="nfl-offseason-link-icon">⚾</div>
          <div class="nfl-offseason-link-title">MLB Leaders</div>
          <div class="nfl-offseason-link-dek">In-season batting, pitching and advanced leaderboards</div>
        </a>
      </div>
    </div>
  `, 'WEEK 1 NEXT');
}
