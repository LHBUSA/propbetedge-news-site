-- 04 NEW PAYING SUBSCRIBERS per month: customers whose FIRST paid invoice for a brand falls in that month. k_min = 5.
with
brand_prices (price_id, brand) as (values ('price_1UJCF1F3CaVzg4ORSIohWTca', 'PBE All Access')),  -- add legacy and other-brand prices from PRODUCT_MAP.md
paid_lines as (
  select i.customer_id, i.created, i.charge_id, coalesce(bp.brand, 'unclassified') as brand
  from invoices i
  join invoice_line_items li on li.invoice_id = i.id
  join prices pr on pr.id = li.price_id
  left join brand_prices bp on bp.price_id = pr.id
  where i.status = 'paid' and i.amount_paid > 0
),
firsts as (
  select brand, customer_id, min(created) as first_paid_at, min_by(charge_id, created) as first_charge_id
  from paid_lines group by 1, 2
)
select
  date_trunc('month', f.first_paid_at)                             as month,
  f.brand,
  coalesce(cu.address_country, ch.card_address_country, 'unknown') as billing_country,
  coalesce(ch.card_country, 'unknown')                             as card_country,
  case when count(*) >= 5 then count(*) end                        as new_paying_customers,
  count(*) between 1 and 4                                         as suppressed
from firsts f
left join customers cu on cu.id = f.customer_id
left join charges ch on ch.id = f.first_charge_id
group by 1, 2, 3, 4
order by month desc, brand, new_paying_customers desc nulls last;
