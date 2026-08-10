/** Cloudflare Turnstile.
 *
 *  Worth having for one specific gap: the login rate limit counts
 *  failures per email address, so somebody spraying one common password
 *  across a hundred addresses never trips it — each address sees a single
 *  failure. Turnstile catches that, because the automation cannot get
 *  past the challenge at all.
 *
 *  It also works where nothing else Cloudflare offers does. The portal
 *  runs grey-clouded so Vercel's certificates work, which means the WAF,
 *  bot protection and edge rate limiting never see this traffic.
 *  Turnstile is a script and a verification call, so proxying is
 *  irrelevant.
 */
const VERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export type TurnstileResult =
  | { ok: true }
  | { ok: false; reason: string; codes?: string[] };

/** Checks a token with Cloudflare.
 *
 *  The client-side widget alone protects nothing — a token can be
 *  forged, so anything submitted has to be verified here. Tokens last
 *  five minutes and work once; a replayed one comes back as
 *  timeout-or-duplicate.
 */
export async function verifyTurnstile(
  token: string | null | undefined,
  ip?: string | null,
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  // Not configured means not enforced. Failing open here is deliberate:
  // an unconfigured challenge should not lock everybody out of the
  // portal, and the absence is visible in Cloudflare's own analytics as
  // zero validations.
  if (!secret) return { ok: true };

  if (!token) {
    return { ok: false, reason: 'The challenge did not complete. Reload and try again.' };
  }

  try {
    const body = new FormData();
    body.append('secret', secret);
    body.append('response', token);
    if (ip) body.append('remoteip', ip);

    // A timeout, because a challenge service that hangs must not hang
    // the sign-in with it.
    const res = await fetch(VERIFY, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(8000),
    });

    const result = await res.json() as {
      success: boolean; 'error-codes'?: string[];
    };

    if (result.success) return { ok: true };

    const codes = result['error-codes'] ?? [];
    return {
      ok: false,
      codes,
      // Said in words rather than codes. "timeout-or-duplicate" means a
      // page left open too long, which is a thing a person can act on.
      reason: codes.includes('timeout-or-duplicate')
        ? 'That page was open too long. Reload and try again.'
        : 'The challenge could not be verified. Reload and try again.',
    };
  } catch {
    // Cloudflare unreachable. Letting the attempt through is right — the
    // password still has to be correct, and 2FA still applies.
    return { ok: true };
  }
}

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
