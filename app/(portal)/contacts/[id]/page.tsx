import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ContactRecord from '@/components/ContactRecord';
import ContactEnquiries from '@/components/ContactEnquiries';
import { contactHistory, rolesFor } from '@/app/actions/concierge';
import { searchOptions } from '@/app/actions/search';

export const dynamic = 'force-dynamic';

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // The other door into the concierge — starting from somebody's profile
  // carries their details across rather than asking again.
  const [roles, history] = await Promise.all([
    rolesFor(Number(id)), contactHistory(Number(id)),
  ]);
  const contactId = Number(id);
  const supabase = await createClient();

  const { data: contact } = await supabase
    .from('contacts').select('*').eq('id', contactId).single();
  if (!contact) notFound();

  const [
    { data: roleTypes }, { data: myRoles }, { data: tags }, { data: myTags },
    { data: countries }, { data: contactVenues },
  ] = await Promise.all([
    supabase.from('contact_role_types').select('id,role_key,label,division')
      .eq('is_active', true).order('display_order'),
    supabase.from('contact_roles').select('role_id').eq('contact_id', contactId),
    supabase.from('contact_tags').select('id,name,tag_group,is_derived')
      .eq('is_active', true).order('tag_group').order('name'),
    supabase.from('contact_tag_assignments').select('tag_id').eq('contact_id', contactId),
    supabase.from('countries').select('id,name').order('name'),
    supabase.from('contact_venues').select('*, venues(id,venue_name)')
      .eq('contact_id', contactId).order('created_at', { ascending: false }),
  ]);

  const opts = await searchOptions();

  return (
    <div className="content"><div className="wrap">
      <div className="tb-crumb" style={{ marginBottom: 'var(--s4)' }}>
        <Link href="/contacts">Contacts</Link> ·{' '}
        {[contact.first_name, contact.surname].filter(Boolean).join(' ') ||
          contact.organisation || 'Unnamed'}
      </div>

      <ContactRecord
        contact={contact}
        roleTypes={roleTypes ?? []}
        myRoleIds={(myRoles ?? []).map((r: any) => r.role_id)}
        tags={tags ?? []}
        myTagIds={(myTags ?? []).map((t: any) => t.tag_id)}
        countries={countries ?? []}
        contactVenues={contactVenues ?? []}
        searchOpts={opts}
      />

      <ContactEnquiries roles={roles} history={history} />
    </div></div>
  );
}
