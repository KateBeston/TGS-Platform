-- 0024 — Settings SEO pages
-- Uses the EXISTING venue_settings taxonomy (21 settings, 5 categories) + venue_setting_links.
-- Adds editorial fields for the /settings SEO pages and a public links view.

alter table public.venue_settings
  add column if not exists tagline text,
  add column if not exists intro text,
  add column if not exists hero_image_url text,
  add column if not exists meta_title text,
  add column if not exists meta_description text,
  add column if not exists is_published boolean not null default true;

-- Public view of the venue<->setting links, filtered to published venues
-- (mirrors venue_categories_public).
create or replace view public.venue_setting_links_public as
  select vsl.venue_id, vsl.setting_id, vsl.is_primary
  from public.venue_setting_links vsl
  join public.venues v on v.id = vsl.venue_id
  where v.is_published = true;
grant select on public.venue_setting_links_public to anon, authenticated;

-- Editorial copy seeded for the six home-surfaced settings
-- (coastal, forest, desert, tropical, urban, mountain) — see app history.
