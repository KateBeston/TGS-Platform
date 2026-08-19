-- Platform accounts are wellness guests and retreat hosts only. Venue owners
-- are not a platform account type — they live in the Sanctum VMS.
alter table public.profiles drop constraint if exists profiles_primary_audience_check;
alter table public.profiles add constraint profiles_primary_audience_check
  check (primary_audience in ('guest','host'));
