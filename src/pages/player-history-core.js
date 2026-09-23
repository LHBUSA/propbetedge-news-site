/** Pure, source-keyed profile normalization. Unknown is never zero. */
export const list = v => Array.isArray(v) ? v : [];
export const missing = v => v == null || v === '' || v === '-' || v === '--' || v === '\u2014';
export function display(v) { return missing(v) || (typeof v === 'number' && !Number.isFinite(v)) ? '\u2014' : String(v); }
export function number(v) { if (missing(v)) return null; const n = Number(String(v).replace(/,/g, '').replace(/%$/, '')); return Number.isFinite(n) ? n : null; }
export function fields(names, stats) { return Object.fromEntries(list(names).map((name, i) => [name, list(stats)[i] ?? null])); }
export function paginate(rows, requested = 1, size = 20) {
  const pageSize = Math.max(1, Math.min(100, Math.floor(Number(size)) || 20));
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.max(1, Math.min(pages, Math.floor(Number(requested)) || 1));
  return { rows: rows.slice((page - 1) * pageSize, page * pageSize), page, pages, total: rows.length };
}
export const nhlSeasonLabel = year => /^\d{8}$/.test(String(year)) ? `${String(year).slice(0, 4)}-${String(year).slice(6)}` : String(year);
export function nhlEntryStatus(data, now = new Date()) {
  const regularRows = list(data?.seasonTotals).filter(
    (row) => row?.leagueAbbrev === 'NHL' && String(row?.gameTypeId) === '2'
  );
  const careerGames = number(data?.careerTotals?.regularSeason?.gamesPlayed);
  const hasRegularSeasonGame = (careerGames != null && careerGames > 0)
    || regularRows.some((row) => {
      const gp = number(row?.gamesPlayed);
      return gp != null && gp > 0;
    });
  if (hasRegularSeasonGame) return null;

  const birth = /^\d{4}-\d{2}-\d{2}$/.test(String(data?.birthDate || ''))
    ? new Date(`${data.birthDate}T00:00:00Z`)
    : null;
  const current = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(current.getTime())) return null;

  const seasonStartYear = current.getUTCMonth() + 1 >= 7
    ? current.getUTCFullYear()
    : current.getUTCFullYear() - 1;
  const cutoff = new Date(Date.UTC(seasonStartYear, 8, 15));
  let ageAtCutoff = null;

  if (birth && Number.isFinite(birth.getTime())) {
    ageAtCutoff = cutoff.getUTCFullYear() - birth.getUTCFullYear();
    if (
      cutoff.getUTCMonth() < birth.getUTCMonth()
      || (cutoff.getUTCMonth() === birth.getUTCMonth() && cutoff.getUTCDate() < birth.getUTCDate())
    ) ageAtCutoff--;
  }

  const rookieEligible = ageAtCutoff != null && ageAtCutoff < 26;
  return {
    noNhlRegularSeasonGames: true,
    rookieEligible,
    ageAtCutoff,
    label: rookieEligible ? 'ROOKIE ELIGIBLE' : 'NHL DEBUT PENDING',
    title: rookieEligible ? 'NHL debut pending' : 'No NHL regular-season games yet',
  };
}
export function sourcePhase(data) {
  const f = list(data?.filters).find(x => /^(seasontype|seasonType)$/i.test(x?.name || ''));
  return f?.value == null ? null : String(f.value);
}
export function espnCategories(data, phase = '2') {
  const reported = sourcePhase(data);
  if (reported && reported !== String(phase)) throw new Error('The source returned a different season type.');
  return list(data?.categories).filter(c => list(c.names).length).map(c => {
    const names = c.names, labels = names.map((n, i) => c.labels?.[i] || n);
    const validRow = r => Number.isInteger(Number(r.season?.year)) && Number(r.season.year) > 0 && Array.isArray(r.stats) && r.stats.length === names.length;
    const skipped = list(c.statistics).filter(r => !validRow(r)).length;
    const rows = list(c.statistics).filter(validRow)
      .map((r, i) => ({
        key: `${c.name}:${r.season.year}:${r.teamId || r.teamSlug || 'total'}:${i}`,
        year: String(r.season.year), season: r.season.displayName || String(r.season.year),
        team: data.teams?.[r.teamSlug]?.abbreviation || r.teamAbbreviation || r.team?.abbreviation || r.teamSlug || (r.teamId ? String(r.teamId) : 'Season total'),
        total: r.isTotal === true || r.teamSlug === 'total' || r.teamId === '0',
        values: fields(names, r.stats), complete: list(r.stats).length === names.length,
      })).sort((a, b) => Number(b.year) - Number(a.year));
    return { key: c.name, title: c.displayName || c.name, names, labels, rows, skipped,
      career: list(c.totals).length === names.length ? fields(names, c.totals) : null };
  });
}
export function defaultCategory(categories, sport, position) {
  const priorities = sport === 'nfl'
    ? position === 'QB' ? ['passing', 'rushing'] : ['RB', 'FB'].includes(position) ? ['rushing', 'receiving']
      : ['WR', 'TE'].includes(position) ? ['receiving'] : position === 'K' ? ['kicking'] : position === 'P' ? ['punting'] : ['defensive', 'defense']
    : ['averages', 'totals', 'nhl'];
  return priorities.find(p => categories.some(c => c.key === p)) || categories[0]?.key || '';
}
function exhibition(meta) { return meta?.team?.isAllStar === true || meta?.opponent?.isAllStar === true || /pro bowl|all.star/i.test(`${meta?.name || ''} ${meta?.description || ''}`); }
/** A game-log's column names belong to that response, never a guessed position. */
export function espnGameLog(data, year, phase = '2') {
  const reported = sourcePhase(data);
  if (reported && reported !== String(phase)) throw new Error('Game log season type mismatch.');
  const reportedYear = list(data?.filters).find(f => /^(eventType|season)$/i.test(f?.name || ''))?.value;
  if (/^\d{4}$/.test(String(reportedYear || '')) && String(reportedYear) !== String(year)) throw new Error('Game log season mismatch.');
  const names = list(data?.names), labels = names.map((n, i) => data.labels?.[i] || n), found = new Map();
  let skipped = 0;
  for (const st of list(data?.seasonTypes)) {
    const title = String(st.displayName || '').toLowerCase();
    const stType = /postseason|playoffs/.test(title) ? '3' : /preseason/.test(title) ? '1' : /regular/.test(title) ? '2' : null;
    if (stType && stType !== String(phase)) continue;
    for (const cat of list(st.categories)) for (const row of list(cat.events)) {
      const id = String(row.eventId || row.id || '');
      const meta = data.events?.[id];
      if (!id || !meta || !names.length || !Array.isArray(row.stats) || row.stats.length !== names.length) { skipped++; continue; }
      if (exhibition(meta)) continue;
      const date = meta.gameDate || meta.date;
      if (!date || !Number.isFinite(Date.parse(date))) { skipped++; continue; }
      found.set(id, { id, date, year: String(year), phase: String(phase),
        opponent: [meta.atVs, meta.opponent?.abbreviation || meta.opponent?.displayName].filter(Boolean).join(' '),
        result: [meta.gameResult, meta.score].filter(Boolean).join(' '),
        team: meta.team?.abbreviation || '', values: fields(names, row.stats) });
    }
  }
  const rows = [...found.values()].sort((a, b) => Date.parse(b.date) - Date.parse(a.date) || b.id.localeCompare(a.id));
  return { names, labels, rows, skipped };
}
const LEDGER_NAMES = {
  QB: [['cmp','CMP'],['att','ATT'],['pyd','PASS YDS'],['ptd','PASS TD'],['int','INT'],['sck','SACK'],['car','CAR'],['ryd','RUSH YDS'],['rtd','RUSH TD']],
  RB: [['car','CAR'],['ryd','RUSH YDS'],['rtd','RUSH TD'],['rec','REC'],['tgt','TGT'],['recyd','REC YDS'],['rectd','REC TD']],
  WR: [['rec','REC'],['tgt','TGT'],['recyd','REC YDS'],['rectd','REC TD'],['car','CAR'],['ryd','RUSH YDS']],
};
export function ledgerGameLog(data, id, year, phase, position) {
  if (data?.ok !== true || String(data.player?.espn_id) !== String(id)) return null;
  const coverage = data.coverage || {}, current = coverage.current_season;
  const covered = Number(year) === Number(current?.season) ? current?.available === true
    : list(coverage.seasons_covered).map(String).includes(String(year)) && !list(coverage.missing_seasons).map(String).includes(String(year));
  if (!covered) return null;
  const defs = LEDGER_NAMES[position] || LEDGER_NAMES[position === 'TE' ? 'WR' : 'RB'];
  const wanted = String(phase) === '3' ? 'POST' : 'REG', unique = new Map();
  for (const row of list(data.game_log)) {
    if (String(row.season) !== String(year) || row.season_type !== wanted || !row.event_id) continue;
    unique.set(String(row.event_id), { id: String(row.event_id), date: row.date, year: String(year), phase: String(phase),
      opponent: `${row.home === false ? '@ ' : ''}${row.opponent || ''}`, result: row.result || '', team: row.team || '',
      values: fields(defs.map(d => d[0]), defs.map(d => row.stats?.[d[0]] ?? null)) });
  }
  return { names: defs.map(d => d[0]), labels: defs.map(d => d[1]), rows: [...unique.values()].sort((a,b) => Date.parse(b.date)-Date.parse(a.date)), skipped: 0 };
}
const NHL_SKATER = [['gamesPlayed','GP'],['goals','G'],['assists','A'],['points','PTS'],['plusMinus','+/-'],['shots','SOG'],['shootingPctg','SH%'],['pim','PIM'],['avgToi','TOI/G']];
const NHL_GOALIE = [['gamesPlayed','GP'],['wins','W'],['losses','L'],['otLosses','OTL'],['savePctg','SV%'],['goalsAgainstAvg','GAA'],['shutouts','SO'],['shotsAgainst','SA']];
function nhlValues(row, defs) {
  return Object.fromEntries(defs.map(([name]) => {
    const value = row?.[name] ?? (name === 'otLosses' ? row?.overtimeLosses : null);
    const n = number(value);
    return [name, missing(value) ? null : name === 'shootingPctg' ? n === null ? null : `${(n*100).toFixed(1)}%`
      : name === 'savePctg' ? n === null ? null : n.toFixed(3)
      : name === 'goalsAgainstAvg' ? n === null ? null : n.toFixed(2) : value];
  }));
}
export function nhlCategories(data, phase = '2') {
  const defs = data.position === 'G' ? NHL_GOALIE : NHL_SKATER;
  const names = defs.map(d => d[0]), labels = defs.map(d => d[1]);
  const rows = list(data.seasonTotals).filter(r => r.leagueAbbrev === 'NHL' && String(r.gameTypeId) === String(phase))
    .map((r,i) => ({ key: `nhl:${r.season}:${i}`, year: String(r.season), season: nhlSeasonLabel(r.season),
      team: r.teamName?.default || r.teamAbbrev || '', total: r.isTotal === true,
      values: nhlValues(r, defs), complete: true })).sort((a,b) => Number(b.year)-Number(a.year));
  const career = String(phase) === '3' ? data.careerTotals?.playoffs : data.careerTotals?.regularSeason;
  return [{ key: 'nhl', title: data.position === 'G' ? 'Goaltending' : 'Skating', names, labels, rows, career: career ? nhlValues(career, defs) : null }];
}
export function nhlGameLog(data, year, phase, goalie) {
  if (data?.season != null && String(data.season) !== String(year)) throw new Error('Game log season mismatch.');
  if (data?.gameTypeId != null && String(data.gameTypeId) !== String(phase)) throw new Error('Game log type mismatch.');
  const defs = goalie ? [['decision','DEC'],['goalsAgainst','GA'],['shotsAgainst','SA'],['savePctg','SV%'],['toi','TOI']]
    : [['goals','G'],['assists','A'],['points','PTS'],['plusMinus','+/-'],['shots','SOG'],['pim','PIM'],['toi','TOI']];
  const unique = new Map(); let skipped = 0;
  for (const r of list(data?.gameLog)) {
    if (r.gameTypeId != null && String(r.gameTypeId) !== String(phase)) continue;
    if (!r.gameId || !r.gameDate || !Number.isFinite(Date.parse(r.gameDate))) { skipped++; continue; }
    unique.set(String(r.gameId), { id:String(r.gameId), date:r.gameDate, year:String(year), phase:String(phase),
      opponent:`${r.homeRoadFlag === 'R' ? '@ ' : ''}${r.opponentAbbrev || ''}`, team:r.teamAbbrev || '', result:r.decision || '', values:nhlValues(r,defs) });
  }
  return { names: defs.map(d=>d[0]), labels:defs.map(d=>d[1]), rows:[...unique.values()].sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)), skipped };
}
export function seasonOptions(categories) {
  const found = new Map();
  for (const cat of categories) for (const r of cat.rows) if (!found.has(r.year)) found.set(r.year, r.season);
  return [...found].sort((a,b)=>Number(b[0])-Number(a[0]));
}
export function ribbonFields(sport, position, category) {
  let keys;
  if (sport === 'nfl') keys = position === 'QB' && category.key === 'passing' ? ['passingYards','passingTouchdowns','interceptions','completionPct','QBRating','gamesPlayed']
    : category.key === 'rushing' ? ['rushingYards','rushingTouchdowns','yardsPerRushAttempt','rushingAttempts','gamesPlayed']
    : category.key === 'receiving' ? ['receptions','receivingYards','receivingTouchdowns','receivingTargets','yardsPerReception','gamesPlayed']
    : category.names.slice(0,8);
  else if (sport === 'nba' || sport === 'wnba') keys = category.key === 'averages' ? ['avgPoints','avgRebounds','avgAssists','avgSteals','avgBlocks','fieldGoalPct','threePointFieldGoalPct','gamesPlayed'] : category.names.slice(-8);
  else keys = category.names.slice(0,8);
  return keys.filter(k => category.names.includes(k)).map(k => ({ key:k, label: category.labels[category.names.indexOf(k)] || k }));
}
