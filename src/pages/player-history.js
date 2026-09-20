import { playerPageShell, renderPlayerHero, renderPlayerLoading, escapeHtml } from './player-shared.js';
import { display, list, espnCategories, espnGameLog, nhlCategories, nhlGameLog, ledgerGameLog, defaultCategory, seasonOptions, ribbonFields, paginate } from './player-history-core.js';
import '../styles/player-history.css';

const SPORT_NAMES = { nfl:'NFL', nba:'NBA', wnba:'WNBA', nhl:'NHL' };
const e = value => escapeHtml(display(value)).replace(/'/g, '&#39;');
const phaseLabel = phase => phase === '3' ? 'Playoffs' : 'Regular season';
const safeImage = value => typeof value === 'string' && /^https:\/\//i.test(value) ? value : null;
function dateLabel(value) {
  if (!value) return '\u2014';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) { const [y,m,d] = value.split('-'); return `${m}/${d}/${y}`; }
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString('en-US', { timeZone:'America/New_York', year:'numeric', month:'short', day:'numeric' }) : '\u2014';
}
function heroFrom(sport, data) {
  if (sport !== 'nhl') {
    const a = data.athlete, t = a.team || {};
    return { sport, name:a.displayName, photo:safeImage(a.headshot?.href), jersey:a.jersey, position:a.position?.abbreviation,
      team:t.displayName, teamLogo:safeImage(t.logos?.[0]?.href || t.logo), teamColor:/^[a-f0-9]{6}$/i.test(t.color || '') ? `#${t.color}` : null,
      age:a.age, height:a.displayHeight, weight:a.displayWeight };
  }
  const b = data.birthDate ? new Date(`${data.birthDate}T00:00:00Z`) : null, now = new Date();
  let age = b && Number.isFinite(b.getTime()) ? now.getUTCFullYear()-b.getUTCFullYear() : null;
  if (age != null && (now.getUTCMonth()<b.getUTCMonth() || (now.getUTCMonth()===b.getUTCMonth() && now.getUTCDate()<b.getUTCDate()))) age--;
  return { sport, name:[data.firstName?.default,data.lastName?.default].filter(Boolean).join(' '),
    photo:safeImage(data.headshot), team:data.fullTeamName?.default, teamLogo:safeImage(data.teamLogo), jersey:data.sweaterNumber,
    position:data.position, age, height:data.heightInInches ? `${Math.floor(data.heightInInches/12)}' ${data.heightInInches%12}"` : null,
    weight:data.weightInPounds ? `${data.weightInPounds} lbs` : null };
}
function table(headers, rows, caption) {
  if (!rows.length) return '<p class="ph-empty">No records returned for this selection.</p>';
  return `<div class="ph-table-wrap" tabindex="0" role="region" aria-label="${e(caption)}"><table class="ph-table"><caption>${e(caption)}</caption><thead><tr>${headers.map(h=>`<th scope="col">${e(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map((v,i)=>i===0?`<th scope="row">${e(v)}</th>`:`<td>${e(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function pagination(p, kind) {
  if (p.pages < 2) return '';
  return `<nav class="ph-pagination" aria-label="${kind === 'history' ? 'Season history' : 'Game log'} pages"><button type="button" data-ph-page="${kind}" data-delta="-1" ${p.page===1?'disabled':''}>Previous</button><span>Page ${p.page} of ${p.pages} \u00b7 ${p.total} records</span><button type="button" data-ph-page="${kind}" data-delta="1" ${p.page===p.pages?'disabled':''}>Next</button></nav>`;
}
function section(title, body, note='') {
  return `<section class="ph-section"><div class="ph-section-head"><h2>${e(title)}</h2>${note?`<p>${e(note)}</p>`:''}</div>${body}</section>`;
}
/** All years remain available; only the selected season's log is requested. */
export async function renderPlayerHistory(root, sport, playerId, setMeta) {
  root.__pbePlayerHistory?.abort();
  const controller = new AbortController(), { signal } = controller;
  root.__pbePlayerHistory = controller;
  const pathname = window.location.pathname;
  const current = () => !signal.aborted && root.__pbePlayerHistory === controller && window.location.pathname === pathname;
  root.innerHTML = playerPageShell(renderPlayerLoading());
  if (!SPORT_NAMES[sport] || !/^\d{1,12}$/.test(String(playerId))) {
    root.innerHTML = playerPageShell('<section class="ph-section"><h1>Player not available</h1><p>Invalid player identifier.</p></section>'); return;
  }
  const state = { bio:null, hero:null, categories:[], category:'', phase:'2', year:'', historyPage:1, gamePage:1,
    log:null, logError:null, loading:true, logLoading:false, error:null, fetchedAt:null, statsGeneration:0, logGeneration:0 };
  const logs = new Map();
  let ledgerPromise = null;
  async function read(kind, extra={}) {
    const qs = new URLSearchParams({ sport, id:String(playerId), kind, ...extra });
    const response = await fetch(`/api/player-data?${qs}`, { signal, headers:{accept:'application/json'}, credentials:'same-origin' });
    const body = await response.json();
    if (!response.ok || body.ok !== true || String(body.player_id) !== String(playerId) || body.sport !== sport) throw new Error('The player data source is temporarily unavailable.');
    return body;
  }
  function refreshLedger() {
    ledgerPromise = sport === 'nfl' ? read('career').then(x=>x.data).catch(()=>null) : Promise.resolve(null);
  }
  function paint() {
    if (!current()) return;
    const mount = root.querySelector('[data-ph-content]');
    if (!mount) return;
    const cat = state.categories.find(c=>c.key===state.category), options = seasonOptions(state.categories);
    const season = options.find(([id])=>id===state.year)?.[1] || state.year;
    const selectedRows = cat?.rows.filter(r=>r.year===state.year) || [], selectedRow=selectedRows.find(r=>r.total) || selectedRows[0];
    const ribbon = cat && selectedRow ? `<section class="ph-section ph-summary"><div class="ph-section-head"><h2>${e(season)} \u00b7 ${e(phaseLabel(state.phase))}</h2><p>${e(cat.title)}${selectedRows.length>1?` \u00b7 ${e(selectedRow.team)} (team stints listed below)`:''}</p></div><div class="ph-ribbon">${ribbonFields(sport,state.hero.position,cat).map(f=>`<div><span>${e(f.label)}</span><strong>${e(selectedRow.values[f.key])}</strong></div>`).join('')}</div></section>` : '';
    const select = (label, key, values, chosen) => `<label>${label}<select data-ph-select="${key}" ${state.loading?'disabled':''}>${values.map(([v,t])=>`<option value="${e(v)}" ${v===chosen?'selected':''}>${e(t)}</option>`).join('')}</select></label>`;
    const controls = `<div class="ph-controls">${select('Season','year',options,state.year)}${select('Competition','phase',[['2','Regular season'],['3','Playoffs']],state.phase)}${state.categories.length>1?select('Statistics','category',state.categories.map(c=>[c.key,c.title]),state.category):''}<button type="button" data-ph-refresh ${state.loading?'disabled':''}>Refresh stats</button></div>`;
    let content = `${controls}<p class="ph-source">Powered by <a href="https://propsports.proptechusa.ai/" target="_blank" rel="noopener noreferrer">PropSports.PropTechUSA.ai</a> \u00b7 Season and competition shown explicitly. ${state.fetchedAt?`Source read ${e(new Date(state.fetchedAt).toLocaleString('en-US'))}.`:''}</p>`;
    if (state.loading) content += '<p class="ph-status" role="status">Loading recorded statistics\u2026</p>';
    if (state.error) content += `<p class="ph-status ph-error" role="status">${e(state.error)} Use Refresh stats to retry. A source failure is not an offseason or a zero-stat season.</p>`;
    if (!state.loading && !state.error && !selectedRow) content += '<p class="ph-status">No season statistics were returned for this selection. Choose another season or competition.</p>';
    content += ribbon;
    if (cat?.skipped) content += `<p class="ph-status">${cat.skipped} source season rows lacked complete column metadata and were not displayed.</p>`;
    if (cat?.career) content += section('Career statistics', table(cat.labels,[cat.names.map(n=>cat.career[n])],`${phaseLabel(state.phase)} \u00b7 ${cat.title}`),'Source-reported career values. Regular season and playoffs are separate.');
    if (cat?.rows.length) {
      const p = paginate(cat.rows,state.historyPage,12); state.historyPage=p.page;
      content += section('Season-by-season history', table(['Season','Team',...cat.labels],p.rows.map(r=>[r.season,r.team,...cat.names.map(n=>r.values[n])]),`${cat.title} \u00b7 ${phaseLabel(state.phase)}`)+pagination(p,'history'),'Team stints and source totals remain separate; values are not added together twice.');
    }
    let logBody;
    if (state.logLoading) logBody='<p class="ph-status" role="status">Loading this season\u2019s game log\u2026</p>';
    else if (state.logError) logBody=`<p class="ph-status ph-error" role="status">${e(state.logError)}</p><button type="button" data-ph-retry-log>Retry game log</button>`;
    else if (state.log?.rows.length) {
      const p=paginate(state.log.rows,state.gamePage,20); state.gamePage=p.page;
      logBody=table(['Date','Opponent','Result',...state.log.labels],p.rows.map(r=>[dateLabel(r.date),r.opponent,r.result,...state.log.names.map(n=>r.values[n])]),`${season} \u00b7 ${phaseLabel(state.phase)}`)+pagination(p,'games');
    } else logBody='<p class="ph-empty">No game-log entries were returned for this season and competition.</p>';
    if (state.log?.skipped) logBody+=`<p class="ph-status">${state.log.skipped} source entries lacked complete game identity or column metadata and were not displayed.</p>`;
    if (state.year) content+=section('Game log',logBody,`${season} \u00b7 ${phaseLabel(state.phase)} \u00b7 Newest first`);
    content+=`<aside class="ph-cta"><div><span>${e(SPORT_NAMES[sport])} INTELLIGENCE</span><h2>Put the numbers in context.</h2><p>Explore PropBetEdge\u2019s ${e(SPORT_NAMES[sport])} analysis and available market tools.</p></div><a href="${sport === 'nfl' ? 'https://nfl.propbetedge.ai/' : '/odds'}">Explore ${e(SPORT_NAMES[sport])} \u2192</a></aside>`;
    const focus = mount.contains(document.activeElement) ? document.activeElement?.dataset?.phSelect : null;
    mount.innerHTML=content;
    if (focus) mount.querySelector(`[data-ph-select="${focus}"]`)?.focus({preventScroll:true});
  }
  async function loadLog(force=false) {
    const generation=++state.logGeneration, year=state.year, phase=state.phase, key=`${year}:${phase}`;
    state.log=null; state.logError=null; state.logLoading=Boolean(year); state.gamePage=1; paint();
    if (!year) return;
    try {
      let parsed = !force ? logs.get(key) : null;
      if (!parsed && sport==='nfl') parsed=ledgerGameLog(await ledgerPromise,playerId,year,phase,state.hero.position);
      if (!parsed) {
        const payload=await read('gamelog',{season:year,type:phase});
        parsed=sport==='nhl'?nhlGameLog(payload.data,year,phase,state.hero.position==='G'):espnGameLog(payload.data,year,phase);
      }
      if (generation!==state.logGeneration || !current()) return;
      logs.set(key,parsed); state.log=parsed;
    } catch (_) {
      if (generation!==state.logGeneration || !current()) return;
      state.logError='Game history could not be retrieved. The season statistics above remain available.';
    } finally { if (generation===state.logGeneration && current()) { state.logLoading=false; paint(); } }
  }
  async function loadStats(phase=state.phase, refresh=false) {
    const generation=++state.statsGeneration; ++state.logGeneration;
    state.loading=true; state.error=null; state.phase=phase; state.categories=[]; state.log=null; state.logLoading=false; state.logError=null; paint();
    try {
      const payload=sport==='nhl'?refresh?await read('bio'):{data:state.bio,fetched_at:state.fetchedAt}:await read('stats',{type:phase});
      if (generation!==state.statsGeneration || !current()) return;
      if (sport==='nhl') state.bio=payload.data;
      state.categories=sport==='nhl'?nhlCategories(payload.data,phase):espnCategories(payload.data,phase);
      state.fetchedAt=payload.fetched_at;
      if (!state.categories.some(c=>c.key===state.category)) state.category=defaultCategory(state.categories,sport,state.hero.position);
      const options=seasonOptions(state.categories);
      if (!options.some(([y])=>y===state.year)) state.year=options[0]?.[0] || '';
      state.historyPage=1;
      if (!state.categories.length) state.error='The source returned no supported statistics categories.';
    } catch (_) {
      if (generation!==state.statsGeneration || !current()) return;
      state.error='Recorded statistics could not be loaded.';
    } finally {
      if (generation===state.statsGeneration && current()) { state.loading=false; paint(); if (!state.error) loadLog(refresh); }
    }
  }
  root.addEventListener('change',event=>{
    if (!current()) return;
    const key=event.target.dataset.phSelect;
    if (key==='phase') { state.year=''; loadStats(event.target.value); }
    else if (key==='year') { state.year=event.target.value; loadLog(); }
    else if (key==='category') { state.category=event.target.value; state.historyPage=1; paint(); }
  },{signal});
  root.addEventListener('click',event=>{
    if (!current()) return;
    const b=event.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-ph-refresh')) { logs.clear(); refreshLedger(); loadStats(state.phase,true); }
    else if (b.hasAttribute('data-ph-retry-log')) loadLog(true);
    else if (b.dataset.phPage) { const key=b.dataset.phPage==='history'?'historyPage':'gamePage'; state[key]+=Number(b.dataset.delta); paint(); }
  },{signal});
  refreshLedger();
  try {
    const payload=await read('bio');
    if (!current()) return;
    const id=sport==='nhl'?payload.data.playerId:payload.data.athlete?.id;
    if (String(id)!==String(playerId)) throw new Error('Player identity mismatch');
    state.bio=payload.data; state.fetchedAt=payload.fetched_at; state.hero=heroFrom(sport,payload.data);
    setMeta?.({title:`${state.hero.name} Stats & Career History | PropBetEdge`, description:`${state.hero.name} ${SPORT_NAMES[sport]} statistics, season-by-season records and game logs. Regular season and playoff history.`,canonical:`https://propbetedge.ai/player/${sport}/${playerId}`,ogImage:state.hero.photo || undefined});
    root.innerHTML=playerPageShell(`<div class="ph-profile" data-player-sport="${sport}">${renderPlayerHero(state.hero)}<div data-ph-content></div></div>`);
    await loadStats();
  } catch (_) {
    if (!current()) return;
    root.innerHTML=playerPageShell(`<section class="ph-section"><h1>Player data temporarily unavailable</h1><p>We could not retrieve this player\u2019s identity. No statistics have been guessed.</p><button type="button" data-ph-reload>Try again</button><p><a href="/leaders/${sport}">Back to ${SPORT_NAMES[sport]} leaders</a></p></section>`);
    root.querySelector('[data-ph-reload]')?.addEventListener('click',()=>renderPlayerHistory(root,sport,playerId,setMeta),{signal});
  }
}
