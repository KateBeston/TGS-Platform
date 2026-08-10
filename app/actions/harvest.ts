'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { backfillLocalArea } from '@/app/actions/localArea';
import { harvest, isPostcodeRepair, sameEmail, samePhone } from '@/lib/harvest';

export type Result = { ok: true; message?: string } | { ok: false; error: string };

/** Columns this pass may propose. Kept narrow on purpose — everything here
 *  is something a page states about itself in machine-readable form. */
const ALLOWED = new Set([
  'youtube_url', 'tiktok_url', 'pinterest_url', 'tripadvisor_url',
  'google_business_url', 'booking_engine_url', 'whatsapp_number', 'other_links',
  'venue_name','venue_short_description','street_address','postcode',
  'latitude','longitude','contact_phone','contact_email',
  'primary_image_url','instagram_url','facebook_url','linkedin_url',
]);

/** Cheap sanity checks. A model is not needed to notice that a latitude of
 *  412 is wrong, and catching it here keeps nonsense out of the queue. */
function plausible(col: string, value: string): boolean {
  if (col === 'latitude')  { const n = Number(value); return Number.isFinite(n) && Math.abs(n) <= 90; }
  if (col === 'longitude') { const n = Number(value); return Number.isFinite(n) && Math.abs(n) <= 180; }
  if (col === 'contact_email') return /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(value);
  if (col.endsWith('_url') || col === 'primary_image_url') return /^https?:\/\//i.test(value);
  if (col === 'venue_short_description') return value.length > 20 && value.length < 4000;
  if (col === 'venue_name') return value.length > 1 && value.length < 200;
  return true;
}

export async function harvestVenue(
  venueId: number, opts: { localArea?: boolean } = {},
): Promise<Result> {
  const supabase = await createClient();

  const { data: v } = await supabase
    .from('venues').select('*').eq('id', venueId).single();
  if (!v) return { ok: false, error: 'Venue not found.' };
  if (!v.website_url) return { ok: false, error: 'No website URL on this venue.' };

  const { data: run } = await supabase.from('extraction_runs').insert({
    venue_id: venueId, source_url: v.website_url, model: 'structured-data-parser',
  }).select('id').single();
  if (!run) return { ok: false, error: 'Could not start the run.' };

  const result = await harvest(v.website_url);

  if (!result.ok) {
    await supabase.from('extraction_runs').update({
      status: 'Failed', fetch_ok: false, error_message: result.error,
      completed_at: new Date().toISOString(),
    }).eq('id', run.id);
    return { ok: false, error: result.error ?? 'Harvest failed.' };
  }

  /** Whether a proposal genuinely differs from what is stored.
   *
   *  Comparing raw strings made every reformatting look like a conflict:
   *  61405400696 and +61 405 400 696 are one number. Each field is
   *  compared as the kind of thing it is. */
  const isDifferent = (col: string, proposed: string) => {
    const current = String(v[col] ?? '').trim();
    if (!current) return true;
    if (col === 'contact_phone') return !samePhone(current, proposed);
    if (col === 'contact_email') return !sameEmail(current, proposed);
    return current !== proposed.trim();
  };

  const rows = Object.entries(result.fields)
    .filter(([col, f]) => ALLOWED.has(col) && plausible(col, f.value))
    // Drop no-ops, including values that differ only in formatting.
    .filter(([col, f]) => isDifferent(col, f.value))
    .map(([col, f]) => {
      const current = v[col] == null ? null : String(v[col]);
      return {
        run_id: run.id,
        target_table: 'venues',
        target_column: col,
        proposed_value: f.value,
        current_value: current,
        evidence: f.evidence,
        confidence: f.source === 'StructuredData' ? 'High'
          : f.source === 'Unverified' ? 'Low' : 'Medium',
        source_type: f.source === 'Unverified' ? 'PageText' : f.source,
        // A field that already holds a different value is a conflict, not
        // a proposal — except where the change is plainly a repair. A
        // postcode gaining a leading zero is an import artefact being
        // corrected, not a disagreement about the postcode.
        status: !current ? 'Proposed'
          : (col === 'postcode' && isPostcodeRepair(current, f.value)) ? 'Proposed'
          : 'Conflict',
      };
    });

  if (rows.length) await supabase.from('extraction_proposals').insert(rows);

  await supabase.from('extraction_runs').update({
    status: 'Complete', fetch_ok: true, page_bytes: result.bytes,
    had_structured_data: result.hadStructuredData,
    fields_proposed: rows.length, completed_at: new Date().toISOString(),
  }).eq('id', run.id);

  await supabase.from('venues').update({
    last_extracted_at: new Date().toISOString(),
    last_extracted_url: v.website_url,
  }).eq('id', venueId);

  // Local area — nearby distances and excursions from the venue's
  // coordinates in the same pass, so a venue is harvested once rather
  // than through a second tool. Off in batch runs to keep bulk
  // harvests off the Places bill.
  const localAdded = opts.localArea !== false ? await backfillLocalArea(venueId) : 0;

  revalidatePath('/venues/harvest');
  const localNote = localAdded ? ` + ${localAdded} local-area ${localAdded === 1 ? 'place' : 'places'}` : '';
  return {
    ok: true,
    message: (rows.length
      ? `${rows.length} field${rows.length === 1 ? '' : 's'} found${result.hadStructuredData ? ' (structured data present)' : ''}.`
      : 'Page read, but nothing machine-readable found.') + localNote,
  };
}

/** Reads several sites at once.
 *
 *  The earlier version paused ~1s between venues as a courtesy to the site
 *  being fetched. That was the wrong model: consecutive venues are
 *  different domains, so the pause protected nobody and made 1,294 venues
 *  a twenty-minute wait. Requests now run in small concurrent groups —
 *  still one request per domain, just not queued behind unrelated ones.
 *
 *  Concurrency is capped at 5 so a batch stays inside the serverless
 *  timeout even when several sites are slow to respond. */
export async function batchHarvest(limit = 25): Promise<Result> {
  const supabase = await createClient();

  const { data: venues } = await supabase
    .from('venues')
    .select('id')
    .not('website_url', 'is', null)
    .is('last_extracted_at', null)
    .order('id')
    .limit(Math.min(limit, 50));

  if (!venues?.length) return { ok: true, message: 'Nothing left to harvest.' };

  let done = 0, failed = 0;
  const CONCURRENCY = 5;

  for (let i = 0; i < venues.length; i += CONCURRENCY) {
    const group = venues.slice(i, i + CONCURRENCY);
    const results = await Promise.all(group.map((v) => harvestVenue(v.id, { localArea: false })));
    for (const r of results) r.ok ? done++ : failed++;
  }

  revalidatePath('/venues/harvest');
  return {
    ok: true,
    message: `Read ${done} site${done === 1 ? '' : 's'}${failed ? `, ${failed} could not be reached` : ''}.`,
  };
}

export async function decideProposal(
  proposalId: number, decision: 'Accepted' | 'Rejected', editedValue?: string
): Promise<Result> {
  const supabase = await createClient();

  const { data: p } = await supabase
    .from('extraction_proposals').select('*, extraction_runs(venue_id)')
    .eq('id', proposalId).single();
  if (!p) return { ok: false, error: 'Proposal not found.' };

  if (decision === 'Accepted') {
    const value = editedValue ?? p.proposed_value;
    const venueId = (p as any).extraction_runs?.venue_id;
    const numeric = ['latitude', 'longitude'].includes(p.target_column);

    const { error } = await supabase.from('venues')
      .update({ [p.target_column]: numeric ? Number(value) : value })
      .eq('id', venueId);
    if (error) return { ok: false, error: error.message };

    await supabase.from('extraction_proposals').update({
      status: editedValue ? 'Edited' : 'Accepted',
      applied_value: value, decided_at: new Date().toISOString(),
    }).eq('id', proposalId);
  } else {
    await supabase.from('extraction_proposals').update({
      status: 'Rejected', decided_at: new Date().toISOString(),
    }).eq('id', proposalId);
  }

  revalidatePath('/venues/harvest');
  return { ok: true };
}

export async function acceptAllSafe(runId: number): Promise<Result> {
  const supabase = await createClient();

  // Only empty fields, and only where the source was authoritative.
  // Conflicts and Low-confidence guesses always need a person — a scraped
  // social link is as likely to be the owner's personal account as the
  // venue's, and nothing should apply that in bulk.
  const { data: props } = await supabase
    .from('extraction_proposals').select('id')
    .eq('run_id', runId).eq('status', 'Proposed')
    .neq('confidence', 'Low');

  if (!props?.length) return { ok: true, message: 'Nothing to accept.' };

  for (const p of props) await decideProposal(p.id, 'Accepted');

  revalidatePath('/venues/harvest');
  return { ok: true, message: `${props.length} field${props.length === 1 ? '' : 's'} applied.` };
}

/* ── bulk review ─────────────────────────────────────────────────── */

export type ProposalGroup = {
  column: string;
  confidence: string;
  source: string;
  status: string;
  count: number;
};

/** Proposals grouped by field, confidence and source. Reviewing one venue
 *  at a time means opening 1,294 cards; reviewing "47 venue types, all
 *  from structured data, all High" means spot-checking five and applying
 *  the rest. That is the difference between an evening and a fortnight. */
export async function proposalGroups(): Promise<ProposalGroup[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('extraction_proposals')
    .select('target_column,confidence,source_type,status')
    .in('status', ['Proposed', 'Conflict'])
    .limit(20000);

  const map = new Map<string, ProposalGroup>();
  for (const r of data ?? []) {
    const key = `${r.target_column}|${r.confidence}|${r.source_type}|${r.status}`;
    const existing = map.get(key);
    if (existing) existing.count += 1;
    else map.set(key, {
      column: r.target_column, confidence: r.confidence ?? 'Medium',
      source: r.source_type ?? 'PageText', status: r.status, count: 1,
    });
  }

  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

/** The rows inside one group, with the venue so a value can be judged
 *  against the venue it belongs to rather than in isolation. */
export async function proposalsInGroup(
  column: string, confidence: string, source: string, status: string, limit = 200
) {
  const supabase = await createClient();

  const { data } = await supabase
    .from('extraction_proposals')
    .select('id,proposed_value,current_value,evidence,run_id,extraction_runs(venue_id,source_url,venues(venue_name))')
    .eq('target_column', column)
    .eq('confidence', confidence)
    .eq('source_type', source)
    .eq('status', status)
    .order('id')
    .limit(limit);

  return data ?? [];
}

/** Applies a set of proposals in one action. Sequential rather than
 *  parallel: these write to venues, and parallel updates to the same table
 *  interleave badly. */
/** Columns that are not text, and what they take. Anything absent is
 *  written as it stands. */
const NUMERIC = new Set([
  'latitude', 'longitude', 'max_guests', 'total_bedrooms', 'total_bathrooms',
  'established_year', 'price_from', 'property_size', 'floor_area', 'venue_type_id',
]);
const BOOLEAN = new Set([
  'wifi_available', 'pets_allowed', 'children_allowed',
  'byo_facilitator_friendly', 'external_practitioners_welcome',
]);

/** Returns undefined where the value cannot be what the column needs, so
 *  the caller can count it as failed rather than writing something wrong. */
function coerce(column: string, raw: string | null): unknown {
  if (raw === null || raw === '') return null;

  // jsonb, so a string would be stored as a JSON string rather than the
  // array it represents.
  if (column === 'other_links') {
    try { return JSON.parse(raw); } catch { return undefined; }
  }

  if (NUMERIC.has(column)) {
    const n = Number(String(raw).replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(n) ? n : undefined;
  }

  if (BOOLEAN.has(column)) {
    const v = String(raw).trim().toLowerCase();
    if (['true', 'yes', '1', 't'].includes(v)) return true;
    if (['false', 'no', '0', 'f'].includes(v)) return false;
    return undefined;
  }

  return raw;
}

export async function applyProposals(ids: number[]): Promise<Result> {
  if (!ids.length) return { ok: true, message: 'Nothing selected.' };

  const supabase = await createClient();

  const { data: props } = await supabase
    .from('extraction_proposals')
    .select('*, extraction_runs(venue_id)')
    .in('id', ids);

  if (!props?.length) return { ok: false, error: 'Nothing found to apply.' };

  let applied = 0, failed = 0;
  const touched = new Set<number>();

  for (const p of props) {
    const venueId = (p as any).extraction_runs?.venue_id;
    if (!venueId) { failed++; continue; }

    // Typed rather than stringified. Postgres will cast '12' to a number
    // and 'true' to a boolean, but it will also reject 'twelve acres'
    // with an error nobody reads — better to convert here and know.
    const value = coerce(p.target_column, p.proposed_value);
    if (value === undefined) { failed++; continue; }

    const { error } = await supabase.from('venues')
      .update({ [p.target_column]: value })
      .eq('id', venueId);

    if (error) { failed++; continue; }

    await supabase.from('extraction_proposals')
      .update({ status: 'Accepted', applied_value: p.proposed_value,
                decided_at: new Date().toISOString() })
      .eq('id', p.id);

    applied++;
    touched.add(venueId);
  }

  revalidatePath('/venues/harvest');
  return {
    ok: true,
    message: `${applied} applied across ${touched.size} venue${touched.size === 1 ? '' : 's'}`
      + (failed ? `, ${failed} failed` : '') + '.',
  };
}

export async function rejectProposals(ids: number[]): Promise<Result> {
  if (!ids.length) return { ok: true, message: 'Nothing selected.' };
  const supabase = await createClient();
  const { error } = await supabase.from('extraction_proposals')
    .update({ status: 'Rejected', decided_at: new Date().toISOString() })
    .in('id', ids);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/venues/harvest');
  return { ok: true, message: `${ids.length} rejected.` };
}
