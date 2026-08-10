import { NextResponse } from 'next/server';
import { recordAccess } from '@/app/actions/access';
import { createClient } from '@/lib/supabase/server';

/** Records an access event from the browser.
 *
 *  Needed because a password change happens client-side, in the recovery
 *  session, where no server action runs. Without it a reset shows in the
 *  history as a session appearing from nowhere. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const event = body?.event === 'Password changed' ? 'Password changed' : 'Signed in';

  await recordAccess(event, user.email);
  return NextResponse.json({ ok: true });
}
