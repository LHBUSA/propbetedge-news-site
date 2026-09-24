/**
 * src/pages/player-mlb.js — /player/mlb/:id
 *
 * MLB player profile: hero -> selected season -> career totals -> recent form
 * -> season history -> full game log -> related news.
 *
 * Data contract (see player-mlb-data.js for URLs and normalization):
 *   1. profile     people/{id}?hydrate=stats(type=[season,career], season=<current>)
 *                  -> bio, current team, current-season line, CAREER totals
 *   2. yearByYear  people/{id}/stats?stats=yearByYear&group=<g>&sportId=1&hydrate=team
 *                  -> season history + the line for any selected season
 *   3. gameLog     people/{id}/stats?stats=gameLog&group=<g>&season=<selected>&sportId=1
 *                  -> recent form + game log, fetched on demand per season, cached
 *   4. teams       teams?sportId=1&season=<selected> -> opponent id -> abbreviation
 * 2–4 are independent: any of them failing leaves the rest of the page intact.
 */

import {
  playerPageShell, renderPlayerHero, renderPropAngle, renderPlayerLoading, escapeHtml,
} from './player-shared.js';
import { entityCoverageSlot, mountEntityCoverage } from '../entity-graph/entity-coverage.js';
import {
  currentMlbSeason, profileUrl, yearByYearUrl, gameLogUrl, teamsUrl, gameLogCacheKey,
  parseProfile, detectGroups, parseYearByYear, seasonsFromHistory, defaultSeason,
  teamAbbrMap, parseGameLog, mlbPlayerDescription,
} from './player-mlb-data.js';
import { renderProfileBody } from './player-mlb-view.js';

const MLB_TEAM_COLORS = {
  108:'#BA0021',109:'#A71930',110:'#DF4601',111:'#BD3039',112:'#0E3386',
  113:'#C6011F',114:'#E31937',115:'#333366',116:'#0C2340',117:'#EB6E1F',
  118:'#004687',119:'#005A9C',120:'#AB0003',121:'#002D72',133:'#003831',
  134:'#FDB827',135:'#2F241D',136:'#005C5C',137:'#FD5A1E',138:'#C41E3A',
  139:'#092C5C',140:'#003278',141:'#134A8E',142:'#002B5C',143:'#E81828',
  144:'#CE1141',145:'#27251F',146:'#00A3E0',147:'#003087',158:'#12284B',
};

// Client-side caches shared across profile visits in one session.
const gameLogCache = new Map();   // `${id}:${group}:${season}` -> parsed rows
const teamAbbrCache = new Map();  // season -> Promise<Map(teamId -> abbr)>

async function fetchJson(url, signal) {
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function seasonAbbrs(season) {
  if (!teamAbbrCache.has(season)) {
    const p = fetchJson(teamsUrl(season)).then(teamAbbrMap).catch(() => {
      teamAbbrCache.delete(season); // retry next time; fall back to names now
      return new Map();
    });
    teamAbbrCache.set(season, p);
  }
  return teamAbbrCache.get(season);
}

export async function renderMlbPlayerPage(root, playerId, setMeta) {
  root.__pbeMlbPlayer?.abort();
  const controller = new AbortController();
  const { signal } = controller;
  root.__pbeMlbPlayer = controller;
  const pathname = window.location.pathname;
  const live = () => !signal.aborted && root.__pbeMlbPlayer === controller && window.location.pathname === pathname;

  root.innerHTML = playerPageShell(renderPlayerLoading());

  if (!/^\d{1,10}$/.test(String(playerId))) {
    root.innerHTML = playerPageShell(renderPlayerError('Player not found'));
    return;
  }

  const current = currentMlbSeason();
  let profile;
  try {
    profile = parseProfile(await fetchJson(profileUrl(playerId, current), signal));
  } catch (err) {
    if (!live()) return;
    console.error('[player-mlb]', err);
    root.innerHTML = playerPageShell(renderPlayerError('Player data temporarily unavailable.'));
    return;
  }
  if (!live()) return;
  if (!profile) {
    root.innerHTML = playerPageShell(renderPlayerError('Player not found'));
    return;
  }

  const person = profile.person;
  const canonical = `https://propbetedge.ai/player/mlb/${playerId}`;
  const photo = `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/c_fill,g_face,h_400,w_400,q_auto:best/v1/people/${playerId}/headshot/67/current`;
  setMeta?.({
    title: `${person.fullName}${person.currentTeam?.name ? ` · ${person.currentTeam.name}` : ''} — MLB Stats, Career & Game Logs | PropBetEdge`,
    description: mlbPlayerDescription(person.fullName, person.currentTeam?.name),
    canonical,
    ogImage: photo,
  });

  const groups = detectGroups(profile);
  const state = {
    groups,
    current,
    selected: String(current),
    defaultSeason: String(current),
    seasons: [String(current)],
    history: Object.fromEntries(groups.map((g) => [g, { status: 'loading', rows: [] }])),
    profileSeason: profile.season,
    career: profile.career,
    logs: Object.fromEntries(groups.map((g) => [g, { status: 'loading', rows: [] }])),
    logGeneration: 0,
  };

  const teamId = person.currentTeam?.id;
  const bats = person.batSide?.code;
  const throws = person.pitchHand?.code;
  const heroHtml = renderPlayerHero({
    sport: 'mlb',
    photo, name: person.fullName,
    jersey: person.primaryNumber,
    position: person.primaryPosition?.abbreviation,
    team: person.currentTeam?.name,
    teamId,
    teamLogo: teamId ? `https://www.mlbstatic.com/team-logos/${teamId}.svg` : null,
    teamColor: teamId ? MLB_TEAM_COLORS[teamId] : null,
    age: person.currentAge,
    height: person.height,
    weight: person.weight ? `${person.weight} lb` : null,
    batsThrows: bats && throws ? `${bats}/${throws}` : null,
  });

  root.innerHTML = playerPageShell(`
    <div class="mlb-player" data-player-id="${escapeHtml(String(playerId))}">
      ${heroHtml}
      <div data-mlb-body></div>
      ${renderPropAngle({ name: person.fullName, sport: 'mlb' })}
      <section class="player-section">
        <div class="player-section-kicker">RELATED NEWS</div>
        ${entityCoverageSlot('pbe-player-coverage')}
      </section>
    </div>
  `);

  function paint() {
    if (!live()) return;
    const mount = root.querySelector('[data-mlb-body]');
    if (!mount) return;
    const focusSelect = document.activeElement?.matches?.('[data-mlb-season]');
    try {
      mount.innerHTML = renderProfileBody(state);
    } catch (err) {
      console.error('[player-mlb] render', err);
      mount.innerHTML = '<div class="player-empty-card">Statistics could not be displayed.</div>';
    }
    if (focusSelect) mount.querySelector('[data-mlb-season]')?.focus({ preventScroll: true });
  }

  function knownEmpty(group, season) {
    const hist = state.history[group];
    return hist.status === 'ok' && !hist.rows.some((r) => r.season === season);
  }

  async function loadGroupLog(group, season, generation, force) {
    const key = gameLogCacheKey(playerId, group, season);
    // Known empty from the source's own season history: no request, no zeros.
    if (!force && knownEmpty(group, season)) {
      state.logs[group] = { status: 'ok', rows: [] };
      return;
    }
    if (!force && gameLogCache.has(key)) {
      state.logs[group] = { status: 'ok', rows: gameLogCache.get(key) };
      return;
    }
    try {
      const [payload, abbrs] = await Promise.all([
        fetchJson(gameLogUrl(playerId, group, season), signal),
        seasonAbbrs(season),
      ]);
      const rows = parseGameLog(payload, { season, abbrs });
      gameLogCache.set(key, rows);
      if (generation === state.logGeneration) state.logs[group] = { status: 'ok', rows };
    } catch (err) {
      if (generation === state.logGeneration) state.logs[group] = { status: 'error', rows: [] };
    }
  }

  async function loadLogs(onlyGroup = null) {
    const generation = ++state.logGeneration;
    const season = state.selected;
    const targets = onlyGroup ? [onlyGroup] : groups;
    for (const g of targets) {
      const cached = gameLogCache.has(gameLogCacheKey(playerId, g, season));
      if (onlyGroup || (!cached && !knownEmpty(g, season))) state.logs[g] = { status: 'loading', rows: [] };
    }
    paint();
    await Promise.allSettled(targets.map((g) =>
      loadGroupLog(g, season, generation, Boolean(onlyGroup)).then(() => {
        if (generation === state.logGeneration) paint();
      })));
  }

  function select(season, { scroll = false } = {}) {
    season = String(season);
    if (!state.seasons.includes(season) || season === state.selected) return;
    state.selected = season;
    try {
      const url = new URL(window.location.href);
      if (season === state.defaultSeason) url.searchParams.delete('season');
      else url.searchParams.set('season', season);
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    } catch (_) { /* URL reflection is a convenience only */ }
    loadLogs().catch(() => {});
    if (scroll) root.querySelector('[data-mlb-section="season"]')?.scrollIntoView({ block: 'start' });
  }

  root.addEventListener('change', (ev) => {
    if (!live()) return;
    if (ev.target?.matches?.('[data-mlb-season]')) select(ev.target.value);
  }, { signal });
  root.addEventListener('click', (ev) => {
    if (!live()) return;
    const retry = ev.target.closest?.('[data-mlb-retry]');
    if (retry) { loadLogs(retry.dataset.mlbRetry).catch(() => {}); return; }
    const row = ev.target.closest?.('[data-mlb-history-row]');
    if (row) select(row.dataset.season, { scroll: true });
  }, { signal });

  paint();

  // Reciprocal link: the stories tagged to this player.
  try {
    mountEntityCoverage({ slotId: 'pbe-player-coverage', sport: 'mlb', kind: 'player', name: person.fullName });
  } catch (err) { console.error('[player-mlb] coverage', err); }

  // Season history, one request per rendered group; each can fail alone.
  const results = await Promise.allSettled(groups.map((g) => fetchJson(yearByYearUrl(playerId, g), signal)));
  if (!live()) return;
  const okHistories = {};
  results.forEach((res, i) => {
    const g = groups[i];
    if (res.status === 'fulfilled') {
      const rows = parseYearByYear(res.value, g);
      state.history[g] = { status: 'ok', rows };
      okHistories[g] = rows;
    } else {
      state.history[g] = { status: 'error', rows: [] };
    }
  });
  const seasons = seasonsFromHistory(okHistories);
  state.seasons = seasons.length ? seasons : [String(current)];
  state.defaultSeason = seasons.length ? defaultSeason(okHistories, current) : String(current);
  let requested = null;
  try { requested = new URL(window.location.href).searchParams.get('season'); } catch (_) {}
  state.selected = requested && state.seasons.includes(requested) ? requested : state.defaultSeason;
  await loadLogs();
}

function renderPlayerError(msg) {
  return `
    <section class="player-error">
      <h2>Player not available</h2>
      <p>${escapeHtml(msg || 'Could not load player profile.')}</p>
      <p><a href="/leaders/mlb">← Back to MLB leaders</a></p>
    </section>
  `;
}
