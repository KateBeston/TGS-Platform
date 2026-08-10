'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type Result = { ok: true; message?: string; id?: number } | { ok: false; error: string };

/** The pipeline, by state.
 *
 *  Each state says who is being waited on, which is the only thing that
 *  makes a list of enquiries workable. */
export async function pipeline() {
  const supabase = await createClient();
  const { data } = await supabase.from('concierge_pipeline').select('*');
  return data ?? [];
}

export async function enquiriesIn(status: string, kind?: string) {
  const supabase = await createClient();

  let q = supabase.from('enquiries')
    .select('*, countries(name), venues(venue_name), host_types(name)')
    .eq('status', status)
    .order('response_due', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(100);

  if (kind) q = q.eq('enquiry_type', kind);

  const { data } = await q;
  return data ?? [];
}

export async function enquiry(id: number) {
  const supabase = await createClient();

  const [{ data: e }, { data: shortlist }, { data: offMarket }] = await Promise.all([
    supabase.from('enquiries')
      .select('*, countries(name), cities(name), host_types(name), '
            + 'modality_categories(name), retreat_outcomes(name), '
            + 'retreat_audiences(name), retreat_formats(name)')
      .eq('id', id).maybeSingle(),
    supabase.from('enquiry_venues')
      .select('*, venues(id,venue_name,logo_url,max_guests,cities(name),countries(name))')
      .eq('enquiry_id', id).order('rank', { nullsFirst: false }),
    supabase.from('off_market_finds')
      .select('*').eq('enquiry_id', id).order('created_at'),
  ]);

  if (!e) return null;
  return {
    ...(e as Record<string, any>),
    shortlist: shortlist ?? [],
    offMarket: offMarket ?? [],
  } as Record<string, any>;
}

/** Starts one. Wellness and retreat are different searches from the
 *  first question, so the kind is chosen before anything else. */
export async function startEnquiry(kind: 'Retreat Host' | 'Wellness Guest'): Promise<Result> {
  const supabase = await createClient();

  const { data, error } = await supabase.from('enquiries').insert({
    enquiry_type: kind,
    status: 'Draft',
    step: 'Who is asking',
    source: 'Concierge',
  }).select('id').single();

  if (error) return { ok: false, error: error.message };
  revalidatePath('/concierge');
  return { ok: true, id: data.id };
}

const EDITABLE = new Set([
  'first_name','surname','email','phone','host_type_id','host_type_other',
  'category_id','practice_id','outcome_id','audience_id','format_id',
  'venue_type_id','hire_type_id','service_id',
  'continent_id','country_id','city_id','destination_notes',
  'date_from','date_to','dates_flexible','nights','guest_count',
  'bedrooms_required','required_spaces','setting_preference',
  'budget_band','budget_amount','currency','estimated_value',
  'notes','has_access_needs','access_needs_note','assigned_to',
  'response_due','step','searching_off_market','off_market_note',
  'party_composition','visit_type','duration_minutes','session_count',
]);

export async function saveEnquiry(
  id: number, column: string, value: unknown
): Promise<Result> {
  if (!EDITABLE.has(column)) {
    return { ok: false, error: `"${column}" is not editable here.` };
  }
  const supabase = await createClient();
  const { error } = await supabase.from('enquiries')
    .update({ [column]: value }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/concierge/${id}`);
  return { ok: true };
}

/** Moves it along, and records when.
 *
 *  Each move sets the timestamp that state is measured from — an enquiry
 *  sitting with a host for three weeks should be visible as that rather
 *  than as an old enquiry. */
export async function moveTo(
  id: number, status: string, note?: string
): Promise<Result> {
  const supabase = await createClient();

  const patch: Record<string, unknown> = { status };
  if (status === 'With the host') patch.presented_at = new Date().toISOString();
  if (status === 'Accepted') patch.accepted_at = new Date().toISOString();
  if (status === 'Looking further afield') patch.searching_off_market = true;
  if (note) patch.notes = note;

  // A response is due where somebody else now holds it.
  if (['With the host', 'With the venue'].includes(status)) {
    const days = status === 'With the host' ? 7 : 2;
    patch.response_due = new Date(Date.now() + days * 86_400_000).toISOString();
  }

  const { error } = await supabase.from('enquiries').update(patch).eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/concierge');
  revalidatePath(`/concierge/${id}`);
  return { ok: true, message: `Moved to ${status.toLowerCase()}.` };
}

/** Adds a venue to the shortlist. */
export async function shortlist(
  enquiryId: number, venueId: number, why?: string
): Promise<Result> {
  const supabase = await createClient();

  const { data: last } = await supabase.from('enquiry_venues')
    .select('rank').eq('enquiry_id', enquiryId)
    .order('rank', { ascending: false }).limit(1).maybeSingle();

  const { error } = await supabase.from('enquiry_venues').insert({
    enquiry_id: enquiryId,
    venue_id: venueId,
    rank: (last?.rank ?? 0) + 1,
    // Candidate, which is the word the constraint uses.
    match_status: 'Candidate',
    why_this_venue: why ?? null,
  });

  if (error) {
    return { ok: false, error: /duplicate/i.test(error.message)
      ? 'That one is already on the list.' : error.message };
  }

  revalidatePath(`/concierge/${enquiryId}`);
  return { ok: true };
}

export async function unshortlist(id: number, enquiryId: number): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('enquiry_venues').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/concierge/${enquiryId}`);
  return { ok: true };
}

export async function saveShortlisted(
  id: number, column: string, value: unknown, enquiryId: number
): Promise<Result> {
  const allowed = new Set([
    'rank','match_status','why_this_venue','quoted_amount','currency',
    'quote_valid_until','availability_note','decline_reason','notes',
    'proposal_included',
  ]);
  if (!allowed.has(column)) return { ok: false, error: `"${column}" is not editable.` };

  const supabase = await createClient();
  const { error } = await supabase.from('enquiry_venues')
    .update({ [column]: value }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/concierge/${enquiryId}`);
  return { ok: true };
}

/** Records a venue found outside the collection.
 *
 *  A place found for one host is not yet a listing, so it lives apart
 *  from venues until somebody says it is worth having. */
export async function addOffMarket(
  enquiryId: number, name: string, url?: string, where?: string
): Promise<Result> {
  if (!name.trim()) return { ok: false, error: 'It needs a name.' };

  const supabase = await createClient();
  const { error } = await supabase.from('off_market_finds').insert({
    enquiry_id: enquiryId,
    name: name.trim(),
    website_url: url?.trim() || null,
    where_it_is: where?.trim() || null,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/concierge/${enquiryId}`);
  return { ok: true };
}

export async function saveOffMarket(
  id: number, column: string, value: unknown, enquiryId: number
): Promise<Result> {
  const allowed = new Set([
    'name','website_url','where_it_is','found_how','contacted_at','replied_at',
    'quoted_amount','currency','outcome','notes','worth_listing','country_id',
  ]);
  if (!allowed.has(column)) return { ok: false, error: `"${column}" is not editable.` };

  const supabase = await createClient();
  const { error } = await supabase.from('off_market_finds')
    .update({ [column]: value }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/concierge/${enquiryId}`);
  return { ok: true };
}

/** Hosts and guests already on record.
 *
 *  Somebody rings and is usually already here. Searching first is faster
 *  than typing their details again, and it keeps their history in one
 *  place rather than in two records that disagree. */
export async function findPeople(search: string, kind: 'host' | 'guest') {
  const supabase = await createClient();
  const term = search.trim();
  const table = kind === 'host' ? 'retreat_hosts' : 'wellness_guests';

  let q = supabase.from(table)
    .select(kind === 'host'
      ? 'id,first_name,surname,business_name,email,phone,host_type,countries(name)'
      : 'id,first_name,surname,email,guest_code')
    .order('surname').limit(20);

  if (term) {
    q = q.or(
      `first_name.ilike.%${term}%,surname.ilike.%${term}%,email.ilike.%${term}%`
      + (kind === 'host' ? `,business_name.ilike.%${term}%` : ''));
  }

  const { data } = await q;
  return data ?? [];
}

/** Everything one person has asked for or booked. */
export async function historyFor(
  kind: 'host' | 'guest', personId: number
) {
  const supabase = await createClient();
  const column = kind === 'host' ? 'retreat_host_id' : 'wellness_guest_id';

  const { data } = await supabase.from('person_history')
    .select('*').eq(column, personId)
    .order('created_at', { ascending: false });

  return data ?? [];
}

/** Ties an enquiry to somebody already on record. */
export async function attachPerson(
  enquiryId: number, kind: 'host' | 'guest', personId: number
): Promise<Result> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('attach_enquiry_to_person', {
    p_enquiry_id: enquiryId,
    p_retreat_host_id: kind === 'host' ? personId : null,
    p_wellness_guest_id: kind === 'guest' ? personId : null,
  });

  if (error) return { ok: false, error: error.message };
  if (data?.ok === false) return { ok: false, error: data.why };

  revalidatePath(`/concierge/${enquiryId}`);
  return {
    ok: true,
    message: data.their_history > 0
      ? `${data.who} — ${data.their_history} previous with us.`
      : `${data.who}, new to us.`,
  };
}

/** Records somebody who is not here yet, and ties the enquiry to them.
 *
 *  Created from what the enquiry already knows, so nothing is typed
 *  twice. */
export async function createPersonFrom(
  enquiryId: number, kind: 'host' | 'guest'
): Promise<Result> {
  const supabase = await createClient();

  const { data: e } = await supabase.from('enquiries')
    .select('first_name,surname,email,phone,country_id,host_type_id')
    .eq('id', enquiryId).single();

  if (!e?.first_name && !e?.email) {
    return { ok: false, error: 'Fill in a name or an email first.' };
  }

  const table = kind === 'host' ? 'retreat_hosts' : 'wellness_guests';
  const row: Record<string, unknown> = {
    first_name: e.first_name,
    surname: e.surname,
    email: e.email,
    // Lead, which is what the constraint allows and what somebody who has
    // asked once actually is.
    status: 'Lead',
  };
  if (kind === 'host') {
    row.phone = e.phone;
    row.country_id = e.country_id;
    row.lead_source = 'Concierge';
  }

  const { data: person, error } = await supabase.from(table)
    .insert(row).select('id').single();

  if (error) {
    return { ok: false, error: /duplicate/i.test(error.message)
      ? 'Somebody with that email is already on record — search for them instead.'
      : error.message };
  }

  return attachPerson(enquiryId, kind, person.id);
}

/** Starts an enquiry against somebody already on record.
 *
 *  The other door: from their profile rather than from the pipeline. */
export async function startEnquiryFor(
  kind: 'host' | 'guest', personId: number
): Promise<Result> {
  const supabase = await createClient();

  const { data, error } = await supabase.from('enquiries').insert({
    enquiry_type: kind === 'host' ? 'Retreat Host' : 'Wellness Guest',
    status: 'Draft',
    step: 'What they want',
    source: 'Concierge',
    retreat_host_id: kind === 'host' ? personId : null,
    wellness_guest_id: kind === 'guest' ? personId : null,
  }).select('id').single();

  if (error) return { ok: false, error: error.message };

  // Their details brought across, so step one is already answered.
  await supabase.rpc('attach_enquiry_to_person', {
    p_enquiry_id: data.id,
    p_retreat_host_id: kind === 'host' ? personId : null,
    p_wellness_guest_id: kind === 'guest' ? personId : null,
  });

  return { ok: true, id: data.id };
}

/** Whether a contact is also a host or a guest.
 *
 *  Contacts is the parent record and the two roles hang off it, so a
 *  contact may be either, both, or neither. */
export async function rolesFor(contactId: number) {
  const supabase = await createClient();

  const [{ data: host }, { data: guest }] = await Promise.all([
    supabase.from('retreat_hosts').select('id,first_name,surname')
      .eq('contact_id', contactId).maybeSingle(),
    supabase.from('wellness_guests').select('id,first_name,surname')
      .eq('contact_id', contactId).maybeSingle(),
  ]);

  return { host: host ?? null, guest: guest ?? null };
}

/** Everything a contact has asked for or booked, whichever role. */
export async function contactHistory(contactId: number) {
  const roles = await rolesFor(contactId);
  const supabase = await createClient();

  const parts = await Promise.all([
    roles.host
      ? supabase.from('person_history').select('*')
          .eq('retreat_host_id', roles.host.id)
      : Promise.resolve({ data: [] }),
    roles.guest
      ? supabase.from('person_history').select('*')
          .eq('wellness_guest_id', roles.guest.id)
      : Promise.resolve({ data: [] }),
  ]);

  return [...(parts[0].data ?? []), ...(parts[1].data ?? [])]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}
