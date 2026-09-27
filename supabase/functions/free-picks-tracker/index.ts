
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EPOCH = "2026-09-20";
const TABLE = "pbe_free_pick_tracker";
// The NHL gateway serves product routes only to first-party origins; a
// server-side fetch without one gets a 403. That 403 was swallowed, so no NHL
// free pick after 2026-09-20 ever reached the ledger while the board showed them.
const FIRST_PARTY = { Origin:"https://propbetedge.ai", Referer:"https://propbetedge.ai/odds" };
// Output classes that are never a published free pick.
const NON_PICK_SCOPES = new Set(["tracking","validation","shadow","research","rehearsal_shadow","unpublished"]);

// PRODUCT-VERSION BOUNDARY (ET date). Rows before it keep the product that generated them:
//   MLB free pick = an official Algo HR selection; NFL free pick = a team pick (spread/ML/total).
// On and after it:
//   MLB = FEATURED PLAYER - editorial showcase, NOT an Algo pick, own record namespace, never in the free-picks record;
//   NFL = up to two official TD Targets per slate day, own record namespace.
// Historical rows are never rewritten; their product is derived from sport + snapshot when the snapshot predates it.
const PRODUCT_BOUNDARY = "2026-09-28";
// NFL switched on the owner decision day: no NFL free rows exist for 2026-09-27, so nothing historical moves.
const NFL_TD_BOUNDARY = "2026-09-27";
const MLB_FEATURED_URL = "https://mlb.propbetedge.ai/api/free-featured-player";
const NFL_TD_URL = "https://nfl.propbetedge.ai/api/pbe-touchdown-targets?view=free-sample";
const PRODUCTS = {
  boundary:PRODUCT_BOUNDARY,
  nfl_boundary:NFL_TD_BOUNDARY,
  MLB:{
    before:{ selection_type:"algo", selection_source:"official_algo_free_sample", official_algo:true, product_version:"mlb-free-algo/legacy", record_namespace:"free_picks_record" },
    after:{ selection_type:"featured_player", selection_source:"free_editorial_selector", official_algo:false, product_version:"mlb-free-featured-player/1.0.0", record_namespace:"free_featured_player_record", counts_toward_free_picks_record:false, max_per_day:1 },
  },
  NFL:{
    before:{ selection_type:"team_pick", selection_source:"nfl_free_sample_team_picks", official:true, product_version:"nfl-free-team-picks/legacy", record_namespace:"free_picks_record" },
    after:{ selection_type:"td_target", selection_source:"nfl_td_targets_free_sample", product_version:"nfl-free-td-targets/1.1.0", eligible_scopes:["official","tracking"], official_preferred:true, record_namespace:"free_td_target_record", max_per_slate:2, official_td_target_record:"separate (nfl.propbetedge.ai); free rows never enter it" },
  },
};

/** Structural product of a ledger row. New rows carry it in the snapshot; legacy rows derive it (never rewritten). */
function productOf(entry:any) {
  const snap = entry?.snapshot || {};
  const sport = String(entry?.sport || "").toUpperCase();
  if (snap.selection_type) {
    return {
      selection_type:String(snap.selection_type),
      selection_source:snap.selection_source || null,
      product_version:snap.product_version || null,
      record_namespace:snap.record_namespace || "free_picks_record",
      official_algo:snap.official_algo === true,
      official:snap.selection_type === "featured_player" ? false
        : snap.selection_type === "td_target" ? String(snap.publication_scope || "").toLowerCase() === "official"
        : snap.official !== false,
    };
  }
  if (sport === "MLB") return { ...PRODUCTS.MLB.before, official:true };
  if (sport === "NFL") return { ...PRODUCTS.NFL.before, official_algo:false };
  return { selection_type:"model_pick", selection_source:`${sport.toLowerCase()}_free_sample`, product_version:null, record_namespace:"free_picks_record", official_algo:false, official:true };
}

function isFeaturedPlayer(entry:any) {
  return productOf(entry).selection_type === "featured_player";
}

function isTdTarget(entry:any) {
  return productOf(entry).selection_type === "td_target";
}

/**
 * Record class of a ledger entry. Only free_pick rows count toward the FREE PICKS record.
 * free_featured_player rows are graded in their own namespace (free_featured_player_record) and never touch it.
 */
function recordClass(entry:any) {
  if (isNonPickOutput(entry?.snapshot || entry)) return "legacy_validation_signal";
  if (entry?.evidence?.withdrawn === true) return "withdrawn";
  if (isFeaturedPlayer(entry)) return "free_featured_player";
  return "free_pick";
}

function isWithdrawn(entry:any) {
  return entry?.evidence?.withdrawn === true;
}

// Owner decision 2026-09-27 (nfl-free-td-targets/1.1.0): a PRIMARY TD Target issued at tracking scope may be one of
// the two free TD Targets. It stays a tracking target (official:false) - it is a free pick, never an official one.
// Only rows that are explicitly a free TD Target qualify; legacy NFL validation/tracking signals stay excluded.
const FREE_TD_SCOPES = new Set(["official","tracking"]);
function isFreeTdTarget(item:any) {
  return item?.selection_type === "td_target" && item?.free === true
    && FREE_TD_SCOPES.has(String(item?.publication_scope || "").toLowerCase());
}

function isNonPickOutput(item:any) {
  if (isFreeTdTarget(item)) return false;
  const scope = String(item?.publication_scope || "").toLowerCase();
  if (scope && NON_PICK_SCOPES.has(scope)) return true;
  return /VALIDATION|SHADOW|RESEARCH/.test(String(item?.scope_label || "").toUpperCase());
}

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

  if (s === "NFL" && snap.selection_type === "td_target") {
    const gameId = String(snap.game_id || "").trim();
    const playerId = String(snap.player_id || "").trim();
    if (gameId && playerId) return `NFL|TD|${gameId}|${playerId}`;
  }
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

async function json(url:string, headers:Record<string,string> = {}) {
  const r = await fetch(url, { headers:{ Accept:"application/json", ...headers } });
  if (!r.ok) throw new Error(`${url} ${r.status}`);
  const body = await r.json();
  if (body && body.ok === false) throw new Error(`${url} ok:false ${body.error || ""}`.trim());
  return body;
}

function normalizeResult(value:unknown) {
  const v = String(value || "").toUpperCase();
  if (["WIN","W","WON","HIT"].includes(v)) return "WIN";
  if (["LOSS","L","LOST","MISS"].includes(v)) return "LOSS";
  if (v === "PUSH") return "PUSH";
  if (v === "VOID" || v === "NO_DECISION") return "VOID";
  return "PENDING";
}

type CaptureReport = Record<string,{ status:string, offered?:number, inserted?:number, blocked_non_pick?:number, blocked_unfrozen?:number, error?:string }>;

async function captureCurrent():Promise<CaptureReport> {
  const report:CaptureReport = {};
  const today = etDate();
  if (today < EPOCH) return report;
  const weeklyStartRaw = sundayOf(today);
  const weeklyStart = weeklyStartRaw < EPOCH ? EPOCH : weeklyStartRaw;
  const weeklyEnd = addDays(weeklyStartRaw, 6);

  const sources = await Promise.allSettled([
    json(MLB_FEATURED_URL),
    json(NFL_TD_URL),
    json("https://ufc.propbetedge.ai/api/ufc/free-sample"),
    json("https://wnba-api.propbetedge.ai/v1/pbe/free-sample"),
    Promise.allSettled([
      json("https://nhl-api.propbetedge.ai/nhl/picks/free-sample", FIRST_PARTY),
      json(`https://nhl-api.propbetedge.ai/nhl/picks/preseason?date=${today}`, FIRST_PARTY)
    ]),
  ]);

  const existing = await sb(`${TABLE}?period_start=gte.${EPOCH}&select=sport,period_start,slot,public_key,source_record_id,pick_type,selection,opponent,event_start_at,snapshot,evidence,published_at,result,result_at,score`);
  // Two active free picks per sport per period. A withdrawn pick keeps its
  // slot number (its receipt never moves) but frees capacity, so its
  // replacement is recorded separately under the next slot number.
  const used = new Map<string,Set<number>>();
  const active = new Map<string,number>();
  const keys = new Set<string>();
  const identities = new Set<string>();
  for (const r of existing || []) {
    const suppressed = r.evidence?.suppressed === true;
    const k = `${r.sport}|${r.period_start}`;
    if (!used.has(k)) used.set(k,new Set());
    if (!suppressed) {
      used.get(k)!.add(Number(r.slot));
      if (!isWithdrawn(r)) active.set(k, (active.get(k) || 0) + 1);
      identities.add(stableIdentity(r.sport, r));
    }
    keys.add(String(r.public_key));
  }
  const nextSlot = (sport:string, period:string, cap = 2) => {
    const k = `${sport}|${period}`;
    if ((active.get(k) || 0) >= cap) return null;
    const set = used.get(k) || new Set<number>();
    let i = 1;
    while (set.has(i)) i++;
    set.add(i); used.set(k,set); active.set(k,(active.get(k) || 0) + 1);
    return i;
  };

  const capture = async (sport:string, cadence:"daily"|"weekly", periodStart:string, periodEnd:string, items:any[], cap = 2) => {
    const r = report[sport] = { status:"ok", offered:items.length, inserted:0, blocked_non_pick:0, blocked_unfrozen:0 };
    for (const item of items) {
      // Validation / tracking / shadow / research output is never a free pick.
      if (isNonPickOutput(item.snapshot)) { r.blocked_non_pick++; continue; }
      // A pick enters the ledger only once it is frozen under its sport's
      // contract. UFC PROVISIONAL calls can still change before lock.
      if (item.frozen === false) { r.blocked_unfrozen++; continue; }
      const itemPeriodStart = String(item.period_start || periodStart);
      const itemPeriodEnd = String(item.period_end || periodEnd || itemPeriodStart);
      const rowForIdentity = { ...item, sport, cadence, period_start:itemPeriodStart, period_end:itemPeriodEnd };
      const identity = stableIdentity(sport, rowForIdentity);
      if (!item?.key || keys.has(item.key) || identities.has(identity)) continue;
      const slot = nextSlot(sport, itemPeriodStart, cap);
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
      r.inserted++;
    }
  };
  const failed = (sport:string, reason:unknown) => {
    report[sport] = { status:"error", error:String((reason as any)?.message || reason) };
    console.error("tracker capture", sport, String(reason));
  };

  // MLB: the Featured Player (not an Algo pick). One per ET day, captured only before its game starts,
  // only on/after the product boundary, and only when the payload is structurally non-Algo.
  if (sources[0].status === "fulfilled") {
    const d:any = sources[0].value;
    const f:any = d?.featured;
    const gameDate = String(d?.game_date || "");
    const items = (d?.contract === "pbe-mlb-free-featured-player-v1" && d?.official_algo === false && f
      && f.official_algo === false && f.selection_type === "featured_player" && f.featured_id && f.player_id
      && gameDate >= PRODUCT_BOUNDARY && f.pregame === true
      && (!f.game_start || Date.parse(f.game_start) > Date.now()))
      ? [{
        key:String(f.featured_id),
        source_record_id:String(f.featured_id),
        source_url:MLB_FEATURED_URL,
        pick_type:"FEATURED_HR",
        selection:f.player_name,
        opponent:f.opponent || null,
        matchup:[f.team_abbr, f.home_away === "away" ? "@" : "vs", f.opponent_abbr].filter(Boolean).join(" "),
        event_start_at:f.game_start || null,
        period_start:gameDate,
        period_end:gameDate,
        published_at:d.generated_at || new Date().toISOString(),
        snapshot:{
          selection_type:"featured_player", selection_source:"free_editorial_selector", official_algo:false,
          product_version:d.product_version, record_namespace:"free_featured_player_record", rule_id:d.rule?.id || null,
          mlb_player_id:f.player_id, player_image:f.player_image || null, position:f.position || null,
          team:f.team, team_abbr:f.team_abbr, opponent:f.opponent, opponent_abbr:f.opponent_abbr, home_away:f.home_away,
          game_date:gameDate, game_pk:f.game_pk, game_start:f.game_start || null, venue:f.venue || null,
          opposing_pitcher:f.opposing_pitcher || null, lineup_slot:f.lineup_slot ?? null,
          season_stats:f.season_stats || null, dna_version:f.dna_version || null, insights:f.insights || [],
          player_dna_url:f.player_dna_url || null, official_picks_url:d.official_picks_url || null, selection:f.selection || null,
        },
      }]
      : [];
    await capture("MLB","daily",today,today,items,PRODUCTS.MLB.after.max_per_day);
  } else failed("MLB", sources[0].reason);

  // NFL: up to two free TD Targets per slate day (official preferred by the endpoint, tracking fallback). Scope is
  // preserved exactly: a tracking target must arrive as official:false and is stored that way. Any mismatch between
  // `official` and `publication_scope` is refused rather than repaired.
  if (sources[1].status === "fulfilled") {
    const d:any = sources[1].value;
    const slate = String(d?.slate_date || "");
    const items = (d?.contract === "pbe-nfl-free-td-targets-v1" && slate >= NFL_TD_BOUNDARY ? (d?.targets || []) : [])
      .filter((t:any) => {
        const scope = String(t?.publication_scope || "").toLowerCase();
        return t?.selection_type === "td_target" && t?.free === true && FREE_TD_SCOPES.has(scope)
          && t?.official === (scope === "official") && t?.target_id && t?.player_id;
      })
      .filter((t:any) => true
        && (!t.kickoff_ts || Date.parse(t.kickoff_ts) > Date.now()))
      .slice(0, PRODUCTS.NFL.after.max_per_slate)
      .map((t:any) => ({
        key:`NFL-TD:${t.target_id}`,
        source_record_id:String(t.target_id),
        source_url:NFL_TD_URL,
        pick_type:"TD_TARGET",
        selection:t.player_name,
        opponent:t.opponent || null,
        matchup:t.game_label || [t.team, t.home_away === "away" ? "@" : "vs", t.opponent].filter(Boolean).join(" "),
        event_start_at:t.kickoff_ts || null,
        period_start:String(t.slate_date || slate),
        period_end:String(t.slate_date || slate),
        published_at:t.issued_at || d.generated_at || new Date().toISOString(),
        snapshot:{
          ...t, selection_type:"td_target", selection_source:"nfl_td_targets_free_sample",
          official:String(t.publication_scope).toLowerCase() === "official", free:true,
          publication_scope:String(t.publication_scope).toLowerCase(),
          product_version:d.product_version || PRODUCTS.NFL.after.product_version, record_namespace:"free_td_target_record",
        },
      }));
    await capture("NFL","daily",slate || today,slate || today,items,PRODUCTS.NFL.after.max_per_slate);
  } else failed("NFL", sources[1].reason);

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
        frozen:String(p.lifecycle || "").toUpperCase() === "LOCKED",
      };
    });
    await capture("UFC","weekly",weeklyStart,weeklyEnd,items);
  } else failed("UFC", sources[2].reason);

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
  } else failed("WNBA", sources[3].reason);

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
    if (pair[0]?.status === "rejected" && pair[1]?.status === "rejected") failed("NHL", pair[1].reason);
    else await capture("NHL","daily",today,today,unique);
  }
  return report;
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

  const detailedState = String(game?.status?.detailedState || "");
  const abstractState = String(game?.status?.abstractGameState || "");
  const delayed = /postpon|delay|suspend|rain|weather/i.test(detailedState);
  // MLB can report abstractGameState=Final for a postponed game. Detailed
  // postponement/suspension/delay state always wins over the generic flag.
  const final = !delayed && (
    abstractState === "Final"
    || /final|game over|completed/i.test(detailedState)
  );
  const checkedAt = new Date().toISOString();

  const baseEvidence = {
    provider:"MLB Stats API",
    game_pk:game.gamePk,
    player_id:playerId,
    status:detailedState || null,
    settlement_state:final ? "FINAL" : delayed ? "DELAYED" : "PENDING",
    resolution:final ? "official_final" : delayed ? "game_delayed_or_postponed" : "waiting_for_official_final",
    checked_at:checkedAt,
  };

  // Fail closed on settlement: a non-final game can never count as a win or loss.
  // This also reopens any previously settled row if MLB later reports it postponed,
  // suspended, delayed, or otherwise non-final.
  if (!final) {
    await patchEntry(entry.id,{
      result:"PENDING",
      result_at:null,
      score:null,
      evidence:baseEvidence,
    });
    return;
  }

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
    ...baseEvidence,
    home_runs:hrs,
    boxscore_url:`https://statsapi.mlb.com/api/v1/game/${game.gamePk}/boxscore`,
  };

  const mlbResult = hrs > 0 ? "WIN" : "LOSS";
  await patchEntry(entry.id,{
    result:mlbResult,
    // Re-checks must not move the settlement time, or every recheck would
    // float MLB to the top of "latest results".
    result_at:entry.result === mlbResult && entry.result_at ? entry.result_at : checkedAt,
    score,
    evidence,
  });
}

/**
 * MLB Featured Player grading (free_featured_player_record only). Keyed on the frozen game_pk, so doubleheaders and
 * same-name teams cannot cross. HIT = at least one HR in the official final box score; MISS = batted, no HR;
 * VOID = no plate appearance, or the game was cancelled. Non-final / postponed / suspended stays PENDING (fail closed).
 */
async function resolveMlbFeatured(entry:any) {
  const s = entry.snapshot || {};
  const playerId = Number(s.mlb_player_id);
  const gamePk = Number(s.game_pk);
  if (!playerId || !gamePk) return;
  const schedule:any = await json(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&gamePks=${gamePk}`);
  const game = (schedule?.dates || []).flatMap((d:any) => d.games || []).find((g:any) => Number(g?.gamePk) === gamePk);
  if (!game) return;
  const detailedState = String(game?.status?.detailedState || "");
  const abstractState = String(game?.status?.abstractGameState || "");
  const cancelled = /cancel/i.test(detailedState);
  const delayed = !cancelled && /postpon|delay|suspend|rain|weather/i.test(detailedState);
  const final = !cancelled && !delayed && (abstractState === "Final" || /final|game over|completed/i.test(detailedState));
  const checkedAt = new Date().toISOString();
  const baseEvidence = {
    provider:"MLB Stats API", record_namespace:"free_featured_player_record", game_pk:gamePk, player_id:playerId,
    status:detailedState || null, checked_at:checkedAt,
  };
  if (cancelled) {
    await patchEntry(entry.id,{ result:"VOID", result_at:entry.result === "VOID" && entry.result_at ? entry.result_at : checkedAt, score:null, evidence:{ ...baseEvidence, resolution:"game_cancelled" } });
    return;
  }
  if (!final) {
    await patchEntry(entry.id,{ result:"PENDING", result_at:null, score:null, evidence:{ ...baseEvidence, resolution:delayed ? "game_delayed_or_postponed" : "waiting_for_official_final" } });
    return;
  }
  const box:any = await json(`https://statsapi.mlb.com/api/v1/game/${gamePk}/boxscore`);
  const player = box?.teams?.away?.players?.[`ID${playerId}`] || box?.teams?.home?.players?.[`ID${playerId}`] || null;
  const pa = Number(player?.stats?.batting?.plateAppearances || 0);
  const hrs = Number(player?.stats?.batting?.homeRuns || 0);
  const awayName = game?.teams?.away?.team?.abbreviation || game?.teams?.away?.team?.name || "AWAY";
  const homeName = game?.teams?.home?.team?.abbreviation || game?.teams?.home?.team?.name || "HOME";
  const a = game?.teams?.away?.score, h = game?.teams?.home?.score;
  const score = Number.isFinite(Number(a)) && Number.isFinite(Number(h)) ? `${awayName} ${a} · ${homeName} ${h}` : null;
  const result = pa <= 0 ? "VOID" : hrs > 0 ? "WIN" : "LOSS";
  await patchEntry(entry.id,{
    result,
    result_at:entry.result === result && entry.result_at ? entry.result_at : checkedAt,
    score,
    evidence:{ ...baseEvidence, resolution:pa <= 0 ? "did_not_bat" : "official_final", plate_appearances:pa, home_runs:hrs,
      boxscore_url:`https://statsapi.mlb.com/api/v1/game/${gamePk}/boxscore` },
  });
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

/**
 * NFL free TD Target settlement (free_td_target_record). Reads the ONE canonical grade the TD grader wrote
 * (nfl_prop_pick_grades, keyed by the target id) - the tracker never grades a TD target itself, so a player can never
 * be graded twice across the free and paid surfaces, and grading semantics (offensive TD from the official final box
 * score; did-not-play / withdrawn = void; postponed = stays open) stay exactly the grader's.
 * A target replaced before kickoff (status superseded) is never graded: its free receipt is WITHDRAWN (void), and the
 * replacement, if it qualifies, is captured under the next slot.
 */
async function resolveNflTd(entry:any) {
  const snap = entry.snapshot || {};
  const targetId = String(snap.target_id || entry.source_record_id || "").trim();
  if (!targetId) return;
  const rows = await sb(`nfl_prop_picks?id=eq.${encodeURIComponent(targetId)}&select=id,status,publication_scope,kickoff_ts,closed_at,grade:nfl_prop_pick_grades(result,final_value,graded_at,result_definition,non_offensive_td,settlement_note)`);
  const pick = rows?.[0] || null;
  const checkedAt = new Date().toISOString();
  const base = { provider:"nfl_prop_pick_grades", record_namespace:"free_td_target_record", source_pick_id:targetId, checked_at:checkedAt };
  if (!pick) {
    await patchEntry(entry.id, { evidence:{ ...(entry.evidence || {}), ...base, match:"not_found" } });
    return;
  }
  const grade = Array.isArray(pick.grade) ? pick.grade[0] : pick.grade;
  if (!grade && String(pick.status || "").toLowerCase() === "superseded") {
    await patchEntry(entry.id, {
      result:"VOID",
      result_at:checkedAt,
      score:null,
      evidence:{ ...(entry.evidence || {}), ...base, source_status:pick.status, withdrawn:true, withdrawn_reason:"target_replaced_before_kickoff", withdrawn_at:checkedAt, published_selection:entry.selection },
    });
    return;
  }
  if (!grade) {
    await patchEntry(entry.id, { evidence:{ ...(entry.evidence || {}), ...base, source_status:pick.status } });
    return;
  }
  const result = normalizeResult(grade.result);
  const note = grade.settlement_note || {};
  await patchEntry(entry.id, {
    result,
    result_at:grade.graded_at || checkedAt,
    evidence:{
      ...base, source_status:pick.status, result_definition:grade.result_definition || null,
      offensive_tds:grade.final_value ?? null, non_offensive_td:grade.non_offensive_td ?? null,
      participation:note.participation ?? null, void_reason:result === "VOID" ? (note.reason || note.void_reason || pick.status) : null,
    },
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
  if (!result && await withdrawUfcIfReplaced(entry, bout, pickFighter)) return;
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

/**
 * A published UFC free pick is withdrawn, never silently swapped, when before
 * the fight its bout is cancelled or the model's current selection on that
 * bout is no longer the published fighter. The receipt keeps its original
 * identity and publication time; it settles VOID with an explicit reason.
 */
async function withdrawUfcIfReplaced(entry:any, bout:any, pickFighter:any) {
  const withdraw = async (reason:string, extra:Record<string,unknown> = {}) => {
    const at = new Date().toISOString();
    await patchEntry(entry.id, {
      result:"VOID",
      result_at:at,
      score:null,
      evidence:{
        ...(entry.evidence || {}),
        provider:"ufc_model_predictions",
        withdrawn:true,
        withdrawn_reason:reason,
        withdrawn_at:at,
        bout_id:bout.id,
        published_selection:entry.selection,
        ...extra,
      },
    });
    return true;
  };

  if (/cancel|withdraw|scrap|removed/i.test(String(bout.status || ""))) {
    return withdraw("bout_cancelled", { bout_status:bout.status });
  }
  const preds = await sb(
    `ufc_model_predictions?bout_id=eq.${encodeURIComponent(bout.id)}&select=model_version,locked_at,pick_fighter_id,created_at&order=created_at.desc&limit=5`
  ).catch(() => []);
  const current = (preds || []).find((p:any) => p.locked_at) || preds?.[0] || null;
  if (current?.pick_fighter_id && String(current.pick_fighter_id) !== String(pickFighter.id)) {
    return withdraw("model_selection_changed_before_event", {
      replacement_fighter_id:current.pick_fighter_id,
      replacement_model_version:current.model_version,
      replacement_locked_at:current.locked_at,
    });
  }
  return false;
}

async function resolvePending() {
  const rows = await sb(`${TABLE}?result=eq.PENDING&period_start=gte.${EPOCH}&select=*`);
  for (const entry of rows || []) {
    if (entry?.evidence?.suppressed === true) continue;
    try {
      if (entry.sport === "MLB" && isFeaturedPlayer(entry)) await resolveMlbFeatured(entry);
      else if (entry.sport === "MLB") await resolveMlb(entry);
      else if (entry.sport === "WNBA") await resolveWnba(entry);
      else if (entry.sport === "NHL") await resolveNhl(entry);
      else if (entry.sport === "NFL" && isTdTarget(entry)) await resolveNflTd(entry);
      else if (entry.sport === "NFL") await resolveNfl(entry);
      else if (entry.sport === "UFC") await resolveUfc(entry);
      else await patchEntry(entry.id,{ evidence:{ ...(entry.evidence || {}), provider:"nba_free_picks_future_lane", checked_at:new Date().toISOString() } });
    } catch (error) {
      console.error("tracker resolve", entry.sport, entry.id, String(error));
    }
  }

  // Self-heal recent MLB settlements. Provider status can change after an
  // initial observation; postponed/suspended/delayed games must never remain
  // in the public W/L record.
  const recentStart = addDays(etDate(), -7);
  const settledMlb = await sb(
    `${TABLE}?sport=eq.MLB&period_start=gte.${recentStart}&result=in.(WIN,LOSS)&select=*`
  );
  for (const entry of settledMlb || []) {
    if (entry?.evidence?.suppressed === true) continue;
    try {
      if (isFeaturedPlayer(entry)) await resolveMlbFeatured(entry);
      else await resolveMlb(entry);
    } catch (error) {
      console.error("tracker MLB settlement recheck", entry.id, String(error));
    }
  }
}

async function responsePayload(capture:CaptureReport = {}) {
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

  const entries = [...canonical.values()]
    .map((e:any) => {
      const product = productOf(e);
      return {
        ...e,
        record_class:recordClass(e),
        counts_toward_record:recordClass(e) === "free_pick",
        selection_type:product.selection_type,
        selection_source:product.selection_source,
        product_version:product.product_version,
        record_namespace:product.record_namespace,
        official:product.official,
        official_algo:product.official_algo,
      };
    })
    .sort((a:any,b:any) =>
      Date.parse(b.published_at || b.created_at || 0) - Date.parse(a.published_at || a.created_at || 0)
    );
  // Historical validation rows stay in `entries` for audit/history, but the
  // FREE PICKS record, by_sport and pending counts come from real picks only.
  const publicPickEntries = entries.filter((e:any) => !isNonPickOutput(e.snapshot || e) && e.record_class !== "free_featured_player");
  const counted = publicPickEntries.filter((e:any) => ["WIN","LOSS","PUSH"].includes(e.result));
  const record = {
    wins: counted.filter((e:any) => e.result === "WIN").length,
    losses: counted.filter((e:any) => e.result === "LOSS").length,
    pushes: counted.filter((e:any) => e.result === "PUSH").length,
    voids: publicPickEntries.filter((e:any) => e.result === "VOID").length,
    pending: publicPickEntries.filter((e:any) => e.result === "PENDING").length,
  };
  const bySport:Record<string,any> = {};
  for (const sport of ["MLB","NFL","UFC","WNBA","NHL","NBA"]) {
    const sportEntries = publicPickEntries.filter((e:any) => e.sport === sport);
    bySport[sport] = {
      wins:sportEntries.filter((e:any) => e.result === "WIN").length,
      losses:sportEntries.filter((e:any) => e.result === "LOSS").length,
      pushes:sportEntries.filter((e:any) => e.result === "PUSH").length,
      pending:sportEntries.filter((e:any) => e.result === "PENDING").length,
    };
  }
  const tally = (rows:any[]) => {
    const wins = rows.filter((e:any) => e.result === "WIN").length;
    const losses = rows.filter((e:any) => e.result === "LOSS").length;
    return {
      wins, losses,
      pushes:rows.filter((e:any) => e.result === "PUSH").length,
      voids:rows.filter((e:any) => e.result === "VOID").length,
      pending:rows.filter((e:any) => e.result === "PENDING").length,
      hit_rate:wins + losses ? wins / (wins + losses) : null,
    };
  };
  const seasonOf = (e:any) => String(e.period_start || "").slice(0,4);
  const namespaced = (rows:any[]) => {
    const seasons:Record<string,any> = {};
    for (const y of [...new Set(rows.map(seasonOf))].filter(Boolean).sort()) seasons[y] = tally(rows.filter((e:any) => seasonOf(e) === y));
    return { lifetime:tally(rows), by_season:seasons };
  };
  const featuredRows = entries.filter((e:any) => e.record_class === "free_featured_player");
  const tdRows = publicPickEntries.filter((e:any) => e.selection_type === "td_target");
  const records = {
    // The FREE PICKS record (official model free picks). Never contains Featured Player rows.
    free_picks_record:record,
    // MLB Featured Player: engagement grading only. Not Algo, not Game Best, not the .290 record.
    free_featured_player_record:{ sport:"MLB", product_version:PRODUCTS.MLB.after.product_version, official_algo:false, counts_toward_free_picks_record:false, ...namespaced(featuredRows) },
    // NFL free TD Targets. Separate from legacy team picks and from the full paid TD Target record.
    free_td_target_record:{
      sport:"NFL", product_version:PRODUCTS.NFL.after.product_version, ...namespaced(tdRows),
      by_scope:{
        official:tally(tdRows.filter((e:any) => String(e.snapshot?.publication_scope || "").toLowerCase() === "official")),
        tracking:tally(tdRows.filter((e:any) => String(e.snapshot?.publication_scope || "").toLowerCase() === "tracking")),
      },
    },
    legacy:{
      mlb_algo_free_picks:{ sport:"MLB", selection_type:"algo", before:PRODUCT_BOUNDARY, ...namespaced(publicPickEntries.filter((e:any) => e.sport === "MLB" && e.selection_type === "algo")) },
      nfl_team_picks:{ sport:"NFL", selection_type:"team_pick", before:NFL_TD_BOUNDARY, ...namespaced(publicPickEntries.filter((e:any) => e.sport === "NFL" && e.selection_type === "team_pick")) },
    },
  };
  return {
    ok:true,
    contract:"pbe-free-picks-tracker-v4",
    products:PRODUCTS,
    records,
    epoch:EPOCH,
    generated_at:new Date().toISOString(),
    record,
    cadence:{ weekly:["UFC"], daily:["MLB","NFL","WNBA","NHL","NBA"], legacy_weekly:["NFL team picks before the product boundary"] },
    by_sport:bySport,
    integrity:{
      visible_rows:visible.length,
      unique_public_picks:entries.length,
      duplicate_rows_ignored:Math.max(0, visible.length - entries.length),
      public_pick_entries:publicPickEntries.length,
      featured_player_entries:featuredRows.length,
      excluded_non_pick_entries:entries.length - publicPickEntries.length,
      capture,
    },
    entries,
  };
}

Deno.serve(async (req:Request) => {
  if (req.method === "OPTIONS") return new Response(null,{ status:204, headers:CORS });
  if (req.method !== "GET") return new Response(JSON.stringify({ok:false,error:"method_not_allowed"}),{status:405,headers:CORS});
  try {
    const capture = await captureCurrent();
    await resolvePending();
    return new Response(JSON.stringify(await responsePayload(capture)),{ status:200, headers:CORS });
  } catch (error) {
    console.error("free-picks-tracker", error);
    return new Response(JSON.stringify({ok:false,error:"tracker_unavailable"}),{ status:503, headers:CORS });
  }
});
