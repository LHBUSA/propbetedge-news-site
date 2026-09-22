-- Free Picks public-ledger integrity repair, 2026-09-22.
-- Keep the first public Dallas WNBA pick; suppress the accidental cross-day duplicate.
update public.pbe_free_pick_tracker
set
  result = 'VOID',
  result_at = coalesce(result_at, now()),
  evidence = coalesce(evidence, '{}'::jsonb) || jsonb_build_object(
    'suppressed', true,
    'duplicate_of', '74d66579-6ff0-4116-94dd-ee55d7783a9b',
    'suppressed_reason', 'duplicate_stable_identity_across_day_boundary',
    'suppressed_at', now()
  ),
  last_checked_at = now(),
  updated_at = now()
where id = '09b7c336-6a59-4778-a946-3115dd58dd4f'
  and sport = 'WNBA';

-- Belt-and-suspenders database guards. The Edge Function also deduplicates by
-- stable event/pick identity, but these indexes prevent a future regression
-- from writing a second active public receipt for the same underlying call.
create unique index if not exists pbe_free_pick_tracker_source_record_uq
on public.pbe_free_pick_tracker (sport, source_record_id)
where source_record_id is not null
  and coalesce((evidence->>'suppressed')::boolean, false) = false;

create unique index if not exists pbe_free_pick_tracker_mlb_identity_uq
on public.pbe_free_pick_tracker (
  (snapshot->>'game_date'),
  lower(coalesce(snapshot->>'mlb_player_id', source_record_id, selection)),
  upper(pick_type)
)
where sport = 'MLB'
  and snapshot->>'game_date' is not null
  and coalesce((evidence->>'suppressed')::boolean, false) = false;

create unique index if not exists pbe_free_pick_tracker_wnba_identity_uq
on public.pbe_free_pick_tracker (
  (snapshot->>'game_id'),
  lower(coalesce(snapshot->>'selected_team_id', snapshot#>>'{pick_team,team_id}', selection)),
  upper(pick_type)
)
where sport = 'WNBA'
  and snapshot->>'game_id' is not null
  and coalesce((evidence->>'suppressed')::boolean, false) = false;

create unique index if not exists pbe_free_pick_tracker_nhl_identity_uq
on public.pbe_free_pick_tracker (
  (snapshot->>'game_id'),
  upper(coalesce(snapshot->>'pick_team', selection)),
  upper(pick_type)
)
where sport = 'NHL'
  and snapshot->>'game_id' is not null
  and coalesce((evidence->>'suppressed')::boolean, false) = false;

create unique index if not exists pbe_free_pick_tracker_nfl_identity_uq
on public.pbe_free_pick_tracker (
  event_start_at,
  lower(pick_type),
  upper(selection)
)
where sport = 'NFL'
  and event_start_at is not null
  and coalesce((evidence->>'suppressed')::boolean, false) = false;

create unique index if not exists pbe_free_pick_tracker_ufc_identity_uq
on public.pbe_free_pick_tracker (
  (snapshot->>'event_date'),
  upper(pick_type),
  lower(selection),
  lower(coalesce(opponent, ''))
)
where sport = 'UFC'
  and snapshot->>'event_date' is not null
  and coalesce((evidence->>'suppressed')::boolean, false) = false;
