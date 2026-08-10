'use client';

import { useState, useTransition } from 'react';
import { claimMyAccount, inviteUser, sendPasswordReset, setPermission, setRole, setUserField } from '@/app/actions/users';
import { useSaveState } from './SaveState';

type U = Record<string, any>;
type Area = { id: number; area_key: string; label: string; description: string | null };

const ROLES = ['Administrator', 'Manager', 'Concierge', 'Editor', 'Finance', 'Read only'];

export default function UsersManager({
  users, areas, roles, perms, currentAuthId, linked,
}: {
  users: U[]; areas: Area[]; roles: U[]; perms: U[];
  currentAuthId: string | null; linked: boolean;
}) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');
  const [email, setEmail] = useState('');
  const [open, setOpen] = useState<number | null>(null);

  if (!linked) {
    return (
      <>
        <div className="note bad">
          <strong>Your login is not linked to a portal account yet.</strong> Supabase Auth holds the
          login; <code>app_users</code> holds the person. Link them to continue — the first account
          created is granted Administrator, since otherwise no one could grant access to anyone.
        </div>
        <button className="btn" disabled={pending}
          onClick={() => start(async () => {
            report('saving');
            const res = await claimMyAccount();
            setMsg(res.ok ? (res.message ?? 'Linked.') : res.error);
            report(res.ok ? 'saved' : 'error', res.ok ? undefined : 'Failed');
          })}>Link my account</button>
        {msg && <div className="note" style={{ marginTop: 'var(--s4)' }}>{msg}</div>}
      </>
    );
  }

  return (
    <>
      <div className="sect">
        <h3>Invite</h3>
        <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'flex-end' }}>
          <div className="f" style={{ minWidth: 340 }}>
            <label htmlFor="inv">Email address</label>
            <input data-bwignore data-1p-ignore data-lpignore="true" data-form-type="other" id="inv" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                   placeholder="name@theglobalsanctum.com" />
            <span className="help">
              Requires SUPABASE_SERVICE_ROLE_KEY in Vercel, server-side only. Without it, create the
              login in Supabase → Authentication → Users, then reload this page.
            </span>
          </div>
          <button className="btn" disabled={pending || !email.trim()}
            onClick={() => start(async () => {
              report('saving');
              const res = await inviteUser(email);
              setMsg(res.ok ? (res.message ?? 'Sent.') : res.error);
              if (res.ok) setEmail('');
              report(res.ok ? 'saved' : 'error', res.ok ? undefined : 'Not sent');
            })}>Send invite</button>
        </div>
        {msg && <div className="note" style={{ marginTop: 'var(--s4)' }}>{msg}</div>}
      </div>

      <div className="sect">
        <h3>Accounts</h3>
        <div className="ph-sub" style={{ marginBottom: 'var(--s4)' }}>
          {users.length} account{users.length === 1 ? '' : 's'} · <code>app_users</code>
        </div>

        <div className="rows">
          {users.map((u) => (
            <UserCard key={u.id} u={u} areas={areas}
              roles={roles.filter((r) => r.app_user_id === u.id).map((r) => r.role)}
              perms={perms.filter((p) => p.app_user_id === u.id)}
              isMe={u.auth_user_id === currentAuthId}
              open={open === u.id} onToggle={() => setOpen(open === u.id ? null : u.id)} />
          ))}
        </div>
      </div>
    </>
  );
}

function UserCard({
  u, areas, roles, perms, isMe, open, onToggle,
}: {
  u: U; areas: Area[]; roles: string[]; perms: U[];
  isMe: boolean; open: boolean; onToggle: () => void;
}) {
  const { report } = useSaveState();
  const [, start] = useTransition();
  const isAdmin = roles.includes('Administrator');

  const act = (fn: () => Promise<any>) => start(async () => {
    report('saving');
    const res = await fn();
    report(res.ok ? 'saved' : 'error', res.ok ? undefined : 'Not saved');
    if (!res.ok) alert(res.error);
  });

  const name = [u.first_name, u.surname].filter(Boolean).join(' ') || u.email;

  return (
    <div className="row-card">
      <header>
        <div>
          <div className="rt">{name}{isMe && ' · you'}</div>
          <div style={{ fontSize: 13, color: 'var(--ink-quiet)' }}>
            {u.email} · {u.status ?? 'Unknown'}
            {roles.length ? ` · ${roles.join(', ')}` : ' · no role'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--s4)', alignItems: 'center' }}>
          <button className="link-btn"
            onClick={() => act(() => sendPasswordReset(u.email, window.location.origin))}>
            Send reset
          </button>
          <button className="link-btn" onClick={onToggle}>{open ? 'Close' : 'Edit'}</button>
        </div>
      </header>

      {open && (
        <>
          <div className="grid">
            <TextField label="First name" value={u.first_name}
              onSave={(v) => act(() => setUserField(u.id, 'first_name', v))} />
            <TextField label="Surname" value={u.surname}
              onSave={(v) => act(() => setUserField(u.id, 'surname', v))} />
            <TextField label="Phone" value={u.phone}
              onSave={(v) => act(() => setUserField(u.id, 'phone', v))} />
            <TextField label="Department" value={u.department}
              onSave={(v) => act(() => setUserField(u.id, 'department', v))} />
            <div className="f">
              <label>Status</label>
              <select data-bwignore data-1p-ignore data-lpignore="true" data-form-type="other" defaultValue={u.status ?? 'Active'}
                onChange={(e) => act(() => setUserField(u.id, 'status', e.target.value))}>
                {['Active', 'Invited', 'Suspended', 'Archived'].map((s) =>
                  <option key={s} value={s}>{s}</option>)}
              </select>
              <span className="help">Only Active accounts pass has_area()</span>
            </div>
          </div>

          <div style={{ marginTop: 'var(--s6)' }}>
            <h4 style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600,
                         letterSpacing: '.08em', textTransform: 'uppercase',
                         color: 'var(--ink-quiet)', marginBottom: 'var(--s3)' }}>Roles</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--s2)' }}>
              {ROLES.map((r) => {
                const has = roles.includes(r);
                return (
                  <button key={r} className={`pill ${has ? 'gold' : ''}`}
                    style={{ cursor: 'pointer', background: has ? undefined : 'var(--warm-white)' }}
                    onClick={() => act(() => setRole(u.id, r, !has))}>{r}</button>
                );
              })}
            </div>
          </div>

          <div style={{ marginTop: 'var(--s6)' }}>
            <h4 style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600,
                         letterSpacing: '.08em', textTransform: 'uppercase',
                         color: 'var(--ink-quiet)', marginBottom: 'var(--s3)' }}>Area access</h4>

            {isAdmin && (
              <div className="note">
                Administrators pass every area check regardless of these tickboxes.
                Remove the Administrator role to apply area-level access.
              </div>
            )}

            <table>
              <thead><tr><th>Area</th><th style={{ width: 110 }}>View</th><th style={{ width: 110 }}>Edit</th></tr></thead>
              <tbody>
                {areas.map((a) => {
                  const p = perms.find((x) => x.area_id === a.id);
                  const view = !!p?.can_view, edit = !!p?.can_edit;
                  return (
                    <tr key={a.id}>
                      <td>
                        <div>{a.label}</div>
                        {a.description && (
                          <div style={{ fontSize: 12, color: 'var(--ink-quiet)' }}>{a.description}</div>
                        )}
                      </td>
                      <td>
                        <input data-bwignore data-1p-ignore data-lpignore="true" data-form-type="other" type="checkbox" checked={view} style={{ width: 20, height: 20 }}
                          onChange={(e) => act(() => setPermission(u.id, a.id, e.target.checked, edit && e.target.checked))} />
                      </td>
                      <td>
                        <input data-bwignore data-1p-ignore data-lpignore="true" data-form-type="other" type="checkbox" checked={edit} style={{ width: 20, height: 20 }}
                          onChange={(e) => act(() => setPermission(u.id, a.id, view || e.target.checked, e.target.checked))} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="note" style={{ marginTop: 'var(--s4)' }}>
              Ticking Edit grants View automatically — you cannot change what you cannot see.
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TextField({
  label, value, onSave,
}: { label: string; value: string | null; onSave: (v: string | null) => void }) {
  const [v, setV] = useState(value ?? '');
  return (
    <div className="f">
      <label>{label}</label>
      <input data-bwignore data-1p-ignore data-lpignore="true" data-form-type="other" value={v} onChange={(e) => setV(e.target.value)}
        onBlur={() => v !== (value ?? '') && onSave(v === '' ? null : v)} />
    </div>
  );
}
