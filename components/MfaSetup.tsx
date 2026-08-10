'use client';

import { useEffect, useState } from 'react';
import { markEnrolled } from '@/app/actions/security';
import { createClient } from '@/lib/supabase/client';

type Factor = { id: string; friendly_name?: string; status: string; created_at: string };

/** TOTP enrolment. The secret never leaves Supabase — the QR code is
 *  generated server-side and shown once. An authenticator app derives the
 *  six-digit code from it, so nothing is transmitted at sign-in. */
export default function MfaSetup() {

  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function load() {
    const supabase = createClient();
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors((data?.totp ?? []) as Factor[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function begin() {
    const supabase = createClient();
    setMsg(null); setBusy(true);
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `Authenticator ${new Date().toLocaleDateString('en-AU')}`,
    });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    setFactorId(data.id);
    setQr(data.totp.qr_code);
    setSecret(data.totp.secret);
  }


  async function confirmEnrolment() {
    const supabase = createClient();
    if (!factorId) return;
    setMsg(null); setBusy(true);
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
    if (chErr) { setBusy(false); return setMsg({ ok: false, text: chErr.message }); }

    const { error } = await supabase.auth.mfa.verify({
      factorId, challengeId: ch.id, code: code.trim(),
    });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: 'That code was not accepted. Codes expire every 30 seconds — try the current one.' });

    setQr(null); setSecret(null); setFactorId(null); setCode('');
    // Supabase knows about the factor; app_users does not, and the whole
    // question of who still needs to set this up is answered from there.
    await markEnrolled();
    setMsg({ ok: true, text:
      'Two-factor authentication is on. Generate recovery codes below before you close this — '
      + 'without them, losing this phone means losing the account.' });
    load();
  }

  async function remove(id: string) {
    const supabase = createClient();
    if (!window.confirm('Remove this authenticator? Sign-in will no longer require a code.')) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    await markEnrolled();
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    setMsg({ ok: true, text: 'Authenticator removed.' });
    load();
  }

  const verified = factors.filter((f) => f.status === 'verified');

  return (
    <div className="sect">
      <h3>Two-factor authentication</h3>

      <div className="note">
        <strong>The single most useful thing you can do for this account.</strong> A stolen or
        guessed password is not enough on its own once this is on — an attacker also needs the
        device holding your authenticator app.
      </div>

      {loading && <div className="note">Checking…</div>}

      {!loading && verified.length > 0 && !qr && (
        <>
          <table>
            <thead><tr><th>Authenticator</th><th>Added</th><th style={{ width: 120 }}></th></tr></thead>
            <tbody>
              {verified.map((f) => (
                <tr key={f.id}>
                  <td>{f.friendly_name ?? 'Authenticator app'}</td>
                  <td>{new Date(f.created_at).toLocaleDateString('en-AU')}</td>
                  <td>
                    <button className="link-btn" disabled={busy}
                      onClick={() => remove(f.id)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="btn quiet" style={{ marginTop: 'var(--s4)' }}
                  disabled={busy} onClick={begin}>Add another device</button>
        </>
      )}

      {!loading && verified.length === 0 && !qr && (
        <button className="btn" disabled={busy} onClick={begin}>
          {busy ? 'Preparing…' : 'Turn on two-factor authentication'}
        </button>
      )}

      {qr && (
        <>
          <div className="grid" style={{ alignItems: 'start' }}>
            <div>
              <div className="f"><label>1 · Scan this</label></div>
              <div style={{ background: 'var(--warm-white)', border: 'var(--rule)',
                            padding: 'var(--s4)', display: 'inline-block' }}>
                <img src={qr} alt="Two-factor QR code" width={200} height={200} />
              </div>
              <p className="help" style={{ marginTop: 'var(--s3)' }}>
                Use any authenticator app — 1Password, Authy, Google Authenticator, or your
                phone's built-in one.
              </p>
              {secret && (
                <p className="help">
                  Cannot scan? Enter this key manually:<br />
                  <code style={{ fontSize: 13, wordBreak: 'break-all' }}>{secret}</code>
                </p>
              )}
            </div>

            <div>
              <div className="f">
                <label htmlFor="code">2 · Enter the six-digit code</label>
                <input id="code" value={code} inputMode="numeric" autoComplete="one-time-code"
                       placeholder="000000" maxLength={6}
                       onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
                <span className="help">The code changes every 30 seconds.</span>
              </div>
              <button className="btn" style={{ marginTop: 'var(--s4)' }}
                      disabled={busy || code.length < 6} onClick={confirmEnrolment}>
                {busy ? 'Checking…' : 'Confirm and turn on'}
              </button>
              <div className="note" style={{ marginTop: 'var(--s5)', marginBottom: 0 }}>
                <strong>Before you finish:</strong> if you lose this device you lose access to the
                portal. Add a second authenticator, or keep the manual key somewhere safe and
                separate from your password.
              </div>
            </div>
          </div>
        </>
      )}

      {msg && (
        <div className={`note ${msg.ok ? '' : 'bad'}`}
             style={{ marginTop: 'var(--s4)', marginBottom: 0 }}>{msg.text}</div>
      )}
    </div>
  );
}
