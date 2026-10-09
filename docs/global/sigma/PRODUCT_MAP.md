# Stripe product map (from code, 2026-10-09) — brand classification for the Sigma pack

Built by searching the network's repositories for Stripe identifiers; nothing here comes from Stripe itself.
- **One account.** Every ID shares the account segment `F3CaVzg4OR`, every payment link uses the `…7wA0x` suffix and
  there is one billing portal, so **PropBetEdge, PropSports and PropData all bill through one Stripe account**. Brand
  separation therefore depends entirely on the price → brand mapping below.
- **Truncated IDs.** IDs written with `…` are abbreviated here; the full value is at the cited path.
- **Coverage.** A slow-drive scan left untracked files outside the key repos unsearched, so treat this map as a
  starting point and confirm it with `01_product_catalog.sql`.

| Brand (for `brand_prices`) | Prices / links | What it sells | Source |
|---|---|---|---|
| **PBE All Access** | `price_1UJCF1F3CaVzg4ORSIohWTca`, `plink_1UJCFAF3CaVzg4ORKspa47rI`, `buy.stripe.com/8x2eVdgmOaqy4pv8Ez7wA0N` | All Pro sports, **$29/month USD**, promo THEEDGE25 (25% off) | propbetedge-workers `workers/propbetedge-sports-billing/src/catalog.js:10,29`; news-site `src/pro-content.js:13-19`; members `src/main.ts:17` |
| PBE legacy sport | `price_1UEWlF…`, `price_1UEWlU…` | Legacy NBA Pro, founding monthly / weekly | `catalog.js:12-13,30-31` |
| PBE legacy sport | `price_1UEWlL…`, `price_1UEWlZ…` (product `prod_VF0mJ5eYeFLoem`) | Legacy NHL Pro, monthly / weekly; links now inactive | `catalog.js:15-16,32-33` |
| PBE legacy sport | `price_1UEfAm…`, `price_1UEfAs…` | Legacy WNBA Pro, monthly / weekly | `catalog.js:18-19,34-35` |
| PBE legacy sport | `price_1UFbcD…`, `price_1UFdQt…` (product `prod_VD9SH84qnOUfJ1`) | Legacy UFC Pro, $9.99/mo, $3.99/wk | `catalog.js:20-22,36-38` |
| PBE legacy sport (retired) | `price_1UCj9g…`, `price_1UCj9m…` | Retired UFC, $14.99/mo, $5.99 card pass; never grants access | `tests/ufc-pro-billing-identities.test.mjs:15-18` |
| PBE legacy sport | `price_1UEWAX…`, `price_1UEWAO…` | Legacy NFL, founding $9.99/mo, $3.99/wk | nfl-propbetedge-new `api/checkout.js:15-20` |
| PBE legacy sport | `price_1U9QUZ…`, `price_1U9oVz…` | Legacy NFL, retired $9.99/wk; $99 one-time Season Pass | `workers/nfl-billing/src/index.js:45-56` |
| PBE legacy sport | MLB price IDs set by env (`STRIPE_MLB_MONTHLY_PRICE_ID`, `STRIPE_MLB_WEEKLY_PRICE_ID`, `STRIPE_TRIAL_PRICE_ID`, `STRIPE_PRICE_ID`) | Legacy MLB (incl. the historical $14.99) | propbetedge-workers `workers/propbetedge-stripe/src/index.js:33-35`; `PRODUCTION.json:40-60` |
| PropSports | `price_1ULUM6/M8/MA/MD/MF/MH/MJ…` | Single sport, $29/mo | propsports-stripe `src/index.js:30-36` |
| PropSports | `price_1ULUMY/Ma/Mc/Me/Mg…` | Developer $79, All Sports $149, Pro $299, Scale $599, Enterprise $1,500 | `src/index.js:40-44` |
| PropSports (grandfathered) | `price_1Tgl7S/TglBv/TglD6/TglED`, `1ULRst/1ULRtJ/1ULRtL`, `1TgVGE/1TgVIF/1TgVK2/1Tnp8A`, `1ULQx6`, `1THBtS/1THBu0` | Legacy single-sport, founding, Builder Indie, bundles | `src/index.js:47-66` |
| PropSports | `price_1TgVox/TgVpY/TgVqW` | MLB Edge Suite $29/$59/$99 (checkoutReady false) | propsports `assets/ps-config.js:455-457` |
| PropData | `price_1TgVrY/TgVsD/TgVso`, `price_1TgVtY/TgVu5/TgVue` | PropData Core (from $49), Pro Stack (from $149) | propsports `propdata-core.html:297-299`, `propdata-pro.html:287-289` |
| PropData | `price_1Tgohy/Tgoj5/Tgok0/Tgokh` | Basic/Pro/Ultra/Mega with a 3-day trial (skipped by the MLB webhook) | propbetedge-stripe `src/index.js:16-22` |
| PropData | `price_1Tmbxj/TmbyT/TmbzX` monthly; `price_1Tp8tf/Tp8ua/Tp8vD/Tp8w5` annual | US Starter $79 / Builder $199 / Scale $499 / Enterprise $1,499 per month; $799–$14,999 per year | propdata-vercel `index.html:4506-4514` |
| PropData (country links) | 21 payment links | US, GB, NZ, AU, EE, FR, ES monthly plans in local currency | proptechusa.ai `src/components/CountryCommerce.tsx:15-125` |
| PropSports | `buy.stripe.com/3cI6oH8Um42ag8dbQL7wA0q` | "All sports · $49/mo" | `CountryCommerce.tsx:352` |
| PBE (MLB era) | `buy.stripe.com/14A6oHc6y7em7BHg717wA01` | "Resubscribe 50%" win-back | propbet-email-digest `src/index.js:11` |

## Metadata on Stripe objects today (useful for joins)

- **PropSports checkout:** `plan`, `product`, `sports` (Developer plan: custom fields `sport1`–`sport3`).
- **MLB checkout:**
  - `source=propbetedge_mlb_subscription`, `acquired_sport=mlb`, `plan`, `billing_mode`, `gate_version`;
  - optionally `referrer_code`;
  - it also writes an `email` key. Reports must never select it.
- **NFL checkout:**
  - `price_id`, `tier`, `acquired_sport=nfl`, `product=propbetedge_nfl`, `identity_source`;
  - an `email` key as well, which reports must never select.
- **All Access (Payment Link):** writes **no** metadata. Access is granted by the allowlisted link + price.
- **Nothing anywhere records `locale`, `surface` or the visitor's country.** `LOCALIZATION_PLAN.md` §7 has the M1
  proposal: `client_reference_id=<locale>.<surface>.<sport>` on the Payment Link.
