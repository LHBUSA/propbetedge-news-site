
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EPOCH = "2026-09-20";
const TABLE = "pbe_free_pick_tracker";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Cache-Control": "no-store, max-age=0",
  "Content-Type": "application/json; charset=utf-8",
};

function etDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(now);
  const get = (t:string) => parts.find(p => p.type === t)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function addDays(dateText:string, days:number) {
  const d = new Date(`${dateText}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0,10);
}

function sundayOf(dateText:string) {
  const d = new Date(`${dateText}T12:00:00Z`);
  return addDays(dateText, -d.getUTCDay());
}

function eventEtDate(value:unknown, fallback = etDate()) {
  if (!value) return fallback;
  const d = new Date(String(value));
  return Number.isFinite(d.getTime()) ? etDate(d) : fallback;
}

function isUuid(value:unknown) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function stableIdentity(sport:string, row:any) {
  const s = String(sport || row?.sport || "").toUpperCase();
  const snap = row?.snapshot || {};
  const pickType = String(row?.pick_type || "PICK").toUpperCase();

  if (s === "MLB") {
    const gameDate = String(snap.game_date || row?.period_start || "");
    const player = String(snap.mlb_player_id || row?.source_record_id || row?.selection || "").trim().toLowerCase();
    return `MLB|${gameDate}|${player}|${pickType}`;
  }
  if (s === "WNBA") {
    const gameId = String(snap.game_id || row?.game_id || "").trim();
    const teamId = String(snap.selected_team_id || snap.pick_team?.team_id || row?.selected_team_id || row?.selection || "").trim().toLowerCase();
    if (gameId && teamId) return `WNBA|${gameId}|${teamId}|${pickType}`;
  }
  if (s === "NHL") {
    const gameId = String(snap.game_id || row?.game_id || "").trim();
    const team = String(snap.pick_team || row?.pick_team || row?.selection || "").trim().toUpperCase();
    if (gameId && team) return `NHL|${gameId}|${team}|${pickType}`;
  }
  if (s === "NFL") {
    const kickoff = String(snap.kickoff_ts || row?.event_start_at || "").trim();
    const market = String(snap.market || row?.pick_type || "").trim().toLowerCase();
    const selection = String(snap.selection || row?.selection || "").trim().toUpperCase();
    return `NFL|${kickoff}|${market}|${selection}`;
  }
  if (s === "UFC") {
    const eventDate = String(snap.event_date || row?.period_start || "").trim();
    const slot = String(snap.slot || row?.pick_type || "").trim().toUpperCase();
    const selection = String(snap.pick_name || row?.selection || "").trim().toLowerCase();
    const opponent = String(snap.opponent_name || row?.opponent || "").trim().toLowerCase();
    return `UFC|${eventDate}|${slot}|${selection}|${opponent}`;
  }
  if (row?.source_record_id) return `${s}|SRC|${String(row.source_record_id)}`;
  return `${s}|${String(row?.event_start_at || row?.period_start || "")}|${pickType}|${String(row?.selection || "").trim().toLowerCase()}|${String(row?.opponent || "").trim().toLowerCase()}`;
}

async function sb(path:string, init:RequestInit = {}) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      "Content-Type":"application/json",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`supabase ${res.status}: ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function patchEntry(id:string, patch:Record<string,unknown>) {
  await sb(`${TABLE}?id=eq.${encodeURIComponent(id)}`, {
    method:"PATCH",
    headers:{ Prefer:"return=minimal" },
    body:JSON.stringify({ ...patch, last_checked_at:new Date().toISOString() }),
  });
}

async function insertEntry(row:Record<string,unknown>) {
  const res = await fetch(`${SB_URL}/rest/v1/${TABLE}`, {
    method:"POST",
    headers:{
      apikey:SERVICE,
      Authorization:`Bearer ${SERVICE}`,
      "Content-Type":"application/json",
      Prefer:"return=minimal,resolution=ignore-duplicates",
    },
    body:JSON.stringify(row),
  });
  if (!res.ok && res.status !== 409) throw new Error(`insert ${res.status}: ${await res.text()}`);
}

async function json(url:string) {
  const r = await fetch(url, { headers:{ Accept:"application/json" } });
  if (!r.ok) throw new Error(`${url} ${r.status}`);
  return r.json();
}

function normalizeResult(value:unknown) {
  const v = String(value || "").toUpperCase();
  if (["WIN","W","WON","HIT"].includes(v)) return "WIN";
  if (["LOSS","L","LOST","MISS"].includes(v)) return "LOSS";
  if (v === "PUSH") return "PUSH";
  if (v === "VOID" || v === "NO_DECISION") return "VOID";
  return "PENDING";
}

async function captureCurrent() {
  const today = etDate();
  if (today < EPOCH) return;
  const weeklyStartRaw = sundayOf(today);
  const weeklyStart = weeklyStartRaw < EPOCH ? EPOCH : weeklyStartRaw;
  const weeklyEnd = addDays(weeklyStartRaw, 6);

  const sources = await Promise.allSettled([
    json("https://mlb.propbetedge.ai/api/free-hr-sample"),
    json("https://nfl.propbetedge.ai/api/pbe-picks?view=free-sample"),
    json("https://ufc.propbetedge.ai/api/ufc/free-sample"),
    json("https://wnba-api.propbetedge.ai/v1/pbe/free-sample"),
    Promise.allSettled([
      json("https://nhl-api.propbetedge.ai/nhl/picks/free-sample"),
      json(`https://nhl-api.propbetedge.ai/nhl/picks/preseason?date=${today}`)
    ]),
  ]);

  const existing = await sb(`${TABLE}?period_start=gte.${EPOCH}&select=sport,period_start,slot,public_key,source_record_id,pick_type,selection,opponent,event_start_at,snapshot,evidence,published_at,result,result_at,score`);
  const used = new Map<string,Set<number>>();
  const keys = new Set<string>();
  const identities = new Set<string>();
  for (const r of existing || []) {
    const suppressed = r.evidence?.suppressed === true;
    const k = `${r.sport}|${r.period_start}`;
    if (!used.has(k)) used.set(k,new Set());
    if (!suppressed) {
      used.get(k)!.add(Number(r.slot));
      identities.add(stableIdentity(r.sport, r));
    }
    keys.add(String(r.public_key));
  }
  const nextSlot = (sport:string, period:string) => {
    const set = used.get(`${sport}|${period}`) || new Set<number>();
    for (let i=1;i<=2;i++) if (!set.has(i)) { set.add(i); used.set(`${sport}|${period}`,set); return i; }
    return null;
  };

  const capture = async (sport:string, cadence:"daily"|"weekly", periodStart:string, periodEnd:string, items:any[]) => {
    for (const item of items) {
      const itemPeriodStart = String(item.period_start || periodStart);
      const itemPeriodEnd = String(item.period_end || periodEnd || itemPeriodStart);
      const rowForIdentity = { ...item, sport, cadence, period_start:itemPeriodStart, period_end:itemPeriodEnd };
      const identity = stableIdentity(sport, rowForIdentity);
      if (!item?.key || keys.has(item.key) || identities.has(identity)) continue;
      const slot = nextSlot(sport, itemPeriodStart);
      if (!slot) continue;

      keys.add(item.key);
      identities.add(identity);
      await insertEntry({
        tracker_epoch:EPOCH,
        sport,
        cadence,
        period_start:itemPeriodStart,
        period_end:itemPeriodEnd,
        slot,
        public_key:item.key,
        source_record_id:item.source_record_id || null,
        source_url:item.source_url || null,
        pick_type:item.pick_type || "PICK",
        selection:item.selection,
        opponent:item.opponent || null,
        matchup:item.matchup || null,
        event_start_at:item.event_start_at || null,
        published_at:item.published_at || new Date().toISOString(),
        snapshot:item.snapshot || {},
        result:item.result || "PENDING",
        result_at:item.result_at || null,
        score:item.score || null,
        evidence:item.evidence || {},
        last_checked_at:new Date().toISOString(),
      });
    }
  };

  if (sources[0].status === "fulfilled") {
    const d:any = sources[0].value;
    const raw = Array.isArray(d?.picks) ? d.picks : [d?.early_bird,d?.featured].filter(Boolean);
    const seen = new Set<string>();
    const items = raw.filter((p:any) => {
      const id = String(p?.id || p?.mlb_player_id || p?.player_name || "");
      if (!id || seen.has(id)) return false; seen.add(id); return true;
    }).slice(0,2).map((p:any) => {
      const gameDate = String(p.game_date || today);
      return {
        key:`MLB:${gameDate}:${p.id || p.mlb_player_id || p.player_name}:HR`,
        source_record_id:p.id || null,
        source_url:"https://mlb.propbetedge.ai/api/free-hr-sample",
        pick_type:"HR",
        selection:p.player_name,
        opponent:p.opponent || null,
        matchup:[p.team,p.opponent ? `vs ${p.opponent}` : null].filter(Boolean).join(" "),
        period_start:gameDate,
        period_end:gameDate,
        published_at:d.generated_at || new Date().toISOString(),
        snapshot:{ mlb_player_id:p.mlb_player_id, team:p.team, opponent:p.opponent, game_date:gameDate, phase:p.phase, score:p.model_score, hr_probability:p.hr_probability },
      };
    });
    await capture("MLB","daily",today,today,items);
  }

  if (sources[1].status === "fulfilled") {
    const d:any = sources[1].value;
    const items = (d?.picks || []).slice(0,2).map((p:any) => ({
      key:`NFL:${d.season}:${d.week}:${p.kickoff_ts}:${p.selection}`,
      source_url:"https://nfl.propbetedge.ai/api/pbe-picks?view=free-sample",
      pick_type:p.market || "GAME",
      selection:p.selection,
      opponent:null,
      matchup:p.matchup?.away_team && p.matchup?.home_team ? `${p.matchup.away_team} @ ${p.matchup.home_team}` : null,
      event_start_at:p.kickoff_ts || null,
      published_at:p.issued_at || d.generated_at,
      snapshot:p,
    }));
    await capture("NFL","weekly",weeklyStart,weeklyEnd,items);
  }

  if (sources[2].status === "fulfilled") {
    const d:any = sources[2].value;
    const raw = Array.isArray(d?.picks) ? d.picks : d?.pick ? [d.pick] : [];
    const items = raw.slice(0,2).map((p:any) => {
      const eventDate = String(p.event_date || today);
      const start = sundayOf(eventDate);
      return {
        key:`UFC:${eventDate}:${p.pick_name}:${p.opponent_name}:${p.slot || "PICK"}`,
        source_url:"https://ufc.propbetedge.ai/api/ufc/free-sample",
        pick_type:p.slot || "FIGHT_WINNER",
        selection:p.pick_name,
        opponent:p.opponent_name || null,
        matchup:p.matchup || null,
        period_start:start,
        period_end:addDays(start,6),
        published_at:p.observed_at || d.generated_at,
        snapshot:p,
      };
    });
    await capture("UFC","weekly",weeklyStart,weeklyEnd,items);
  }

  if (sources[3].status === "fulfilled") {
    const d:any = sources[3].value?.data || sources[3].value;
    const items = (d?.picks || []).slice(0,2).map((p:any) => {
      const selectedTeamId = p.pick_team?.team_id || p.pick_team?.abbr || p.pick_team?.name;
      const gameDate = eventEtDate(p.scheduled_tip_utc, today);
      return {
        key:`WNBA:${p.game_id}:${selectedTeamId}:GAME_WINNER`,
        source_url:"https://wnba-api.propbetedge.ai/v1/pbe/free-sample",
        pick_type:"GAME_WINNER",
        selection:p.pick_team?.name || p.pick_team?.short_name || p.pick_team?.abbr,
        opponent:p.opponent?.name || p.opponent?.short_name || p.opponent?.abbr || null,
        matchup:`${p.away?.abbr || p.away?.name || "AWAY"} @ ${p.home?.abbr || p.home?.name || "HOME"}`,
        event_start_at:p.scheduled_tip_utc || null,
        period_start:gameDate,
        period_end:gameDate,
        published_at:p.locked_at || d.generated_at,
        snapshot:{ ...p, selected_team_id:p.pick_team?.team_id || null },
      };
    });
    await capture("WNBA","daily",today,today,items);
  }

  if (sources[4].status === "fulfilled") {
    const pair:any = sources[4].value;
    const cards:any[] = [];
    if (pair[0]?.status === "fulfilled") {
      for (const p of (pair[0].value?.picks || [])) {
        const gameDate = eventEtDate(p.start_utc, today);
        cards.push({
          key:`NHL:${p.game_id}:${p.pick_team}:GAME_WINNER`,
          source_record_id:p.pick_id || null,
          source_url:"https://nhl-api.propbetedge.ai/nhl/picks/free-sample",
          pick_type:"GAME_WINNER",
          selection:p.pick_team,
          opponent:p.opponent_team || null,
          matchup:p.matchup ? `${p.matchup.away} @ ${p.matchup.home}` : null,
          event_start_at:p.start_utc || null,
          period_start:gameDate,
          period_end:gameDate,
          published_at:p.locked_at || pair[0].value?.fetched_at,
          snapshot:{ ...p, preseason:false },
          result:normalizeResult(p.result),
          result_at:p.graded_at || null,
          score:p.final_score ? `${p.matchup?.away || "AWAY"} ${p.final_score.away} · ${p.matchup?.home || "HOME"} ${p.final_score.home}` : null,
        });
      }
    }
    if (pair[1]?.status === "fulfilled") {
      for (const p of (pair[1].value?.games || [])) {
        if (!p?.is_call || !p?.pick_team) continue;
        const gameDate = eventEtDate(p.puck_drop_utc, today);
        cards.push({
          key:`NHL:${p.game_id}:${p.pick_team}:GAME_WINNER`,
          source_record_id:p.pick_id || null,
          source_url:`https://nhl-api.propbetedge.ai/nhl/picks/preseason?date=${gameDate}`,
          pick_type:"GAME_WINNER",
          selection:p.pick_team,
          opponent:p.pick_team === p.home ? p.away : p.home,
          matchup:`${p.away} @ ${p.home}`,
          event_start_at:p.puck_drop_utc || null,
          period_start:gameDate,
          period_end:gameDate,
          published_at:p.locked_at || pair[1].value?.fetched_at,
          snapshot:{ ...p, preseason:true },
          result:normalizeResult(p.result),
          result_at:p.graded_at || null,
          score:p.home_score == null || p.away_score == null ? null : `${p.away} ${p.away_score} · ${p.home} ${p.home_score}`,
        });
      }
    }
    const unique = [...new Map(cards.map(x => [stableIdentity("NHL",x),x])).values()].slice(0,2);
    await capture("NHL","daily",today,today,unique);
  }
}

async function resolveMlb(entry:any) {
  const s = entry.snapshot || {};
  const playerId = Number(s.mlb_player_id);
  const date = String(s.game_date || entry.period_start || "");
  const team = String(s.team || "").toLowerCase();
  if (!playerId || !date || !team) return;

  const schedule:any = await json(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}`);
  const games = schedule?.dates?.flatMap((d:any) => d.games || []) || [];
  const game = games.find((g:any) => {
    const a = String(g?.teams?.away?.team?.name || "").toLowerCase();
    const h = String(g?.teams?.home?.team?.name || "").toLowerCase();
    return a === team || h === team;
  });
  if (!game?.gamePk) return;

  const box:any = await json(`https://statsapi.mlb.com/api/v1/game/${game.gamePk}/boxscore`);
  const player = box?.teams?.away?.players?.[`ID${playerId}`] || box?.teams?.home?.players?.[`ID${playerId}`] || null;
  const hrs = Number(player?.stats?.batting?.homeRuns || 0);
  const awayScore = game?.teams?.away?.score;
  const homeScore = game?.teams?.home?.score;
  const awayName = game?.teams?.away?.team?.abbreviation || game?.teams?.away?.team?.name || "AWAY";
  const homeName = game?.teams?.home?.team?.abbreviation || game?.teams?.home?.team?.name || "HOME";
  const score = Number.isFinite(Number(awayScore)) && Number.isFinite(Number(homeScore))
    ? `${awayName} ${awayScore} · ${homeName} ${homeScore}`
    : null;
  const evidence = {
    provider:"MLB Stats API",
    game_pk:game.gamePk,
    player_id:playerId,
    home_runs:hrs,
    status:game?.status?.detailedState || null,
    boxscore_url:`https://statsapi.mlb.com/api/v1/game/${game.gamePk}/boxscore`,
    checked_at:new Date().toISOString(),
  };
  if (hrs > 0) {
    await patchEntry(entry.id,{ result:"WIN", result_at:new Date().toISOString(), score, evidence });
    return;
  }
  const final = game?.status?.abstractGameState === "Final" || /final/i.test(String(game?.status?.detailedState || ""));
  if (final) await patchEntry(entry.id,{ result:"LOSS", result_at:new Date().toISOString(), score, evidence });
  else await patchEntry(entry.id,{ evidence });
}

async function resolveWnba(entry:any) {
  const snap = entry.snapshot || {};
  const gameId = String(snap.game_id || "").trim();
  const selectedTeamId = String(snap.selected_team_id || snap.pick_team?.team_id || "").trim();
  if (!gameId || !selectedTeamId) {
    await patchEntry(entry.id,{
      evidence:{ ...(entry.evidence || {}), provider:"wnba_public_result", resolution:"missing_public_identity", checked_at:new Date().toISOString() }
    });
    return;
  }

  const locks = await sb(
    `wnba_pbe_locked_predictions?game_id=eq.${encodeURIComponent(gameId)}&select=prediction_id,selected_team_id,home_team_id,away_team_id,locked_at&order=locked_at.desc&limit=20`
  ).catch(() => []);

  const storedPredictionId = isUuid(entry.source_record_id) ? String(entry.source_record_id) : null;
  const exactLock = (locks || []).find((row:any) =>
    (storedPredictionId && String(row.prediction_id) === storedPredictionId)
    || String(row.selected_team_id || "") === selectedTeamId
  ) || null;
  const exactPredictionId = storedPredictionId || exactLock?.prediction_id || null;
  const carrierPredictionId = exactPredictionId || locks?.[0]?.prediction_id || null;

  let grade:any = null;
  if (carrierPredictionId) {
    const grades = await sb(
      `wnba_pbe_grade_revisions?prediction_id=eq.${encodeURIComponent(carrierPredictionId)}&select=result,home_score,away_score,winner_team_id,graded_at,revision,result_reference&order=revision.desc&limit=1`
    ).catch(() => []);
    grade = grades?.[0] || null;
  }

  if (grade) {
    const gradeResult = normalizeResult(grade.result);
    const winnerTeamId = String(grade.winner_team_id || "");
    const publicResult = gradeResult === "VOID"
      ? "VOID"
      : winnerTeamId
        ? (winnerTeamId === selectedTeamId ? "WIN" : "LOSS")
        : exactPredictionId
          ? gradeResult
          : "PENDING";

    if (publicResult !== "PENDING") {
      const away = snap.away?.abbr || "AWAY";
      const home = snap.home?.abbr || "HOME";
      await patchEntry(entry.id,{
        result:publicResult,
        result_at:grade.graded_at || new Date().toISOString(),
        score:grade.away_score == null || grade.home_score == null ? null : `${away} ${grade.away_score} · ${home} ${grade.home_score}`,
        evidence:{
          provider:"wnba_pbe_grade_revisions",
          public_selected_team_id:selectedTeamId,
          resolved_prediction_id:exactPredictionId,
          result_source_prediction_id:carrierPredictionId,
          matched_public_selection:Boolean(exactPredictionId),
          ...grade,
          result:publicResult,
          checked_at:new Date().toISOString()
        },
      });
      return;
    }
  }

  let gamePayload:any = null;
  try { gamePayload = await json(`https://wnba-api.propbetedge.ai/v1/games/${encodeURIComponent(gameId)}`); } catch {}
  const game = gamePayload?.data?.game || gamePayload?.game || null;
  const finalState = String(game?.status?.state || "").toLowerCase() === "post";
  const homeScore = Number(game?.home?.score);
  const awayScore = Number(game?.away?.score);
  if (finalState && Number.isFinite(homeScore) && Number.isFinite(awayScore) && homeScore !== awayScore) {
    const winnerTeamId = String(homeScore > awayScore ? game?.home?.team_id : game?.away?.team_id);
    if (winnerTeamId) {
      const away = game?.away?.abbr || snap.away?.abbr || "AWAY";
      const home = game?.home?.abbr || snap.home?.abbr || "HOME";
      await patchEntry(entry.id,{
        result:winnerTeamId === selectedTeamId ? "WIN" : "LOSS",
        result_at:new Date().toISOString(),
        score:`${away} ${awayScore} · ${home} ${homeScore}`,
        evidence:{
          provider:"wnba_public_game_result",
          game_id:gameId,
          public_selected_team_id:selectedTeamId,
          winner_team_id:winnerTeamId,
          away_score:awayScore,
          home_score:homeScore,
          source_url:`https://wnba-api.propbetedge.ai/v1/games/${gameId}`,
          matched_public_selection:false,
          checked_at:new Date().toISOString()
        },
      });
      return;
    }
  }

  await patchEntry(entry.id,{
    evidence:{
      ...(entry.evidence || {}),
      provider:"wnba_public_result",
      game_id:gameId,
      public_selected_team_id:selectedTeamId,
      resolved_prediction_id:exactPredictionId,
      result_source_prediction_id:carrierPredictionId,
      resolution:carrierPredictionId ? "waiting_for_final_grade" : "waiting_for_public_final",
      checked_at:new Date().toISOString()
    }
  });
}

async function resolveNhl(entry:any) {
  const snap = entry.snapshot || {};
  const gameId = String(snap.game_id || "").trim();
  const wanted = String(snap.pick_team || entry.selection || "").trim().toUpperCase();
  if (!gameId || !wanted) return;

  const locks = await sb(
    `nhl_pbe_locked_picks?game_id=eq.${encodeURIComponent(gameId)}&select=pick_id,pick_team,record_class,feature_vector,locked_at&order=locked_at.desc&limit=20`
  ).catch(() => []);

  const storedPickId = isUuid(entry.source_record_id) ? String(entry.source_record_id) : null;
  const exact = (locks || []).find((row:any) =>
    (storedPickId && String(row.pick_id) === storedPickId)
    || String(row.pick_team || "").toUpperCase() === wanted
  ) || null;
  const exactPickId = storedPickId || exact?.pick_id || null;
  const carrierPickId = exactPickId || locks?.[0]?.pick_id || null;

  if (!carrierPickId) {
    await patchEntry(entry.id,{
      evidence:{ ...(entry.evidence || {}), provider:"nhl_pbe_pick_grades", resolution:"locked_pick_not_found", public_pick_team:wanted, checked_at:new Date().toISOString() }
    });
    return;
  }

  const grades = await sb(
    `nhl_pbe_pick_grades?pick_id=eq.${encodeURIComponent(carrierPickId)}&select=result,home_score,away_score,winner,graded_at,revision,source_url,note&order=revision.desc&limit=1`
  );
  const g = grades?.[0] || null;
  if (!g) {
    await patchEntry(entry.id,{
      evidence:{ ...(entry.evidence || {}), provider:"nhl_pbe_pick_grades", resolved_pick_id:exactPickId, result_source_pick_id:carrierPickId, public_pick_team:wanted, checked_at:new Date().toISOString() }
    });
    return;
  }

  const gradeResult = normalizeResult(g.result);
  const winner = String(g.winner || "").trim().toUpperCase();
  const publicResult = gradeResult === "VOID"
    ? "VOID"
    : winner
      ? (winner === wanted ? "WIN" : "LOSS")
      : exactPickId
        ? gradeResult
        : "PENDING";

  if (publicResult === "PENDING") {
    await patchEntry(entry.id,{
      evidence:{ ...(entry.evidence || {}), provider:"nhl_pbe_pick_grades", resolved_pick_id:exactPickId, result_source_pick_id:carrierPickId, public_pick_team:wanted, resolution:"final_without_public_side_identity", checked_at:new Date().toISOString() }
    });
    return;
  }

  await patchEntry(entry.id,{
    result:publicResult,
    result_at:g.graded_at,
    score:g.home_score == null || g.away_score == null ? null : `${snap.away || "AWAY"} ${g.away_score} · ${snap.home || "HOME"} ${g.home_score}`,
    evidence:{
      provider:"nhl_pbe_pick_grades",
      resolved_pick_id:exactPickId,
      result_source_pick_id:carrierPickId,
      matched_public_selection:Boolean(exactPickId),
      public_pick_team:wanted,
      ...g,
      result:publicResult,
      checked_at:new Date().toISOString()
    },
  });
}


async function resolveNfl(entry:any) {
  const snap = entry.snapshot || {};
  const issued = snap.issued_at || entry.published_at || null;
  const market = snap.market || null;
  const selectedTeam = snap.selected_team || null;
  const selection = String(snap.selection || entry.selection || "");
  const kickoff = snap.kickoff_ts || entry.event_start_at || null;

  const filters = [
    issued ? `created_at=eq.${encodeURIComponent(issued)}` : null,
    kickoff ? `kickoff_ts=eq.${encodeURIComponent(kickoff)}` : null,
    market ? `market=eq.${encodeURIComponent(market)}` : null,
    selectedTeam ? `selection_team=eq.${encodeURIComponent(selectedTeam)}` : null,
  ].filter(Boolean).join("&");

  if (!filters) return;
  const picks = await sb(`nfl_game_picks?${filters}&select=id,status,game_id,market,market_line,selection_team,selection_over_under,created_at&order=created_at.desc&limit=10`);
  let row = picks?.[0] || null;

  if (!row && kickoff && market) {
    const broader = await sb(
      `nfl_game_picks?kickoff_ts=eq.${encodeURIComponent(kickoff)}&market=eq.${encodeURIComponent(market)}&select=id,status,game_id,market,market_line,selection_team,selection_over_under,created_at&order=created_at.desc&limit=50`
    );
    row = (broader || []).find((p:any) => {
      if (market === "moneyline") return String(p.selection_team || "") === String(selectedTeam || "");
      if (market === "spread") {
        const line = Number(p.market_line);
        const wanted = Number(selection.match(/([+-]?\d+(?:\.\d+)?)\s*$/)?.[1]);
        return String(p.selection_team || "") === String(selectedTeam || "")
          && Number.isFinite(line) && Number.isFinite(wanted)
          && Math.abs(line - wanted) < 0.001;
      }
      if (market === "total") {
        const side = String(p.selection_over_under || "").toUpperCase();
        const wantSide = selection.toUpperCase().startsWith("OVER") ? "OVER" : selection.toUpperCase().startsWith("UNDER") ? "UNDER" : "";
        const wanted = Number(selection.match(/([+-]?\d+(?:\.\d+)?)\s*$/)?.[1]);
        return side === wantSide && Math.abs(Number(p.market_line) - wanted) < 0.001;
      }
      return false;
    }) || null;
  }

  if (!row?.id) {
    await patchEntry(entry.id, {
      evidence:{ ...(entry.evidence || {}), provider:"nfl_pick_grades", match:"not_found", checked_at:new Date().toISOString() }
    });
    return;
  }

  const grades = await sb(`nfl_pick_grades?pick_id=eq.${encodeURIComponent(row.id)}&select=result,graded_at,units_delta,clv_points,clv_prob,clv_beat&order=graded_at.desc&limit=1`);
  const grade = grades?.[0] || null;
  if (!grade) {
    await patchEntry(entry.id, {
      evidence:{
        ...(entry.evidence || {}),
        provider:"nfl_pick_grades",
        source_pick_id:row.id,
        source_status:row.status,
        checked_at:new Date().toISOString()
      }
    });
    return;
  }

  await patchEntry(entry.id, {
    result:normalizeResult(grade.result),
    result_at:grade.graded_at,
    evidence:{
      provider:"nfl_pick_grades",
      source_pick_id:row.id,
      source_status:row.status,
      units_delta:grade.units_delta,
      clv_points:grade.clv_points,
      clv_prob:grade.clv_prob,
      clv_beat:grade.clv_beat,
      checked_at:new Date().toISOString()
    }
  });
}

async function resolveUfc(entry:any) {
  const snap = entry.snapshot || {};
  const pickName = String(snap.pick_name || entry.selection || "").trim();
  const opponentName = String(snap.opponent_name || entry.opponent || "").trim();
  const eventDate = String(snap.event_date || "").trim();
  if (!pickName || !opponentName || !eventDate) return;

  const [pickRows, oppRows, eventRows] = await Promise.all([
    sb(`ufc_fighters?name=eq.${encodeURIComponent(pickName)}&select=id,name&limit=5`),
    sb(`ufc_fighters?name=eq.${encodeURIComponent(opponentName)}&select=id,name&limit=5`),
    sb(`ufc_events?event_date=eq.${encodeURIComponent(eventDate)}&select=id,name,event_date&order=event_date.asc&limit=10`)
  ]);

  const pickFighter = pickRows?.[0] || null;
  const opponent = oppRows?.[0] || null;
  if (!pickFighter?.id || !opponent?.id || !eventRows?.length) {
    await patchEntry(entry.id, {
      evidence:{
        ...(entry.evidence || {}),
        provider:"ufc_bout_results",
        identity_match:"not_found",
        checked_at:new Date().toISOString()
      }
    });
    return;
  }

  let bout:any = null;
  for (const event of eventRows) {
    const bouts = await sb(
      `ufc_bouts?event_id=eq.${encodeURIComponent(event.id)}&select=id,event_id,fighter_a_id,fighter_b_id,status&limit=100`
    );
    bout = (bouts || []).find((b:any) => {
      const a = String(b.fighter_a_id);
      const z = String(b.fighter_b_id);
      return (a === String(pickFighter.id) && z === String(opponent.id))
        || (a === String(opponent.id) && z === String(pickFighter.id));
    }) || null;
    if (bout) break;
  }

  if (!bout?.id) {
    await patchEntry(entry.id, {
      evidence:{
        ...(entry.evidence || {}),
        provider:"ufc_bout_results",
        fighter_id:pickFighter.id,
        opponent_id:opponent.id,
        bout_match:"not_found",
        checked_at:new Date().toISOString()
      }
    });
    return;
  }

  const results = await sb(
    `ufc_bout_results?bout_id=eq.${encodeURIComponent(bout.id)}&select=bout_id,winner_id,method,method_raw,round,time_sec,result_source,source_url,captured_at&limit=1`
  );
  const result = results?.[0] || null;
  if (!result) {
    await patchEntry(entry.id, {
      evidence:{
        ...(entry.evidence || {}),
        provider:"ufc_bout_results",
        bout_id:bout.id,
        fighter_id:pickFighter.id,
        opponent_id:opponent.id,
        bout_status:bout.status || null,
        checked_at:new Date().toISOString()
      }
    });
    return;
  }

  const winnerId = result.winner_id ? String(result.winner_id) : null;
  const normalized = winnerId === String(pickFighter.id)
    ? "WIN"
    : winnerId === String(opponent.id)
      ? "LOSS"
      : "VOID";

  await patchEntry(entry.id, {
    result:normalized,
    result_at:result.captured_at || new Date().toISOString(),
    score:result.method
      ? `${normalized === "WIN" ? pickName : opponentName} · ${result.method}${result.round ? ` · R${result.round}` : ""}`
      : null,
    evidence:{
      provider:"ufc_bout_results",
      bout_id:bout.id,
      fighter_id:pickFighter.id,
      opponent_id:opponent.id,
      winner_id:result.winner_id,
      method:result.method,
      method_raw:result.method_raw,
      round:result.round,
      time_sec:result.time_sec,
      result_source:result.result_source,
      source_url:result.source_url,
      captured_at:result.captured_at,
      checked_at:new Date().toISOString()
    }
  });
}

async function resolvePending() {
  const rows = await sb(`${TABLE}?result=eq.PENDING&period_start=gte.${EPOCH}&select=*`);
  for (const entry of rows || []) {
    if (entry?.evidence?.suppressed === true) continue;
    try {
      if (entry.sport === "MLB") await resolveMlb(entry);
      else if (entry.sport === "WNBA") await resolveWnba(entry);
      else if (entry.sport === "NHL") await resolveNhl(entry);
      else if (entry.sport === "NFL") await resolveNfl(entry);
      else if (entry.sport === "UFC") await resolveUfc(entry);
      else await patchEntry(entry.id,{ evidence:{ ...(entry.evidence || {}), provider:"nba_free_picks_future_lane", checked_at:new Date().toISOString() } });
    } catch (error) {
      console.error("tracker resolve", entry.sport, entry.id, String(error));
    }
  }
}

async function responsePayload() {
  const rows = await sb(`${TABLE}?period_start=gte.${EPOCH}&select=*&order=period_start.desc,sport.asc,slot.asc`);
  const visible = (rows || []).filter((e:any) => e?.evidence?.suppressed !== true);

  const canonical = new Map<string,any>();
  const chronological = [...visible].sort((a:any,b:any) =>
    Date.parse(a.published_at || a.created_at || 0) - Date.parse(b.published_at || b.created_at || 0)
  );
  for (const entry of chronological) {
    const identity = stableIdentity(entry.sport, entry);
    const prior = canonical.get(identity);
    if (!prior) {
      canonical.set(identity, entry);
      continue;
    }
    const priorPending = String(prior.result || "PENDING") === "PENDING";
    const candidateSettled = ["WIN","LOSS","PUSH","VOID"].includes(String(entry.result || "").toUpperCase());
    if (priorPending && candidateSettled) {
      canonical.set(identity, {
        ...prior,
        result:entry.result,
        result_at:entry.result_at,
        score:entry.score,
        evidence:{ ...(prior.evidence || {}), settlement_from_duplicate:entry.id, ...(entry.evidence || {}) },
        last_checked_at:entry.last_checked_at || prior.last_checked_at,
      });
    }
  }

  const entries = [...canonical.values()].sort((a:any,b:any) =>
    Date.parse(b.published_at || b.created_at || 0) - Date.parse(a.published_at || a.created_at || 0)
  );
  const counted = entries.filter((e:any) => ["WIN","LOSS","PUSH"].includes(e.result));
  const record = {
    wins: counted.filter((e:any) => e.result === "WIN").length,
    losses: counted.filter((e:any) => e.result === "LOSS").length,
    pushes: counted.filter((e:any) => e.result === "PUSH").length,
    voids: entries.filter((e:any) => e.result === "VOID").length,
    pending: entries.filter((e:any) => e.result === "PENDING").length,
  };
  const bySport:Record<string,any> = {};
  for (const sport of ["MLB","NFL","UFC","WNBA","NHL","NBA"]) {
    const sportEntries = entries.filter((e:any) => e.sport === sport);
    bySport[sport] = {
      wins:sportEntries.filter((e:any) => e.result === "WIN").length,
      losses:sportEntries.filter((e:any) => e.result === "LOSS").length,
      pushes:sportEntries.filter((e:any) => e.result === "PUSH").length,
      pending:sportEntries.filter((e:any) => e.result === "PENDING").length,
    };
  }
  return {
    ok:true,
    contract:"pbe-free-picks-tracker-v2",
    epoch:EPOCH,
    generated_at:new Date().toISOString(),
    record,
    cadence:{ weekly:["NFL","UFC"], daily:["MLB","WNBA","NHL","NBA"] },
    by_sport:bySport,
    integrity:{
      visible_rows:visible.length,
      unique_public_picks:entries.length,
      duplicate_rows_ignored:Math.max(0, visible.length - entries.length),
    },
    entries,
  };
}

Deno.serve(async (req:Request) => {
  if (req.method === "OPTIONS") return new Response(null,{ status:204, headers:CORS });
  if (req.method !== "GET") return new Response(JSON.stringify({ok:false,error:"method_not_allowed"}),{status:405,headers:CORS});
  try {
    await captureCurrent();
    await resolvePending();
    return new Response(JSON.stringify(await responsePayload()),{ status:200, headers:CORS });
  } catch (error) {
    console.error("free-picks-tracker", error);
    return new Response(JSON.stringify({ok:false,error:"tracker_unavailable"}),{ status:503, headers:CORS });
  }
});
