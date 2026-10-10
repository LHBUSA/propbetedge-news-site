-- 06 RETENTION COHORTS: of the customers whose first paid brand invoice is in month M (cohort), the share with a paid
-- renewal invoice (billing_reason = 'subscription_cycle') k months later. Monthly All Access: k=1 = first renewal.
-- Read renewed_m1 only for cohorts at least one full month old. k_min = 5.
with
brand_prices (price_id, brand) as (values ('price_1UJCF1F3CaVzg4ORSIohWTca', 'PBE All Access')),  -- add legacy and other-brand prices from PRODUCT_MAP.md
paid as (
  select i.customer_id, i.date as created, i.billing_reason, i.charge_id, coalesce(bp.brand, 'unclassified') as brand
  from invoices i
  join invoice_line_items li on li.invoice_id = i.id
  join prices pr on pr.id = li.price_id
  left join brand_prices bp on bp.price_id = pr.id
  where i.status = 'paid' and i.amount_paid > 0
),
cohort as (
  select brand, customer_id, date_trunc('month', min(created)) as cohort_month, min_by(charge_id, created) as first_charge_id
  from paid group by 1, 2
),
renewals as (
  select c.brand, c.customer_id, date_diff('month', c.cohort_month, date_trunc('month', p.created)) as k
  from cohort c
  join paid p on p.customer_id = c.customer_id and p.brand = c.brand and p.billing_reason = 'subscription_cycle'
)
select
  c.cohort_month,
  c.brand,
  coalesce(cu.address_country, ch.card_address_country, 'unknown') as billing_country,
  case when count(distinct c.customer_id) >= 5 then count(distinct c.customer_id) end as cohort_size,
  case when count(distinct c.customer_id) >= 5 then 1.0 * count(distinct case when r.k = 1 then r.customer_id end) / count(distinct c.customer_id) end as renewed_m1,
  case when count(distinct c.customer_id) >= 5 then 1.0 * count(distinct case when r.k = 2 then r.customer_id end) / count(distinct c.customer_id) end as active_m2,
  case when count(distinct c.customer_id) >= 5 then 1.0 * count(distinct case when r.k = 3 then r.customer_id end) / count(distinct c.customer_id) end as active_m3,
  count(distinct c.customer_id) between 1 and 4 as suppressed
from cohort c
left join renewals r on r.customer_id = c.customer_id and r.brand = c.brand
left join customers cu on cu.id = c.customer_id
left join charges ch on ch.id = c.first_charge_id
group by 1, 2, 3
order by cohort_month desc, brand, cohort_size desc nulls last;
