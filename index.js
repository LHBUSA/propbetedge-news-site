var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// index.js
var MLB = "https://statsapi.mlb.com/api/v1";
var SUPABASE_URL = "https://rlfyavnhbngwbldebrid.supabase.co";
var PBE_ICON = "https://mlb.propbetedge.ai/favicon.ico";
var ALERT_WINDOW_MIN = 90;
var ALERT_TOLERANCE_MIN = 15;
var C = {
  RED: 15023678,
  GOLD: 16098851,
  GREEN: 6280077,
  BLUE: 8369151,
  PURPLE: 10980346
};
var TEAM_IDS = {
  ARI: 109,
  ATL: 144,
  BAL: 110,
  BOS: 111,
  CHC: 112,
  CWS: 145,
  CIN: 113,
  CLE: 114,
  COL: 115,
  DET: 116,
  HOU: 117,
  KC: 118,
  LAA: 108,
  LAD: 119,
  MIA: 146,
  MIL: 158,
  MIN: 142,
  NYM: 121,
  NYY: 147,
  OAK: 133,
  PHI: 143,
  PIT: 134,
  SD: 135,
  SF: 137,
  SEA: 136,
  STL: 138,
  TB: 139,
  TEX: 140,
  TOR: 141,
  WSH: 120,
  ATH: 133
};
function headshot(id, w = 200) {
  if (!id) return null;
  return `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_${w},q_auto:best/v1/people/${id}/headshot/67/current`;
}
__name(headshot, "headshot");
function capLogo(abbrev) {
  const id = TEAM_IDS[(abbrev || "").toUpperCase()];
  return id ? `https://www.mlbstatic.com/team-logos/team-cap-on-light/${id}.svg` : null;
}
__name(capLogo, "capLogo");
function clean(v, fb = "\u2014") {
  return v === null || v === void 0 || v === "" || v === "?" ? fb : String(v);
}
__name(clean, "clean");
function propLabel(prop) {
  const p = (prop || "").toLowerCase();
  if (p.includes("hr") || p.includes("home_run")) return "\u{1F4A3} Home Run";
  if (p.includes("strikeout") || p.includes("_k") || p === "k_prop") return "\u26A1 Strikeout";
  if (p.includes("total_base")) return "\u26BE Total Bases";
  if (p.includes("hit")) return "\u{1F3CF} Hits";
  if (p.includes("rbi")) return "\u{1F4CA} RBI";
  if (p.includes("run")) return "\u{1F3C3} Runs";
  return "\u{1F3AF} " + (prop || "Prop");
}
__name(propLabel, "propLabel");
function dirEmoji(dir) {
  const d = (dir || "").toUpperCase();
  return d === "OVER" ? "\u2B06\uFE0F" : d === "UNDER" ? "\u2B07\uFE0F" : "\u{1F3AF}";
}
__name(dirEmoji, "dirEmoji");
function ordinal(n) {
  if (!n) return "\u2014";
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
__name(ordinal, "ordinal");
function minutesUntil(dt) {
  return (new Date(dt) - Date.now()) / 6e4;
}
__name(minutesUntil, "minutesUntil");
function etTime(dt) {
  return new Date(dt).toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit"
  });
}
__name(etTime, "etTime");
function etNow() {
  return (/* @__PURE__ */ new Date()).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}
__name(etNow, "etNow");
function removeUndefined(obj) {
  return JSON.parse(JSON.stringify(obj, (k, v) => v === void 0 ? void 0 : v));
}
__name(removeUndefined, "removeUndefined");
function isPitcherProp(propType) {
  const p = (propType || "").toLowerCase();
  return p === "k_prop" || p.includes("pitcher");
}
__name(isPitcherProp, "isPitcherProp");
async function fetchSchedule() {
  const today = (/* @__PURE__ */ new Date()).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const r = await fetch(
    `${MLB}/schedule?sportId=1&date=${today}&hydrate=lineups,probablePitcher,team,linescore`,
    { headers: { Accept: "application/json" } }
  );
  if (!r.ok) return [];
  const d = await r.json();
  return (d.dates || []).flatMap((date) => date.games || []);
}
__name(fetchSchedule, "fetchSchedule");
async function fetchBoxscore(gamePk) {
  const r = await fetch(`${MLB}/game/${gamePk}/boxscore`, { headers: { Accept: "application/json" } });
  return r.ok ? r.json() : null;
}
__name(fetchBoxscore, "fetchBoxscore");
var _idCache = {};
async function resolveMlbId(name) {
  if (!name) return null;
  const key = name.toLowerCase().trim();
  if (_idCache[key] !== void 0) return _idCache[key];
  try {
    const r = await fetch(`${MLB}/people/search?names=${encodeURIComponent(name)}&sportId=1&active=true`);
    if (!r.ok) {
      _idCache[key] = null;
      return null;
    }
    const d = await r.json();
    const id = d?.people?.[0]?.id ?? null;
    _idCache[key] = id;
    return id;
  } catch {
    _idCache[key] = null;
    return null;
  }
}
__name(resolveMlbId, "resolveMlbId");
async function fetchTodayPicks(key) {
  const today = (/* @__PURE__ */ new Date()).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/picks?status=eq.published&game_date=eq.${today}&select=*`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );
  return r.ok ? r.json() : [];
}
__name(fetchTodayPicks, "fetchTodayPicks");
function parseScheduleLineup(game) {
  const out = { home: [], away: [] };
  for (const side of ["home", "away"]) {
    const key = side === "home" ? "homePlayers" : "awayPlayers";
    (game?.lineups?.[key] || []).forEach((p, i) => {
      out[side].push({ id: p.id, name: p.fullName || "", battingOrder: i + 1 });
    });
  }
  return out;
}
__name(parseScheduleLineup, "parseScheduleLineup");
function parseBoxscoreLineup(bs) {
  const out = { home: [], away: [] };
  for (const side of ["home", "away"]) {
    const players = bs?.teams?.[side]?.players || {};
    for (const [, player] of Object.entries(players)) {
      const order = parseInt(player.battingOrder || 0);
      if (order > 0 && order <= 900) {
        out[side].push({
          id: player.person?.id,
          name: player.person?.fullName || "",
          battingOrder: Math.floor(order / 100)
        });
      }
    }
    out[side].sort((a, b) => a.battingOrder - b.battingOrder);
  }
  return out;
}
__name(parseBoxscoreLineup, "parseBoxscoreLineup");
function analyzePick(pick, lineup, game) {
  const pickName = (pick.player_name || "").toLowerCase().trim();

  // PITCHER PROPS: validate against probable pitcher, not batting order.
  // Universal DH means starting pitchers are NOT in lineups.homePlayers/awayPlayers
  // or in boxscore battingOrder — so checking the batting lineup would always
  // return "scratched" for valid starting pitchers.
  if (isPitcherProp(pick.prop_type)) {
    const awaySP = (game?.teams?.away?.probablePitcher?.fullName || "").toLowerCase().trim();
    const homeSP = (game?.teams?.home?.probablePitcher?.fullName || "").toLowerCase().trim();
    const team = (pick.team || "").toUpperCase();
    const awayAbbrev = (game?.teams?.away?.team?.abbreviation || "").toUpperCase();
    const homeAbbrev = (game?.teams?.home?.team?.abbreviation || "").toUpperCase();

    // Match the pick's team to the corresponding probable pitcher.
    let teamSP = null;
    if (team === awayAbbrev) teamSP = awaySP;
    else if (team === homeAbbrev) teamSP = homeSP;

    if (!teamSP) {
      // Probable pitcher not yet posted by MLB. Don't false-flag — defer.
      return { status: "pending", isPitcher: true, battingOrder: null, originalOrder: null };
    }
    if (teamSP === pickName) {
      return { status: "confirmed", isPitcher: true, battingOrder: null, originalOrder: null };
    }
    // Pitcher in pick is NOT the team's confirmed starter — real scratch / SP swap.
    return {
      status: "scratched",
      isPitcher: true,
      battingOrder: null,
      originalOrder: null,
      replacedBy: teamSP || null
    };
  }

  // POSITION PLAYERS: existing batting-order logic.
  const all = [...lineup.home || [], ...lineup.away || []];
  const match = all.find((p) => (p.name || "").toLowerCase().trim() === pickName);
  if (!match) return { status: "scratched", battingOrder: null, originalOrder: pick.batting_order };
  const cur = match.battingOrder, orig = pick.batting_order ?? null;
  const diff = orig && cur ? cur - orig : 0;
  if (Math.abs(diff) >= 2) return { status: "order_changed", battingOrder: cur, originalOrder: orig, orderDiff: diff };
  return { status: "confirmed", battingOrder: cur, originalOrder: orig };
}
__name(analyzePick, "analyzePick");
function buildOrderCard(players, pickResults) {
  if (!players.length) return null;
  // Pitcher picks aren't in batting order — exclude them from the order card lookup.
  const batterPicks = pickResults.filter((r) => !r.isPitcher);
  const pickNames = new Set(batterPicks.map((r) => (r.pick.player_name || "").toLowerCase().trim()));
  const lines = players.slice(0, 9).map((p) => {
    const key = (p.name || "").toLowerCase().trim();
    const result = batterPicks.find((r) => (r.pick.player_name || "").toLowerCase().trim() === key);
    const badge = result ? result.status === "scratched" ? "\u{1F480}" : result.status === "order_changed" ? "\u{1F504}" : "\u2705" : pickNames.has(key) ? "\u2B50" : "  ";
    return `${badge} ${String(p.battingOrder).padStart(2)}. ${(p.name || "").padEnd(22).slice(0, 22)}`;
  });
  return "```\n" + lines.join("\n") + "\n```";
}
__name(buildOrderCard, "buildOrderCard");
function buildHeaderEmbed(game, pickResults, hasPitcherChange) {
  const away = game.teams?.away?.team?.abbreviation || "AWAY";
  const home = game.teams?.home?.team?.abbreviation || "HOME";
  const awayProb = game.teams?.away?.probablePitcher?.fullName;
  const homeProb = game.teams?.home?.probablePitcher?.fullName;
  const kills = pickResults.filter((r) => r.status === "scratched").length;
  const warnings = pickResults.filter((r) => r.status === "order_changed").length;
  const ok = pickResults.filter((r) => r.status === "confirmed").length;
  const pending = pickResults.filter((r) => r.status === "pending").length;
  const color = kills ? C.RED : warnings || hasPitcherChange ? C.GOLD : C.GREEN;
  const statusLine = kills ? `## \u{1F480}  KILL ALERT \u2014 ${kills} pick${kills > 1 ? "s" : ""} must be voided` : warnings ? `## \u26A0\uFE0F  Lineup Warning \u2014 order changes detected` : `## \u2705  All Clear \u2014 your slate is confirmed`;
  const fields = [
    { name: "\u23F1\uFE0F First Pitch", value: `**${etTime(game.gameDate)} ET**
${Math.round(minutesUntil(game.gameDate))} min away`, inline: true },
    { name: "\u{1F3DF}\uFE0F Matchup", value: `**${away}** @ **${home}**`, inline: true },
    {
      name: "\u{1F4CA} Slate",
      value: [
        ok ? `\u2705 **${ok}** confirmed` : null,
        warnings ? `\u{1F504} **${warnings}** order change${warnings > 1 ? "s" : ""}` : null,
        kills ? `\u{1F480} **${kills}** SCRATCHED \u2014 VOID` : null,
        pending ? `\u23F3 **${pending}** pending SP confirm` : null,
        hasPitcherChange ? `\u{1F525} Pitcher change` : null
      ].filter(Boolean).join("  \xB7  ") || "checking...",
      inline: false
    }
  ];
  if (awayProb || homeProb) {
    fields.push({
      name: "\u26BE Starters",
      value: [
        awayProb ? `**${away}:** ${awayProb}` : null,
        homeProb ? `**${home}:** ${homeProb}` : null
      ].filter(Boolean).join("  \xB7  "),
      inline: false
    });
  }
  return {
    color,
    author: { name: "PropBetEdge Lineup Watch", icon_url: PBE_ICON, url: "https://propbetedge.ai" },
    title: `${away} @ ${home}  \xB7  ${etTime(game.gameDate)} ET`,
    url: "https://propbetedge.ai",
    description: statusLine,
    fields,
    footer: { text: `Lineup lock \xB7 ${etNow()} ET \xB7 propbetedge.ai`, icon_url: PBE_ICON },
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
}
__name(buildHeaderEmbed, "buildHeaderEmbed");
function buildKillEmbed(result) {
  const { pick, isPitcher, replacedBy } = result;
  const name = clean(pick.player_name);
  const team = clean(pick.team);
  const dir = clean(pick.direction, "");
  const line = clean(pick.line, "");
  const photo = headshot(pick.mlb_player_id, 640);
  const thumb = headshot(pick.mlb_player_id, 200);
  const cap = capLogo(team);
  const subjectLine = isPitcher
    ? `> **${name}** is **NOT** the confirmed starting pitcher for ${team}.`
    : `> **${name}** is **NOT** in the confirmed starting lineup.`;
  const statusLabel = isPitcher
    ? "\u{1F480}  **NOT THE STARTING PITCHER**"
    : "\u{1F480}  **SCRATCHED \u2014 NOT IN LINEUP**";
  const replacementLine = isPitcher && replacedBy
    ? `> Confirmed starter: **${replacedBy.replace(/\b\w/g, (c) => c.toUpperCase())}**`
    : null;
  return {
    color: C.RED,
    author: { name: `${team}  \xB7  ${name}`, icon_url: cap || PBE_ICON },
    title: `\u{1F480}  VOID THIS PICK  \u2014  ${name}`,
    url: "https://propbetedge.ai",
    description: [
      subjectLine,
      replacementLine,
      `> This pick must be **voided before first pitch**.`,
      ``,
      `**Prop:** ${dirEmoji(dir)} ${dir} ${line} ${propLabel(pick.prop_type)}`,
      `**Odds:** ${clean(pick.odds)}`,
      pick.reason ? `**Edge:** _${pick.reason.slice(0, 160)}_` : null
    ].filter((v) => v !== null).join("\n"),
    fields: [
      { name: "Status", value: statusLabel, inline: false },
      { name: "Action", value: "\u{1F6AB}  Void pick now \u2014 do not play", inline: true },
      { name: "Prop", value: `${dirEmoji(dir)} ${dir} ${line} ${propLabel(pick.prop_type)}`, inline: true }
    ],
    thumbnail: thumb ? { url: thumb } : void 0,
    image: photo ? { url: photo } : void 0,
    footer: { text: "PropBetEdge Lineup Watch \xB7 propbetedge.ai", icon_url: PBE_ICON },
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
}
__name(buildKillEmbed, "buildKillEmbed");
function buildOrderChangeEmbed(result) {
  const { pick, battingOrder, originalOrder, orderDiff } = result;
  const name = clean(pick.player_name);
  const team = clean(pick.team);
  const dir = clean(pick.direction, "");
  const line = clean(pick.line, "");
  const thumb = headshot(pick.mlb_player_id, 200);
  const cap = capLogo(team);
  const moved = orderDiff > 0 ? `Dropped **${Math.abs(orderDiff)} spots** \u2193  (${ordinal(originalOrder)} \u2192 ${ordinal(battingOrder)})` : `Moved up **${Math.abs(orderDiff)} spots** \u2191  (${ordinal(originalOrder)} \u2192 ${ordinal(battingOrder)})`;
  const impact = orderDiff > 0 ? "Fewer PA expected. Consider sizing down." : "More PA expected. Slight edge for counting stats.";
  return {
    color: C.GOLD,
    author: { name: `${team}  \xB7  ${name}`, icon_url: cap || PBE_ICON },
    title: `\u{1F504}  Batting Order Change  \u2014  ${name}`,
    url: "https://propbetedge.ai",
    description: moved,
    fields: [
      { name: "Was", value: `**${ordinal(originalOrder)}**`, inline: true },
      { name: "Now", value: `**${ordinal(battingOrder)}**`, inline: true },
      { name: "Impact", value: impact, inline: false },
      { name: "Prop", value: `${dirEmoji(dir)} ${dir} ${line} ${propLabel(pick.prop_type)}`, inline: true },
      { name: "Odds", value: clean(pick.odds), inline: true }
    ],
    thumbnail: thumb ? { url: thumb } : void 0,
    footer: { text: "PropBetEdge Lineup Watch \xB7 propbetedge.ai", icon_url: PBE_ICON },
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
}
__name(buildOrderChangeEmbed, "buildOrderChangeEmbed");
function buildConfirmedEmbed(results, lineup, game) {
  const away = game.teams?.away?.team?.abbreviation || "AWAY";
  const home = game.teams?.home?.team?.abbreviation || "HOME";
  const awayPicks = results.filter((r) => (r.pick.team || "").toUpperCase() === away);
  const homePicks = results.filter((r) => (r.pick.team || "").toUpperCase() === home);
  const fields = [];
  const awayCard = buildOrderCard(lineup.away || [], awayPicks);
  if (awayCard && awayPicks.some((r) => !r.isPitcher)) fields.push({ name: `${away} Batting Order`, value: awayCard, inline: false });
  const homeCard = buildOrderCard(lineup.home || [], homePicks);
  if (homeCard && homePicks.some((r) => !r.isPitcher)) fields.push({ name: `${home} Batting Order`, value: homeCard, inline: false });
  for (const r of results) {
    const { pick } = r;
    const dir = clean(pick.direction, "");
    const line = clean(pick.line, "");
    const role = r.isPitcher ? "SP" : `${ordinal(r.battingOrder)} in order`;
    const stats = [
      pick.barrel_pct ? `Barrel ${pick.barrel_pct}%` : null,
      pick.hard_hit_pct ? `HH ${pick.hard_hit_pct}%` : null,
      pick.exit_velocity ? `EV ${pick.exit_velocity}` : null,
      pick.k_score ? `K-Score ${pick.k_score}` : null
    ].filter(Boolean).join(" \xB7 ");
    fields.push({
      name: `\u2705  ${pick.player_name}  \xB7  ${pick.team}  \xB7  ${role}`,
      value: [
        `${dirEmoji(dir)} **${dir} ${line} ${propLabel(pick.prop_type)}**  \xB7  Odds: ${clean(pick.odds)}`,
        stats ? `\`${stats}\`` : null,
        pick.reason ? `_${pick.reason.slice(0, 140)}_` : null
      ].filter(Boolean).join("\n"),
      inline: false
    });
  }
  return {
    color: C.GREEN,
    author: { name: "PropBetEdge Lineup Watch", icon_url: PBE_ICON },
    title: `\u2705  ${results.length} Pick${results.length > 1 ? "s" : ""} Confirmed`,
    url: "https://propbetedge.ai",
    description: "All picks are locked in. \u2705 = your pick  \u{1F504} = order changed  \u{1F480} = scratched",
    fields,
    footer: { text: "PropBetEdge \xB7 propbetedge.ai", icon_url: PBE_ICON },
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
}
__name(buildConfirmedEmbed, "buildConfirmedEmbed");
function buildPitcherEmbed(change) {
  return {
    color: C.PURPLE,
    author: { name: "PropBetEdge Lineup Watch", icon_url: PBE_ICON },
    title: "\u{1F525}  Starting Pitcher Change Detected",
    url: "https://propbetedge.ai",
    description: change.detail,
    fields: [
      { name: "Expected", value: change.expected, inline: true },
      { name: "Confirmed", value: change.confirmed, inline: true },
      { name: "Impact", value: "\u26A1 Review all K props \u2014 pitcher change materially affects strikeout projections.", inline: false }
    ],
    footer: { text: "PropBetEdge \xB7 propbetedge.ai", icon_url: PBE_ICON },
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
}
__name(buildPitcherEmbed, "buildPitcherEmbed");
function buildGameMessages(game, pickResults, pitcherChange, lineup) {
  const kills = pickResults.filter((r) => r.status === "scratched");
  const warnings = pickResults.filter((r) => r.status === "order_changed");
  const confirmed = pickResults.filter((r) => r.status === "confirmed");
  const messages = [];
  messages.push(removeUndefined({
    content: kills.length ? "@here \u26A0\uFE0F **Lineup alert \u2014 picks affected. Read below.**" : void 0,
    username: "PropBetEdge Lineup Watch",
    embeds: [buildHeaderEmbed(game, pickResults, !!pitcherChange)]
  }));
  if (kills.length) {
    messages.push(removeUndefined({
      username: "PropBetEdge Lineup Watch",
      embeds: kills.map((r) => buildKillEmbed(r))
    }));
  }
  if (warnings.length) {
    messages.push(removeUndefined({
      username: "PropBetEdge Lineup Watch",
      embeds: warnings.map((r) => buildOrderChangeEmbed(r))
    }));
  }
  if (pitcherChange) {
    messages.push(removeUndefined({
      username: "PropBetEdge Lineup Watch",
      embeds: [buildPitcherEmbed(pitcherChange)]
    }));
  }
  if (confirmed.length) {
    messages.push(removeUndefined({
      username: "PropBetEdge Lineup Watch",
      embeds: [buildConfirmedEmbed(confirmed, lineup, game)]
    }));
  }
  return messages;
}
__name(buildGameMessages, "buildGameMessages");
async function postMessages(webhook, messages) {
  for (const payload of messages) {
    const r = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!r.ok) console.error(`[lineup] Discord ${r.status}: ${await r.text().catch(() => "")}`);
    await new Promise((res) => setTimeout(res, 700));
  }
}
__name(postMessages, "postMessages");
async function run(env, forceGamePk = null) {
  const [games, picks] = await Promise.all([fetchSchedule(), fetchTodayPicks(env.SUPABASE_KEY)]);
  if (!picks.length) return { status: "no picks today" };
  if (!games.length) return { status: "no games today" };
  await Promise.all(picks.filter((p) => !p.mlb_player_id && p.player_name).map(async (p) => {
    p.mlb_player_id = await resolveMlbId(p.player_name);
  }));
  let alerted = 0;
  for (const game of games) {
    const mins = minutesUntil(game.gameDate);
    const gamePk = game.gamePk;
    if (!forceGamePk) {
      if (mins > ALERT_WINDOW_MIN || mins < ALERT_WINDOW_MIN - ALERT_TOLERANCE_MIN) continue;
    } else if (forceGamePk !== gamePk) {
      continue;
    }
    const kvKey = `alerted:${gamePk}`;
    if (env.LINEUP_KV && !forceGamePk) {
      if (await env.LINEUP_KV.get(kvKey)) continue;
    }
    const away = game.teams?.away?.team?.abbreviation || "";
    const home = game.teams?.home?.team?.abbreviation || "";
    const relevantPicks = picks.filter((p) => {
      const t = (p.team || "").toUpperCase();
      return t === away || t === home;
    });
    if (!relevantPicks.length) continue;

    // Split picks: pitcher props validate against probablePitcher, batter
    // props need a posted batting lineup. If only pitcher picks exist for
    // this game, we don't need batting lineup at all.
    const hasBatterPicks = relevantPicks.some((p) => !isPitcherProp(p.prop_type));

    let lineup = parseScheduleLineup(game);
    if (![...lineup.home, ...lineup.away].length) {
      const bs = await fetchBoxscore(gamePk);
      if (bs) lineup = parseBoxscoreLineup(bs);
    }
    if (hasBatterPicks && ![...lineup.home, ...lineup.away].length) {
      if (forceGamePk) return { status: "lineups not posted yet" };
      continue;
    }

    const pickResults = relevantPicks.map((pick) => ({ pick, ...analyzePick(pick, lineup, game) }));

    let pitcherChange = null;
    const awayProb = game.teams?.away?.probablePitcher?.fullName;
    const homeProb = game.teams?.home?.probablePitcher?.fullName;
    // Only check opposing-pitcher mismatch for BATTER K props (not the pitcher's own K_prop).
    for (const kp of relevantPicks.filter((p) => {
      const pt = (p.prop_type || "").toLowerCase();
      return (pt.includes("k") || pt.includes("strikeout")) && !isPitcherProp(p.prop_type);
    })) {
      const expected = (kp.opposing_pitcher || "").toLowerCase();
      if (!expected) continue;
      const lastName = expected.split(" ").pop();
      if (!awayProb?.toLowerCase().includes(lastName) && !homeProb?.toLowerCase().includes(lastName)) {
        pitcherChange = {
          expected: kp.opposing_pitcher,
          confirmed: [awayProb && `${away}: ${awayProb}`, homeProb && `${home}: ${homeProb}`].filter(Boolean).join("  \xB7  "),
          detail: `K prop was modeled against **${kp.opposing_pitcher}** \u2014 confirmed starter appears different.`
        };
        break;
      }
    }
    const messages = buildGameMessages(game, pickResults, pitcherChange, lineup);
    if (env.DISCORD_WEBHOOK) await postMessages(env.DISCORD_WEBHOOK, messages);
    if (env.LINEUP_KV && !forceGamePk) await env.LINEUP_KV.put(kvKey, "1", { expirationTtl: 21600 });
    alerted++;
    return {
      status: "alerted",
      game: `${away} @ ${home}`,
      picks: pickResults.map((r) => ({
        player: r.pick.player_name,
        prop: r.pick.prop_type,
        status: r.status,
        battingOrder: r.battingOrder,
        isPitcher: !!r.isPitcher
      })),
      messages: messages.length
    };
  }
  return { status: alerted ? `alerted ${alerted} games` : "no games in alert window" };
}
__name(run, "run");
var index_default = {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === "/test") {
      const [games, picks] = await Promise.all([fetchSchedule(), fetchTodayPicks(env.SUPABASE_KEY)]);
      if (!picks.length) return json({ error: "No published picks today" });
      await Promise.all(picks.filter((p) => !p.mlb_player_id && p.player_name).map(async (p) => {
        p.mlb_player_id = await resolveMlbId(p.player_name);
      }));
      const sorted = [...games].sort((a, b) => new Date(a.gameDate) - new Date(b.gameDate));
      for (const game of sorted) {
        const away = game.teams?.away?.team?.abbreviation || "";
        const home = game.teams?.home?.team?.abbreviation || "";
        const relevant = picks.filter((p) => {
          const t = (p.team || "").toUpperCase();
          return t === away || t === home;
        });
        if (!relevant.length) continue;
        const result = await run(env, game.gamePk);
        return json({ test: true, ...result });
      }
      return json({ error: "No games found with picks on your slate" });
    }
    if (url.pathname === "/status") {
      const [games, picks] = await Promise.all([fetchSchedule(), fetchTodayPicks(env.SUPABASE_KEY)]);
      const upcoming = games.filter((g) => minutesUntil(g.gameDate) > -30).map((g) => {
        const away = g.teams?.away?.team?.abbreviation || "";
        const home = g.teams?.home?.team?.abbreviation || "";
        const rel = picks.filter((p) => {
          const t = (p.team || "").toUpperCase();
          return t === away || t === home;
        });
        return {
          matchup: `${away} @ ${home}`,
          gameTime: etTime(g.gameDate),
          minsUntil: Math.round(minutesUntil(g.gameDate)),
          lineupsPosted: !!(g.lineups?.homePlayers?.length || g.lineups?.awayPlayers?.length),
          awayStarter: g.teams?.away?.probablePitcher?.fullName || null,
          homeStarter: g.teams?.home?.probablePitcher?.fullName || null,
          slatePicks: rel.map((p) => ({ name: p.player_name, prop: p.prop_type, isPitcher: isPitcherProp(p.prop_type) }))
        };
      }).sort((a, b) => a.minsUntil - b.minsUntil);
      return json({ totalPicks: picks.length, games: upcoming });
    }
    return new Response(
      "PropBetEdge Lineup Watcher\n\nGET /status \u2014 today's games + slate\nGET /test   \u2014 force-fire alert to Discord",
      { headers: { "Content-Type": "text/plain" } }
    );
  },
  async scheduled(event, env) {
    await run(env);
  }
};
function json(data) {
  return new Response(JSON.stringify(data, null, 2), { headers: { "Content-Type": "application/json" } });
}
__name(json, "json");
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
