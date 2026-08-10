'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

/* Reading an application, and turning an accepted one into a venue.
 *
 * The conversion is deliberate rather than automatic. Accepting says
 * "yes, we want them"; making the venue is a separate act that copies
 * their claims across as a starting point for a curated record. Doing it
 * on acceptance would put unverified text straight into the collection.
 */

export async function setStatus(id: number, status: string, note?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.from('venue_applications')
    .update({
      status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user?.email ?? null,
      decision_note: note ?? undefined,
    })
    .eq('id', id);

  revalidatePath('/applications');
  revalidatePath(`/applications/${id}`);
  return { error: error?.message ?? null };
}

export async function makeVenue(id: number) {
  const supabase = await createClient();

  const { data: app } = await supabase.from('venue_applications')
    .select('*').eq('id', id).single();

  if (!app) return { error: 'No such application.' };
  if (app.venue_id) return { error: 'A venue was already made from this one.' };
  if (app.status !== 'Accepted') {
    return { error: 'Accept it first. Making a venue from an unaccepted application '
                  + 'puts unverified claims into the collection.' };
  }

  // Sourced, not Live. Their words are a starting point for a curated
  // record, not the record — everything they wrote needs reading before
  // it goes anywhere near the site.
  const { data: venue, error } = await supabase.from('venues').insert({
    venue_name: app.venue_name,
    venue_status: 'Sourced',
    lead_source: 'Applied',
    contact_first_name: app.first_name,
    contact_surname: app.surname,
    contact_email: app.email,
    contact_phone: app.phone,
    website_url: app.website_url,
    instagram_url: app.instagram_url,
    facebook_url: app.facebook_url,
    venue_type_id: app.venue_type_id,
    country_id: app.country_id,
    max_guests: app.accommodation_capacity ?? app.daily_guest_capacity,
    total_bedrooms: app.total_bedrooms,
    has_access_restriction: (app.who_may_attend ?? []).some(
      (w: string) => w && !w.startsWith('Open to all')),
    access_policy_details: app.hosting_notes,
    internal_notes: `Made from application ${app.reference} on `
      + `${new Date().toLocaleDateString('en-AU')}. Everything here came from the `
      + `applicant and none of it has been checked.`,
  }).select('id').single();

  if (error || !venue) return { error: error?.message ?? 'Could not make the venue.' };

  await supabase.from('venue_applications')
    .update({ venue_id: venue.id }).eq('id', id);

  revalidatePath('/applications');
  revalidatePath(`/applications/${id}`);
  return { error: null, venueId: venue.id };
}

/** What they agreed to, and whether it is still what they agreed to. */
export async function agreements(email: string) {
  const supabase = await createClient();
  const { data } = await supabase.from('acceptance_record')
    .select('*').eq('signatory_email', email.toLowerCase())
    .order('accepted_at', { ascending: false });
  return data ?? [];
}
