'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { checkPassword } from '@/lib/passwordCheck';
import { useState, useTransition } from 'react';
import { acceptInvitation } from '@/app/actions/join';

type Row = Record<string, any>;

/* ═══════════════════════════════════════════════════════════════════════
   ACCEPTING AN INVITATION

   The only way an account comes into existence. The role was chosen
   before the invitation was sent, so the account has the right access
   from its first second rather than being granted it afterwards.
   ═══════════════════════════════════════════════════════════════════════ */

export default function AcceptInvitation({
  invite, state, token,
}: { invite: Row | null; state: string; token: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [firstName, setFirstName] = useState(invite?.first_name ?? '');
  const [surname, setSurname] = useState(invite?.surname ?? '');
  const [msg, setMsg] = useState('');

  const problems: Record<string, string> = {
    unknown: 'That link does not match an invitation. It may have been mistyped.',
    used: 'That invitation has already been used. If this was not you, tell whoever invited you.',
    withdrawn: 'That invitation has been withdrawn.',
    expired: 'That invitation has expired. Invitations last seven days — ask for another.',
  };

  const wrap = (children: React.ReactNode) => (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center',
                  background: 'var(--warm-white)', padding: 'var(--s6)' }}>
      <div style={{ maxWidth: 460, width: '100%' }}>
        <div className="lockup" style={{ color: 'var(--charcoal)', marginBottom: 'var(--s6)' }}>
          <div className="lk-rule" style={{ color: 'var(--charcoal)', marginTop: 0 }}>
            <span className="lk-word caps" style={{ color: 'var(--charcoal)' }}>
              The Global Sanctum
            </span>
          </div>
        </div>
        {children}
      </div>
    </div>
  );

  if (state !== 'valid') {
    return wrap(
      <>
        <div className="note bad">{problems[state]}</div>
        <Link className="btn quiet" href="/login">Back to sign in</Link>
      </>
    );
  }

  const tooShort = password.length > 0 && password.length < 12;
  const mismatch = confirm.length > 0 && password !== confirm;

  const sel: React.CSSProperties = {
    background: 'var(--warm-white)', border: '1px solid var(--border-input)',
    padding: '9px 11px', width: '100%', fontSize: 14,
  };

  return wrap(
    <>
      <h2 style={{ fontSize: 27, marginBottom: 'var(--s2)' }}>
        {invite!.first_name ? `Welcome, ${invite!.first_name}` : 'Set up your account'}
      </h2>
      <p style={{ fontSize: 13.5, color: 'var(--ink-quiet)', lineHeight: 1.6,
                  marginBottom: 'var(--s5)' }}>
        You have been invited as <strong>{invite!.role_definitions?.name}</strong>.
        {invite!.message && <> {invite!.message}</>}
      </p>

      {invite!.role_definitions?.description && (
        <div className="note">{invite!.role_definitions.description}</div>
      )}

      <div className="f">
        <label>Email</label>
        <input value={invite!.email} disabled style={{ ...sel, opacity: 0.6 }} />
        <span className="help">
          The address the invitation was sent to. It cannot be changed here.
        </span>
      </div>

      <div style={{ display: 'flex', gap: 'var(--s3)' }}>
        <div className="f" style={{ flex: 1 }}>
          <label>First name</label>
          <input data-bwignore value={firstName} style={sel}
            onChange={(e) => setFirstName(e.target.value)} />
        </div>
        <div className="f" style={{ flex: 1 }}>
          <label>Surname</label>
          <input data-bwignore value={surname} style={sel}
            onChange={(e) => setSurname(e.target.value)} />
        </div>
      </div>

      <div className="f">
        <label>Choose a password</label>
        <input type="password" value={password} style={sel}
          autoComplete="new-password"
          onChange={(e) => setPassword(e.target.value)} />
        <span className="help" style={{ color: tooShort ? 'var(--bad)' : undefined }}>
          At least twelve characters. Length matters more than punctuation — a long phrase
          beats a short one with symbols in it.
        </span>
      </div>

      <div className="f">
        <label>Confirm password</label>
        <input type="password" value={confirm} style={sel}
          autoComplete="new-password"
          onChange={(e) => setConfirm(e.target.value)} />
        {mismatch && <span className="help" style={{ color: 'var(--bad)' }}>
          These do not match.
        </span>}
      </div>

      {msg && <div className="note bad">{msg}</div>}

      <button className="btn" style={{ width: '100%', marginTop: 'var(--s3)' }}
        disabled={pending || password.length < 12 || password !== confirm}
        onClick={() => start(async () => {
          // Breach-checked before the account exists. Length rules do not
          // catch the real problem — "Password123!" satisfies most
          // complexity requirements and appears in breach corpora
          // millions of times.
          setMsg('Checking the password…');
          const verdict = await checkPassword(password);
          if (!verdict.ok) { setMsg(verdict.reason ?? 'Choose a different password.'); return; }

          const res = await acceptInvitation(token, password, firstName, surname);
          if (res.ok) { router.push('/home'); return; }
          setMsg(res.error);
        })}>
        {pending ? 'Setting up…' : 'Create my account'}
      </button>
    </>
  );
}
