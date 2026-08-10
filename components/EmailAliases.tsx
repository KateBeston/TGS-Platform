'use client';

import { useState, useTransition } from 'react';
import { addAlias, saveAlias } from '@/app/actions/business';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

const sel: React.CSSProperties = {
  background: 'var(--warm-white)', border: '1px solid var(--border-input)',
  padding: '5px 7px', fontSize: 12, width: '100%',
};

/* ═══════════════════════════════════════════════════════════════════════
   EMAIL ADDRESSES

   Receiving and sending are separate. GoDaddy handles the first through
   MX records; Postmark handles the second. An address can do one without
   the other — which is how a reply bounces off an address that sends
   perfectly well.

   And the column that matters is whether anybody reads it. An unmonitored
   address is worse than none: somebody writes to it and concludes they
   were ignored.
   ═══════════════════════════════════════════════════════════════════════ */

export default function EmailAliases({ aliases }: { aliases: Row[] }) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [address, setAddress] = useState('');
  const [purpose, setPurpose] = useState('');
  const [msg, setMsg] = useState('');

  const act = (fn: () => Promise<any>) => start(async () => {
    report('saving');
    const r = await fn();
    setMsg(r?.ok === false ? r.error : (r?.message ?? ''));
    report(r?.ok === false ? 'error' : 'saved');
    if (r?.ok !== false) { setAdding(false); setAddress(''); setPurpose(''); }
  });

  // The dangerous combination: sends but does not receive. Every reply
  // bounces, and nobody finds out until somebody complains they were
  // ignored.
  const sendsCannotReceive = aliases.filter((a) => a.sends_from && !a.receives);
  const unmonitored = aliases.filter((a) => a.receives && !a.is_monitored);
  const planned = aliases.filter((a) => a.status === 'Planned');
  const retired = aliases.filter((a) => a.status === 'Retired');
  const live = aliases.filter((a) => a.status === 'Active');

  return (
    <div className="sect">
      <div className="ph" style={{ marginBottom: 'var(--s3)' }}>
        <div>
          <h3 style={{ borderBottom: 0, marginBottom: 0, paddingBottom: 0 }}>
            Email addresses
          </h3>
          <div className="ph-sub">
            {live.length} live · {aliases.filter((a) => a.sends_from).length} send
          </div>
        </div>
        <div className="ph-act">
          <button className="btn quiet" onClick={() => setAdding(!adding)}>
            {adding ? 'Close' : 'Add one'}
          </button>
        </div>
      </div>

      {msg && <div className="note">{msg}</div>}

      {!!sendsCannotReceive.length && (
        <div className="note bad">
          <strong>Sends but cannot receive:</strong>{' '}
          {sendsCannotReceive.map((a) => a.address).join(', ')} — every reply bounces.
        </div>
      )}

      {!!unmonitored.length && (
        <div className="note">
          <strong>Nobody reads {unmonitored.length}
          {unmonitored.length === 1 ? ' address' : ' of these'}.</strong>{' '}
          {unmonitored.map((a) => a.address.split('@')[0]).join(', ')} — an unread address is worse
          than none.
        </div>
      )}

      {adding && (
        <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'flex-end',
                      flexWrap: 'wrap', marginBottom: 'var(--s4)' }}>
          <div className="f" style={{ minWidth: 260 }}>
            <label>Address</label>
            <input data-bwignore value={address} style={sel}
              placeholder="something@theglobalsanctum.com"
              onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="f" style={{ minWidth: 220, flex: 1 }}>
            <label>Purpose</label>
            <input data-bwignore value={purpose} style={sel}
              onChange={(e) => setPurpose(e.target.value)} />
          </div>
          <button className="btn" disabled={pending || !address.trim()}
            onClick={() => act(() => addAlias(address, purpose))}>Add</button>
        </div>
      )}

      <table>
        <thead>
          <tr>
            <th>Address</th><th>For</th>
            <th style={{ width: 70 }}>Receives</th>
            <th style={{ width: 90 }}>Sends</th>
            <th style={{ width: 70 }}>Read</th>
            <th style={{ width: 110 }}>State</th>
          </tr>
        </thead>
        <tbody>
          {aliases.map((a) => (
            <tr key={a.id} style={{ opacity: a.status === 'Retired' ? 0.5 : 1 }}>
              <td>
                <span className="v-name" style={{ fontSize: 14 }}>
                  {a.address.split('@')[0]}
                  <span style={{ color: 'var(--muted)', fontWeight: 400 }}>
                    @{a.address.split('@')[1]}
                  </span>
                </span>
                {a.notes && (
                  <div className="v-slug" style={{ maxWidth: 380, marginTop: 2 }}>
                    {a.notes}
                  </div>
                )}
              </td>
              <td className="v-slug">{a.purpose}</td>
              <td style={{ textAlign: 'center' }}>
                <input type="checkbox" checked={a.receives} data-bwignore
                  style={{ cursor: 'pointer' }}
                  onChange={(e) => act(() => saveAlias(a.id, 'receives', e.target.checked))} />
              </td>
              <td style={{ textAlign: 'center' }}>
                {a.sends_from ? (
                  <span className="pill gold" style={{ fontSize: 9 }}>
                    {a.sending_service ?? 'Yes'}
                  </span>
                ) : (
                  <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>
                )}
              </td>
              <td style={{ textAlign: 'center' }}>
                <input type="checkbox" checked={a.is_monitored} data-bwignore
                  style={{ cursor: 'pointer' }}
                  onChange={(e) => act(() => saveAlias(a.id, 'is_monitored', e.target.checked))} />
              </td>
              <td>
                <select defaultValue={a.status} style={sel}
                  onChange={(e) => act(() => saveAlias(a.id, 'status', e.target.value))}>
                  {['Active', 'Planned', 'Retired'].map((s) => <option key={s}>{s}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {!!planned.length && (
        <div className="note" style={{ marginTop: 'var(--s4)', marginBottom: 0 }}>
          <strong>{planned.length} still to create in GoDaddy:</strong>{' '}
          {planned.map((a) => a.address).join(', ')}.
        </div>
      )}

      {!!retired.length && (
        <div className="note" style={{ marginBottom: 0 }}>
          <strong>{retired.map((a) => a.address).join(', ')}</strong> uses terminology TGS no longer
          uses — forward it and stop publishing it.
        </div>
      )}
    </div>
  );
}
