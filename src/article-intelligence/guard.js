/**
 * Article-intelligence integrity guard. Shared by the unit tests and the
 * production canary, so "what counts as data" has exactly one definition.
 *
 * Works on the rendered HTML string (no DOM needed).
 */

import { isDisplayableValue } from './evidence.js';
import { NFL_NO_PLAYER_CHART } from './adapters.js';

const DATA_HEADLINE_RE = /Here(?:’|'|&#39;)s the data\./;

function blocks(html, marker) {
  const out = [];
  let from = 0;
  while (true) {
    const idx = html.indexOf(marker, from);
    if (idx < 0) break;
    const stops = ['data-pbe-quant=', 'class="pbe-av-block', '</section>']
      .map((stop) => html.indexOf(stop, idx + marker.length))
      .filter((pos) => pos > 0);
    const end = stops.length ? Math.min(...stops) : html.length;
    out.push(html.slice(idx, end));
    from = idx + marker.length;
  }
  return out;
}

function strongValues(fragment) {
  return [...fragment.matchAll(/<strong>([\s\S]*?)<\/strong>/g)].map((m) => m[1].replace(/<[^>]+>/g, '').trim());
}

/** True when at least one quantitative block shows a real numeric value. */
export function hasQuantitativeBlock(html) {
  return blocks(String(html || ''), 'data-pbe-quant=').some((fragment) =>
    strongValues(fragment).some((value) => isDisplayableValue(value) && /\d/.test(value)));
}

function visibleText(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/\s(?:title|aria-label|alt|href|src|class|style|data-[a-z-]+)="[^"]*"/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * Returns a list of violations (empty = pass).
 * opts.hydrated: true when the HTML is the post-hydration state.
 * opts.manifest / opts.sport: enables role checks.
 */
export function auditIntelligenceHtml(html, opts = {}) {
  const text = String(html || '');
  const violations = [];
  if (!text.trim()) return violations;

  if (DATA_HEADLINE_RE.test(text) && !hasQuantitativeBlock(text)) {
    violations.push('data_headline_without_quantitative_block');
  }

  const visible = visibleText(text);
  const bad = visible.match(/(?:^|[\s>(])(NaN|undefined|null|Infinity)(?=[\s<).,]|$)/);
  if (bad) violations.push(`placeholder_value_rendered:${bad[1]}`);

  for (const card of blocks(text, 'data-pbe-quant="evidence"')) {
    const values = strongValues(card);
    if (!values.length || values.some((v) => !isDisplayableValue(v))) violations.push('empty_evidence_card');
    const pairs = [...card.matchAll(/<strong>([\s\S]*?)<\/strong>\s*<b>([\s\S]*?)<\/b>/g)].map((m) => `${m[2]}|${m[1]}`);
    if (new Set(pairs).size !== pairs.length) violations.push('duplicate_metric_in_evidence_card');
  }

  const contexts = [...text.matchAll(/class="pbe-av-evidence-card[^"]*"[\s\S]*?<p>([\s\S]*?)<\/p>/g)].map((m) => m[1].trim());
  if (new Set(contexts).size !== contexts.length) violations.push('duplicate_evidence_sentence');

  const labelValues = [...text.matchAll(/class="pbe-av-evidence-stat">\s*<strong>([\s\S]*?)<\/strong>\s*<b>([\s\S]*?)<\/b>/g)].map((m) => `${m[2]}|${m[1]}`);
  if (new Set(labelValues).size !== labelValues.length) violations.push('duplicate_numeric_evidence');

  const markets = text.match(/data-pbe-markets[\s\S]*?<\/ul>/)?.[0] || '';
  if (/<strong>|data-pbe-quant/.test(markets)) violations.push('market_tag_rendered_as_statistic');

  for (const card of blocks(text, 'data-pbe-quant="player"')) {
    if (!strongValues(card).some((v) => isDisplayableValue(v) && /\d/.test(v))) violations.push('empty_current_form_card');
  }

  if (opts.hydrated) {
    if (/pbe-av-loading|data-pbe-team-slot/.test(text)) violations.push('unresolved_loading_skeleton');
    if (/Checking current data…/.test(text)) violations.push('unresolved_live_header');
  }

  const sport = String(opts.sport || text.match(/data-sport="([a-z]+)"/)?.[1] || '').toLowerCase();
  const playerId = text.match(/data-player-id="([^"]*)"/)?.[1] || '';
  if (sport === 'nfl' && playerId && opts.manifest) {
    const selected = (opts.manifest.players || []).find((p) => String(p.id) === playerId);
    if (selected && NFL_NO_PLAYER_CHART.has(String(selected.position || '').toUpperCase())) {
      violations.push(`unsupported_position_selected:${selected.position}`);
    }
  }
  const cardSport = text.match(/class="pbe-av-player-card is-([a-z]+)"/)?.[1];
  if (cardSport && sport && cardSport !== sport) violations.push(`wrong_sport_metrics:${cardSport}`);

  const player = playerId ? (opts.manifest?.players || []).find((p) => String(p.id) === playerId) : null;
  const playerCard = blocks(text, 'data-pbe-quant="player"').join(' ');
  if (player && playerCard) {
    const pos = String(player.position || '').toUpperCase();
    const labels = [...playerCard.matchAll(/<span>([^<]+)<\/span>\s*<strong>/g)].map((m) => m[1].trim().toUpperCase());
    if (sport === 'nhl' && pos === 'G' && labels.some((l) => ['SOG', 'G', 'A', 'PTS'].includes(l))) violations.push('goalie_with_skater_metrics');
    if (sport === 'nhl' && pos && pos !== 'G' && labels.some((l) => ['SV%', 'GAA'].includes(l))) violations.push('skater_with_goalie_metrics');
    if (sport === 'nfl' && ['WR', 'TE', 'RB', 'FB'].includes(pos) && /Passing Yards per game/.test(playerCard)) violations.push('unsupported_metric_position_pairing');
    if (sport === 'nfl' && NFL_NO_PLAYER_CHART.has(pos)) violations.push(`unsupported_position_chart:${pos}`);
  }

  return violations;
}

export { DATA_HEADLINE_RE };
