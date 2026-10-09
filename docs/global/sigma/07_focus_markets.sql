-- 07 FOCUS MARKETS snapshot (Issue #67; owner priority 2026-10-09: Japan + South Korea first wave; Spain, Mexico,
-- Brazil, France, Germany; United States baseline). Last 12 months of successful payments, both country dimensions
-- reported separately (never merged). Everything else is 'ROW'. k_min = 5.
with
brand_prices (price_id, brand) as (values ('price_1UJCF1F3CaVzg4ORSIohWTca', 'PBE All Access')),  -- add legacy and other-brand prices from PRODUCT_MAP.md
markets (cc) as (values ('JP'), ('KR'), ('ES'), ('MX'), ('BR'), ('FR'), ('DE'), ('US')),
charge_brand as (
  select c.id as charge_id,
         case when count(distinct coalesce(bp.brand, 'unclassified')) = 1 then max(coalesce(bp.brand, 'unclassified')) else 'mixed' end as brand
  from charges c
  left join invoice_line_items li on li.invoice_id = c.invoice_id
  left join prices pr on pr.id = li.price_id
  left join brand_prices bp on bp.price_id = pr.id
  group by 1
),
ok as (
  select c.customer_id, c.currency, c.amount, c.amount_refunded, c.created, c.card_country, cb.brand,
         coalesce(cu.address_country, c.card_address_country) as billing_country
  from charges c
  join charge_brand cb on cb.charge_id = c.id
  left join customers cu on cu.id = c.customer_id
  where c.status = 'succeeded' and c.paid and c.created >= date_add('month', -12, current_date)
),
by_dim as (
  select 'card_country' as dimension, case when card_country in (select cc from markets) then card_country else 'ROW' end as country,
         brand, currency, customer_id, amount, amount_refunded, created from ok
  union all
  select 'billing_country', case when billing_country in (select cc from markets) then billing_country else 'ROW' end,
         brand, currency, customer_id, amount, amount_refunded, created from ok
)
select dimension, country, brand, currency,
  case when count(distinct customer_id) >= 5 then count(distinct customer_id) end as paying_customers_12m,
  case when count(distinct customer_id) >= 5 then count(*) end                     as successful_payments_12m,
  case when count(distinct customer_id) >= 5 then sum(amount) / 100.0 end          as gross_12m,
  case when count(distinct customer_id) >= 5 then sum(amount_refunded) / 100.0 end as refunded_12m,
  count(distinct customer_id) between 1 and 4                                      as suppressed,
  max(created)                                                                     as data_through
from by_dim
group by 1, 2, 3, 4
order by dimension, brand, gross_12m desc nulls last;
