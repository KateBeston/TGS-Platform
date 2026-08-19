-- Lazy platform profile for owner-first people who later browse as guests.
-- ensure_platform_profile() creates a profiles row for the current login if missing
-- (name pulled from their account) and records the wellness_guest role; no-op if a
-- profile already exists. Called from the platform sign-in action and on /account
-- load, so an owner who signs up via the VMS and later signs in on the platform gets
-- a full guest experience automatically, ending up with both roles on one identity.
create or replace function public.ensure_platform_profile()
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, first_name, surname, primary_audience, marketing_opt_in)
  select u.id, u.raw_user_meta_data->>'first_name', u.raw_user_meta_data->>'surname', 'guest', false
  from auth.users u where u.id = auth.uid()
  on conflict (id) do nothing;
  insert into public.account_roles (user_id, role, granted_via)
  values (auth.uid(), 'wellness_guest', 'platform') on conflict do nothing;
end $$;
revoke all on function public.ensure_platform_profile() from public, anon;
grant execute on function public.ensure_platform_profile() to authenticated;
