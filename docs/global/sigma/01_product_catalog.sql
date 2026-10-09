-- 01 PRODUCT CATALOG: every product/price with AGGREGATE activity (no customer data), to classify brands
-- (PropBetEdge All Access / legacy PropBetEdge sport SKUs / PropData / PropSports / other) and fill brand_prices.
-- Small counts are suppressed (k_min = 5).
with paid_lines as (
  select li.price_id, i.customer_id, i.created
  from invoice_line_items li
  join invoices i on i.id = li.invoice_id
  where i.status = 'paid' and i.amount_paid > 0
)
select
  p.id                                   as product_id,
  p.name                                 as product_name,
  pr.id                                  as price_id,
  pr.currency,
  pr.unit_amount / 100.0                 as unit_amount,
  pr.recurring_interval,
  pr.active                              as price_active,
  case when count(distinct pl.customer_id) >= 5 then count(distinct pl.customer_id) end as paying_customers_all_time,
  count(distinct pl.customer_id) between 1 and 4                                         as suppressed,
  date_trunc('month', min(pl.created))   as first_paid_month,
  date_trunc('month', max(pl.created))   as last_paid_month
from products p
join prices pr on pr.product_id = p.id
left join paid_lines pl on pl.price_id = pr.id
group by 1, 2, 3, 4, 5, 6, 7
order by last_paid_month desc nulls last, product_name;
