-- Engaging with the VMS is what makes someone a venue owner (not a venue
-- submission). The VMS entry calls this after a successful sign-up OR sign-in,
-- so an existing platform guest who comes in via the VMS is attributed as an
-- owner immediately. No parameters, so it can't grant other roles.
create or replace function public.grant_vms_owner_role()
returns void language sql security definer set search_path = public as $$
  insert into public.account_roles (user_id, role, granted_via)
  values (auth.uid(), 'venue_owner', 'vms')
  on conflict do nothing;
$$;
revoke all on function public.grant_vms_owner_role() from public, anon;
grant execute on function public.grant_vms_owner_role() to authenticated;
