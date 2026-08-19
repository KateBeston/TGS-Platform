-- Records a venue owner's typed-name acceptance of the concierge-period document
-- set (applies_during Interim or Both) against the CURRENT version of each, with a
-- SHA-256 of the exact wording, IP, timestamp and user agent. Definer because
-- owners can't write legal_acceptances directly; verifies the application is theirs.
create or replace function public.record_vms_onboarding_acceptances(
  p_application_id bigint, p_signed_name text, p_ip text, p_user_agent text
) returns integer language plpgsql security definer set search_path = public as $$
declare v_email text; v_venue text; n int := 0; r record;
begin
  select email, venue_name into v_email, v_venue
  from venue_applications where id = p_application_id and user_id = auth.uid();
  if not found then raise exception 'Application not found for this account'; end if;
  for r in
    select ver.id as version_id, ver.version_label, ver.effective_from, ver.body
    from legal_document_versions ver
    join legal_documents d on d.id = ver.legal_document_id
    where ver.is_current = true and ver.applies_during in ('Both','Interim')
      and d.document_type = 'Venue' and d.requires_acceptance = true
  loop
    insert into legal_acceptances (
      version_id, accepted_at, signatory_name, signatory_email, party_type,
      venue_name, source, ip_address, user_agent, body_sha256, body_length,
      version_label_at_acceptance, effective_from_at_acceptance, notes
    ) values (
      r.version_id, now(), p_signed_name, v_email, 'venue_owner',
      v_venue, 'vms', p_ip, p_user_agent,
      encode(extensions.digest(coalesce(r.body,''), 'sha256'), 'hex'),
      length(coalesce(r.body,'')),
      r.version_label, r.effective_from,
      'VMS onboarding · application #' || p_application_id
    );
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.record_vms_onboarding_acceptances(bigint, text, text, text) from public, anon;
grant execute on function public.record_vms_onboarding_acceptances(bigint, text, text, text) to authenticated;
