# PropBetEdge Global — network localization plan (Issue #67)

Owner direction, 2026-10-09:
- one international PropBetEdge ecosystem with a single All Access membership;
- Spanish first across the network;
- **Japan and South Korea are first-wave commercial validation priorities**, in parallel with Spanish;
- Brazilian Portuguese and French follow on the shared infrastructure, sequenced by conversion evidence;
- bounded conversion pilots come before any translation spend is scaled;
- no change to pricing ($29/month), subscriptions, entitlements, models, prediction records or market rules without a
  scoped release review.

Coordinated with `LHBUSA/soccer#15`. Soccer is the proven reference implementation.

## 1. What already works (Soccer, production)

| Piece | Where (LHBUSA/soccer) | Status |
|---|---|---|
| Locale registry with `ready` gates; unready prefixes 404 | `src/i18n/locales.js` | en, es live; pt, fr built but off |
| Catalog translation (exact-match msgid, number- and name-preserving patterns, source fallback) | `src/i18n/translate.js`, `catalog/es.js` | ~1,000 Spanish entries |
| DOM localization pass that never touches market or article bodies | `src/i18n/dom.js` | live |
| API code → localized copy with an exact-English drift guard | `src/i18n/pro-copy.js` | Matchup Analyzer live in es |
| Language cookie redirect, localized SSR meta, reciprocal hreflang | `middleware.js`, `src/seo/meta-i18n.js` | live |
| Localized sitemaps with xhtml alternates | `api/sitemap.js` | live, incl. `sitemap-es-news.xml` |
| **Verified newsroom translation**: separate versioned records, source-revision binding, deterministic gates, independent model check, per-locale budget, lifecycle (revised → superseded, withdrawn → withdrawn) | `workers/shared/article-i18n.js`, `workers/soccer-news/src/translate.js`, migration `20261009001600` | live 2026-10-09; 10-article Spanish pilot running |
| Alternate language host | `futbol.propbetedge.ai` → 308 to `/es/`, noindex | live |

## 2. Network inventory (read-only audit, 2026-10-09)

**i18n today:** apart from Soccer, no property ships any i18n. Compare follows the browser locale for number formatting
only (`predictions/compare/app.js:20`).

**Local checkouts are not all on main:** UFC (`ufc-fight-simulator`), Tennis (`phase-6`) and MLB (`propbetedge-v2` on
`hr-targets-hero-desk`). Re-verify against origin/main before any work starts.

| Property | Repo | Stack | Rendering / SEO | Newsroom | Consent |
|---|---|---|---|---|---|
| Main / News | propbetedge-news-site | Vite SPA + Vercel Edge middleware (1,574 lines) | middleware meta, `api/sitemap.js` (news sitemap hardcodes `en`) | propbet-news workers | yes (d5e7) |
| Soccer | soccer | Vite + Vercel + Workers | full localized SEO | soccer-news (frozen packet + translation) | yes (4f67) |
| NFL | nfl-propbetedge-new | static HTML/JS, 22 Workers | none | nfl-api | **no** |
| NBA | nba-propbetedge | Vite + prerender | static sitemap | `src/data/pbe-news.js` | yes |
| WNBA | wnba | Vite + wnba-web SSR Worker | Worker | wnba-news desk | yes |
| NHL | nhl-propbetedge | Vite | none | none | yes |
| **MLB** | propbetedge-v2 (Vercel `propbetedge-rebuild`) | Vite SPA, no SSR, monolith (`main.js` 1,683 lines) | none | none | **no** |
| UFC | UFC (`ufc-propbetedge/web`) | Next 15 / React 19 | app/sitemap | ufc-newsroom (packets) | **no** |
| Tennis | tennis | Vite + prerender + tennis-web Worker | Worker heads | tennis-news (evidence) | **no** |
| **Golf** | golf | Vite + prerender | prerender | golf-news (`freezePacket`) | yes |
| **F1** | f1 | custom static generator | build-time sitemaps | build-time packets | yes |
| Boxing | boxing | Next | app/sitemap | boxing-news | none (DEPLOY_HOLD) |
| Predictions / Compare / Markets | predictions | static + Worker SSR | Worker sitemaps | insights templates | partial |
| **Members / All Access** | members | Vite 7 + TS, auth-magic Worker | noindex | — | **no** |
| Learn | learn-propbetedge | static build | build sitemap | — | **GA loads without consent** |

**The shared contracts are copied by hand into each repo, and the copies have drifted:**
- `pbe-membership.js` is at CONTRACT_VERSION 1.1.0 in UFC, 1.2.0 in NBA/NFL/NHL/Tennis/WNBA and 1.3.0 in Soccer.
- `pbe-consent-v1.js` exists in two variants (sha256 d5e7… and 4f67…).

## 3. Shared foundation: `pbe-locale/1`

**Source of truth:** `LHBUSA/propbetedge-workers/shared/pbe-locale/`. That repo is already the shared-workers home, so
no new repository and no new paid resource is needed.

**Distribution:** each site carries a vendored, pinned copy at `src/vendor/pbe-locale/` with `VERSION` and
`MANIFEST.sha256`, plus one node test per repo that fails on drift. There is no npm publishing and no build-time
coupling, so every property keeps deploying independently.

| Module | From Soccer | Generalisation |
|---|---|---|
| `locales` | `locales.js` | Registry `en, es, pt-BR, fr, ja, ko`, `ready` per property. A **region tag separate from the URL prefix** (`/pt/` + hreflang `pt-BR`; fixes the current `pt` mismatch). Host aliases. |
| `routing` | `splitLocale`, `localizePath`, `alternateLinks(codes)` | Unchanged API |
| `translate` + `dom` | `translate.js`, `dom.js` | Catalogs per property plus `catalog/common/<locale>` (nav, footer, All Access, consent, errors, glossary) |
| `format` | `lib/format.js` | `Intl` with the reader's locale **and an explicit time zone**; "ET" and "UTC" labels come from the catalog; numbers keep one format |
| `sitemap` | `api/sitemap.js` | Per-locale sitemaps; articles only when verified |
| `article-i18n` + translation desk | soccer-news `translate.js` | A Worker-side module with a per-property glossary, gates and allowance; the same `soccer_article_translations` shape per sport DB |
| `selector` | `components/lang.js` | Accessible globe selector |

**Framework adapters:**
- **Vite / prerender** (News, NBA, WNBA, NHL, Tennis, Golf, MLB, Members): import directly, with Vercel middleware
  where the site has SSR.
- **Static generators** (F1, Learn, Predictions): a per-locale build loop.
- **Next** (UFC, Boxing): a `[locale]` segment + `generateMetadata`, reusing `translate`, `format` and `routing` but not
  `dom`.
- **Workers** (news, wnba-web, tennis-web, golf-api): `article-i18n` + `sitemap`.

**Japanese / Korean requirements, built into the foundation from day one:**
- `/ja/` and `/ko/` with hreflang `ja` / `ko` and `htmlLang` `ja` / `ko`.
- CJK font stacks: Hiragino Sans / Noto Sans JP / Meiryo; Apple SD Gothic Neo / Noto Sans KR / Malgun Gothic.
- Under `:lang(ja)`: `line-break: strict`. Under `:lang(ko)`: `word-break: keep-all`. Both: `overflow-wrap: anywhere`.
- No `text-transform: uppercase` or wide letter-spacing on CJK text. Soccer alone has 73 uppercase rules, so this needs
  a `:lang()` reset.
- Meta descriptions are truncated by **characters**, not at the last space. Soccer's `clip()` must change before ja/ko.
- No `split(' ')` word heuristics on translated copy (MLB has 77).
- IME-safe Enter handling (`event.isComposing`): there are 0 occurrences in MLB, F1, Golf and Members today.
- Dates use `ja-JP` / `ko-KR` in the reader's time zone, with UTC lock and settlement times kept as the evidence.
- Every page is checked at 320 / 360 / 390 / 430 / 760 / 1024 / 1440 px (MLB has 187 `nowrap` and 68 ellipsis rules).

## 4. Ranked rollout

Ready flags stay `false` until each property's full gate passes, so no unfinished locale is ever public.

| Wave | Property | Locales | Effort | Risk / note |
|---|---|---|---|---|
| 0 | `pbe-locale/1` package; consent and membership contracts vendored and versioned | — | M | foundation |
| 1 | **Soccer**: finish es articles (pilot → auto); rebase onto the package | es live; ja/ko later on demand | S | low |
| 1 | **Golf**: proof integration (§5), then ja + ko | es, ja, ko | S–M | low; Golf `AGENTS.md:17` requires owner approval for production |
| 1 | **Members / All Access shell** (noindex) + magic-link email | es, ja, ko | M | high: auth loops, and the email is English-only (`auth-magic/src/index.js:532`) |
| 1 | **News `/pro` + header/footer shell** | es, ja, ko | M | medium: large middleware |
| 2 | **F1** (Japan) | ja, es | M | low–medium; the Race Picks branch is in flight |
| 2 | **MLB** (Japan, Korea) | ja, ko, es | L | high: monolith, no SSR |
| 3 | UFC (es, pt-BR, ko on demand) | | L | Next adapter |
| 3 | Predictions / Compare / Markets | | M | contract text stays source-of-truth; no eligibility claims |
| 4 | Tennis/NHL (fr), NBA, WNBA, NFL, Learn, Boxing | | M each | NFL is L (static, 22 Workers) |

pt-BR and fr move up only when the Sigma baseline (§6) or analytics show demand.

## 5. Proof integration: Golf

Why Golf:
- It is a first-wave JP/KR property.
- It uses Vite + prerender, the dominant pattern in six repos, so it proves vendoring outside Soccer.
- Its render layer is small.
- It already ships consent.
- It has a frozen-packet newsroom for a later article proof.
- Picks are held (`PICKS_ENABLED=0`).

**Scope:**
- vendor `pbe-locale/1.0.0`;
- build `/es/` and `/ja/` shells for the home and All Access pages with `ready:false`, served only as noindex previews;
- the CJK font stack and `:lang()` CSS;
- 320 px QA and the drift test.

Production deploy needs the owner's Golf approval.

## 6. Commercial and compliance blockers (bring to owner; nothing changed)

| # | Blocker | Evidence |
|---|---|---|
| B1 | "Final and non-refundable once access is activated" conflicts with the EU/UK 14-day withdrawal right unless an express waiver is captured at checkout, and the Payment Link captures none | news-site `src/pages/trust.js:37` |
| B2 | Minnesota / Ramsey County governing law; data "processed in the United States" with no transfer mechanism stated | `trust.js:63`, `trust.js:195` |
| B3 | US-only problem-gambling helplines; many properties carry no responsible-play or age text at all | 1-800-GAMBLER: `footer.js:140`, `trust.js:108`, `members/src/main.ts:138,682`. MLB 1-800-522-4700: `main.js:1068-1073` |
| B4 | **Korea and Japan regulate betting-related content.** Market/odds modules (Kalshi referral, `kalshi-partner.js:23`) need per-country gating; Kalshi is US-only | legal review needed |
| B5 | Prices appear as "$29": Spanish copy "$29/mes" reads as pesos in Mexico and LatAm. Display "US$29" / "29 USD" without changing the price | soccer `catalog/es.js:42,126`; `pro-seo.js:199` |
| B6 | All Access is sold through a Payment Link (`buy.stripe.com/8x2eVdgmOaqy4pv8Ez7wA0N`, price `price_1UJCF1F3CaVzg4ORSIohWTca`). Its currencies, automatic tax, payment methods (JCB; Korean local cards; Konbini) and checkout locale are Dashboard settings, not visible in code | `propbetedge-sports-billing/src/catalog.js:10,28-29` |
| B7 | **No Japanese 特定商取引法に基づく表記 (Specified Commercial Transactions Act notice) and no Korean e-commerce business disclosure exist anywhere.** Both are required before selling to consumers there | grep: 0 hits |
| B8 | Consent: GA loads without consent on Learn; NFL, MLB, UFC, Tennis, Members, Compare and Markets have no banner; no region-specific behavior | audit |

## 7. Measurement: who becomes a paying member, from where, and do they renew

**Today:**
- No code reads country or language. There are 0 references to `x-vercel-ip-country`, `cf-ipcountry` or
  `accept-language`.
- There is no country, locale or UTM column in `pbe_sport_entitlements`, `pbe_member_profiles` or
  `pbe_sport_stripe_events`.
- The billing webhook stores email, ids, price, sport, plan, status and checkout session only.
- Nothing tags the Payment Link.

**Paying-customer evidence now:** the Stripe Sigma pack in `sigma/`. It covers card-issuing country and billing country
(never merged), revenue, active subscriptions, MRR, new subscribers, failed payments, refunds and retention cohorts,
all aggregate-only with small-cell suppression.

**Minimal consent-compliant design (each step separately approved):**

| Step | Change | Consent / approval |
|---|---|---|
| M1 | Payment Link URLs carry `client_reference_id=<locale>.<surface>.<sport>` (non-personal). Stripe stores it on the Checkout Session, so Sigma can join locale and surface to payments | no consent needed; touches the checkout URL only, not price or config |
| M2 | GA4 custom dimensions `pbe_locale`, plus coarse `pbe_country` from `x-vercel-ip-country` at the edge, sent **only after analytics consent** | consent-gated |
| M3 | The webhook persists `client_reference_id`, `customer_details.address.country` and presented currency into new nullable columns on `pbe_sport_entitlements` | migration + owner approval |
| M4 | A renewal and churn report by locale, surface and country from subscription lifecycle rows | read-only |

**Bounded conversion pilot (before scaling translation spend):**
- Run per market (e.g. ja Golf + All Access landing, ko MLB + Golf).
- Fixed budget and a fixed window.
- Success criteria declared before launch: localized visits → All Access CTA → checkout started → paid → first renewal,
  measured with M1–M2.

## 8. Next actions

1. Owner: run `sigma/00`–`07` in the Sigma editor and export aggregates only. The baseline then drives §4.
2. Engineering, no approval needed: build `pbe-locale/1` in propbetedge-workers, then the Golf proof as a preview.
3. Owner decisions, from §6: B1/B2 legal texts, B4 market gating, B6 Payment Link settings, B7 JP/KR disclosures, and
   approval for M1 and M3.
