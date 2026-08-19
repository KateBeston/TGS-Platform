-- VMS onboarding Pass 1: structured fields on venue_applications.
--   contact_email                 — venue communication email (separate from login)
--   venue_address jsonb           — structured (unit/street/suburb/city/state/postcode/country/lat/lng/place_id)
--   postal_address jsonb          — same shape; mirrors venue_address when postal_same_as_venue
--   postal_same_as_venue boolean  — default true
--   business_registration_number  — country-adaptive value
--   business_registration_label   — the format label recorded (ABN, EIN, NIB, …)
alter table public.venue_applications
  add column if not exists contact_email text,
  add column if not exists venue_address jsonb,
  add column if not exists postal_address jsonb,
  add column if not exists postal_same_as_venue boolean default true,
  add column if not exists business_registration_number text,
  add column if not exists business_registration_label text;
