'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { saveMyProfile } from '@/app/actions/profile';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

const sel: React.CSSProperties = {
  background: 'var(--warm-white)', border: '1px solid var(--border-input)',
  padding: '8px 10px', fontSize: 13.5, width: '100%',
};

const TIMEZONES = [
  'Australia/Brisbane', 'Australia/Sydney', 'Australia/Melbourne',
  'Australia/Adelaide', 'Australia/Perth', 'Australia/Darwin',
  'Pacific/Auckland', 'Asia/Denpasar', 'Asia/Bangkok', 'Asia/Singapore',
  'Europe/London', 'Europe/Madrid', 'Europe/Athens', 'America/New_York',
];

/* ═══════════════════════════════════════════════════════════════════════
   MY PROFILE

   What somebody may change about themselves is deliberately narrow: their
   name, how they are contacted, how they appear on a record.

   Not their role, not their areas, not whether the account is active.
   Those are somebody else's to grant, and protecting them elsewhere would
   be pointless if a person could set them here.
   ═══════════════════════════════════════════════════════════════════════ */

export default function MyProfile({ profile }: { profile: Row | null }) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');

  if (!profile) {
    return (
      <div className="note bad">
        This login has no portal account attached. Nothing here will work properly until it does.
      </div>
    );
  }

  const save = (column: string, value: unknown) => start(async () => {
    report('saving');
    const r = await saveMyProfile(column, value);
    report(r.ok ? 'saved' : 'error');
    if (!r.ok) setMsg((r as any).error);
  });

  const roles = (profile.user_roles ?? [])
    .map((r: any) => r.role_definitions?.name).filter(Boolean);
  const areas = (profile.permissions ?? []);

  return (
    <>
      {msg && <div className="note bad">{msg}</div>}

      <div className="sect">
        <h3>You</h3>
        <div className="grid">
          <div className="f">
            <label>First name</label>
            <input data-bwignore defaultValue={profile.first_name ?? ''} style={sel}
              onBlur={(e) => e.target.value !== (profile.first_name ?? '')
                && save('first_name', e.target.value || null)} />
          </div>
          <div className="f">
            <label>Surname</label>
            <input data-bwignore defaultValue={profile.surname ?? ''} style={sel}
              onBlur={(e) => e.target.value !== (profile.surname ?? '')
                && save('surname', e.target.value || null)} />
          </div>
          <div className="f">
            <label>Display name</label>
            <input data-bwignore defaultValue={profile.display_name ?? ''} style={sel}
              onBlur={(e) => e.target.value !== (profile.display_name ?? '')
                && save('display_name', e.target.value || null)} />
            <span className="help">
              Follows your name unless you set it. Not a login — the email is that.
            </span>
          </div>
          <div className="f">
            <label>Job title</label>
            <input data-bwignore defaultValue={profile.job_title ?? ''} style={sel}
              onBlur={(e) => e.target.value !== (profile.job_title ?? '')
                && save('job_title', e.target.value || null)} />
          </div>
          <div className="f">
            <label>Phone</label>
            <input data-bwignore type="tel" defaultValue={profile.phone ?? ''} style={sel}
              onBlur={(e) => e.target.value !== (profile.phone ?? '')
                && save('phone', e.target.value || null)} />
          </div>
          <div className="f">
            <label>Time zone</label>
            <select defaultValue={profile.timezone ?? 'Australia/Brisbane'} style={sel}
              onChange={(e) => save('timezone', e.target.value)}>
              {TIMEZONES.map((t) => (
                <option key={t} value={t}>{t.split('/')[1].replace(/_/g, ' ')}</option>
              ))}
            </select>
            <span className="help">Used for dates and times shown to you</span>
          </div>
          {profile.is_external && (
            <div className="f">
              <label>Company</label>
              <input data-bwignore defaultValue={profile.company ?? ''} style={sel}
                onBlur={(e) => e.target.value !== (profile.company ?? '')
                  && save('company', e.target.value || null)} />
            </div>
          )}
        </div>
      </div>

      <div className="sect">
        <h3>What you can reach</h3>
        <div className="ph-sub" style={{ marginBottom: 'var(--s3)' }}>
          Granted rather than chosen — ask whoever set up your account if something is missing
        </div>

        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap',
                      marginBottom: 'var(--s4)' }}>
          {roles.map((r: string) => (
            <span key={r} className="pill gold">{r}</span>
          ))}
          {profile.is_external && (
            <span className="pill empty">External</span>
          )}
        </div>

        {!areas.length ? (
          <div className="note" style={{ marginBottom: 0 }}>
            No specific areas granted. Administrators and above reach everything without needing
            them listed.
          </div>
        ) : (
          <table>
            <thead><tr><th>Area</th><th>Can see</th><th>Can change</th></tr></thead>
            <tbody>
              {areas.map((a: any, i: number) => (
                <tr key={i}>
                  <td>
                    <span className="v-name" style={{ fontSize: 14 }}>
                      {a.permission_areas?.label ?? a.permission_areas?.area_key}
                    </span>
                    {a.permission_areas?.description && (
                      <div className="v-slug">{a.permission_areas.description}</div>
                    )}
                  </td>
                  <td>{a.can_view ? '·' : '—'}</td>
                  <td>{a.can_edit ? '·' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {profile.is_external && (
        <div className="note">
          Your account uses an address TGS does not control, so a second factor is required
          regardless of what you do here. If that mailbox were ever compromised, password resets
          would go somewhere TGS cannot reach.
        </div>
      )}
    </>
  );
}
