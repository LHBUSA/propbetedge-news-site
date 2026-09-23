import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {display,fields,paginate,espnCategories,espnGameLog,nhlCategories,nhlGameLog,nhlEntryStatus,nhlCurrentSeasonOption,ledgerGameLog,seasonOptions,defaultCategory,ribbonFields} from '../src/pages/player-history-core.js';
const season={year:2026,displayName:'2026'};
const nfl={filters:[{name:'seasontype',value:'2'}],teams:{'detroit-lions':{abbreviation:'DET'}},categories:[{name:'passing',displayName:'Passing',names:['passingYards','interceptions','QBRating','gamesPlayed'],labels:['YDS','INT','RTG','GP'],statistics:[{season,teamSlug:'detroit-lions',stats:['533','0','113.2','2']}],totals:['40,155','102','97.0','153']}]};
test('real zero is displayed and unknown is not zero',()=>{assert.equal(display(0),'0');assert.equal(display('0'),'0');assert.equal(display(null),'\u2014');assert.equal(display(NaN),'\u2014');});
test('Goff source-shaped fixture restores 533 yards, zero INT and 113.2 rating',()=>{const [c]=espnCategories(nfl);assert.equal(c.rows[0].values.passingYards,'533');assert.equal(c.rows[0].values.interceptions,'0');assert.equal(c.rows[0].values.QBRating,'113.2');assert.equal(c.career.passingYards,'40,155');});
test('column order is supplied by the response, not hardcoded',()=>assert.deepEqual(fields(['interceptions','passingYards'],['0','533']),{interceptions:'0',passingYards:'533'}));
test('season/phase selection rejects opposite-competition totals',()=>assert.throws(()=>espnCategories(nfl,'3')));
test('passing and defensive interceptions never overwrite each other',()=>{const data=structuredClone(nfl);data.categories.push({name:'defensive',names:['interceptions'],statistics:[{season,stats:['2']}]});const cats=espnCategories(data);assert.equal(cats[0].rows[0].values.interceptions,'0');assert.equal(cats[1].rows[0].values.interceptions,'2');assert.equal(defaultCategory(cats,'nfl','QB'),'passing');});
test('source season labels keep NBA 2025-26 without calendar guessing',()=>{const data=structuredClone(nfl);data.categories[0].statistics[0].season={year:2026,displayName:'2025-26'};assert.deepEqual(seasonOptions(espnCategories(data)),[['2026','2025-26']]);});
test('ribbons use named supported fields and keep zero interceptions',()=>{const c=espnCategories(nfl)[0];assert.deepEqual(ribbonFields('nfl','QB',c).map(f=>f.key),['passingYards','interceptions','QBRating','gamesPlayed']);});
const log={names:['passingYards','interceptions'],labels:['YDS','INT'],events:{a:{gameDate:'2026-09-18T00:15:00Z',opponent:{abbreviation:'BUF'},atVs:'@',gameResult:'L',score:'41-31'},b:{gameDate:'2026-09-13T17:00:00Z',opponent:{abbreviation:'NO'},atVs:'vs'}},seasonTypes:[{displayName:'2026 Regular Season',categories:[{splitType:'2',events:[{eventId:'b',stats:['206','0']},{eventId:'a',stats:['327','0']},{eventId:'a',stats:['327','0']}]}]}]};
test('logs join metadata by ID, keep zero and deduplicate',()=>{const p=espnGameLog(log,'2026','2');assert.equal(p.rows.length,2);assert.equal(p.rows[0].id,'a');assert.equal(p.rows[0].opponent,'@ BUF');assert.equal(p.rows[0].values.interceptions,'0');});
test('logs never guess metadata or shifted stat array',()=>{const d=structuredClone(log);d.seasonTypes[0].categories[0].events=[{eventId:'absent',stats:['1','2']},{eventId:'a',stats:['327']}];const p=espnGameLog(d,'2026');assert.equal(p.rows.length,0);assert.equal(p.skipped,2);});
test('NBA month split values are not misinterpreted as competition phase',()=>{const d=structuredClone(log);d.seasonTypes[0].displayName='2025-26 Regular Season';d.seasonTypes[0].categories[0].splitType='7';assert.equal(espnGameLog(d,'2026','2').rows.length,2);});
test('postseason log rows excluded from regular selection',()=>{const d=structuredClone(log);d.seasonTypes[0].displayName='2026 Postseason';assert.equal(espnGameLog(d,'2026','2').rows.length,0);});
test('exhibition games excluded',()=>{const d=structuredClone(log);d.events.a.team={isAllStar:true};assert.equal(espnGameLog(d,'2026').rows.length,1);});
const nhl={position:'C',seasonTotals:[{leagueAbbrev:'OHL',season:20262027,gameTypeId:2,points:999},{leagueAbbrev:'NHL',season:20252026,gameTypeId:2,gamesPlayed:82,goals:48,assists:90,points:138,shots:306,shootingPctg:.156863},{leagueAbbrev:'NHL',season:20252026,gameTypeId:3,points:6}],careerTotals:{regularSeason:{points:1220},playoffs:{points:156}}};
test('NHL latest recorded season excludes junior history and Olympics',()=>{const c=nhlCategories(nhl);assert.deepEqual(seasonOptions(c),[['20252026','2025-26']]);assert.equal(c[0].rows.length,1);assert.equal(c[0].rows[0].values.points,138);assert.equal(c[0].rows[0].values.shootingPctg,'15.7%');});
test('NHL phase-consistent career and annual numbers',()=>{const [c]=nhlCategories(nhl,'3');assert.equal(c.rows[0].values.points,6);assert.equal(c.career.points,156);});
test('NHL absent shots or goalie wins are not fabricated zeros',()=>{const g={position:'G',seasonTotals:[{leagueAbbrev:'NHL',season:20252026,gameTypeId:2,shutouts:0,savePctg:.913}]};const [c]=nhlCategories(g);assert.equal(c.rows[0].values.wins,null);assert.equal(c.rows[0].values.shutouts,0);assert.equal(c.rows[0].values.savePctg,'0.913');});
test('NHL game log checks metadata and preserves zero goals',()=>{const p=nhlGameLog({season:20252026,gameTypeId:2,gameLog:[{gameId:1,gameDate:'2026-04-01',goals:0,shots:0}]},'20252026','2',false);assert.equal(p.rows[0].values.goals,0);assert.equal(p.rows[0].values.assists,null);assert.throws(()=>nhlGameLog({season:20262027},'20252026','2',false));});
test('NFL ledger identity and coverage validated before reuse',()=>{const d={ok:true,player:{espn_id:'3046779'},coverage:{current_season:{season:2026,available:true},seasons_covered:[2026]},game_log:[{event_id:'a',date:'2026-09-18',season:2026,season_type:'REG',stats:{pyd:327,int:0}}]};assert.equal(ledgerGameLog(d,'wrong','2026','2','QB'),null);assert.equal(ledgerGameLog(d,'3046779','2025','2','QB'),null);assert.equal(ledgerGameLog(d,'3046779','2026','2','QB').rows[0].values.int,0);assert.equal(ledgerGameLog(d,'3046779','2026','3','QB').rows.length,0);});
test('pagination retains all 1,205 rows without duplicates or omissions',()=>{const rows=Array.from({length:1205},(_,id)=>({id})),seen=[];for(let page=1;page<=61;page++)seen.push(...paginate(rows,page,20).rows);assert.equal(seen.length,1205);assert.equal(new Set(seen.map(r=>r.id)).size,1205);assert.equal(paginate(rows,999,20).page,61);});
test('three router exports remain compatible',()=>{for(const s of ['nfl','nba','nhl']){const text=fs.readFileSync(new URL(`../src/pages/player-${s}.js`,import.meta.url),'utf8');assert.match(text,new RegExp('render'+s[0].toUpperCase()+s.slice(1)+'PlayerPage'));}});
test('no hardcoded offseason note or direct third-party stats in hub controller',()=>{const text=fs.readFileSync(new URL('../src/pages/player-history.js',import.meta.url),'utf8');assert.doesNotMatch(text,/game logs and weekly stats return/);assert.doesNotMatch(text,/fetch\(`https:\/\/site\./);assert.match(text,/logGeneration/);assert.match(text,/statsGeneration/);});

test('malformed annual stats and career totals are not shifted into fields',()=>{const d=structuredClone(nfl);d.categories[0].statistics.push({season,stats:['1']});d.categories[0].totals=['1'];const [c]=espnCategories(d);assert.equal(c.rows.length,1);assert.equal(c.skipped,1);assert.equal(c.career,null);});
test('game logs validate source-reported year rather than relabel another year',()=>{const d=structuredClone(log);d.filters=[{name:'eventType',value:'2025'}];assert.throws(()=>espnGameLog(d,'2026','2'));});
test('NBA actual fourteen-column layout joins opponent and points correctly',()=>{const d={filters:[{name:'eventType',value:'2026'},{name:'seasontype',value:'2'}],names:['minutes','fieldGoalsMade-fieldGoalsAttempted','fieldGoalPct','threePointFieldGoalsMade-threePointFieldGoalsAttempted','threePointFieldGoalPct','freeThrowsMade-freeThrowsAttempted','freeThrowPct','rebounds','assists','blocks','steals','fouls','turnovers','points'],events:{'401810660':{gameDate:'2026-04-13T00:30:00.000+00:00',atVs:'vs',opponent:{abbreviation:'UTAH'},team:{abbreviation:'LAL'},gameResult:'W',score:'131-107'}},seasonTypes:[{displayName:'2025-26 Regular Season',categories:[{displayName:'April',splitType:'3',type:'event',events:[{eventId:'401810660',stats:['17','6-15','40.0','0-4','0.0','6-9','66.7','4','6','0','3','0','2','18']}]}]}]};const p=espnGameLog(d,'2026','2');assert.equal(p.rows.length,1);assert.equal(p.rows[0].values.points,'18');assert.equal(p.rows[0].values.rebounds,'4');assert.equal(p.rows[0].values.blocks,'0');assert.equal(p.rows[0].opponent,'vs UTAH');});


test('NHL player with no NHL regular-season games is identified as rookie/debut pending, not a data gap',()=>{
  const diotte={
    birthDate:'2003-04-10',
    position:'D',
    seasonTotals:[
      {leagueAbbrev:'AHL',season:20252026,gameTypeId:2,gamesPlayed:5,goals:0,assists:1},
      {leagueAbbrev:'ECHL',season:20252026,gameTypeId:2,gamesPlayed:2,goals:1,assists:1}
    ],
    careerTotals:{regularSeason:null}
  };
  const status=nhlEntryStatus(diotte,new Date('2026-09-23T12:00:00Z'));
  assert.equal(status.noNhlRegularSeasonGames,true);
  assert.equal(status.rookieEligible,true);
  assert.equal(status.ageAtCutoff,23);
  assert.equal(status.title,'NHL debut pending');
});

test('NHL debut state disappears automatically once an NHL regular-season game exists',()=>{
  const player={
    birthDate:'2003-04-10',
    seasonTotals:[{leagueAbbrev:'NHL',season:20262027,gameTypeId:2,gamesPlayed:1,goals:0,assists:0}],
    careerTotals:{regularSeason:{gamesPlayed:1}}
  };
  assert.equal(nhlEntryStatus(player,new Date('2026-10-10T12:00:00Z')),null);
});

test('NHL debut pages can show the current season even before a stat row exists',()=>{
  assert.deepEqual(nhlCurrentSeasonOption(new Date('2026-09-23T12:00:00Z')),['20262027','2026-27']);
});

test('NHL no-stat UI explains debut pending and automatic population instead of a generic data-gap message',()=>{
  const text=fs.readFileSync(new URL('../src/pages/player-history.js',import.meta.url),'utf8');
  assert.match(text,/NHL ROOKIE · DEBUT PENDING/);
  assert.match(text,/no NHL regular-season games recorded yet/);
  assert.match(text,/populate automatically/);
  assert.match(text,/not displaying a zero-stat season/);
});
