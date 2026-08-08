import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/* Venue enquiries.
 *
 * Honeypot, then persist, then CRM. Writing to our own database first
 * means an enquiry survives ActiveCampaign being down, misconfigured or
 * not yet wired — which it is not, today.
 *
 * Structured fields rather than one prose blob. The enquiries table can
 * only report on what was captured, and "they wanted somewhere warm in
 * March for eighteen" is worth nothing if it only exists inside a
 * paragraph.
 */
export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Malformed request.' }, { status: 400 }); }

  // Filled means a script. Answered with a success so it learns nothing
  // from the difference.
  if (String(body?.website ?? '').trim()) {
    return NextResponse.json({ ok: true });
  }

  const email = String(body?.email ?? '').trim().toLowerCase();
  const firstName = String(body?.firstName ?? '').trim();

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'That does not look like an email address.' },
      { status: 400 });
  }
  if (!firstName) {
    return NextResponse.json({ error: 'A first name, so we know who we are writing to.' },
      { status: 400 });
  }

  const nights = body?.dateFrom && body?.dateTo
    ? Math.round((new Date(body.dateTo).getTime() - new Date(body.dateFrom).getTime())
                 / 86_400_000)
    : null;

  try {
    const supabase = await createClient();

    const { error } = await supabase.from('enquiries').insert({
      enquiry_type: body?.marketplace === 'Wellness' ? 'Wellness Guest' : 'Retreat Host',
      status: 'Draft',
      source: 'Website',
      venue_id: body?.venueId ?? null,

      first_name: firstName,
      surname: String(body?.surname ?? '').trim() || null,
      email,
      phone: String(body?.phone ?? '').trim() || null,

      date_from: body?.dateFrom || null,
      date_to: body?.dateTo || null,
      nights: nights && nights > 0 ? nights : null,
      guest_count: body?.guests ? Number(body.guests) : null,

      notes: String(body?.notes ?? '').trim() || null,
      // Asked directly rather than hoped for in the notes. Somebody who
      // needs step-free access should not have to volunteer it in a box
      // labelled "anything else".
      has_access_needs: !!String(body?.accessNeeds ?? '').trim(),
      access_needs_note: String(body?.accessNeeds ?? '').trim() || null,
    });

    if (error) {
      return NextResponse.json({ error: 'Could not record that. Try again shortly.' },
        { status: 500 });
    }
  } catch {
    return NextResponse.json({ error: 'Could not record that. Try again shortly.' },
      { status: 500 });
  }

  // ActiveCampaign sync and the two notification emails go here once
  // wired. Deliberately after the write, so neither can lose an enquiry.

  return NextResponse.json({ ok: true });
}
