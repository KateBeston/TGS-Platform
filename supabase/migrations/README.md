# Supabase migrations — platform user accounts

These files are the SQL for the platform's user-account layer, applied to the
shared Supabase project (qvriwjipnradsbilepyd) via the Supabase connector.
They are kept here so the schema is version-controlled and reproducible.

- **0001_platform_profiles_auth.sql** — `profiles` table (1:1 with auth.users),
  RLS (own-row only), and the trigger that auto-creates a profile on sign-up.
- **0002_profile_saved_venues.sql** — `profile_saved_venues` (favourites),
  own-row RLS, indexes.

Each file is idempotent (safe to re-run). `profiles` and `profile_saved_venues`
are separate from the portal's `app_users` and `saved_venues`.
