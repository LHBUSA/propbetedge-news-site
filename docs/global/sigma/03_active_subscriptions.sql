-- 03 ACTIVE PAID SUBSCRIPTIONS + MRR at query time, by brand x billing country x card country (card of the latest paid
-- invoice's charge). Excludes trials and never-paid subscriptions (README definitions). Per currency. k_min = 5.
with
brand_prices (price_id, brand) as (values ('price_1UJCF1F3CaVzg4ORSIohWTca', 'PBE All Access')),  -- add legacy and other-brand prices from PRODUCT_MAP.md
paid as (
  select i.subscription_id, max_by(i.charge_id, i.created) as last_charge_id
  from invoices i
  where i.status = 'paid' and i.amount_paid > 0 and i.subscription_id is not null
  group by 1
),
active as (
  select s.id, s.customer_id, si.quantity, pr.unit_amount, pr.currency, pr.recurring_interval, pr.recurring_interval_count,
         coalesce(bp.brand, 'unclassified') as brand, p.last_charge_id
  from subscriptions s
  join paid p on p.subscription_id = s.id
  join subscription_items si on si.subscription_id = s.id
  join prices pr on pr.id = si.price_id
  left join brand_prices bp on bp.price_id = pr.id
  where s.status in ('active', 'past_due')
)
select
  a.brand,
  coalesce(cu.address_country, ch.card_address_country, 'unknown') as billing_country,
  coalesce(ch.card_country, 'unknown')                             as card_country,
  a.currency,
  case when count(distinct a.customer_id) >= 5 then count(distinct a.id) end as active_paid_subscriptions,
  case when count(distinct a.customer_id) >= 5 then sum(
    a.unit_amount * a.quantity / 100.0 *
    case a.recurring_interval when 'month' then 1.0 / a.recurring_interval_count
                              when 'year'  then 1.0 / (12 * a.recurring_interval_count)
                              when 'week'  then 52.0 / 12 / a.recurring_interval_count
                              when 'day'   then 365.0 / 12 / a.recurring_interval_count end) end as mrr,
  count(distinct a.customer_id) between 1 and 4                     as suppressed
from active a
left join customers cu on cu.id = a.customer_id
left join charges ch on ch.id = a.last_charge_id
group by 1, 2, 3, 4
order by brand, mrr desc nulls last;
