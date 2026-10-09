-- 08 LOCALIZED-PAGE CONVERSION (Global #67, measurement M1). Live since 2026-10-09 (news-site 0a24935).
-- Each checkout button on /ja/pro and /ko/pro opens the All Access Payment Link with
--   client_reference_id = pbe-<lang>-pro[-<via>]
-- where via is the sport site that sent the reader (golf, mlb, f1, ...). The tag is not personal.
-- Sessions without a tag are every other surface (English /pro and the sport sites).
-- This query counts Checkout Sessions started and completed per tag, with the subscriptions those
-- completions created that are still active or past due today. Aggregate only.
-- Run 00_schema_check.sql first: Sigma's checkout_sessions columns must match the names used here.
-- k_min = 5: below 5 completions, every count is hidden for that row.
with
tagged as (
  select
    coalesce(cs.client_reference_id, '(untagged)')                              as tag,
    case when cs.client_reference_id like 'pbe-%' then split_part(cs.client_reference_id, '-', 2) else 'en/other' end as page_lang,
    case when cs.client_reference_id like 'pbe-%-pro-%' then split_part(cs.client_reference_id, '-', 4) else '(direct)' end as via,
    cs.id, cs.status, cs.subscription_id, cs.customer_id
  from checkout_sessions cs
  where cs.payment_link_id = 'plink_1UJCFAF3CaVzg4ORKspa47rI'   -- PropBetEdge All Access
    and cs.created >= timestamp '2026-10-09 00:00:00'
)
select
  t.page_lang,
  t.via,
  case when count_if(t.status = 'complete') >= 5 then count(*) end                                  as sessions_started,
  case when count_if(t.status = 'complete') >= 5 then count_if(t.status = 'complete') end           as sessions_completed,
  case when count_if(t.status = 'complete') >= 5 then count_if(s.status in ('active', 'past_due')) end as still_active_today,
  count_if(t.status = 'complete') between 1 and 4                                                    as suppressed
from tagged t
left join subscriptions s on s.id = t.subscription_id
group by 1, 2
order by page_lang, via;
