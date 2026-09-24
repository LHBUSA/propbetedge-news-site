/**
 * src/pages/player-mlb-view.js — pure HTML builders for /player/mlb/:id.
 *
 * String in, string out; no DOM access so the regression suite can assert the
 * rendered markup. Section order (owner spec):
 *   HERO -> SELECTED SEASON -> CAREER TOTALS -> RECENT FORM -> SEASON HISTORY
 *   -> FULL GAME LOG -> (prop angle) -> RELATED NEWS
 * Hero, prop angle and related news are composed by player-mlb.js.
 */

import { escapeHtml, renderSparkline, renderSplits } from './player-shared.js';
import {
  DASH, val, fieldValues, selectedSeasonStat, shortDate,
  SEASON_FIELDS, CAREER_FIELDS, HISTORY_FIELDS, GAMELOG_FIELDS, RECENT_FIELDS, SPARK_KEY,
} from './player-mlb-data.js';

const e = (v) => escapeHtml(v == null ? '' : String(v));
const COLORS = {
  AVG: '#7FB3FF', HR: '#FF6B6B', RBI: 'var(--gold)', OPS: '#5FD38D', SB: '#FF8C42',
  ERA: '#5FD38D', WHIP: '#7FB3FF', K: '#FF6B6B', 'W-L': 'var(--gold)', SV: '#FF8C42',
};
const GROUP_NAME = { hitting: 'HITTING', pitching: 'PITCHING' };

export function groupSuffix(group, groups) {
  return groups && groups.length > 1 ? ` · ${GROUP_NAME[group]}` : '';
}

function kicker(text) {
  return `<div class="player-section-kicker">${e(text)}</div>`;
}
function statGrid(values, attrs = '') {
  return `<div class="player-stat-grid"${attrs}>${values.map((s) => `
    <div class="player-stat-cell">
      <div class="player-stat-label">${e(s.label)}</div>
      <div class="player-stat-value" style="color:${s.value === DASH ? 'var(--ink)' : (COLORS[s.label] || 'var(--ink)')}">${e(s.value)}</div>
    </div>`).join('')}</div>`;
}
function note(text, cls = '') {
  return `<div class="player-empty-card mlb-note ${cls}" role="status">${e(text)}</div>`;
}

/** Compact season selector, usable at 320px. */
export function renderSeasonBar(seasons, selected) {
  if (!seasons?.length) return '';
  return `<div class="mlb-season-bar">
    <label for="mlb-season-select">Season</label>
    <select id="mlb-season-select" data-mlb-season>${seasons.map((s) => `<option value="${e(s)}"${String(s) === String(selected) ? ' selected' : ''}>${e(s)}</option>`).join('')}</select>
  </div>`;
}

/** `<YEAR> SEASON STATS` ribbon for one group, from that season's own split. */
export function renderSeasonRibbon({ group, groups, season, line, historyStatus }) {
  const label = `${season} SEASON STATS${groupSuffix(group, groups)}`;
  const teams = line?.teams?.filter(Boolean) || [];
  const teamNote = teams.length > 1 ? ` · ${teams.join(' / ')}` : teams.length === 1 ? ` · ${teams[0]}` : '';
  let body;
  if (line?.stat) body = statGrid(fieldValues(SEASON_FIELDS[group], line.stat), ` data-mlb-ribbon="${group}" data-season="${e(season)}"`);
  else if (historyStatus === 'loading') body = note(`Loading ${season} statistics…`);
  else if (historyStatus === 'error') body = note(`${season} statistics unavailable right now.`, 'mlb-note-error');
  else body = note(`No MLB ${group} statistics recorded for ${season}.`);
  return `<section class="player-stat-ribbon" data-mlb-section="season" data-group="${group}">
    <div class="player-section-kicker" data-mlb-label="season">${e(label)}${e(teamNote)}</div>
    ${body}
  </section>`;
}

/** Season-performance / situational block for the selected season. */
export function renderSeasonSplit(group, stat) {
  if (!stat) return '';
  if (group === 'pitching') {
    return renderSplits([{ name: 'Season Performance', rows: [{ label: 'Total', statValues: [
      { label: 'ERA', value: val(stat.era) }, { label: 'WHIP', value: val(stat.whip) },
      { label: 'K/9', value: val(stat.strikeoutsPer9Inn) }, { label: 'BB/9', value: val(stat.walksPer9Inn) },
      { label: 'OPP AVG', value: val(stat.avg) },
    ] }] }]);
  }
  const pa = Number(stat.plateAppearances);
  const pct = (n) => (pa > 0 && n != null && Number.isFinite(Number(n))) ? `${((Number(n) / pa) * 100).toFixed(1)}%` : DASH;
  return renderSplits([{ name: 'Situational', rows: [{ label: 'Season Total', statValues: [
    { label: 'AVG', value: val(stat.avg) }, { label: 'OPS', value: val(stat.ops) },
    { label: 'HR', value: val(stat.homeRuns) }, { label: 'BB%', value: pct(stat.baseOnBalls) },
    { label: 'K%', value: pct(stat.strikeOuts) },
  ] }] }]);
}

/** CAREER TOTALS from StatsAPI's career split — never averaged season rates. */
export function renderCareer(group, groups, careerStat) {
  return `<section class="player-stat-ribbon mlb-career" data-mlb-section="career" data-group="${group}">
    ${kicker(`CAREER TOTALS${groupSuffix(group, groups)}`)}
    ${careerStat ? statGrid(fieldValues(CAREER_FIELDS[group], careerStat), ` data-mlb-career="${group}"`) : note('Career totals unavailable.')}
  </section>`;
}

function dateCell(iso) {
  return iso ? `<time datetime="${e(iso)}">${e(shortDate(iso))}</time>` : DASH;
}

/** RECENT FORM · <YEAR> · LAST N GAMES */
export function renderRecent(group, groups, season, log) {
  const suffix = groupSuffix(group, groups);
  const head = (n) => kicker(`RECENT FORM · ${season} · ${n}${suffix}`);
  if (!log || log.status === 'loading') return `<section class="player-section" data-mlb-section="recent" data-group="${group}">${head('LAST 10 GAMES')}${note(`Loading ${season} games…`)}</section>`;
  if (log.status === 'error') return `<section class="player-section" data-mlb-section="recent" data-group="${group}">${head('LAST 10 GAMES')}${note(`Recent form unavailable for ${season}.`, 'mlb-note-error')}</section>`;
  const rows = (log.rows || []).slice(0, 10);
  if (!rows.length) return `<section class="player-section" data-mlb-section="recent" data-group="${group}">${head('NO GAMES')}${note(`No MLB ${group} games recorded for ${season}.`)}</section>`;
  const fields = RECENT_FIELDS[group];
  const [sparkLabel, sparkKey] = SPARK_KEY[group];
  const values = rows.map((r) => Number(r.stat?.[sparkKey])).map((n) => (Number.isFinite(n) ? n : 0)).reverse();
  return `<section class="player-section" data-mlb-section="recent" data-group="${group}">
    ${head(`LAST ${rows.length} GAMES`)}
    <div class="player-form-card">
      ${rows.length > 1 ? `<div class="player-form-spark">${renderSparkline(values, 280, 50)}<div class="player-form-spark-label">${e(sparkLabel)} trend (oldest → newest)</div></div>` : ''}
      <div class="player-form-table mlb-table-scroll">
        <table>
          <thead><tr><th>Date</th><th>Opp</th>${fields.map(([l]) => `<th>${e(l)}</th>`).join('')}</tr></thead>
          <tbody>${rows.map((r) => `<tr data-date="${e(r.date || '')}"><td>${dateCell(r.date)}</td><td class="mlb-opp">${e(r.opp)}</td>${fieldValues(fields, r.stat).map((c) => `<td>${e(c.value)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>
    </div>
  </section>`;
}

/** SEASON HISTORY — every MLB yearByYear row, newest first, selected season highlighted. */
export function renderHistory(group, groups, history, selected) {
  const head = kicker(`SEASON HISTORY${groupSuffix(group, groups)}`);
  const wrap = (body) => `<section class="player-section" data-mlb-section="history" data-group="${group}">${head}${body}</section>`;
  if (!history || history.status === 'loading') return wrap(note('Loading season history…'));
  if (history.status === 'error') return wrap(note('Season history unavailable.', 'mlb-note-error'));
  const rows = history.rows || [];
  if (!rows.length) return wrap(note(`No MLB ${group} seasons recorded.`));
  const fields = HISTORY_FIELDS[group];
  return wrap(`<div class="player-gamelog-wrap mlb-table-scroll" role="region" aria-label="${e(`Season history ${group}`)}" tabindex="0">
    <table class="player-gamelog mlb-history">
      <thead><tr><th scope="col">Season</th><th scope="col">Team</th>${fields.map(([l]) => `<th scope="col">${e(l)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((r) => {
        const isSel = r.season === String(selected);
        return `<tr class="mlb-history-row${isSel ? ' is-selected' : ''}${r.isTotal ? ' is-total' : ''}" data-mlb-history-row data-season="${e(r.season)}" data-team="${e(r.teamLabel)}"${isSel ? ' aria-current="true"' : ''}>`
          + `<td><button type="button" class="mlb-season-link" data-mlb-pick="${e(r.season)}" aria-label="${e(`Show ${r.season} season`)}">${e(r.season)}</button></td>`
          + `<td title="${e(r.teamName || r.teamLabel)}">${e(r.teamLabel)}</td>`
          + fieldValues(fields, r.stat).map((c) => `<td>${e(c.value)}</td>`).join('')
          + '</tr>';
      }).join('')}</tbody>
    </table>
  </div>`);
}

/** GAME LOG · <YEAR> · N GAMES */
export function renderGameLogSection(group, groups, season, log) {
  const suffix = groupSuffix(group, groups);
  const wrap = (label, body) => `<section class="player-section" data-mlb-section="gamelog" data-group="${group}"><div class="player-section-kicker" data-mlb-label="gamelog">${e(label)}</div>${body}</section>`;
  if (!log || log.status === 'loading') return wrap(`GAME LOG · ${season}${suffix}`, note(`Loading ${season} game log…`));
  if (log.status === 'error') return wrap(`GAME LOG · ${season}${suffix}`, `${note(`Game log unavailable for ${season}.`, 'mlb-note-error')}<button type="button" class="mlb-retry" data-mlb-retry="${group}">Retry game log</button>`);
  const rows = log.rows || [];
  if (!rows.length) return wrap(`GAME LOG · ${season} · 0 GAMES${suffix}`, note(`No MLB ${group} games recorded for ${season}.`));
  const fields = GAMELOG_FIELDS[group];
  return wrap(`GAME LOG · ${season} · ${rows.length} GAMES${suffix}`, `<div class="player-gamelog-wrap mlb-table-scroll" role="region" aria-label="${e(`${season} game log ${group}`)}" tabindex="0">
    <table class="player-gamelog" data-mlb-gamelog="${group}" data-season="${e(season)}">
      <thead><tr><th scope="col">Date</th><th scope="col">Opp</th>${fields.map(([l]) => `<th scope="col">${e(l)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((r) => `<tr data-date="${e(r.date || '')}"><td>${dateCell(r.date)}</td><td class="mlb-opp">${e(r.opp)}</td>${fieldValues(fields, r.stat).map((c) => `<td>${e(c.value)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
  </div>`);
}

/**
 * Everything between the hero and the prop angle.
 * model = { groups, current, selected, seasons, history:{g:{status,rows}},
 *           profileSeason:{g}, career:{g}, logs:{g:{status,rows}} }
 */
export function renderProfileBody(model) {
  const { groups, current, selected, seasons } = model;
  const lines = {};
  for (const g of groups) {
    const h = model.history?.[g];
    lines[g] = selectedSeasonStat({
      history: h?.status === 'ok' ? h.rows : null,
      profileSeason: model.profileSeason?.[g],
      season: selected,
      current,
    });
  }
  const historyStatus = (g) => model.history?.[g]?.status || 'loading';
  const seasonBlock = groups.map((g) => renderSeasonRibbon({ group: g, groups, season: selected, line: lines[g], historyStatus: lines[g] ? 'ok' : historyStatus(g) })
    + renderSeasonSplit(g, lines[g]?.stat)).join('');
  return `<div class="mlb-profile" data-mlb-selected="${e(selected)}" data-mlb-groups="${e(groups.join(','))}">
    ${renderSeasonBar(seasons, selected)}
    ${seasonBlock}
    ${groups.map((g) => renderCareer(g, groups, model.career?.[g])).join('')}
    ${groups.map((g) => renderRecent(g, groups, selected, model.logs?.[g])).join('')}
    ${groups.map((g) => renderHistory(g, groups, model.history?.[g], selected)).join('')}
    ${groups.map((g) => renderGameLogSection(g, groups, selected, model.logs?.[g])).join('')}
  </div>`;
}
