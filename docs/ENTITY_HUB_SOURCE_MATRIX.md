# PropBetEdge entity hub — source matrix

**Status: AUDIT. Nothing has been built, stored or migrated.**

Measured against production on 2026-09-21 by GET-only probes plus the route
tables in `LHBUSA/propsports-api-worker`, `LHBUSA/nba-propbetedge` and
`LHBUSA/nhl-propbetedge`. Where a probe and a doc disagreed, the probe wins.

---

## 1. What each product actually exposes

Legend: **open** = 200 from `Origin: https://propbetedge.ai` with no key.

| | MLB | NFL | NBA | NHL | WNBA |
|---|---|---|---|---|---|
| **Identity** | StatsAPI person id | ESPN athlete id | ESPN athlete id | NHL api-web id | ESPN WNBA athlete id |
| **Matches dictionary?** | yes | yes | yes | yes | **not in dictionary yet** |
| **Endpoint** | `statsapi.mlb.com` + `propsports-api /mlb/*` | `nfl.propbetedge.ai/api/player-career` | `nba.propbetedge.ai/api/nba-provider?r=` | `nhl-api.propbetedge.ai` | `wnba-api.propbetedge.ai/v1` |
| **Gate** | open | open | **open** | origin-gated, **hub already allowed** | open |
| **Shape** | provider-native | normalized `player-career/v1` r1.1 | **raw ESPN passthrough** | normalized `nhl-intel-v2` | normalized `{ok,data,meta}` |
| **Provenance** | none | `contract`, `history_state` | `x-pbe-fetched-at` header | `source`, `source_urls`, `fetched_at` | `meta`, `generated_at` |
| Player profile | ✅ `people/:id` | ✅ career endpoint | ✅ `r=athlete` | ✅ `/nhl/player/:id` | ✅ `/v1/players/:id` |
| Season stats | ✅ hydrate | ✅ | ✅ `r=gamelog` | ✅ `/player/:id/stats` | ✅ `/v1/stats/players` |
| Career totals | ✅ | ✅ TRACKED/CAREER states | ⚠️ current season | ✅ in landing | ⚠️ current season |
| Game log | ✅ | ⚠️ via career payload | ✅ `r=gamelog` | ✅ `/player/:id/game-log` | ✅ `/v1/players/:id/gamelog` |
| Roster | ✅ | 🔒 paid | ✅ `r=roster` | ✅ `/nhl/team/:ABBR/roster` | ✅ `/v1/teams/:id/roster` |
| Standings | ✅ | 🔒 paid | ✅ `r=standings` | ✅ `/nhl/standings` | ✅ `/v1/standings` |
| Schedule | ✅ | 🔒 paid | ✅ `r=team-schedule` | ✅ `/nhl/team/:ABBR/schedule` | ⚠️ unverified |
| Injuries | ❌ | ❌ | ✅ `r=injuries` | ❌ | ⚠️ unverified |
| Leaders | ✅ | ❌ | ✅ `r=team-ratings` | ✅ `/nhl/leaders` | ✅ `/v1/stats/players` |
| Photos | ✅ id-derived | ✅ id-derived | ✅ id-derived | ✅ id-derived | ✅ ESPN |
| Native metric | Statcast, model odds | model/player intel | team ratings | goalie edge, deployment | **WINBA v1.0.0** |

The identity columns are the important row: **four of five sports already key on
the exact ids `src/entity-graph/dictionary.js` emits.** No new id system is
needed, and no name joins.

---

## 2. Two findings that change the architecture

### 2.1 ESPN 403s Cloudflare egress

From `nba-propbetedge/docs/NBA_SOURCE_MATRIX.md`, measured 2026-09-11:
`site.api.espn.com` answers Cloudflare Worker egress with **HTTP 403** on
scoreboard, summary, standings and teams. That is exactly why the NBA product
runs its relay as a **Vercel** function rather than a Worker.

So "do the operation on Cloudflare" cannot be applied uniformly. NHL (NHL
api-web) and MLB (StatsAPI) are fine from Workers. Anything ESPN-derived —
NFL, NBA, WNBA — has to be fetched from Vercel, or through
`site.web.api.espn.com`, which the same doc records as working from Cloudflare.

### 2.2 NFL team-level data is behind a paid key

`propsports-api /v1/nfl/*` returns:

> `403 {"error":"Demo key is MLB-only. Upgrade for NFL, NBA, and NHL."}`

The NFL **player** side is covered without a key —
`nfl.propbetedge.ai/api/player-career?espn_id=` returns 43 KB of
`player-career/v1` (r1.1) and the main site already calls it from
`api/player-data.js`. It is NFL **roster, standings and schedule** that are
gated, which is precisely what the team hub needs.

This is our own API, so the fix is an internal key, not a purchase — but
issuing one is an owner action.

---

## 3. The rights question, which must be answered before any storage

This is the reason I have not designed the store yet.

`docs` in this network and the standing note in my memory
(`espn-nba-data-rights-exposure`) record that **Disney/ESPN terms prohibit
scraping, database storage and commercial use**, and NBA.com terms prohibit
commercial, gambling and database use. The note records the owner decision as
**open**.

The brief asks for durable normalized **snapshots** of player and team data.
For NHL and MLB that is straightforward — NHL api-web and MLB StatsAPI are the
products' own declared sources. For **NFL, NBA and WNBA the underlying provider
is ESPN**, and "store a normalized snapshot" is the database storage the terms
name.

There are three honest options, and they are an owner call, not mine:

| | What it means | Rights exposure | Page quality |
|---|---|---|---|
| **A. Cache, don't store** | Edge/KV cache with a TTL, no durable row. Snapshot is transient. | Lowest — same posture the league products already run | Good. SSR reads a warm cache, not a database |
| **B. Durable snapshot, all five sports** | Normalized rows in Supabase/D1, refreshed on cadence | Highest — this is the storage the terms name | Best |
| **C. Split** | Durable for NHL + MLB; cache-only for ESPN-derived NFL/NBA/WNBA | Matches each provider's terms | Good, slightly uneven |

My recommendation is **C**, then **A** as the fallback. It gets real player and
team pages without creating a new ESPN-derived database, and it keeps each
sport on the posture its own product already accepts.

---

## 4. Proposed architecture (not built)

```
league products (authoritative, unchanged)
        │  read-only GET, no HTML scraping, no new ingestion
        ▼
src/entity-hub/adapters/{mlb,nfl,nba,nhl,wnba}.js
        │  normalize -> one contract, sport-native stats kept sport-native
        ▼
snapshot layer   (option C: durable NHL+MLB, cached ESPN-derived)
        │  last-known-good, observed_at / refreshed_at / staleness
        ▼
/player/:sport/:id   /team/:sport/:slug     SSR via middleware
        ▲
        └── entity graph: articles ↔ players ↔ teams ↔ games
```

Non-negotiables carried from the brief and already enforced by the entity
graph: identity stays in `dictionary.js`, joins are by id, a page render never
fans out to league backends, and a sport being down serves a stale snapshot
rather than a 503.

---

## 5. WNBA

`wnba-api.propbetedge.ai/v1` is the cleanest contract in the network —
`{ok, data, meta}`, real `athlete_id`/`team_id`, plus WINBA v1.0.0 with a
version and `generated_at`. It is open from the hub origin.

WNBA is **not** in `dictionary.js` today, and `VALID_SPORTS` in `src/router.js`
is `mlb|nfl|nba|nhl`, so `/player/wnba/:id` does not route. Adding it means
extending the dictionary builder with a WNBA source (its real ESPN WNBA athlete
ids, not a new scheme), extending the router and middleware matchers, and
extending `SUPPORTED_SPORTS`. That is clean work, not a bolt-on — but it is its
own change and should not ride along inside the player-page rebuild.

---

## 6. What I need before building

1. **Rights posture** — A, B or C above. This decides the storage layer, so I
   will not design it until it is answered.
2. **NFL internal key** — for `propsports-api /v1/nfl/*` (roster, standings,
   schedule). Without it the NFL **team** page stays thin while the NFL
   **player** page can be built today.
3. **WNBA scope** — in this piece of work, or a follow-up.

MLB, NBA and NHL player pages can be built the moment question 1 is answered.
NHL is the most complete source in the network and is the natural first sport.
