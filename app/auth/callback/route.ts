import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/* Exchanges the code from a confirmation or reset email for a session,
 * then sends the visitor on to wherever they were headed. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') || '/account';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      /* The moment a sign-up becomes a person.
       *
       * Until the email is confirmed there is no session, so nothing can be
       * written on the signer-up's behalf — auth.uid() is null and the
       * database rightly refuses. This is the first point at which there is
       * one, so it is where the choice made on the form (wellness guest,
       * retreat host, venue owner) turns into a contact record and a role.
       *
       * Deliberately not awaited for its result: a confirmation link that
       * fails because a role could not be written is worse than a role
       * written late, and signing in calls the same function again. */
      await supabase.rpc('ensure_platform_profile');
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }
  return NextResponse.redirect(new URL('/login?error=link', url.origin));
}
