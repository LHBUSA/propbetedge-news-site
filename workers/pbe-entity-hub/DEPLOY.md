# pbe-entity-hub — deployment surface

Nothing below has been created or deployed. This is the exact surface for
review; deployment happens only after it is verified.

## Worker

| | |
|---|---|
| **Name** | `pbe-entity-hub` |
| **Account** | `fd3a233edadd0a60916413c1199f71ee` (sales@localhomebuyersusa.com) |
| **Entry** | `workers/pbe-entity-hub/src/index.js` |
| **Compatibility date** | `2026-09-01` |
| **workers.dev** | enabled (`pbe-entity-hub.sales-fd3.workers.dev`) |
| **Custom domain** | **none requested.** The hub is infrastructure, not a public product surface. |
| **Observability** | enabled |

## KV namespaces

| Binding | Purpose | Created by |
|---|---|---|
| `ENTITY_KV` | production snapshot store | `wrangler kv namespace create ENTITY_KV` |
| `ENTITY_KV` (preview) | preview/dev store | `wrangler kv namespace create ENTITY_KV --preview` |

Two namespaces, one binding. Both ids must be pasted into `wrangler.toml`,
replacing `REPLACE_WITH_NAMESPACE_ID` / `REPLACE_WITH_PREVIEW_NAMESPACE_ID`.

### Key strategy

```
player:{sport}:{id}            e.g. player:nhl:8471675
team:{sport}:{slug}            e.g. team:nhl:pittsburgh-penguins
cursor:player:{sport}          scheduled-refresh position
report:{sport}:{kind}:{offset} per-slice run report, 14-day TTL
search:v2:ufc                  UFC fighters/events/recent bouts (search docs)
search:v2:wnba                 WNBA players + teams (search docs)
search:v2:stories:manifest     newsroom index manifest + backfill cursor
search:v2:stories:{yyyy-mm}    compact story rows for that month
search:v2:lock:{source}        60–90s rebuild lock
report:search:*                last search refresh outcomes, 14-day TTL
```

Ids and slugs come from `src/entity-graph/dictionary.js`. The hub enriches
entities; it never registers them, so a key that is not in the dictionary
cannot exist.

Every stored value carries: `schema_version`, `kind`, `sport`, `entity_id`,
`source_product`, `source_route`, `source_ids`, `observed_at`, `fetched_at`,
`refreshed_at`, `expires_at`, `stale_at`, `freshness_state`, `completeness`,
`source_hash`, `snapshot`.

## Secrets — one authoritative boundary

| Secret | Why it is here and nowhere else |
|---|---|
| `PROPSPORTS_API_KEY` | NFL ingestion runs **inside this Worker**, so the Worker is the only process that makes the authenticated `/v1/nfl/*` request. It is never set on the Vercel project, never prefixed public, never in client JS, never committed. |
| `HUB_ADMIN_TOKEN` | Gates `POST /v1/admin/refresh` (backfill and manual re-runs). Compared in constant time. |

```
wrangler secret put PROPSPORTS_API_KEY     # paste when prompted; never echoed
wrangler secret put HUB_ADMIN_TOKEN
```

Absent `PROPSPORTS_API_KEY`, NFL team snapshots degrade to `identity_only` and
everything else is unaffected. Absent `HUB_ADMIN_TOKEN`, the admin route
returns 401 and the scheduled refresh still runs.

## Cron schedules

```
0  * * * *   NHL
15 * * * *   MLB
30 * * * *   NBA
45 * * * *   NFL
```

Staggered by sport so one upstream having a bad hour cannot starve the others,
and so no single tick tries to walk 5,782 players. Each tick refreshes that
sport's teams (few, slow-changing) plus a 60-player slice, advancing a cursor.
Full player coverage cycles roughly daily per sport.

## Routes

| Method | Path | Auth |
|---|---|---|
| GET | `/v1/health` | public |
| GET | `/v1/snapshot/player/{sport}/{id}` | public read, CORS to propbetedge.ai + previews |
| GET | `/v1/snapshot/team/{sport}/{slug}` | same |
| GET | `/v1/index/{sport}?kind=&limit=&cursor=` | same — for sitemap |
| GET | `/v1/search?q=&limit=20&sport=&type=` | public, CORS as above; `Cache-Control: public, max-age=60, s-maxage=300` |
| GET | `/v1/admin/search-refresh?source=ufc\|wnba\|stories-head\|stories-backfill&pages=` | `X-Hub-Admin-Token` |
| POST | `/v1/admin/refresh?sport=&kind=&limit=&offset=` | `X-Hub-Admin-Token` |

Read routes are public because they serve exactly what the public page shows.
Writes are token-gated. CORS echoes only `propbetedge.ai`, `www.propbetedge.ai`
and the project's Vercel preview pattern.

## Search service bindings

`/v1/search` indexes two of our own Workers. A same-account
`*.workers.dev` subrequest answers 404 on the edge, so they are bound:

| Binding | Service | Used for |
|---|---|---|
| `NEWS_API_SERVICE` | `propbet-news-api` | `/news?limit=50&page=N` (newsroom corpus) |
| `WNBA_API_SERVICE` | `wnba-api` | `/v1/players` (WNBA players + teams) |

UFC is read from `https://ufc.propbetedge.ai` sitemaps (plain fetch). The
search KV artifacts refresh on every cron tick (stories head + a 10-page
backfill slice; UFC and WNBA every six hours) and lazily when missing.

## Rollback

The hub is **additive**: until Vercel pages are switched to read from it,
deploying it changes nothing a visitor can see.

1. **Roll back the Worker** — `wrangler rollback` (or
   `wrangler versions deploy <previous-version-id>`). Capture the current
   version id before deploying so the target is known.
2. **Stop the crons** — comment out `[triggers]` and redeploy, or disable the
   schedules in the dashboard. Reads keep serving the last snapshots.
3. **Stop reads** — the Vercel side always falls back to the existing live
   behaviour when the hub returns non-200, so pointing pages away from it is a
   config change, not a migration.
4. **Full removal** — `wrangler delete pbe-entity-hub` and delete the KV
   namespaces. No other service depends on them; the entity dictionary and the
   article content graph are untouched by any of this.

Nothing here can alter article content, `published_at`, canonical URLs or the
publication-integrity state. The hub writes only to its own KV namespace.

## Pre-deploy checklist

- [ ] KV namespace ids pasted into `wrangler.toml`
- [ ] `PROPSPORTS_API_KEY` set as a Worker secret (owner-provided)
- [ ] `HUB_ADMIN_TOKEN` set as a Worker secret
- [ ] `wrangler deploy` from `workers/pbe-entity-hub`
- [ ] `GET /v1/health` returns the dictionary counts
- [ ] backfill one sport via `/v1/admin/refresh`, read the report
- [ ] confirm a `STALE` snapshot still serves when an upstream is forced to fail
