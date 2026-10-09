-- 05 FAILED PAYMENTS by card country x failure reason (payment-method fit per market, e.g. issuer declines on
-- cross-border cards). Counts only; no customer-level rows. k_min = 5 distinct customers per cell.
-- Add the charge_brand CTE from 02 to restrict to PropBetEdge products.
select
  date_trunc('month', c.created)       as month,
  coalesce(c.card_country, 'unknown')  as card_country,
  coalesce(c.card_brand, 'unknown')    as card_brand,
  coalesce(c.failure_code, 'none')     as failure_code,
  coalesce(c.outcome_reason, 'none')   as outcome_reason,
  case when count(distinct c.customer_id) >= 5 then count(*) end as failed_charges,
  count(distinct c.customer_id) between 1 and 4                  as suppressed,
  max(c.created)                       as data_through
from charges c
where c.status = 'failed'
group by 1, 2, 3, 4, 5
order by month desc, failed_charges desc nulls last;
