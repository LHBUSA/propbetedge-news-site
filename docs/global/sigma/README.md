# PropBetEdge Global — Stripe Sigma reporting pack (Issue #67)

Read-only, aggregate-only SQL for the Stripe Sigma editor on the PropTechUSA Stripe account. Purpose: a
country-by-country revenue and retention baseline for **PropBetEdge All Access** (and legacy PropBetEdge sport SKUs),
kept separate from PropData and PropSports revenue, so international product decisions rest on paying-customer evidence.

## Status — read first

- **Not yet run.** The agent environment that wrote this pack has **no Stripe or Sigma access**: no Stripe CLI, no
  Stripe connector and no key in its shell (Stripe keys exist only as Worker secrets, which cannot be read back). Sigma's
  ad-hoc SQL runs in the Dashboard; the public API only exposes results of *scheduled* queries. So nothing here has been
  run, and **no number in this repository comes from Stripe**.
- **The schema is not verified.** Table and column names follow Stripe's documented Sigma schema as the author knows
  it. Run `00_schema_check.sql` first. If a column differs, fix the query, not the definition.
- **The account's products need classifying.** Fill `brand_prices` in each query from the output of
  `01_product_catalog.sql` and the product map in `PRODUCT_MAP.md`.

## Privacy rules (non-negotiable)

1. Output **aggregates only**: counts, sums and rates by month, country, brand or product. Never select emails, names,
   customer, charge or subscription ids, last4, addresses or IP data. The `select` lists here contain none.
2. **Small-cell suppression.** Any group with fewer than `5` distinct customers reports `NULL` with
   `suppressed = true`. Change `k_min` only upward.
3. Results are exported **from the Dashboard by the owner**. Do not commit raw exports. A committed summary must keep
   the suppression applied.
4. These queries never write: Sigma is read-only. Nothing here changes subscriptions, prices or customers.

## Three different "countries" — never substitute one for another

| Dimension | Source | Meaning |
|---|---|---|
| `card_country` | `charges.card_country` | Country of the **card issuer** (bank). Strong signal of where the payer banks. |
| `billing_country` | `customers.address_country`, else `charges.card_address_country` | Country the customer **entered** at checkout (Stripe Checkout collects it for card payments). Self-reported. |
| visitor location | **not in Stripe** | Website analytics (GA4 `G-BRS48R8PG9`, Vercel). Joining it to payments needs the planned `client_reference_id` / metadata tagging (see `../LOCALIZATION_PLAN.md` §6). |

Reports show `card_country` and `billing_country` side by side and never merge them. A mismatch between the two is
itself a finding (cross-border cards, VPN or travel).

## Definitions

- **Successful payment:** `charges.status = 'succeeded'` and `paid`, net of nothing. Refunds are reported separately.
- **Gross volume:** the sum of `charges.amount` for successful payments, in the **charge currency's minor units / 100**.
  Never summed across currencies without conversion. The pack reports per currency, plus USD settlement via
  `balance_transactions.amount` where noted.
- **Net volume:** gross minus refunded (`charges.amount_refunded`) minus lost disputes.
- **Active paid subscription:** `subscriptions.status IN ('active','past_due')` at the snapshot time, with at least one
  paid invoice (`invoices.status = 'paid' AND amount_paid > 0`). Trials and 100%-off subscriptions are excluded and
  counted separately.
- **New subscriber (month M):** a customer whose **first paid invoice** for a brand product falls in month M.
- **MRR:** for active paid subscriptions, `price.unit_amount × quantity` normalised to one month
  (`year` ÷ 12, `week` × 52/12). Per currency.
- **Renewal / retention:** of the customers whose first paid invoice is in month M (the cohort), the share with a paid
  `subscription_cycle` invoice in month M+k. All Access is monthly, so k=1 is the first renewal.
- **Refund rate:** refunded amount ÷ gross, per currency. **Dispute rate:** disputes ÷ successful charges.
- **Failed transaction:** `charges.status = 'failed'`, by `failure_code` / `outcome_reason` (not by customer).

## Freshness

Sigma data is not real-time: Stripe documents a lag (typically a few hours; check the "data last updated" note in the
Sigma editor and record it with every export). Each query outputs `data_through` (the latest `created` it saw), and a
summary must quote it.

## Files

| File | Answers |
|---|---|
| `00_schema_check.sql` | Do the tables and columns exist? (zero rows, columns only) |
| `01_product_catalog.sql` | Every product and price with aggregate activity, to classify brands and legacy SKUs |
| `02_revenue_by_country.sql` | Monthly successful payments, gross, refunds by brand × card country × billing country × currency |
| `03_active_subscriptions.sql` | Active paid subscriptions and MRR by brand × billing country × card country |
| `04_new_subscribers.sql` | New paying customers per month by brand × billing country |
| `05_failed_payments.sql` | Failed charges by card country × failure code (payment-method fit by market) |
| `06_retention_cohorts.sql` | First-renewal and month-k retention by cohort × billing country |
| `07_focus_markets.sql` | One-page snapshot for JP, KR, ES, MX, BR, FR, DE, US (+ rest of world) |

`PRODUCT_MAP.md` lists every Stripe product, price and payment link found in the code (brand classification).
