import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/* Journal signups.
 *
 * The order matters and it is deliberate: honeypot, then persist, then
 * CRM. Writing to our own database first means a signup survives
 * ActiveCampaign being down, misconfigured, or not wired up yet — which
 * it is not, today.
 *
 * A form that posts straight to a CRM loses everything the CRM refuses.
 */
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const email = String(body?.email ?? '').trim().toLowerCase();
  const name = String(body?.name ?? '').trim();
  const source = String(body?.source ?? 'site').slice(0, 60);

  // Filled means a script, since the field is positioned off-screen and
  // no person sees it. Answered with a success so the script learns
  // nothing from the difference.
  if (String(body?.website ?? '').trim()) {
    return NextResponse.json({ ok: true });
  }

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'That does not look like an email address.' },
      { status: 400 });
  }

  try {
    const supabase = await createClient();

    // newsletter_subscribers, not journal_subscribers. It already exists
    // and already carries activecampaign_id for the sync, so nothing new
    // is needed here — only checking the name before writing to it.
    const { error } = await supabase.from('newsletter_subscribers').insert({
      email,
      first_name: name || null,
      source,
      referred_by: req.headers.get('referer') ?? null,
    });

    // Already subscribed is not a failure to tell somebody about.
    if (error && !/duplicate|unique/i.test(error.message)) {
      return NextResponse.json({ error: 'Could not record that. Try again shortly.' },
        { status: 500 });
    }
  } catch {
    return NextResponse.json({ error: 'Could not record that. Try again shortly.' },
      { status: 500 });
  }

  // ActiveCampaign sync goes here once wired. Deliberately after the
  // write, so a CRM failure never loses a subscriber.

  return NextResponse.json({ ok: true });
}
