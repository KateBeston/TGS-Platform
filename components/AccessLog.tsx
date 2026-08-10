'use client';

import { useState, useTransition } from 'react';
import { invitePerson, withdrawInvitation } from '@/app/actions/access';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

const EVENT_STYLE: Record<string, React.CSSProperties> = {
  'Signed in':        { borderColor: 'var(--ok)', color: 'var(--ok)' },
  'Signed out':       { color: 'var(--muted)' },
  'Failed':           { borderColor: 'var(--bad)', color: 'var(--bad)' },
  'Password reset':   { borderColor: 'var(--warn)', color: 'var(--warn)' },
  'Password changed': { borderColor: 'var(--warn)', color: 'var(--warn)' },
};

const sel: React.CSSProperties = {
  background: 'var(--warm-white)', border: '1px solid var(--border-input)',
  padding: '7px 9px', fontSize: 13, width: '100%',
};

/* ═══════════════════════════════════════════════════════════════════════
   INVITATIONS AND ACCESS

   No sign-up page, deliberately. An internal portal with self-service
   registration means anybody who finds the URL can create an account and
   wait to be noticed — and an account that exists before somebody decided
   it should is the wrong default.

   The role is chosen before the invitation goes out, so the account has
   the right access from its first second rather than being granted it
   afterwards.
   ═══════════════════════════════════════════════════════════════════════ */

export default function AccessLog({
  invitations, history, failed, roles, myRank, origin,
}: {
  invitations: Row[]; history: Row[]; failed: Row[];
  roles: Row[]; myRank: number; origin: string;
}) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [inviting, setInviting] = useState(false);
  const [form, setForm] = useState({ email: '', role: '', first: '', last: '', message: '' });
  const [link, setLink] = useState('');
  const [msg, setMsg] = useState('');

  const act = (fn: () => Promise<any>) => start(async () => {
    report('saving');
    const res = await fn();
    setMsg(res?.ok === false ? res.error : (res?.message ?? ''));
    report(res?.ok === false ? 'error' : 'saved');
    return res;
  });

  const open = invitations.filter((i) => i.status === 'Sent'
    && new Date(i.expires_at) > new Date());
  // Above your own is refused. At your own is allowed only at the top —
  // an owner appointing a second owner is deliberate; an administrator
  // appointing another is the formality the rule exists to stop.
  const topRank = Math.max(...roles.map((r) => Number(r.rank ?? 0)), 0);
  const grantable = roles.filter((r) =>
    r.rank < myRank || (r.rank === myRank && myRank === topRank));

  // A handful of failures against one address in a short window is
  // different from one a week apart.
  const byEmail = new Map<string, number>();
  failed.forEach((f) => byEmail.set(f.email, (byEmail.get(f.email) ?? 0) + 1));
  const repeated = [...byEmail.entries()].filter(([, n]) => n >= 4);

  return (
    <>
      {msg && <div className="note">{msg}</div>}

      {!!repeated.length && (
        <div className="note bad">
          <strong>Repeated failed attempts.</strong>{' '}
          {repeated.map(([email, n]) => `${email} (${n})`).join(', ')} — over the past week. One
          is a typo; several against one address is somebody trying.
        </div>
      )}

      {/* ── invitations ───────────────────────────────────────── */}
      <div className="sect">
        <div className="ph" style={{ marginBottom: 'var(--s3)' }}>
          <div>
            <h3 style={{ borderBottom: 0, marginBottom: 0, paddingBottom: 0 }}>
              Invitations
            </h3>
            <div className="ph-sub">
              {open.length ? `${open.length} open` : 'None open'}
            </div>
          </div>
          <div className="ph-act">
            <button className="btn" onClick={() => setInviting(!inviting)}>
              {inviting ? 'Close' : 'Invite somebody'}
            </button>
          </div>
        </div>

        <div className="note">
          Invitations are emailed automatically. The link is shown as well, so a Postmark failure
          does not stop you sending it by hand.
        </div>

        <div className="note">
          <strong>There is no sign-up page.</strong> An internal portal where anybody who finds
          the URL can register is a portal with accounts nobody decided on. The role is chosen
          here, before the invitation goes out.</div>

        {inviting && (
          <div className="grid" style={{ marginBottom: 'var(--s4)' }}>
            <div className="f">
              <label>Their email</label>
              <input data-bwignore type="email" value={form.email} style={sel}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="f">
              <label>As</label>
              <select value={form.role} style={sel}
                onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="">Choose a role</option>
                {grantable.map((r) => (
                  <option key={r.role_key} value={r.role_key}>{r.name}</option>
                ))}
              </select>
              <span className="help">
                Only roles below your own are listed
              </span>
            </div>
            <div className="f">
              <label>First name</label>
              <input data-bwignore value={form.first} style={sel}
                onChange={(e) => setForm({ ...form, first: e.target.value })} />
            </div>
            <div className="f">
              <label>Surname</label>
              <input data-bwignore value={form.last} style={sel}
                onChange={(e) => setForm({ ...form, last: e.target.value })} />
            </div>
            <div className="f" style={{ gridColumn: '1 / -1' }}>
              <label>Message to include in their email</label>
              <input data-bwignore value={form.message} style={sel}
                placeholder="Shown on the page where they set their password"
                onChange={(e) => setForm({ ...form, message: e.target.value })} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <button className="btn" disabled={pending || !form.email || !form.role}
                onClick={() => act(async () => {
                  // The origin has to go across, or the action has no
                  // address to build the link from and skips the email
                  // entirely — which looks identical to Postmark failing.
                  const r = await invitePerson(form.email, form.role,
                                               form.first, form.last, form.message,
                                               origin);
                  if (r.ok && r.token) {
                    setLink(`${origin}/join?token=${r.token}`);
                    setInviting(false);
                    setForm({ email: '', role: '', first: '', last: '', message: '' });
                  }
                  return r;
                })}>Create the invitation</button>
            </div>
          </div>
        )}

        {link && (
          <div className="note">
            <strong>Send them this.</strong> It works once and lasts seven days.
            <div style={{ marginTop: 8, padding: '8px 10px', background: 'var(--warm-cream)',
                          border: '1px solid var(--border)', fontSize: 12,
                          wordBreak: 'break-all', fontFamily: 'ui-monospace, monospace' }}>
              {link}
            </div>
            <div style={{ marginTop: 8 }}>
              <button className="link-btn"
                onClick={() => { navigator.clipboard?.writeText(link); setMsg('Copied.'); }}>
                Copy it
              </button>
            </div>
          </div>
        )}

        {!!invitations.length && (
          <table>
            <thead>
              <tr><th>Who</th><th>As</th><th>State</th><th>Expires</th><th></th></tr>
            </thead>
            <tbody>
              {invitations.map((i) => {
                const expired = new Date(i.expires_at) < new Date();
                const state = i.status === 'Sent' && expired ? 'Expired' : i.status;
                return (
                  <tr key={i.id}>
                    <td>
                      <span className="v-name" style={{ fontSize: 15 }}>{i.email}</span>
                      {(i.first_name || i.surname) && (
                        <div className="v-slug">
                          {[i.first_name, i.surname].filter(Boolean).join(' ')}
                        </div>
                      )}
                    </td>
                    <td className="v-slug">{i.role_definitions?.name}</td>
                    <td>
                      <span className="pill" style={{
                        borderColor: state === 'Accepted' ? 'var(--ok)'
                          : state === 'Sent' ? 'var(--gold)' : undefined,
                        color: state === 'Accepted' ? 'var(--ok)'
                          : state === 'Sent' ? undefined : 'var(--muted)',
                      }}>{state}</span>
                    </td>
                    <td className="v-slug">
                      {new Date(i.expires_at).toLocaleDateString('en-AU',
                        { day: 'numeric', month: 'short' })}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {i.status === 'Sent' && !expired && (
                        <button className="link-btn" disabled={pending}
                          onClick={() => act(() => withdrawInvitation(i.id))}>
                          Withdraw
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── who has been here ─────────────────────────────────── */}
      <div className="sect">
        <h3>Sign-ins</h3>
        <div className="ph-sub" style={{ marginBottom: 'var(--s3)' }}>
          Every sign-in, sign-out and failed attempt. Cannot be edited or deleted.
        </div>

        {!history.length && (
          <div className="note" style={{ marginBottom: 0 }}>
            Nothing recorded yet — this starts from the next sign-in.
          </div>
        )}

        {!!history.length && (
          <table>
            <thead>
              <tr><th>When</th><th>Who</th><th>What</th><th>Where from</th><th>For how long</th></tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td className="v-slug" style={{ whiteSpace: 'nowrap' }}>
                    {new Date(h.occurred_at).toLocaleDateString('en-AU',
                      { day: 'numeric', month: 'short' })}
                    <div>{new Date(h.occurred_at).toLocaleTimeString('en-AU',
                      { hour: 'numeric', minute: '2-digit' })}</div>
                  </td>
                  <td>
                    <span className="v-name" style={{ fontSize: 14 }}>{h.person}</span>
                  </td>
                  <td>
                    <span className="pill" style={EVENT_STYLE[h.event] ?? {}}>{h.event}</span>
                    {h.failure_reason && (
                      <div className="v-slug" style={{ color: 'var(--bad)' }}>
                        {h.failure_reason}
                      </div>
                    )}
                  </td>
                  <td className="v-slug">
                    {h.device}
                    {h.ip_address && <div>{h.ip_address}</div>}
                  </td>
                  <td className="v-slug">
                    {h.duration_minutes != null
                      ? h.duration_minutes < 60
                        ? `${h.duration_minutes} min`
                        : `${Math.floor(h.duration_minutes / 60)}h ${h.duration_minutes % 60}m`
                      : h.session_state === 'Left open'
                        ? 'Not signed out'
                        : h.session_state === 'Open' ? 'Still here' : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="note" style={{ marginTop: 'var(--s4)', marginBottom: 0 }}>
          <strong>&ldquo;Not signed out&rdquo; is not the same as still signed in.</strong> Closing
          a tab leaves no trace, so a session with no end could be either — which is worth knowing
          rather than guessing at.
        </div>
      </div>
    </>
  );
}
