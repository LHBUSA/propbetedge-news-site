-- 08 LOCALIZED-PAGE CONVERSION (Global #67, measurement M1). ja/ko live since 2026-10-09 (news-site 0a24935).
-- Every tagged checkout button opens the SAME All Access Payment Link with
--   locale=<lang> & client_reference_id = pbe-<lang>-pro[-<via>]
-- where via is the sport site that sent the reader (golf, mlb, f1, soccer, ...). The tag is not personal.
-- Where the tags come from:
--   pbe-ja-pro[-via], pbe-ko-pro[-via]  /ja/pro and /ko/pro
--   pbe-es-pro-golf                     English /pro reached from Golf's Spanish pages (/pro?lang=es&via=golf)
--   pbe-es-pro-soccer                   Soccer's Spanish pages: their own checkout buttons (direct to the Payment Link)
--                                       and their network link to English /pro (/pro?lang=es&via=soccer)
--   pbe-es-pro                          English /pro?lang=es without a known via
--   (/es/pro is PREPARED, not public; once published its buttons use the same pbe-es-pro[-via] tags)
-- es tags start when the es-attribution changes deploy (owner release; not before 2026-10-10).
-- Sessions without a tag are every other surface (English /pro and the English sport sites).
-- This query counts Checkout Sessions started and completed per tag, with the subscriptions those
-- completions created that are still active or past due today. Aggregate only.
-- Run 00_schema_check.sql first: Sigma's checkout_sessions columns must match the names used here.
-- k_min = 5: below 5 completions, every count is hidden for that row.
with
tagged as (
  select
    coalesce(cs.client_reference_id, '(untagged)')                              as tag,
    case when cs.client_reference_id like 'pbe-%' then split_part(cs.client_reference_id, '-', 2) else 'en/other' end as page_lang,   -- ja | ko | es
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
