-- Platform user accounts (guests, hosts, owners). Keyed 1:1 to auth.users.
-- Separate from app_users (portal staff): a public sign-up creates a row here
-- but never touches app_users, so it grants no portal access.
-- Applied via the Supabase connector on 2026-08-18.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  surname text,
  display_name text,
  primary_audience text not null default 'guest' check (primary_audience in ('guest','host','owner')),
  phone text,
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists profiles_own_select on public.profiles;
create policy profiles_own_select on public.profiles for select to authenticated using (auth.uid() = id);
drop policy if exists profiles_own_insert on public.profiles;
create policy profiles_own_insert on public.profiles for insert to authenticated with check (auth.uid() = id);
drop policy if exists profiles_own_update on public.profiles;
create policy profiles_own_update on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop trigger if exists t_profiles on public.profiles;
create trigger t_profiles before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Auto-create a profile when an auth user is created, seeded from sign-up metadata.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, first_name, surname, primary_audience, marketing_opt_in)
  values (
    new.id,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'surname',
    coalesce(new.raw_user_meta_data->>'primary_audience', 'guest'),
    coalesce((new.raw_user_meta_data->>'marketing_opt_in')::boolean, false)
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
