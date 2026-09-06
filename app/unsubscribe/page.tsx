import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

/* Leaving.
 *
 * The link is signed rather than looked up, so it cannot be forged and needs no
 * token table. Under the Spam Act an unsubscribe must be honoured within five
 * working days; honouring it on the spot is both easier and better, since a
 * complaint costs more than an unsubscribe does.
 *
 * The address is never shown in full and never appears in a query string.
 */

export const dynamic = 'force-dynamic';

function verify(token: string): string | null {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url').slice(0, 32);
  // Constant-time, so the signature cannot be guessed a character at a time.
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try { return Buffer.from(payload, 'base64url').toString('utf8'); } catch { return null; }
}

const mask = (email: string) => {
  const [name, domain] = email.split('@');
  if (!domain) return 'your address';
  return `${name.slice(0, 2)}${'\u2022'.repeat(Math.max(name.length - 2, 3))}@${domain}`;
};

export default async function Unsubscribe({
  searchParams,
}: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const email = t ? verify(t) : null;

  let done = false;
  if (email) {
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );
    await db.from('email_suppressions').upsert({
      email: email.toLowerCase(), reason: 'Unsubscribed', scope: 'Marketing',
      source: 'Unsubscribe link',
    }, { onConflict: 'email,reason' });
    await db.from('email_consents').insert({
      email: email.toLowerCase(), consent_type: 'Marketing',
      granted: false, source: 'Unsubscribe link',
    });
    done = true;
  }

  return (
    <div className="section section--cream" style={{ minHeight: '70vh' }}>
      <div className="wrap">
        <div className="prose-narrow" style={{ textAlign: 'center', paddingTop: 40 }}>
          {done ? (
            <>
              <div className="section-label">Unsubscribed</div>
              <h1 className="section-title">That&rsquo;s done</h1>
              <p>
                We have stopped sending marketing email to {mask(email!)}. It takes effect
                immediately.
              </p>
              <p style={{ marginTop: 24 }}>
                You will still receive anything about a booking you have made, because that
                concerns something you bought rather than something we are sending you.
              </p>
              <p style={{ marginTop: 24 }}>
                If this was a mistake, or you would rather choose what you hear about than
                stop altogether, write to{' '}
                <a href="mailto:hello@theglobalsanctum.com">hello@theglobalsanctum.com</a>{' '}
                and we will put it back.
              </p>
            </>
          ) : (
            <>
              <div className="section-label">Unsubscribe</div>
              <h1 className="section-title">This link is no longer valid</h1>
              <p>
                It may have been altered, or copied incompletely from an email. Open the
                original message and use the link there.
              </p>
              <p style={{ marginTop: 24 }}>
                Or write to <a href="mailto:hello@theglobalsanctum.com">hello@theglobalsanctum.com</a>{' '}
                and we will take you off by hand.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
