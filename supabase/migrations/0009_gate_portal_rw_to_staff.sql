-- SECURITY FIX: the broad portal_rw policy (USING true) on 243 base tables gave
-- EVERY authenticated user full read/write — fine when only staff logged in, but
-- guests/hosts (and future owners) authenticate against the same auth.users.
-- Gate every portal_rw policy to staff only. Public reads are unaffected (served
-- by RLS-bypassing published_* views); anon was never covered by portal_rw.
-- Authenticated non-staff keep favourites/profile via own-row RLS and read venue
-- data through the views only. Owners get DELIBERATELY SCOPED access later via the
-- VMS + a submission/review pipeline — never direct writes to live records.
do $$
declare r record;
begin
  for r in
    select n.nspname as sch, c.relname as tbl
    from pg_policy po
    join pg_class c on c.oid = po.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and po.polname = 'portal_rw'
      and pg_get_expr(po.polqual, po.polrelid) = 'true'
  loop
    execute format(
      'alter policy portal_rw on %I.%I using (public.is_staff()) with check (public.is_staff())',
      r.sch, r.tbl);
  end loop;
end $$;
