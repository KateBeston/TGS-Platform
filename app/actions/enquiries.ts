'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type Result = { ok: true; message?: string; id?: number } | { ok: false; error: string };

const ENQUIRY_COLUMNS = new Set([
  'enquiry_type','first_name','surname','email','phone',
  'continent_id','country_id','city_id','destination_notes',
  'category_id','practice_id','outcome_id','hire_type_id','venue_type_id',
  'date_from','date_to','dates_flexible','nights','guest_count','bedrooms_required',
  'budget_band','budget_amount','currency','setting_preference','required_spaces',
  'notes','source','source_page','status','outcome_result','lost_reason',
  'assigned_to','response_due','estimated_value','venue_id',
  'origin_country_id','origin_city_id','origin_postcode','is_international',
  'service_id','package_id','duration_minutes','session_count',
  'visit_type','party_composition',
]);

function humanise(m: string) {
  if (/violates check constraint.*status/i.test(m))
    return 'Status must be New, In Progress, Presented, Won, Lost, No Response or Spam.';
  if (/violates check constraint.*enquiry_type/i.test(m))
    return 'Type must be Retreat Host, Wellness Guest, Venue or General.';
  return m;
}

export async function createEnquiry(formData: FormData) {
  const type = String(formData.get('enquiry_type') ?? 'Retreat Host');
  const first = String(formData.get('first_name') ?? '').trim();
  const surname = String(formData.get('surname') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();

  if (!first && !surname && !email) return { error: 'A name or email is required.' };

  const supabase = await createClient();
  const { data, error } = await supabase.from('enquiries').insert({
    enquiry_type: type,
    first_name: first || null,
    surname: surname || null,
    email: email || null,
    status: 'New',
    source: 'Portal',
  }).select('id').single();

  if (error) return { error: humanise(error.message) };
  redirect(`/enquiries/${data.id}`);
}

export async function saveEnquiryField(
  enquiryId: number, column: string, value: unknown
): Promise<Result> {
  if (!ENQUIRY_COLUMNS.has(column)) {
    return { ok: false, error: `"${column}" is not editable on an enquiry.` };
  }

  const supabase = await createClient();

  // Moving to Presented stamps when it happened, so response time can be
  // measured rather than estimated. It is the number that tells you whether
  // concierge is actually working.
  const extra = column === 'status' && value === 'Presented'
    ? { responded_at: new Date().toISOString() } : {};

  const { error } = await supabase.from('enquiries')
    .update({ [column]: value, ...extra }).eq('id', enquiryId);

  if (error) return { ok: false, error: humanise(error.message) };
  revalidatePath(`/enquiries/${enquiryId}`);
  revalidatePath('/enquiries');
  return { ok: true };
}

/* ── shortlist ───────────────────────────────────────────────────── */

const MATCH_COLUMNS = new Set([
  'match_status','rank','quoted_amount','currency','quote_valid_until',
  'why_this_venue','decline_reason','declined_by','notes',
]);

export async function addToShortlist(enquiryId: number, venueId: number): Promise<Result> {
  const supabase = await createClient();

  const { count } = await supabase.from('enquiry_venues')
    .select('*', { count: 'exact', head: true }).eq('enquiry_id', enquiryId);

  const { error } = await supabase.from('enquiry_venues').insert({
    enquiry_id: enquiryId, venue_id: venueId,
    match_status: 'Shortlisted', rank: (count ?? 0) + 1,
  });

  if (error) {
    if (/duplicate/i.test(error.message)) return { ok: false, error: 'Already on the shortlist.' };
    return { ok: false, error: humanise(error.message) };
  }
  revalidatePath(`/enquiries/${enquiryId}`);
  return { ok: true };
}

export async function saveMatchField(
  matchId: number, enquiryId: number, column: string, value: unknown
): Promise<Result> {
  if (!MATCH_COLUMNS.has(column)) {
    return { ok: false, error: `"${column}" is not editable on a match.` };
  }

  const supabase = await createClient();
  const extra = column === 'match_status' && value === 'Approached'
    ? { approached_at: new Date().toISOString() } : {};

  const { error } = await supabase.from('enquiry_venues')
    .update({ [column]: value, ...extra }).eq('id', matchId);

  if (error) return { ok: false, error: humanise(error.message) };
  revalidatePath(`/enquiries/${enquiryId}`);
  return { ok: true };
}

export async function removeFromShortlist(matchId: number, enquiryId: number): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('enquiry_venues').delete().eq('id', matchId);
  if (error) return { ok: false, error: humanise(error.message) };
  revalidatePath(`/enquiries/${enquiryId}`);
  return { ok: true };
}

/** Venue search scoped to the enquiry. Filters by whatever the enquiry
 *  actually specifies, so the shortlist starts from the requirement rather
 *  than from the whole catalogue. */
export async function searchForEnquiry(
  enquiryId: number, q: string, useFilters: boolean
) {
  const supabase = await createClient();

  const { data: e } = await supabase
    .from('enquiries').select('country_id,guest_count,venue_type_id').eq('id', enquiryId).single();

  let query = supabase.from('venue_list')
    .select('id,venue_name,country_name,city_name,venue_type_name,max_guests,price_from,tier_name')
    .order('venue_name').limit(25);

  if (q.trim()) query = query.ilike('venue_name', `%${q.trim()}%`);

  if (useFilters && e) {
    if (e.country_id) query = query.eq('country_id', e.country_id);
    if (e.venue_type_id) query = query.eq('venue_type_id', e.venue_type_id);
    // A venue that cannot hold the group is not a candidate, but one with
    // no recorded capacity might be — so nulls are kept rather than excluded.
    if (e.guest_count) query = query.or(`max_guests.gte.${e.guest_count},max_guests.is.null`);
  }

  const { data } = await query;
  return data ?? [];
}

/** Records a search that returned nothing. This is supply-gap data — what
 *  was asked for and did not exist — and it is the thing no competitor can
 *  see, because it only exists in the moment an enquiry fails to match. */
export async function logZeroResult(
  term: string, filterKey: string | null, filterValue: string | null
): Promise<Result> {
  const supabase = await createClient();

  const { data: period } = await supabase
    .from('analytics_periods').select('id').order('period_start', { ascending: false })
    .limit(1).maybeSingle();

  const { error } = await supabase.from('analytics_search_terms').insert({
    period_id: period?.id ?? null,
    term, filter_key: filterKey, filter_value: filterValue,
    searches: 1, results_zero: 1,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/* ── requirements ────────────────────────────────────────────────── */

const REQ_COLUMNS = new Set([
  'requirement_type_id','requirement','detail','is_essential',
  'is_met','met_by_venue_id','met_notes','unmet_reason','display_order',
]);

export async function addRequirement(
  enquiryId: number, requirement: string, typeId: number | null, isEssential: boolean
): Promise<Result> {
  const text = requirement.trim();
  if (!text) return { ok: false, error: 'Describe the requirement.' };

  const supabase = await createClient();
  const { count } = await supabase.from('enquiry_requirements')
    .select('*', { count: 'exact', head: true }).eq('enquiry_id', enquiryId);

  const { data, error } = await supabase.from('enquiry_requirements').insert({
    enquiry_id: enquiryId,
    requirement: text,
    requirement_type_id: typeId,
    is_essential: isEssential,
    display_order: (count ?? 0) + 1,
  }).select('id').single();

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/enquiries/${enquiryId}`);
  return { ok: true, id: data.id };
}

export async function saveRequirementField(
  reqId: number, enquiryId: number, column: string, value: unknown
): Promise<Result> {
  if (!REQ_COLUMNS.has(column)) {
    return { ok: false, error: `"${column}" is not editable on a requirement.` };
  }
  const supabase = await createClient();
  const { error } = await supabase.from('enquiry_requirements')
    .update({ [column]: value }).eq('id', reqId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/enquiries/${enquiryId}`);
  return { ok: true };
}

export async function removeRequirement(reqId: number, enquiryId: number): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('enquiry_requirements').delete().eq('id', reqId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/enquiries/${enquiryId}`);
  return { ok: true };
}

/** Records an essential requirement nothing could meet. Written to
 *  analytics_supply_gaps, where `requirement` is the column that was
 *  waiting for exactly this — a named gap is far sharper evidence than a
 *  search that returned nothing. */
export async function recordUnmetRequirement(
  reqId: number, enquiryId: number, reason: string
): Promise<Result> {
  const supabase = await createClient();

  const [{ data: req }, { data: enq }, { data: period }] = await Promise.all([
    supabase.from('enquiry_requirements').select('*').eq('id', reqId).single(),
    supabase.from('enquiries').select('country_id,city_id,category_id,practice_id,estimated_value')
      .eq('id', enquiryId).single(),
    supabase.from('analytics_periods').select('id')
      .order('period_start', { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!req) return { ok: false, error: 'Requirement not found.' };

  await supabase.from('enquiry_requirements')
    .update({ is_met: false, unmet_reason: reason || null }).eq('id', reqId);

  const { error } = await supabase.from('analytics_supply_gaps').insert({
    period_id: period?.id ?? null,
    country_id: enq?.country_id ?? null,
    city_id: enq?.city_id ?? null,
    category_id: enq?.category_id ?? null,
    practice_id: enq?.practice_id ?? null,
    requirement: req.requirement,
    enquiries_unmet: 1,
    estimated_value_lost: enq?.estimated_value ?? null,
    notes: reason || null,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/enquiries/${enquiryId}`);
  return { ok: true, message: 'Recorded as a supply gap.' };
}

/* ── date options ────────────────────────────────────────────────── */

const DATE_COLUMNS = new Set([
  'preference','date_from','date_to','nights','arrival_time','departure_time',
  'is_flexible','flexibility_days','notes',
]);

export async function addDateOption(enquiryId: number): Promise<Result> {
  const supabase = await createClient();
  const { count } = await supabase.from('enquiry_date_options')
    .select('*', { count: 'exact', head: true }).eq('enquiry_id', enquiryId);

  const { data, error } = await supabase.from('enquiry_date_options')
    .insert({ enquiry_id: enquiryId, preference: (count ?? 0) + 1 })
    .select('id').single();

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/enquiries/${enquiryId}`);
  return { ok: true, id: data.id };
}

export async function saveDateOption(
  optionId: number, enquiryId: number, column: string, value: unknown
): Promise<Result> {
  if (!DATE_COLUMNS.has(column)) {
    return { ok: false, error: `"${column}" is not editable on a date option.` };
  }
  const supabase = await createClient();

  // Nights derive from the dates rather than being typed twice.
  const extra: Record<string, unknown> = {};
  if (column === 'date_from' || column === 'date_to') {
    const { data: row } = await supabase.from('enquiry_date_options')
      .select('date_from,date_to').eq('id', optionId).single();
    const from = column === 'date_from' ? value : row?.date_from;
    const to = column === 'date_to' ? value : row?.date_to;
    if (from && to) {
      const nights = Math.round(
        (new Date(String(to)).getTime() - new Date(String(from)).getTime()) / 86_400_000);
      if (nights >= 0) extra.nights = nights;
    }
  }

  const { error } = await supabase.from('enquiry_date_options')
    .update({ [column]: value, ...extra }).eq('id', optionId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/enquiries/${enquiryId}`);
  return { ok: true };
}

export async function removeDateOption(optionId: number, enquiryId: number): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('enquiry_date_options').delete().eq('id', optionId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/enquiries/${enquiryId}`);
  return { ok: true };
}
