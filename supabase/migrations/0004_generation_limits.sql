-- Atomic per-user Era Card generation quota.
-- A reservation represents one distinct track generation attempt in a rolling
-- 24-hour window. The same track can be requested by both card UI hooks
-- without consuming two slots.
create table if not exists public.card_generation_reservations (
  user_id uuid not null references auth.users(id) on delete cascade,
  track_key text not null check (char_length(track_key) between 1 and 200),
  created_at timestamptz not null default now(),
  primary key (user_id, track_key)
);

create index if not exists card_generation_reservations_user_created_idx
  on public.card_generation_reservations (user_id, created_at desc);

alter table public.card_generation_reservations enable row level security;
revoke all on public.card_generation_reservations from anon, authenticated;

create or replace function public.reserve_card_generation(p_track_key text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_created_at timestamptz;
  v_count integer;
begin
  if v_user_id is null
     or p_track_key is null
     or char_length(p_track_key) < 1
     or char_length(p_track_key) > 200 then
    return false;
  end if;

  -- Serialize quota decisions for one user, preventing concurrent requests
  -- from both observing the same remaining slot.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  select created_at into v_created_at
  from public.card_generation_reservations
  where user_id = v_user_id and track_key = p_track_key;

  if v_created_at is not null and v_created_at >= now() - interval '24 hours' then
    return true;
  end if;

  select count(*) into v_count
  from public.card_generation_reservations
  where user_id = v_user_id
    and created_at >= now() - interval '24 hours';

  if v_count >= 20 then
    return false;
  end if;

  insert into public.card_generation_reservations (user_id, track_key, created_at)
  values (v_user_id, p_track_key, now())
  on conflict (user_id, track_key)
  do update set created_at = excluded.created_at;

  return true;
end;
$$;

revoke all on function public.reserve_card_generation(text) from public, anon;
grant execute on function public.reserve_card_generation(text) to authenticated;
