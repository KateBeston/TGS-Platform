-- Members list for the internal portal. SECURITY DEFINER so it can read
-- profiles (own-row RLS) and auth.users; gated inside the function with
-- has_area('contacts') and granted to authenticated, so the portal reads it
-- with the normal signed-in client (consistent with the portal's has_area
-- model) — never the public site or a member.
-- Applied via the Supabase connector on 2026-08-18.

create or replace function public.admin_members()
returns table (
  id uuid, email text, first_name text, surname text,
  primary_audience text, marketing_opt_in boolean,
  created_at timestamptz, saved_count bigint
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_area('contacts') then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  return query
    select p.id, u.email::text, p.first_name, p.surname, p.primary_audience,
           p.marketing_opt_in, p.created_at,
           (select count(*) from profile_saved_venues sv where sv.user_id = p.id)
    from profiles p
    join auth.users u on u.id = p.id
    order by p.created_at desc;
end $$;

revoke all on function public.admin_members() from public, anon, service_role;
grant execute on function public.admin_members() to authenticated;
