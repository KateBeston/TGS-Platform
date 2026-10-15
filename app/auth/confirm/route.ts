import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { notify, report } from '@/lib/notify';

/* ═══════════════════════════════════════════════════════════════════════
   REDEEMING A LINK THE PORTAL SENT

   Confirmation and reset emails now leave through the portal, which means
   they no longer point at Supabase's own verify endpoint. They point here
   with a token hash, and this exchanges it for a session.

   This replaces nothing: /auth/callback still handles the older style of
   link, which arrives with a ?code. Both exist because links already in
   somebody's inbox keep working.
   ═══════════════════════════════════════════════════════════════════════ */

const TYPES = new Set([
  'signup', 'recovery', 'magiclink', 'invite', 'email_change', 'email',
]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') ?? '';

  /* Only ever a path on this site. A redirect target taken whole from the
     query string is an open redirect, and an open redirect on a page that
     has just signed somebody in is worth more to an attacker than most.

     A full URL is accepted only when it is this origin, and reduced to
     its path before use: Supabase hands the hook an absolute redirect_to
     and the portal passes it straight through, so rejecting absolutes
     outright sent everybody to /account regardless of where they were
     going. Anything else falls back. */
  const asked = url.searchParams.get('next') ?? '/account';
  let next = '/account';
  if (asked.startsWith('/') && !asked.startsWith('//')) {
    next = asked;
  } else {
    try {
      const parsed = new URL(asked);
      if (parsed.origin === url.origin) next = parsed.pathname + parsed.search + parsed.hash;
    } catch { /* not a URL at all; the fallback stands */ }
  }

  if (!tokenHash || !TYPES.has(type)) {
    return NextResponse.redirect(new URL('/login?error=link', url.origin));
  }

  const supabase = await createClient();
  /* email_change_new and email_change both verify as 'email'. */
  const otpType = type === 'email_change' ? 'email' : type;
  const { error } = await supabase.auth.verifyOtp({
    type: otpType as 'signup' | 'recovery' | 'magiclink' | 'invite' | 'email',
    token_hash: tokenHash,
  });

  if (error) {
    /* Expired and already-used look the same to someone reading it, and
       both are fixed the same way: ask for another. */
    return NextResponse.redirect(new URL('/login?error=link', url.origin));
  }

  /* They are confirmed and signed in, which is the first moment anything
     can be written on their behalf. This is what turns the sign-up into a
     contact record with the role they chose.

     Skipped when the link is on its way to /welcome/finish. That page
     completes the sign-up itself, and it has to: the answers from the form
     arrive in a cookie, and the profile must be built from them rather
     than from metadata that may not have been applied yet. Calling it here
     first would insert a profile carrying the defaults, and the insert
     leaves an existing row alone, so the real answers would never land. */
  const finishing = next.startsWith('/welcome/finish');
  if (!finishing) await supabase.rpc('ensure_platform_profile');

  /* A new account, once only.
   *
   * Hung off signup rather than every confirmation: recovery and email
   * change come through here too, and neither is a new person. The portal
   * is told so it can raise the alert, and asked to send the welcome from
   * its own library — the platform names the template and nothing more.
   *
   * Both are fire and forget. The account exists either way, and somebody
   * who has just confirmed their email should not be shown an error
   * because a notification could not be delivered. */
  if (type === 'signup') {
    const { data: { user } } = await supabase.auth.getUser();
    const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
    const first = String(meta.first_name ?? '').trim();
    const full = [first, String(meta.surname ?? '').trim()].filter(Boolean).join(' ');
    const choice = String(meta.primary_audience ?? 'guest');

    /* What their account opens, in their words rather than ours. One
       template serves both because only this line differs.

       There were three. The third welcomed somebody who had chosen
       "Venue owner" on the sign-up form by offering to walk them through
       listing a venue, which pointed a marketplace welcome at the venue
       funnel. That option is gone from the form, and an older account
       whose metadata still says 'owner' is welcomed as what their
       marketplace account makes them. */
    const audienceLine = choice === 'host'
      ? 'You told us you are here mainly to host retreats, so we will point you at venues that take them and the people who run them.'
      : 'You told us you are here mainly for wellness experiences, so we will keep you to places and practitioners worth the trip.';

    notify({
      slug: 'account-welcome',
      to: String(user?.email ?? ''),
      extra: {
        first_name: first || 'there',
        audience_line: audienceLine,
        account_url: new URL('/account', url.origin).toString(),
      },
    });

    report({
      event: 'user.created',
      title: 'A new user account',
      body: `${full || String(user?.email ?? 'Someone')} confirmed their email`
        + ` as a ${choice === 'host' ? 'retreat host' : 'wellness guest'}.`,
      url: '/contacts',
    });
  }

  /* A recovery link goes to the account page, because that is where the
     change-password form is. /reset is the form that *requests* a link,
     so sending them back there after they followed one would be a loop.

     Unless the link named somewhere else: a marketplace sign-up by
     somebody who already had a VMS login arrives as a recovery link by
     mechanism, but it is a sign-up by intent and finishes on its own
     page. The named destination wins. */
  if (type === 'recovery' && next === '/account') {
    return NextResponse.redirect(new URL('/account#password', url.origin));
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
