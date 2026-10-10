# Global #67 performance baseline (regression gate)

Owner direction: "Capture actual page-load and Core Web Vitals baselines for every currently public language page. Use those as regression gates for the entire rollout."

## Status on 2026-10-10: UNKNOWN (not measured yet)

`baseline-2026-10-10.json` lists all 29 pages x 2 strategies, but every metric is `null`. The capture began at 14:16Z. The keyless PageSpeed Insights API v5 answered HTTP 429 on the first request: `Quota exceeded for quota metric 'Queries' and limit 'Queries per day' ... consumer 'project_number:583797351490'`, which is the shared keyless consumer. A confirmation request at 14:20:37Z also got 429.

Three method constraints applied:
- No API key was requested.
- No local Lighthouse was run.
- Production was not polled from the workstation, because that IP trips the Vercel Security Checkpoint (403).

Nothing here is a measured number. To fill the baseline, run this after the daily quota resets (Pacific midnight, 07:00Z):

```
node scripts/perf-capture.mjs --out docs/global/perf/baseline-2026-10-10.json --runs 1 --key-runs 3 --cache .perf-cache
```

`--cache` makes the run resumable. Cached runs that succeeded are reused, and only failed runs are retried. If quota runs out partway, re-run the same command the next day.

## Pages (`pages.json`)

Each page entry has `id`, `url` and `lang`. Localized pages also carry `en`, the id of their English comparison page. Pages marked `key: true` get `--key-runs` runs, and their median is recorded.

| Site | Localized pages | English comparison | Source of truth |
|---|---|---|---|
| propbetedge.ai | /ja/pro, /ko/pro, /ja/legal/tokushoho, /ko/legal/business | /pro | `src/global/intl-pages.js` (`INTL_PRO_LANGS`, `DISCLOSURE_PATH`, `intlRoute`) |
| golf.propbetedge.ai | /es/, /ja/, /ko/ and /{es,ja,ko}/all-access | /, /all-access | golf `src/i18n/ready.js` (`PUBLIC_LOCALES`, `LOCALIZED_PATHS`) and `src/i18n/locale.js` (`SITE`) |
| mlb.propbetedge.ai | /ja/, /ko/ | /, /sharp-tools | Global #67 release record (propbetedge-v2 d2c60ed) |
| f1.propbetedge.ai | /ja, /ja/standings | /, /standings | f1 `scripts/site/ja.mjs` ("Only COMPLETE pages are published in Japanese: /ja and /ja/standings") |
| soccer.propbetedge.ai | /es/, /es/matches, /es/all-access, and one verified translated article: /es/news/premier-league/erling-haaland-scoring-run-2026-09-20-be6e54 | The same paths without /es | soccer `src/i18n/locales.js` (es ready) and `api/sitemap.js`. The article was taken from the live `sitemap-es-news.xml`, which lists only articles that have a current verified Spanish translation. It was fetched 2026-10-10 14:15Z through Vercel. |

futbol.propbetedge.ai is not measured separately because it 308-redirects to soccer.propbetedge.ai/es/... in middleware.

## Method

- **Tool.** PageSpeed Insights API v5, keyless, `category=performance`, with `strategy=mobile` and `strategy=desktop` per URL. Lighthouse runs on Google's network with PSI's default throttling: mobile is a simulated Moto G Power on slow 4G, and desktop uses desktop throttling.
- **Pacing.** Request starts are at least 3 s apart, with at most 2 requests in flight. A 429 or 5xx is retried with 30, 60 and 90 s backoff. After that the run is recorded as an error.
- **Runs.** Normal pages get 1 run per strategy. Key pages get 3 runs, and each metric is recorded as its own median, so the medians can come from different runs. The individual runs are kept in `lab_runs`.
- **Validity.** A run counts only if Lighthouse loaded a 2xx document. A 403 checkpoint or error page would otherwise produce a fake "fast" result. Failed runs go to `errors`.

## Fields (per `results[]` entry = page x strategy)

| Field | Meaning |
|---|---|
| `lab.lcp_ms`, `lab.cls`, `lab.tbt_ms`, `lab.fcp_ms`, `lab.si_ms` | Lighthouse lab LCP, CLS, Total Blocking Time, FCP and Speed Index (median) |
| `lab.ttfb_ms` | Lighthouse `server-response-time` for the root document |
| `lab.bytes` | `total-byte-weight`: transfer bytes for all requests |
| `lab.requests` | Request count from `resource-summary` |
| `lab.transfer.{document,script,stylesheet,image,font,other,third_party}` | Transfer bytes by resource type, from `resource-summary` |
| `lab.perf_score` | Lighthouse performance score, from 0 to 1 |
| `field` | URL-level CrUX p75 values (`lcp_p75_ms`, `inp_p75_ms`, `cls_p75`, `fcp_p75_ms`, `ttfb_p75_ms`) with `scope: "url"`. It is `null` when PSI has no URL-level field data, which is expected for pages that are days old. Null means "no field data", not zero. |
| `origin_field` | Origin-level CrUX, for context only. The gate never uses it. |
| `doc_status`, `final_url`, `lighthouse_version`, `warnings`, `errors` | Provenance of the last run |

## Variance

PSI lab numbers move from run to run. Variance on the same URL is commonly about ±10–20% on LCP and TBT, depending on server response time and PSI datacenter load. CLS and byte weight are much more stable. A single run is therefore a weak baseline, and the key pages take 3 runs with a median. When the gate flags a single-run page, confirm it with a 3-run re-capture of that page (`--only <id> --runs 3`) before treating it as a real regression.

## Gate (`scripts/perf-gate.mjs`)

```
node scripts/perf-capture.mjs --out /tmp/now.json --runs 1 --key-runs 3
node scripts/perf-gate.mjs --current /tmp/now.json [--strict] [--json] [--lcp-rule max|any]
```

A page x strategy regresses when any of these hold:

- **LCP** rises more than 250 ms **and** more than 10%. This is the default `--lcp-rule max`. With `--lcp-rule any`, a rise past either threshold is enough.
- **CLS** rises more than 0.02.
- **TBT** rises more than 50 ms.
- **Byte weight** rises more than 5%.
- **Field INP p75** rises more than 10% and more than 25 ms. This is checked only when both the baseline and the current run have URL-level CrUX data.

A metric with a null baseline or null current value is UNKNOWN. It is listed, and it never passes or fails.

The gate also lists Good-threshold misses as debts (LCP > 2.5 s, CLS > 0.1, INP > 200 ms). Debts are informational only.

**Exit codes:**
- 0: no regression.
- 1: at least one regression.
- 3: with `--strict`, nothing regressed but something is UNKNOWN.

While this baseline is all-null, every run of the gate reports UNKNOWN. Without `--strict` the gate still exits 0, so release gating must use `--strict`, which exits 3 until the baseline holds real numbers.
