-- The concierge document set (metadata only) for display in the VMS agreement
-- step. Definer so an owner can read the list without staff access to the register.
create or replace function public.get_vms_onboarding_documents()
returns table (name text, slug text, version_label text, is_public boolean)
language sql stable security definer set search_path = public as $$
  select d.name, d.slug, ver.version_label, coalesce(d.is_public, false)
  from legal_document_versions ver
  join legal_documents d on d.id = ver.legal_document_id
  where ver.is_current = true and ver.applies_during in ('Both','Interim')
    and d.document_type = 'Venue' and d.requires_acceptance = true
  order by d.name;
$$;
revoke all on function public.get_vms_onboarding_documents() from public, anon;
grant execute on function public.get_vms_onboarding_documents() to authenticated;
