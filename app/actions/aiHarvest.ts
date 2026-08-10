'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  buildPrompt, EXTRACTION_FIELDS, EXTRACTION_MODEL, pageToText,
} from '@/lib/aiExtract';

export type Result = { ok: true; message?: string } | { ok: false; error: string };

const UA = 'Mozilla/5.0 (compatible; TheGlobalSanctumBot/1.0; +https://www.theglobalsanctum.com)';

/** Anthropic bills separately for input and output. Haiku is $1 and $5 per
 *  million, so this is worth reporting per run — a pass that quietly costs
 *  more than expected should be visible while it is happening, not on the
 *  next invoice. */
function costOf(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1_000_000) * 1.0 + (outputTokens / 1_000_000) * 5.0;
}

async function readPage(url: string): Promise<{ text: string } | { error: string }> {
  const target = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  try {
    const res = await fetch(target, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow', signal: AbortSignal.timeout(15_000), cache: 'no-store',
    });
    if (!res.ok) return { error: `Site returned ${res.status}.` };
    const text = pageToText(await res.text());
    if (text.length < 300) {
      return { error: 'Too little readable text — the page is probably rendered in JavaScript.' };
    }
    return { text };
  } catch (e: any) {
    return {
      error: e?.name === 'TimeoutError'
        ? 'Site did not respond within 15 seconds.'
        : 'Could not reach the site.',
    };
  }
}

export async function aiExtractVenue(venueId: number): Promise<Result> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return { ok: false, error: 'ANTHROPIC_API_KEY is not set in Vercel.' };
  }

  const supabase = await createClient();

  const { data: v } = await supabase.from('venues').select('*').eq('id', venueId).single();
  if (!v) return { ok: false, error: 'Venue not found.' };
  if (!v.website_url) return { ok: false, error: 'No website URL.' };

  const { data: types } = await supabase.from('venue_types').select('id,name').order('name');
  const typeNames = (types ?? []).map((t: any) => t.name);

  const { data: run } = await supabase.from('extraction_runs').insert({
    venue_id: venueId, source_url: v.website_url, model: EXTRACTION_MODEL,
  }).select('id').single();
  if (!run) return { ok: false, error: 'Could not start the run.' };

  const page = await readPage(v.website_url);
  if ('error' in page) {
    await supabase.from('extraction_runs').update({
      status: 'Failed', fetch_ok: false, error_message: page.error,
      completed_at: new Date().toISOString(),
    }).eq('id', run.id);
    return { ok: false, error: page.error };
  }

  let parsed: any;
  let usage = { input_tokens: 0, output_tokens: 0 };

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: EXTRACTION_MODEL,
        max_tokens: 1200,
        system: buildPrompt(typeNames),
        messages: [{
          role: 'user',
          content: `Venue name: ${v.venue_name}\nWebsite: ${v.website_url}\n\n---\n\n${page.text}`,
        }],
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      const body = await res.text();
      const message = res.status === 401 ? 'The API key was rejected.'
        : res.status === 429 ? 'Rate limited — wait a moment and run a smaller batch.'
        : res.status === 400 && /credit/i.test(body) ? 'Out of credit.'
        : `Anthropic returned ${res.status}.`;
      await supabase.from('extraction_runs').update({
        status: 'Failed', fetch_ok: true, error_message: message,
        completed_at: new Date().toISOString(),
      }).eq('id', run.id);
      return { ok: false, error: message };
    }

    const json = await res.json();
    usage = json.usage ?? usage;
    const text = (json.content ?? [])
      .filter((c: any) => c.type === 'text').map((c: any) => c.text).join('');

    // A model asked for bare JSON will occasionally add a fence, or a
    // sentence after the closing brace. Taking the outermost braces
    // survives both, where a straight parse fails on the whole page for
    // the sake of one trailing line.
    const cleaned = text.replace(/```json|```/g, '').trim();
    const first = cleaned.indexOf('{');
    const last = cleaned.lastIndexOf('}');
    if (first === -1 || last <= first) throw new Error('No JSON object in the response.');
    parsed = JSON.parse(cleaned.slice(first, last + 1));
  } catch (e: any) {
    await supabase.from('extraction_runs').update({
      status: 'Failed', fetch_ok: true,
      error_message: e?.message?.slice(0, 200) ?? 'Could not read the response.',
      completed_at: new Date().toISOString(),
    }).eq('id', run.id);
    return { ok: false, error: 'Could not read the response.' };
  }

  // The model returns a venue type by name; the column takes an id.
  const typeId = parsed.venue_type_name
    ? (types ?? []).find((t: any) =>
        t.name.toLowerCase() === String(parsed.venue_type_name).toLowerCase())?.id ?? null
    : null;

  const confidence = parsed.confidence === 'high' ? 'High'
    : parsed.confidence === 'low' ? 'Low' : 'Medium';

  const rows: any[] = [];
  const gaps: any[] = [];

  for (const field of EXTRACTION_FIELDS) {
    let value = parsed[field.column];
    let column = field.column;

    if (column === 'venue_type_name') {
      column = 'venue_type_id';
      value = typeId;
    }

    const current = v[column] == null ? null : String(v[column]);

    // Nothing proposed is two different situations, and they must stay
    // distinguishable. "The site does not say" means reading it again
    // will not help; "we already hold it" means there was nothing to
    // propose. Without this, a venue that has been read and has no
    // capacity looks exactly like one nobody has looked at.
    if (value === null || value === undefined || value === '') {
      gaps.push({
        run_id: run.id, venue_id: venueId, target_column: column,
        gap_reason: current ? 'Already held' : 'Not stated',
      });
      continue;
    }

    if (current === String(value)) {
      gaps.push({
        run_id: run.id, venue_id: venueId, target_column: column,
        gap_reason: 'Same as held',
      });
      continue;
    }

    rows.push({
      run_id: run.id,
      target_table: 'venues',
      target_column: column,
      proposed_value: String(value),
      current_value: current,
      evidence: column === 'venue_type_id'
        ? `Read from the page as: ${parsed.venue_type_name}`
        : `Read from the page text`,
      confidence,
      source_type: 'Inferred',
      status: current ? 'Conflict' : 'Proposed',
    });
  }

  if (rows.length) await supabase.from('extraction_proposals').insert(rows);

  // Settings are matched from the venue's own description of where it is.
  // Applied directly rather than proposed, because a match is a lookup
  // against a fixed catalogue rather than a judgement — and it is
  // reversible in one click, unlike a wrong capacity.
  const locationText = [
    parsed.setting_headline, parsed.venue_short_description,
  ].filter(Boolean).join(' ');
  if (locationText) {
    const { data: matched } = await supabase.rpc('match_settings', { p_text: locationText });
    if (matched?.length) {
      await supabase.from('venue_setting_links').upsert(
        matched.map((m: any, i: number) => ({
          venue_id: venueId, setting_id: m.setting_id, is_primary: i === 0,
          source: 'Website', evidence: `Matched on "${m.matched_on}"`,
        })),
        { onConflict: 'venue_id,setting_id', ignoreDuplicates: true },
      );
    }
  }
  if (gaps.length) {
    await supabase.from('extraction_gaps')
      .upsert(gaps, { onConflict: 'run_id,target_column' });
  }

  await supabase.from('extraction_runs').update({
    status: 'Complete', fetch_ok: true,
    page_bytes: page.text.length,
    fields_proposed: rows.length,
    completed_at: new Date().toISOString(),
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    cost_usd: costOf(usage.input_tokens, usage.output_tokens),
  }).eq('id', run.id);

  await supabase.from('venues').update({
    last_ai_extracted_at: new Date().toISOString(),
  }).eq('id', venueId);

  revalidatePath('/venues/harvest');
  return {
    ok: true,
    message: `${rows.length} proposed, `
      + `${gaps.filter((g) => g.gap_reason === 'Not stated').length} not on the page · `
      + `${(usage.input_tokens / 1000).toFixed(1)}k in, ${usage.output_tokens} out · `
      + `$${costOf(usage.input_tokens, usage.output_tokens).toFixed(4)}`,
  };
}

/** Small batches, run one at a time. Concurrency would be faster but
 *  would also make a runaway cost harder to stop. */
export async function aiBatch(limit = 10): Promise<Result> {
  const supabase = await createClient();

  const { data: venues } = await supabase
    .from('venues').select('id')
    .not('website_url', 'is', null)
    .is('last_ai_extracted_at', null)
    .order('id').limit(Math.min(limit, 25));

  if (!venues?.length) return { ok: true, message: 'Nothing left to read.' };

  let done = 0, failed = 0;
  for (const v of venues) {
    const r = await aiExtractVenue(v.id);
    r.ok ? done++ : failed++;
  }

  const { data: spend } = await supabase
    .from('extraction_runs').select('cost_usd')
    .eq('model', EXTRACTION_MODEL).not('cost_usd', 'is', null);
  const total = (spend ?? []).reduce((s: number, r: any) => s + Number(r.cost_usd ?? 0), 0);

  revalidatePath('/venues/harvest');
  return {
    ok: true,
    message: `Read ${done}${failed ? `, ${failed} failed` : ''}. `
      + `Spent so far: $${total.toFixed(2)}.`,
  };
}

/* ── coverage ────────────────────────────────────────────────────── */

/** Which fields a page was read for and did not state.
 *
 *  This is the answer to "why did only one thing come back". Reading a
 *  thin site again will not produce more; reading an unread site will. */
export async function venueGaps(venueId: number) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('extraction_gaps').select('*')
    .eq('venue_id', venueId).order('target_column');
  return data ?? [];
}

export async function coverageSummary() {
  const supabase = await createClient();

  const [{ count: total }, { count: read }, { data: gaps }, { data: spend }] =
    await Promise.all([
      supabase.from('venues').select('*', { count: 'exact', head: true })
        .not('website_url', 'is', null),
      supabase.from('venues').select('*', { count: 'exact', head: true })
        .not('last_ai_extracted_at', 'is', null),
      supabase.from('extraction_gaps').select('target_column,gap_reason').limit(20000),
      supabase.from('ai_extraction_spend').select('*').maybeSingle(),
    ]);

  // Per field: how often the site simply does not say. A field the web
  // rarely states is one to stop expecting from this pass and collect
  // another way — from the venue itself, at onboarding.
  const byField = new Map<string, { silent: number; held: number; same: number }>();
  for (const g of gaps ?? []) {
    const entry = byField.get(g.target_column)
      ?? { silent: 0, held: 0, same: 0 };
    if (g.gap_reason === 'Not stated') entry.silent++;
    else if (g.gap_reason === 'Already held') entry.held++;
    else entry.same++;
    byField.set(g.target_column, entry);
  }

  return {
    total: total ?? 0,
    read: read ?? 0,
    spend: spend ?? null,
    fields: Array.from(byField.entries())
      .map(([column, counts]) => ({ column, ...counts }))
      .sort((a, b) => b.silent - a.silent),
  };
}

/* ── settings from prose ─────────────────────────────────────────── */

/** Maps what a page says about its location onto the catalogue.
 *
 *  The venue's own words come first and always win — it knows whether it
 *  is beachfront. Regional settings are inherited from the city and never
 *  claimed at property level, or every venue in Byron Bay ends up on the
 *  beach.
 *
 *  Matching is done in Postgres via match_settings(), so the same logic
 *  serves this pass, a venue owner typing their own description at
 *  sign-up, and anything added later. One place to correct. */
export async function settingsFromText(
  venueId: number, text: string, source: 'Website' | 'Venue stated' | 'Manual' = 'Website'
): Promise<Result> {
  if (!text?.trim()) return { ok: true, message: 'Nothing to read.' };

  const supabase = await createClient();
  const { data: matches } = await supabase.rpc('match_settings', { p_text: text });
  if (!matches?.length) return { ok: true, message: 'No settings recognised.' };

  const rows = matches.map((m: any, i: number) => ({
    venue_id: venueId,
    setting_id: m.setting_id,
    is_primary: i === 0,
    source,
    evidence: `Matched on "${m.matched_on}"`,
  }));

  const { error } = await supabase.from('venue_setting_links')
    .upsert(rows, { onConflict: 'venue_id,setting_id', ignoreDuplicates: true });
  if (error) return { ok: false, error: error.message };

  return {
    ok: true,
    message: `${rows.length}: ${matches.map((m: any) => m.name).join(', ')}`,
  };
}

/** What a venue in a given place inherits before anyone reads its site.
 *  Shown at onboarding so an owner confirms rather than starting blank —
 *  and so they are only asked the property-scale questions that they
 *  alone can answer. */
export async function inheritedSettings(
  cityId?: number | null, stateId?: number | null, countryId?: number | null
) {
  const supabase = await createClient();
  const { data } = await supabase.rpc('settings_for_new_venue', {
    p_city_id: cityId ?? null,
    p_state_id: stateId ?? null,
    p_country_id: countryId ?? null,
  });
  return data ?? [];
}
