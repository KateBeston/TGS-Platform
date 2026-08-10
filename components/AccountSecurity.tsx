'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/** Self-service only. Changing your own password and email works with the
 *  public key and the current session — no admin access involved. */
export default function AccountSecurity({
  email, lastSignIn,
}: { email: string; lastSignIn: string | null }) {

  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  const [newEmail, setNewEmail] = useState('');
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [emailBusy, setEmailBusy] = useState(false);

  async function changePassword() {
    const supabase = createClient();
    setPwMsg(null);
    if (pw.length < 10) return setPwMsg({ ok: false, text: 'Use at least 10 characters.' });
    if (pw !== pw2) return setPwMsg({ ok: false, text: 'The two entries do not match.' });

    setPwBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setPwBusy(false);
    if (error) return setPwMsg({ ok: false, text: error.message });
    setPw(''); setPw2('');
    setPwMsg({ ok: true, text: 'Password changed. Other devices stay signed in until their session expires.' });
  }

  async function changeEmail() {
    const supabase = createClient();
    setEmailMsg(null);
    const clean = newEmail.trim().toLowerCase();
    if (!clean) return;

    setEmailBusy(true);
    const { error } = await supabase.auth.updateUser({ email: clean });
    setEmailBusy(false);
    if (error) return setEmailMsg({ ok: false, text: error.message });
    setNewEmail('');
    setEmailMsg({
      ok: true,
      text: `Confirmation sent to ${clean}. The address does not change until that link is opened, so the old one keeps working meanwhile.`,
    });
  }

  const Msg = ({ m }: { m: { ok: boolean; text: string } | null }) =>
    m ? <div className={`note ${m.ok ? '' : 'bad'}`} style={{ marginTop: 'var(--s4)', marginBottom: 0 }}>{m.text}</div> : null;

  return (
    <>
      <div className="sect">
        <h3>Session</h3>
        <table>
          <tbody>
            <tr><td style={{ width: 240, color: 'var(--ink-quiet)' }}>Signed in as</td><td>{email}</td></tr>
            <tr><td style={{ color: 'var(--ink-quiet)' }}>Last sign-in</td>
              <td>{lastSignIn ? new Date(lastSignIn).toLocaleString('en-AU') : 'Unknown'}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="sect">
        <h3>Change password</h3>
        <div className="grid">
          <div className="f">
            <label htmlFor="np">New password</label>
            <input id="np" type="password" autoComplete="new-password"
                   value={pw} onChange={(e) => setPw(e.target.value)} />
            <span className="help">Minimum 10 characters. A passphrase beats a short complex string.</span>
          </div>
          <div className="f">
            <label htmlFor="np2">Confirm new password</label>
            <input id="np2" type="password" autoComplete="new-password"
                   value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </div>
        </div>
        <button className="btn" style={{ marginTop: 'var(--s4)' }}
                disabled={pwBusy || !pw} onClick={changePassword}>
          {pwBusy ? 'Changing…' : 'Change password'}
        </button>
        <Msg m={pwMsg} />
      </div>

      <div className="sect">
        <h3>Change email</h3>
        <div className="grid">
          <div className="f">
            <label htmlFor="ne">New email address</label>
            <input id="ne" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            <span className="help">
              Requires confirmation. Needs email delivery configured on the Supabase project.
            </span>
          </div>
        </div>
        <button className="btn quiet" style={{ marginTop: 'var(--s4)' }}
                disabled={emailBusy || !newEmail.trim()} onClick={changeEmail}>
          {emailBusy ? 'Sending…' : 'Send confirmation'}
        </button>
        <Msg m={emailMsg} />
      </div>
    </>
  );
}
