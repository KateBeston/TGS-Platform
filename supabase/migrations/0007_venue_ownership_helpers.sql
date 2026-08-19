-- Safe ownership-scoping primitives for the VMS (SECURITY DEFINER, authenticated
-- only). owns_venue() is a reusable ownership check; my_owned_venues() returns the
-- venues the current login owns for the VMS "your venues" list.
create or replace function public.owns_venue(p_venue_id bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from venue_owners vo
    where vo.venue_id = p_venue_id and vo.user_id = auth.uid());
$$;
revoke all on function public.owns_venue(bigint) from public, anon;
grant execute on function public.owns_venue(bigint) to authenticated;

create or replace function public.my_owned_venues()
returns table (venue_id bigint, venue_name text, slug text)
language sql stable security definer set search_path = public as $$
  select v.id, v.venue_name, v.slug
  from venues v join venue_owners vo on vo.venue_id = v.id
  where vo.user_id = auth.uid();
$$;
revoke all on function public.my_owned_venues() from public, anon;
grant execute on function public.my_owned_venues() to authenticated;
