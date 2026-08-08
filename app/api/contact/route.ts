import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/* Contact messages.
 *
 * Recorded as an enquiry, because that is what they are — the same table
 * the concierge works from, so a message about a venue and an enquiry
 * about a venue end up in one place rather than two.
 *
 * The lead source and the attribution go on the record and into the
 * internal notification only. They are never echoed back to the sender:
 * telling somebody "we can see you came from Instagram" is unnerving and
 * gains nothing.
 */

const ROLE_TO_TYPE: Record<string, string> = {
  'Wellness Guest': 'Wellness Guest',
  'Retreat Host': 'Retreat Host',
  'Venue Owner': 'Venue Owner',
  Press: 'Other',
  Other: 'Other',
};

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Malformed request.' }, { status: 400 }); }

  if (String(body?.website ?? '').trim()) {
    return NextResponse.json({ ok: true });
  }

  const email = String(body?.email ?? '').trim().toLowerCase();
  const firstName = String(body?.firstName ?? '').trim();
  const message = String(body?.message ?? '').trim();

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'That does not look like an email address.' },
      { status: 400 });
  }
  if (!firstName || !message) {
    return NextResponse.json({ error: 'A name and a message, at minimum.' },
      { status: 400 });
  }

  const a = body?.attribution ?? {};

  try {
    const supabase = await createClient();

    const { error } = await supabase.from('enquiries').insert({
      enquiry_type: ROLE_TO_TYPE[body?.role] ?? 'Other',
      status: 'Draft',
      source: 'Contact form',

      first_name: firstName,
      surname: String(body?.surname ?? '').trim() || null,
      email,
      phone: String(body?.phone ?? '').trim() || null,

      notes: [body?.subject && `Subject: ${body.subject}`, message]
        .filter(Boolean).join('\n\n'),

      // What they said, kept apart from what the browser said. The two
      // disagree often and both are worth having.
      lead_source: body?.leadSource || null,
      lead_source_other: body?.leadSourceOther || null,

      utm_source: a.utm_source ?? null,
      utm_medium: a.utm_medium ?? null,
      utm_campaign: a.utm_campaign ?? null,
      utm_term: a.utm_term ?? null,
      utm_content: a.utm_content ?? null,
      click_id: a.click_id ?? null,
      referrer: a.referrer ?? null,
      landing_page: a.landing_page ?? null,
      first_touch_at: a.first_touch_at ?? null,
    });

    if (error) {
      return NextResponse.json({ error: 'Could not send that. Try again shortly.' },
        { status: 500 });
    }
  } catch {
    return NextResponse.json({ error: 'Could not send that. Try again shortly.' },
      { status: 500 });
  }

  // Two emails go here once wired: an internal notification carrying the
  // lead source, and an acknowledgement to the sender that does not.

  return NextResponse.json({ ok: true });
}
