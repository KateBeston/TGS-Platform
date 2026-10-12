import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
     has just signed somebody in is worth more to an attacker than most. */
  const asked = url.searchParams.get('next') ?? '/account';
  const next = asked.startsWith('/') && !asked.startsWith('//') ? asked : '/account';

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
     contact record with the role they chose. */
  await supabase.rpc('ensure_platform_profile');

  /* A recovery link goes to the account page whatever the email asked
     for, because that is where the change-password form is. /reset is the
     form that *requests* a link, so sending them back there after they
     followed one would be a loop. */
  if (type === 'recovery') {
    return NextResponse.redirect(new URL('/account#password', url.origin));
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
