import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { syncContact } from '@/lib/activecampaign';

/* Journal signups.
 *
 * The order matters and it is deliberate: honeypot, then Turnstile, then
 * persist, then CRM. Writing to our own database first means a signup
 * survives ActiveCampaign being down, misconfigured, or not wired up yet —
 * which it is not, today.
 *
 * A form that posts straight to a CRM loses everything the CRM refuses.
 */

// Verifies a Cloudflare Turnstile token. Skipped entirely until the secret
// is configured, so the form keeps working before Turnstile is switched on.
async function turnstilePassed(token: string, ip: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;          // not configured yet — do not block
  if (!token) return false;
  try {
    const form = new URLSearchParams();
    form.append('secret', secret);
    form.append('response', token);
    if (ip) form.append('remoteip', ip);
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', body: form,
    });
    const data = await r.json();
    return !!data?.success;
  } catch {
    return false;
  }
}

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
  const consent = body?.consent === true;
  const consentText = String(body?.consentText ?? '').slice(0, 500);
  const turnstileToken = String(body?.turnstileToken ?? '');

  // Filled means a script, since the field is positioned off-screen and
  // no person sees it. Answered with a success so the script learns
  // nothing from the difference.
  if (String(body?.website ?? '').trim()) {
    return NextResponse.json({ ok: true });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('cf-connecting-ip')
    ?? null;

  if (!(await turnstilePassed(turnstileToken, ip))) {
    return NextResponse.json({ error: 'Verification failed. Please try again.' },
      { status: 400 });
  }

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'That does not look like an email address.' },
      { status: 400 });
  }

  // Express marketing consent is required. The client gates on it too, but
  // never trust the client.
  if (!consent) {
    return NextResponse.json({ error: 'Please confirm you are happy to receive the Journal.' },
      { status: 400 });
  }

  try {
    const supabase = await createClient();

    // newsletter_subscribers, not journal_subscribers. It already exists
    // and already carries activecampaign_id for the sync.
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

    // Consent record. Best-effort and decoupled from the signup: the three
    // consent columns arrive in a separate migration, and until it is run
    // this update simply no-ops rather than failing the subscription.
    try {
      await supabase.from('newsletter_subscribers').update({
        marketing_consent: true,
        consent_text: consentText || null,
        consent_at: new Date().toISOString(),
      }).eq('email', email);
    } catch { /* columns not present yet — safe to ignore */ }

    // ActiveCampaign sync. After the write, so a CRM failure never loses a
    // subscriber. Env-gated and best-effort: skipped until credentials are
    // set, and never allowed to fail the signup.
    try {
      const ac = await syncContact(email, name, process.env.ACTIVECAMPAIGN_LIST_ID);
      if (ac) {
        await supabase.from('newsletter_subscribers')
          .update({ activecampaign_id: ac.contactId }).eq('email', email);
      }
    } catch { /* CRM issue — the subscriber is already saved, so carry on */ }
  } catch {
    return NextResponse.json({ error: 'Could not record that. Try again shortly.' },
      { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
