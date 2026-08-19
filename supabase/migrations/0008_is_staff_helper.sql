-- Is the current login an active staff member (portal app_user)? Used to gate
-- the broad portal_rw policies to staff only.
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from app_users u
    where u.auth_user_id = auth.uid()
      and coalesce(u.status, 'Active') = 'Active'
  );
$$;
revoke all on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated;
