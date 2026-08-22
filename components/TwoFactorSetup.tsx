'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Status = 'loading' | 'off' | 'enrolling' | 'on';

export default function TwoFactorSetup() {
  const supabase = createClient();
  const [status, setStatus] = useState<Status>('loading');
  const [factorId, setFactorId] = useState('');
  const [qr, setQr] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    const verified = data?.totp?.find((f) => f.status === 'verified');
    if (verified) { setFactorId(verified.id); setStatus('on'); }
    else setStatus('off');
  }, [supabase]);

  useEffect(() => { refresh(); }, [refresh]);

  const startEnroll = async () => {
    setError(''); setBusy(true);
    // clear any half-finished factors so enroll doesn't collide
    const { data: list } = await supabase.auth.mfa.listFactors();
    for (const f of list?.totp ?? []) if (f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error: err } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
    setBusy(false);
    if (err || !data) { setError(err?.message ?? 'Could not start setup.'); return; }
    setFactorId(data.id);
    setQr(data.totp.qr_code);
    setSecret(data.totp.secret);
    setStatus('enrolling');
  };

  const verify = async () => {
    setError(''); setBusy(true);
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
    if (chErr || !ch) { setBusy(false); setError(chErr?.message ?? 'Could not verify.'); return; }
    const { error: vErr } = await supabase.auth.mfa.verify({ factorId, challengeId: ch.id, code: code.trim() });
    setBusy(false);
    if (vErr) { setError('That code didn\u2019t match — enter the current 6-digit code from your app.'); return; }
    setCode(''); setQr(''); setSecret(''); setStatus('on');
  };

  const disable = async () => {
    setBusy(true);
    await supabase.auth.mfa.unenroll({ factorId });
    setBusy(false);
    setFactorId(''); setStatus('off');
  };

  if (status === 'loading') return <p className="acct-panel-sub">Checking two-factor status…</p>;

  if (status === 'on') {
    return (
      <div className="tfa">
        <p className="tfa-on"><span className="tfa-dot" /> Two-factor authentication is on.</p>
        <p className="acct-panel-sub">You&rsquo;ll enter a code from your authenticator app when you sign in.</p>
        <button type="button" className="acct-ghost-btn" onClick={disable} disabled={busy}>
          {busy ? 'Removing…' : 'Turn off two-factor'}
        </button>
      </div>
    );
  }

  if (status === 'enrolling') {
    return (
      <div className="tfa">
        <p className="acct-panel-sub">Scan this with an authenticator app (Google Authenticator, 1Password, Authy…), then enter the 6-digit code it shows.</p>
        <div className="tfa-qr" dangerouslySetInnerHTML={{ __html: qr }} />
        <p className="tfa-secret">Can&rsquo;t scan? Enter this key manually: <code>{secret}</code></p>
        <div className="acct-f" style={{ maxWidth: 220 }}>
          <span>6-digit code</span>
          <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} placeholder="123456" />
        </div>
        {error && <p className="acct-err">{error}</p>}
        <div className="acct-actions">
          <button type="button" className="acct-btn" onClick={verify} disabled={busy || code.trim().length < 6}>{busy ? 'Verifying…' : 'Verify & turn on'}</button>
          <button type="button" className="acct-ghost-btn" onClick={() => { setStatus('off'); setError(''); }}>Cancel</button>
        </div>
      </div>
    );
  }

  // off
  return (
    <div className="tfa">
      <p className="acct-panel-sub">Add a second step at sign-in using an authenticator app — a strong, free layer of protection for your account.</p>
      {error && <p className="acct-err">{error}</p>}
      <button type="button" className="acct-btn" onClick={startEnroll} disabled={busy}>{busy ? 'Starting…' : 'Set up two-factor'}</button>
    </div>
  );
}
