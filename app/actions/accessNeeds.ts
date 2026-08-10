'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type Result = { ok: true; message?: string } | { ok: false; error: string };

export async function accessNeedTypes() {
  const supabase = await createClient();
  const { data } = await supabase.from('access_need_types')
    .select('*').order('category').order('display_order');
  return data ?? [];
}

export async function enquiryAccessNeeds(enquiryId: number) {
  const supabase = await createClient();
  const { data } = await supabase.from('enquiry_access_needs')
    .select('*').eq('enquiry_id', enquiryId).order('id');
  return data ?? [];
}

export async function addAccessNeed(
  enquiryId: number, needTypeId: number, guestWords: string
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('enquiry_access_needs').insert({
    enquiry_id: enquiryId,
    need_type_id: needTypeId,
    guest_words: guestWords.trim() || null,
  });
  if (error) {
    return { ok: false, error: /duplicate/i.test(error.message)
      ? 'That need is already recorded on this enquiry.' : error.message };
  }
  revalidatePath(`/concierge/enquiries/${enquiryId}`);
  return { ok: true };
}

const EDITABLE = new Set(['status', 'confirmed_with', 'venue_response', 'guest_words',
                          'guest_count']);

export async function saveAccessNeed(
  id: number, column: string, value: unknown
): Promise<Result> {
  if (!EDITABLE.has(column)) return { ok: false, error: `"${column}" is not editable.` };
  const supabase = await createClient();

  const patch: Record<string, unknown> = { [column]: value };
  // Confirming records when, so an old answer is visible as an old answer.
  // A venue that said yes two years ago may have changed since.
  if (column === 'status' && String(value).startsWith('Confirmed')) {
    patch.confirmed_at = new Date().toISOString();
  }

  const { error } = await supabase.from('enquiry_access_needs')
    .update(patch).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/concierge/enquiries');
  return { ok: true };
}

export async function removeAccessNeed(id: number): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('enquiry_access_needs').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/concierge/enquiries');
  return { ok: true };
}

/** Words in an enquiry that suggest an access need.
 *
 *  A prompt to look, never a diagnosis. Somebody writing "my mum uses a
 *  walker" has an access need; somebody writing "walking distance to the
 *  beach" does not, and only a person can tell. */
export async function detectAccessNeeds(text: string) {
  if (!text?.trim()) return [];

  const patterns: [RegExp, string][] = [
    [/\bwheelchair|chair user|power chair\b/i, 'wheelchair'],
    [/\bstep.?free|no stairs|ground floor|avoid stairs|can.?t do stairs\b/i, 'step-free'],
    [/\bmobility|walker|walking frame|walking stick|crutches|limited walking|bad (knee|hip|back)\b/i,
     'limited-walking'],
    [/\bgrab rail|roll.?in shower|accessible (bath|toilet|loo)\b/i, 'accessible-bathroom'],
    [/\bdeaf|hard of hearing|hearing (aid|loop|impair)\b/i, 'hearing'],
    [/\bauslan|asl|bsl|sign language|interpreter\b/i, 'sign-language'],
    [/\bblind|vision impair|low vision|guide dog|seeing eye\b/i, 'vision'],
    [/\bautis|sensory|overwhelm|quiet space|neurodiver\b/i, 'sensory-sensitivity'],
    [/\btranslat|does(n't| not) speak|no english|language barrier\b/i, 'translation'],
    [/\boxygen|dialysis|insulin|refrigerat.*medic|medical (condition|support)|epilep\b/i,
     'medical'],
    [/\bassistance (dog|animal)|service (dog|animal)|support animal\b/i, 'assistance-animal'],
    [/\bcoeliac|celiac|anaphyla|epipen|severe allerg|nut allerg\b/i, 'dietary-medical'],
  ];

  const hits = patterns.filter(([re]) => re.test(text)).map(([, slug]) => slug);
  if (!hits.length) return [];

  const supabase = await createClient();
  const { data } = await supabase.from('access_need_types')
    .select('*').in('slug', hits);
  return data ?? [];
}
