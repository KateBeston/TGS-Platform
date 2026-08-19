-- The attribution layer: every role a person holds, and how they got it.
-- One identity (auth.users) accumulates roles silently — a person can be a
-- wellness guest, a retreat host, and a venue owner at once, each with its
-- entry point. Role-specific DATA still lives in profiles / venue_owners.
create table if not exists public.account_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('wellness_guest','retreat_host','venue_owner')),
  granted_via text,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);
alter table public.account_roles enable row level security;
drop policy if exists account_roles_own_sel on public.account_roles;
create policy account_roles_own_sel on public.account_roles
  for select to authenticated using (user_id = auth.uid() or public.is_staff());
create index if not exists account_roles_role_idx on public.account_roles(role);

-- Backfill (one-off): existing platform profiles and owner links.
insert into public.account_roles (user_id, role, granted_via)
select id, case when primary_audience='host' then 'retreat_host' else 'wellness_guest' end, 'platform'
from public.profiles on conflict do nothing;
insert into public.account_roles (user_id, role, granted_via)
select user_id, 'venue_owner', 'vms' from public.venue_applications where user_id is not null on conflict do nothing;
insert into public.account_roles (user_id, role, granted_via)
select user_id, 'venue_owner', 'vms' from public.venue_owners where user_id is not null on conflict do nothing;
