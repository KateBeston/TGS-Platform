'use client';

import { useState, useTransition } from 'react';
import { grantRole, revokeRole } from '@/app/actions/people';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

/* ═══════════════════════════════════════════════════════════════════════
   WHO CAN DO WHAT

   Three layers, answering different questions.

     Role        who somebody is
     Area        which sections they can open
     Capability  what kind of thing they may do at all

   The third is easy to miss. A concierge can open Bookings and still not
   see what a venue is charged, because seeing money is a capability
   rather than a section.

   Rank does exactly two things: administrator and above pass every area
   check, and nobody may grant a role at or above their own. The second is
   enforced in the database — an administrator who can appoint
   administrators is not a level of access, it is a formality.
   ═══════════════════════════════════════════════════════════════════════ */

export default function PeopleAccess({
  people, roles, myRank,
}: { people: Row[]; roles: Row[]; myRank: number }) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState<number | null>(null);
  const [msg, setMsg] = useState('');

  const act = (fn: () => Promise<any>) => start(async () => {
    report('saving');
    const res = await fn();
    setMsg(res?.ok === false ? res.error : (res?.message ?? ''));
    report(res?.ok === false ? 'error' : 'saved');
  });

  const internal = roles.filter((r) => r.audience === 'Internal');
  const external = roles.filter((r) => r.audience !== 'Internal');
  const canManage = people.some((p) => p.manages_users);

  return (
    <>
      <div className="ph">
        <div>
          <h2>People and access</h2>
          <div className="ph-sub">
            {people.length} account{people.length === 1 ? '' : 's'} · your level is {myRank}
          </div>
        </div>
      </div>

      <div className="note">
        <strong>Three layers.</strong> A <em>role</em> says who somebody is. An <em>area</em> says
        which sections they can open. A <em>capability</em> says what kind of thing they may do at
        all — see money, delete records, manage people.</div>

      <div className="note">
        <strong>Nobody may grant a role at or above their own.</strong> Enforced in the database
        rather than the interface, because an interface is a suggestion. An administrator who can
        appoint administrators is not a level of access.
      </div>

      {msg && <div className="note">{msg}</div>}

      <div className="sect">
        <h3>Accounts</h3>
        {people.map((p) => (
          <div className="row-card" key={p.app_user_id} style={{ marginBottom: 'var(--s2)' }}>
            <header>
              <div>
                <div className="rt" style={{ fontSize: 18 }}>
                  {[p.first_name, p.surname].filter(Boolean).join(' ') || p.email}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-quiet)', marginTop: 2 }}>
                  {p.email} · level {p.rank ?? 0} · {p.areas_granted} area
                  {p.areas_granted === 1 ? '' : 's'}
                </div>
                <div style={{ marginTop: 5, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {(p.roles ?? []).filter(Boolean).map((r: string) => (
                    <span key={r} className="pill gold" style={{ fontSize: 10 }}>{r}</span>
                  ))}
                  {p.manages_users && (
                    <span className="pill" style={{ fontSize: 9 }}>Manages people</span>
                  )}
                  {p.sees_financials && (
                    <span className="pill" style={{ fontSize: 9 }}>Sees money</span>
                  )}
                  {p.can_delete && (
                    <span className="pill" style={{ fontSize: 9, borderColor: 'var(--bad)',
                                                    color: 'var(--bad)' }}>Can delete</span>
                  )}
                  {p.needs_2fa && (
                    <span className="pill empty" style={{ fontSize: 9 }}>2FA required</span>
                  )}
                </div>
              </div>
              {canManage && (
                <button className="link-btn"
                  onClick={() => setOpen(open === p.app_user_id ? null : p.app_user_id)}>
                  {open === p.app_user_id ? 'Close' : 'Change'}
                </button>
              )}
            </header>

            {open === p.app_user_id && (
              <div>
                {[['Internal', internal], ['External and partners', external]].map(
                  ([label, list]: any) => (
                    <div key={label} style={{ marginBottom: 'var(--s4)' }}>
                      <div style={{ fontSize: 9, letterSpacing: '.14em',
                                    textTransform: 'uppercase', color: 'var(--ink-quiet)',
                                    marginBottom: 6 }}>{label}</div>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {list.map((r: Row) => {
                          const held = (p.roles ?? []).includes(r.name);
                          // A role at or above your own cannot be granted,
                          // so it is shown as unavailable rather than
                          // failing on click.
                          // Above your own is refused; at your own is
                          // allowed only at the top of the hierarchy.
                          const topRank = Math.max(
                            ...roles.map((x) => Number(x.rank ?? 0)), 0);
                          const tooHigh = r.rank > myRank
                            || (r.rank === myRank && myRank < topRank);
                          return (
                            <button key={r.role_key} type="button"
                              className={`pill ${held ? 'gold' : ''}`}
                              disabled={pending || tooHigh}
                              title={tooHigh
                                ? 'Above your own level'
                                : r.description}
                              style={{
                                cursor: tooHigh ? 'not-allowed' : 'pointer',
                                opacity: tooHigh ? 0.4 : 1,
                                background: held ? undefined : 'var(--warm-white)',
                              }}
                              onClick={() => act(() => held
                                ? revokeRole(p.app_user_id, r.role_key)
                                : grantRole(p.app_user_id, r.role_key))}>
                              {r.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                <div className="note" style={{ marginBottom: 0 }}>
                  Granting a role applies its default areas — so access is one decision rather than
                  eleven boxes ticked and one forgotten. Adjust individual areas afterwards if the
                  defaults are not right.
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="sect">
        <h3>What each role means</h3>
        <table>
          <thead>
            <tr><th>Role</th><th>Level</th><th>What it is for</th><th>Also</th></tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr key={r.role_key}>
                <td>
                  <span className="v-name" style={{ fontSize: 15 }}>{r.name}</span>
                  <div className="v-slug">{r.audience}</div>
                </td>
                <td className="v-slug">{r.rank}</td>
                <td style={{ maxWidth: 420, fontSize: 12.5, lineHeight: 1.55 }}>
                  {r.description}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    {r.can_manage_users && <span className="pill empty" style={{ fontSize: 9 }}>People</span>}
                    {r.can_delete_records && <span className="pill empty" style={{ fontSize: 9 }}>Delete</span>}
                    {r.can_see_financials && <span className="pill empty" style={{ fontSize: 9 }}>Money</span>}
                    {r.requires_2fa && <span className="pill empty" style={{ fontSize: 9 }}>2FA</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
