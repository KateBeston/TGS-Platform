-- Platform members' saved (favourited) venues, keyed to auth.users.
-- Distinct from the portal's saved_venues (which is keyed to app_users).
-- Own-rows-only RLS. Applied via the Supabase connector on 2026-08-18.

create table if not exists public.profile_saved_venues (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  venue_id bigint not null references public.venues(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, venue_id)
);

alter table public.profile_saved_venues enable row level security;

drop policy if exists psv_own_select on public.profile_saved_venues;
create policy psv_own_select on public.profile_saved_venues for select to authenticated using (auth.uid() = user_id);
drop policy if exists psv_own_insert on public.profile_saved_venues;
create policy psv_own_insert on public.profile_saved_venues for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists psv_own_delete on public.profile_saved_venues;
create policy psv_own_delete on public.profile_saved_venues for delete to authenticated using (auth.uid() = user_id);

create index if not exists psv_user_idx on public.profile_saved_venues (user_id);
create index if not exists psv_venue_idx on public.profile_saved_venues (venue_id);
