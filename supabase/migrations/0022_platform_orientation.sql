-- One-time welcome orientation. profiles.oriented_at is null until the person
-- answers "what are you here for?" (wellness experiences → guest, retreat venue →
-- host). set_platform_orientation(kind) sets their leading audience, the flag, and
-- the matching role. It's orientation, not a lock — they can switch anytime and
-- explore both. Replaces the in-account guest/host binary radio.
alter table public.profiles add column if not exists oriented_at timestamptz;

create or replace function public.set_platform_orientation(p_kind text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
  set primary_audience = (case when p_kind = 'host' then 'host' else 'guest' end), oriented_at = now()
  where id = auth.uid();
  insert into public.account_roles (user_id, role, granted_via)
  values (auth.uid(), (case when p_kind = 'host' then 'retreat_host' else 'wellness_guest' end), 'platform')
  on conflict do nothing;
end $$;
revoke all on function public.set_platform_orientation(text) from public, anon;
grant execute on function public.set_platform_orientation(text) to authenticated;
