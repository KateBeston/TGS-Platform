-- Members list for the internal portal. SECURITY DEFINER so it can read
-- profiles (own-row RLS) and auth.users; locked to service_role only, so it
-- is reachable from the portal's server (service key) but never from the
-- public site or an authenticated member.
-- Applied via the Supabase connector on 2026-08-18.

create or replace function public.admin_members()
returns table (
  id uuid, email text, first_name text, surname text,
  primary_audience text, marketing_opt_in boolean,
  created_at timestamptz, saved_count bigint
)
language sql security definer set search_path = public as $$
  select p.id, u.email::text, p.first_name, p.surname, p.primary_audience,
         p.marketing_opt_in, p.created_at,
         (select count(*) from profile_saved_venues sv where sv.user_id = p.id)
  from profiles p
  join auth.users u on u.id = p.id
  order by p.created_at desc;
$$;

revoke all on function public.admin_members() from public, anon, authenticated;
grant execute on function public.admin_members() to service_role;
