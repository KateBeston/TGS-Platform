-- VMS backbone: link a venue_owners record to a login (auth.users). Nullable so
-- Airtable-imported owner rows stay unclaimed until an owner signs up / claims
-- the venue via the List Your Venue → VMS flow. on delete set null unclaims the
-- record rather than destroying the venue's owner data.
alter table public.venue_owners
  add column if not exists user_id uuid references auth.users(id) on delete set null;
create index if not exists venue_owners_user_idx on public.venue_owners(user_id);
