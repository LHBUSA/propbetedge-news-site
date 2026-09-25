/**
 * VERIFIED TEAM CONTEXT — normalizes the existing /api/team-intelligence
 * payload (pbe-entity-hub/1 team contract) into article-sized tiles.
 *
 * No second version of team truth: every value here is read from the hub
 * snapshot the team pages already render. Fields the contract does not carry,
 * or carries for the wrong season, are omitted rather than approximated.
 */

import { isDisplayableValue } from './evidence.js';

const RECORD_RE = /^\d{1,3}-\d{1,3}(?:-\d{1,3})?$/;
const STREAK_RE = /^(?:W|L|T|OT|OTL)\d{1,2}$/i;

function num(value) {
  if (value == null || value === '' || value === '-') return null;
  const n = Number(String(value).replace(/^\+/, ''));
  return Number.isFinite(n) ? n : null;
}

export function ordinal(n) {
  const v = Math.trunc(n);
  const s = ['th', 'st', 'nd', 'rd'];
  const m = v % 100;
  return `${v}${s[(m - 20) % 10] || s[m] || s[0]}`;
}

function shortDate(value, opts = { weekday: 'short', month: 'short', day: 'numeric' }) {
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString('en-US', { ...opts, timeZone: 'America/New_York' }) : '';
}

function signed(n, digits = 0) {
  const text = Math.abs(n).toFixed(digits);
  return n > 0 ? `+${text}` : n < 0 ? `-${text}` : text;
}

function lastFinal(games) {
  return (Array.isArray(games) ? games : [])
    .filter((g) => g?.is_final && num(g.team_score) != null && num(g.opponent_score) != null && Number.isFinite(Date.parse(g.date)))
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0] || null;
}

function nextGame(games, now) {
  return (Array.isArray(games) ? games : [])
    .filter((g) => !g?.is_final && Number.isFinite(Date.parse(g?.date)) && Date.parse(g.date) >= now - 4 * 3600 * 1000)
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))[0] || null;
}

function opponentTag(game) {
  const abbr = game?.opponent?.abbr || game?.opponent?.name || '';
  if (!abbr) return '';
  return `${game.home_away === 'away' ? '@' : 'vs'} ${abbr}`;
}

function sportStat(sport, snapshot) {
  const ts = snapshot?.team_stats || {};
  if (sport === 'nfl') {
    const ppg = num(ts.points_per_game);
    const papg = num(ts.points_allowed_per_game);
    if (ppg != null && papg != null) return { label: 'PTS / GAME', value: ppg.toFixed(1), note: `${papg.toFixed(1)} allowed` };
  }
  if (sport === 'mlb') {
    const rs = num(ts.runs);
    const ra = num(ts.runs_allowed);
    if (rs != null && ra != null) return { label: 'RUN DIFF', value: signed(rs - ra), note: `${rs} scored · ${ra} allowed` };
  }
  if (sport === 'nhl') {
    const gf = num(ts.goals_for);
    const ga = num(ts.goals_against);
    if (gf != null && ga != null) return { label: 'GOAL DIFF', value: signed(gf - ga), note: `${gf} GF · ${ga} GA` };
  }
  if (sport === 'nba' || sport === 'wnba') {
    const pf = num(snapshot?.record?.points_for);
    const pa = num(snapshot?.record?.points_against);
    const gp = num(snapshot?.record?.games_played);
    if (pf != null && pa != null && gp) return { label: 'NET PTS / G', value: signed((pf - pa) / gp, 1), note: `${(pf / gp).toFixed(1)} scored` };
  }
  return null;
}

/**
 * payload: the /api/team-intelligence JSON body.
 * Returns null unless at least one verified quantitative tile survives.
 */
export function teamDataFromPayload(payload, sport, now = Date.now()) {
  if (!payload?.ok || !payload.snapshot) return null;
  const freshness = String(payload.freshness_state || '').toUpperCase();
  if (freshness && !['CURRENT', 'STALE'].includes(freshness)) return null;

  const s = payload.snapshot;
  if (String(s.sport || sport).toLowerCase() !== String(sport).toLowerCase()) return null;
  const seasonState = payload.readiness?.record_season || null;
  const record = s.record || {};
  const gp = num(record.games_played);
  const summary = String(record.summary || '').trim();
  const standings = s.standings || {};
  const division = standings.division || s.league_context?.division || null;
  const conference = standings.conference || s.league_context?.conference || null;
  const metrics = [];

  const current = seasonState === 'current';
  const prior = seasonState === 'prior_season';
  if ((current || prior) && gp > 0 && RECORD_RE.test(summary)) {
    const pct = String(record.winning_percentage || '').trim();
    metrics.push({
      key: 'record',
      label: current ? 'RECORD' : 'LAST SEASON',
      value: summary,
      note: current ? (/^\.?\d{3}$|^1\.000$/.test(pct) ? `${pct} win pct` : `${gp} games`) : 'Final regular-season record',
    });

    const divRank = num(standings.division_rank);
    const confRank = num(standings.conference_rank);
    if (divRank > 0 && division) {
      metrics.push({ key: 'rank', label: current ? 'DIVISION' : 'DIV FINISH', value: ordinal(divRank), note: division });
    } else if (confRank > 0 && conference) {
      metrics.push({ key: 'rank', label: current ? 'CONFERENCE' : 'CONF FINISH', value: ordinal(confRank), note: conference });
    }
  }

  if (current && gp > 0) {
    const streak = String(s.recent_form?.streak || '').trim();
    if (STREAK_RE.test(streak)) metrics.push({ key: 'streak', label: 'STREAK', value: streak.toUpperCase(), note: 'Current run' });
    const l10 = String(s.recent_form?.last10 || '').trim();
    if (RECORD_RE.test(l10) && l10 !== summary) metrics.push({ key: 'last10', label: 'LAST 10', value: l10, note: 'Recent form' });

    const last = lastFinal(s.recent_games || s.schedule?.recent);
    if (last) {
      const ts = num(last.team_score);
      const os = num(last.opponent_score);
      const result = ts > os ? 'W' : ts < os ? 'L' : 'T';
      metrics.push({ key: 'last', label: 'LAST RESULT', value: `${result} ${ts}-${os}`, note: [opponentTag(last), shortDate(last.date, { month: 'short', day: 'numeric' })].filter(Boolean).join(' · '), href: last.path || null });
    }
    const stat = sportStat(sport, s);
    if (stat) metrics.push({ key: 'stat', ...stat });
  }

  const quant = metrics.filter((m) => isDisplayableValue(m.value));
  if (!quant.length) return null;

  const upcoming = nextGame(s.upcoming_games || s.schedule?.upcoming, now);
  return {
    sport,
    name: s.name,
    abbreviation: s.abbreviation,
    logo: s.logo || null,
    path: s.slug ? `/team/${sport}/${s.slug}` : null,
    division,
    conference,
    seasonState,
    metrics: quant,
    nextGame: upcoming ? {
      label: 'NEXT GAME',
      value: opponentTag(upcoming) || 'Scheduled',
      note: shortDate(upcoming.date),
      href: upcoming.path || null,
    } : null,
    observedAt: payload.observed_at || s.source?.observed_at || null,
    freshness: freshness || null,
    source: payload.source_product || null,
  };
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

export function updatedLabel(iso) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return `Updated ${d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })} ET`;
}

/** Quantitative team tiles. Returns '' when nothing verified survives. */
export function renderTeamData(team) {
  if (!team?.metrics?.length) return '';
  const tiles = [...team.metrics, ...(team.nextGame ? [team.nextGame] : [])];
  return `<div class="pbe-av-team-data" data-pbe-quant="team" data-count="${tiles.length}">
    ${tiles.map((tile) => `<div class="pbe-av-team-stat${tile.label === 'NEXT GAME' ? ' is-context' : ''}">
      <span>${esc(tile.label)}</span>
      <strong>${esc(tile.value)}</strong>
      ${tile.note ? `<small>${esc(tile.note)}</small>` : ''}
    </div>`).join('')}
  </div>`;
}
