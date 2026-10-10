# Commercial-page lab comparison: cold vs warm cache, EN / JA / KO / ES (2026-10-10)

The data is a local Lighthouse lab measurement. It is not field data (CrUX) and not PageSpeed Insights. Every number comes from a LOCAL production build of each site's `origin/main`, served on 127.0.0.1. Production was never loaded by a headless client.

- `results.json` holds the per page x mode x cache medians, the per-run values, LCP element and phases, and trimmed diagnostics (render-blocking, CLS culprits, long tasks, biggest and failed requests) from the median-LCP run.
- `table.md` is the full median table, including FCP, Speed Index, JS bytes, image bytes and request count.
- `lab-pages.json` lists the sites, lab worktrees, ports and pages.
- `../../../../scripts/perf-lab.mjs` is the harness. It can be re-run (`serve` | `run` | `report`).

## Builds measured

| Site | Repo @ origin/main | Build |
|---|---|---|
| propbetedge.ai | LHBUSA/propbetedge-news-site@93beb14 | `npm ci --ignore-scripts && npm run build` |
| golf | LHBUSA/golf@5c4cee3 | same |
| mlb | LHBUSA/propbetedge-v2@1a1f648 | same |
| f1 | LHBUSA/f1@06ee534 | same, with `F1_DATASET_TOKEN` in the build env only. `publish-projection` self-skips because `VERCEL_ENV` is unset. |
| soccer | LHBUSA/soccer@63e01f5 | same |

Each build ran in its own detached worktree under `E:/wt/<repo>-lab`. The `D:\Workers` trees were not touched.

## Method

**Server (`perf-lab.mjs serve`).** The server emulates the Vercel edge for each repo's `vercel.json`:
- `headers`, `redirects` and `rewrites` use path-to-regexp v6 with `has`/`missing`. MLB's legacy `routes` (with `handle: filesystem`) is also supported.
- `cleanUrls` and `trailingSlash` are honored.
- `middleware.js` runs in-process with Web `Request`/`Response`, `next()` and the self-fetch to the origin. The root and soccer sites server-render their `<head>`/SSR HTML this way, so `/ja/pro` and `/es/all-access` get the same localized bytes as production.
- `api/*.js` functions run in-process, both edge-style and Node-style.
- External rewrites are proxied. Soccer `/api/soccer/*` and golf `/api/v1/*` go to their Cloudflare Workers.
- Text responses are brotli-compressed. Static files get an ETag and `cache-control: public, max-age=0, must-revalidate` (the Vercel default), plus the repo's own header rules. Middleware-built documents get no ETag and are re-sent as 200 on the warm load, as on Vercel.

**Lighthouse.** Lighthouse 12.8.2 ran through its Node API against Chrome 154 (headless=new), one Chrome at a time.
- **Mobile** is the Lighthouse default config: Moto G Power emulation and simulated throttling at 150 ms RTT, 1.6 Mbps down and 4x CPU slowdown.
- **Desktop** is `lighthouse/core/config/desktop-config.js`.
- Only the performance category was run.

**Cold vs warm.** For every page x mode x run, Chrome launches on a fresh, empty `--user-data-dir`.
1. **Cold:** Lighthouse runs with its default storage reset, which clears the HTTP cache and origin storage.
2. **Warm:** Lighthouse then runs again immediately in the same browser with `disableStorageReset: true`. The HTTP cache (disk and memory), the service worker and the storage from the cold navigation are kept.

There were 3 runs per page per mode, so 3 cold and 3 warm. Each metric is its own median. The `spread` field in `results.json` gives the min and max of LCP, TBT and CLS. Warm transfer bytes are mostly 304 revalidations of `max-age=0` files plus uncached third-party calls.

**Metrics.**
- LCP, CLS, TBT (the lab proxy for INP), FCP and Speed Index come from Lighthouse's simulated (Lantern) values.
- Byte counts are the transfer bytes in `network-requests`, grouped by resourceType.
- Request count is the number of network requests.
- The LCP element comes from `largest-contentful-paint-element`, and LCP phases from its simulated phase table.
- Thresholds marked ✗ are LCP > 2.5 s, CLS > 0.1 and TBT > 200 ms.

**Host.** Ryzen 9 5900, 16 GB RAM, Node 24.11.1. The Lighthouse `benchmarkIndex` ranged from 1692 to 3036 across runs, because the machine was shared with other work. TBT is computed from observed main-thread tasks x 4, so TBT carries the most run-to-run noise. Medians of 3 can still move ±100 ms on TBT and ±20–40% on mobile cold LCP. See `spread`; for example, root-en-pro mobile cold LCP ranged 6.96–11.56 s.

## Lab deviations from production (read before comparing to PSI/CrUX)

1. **Vercel-hosted production origins were never contacted.** That means `*.propbetedge.ai` on Vercel DNS, `propsports.proptechusa.ai` and similar hosts, detected by DNS: CNAME `*.vercel-dns-*.com` or A `216.150.0.0/16` / `76.76.21.0/24`. Chrome blocked them (`blockedUrlPatterns`), and the server answered 503 to proxies and middleware fetches aimed at them. The per-site list is in `results.json.blocked_hosts`. Affected page requests:
   - root `/pro` (EN/ES): `mlb.propbetedge.ai/api/free-featured-player`, `nfl.propbetedge.ai/api/pbe-touchdown-targets?view=free-sample` and `ufc.propbetedge.ai/api/ufc/free-sample`.
   - F1: `propsports.proptechusa.ai/v1/f1/media/headshot/*` (driver headshots on `/`), `/v1/f1/live`, `/v1/f1/replay`, and `/pbe/f1/membership`, which is rewritten to propsports.
   - The production pages would load those bytes, so EN `/pro` and F1 `/` are slightly **under**-weighted here.
2. **Cross-origin calls that check the Origin header failed from `http://127.0.0.1`:**
   - `auth.propbetedge.ai/session` and `/membership` (CORS)
   - `propbet-news-api.sales-fd3.workers.dev/news/by-sport/mlb` (403; this is the MLB news ticker)
   - `nhl-api.propbetedge.ai/nhl/picks/free-sample` and `propbetedge-pitcher-pi.sales-fd3.workers.dev/api/pitchers/today` (CORS)
   
   Signed-out production behaves like a failed session call, but the MLB news ticker is empty in the lab.
3. **Third-party resources were fetched live** from the same workstation network: Google Fonts, Unsplash, ESPN CDN, mlbstatic, Google SwG/News, GTM and the Cloudflare Workers. Lantern simulates their timing at the throttled RTT and bandwidth, so origin latency barely matters, but their byte sizes and request ordering do. Runs were taken back to back between 16:09Z and 17:28Z on 2026-10-10.
4. **The server is HTTP/1.1 on loopback.** Lantern models the connection, so the absolute TTFB is the simulated RTT, not Vercel's. On mobile that is about 450–530 ms. Soccer's is higher, 600–670 ms, because its middleware awaits the soccer-api Worker before answering.
5. **`/pro?lang=es&via=soccer` is the English `/pro` page.** Its middleware/SSR output and LCP alt text are English. `lang=es&via=soccer` only adds checkout attribution (`src/global/attribution.js`, `src/pro-content.js` `checkoutHref`). There is no Spanish root `/pro` page to compare.

## Results (median of 3): LCP s / CLS / TBT ms / transfer KB
| Page | Mobile cold | Mobile warm | Desktop cold | Desktop warm |
|---|---|---|---|---|
| root-en-pro | 10.81✗ / 0.04 / 255✗ / 2683 | 2.69✗ / 0.04 / 233✗ / 37 | 2.25 / 0.03 / 25 / 3332 | 0.59 / 0.03 / 32 / 62 |
| root-ja-pro | 5.72✗ / 0.00 / 12 / 1635 | 2.54✗ / 0.00 / 52 / 29 | 1.59 / 0.00 / 0 / 1575 | 0.55 / 0.00 / 0 / 30 |
| root-ko-pro | 4.75✗ / 0.00 / 5 / 1636 | 1.00 / 0.00 / 9 / 30 | 1.52 / 0.00 / 0 / 1575 | 0.50 / 0.00 / 0 / 19 |
| root-es-pro-soccer | 10.58✗ / 0.04 / 222✗ / 2683 | 2.53✗ / 0.04 / 10 / 38 | 2.43 / 0.03 / 24 / 3332 | 0.59 / 0.03 / 24 / 38 |
| golf-en-all-access | 2.33 / 0.00 / 0 / 172 | 1.11 / 0.00 / 0 / 8 | 0.58 / 0.02 / 0 / 172 | 0.33 / 0.02 / 0 / 8 |
| golf-es-all-access | 2.35 / 0.00 / 2 / 172 | 1.24 / 0.00 / 5 / 8 | 0.59 / 0.02 / 0 / 172 | 0.32 / 0.02 / 0 / 8 |
| golf-ja-all-access | 2.34 / 0.00 / 4 / 170 | 1.31 / 0.00 / 4 / 8 | 0.58 / 0.06 / 0 / 170 | 0.37 / 0.06 / 0 / 8 |
| golf-ko-all-access | 2.36 / 0.00 / 0 / 170 | 1.14 / 0.00 / 0 / 8 | 0.58 / 0.01 / 0 / 170 | 0.36 / 0.01 / 0 / 8 |
| golf-en-home | 2.72✗ / 0.43✗ / 15 / 524 | 1.27 / 0.22✗ / 66 / 18 | 0.79 / 0.24✗ / 0 / 603 | 0.34 / 0.12✗ / 0 / 18 |
| golf-es-home | 2.27 / 0.22✗ / 19 / 525 | 1.26 / 0.22✗ / 134 / 18 | 0.79 / 0.24✗ / 0 / 603 | 0.34 / 0.12✗ / 0 / 18 |
| golf-ja-home | 2.59✗ / 0.43✗ / 37 / 519 | 1.76 / 0.00 / 93 / 18 | 0.98 / 0.23✗ / 0 / 597 | 0.46 / 0.12✗ / 0 / 18 |
| golf-ko-home | 2.22 / 0.44✗ / 29 / 512 | 1.30 / 0.22✗ / 100 / 18 | 0.92 / 0.24✗ / 0 / 597 | 0.34 / 0.12✗ / 0 / 18 |
| mlb-en-sharp-tools | 7.47✗ / 0.58✗ / 39 / 1005 | 1.83 / 0.53✗ / 124 / 24 | 1.90 / 0.49✗ / 0 / 1005 | 0.54 / 0.52✗ / 0 / 74 |
| mlb-ja-sharp-tools | 7.33✗ / 0.51✗ / 294✗ / 1022 | 0.96 / 0.00 / 634✗ / 31 | 1.84 / 0.47✗ / 42 / 1022 | 0.49 / 0.47✗ / 74 / 31 |
| mlb-ko-sharp-tools | 2.16 / 0.51✗ / 222✗ / 1021 | 0.97 / 0.43✗ / 240✗ / 23 | 1.74 / 0.51✗ / 54 / 1019 | 0.47 / 0.47✗ / 11 / 25 |
| mlb-en-games | 8.68✗ / 0.42✗ / 156 / 1021 | 1.97 / 0.42✗ / 197 / 9 | 2.20 / 0.40✗ / 0 / 1021 | 0.66 / 0.40✗ / 0 / 9 |
| mlb-ja-games | 8.26✗ / 0.36✗ / 276✗ / 1014 | 2.01 / 0.36✗ / 443✗ / 9 | 1.98 / 0.40✗ / 13 / 1012 | 0.92 / 0.40✗ / 26 / 9 |
| mlb-ko-games | 8.53✗ / 0.37✗ / 337✗ / 1013 | 2.09 / 0.37✗ / 437✗ / 9 | 2.15 / 0.40✗ / 0 / 1013 | 0.72 / 0.40✗ / 0 / 9 |
| mlb-ja-home | 2.88✗ / 0.25✗ / 0 / 498 | 0.91 / 0.25✗ / 8 / 4 | 0.67 / 0.12✗ / 0 / 538 | 0.25 / 0.12✗ / 0 / 4 |
| mlb-ko-home | 2.99✗ / 0.03 / 0 / 468 | 0.91 / 0.03 / 0 / 4 | 0.66 / 0.09 / 0 / 468 | 0.25 / 0.09 / 0 / 4 |
| f1-en-home | 3.89✗ / 0.00 / 0 / 593 | 1.39 / 0.00 / 144 / 27 | 1.03 / 0.00 / 0 / 596 | 0.40 / 0.00 / 6 / 27 |
| f1-ja-home | 2.39 / 0.00 / 0 / 190 | 1.18 / 0.00 / 0 / 12 | 0.60 / 0.00 / 0 / 190 | 0.27 / 0.00 / 0 / 12 |
| f1-en-all-access | 2.79✗ / 0.15✗ / 0 / 198 | 1.39 / 0.15✗ / 0 / 4 | 0.73 / 0.00 / 0 / 223 | 0.40 / 0.00 / 0 / 4 |
| f1-en-pbecast-sgp | 2.80✗ / 0.00 / 5 / 543 | 1.39 / 0.00 / 3 / 4 | 0.73 / 0.06 / 0 / 551 | 0.40 / 0.09 / 0 / 4 |
| soccer-en-all-access | 4.34✗ / 0.00 / 7 / 1149 | 1.25 / 0.00 / 0 / 17 | 1.43 / 0.00 / 0 / 1209 | 0.34 / 0.00 / 0 / 17 |
| soccer-es-all-access | 4.28✗ / 0.00 / 41 / 1016 | 1.44 / 0.00 / 41 / 17 | 1.38 / 0.00 / 0 / 1209 | 0.34 / 0.00 / 0 / 17 |
| soccer-en-home | 3.96✗ / 0.00 / 12 / 2501 | 1.28 / 0.00 / 65 / 24 | 1.42 / 0.00 / 0 / 3261 | 0.34 / 0.00 / 0 / 19 |
| soccer-es-home | 4.35✗ / 0.00 / 34 / 1731 | 1.28 / 0.00 / 23 / 17 | 1.54 / 0.00 / 0 / 3261 | 0.55 / 0.00 / 0 / 19 |

✗ means the median fails Good (LCP > 2.5 s, CLS > 0.1, TBT > 200 ms). Desktop cold and warm pass LCP and TBT everywhere. Every desktop failure is CLS.

## Pages failing Good, with top causes (from the median-LCP run's diagnostics)

**root `/pro`, and `/pro?lang=es&via=soccer` (same page)**
- Mobile cold: LCP 10.8 / 10.6 s, TBT 255 / 222 ms. Mobile warm: LCP 2.7 / 2.5 s.
- The LCP element is the hero `section.pbe-pro-hero > … > picture.pbe-pro-pic > img` (`/pro/hero-m-960.avif`, 79 KB, fetchpriority=high, discoverable). The phases are TTFB 0.5 s, load 2.4 s and **render delay 7.5 s**.
1. Bandwidth competition on the slow-4G link. Total transfer is 2.68 MB, of which 1.93 MB is images and 1.87 MB is third-party. The largest items:
   - `https://images.unsplash.com/photo-1781650104690-a5309d91a26b?auto=format&fit=crop&w=2200&q=74` (699 KB). This is the `--pbe-scene-image` background in `src/styles/background-selector.css` and `pbe-personalization-polish.css`.
   - ESPN hot-linked headshots: `a.espncdn.com/i/headshots/mma/players/full/4025699.png` (253 KB) and `…/4848674.png` (195 KB).
   - `/pro/network-1086.avif` (170 KB).
2. Render-blocking `fonts.googleapis.com/css2?family=Playfair+Display…Inter…JetBrains+Mono` (about 870 ms) and `/assets/index-DKZYtcLv.css` (63 KB, about 1.3 s), plus `/pbe-consent-v1.js` and `.css`.
3. Main-thread work. `/assets/index-BdGBzvcH.js` is 295 KB, 140 KB of it unused, with 1.1 s of bootup and long tasks of 386 and 145 ms at about 10.3 s. Google SwG `news.google.com/swg/js/v1/publisher.js` adds more long tasks.
- CLS (0.04) passes.

**root `/ja/pro`, `/ko/pro`**
- Mobile cold: LCP 5.7 / 4.8 s. `/ja/pro` mobile warm: 2.54 s.
- The LCP element is the same hero img (`/pro/hero-m-960.avif`). The phase is all render delay (5.3 s for JA).
1. The same 699 KB Unsplash scene background.
2. The same render-blocking Google Fonts CSS and `index-DKZYtcLv.css`.
3. The same 295 KB `index-BdGBzvcH.js` bundle.
- There are no ESPN headshots or live rails, so there are 25 requests and 1.64 MB, against 62 requests and 2.68 MB for EN.

**golf `/` (EN/ES/JA/KO)**
- CLS fails on mobile cold (0.22–0.44), mobile warm (0.22, except JA at 0.00), desktop cold (0.24) and desktop warm (0.12).
- LCP fails on mobile cold for EN (2.72 s) and JA (2.59 s). ES (2.27 s) and KO (2.22 s) are near the limit.
1. The CLS culprit is `body > main#main > section.sched-rail`, about 0.216 per shift on mobile and about 0.12 on desktop. Lighthouse gave no cause, which means late-inserted content, not a font or image. A smaller one is `header.site-header > div.masthead > div.masthead-right`.
2. A 286 KB JSON fetch, `/api/v1/projection/index.json` (proxied to golf-api), loads on the home page and competes with the hero `/media/golf-sunrise-1280.avif` (61 KB, fetchpriority=high).
3. Render-blocking `/i18n/golf-locale.css`, `/i18n/pbe-locale.css`, `/assets/index-DCDDsLZU.css` (40 KB) and `/pbe-consent-v1.js`.
- On cold runs Lighthouse did not attribute the LCP element (UNKNOWN). Warm runs show the hero img.
- `/all-access` passes in all four languages (mobile cold LCP 2.33–2.36 s).

**MLB `/sharp-tools` (EN/JA/KO) and `/games` (EN/JA/KO)**
- CLS fails in every mode (0.36–0.58), except JA sharp-tools mobile warm (0.00).
- Mobile cold LCP: 7.5 / 7.3 / 2.2 s for sharp-tools and 8.7 / 8.3 / 8.5 s for games.
- TBT fails for JA/KO on mobile: sharp-tools 294 / 222 ms cold and 634 / 240 ms warm; games 276 / 337 ms cold and 443 / 437 ms warm.
1. The CLS culprit is `body.field-fenway > div#app > footer#pbe-footer`, at 0.36–0.58 by itself. The footer renders and is then pushed down as the tab content mounts. Web-font swaps (`fonts.gstatic.com` Inter, Barlow Condensed, Oswald) also show up as causes, and `svg.pbe-ekg` in the footer adds 0.05.
2. LCP:
   - sharp-tools: the element is `div.st-page > header.st-hero > … > p.st-hero-dek` (text), with a render delay of 6.9 s.
   - games: the element is `section.bb-stage > div.bb-feed`, with a load delay of 5.4–6.0 s (JS-rendered).
   - Both are behind `https://images.unsplash.com/photo-1648789112559-de8636e8d0ad?w=2400&q=70&auto=format&fit=crop` (532 KB background), `/brand/pbe-full-320.png` (87 KB, a 160x89 footer logo) and `propsports-markets.sales-fd3.workers.dev/v1/market-intelligence/sport/mlb` (51 KB).
   - The render-blocking chain is `fonts.googleapis.com/css2?family=Barlow+Condensed…Oswald…`, `/assets/main-BavQQ6up.css` (50 KB) and `/pbe-consent-v1.js`.
3. JA/KO TBT has two sources:
   - Long tasks that Lighthouse attributes to the localized HTML document itself: 590, 344 and 150 ms on `/ja/sharp-tools`; 475 ms on `/ko/sharp-tools`; about 400 ms on `/ja/games` and `/ko/games`.
   - `/assets/main-BCpmya8a.js` (246 KB raw, 1–9 s of total CPU).
   - JA/KO load `/assets/ja-app-DY1gs8-U.js` (97 KB raw) or `/assets/ko-app-Dd1zwkUx.js` (92 KB raw) in place of EN's separate i18n-core and preload chunks. That makes JS transfer 150–158 KB against 91–107 KB for EN.
- KO sharp-tools mobile cold LCP (2.16 s) differs from JA and EN because the LCP candidate differed: in some runs it was the lazy footer logo `/brand/pbe-full-320.png`, otherwise the hero text. The JA spread was 2.13–7.63 s. Treat the JA/KO vs EN LCP gap on sharp-tools as noise in which element counts as LCP, not as a real difference.

**MLB `/ja/`, `/ko/` (landing)**
- Mobile cold LCP 2.88 / 2.99 s. JA CLS is 0.25 on mobile and 0.12 on desktop. KO CLS passes (0.03 / 0.09).
1. The LCP element is `section.lp-hero > … > p.lp-lead` (text), with a render delay of about 2.4 s.
2. `/stadium-bg.jpg` (262 KB JPEG) and `/brand/pbe-full-320.png` (87 KB) take the bandwidth, plus `/api/mlb-data/api/v1/sports/1/players?season=2026…` (25 KB).
3. JA CLS comes from `section.lp-hero > div.lp-wrap > ul.lp-facts` (0.25 on mobile) and `section#features` (0.12 on desktop).
- There is no EN `/` counterpart: it 307-redirects to `/sharp-tools`.

**F1 `/` (EN)**
- Mobile cold LCP 3.89 s. The element is the hero `picture.hero-art > img` (`/media/backdrop/hero-mobile-900.avif`, 21 KB, high priority), with a render delay of 3.3 s.
1. The CSS `/assets/app.ea9d507937.css` (32 KB) is render-blocking.
2. 82 requests and 593 KB. That includes `/news/cards/*.webp` cards (26–28 KB each, 354 KB of images in all).
3. The live data and headshots from `propsports.proptechusa.ai` were blocked in the lab (deviation 1).

**F1 `/all-access`**
- Mobile cold LCP 2.79 s and CLS 0.148 (mobile, both cold and warm).
1. The LCP element is `section.aap > div.acct-grid > div.acct-story` (text), with a render delay of 2.0 s.
2. The CLS culprit is `body.bg-data > main#main > section.section`, with no cause given. It follows the failed `/pbe/f1/membership` and `propsports…/v1/f1/live` calls. Those were blocked in the lab, so in production this shift may differ.
3. The render-blocking `/assets/app.ea9d507937.css` and self-hosted Barlow fonts (`/assets/fonts/barlow-*.woff2`, about 23 KB each).

**F1 `/pbecast/2026-singapore-grand-prix`**
- Mobile cold LCP 2.80 s. The element is `section.pc-grid > div.pc-trackcol > p.fine.pc-method` (text), with a render delay of 2.3 s.
1. A 324 KB fetch of `propsports-markets.sales-fd3.workers.dev/v1/market-intelligence/event/f1/2026-singapore-grand-prix-race`.
2. The render-blocking `/assets/app.ea9d507937.css`.
3. The fonts.

**Soccer `/all-access`, `/es/all-access`, `/`, `/es/`**
- Mobile cold LCP is 3.96–4.35 s. CLS is 0 and TBT is under 50 ms.
1. Images through `/api/soccer/media/<sha>` (the soccer-api Worker):
   - `/` takes 2.12 MB of images on mobile and 2.88 MB on desktop. The largest is `/api/soccer/media/8c9942efd97ded9212c201bac7bcba7d90b9bb38a99a12b6a29b2264969a414c` (496 KB), then 172, 132 and 122 KB.
   - `/all-access` takes 792 KB, including `…/df7836507d3a…` (137 KB) and `…/0b8b61be58b1…` (104 KB).
2. The render-blocking `fonts.googleapis.com/css2?family=Barlow+Condensed…Inter…`, `/assets/index-DQjmAnB4.css` (192 KB raw, 38 KB br) and `/pbe-consent-v1.js`/`.css`. The 471 KB raw (131 KB transfer) `/assets/index-D4ARU2Ep.js` SPA bundle renders the content.
3. The middleware awaits the soccer-api Worker before the HTML leaves, so simulated TTFB is 600–670 ms against about 470 ms elsewhere. LCP elements are:
   - `/all-access`: `div.acct-story.is-prospect`, with a 1.1–1.35 s load delay and a 2.1–2.4 s render delay.
   - `/es/`: `p.lede.home-hero-lede`, with a 3.7 s render delay.

**Passing everywhere:** golf `/all-access` (EN/ES/JA/KO) and F1 `/ja`. Every warm desktop run passes LCP and TBT.

## Do JA / KO / ES differ from English?

- **root:**
  - `/ja/pro` and `/ko/pro` are a different, lighter server-rendered page (`src/global/intl-pages.js`). Mobile cold transfer is 1.64 MB in 25 requests, against 2.68 MB in 62 for EN. There are no ESPN headshots, live rails or `/api/feed` calls, and TBT is 5–12 ms against 255 ms.
  - Mobile cold LCP is 5.7 and 4.8 s against 10.8 s for EN. The cause is the same 699 KB Unsplash background and blocking CSS.
  - `/pro?lang=es&via=soccer` is byte-identical in weight to EN and measures the same (10.6 s), because it is the English page.
- **golf:** ES/JA/KO match EN on both pages: the same JS (92 KB), the same weight within 12 KB, and the same `section.sched-rail` CLS. JA/KO make one fewer request.
- **MLB:**
  - JA/KO pages ship `ja-app`/`ko-app` bundles, about 60 KB more JS transfer.
  - They show more main-thread work: TBT fails on JA/KO mobile but not on EN (39 ms sharp-tools, 156 ms games).
  - Weight (about 1.0 MB) and the footer CLS are the same as EN.
- **F1:** `/ja` is a smaller page than `/`: 190 KB in 46 requests against 593 KB in 82, with no news-card images. It passes on mobile cold at 2.39 s, against 3.89 s for EN.
- **Soccer:** ES matches EN on desktop (3.26 MB home, 1.21 MB all-access). On mobile, ES home loaded fewer media items (1.73 MB against 2.50 MB) but had the same or slightly higher LCP (4.35 against 3.96 s), because the LCP element is text with a render delay. All-access is the same within noise.

## Re-run

```
# one-time tool dir (not in this repo), e.g. E:/Temp/claude/lab:
#   npm i lighthouse@12.8.2 chrome-launcher@1 path-to-regexp@6.3.0
# build each site in its lab worktree (lab-pages.json -> sites[].build), then:
node scripts/perf-lab.mjs run --out docs/global/perf/lab-2026-10-10/results.json --runs 3 --only <ids> --lab E:/Temp/claude/lab --raw E:/Temp/claude/lab/raw
node scripts/perf-lab.mjs report --in docs/global/perf/lab-2026-10-10/results.json --out docs/global/perf/lab-2026-10-10/table.md
```
`run` merges into an existing `--out`, replacing only the rows for the selected pages. Use 2–3 pages per invocation to keep each run under about 10 minutes. The raw gzipped LHRs (139 MB) are kept out of the repo.
