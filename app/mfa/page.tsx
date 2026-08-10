'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/** Shown after a correct password when the account has an authenticator.
 *  Supabase calls this raising the assurance level from aal1 to aal2. */
export default function MfaChallengePage() {
  const router = useRouter();

  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [recovering, setRecovering] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.mfa.listFactors().then(({ data }) => {
      const verified = (data?.totp ?? []).find((f: any) => f.status === 'verified');
      if (!verified) router.replace('/home');
      else setFactorId(verified.id);
    });
  }, [router]);

  async function submit() {
    if (!factorId) return;
    const supabase = createClient();
    setBusy(true); setErr('');
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
    if (chErr) { setBusy(false); return setErr(chErr.message); }

    const { error } = await supabase.auth.mfa.verify({
      factorId, challengeId: ch.id, code: code.trim(),
    });
    setBusy(false);
    if (error) { setCode(''); return setErr('That code was not accepted. Codes expire every 30 seconds.'); }
    router.push('/home');
    router.refresh();
  }

  return (
    <div className="signin">
      <div className="signin-card">
        <h1>Verification</h1>
        <p className="sub">The Global Sanctum</p>

        <div className="f">
          <label htmlFor="code">Six-digit code</label>
          <input id="code" value={code} inputMode="numeric" autoComplete="one-time-code"
                 placeholder="000000" maxLength={6} autoFocus
                 onKeyDown={(e) => e.key === 'Enter' && code.length === 6 && submit()}
                 onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
          <span className="help">From your authenticator app.</span>
        </div>

        <button className="btn" disabled={busy || code.length < 6} onClick={submit}>
          {busy ? 'Checking…' : 'Verify'}
        </button>

        {err && <div className="note bad" style={{ marginTop: 'var(--s4)', marginBottom: 0 }}>{err}</div>}

        <div className="signin-foot">
          {!recovering ? (
            <button className="link-btn" onClick={() => setRecovering(true)}>
              Lost the device with your authenticator?
            </button>
          ) : (
            <>
              <p style={{ fontSize: 13, lineHeight: 1.6, margin: '0 0 var(--s3)' }}>
                Use one of your recovery codes. It removes the authenticator from this account
                and returns you to password-only sign-in, so you can set up a new one.
              </p>

              <div className="f">
                <label htmlFor="re">Your email</label>
                <input id="re" type="email" data-bwignore value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)} />
              </div>

              <div className="f">
                <label htmlFor="rc">Recovery code</label>
                <input id="rc" data-bwignore value={recoveryCode}
                  placeholder="ABCD-EFGH" autoComplete="off"
                  onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())} />
                <span className="help">Each works once</span>
              </div>

              <button className="btn" style={{ width: '100%' }}
                disabled={busy || !recoveryEmail || recoveryCode.length < 8}
                onClick={async () => {
                  setBusy(true); setErr('');
                  const res = await fetch('/api/recovery', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: recoveryEmail, code: recoveryCode }),
                  });
                  const r = await res.json();
                  setBusy(false);
                  if (r.ok) { router.push('/login?recovered=1'); return; }
                  setErr(String(r.error ?? 'That code was not accepted.'));
                }}>
                {busy ? 'Checking…' : 'Use this code'}
              </button>

              <button className="link-btn" style={{ marginTop: 'var(--s3)' }}
                onClick={() => setRecovering(false)}>
                Back to the code
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
