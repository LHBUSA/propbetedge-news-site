-- 02 REVENUE BY COUNTRY, monthly. Successful payments, gross, refunded, per CHARGE CURRENCY (never summed across
-- currencies). card_country (issuer) and billing_country (customer-entered) are separate dimensions. k_min = 5.
with
brand_prices (price_id, brand) as (values ('price_1UJCF1F3CaVzg4ORSIohWTca', 'PBE All Access')),  -- add legacy and other-brand prices from PRODUCT_MAP.md
charge_brand as (
  -- a charge's brand = the brand of the products on its invoice ('mixed' if an invoice spans brands)
  select c.id as charge_id,
         case when count(distinct coalesce(bp.brand, 'unclassified')) = 1 then max(coalesce(bp.brand, 'unclassified')) else 'mixed' end as brand
  from charges c
  left join invoice_line_items li on li.invoice_id = c.invoice_id
  left join prices pr on pr.id = li.price_id
  left join brand_prices bp on bp.price_id = pr.id
  group by 1
)
select
  date_trunc('month', c.created)                                  as month,
  cb.brand,
  coalesce(c.card_country, 'unknown')                             as card_country,
  coalesce(cu.address_country, c.card_address_country, 'unknown') as billing_country,
  c.currency,
  case when count(distinct c.customer_id) >= 5 then count(*) end                       as successful_payments,
  case when count(distinct c.customer_id) >= 5 then count(distinct c.customer_id) end  as paying_customers,
  case when count(distinct c.customer_id) >= 5 then sum(c.amount) / 100.0 end          as gross,
  case when count(distinct c.customer_id) >= 5 then sum(c.amount_refunded) / 100.0 end as refunded,
  count(distinct c.customer_id) between 1 and 4                                        as suppressed,
  max(c.created)                                                  as data_through
from charges c
join charge_brand cb on cb.charge_id = c.id
left join customers cu on cu.id = c.customer_id
where c.status = 'succeeded' and c.paid
group by 1, 2, 3, 4, 5
order by month desc, brand, gross desc nulls last;
