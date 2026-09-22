/**
 * src/entity-graph/entity-coverage.js
 *
 * The return leg of the content graph: entity → articles.
 *
 * Article pages link out to players and teams; these are the modules that make
 * player and team pages link back. Coverage is fetched with the news API's
 * structured entity filters (`/news/by-player`, `/news/by-team`), which query
 * the newsroom's own player/team tags — not a text search over headlines that
 * would match "Bradley" in an unrelated story.
 *
 * Client-only: it touches the DOM and the browser API client, so Edge
 * Middleware never imports it.
 */

import { api } from '../api.js';
import { renderArticleCard } from '../components/article-card.js';
import { teamQueryAbbreviations } from './entities.js';

const SPORT_LABELS = { mlb: 'MLB', nfl: 'NFL', nba: 'NBA', nhl: 'NHL' };

export function entityCoverageSlot(id = 'pbe-entity-coverage') {
  return `<div id="${id}" class="pbe-entity-coverage-slot"></div>`;
}

/**
 * Fetch and render coverage for one entity.
 *
 * @param {object} options
 * @param {string} options.slotId
 * @param {string} options.sport
 * @param {'player'|'team'} options.kind
 * @param {string} options.name          player full name, or team display name
 * @param {string} [options.abbreviation] team abbreviation (teams only)
 * @param {number} [options.limit]
 */
export async function mountEntityCoverage(options) {
  const slot = document.getElementById(options.slotId || 'pbe-entity-coverage');
  if (!slot) return;

  const sport = String(options.sport || '').toLowerCase();
  const label = SPORT_LABELS[sport] || sport.toUpperCase();
  const limit = options.limit || 6;

  let articles = [];
  try {
    const data = options.kind === 'team'
      ? await api.byTeamEntity(teamQueryAbbreviations(sport, options.abbreviation || options.name), sport)
      : await api.byPlayerEntity(options.name);
    articles = (data?.articles || []).filter((a) => a?.slug).slice(0, limit);
  } catch {
    articles = [];
  }

  if (!articles.length) {
    // An entity with no tagged coverage yet says so plainly and still offers
    // the league beat. It never pads the section with unrelated stories.
    slot.innerHTML = `
      <section class="pbe-entity-coverage pbe-entity-coverage--empty">
        <div class="pbe-entity-coverage-head">
          <h2>PropBetEdge coverage</h2>
        </div>
        <p class="pbe-entity-coverage-note">
          No PropBetEdge stories are tagged to ${escapeHtml(options.name || 'this entity')} yet.
          New coverage connects here automatically.
          <a href="/news/${sport}">Latest ${escapeHtml(label)} news →</a>
        </p>
      </section>
    `;
    return;
  }

  slot.innerHTML = `
    <section class="pbe-entity-coverage" aria-labelledby="pbe-entity-coverage-heading">
      <div class="pbe-entity-coverage-head">
        <h2 id="pbe-entity-coverage-heading">PropBetEdge coverage of ${escapeHtml(options.name)}</h2>
        <a href="/news/${sport}" class="more-link">All ${escapeHtml(label)} →</a>
      </div>
      <div class="article-grid fade-stagger">
        ${articles.map((a) => renderArticleCard(a)).join('')}
      </div>
    </section>
  `;
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
