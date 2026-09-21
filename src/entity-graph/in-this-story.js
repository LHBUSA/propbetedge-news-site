/**
 * src/entity-graph/in-this-story.js
 *
 * The "In this story" entity bar — the same markup on the edge and in the
 * browser, so a crawler and a reader receive an identical navigable graph.
 *
 * Every chip is a real link to a real entity page. Chips are compact and
 * editorial, not hero cards: the story is still the page.
 *
 * Accessibility: the link text is the accessible name, so portrait images are
 * decorative (alt="") rather than repeating the name to a screen reader.
 * Every image carries explicit dimensions so the bar cannot shift layout.
 */

import { SPORT_LABELS } from './entities.js';

export function renderInThisStory(manifest, options = {}) {
  if (!manifest) return '';
  const players = manifest.players || [];
  const teams = manifest.teams || [];
  const games = manifest.games || [];
  if (!players.length && !teams.length && !games.length) return '';

  const maxPlayers = options.maxPlayers ?? 6;
  const maxTeams = options.maxTeams ?? 4;

  const chips = [
    ...players.slice(0, maxPlayers).map(playerChip),
    ...teams.slice(0, maxTeams).map(teamChip),
    ...games.slice(0, 2).map(gameChip),
  ].filter(Boolean).join('');

  if (!chips) return '';

  return `<aside class="pbe-in-this-story" aria-labelledby="pbe-in-this-story-label">`
    + `<h2 class="pbe-in-this-story-label" id="pbe-in-this-story-label">In this story</h2>`
    + `<ul class="pbe-entity-chips">${chips}</ul>`
    + `</aside>`;
}

function playerChip(player) {
  if (!player?.canonical_url || !player?.name) return '';
  const meta = [player.position, player.team_id].filter(Boolean).join(' · ');
  return `<li class="pbe-entity-chip pbe-entity-chip--player">`
    + `<a href="${attr(player.path || player.canonical_url)}" data-entity-kind="player" data-entity-id="${attr(player.id)}">`
    + portrait(player.image_url, player.name, 'player')
    + `<span class="pbe-entity-chip-text">`
    + `<span class="pbe-entity-chip-name">${esc(player.name)}</span>`
    + (meta ? `<span class="pbe-entity-chip-meta">${esc(meta)}</span>` : '')
    + `</span></a></li>`;
}

function teamChip(team) {
  if (!team?.canonical_url || !team?.name) return '';
  return `<li class="pbe-entity-chip pbe-entity-chip--team">`
    + `<a href="${attr(team.path || team.canonical_url)}" data-entity-kind="team" data-entity-id="${attr(team.abbreviation || team.id)}">`
    + portrait(team.logo_url, team.name, 'team')
    + `<span class="pbe-entity-chip-text">`
    + `<span class="pbe-entity-chip-name">${esc(team.name)}</span>`
    + `<span class="pbe-entity-chip-meta">${esc(SPORT_LABELS[team.sport] || '')}</span>`
    + `</span></a></li>`;
}

function gameChip(game) {
  if (!game?.canonical_url) return '';
  const when = formatGameDate(game.start_date);
  const meta = [when, game.status].filter(Boolean).join(' · ') || 'Game Center';
  return `<li class="pbe-entity-chip pbe-entity-chip--game">`
    + `<a href="${attr(game.path || game.canonical_url)}" data-entity-kind="game" data-entity-id="${attr(game.id)}">`
    + `<span class="pbe-entity-chip-figure pbe-entity-chip-figure--game" aria-hidden="true">`
    + (game.away?.logo_url ? `<img src="${attr(game.away.logo_url)}" alt="" width="22" height="22" loading="lazy" decoding="async" />` : '')
    + (game.home?.logo_url ? `<img src="${attr(game.home.logo_url)}" alt="" width="22" height="22" loading="lazy" decoding="async" />` : '')
    + `</span>`
    + `<span class="pbe-entity-chip-text">`
    + `<span class="pbe-entity-chip-name">${esc(game.name)}</span>`
    + `<span class="pbe-entity-chip-meta">${esc(meta)}</span>`
    + `</span></a></li>`;
}

function portrait(src, name, kind) {
  if (src) {
    return `<span class="pbe-entity-chip-figure" aria-hidden="true">`
      + `<img src="${attr(src)}" alt="" width="34" height="34" loading="lazy" decoding="async"`
      + ` class="pbe-entity-chip-img pbe-entity-chip-img--${kind}" />`
      + `</span>`;
  }
  return `<span class="pbe-entity-chip-figure pbe-entity-chip-figure--empty" aria-hidden="true">${esc(initials(name))}</span>`;
}

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '·';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatGameDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function attr(value) {
  return esc(value).replace(/"/g, '&quot;');
}

export { esc as escapeEntityHtml, attr as escapeEntityAttr };
