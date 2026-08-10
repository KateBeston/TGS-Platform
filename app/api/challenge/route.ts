import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifyTurnstile } from '@/lib/turnstile';

/** Verifies a challenge token on its own.
 *
 *  For forms that do not post to a server action — the password reset
 *  request talks to Supabase directly from the browser, so the check has
 *  to happen somewhere the secret key can live.
 */
export async function POST(request: Request) {
  const { token } = await request.json().catch(() => ({}));
  const h = await headers();
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || null;

  const result = await verifyTurnstile(token, ip);
  return NextResponse.json(
    result.ok ? { ok: true } : { ok: false, reason: result.reason },
    { status: result.ok ? 200 : 400 },
  );
}
