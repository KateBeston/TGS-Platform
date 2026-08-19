-- Make every document in the VMS onboarding acceptance set publicly readable, so a
-- signatory can read what they sign at /legal/[slug]. Venue docs stay OFF the main
-- legal tabs (on_legal_page=false) per the existing pattern — readable + listed in
-- the legal-page index, not tabs.
--   • Media Permission (14): is_public = true (was hidden).
--   • Photo & Content Licence (60): is_published = true (was unpublished).
--   • Venue Owner Subscription Terms (58): applies_during = 'Both' — it now covers the
--     intro period from onboarding, so it must be readable during the concierge phase
--     too (was 'Subscription', which the public_legal_documents phase filter excluded).
-- Portal legal section needs no change: it reads all legal_documents directly, so both
-- Media Permission (now Current v1) and Subscription Terms (v2) already appear there.
update public.legal_documents set is_public = true, updated_at = now() where id = 14;
update public.legal_documents set is_published = true, updated_at = now() where id = 60;
update public.legal_documents set applies_during = 'Both', updated_at = now() where id = 58;
