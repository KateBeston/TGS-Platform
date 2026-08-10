'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { addRecord, removeRecord, saveRecord, saveSetting } from '@/app/actions/business';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

const TYPES = ['Insurance', 'Registration', 'Trademark', 'Domain', 'Membership',
               'Certification', 'Licence', 'Bank', 'Software', 'Adviser', 'Other'];

const URGENCY: Record<string, { colour: string; label: string }> = {
  'Lapsed':     { colour: 'var(--bad)',  label: 'Lapsed' },
  'Decide now': { colour: 'var(--bad)',  label: 'Decide now' },
  'Coming up':  { colour: 'var(--warn)', label: 'Coming up' },
  'Fine':       { colour: 'var(--ok)',   label: 'Fine' },
};

const sel: React.CSSProperties = {
  background: 'var(--warm-white)', border: '1px solid var(--border-input)',
  padding: '6px 8px', fontSize: 12.5, width: '100%',
};

/* ═══════════════════════════════════════════════════════════════════════
   THE BUSINESS

   What TGS is, and what it holds that expires.

   Three kinds of thing lived in three places and none of them fitted
   insurance:

     Settings hold stable facts other systems read — the ABN goes into a
     document, the address onto an invoice. A setting does not lapse.

     Legal holds documents ABOUT the facts. A document does not remind
     anybody.

     This holds what expires. A policy has an insurer, a number, a limit,
     an excess and a broker — and a date after which it does not exist.
     That date is the whole reason for it being separate.
   ═══════════════════════════════════════════════════════════════════════ */

export default function TheBusiness({
  records, renewals, settings, type,
}: { records: Row[]; renewals: Row[]; settings: Row[]; type: string }) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [newType, setNewType] = useState('Insurance');
  const [newName, setNewName] = useState('');
  const [msg, setMsg] = useState('');

  const act = (fn: () => Promise<any>) => start(async () => {
    report('saving');
    const res = await fn();
    setMsg(res?.ok === false ? res.error : (res?.message ?? ''));
    report(res?.ok === false ? 'error' : 'saved');
  });

  const save = (id: number, col: string, v: unknown) => act(() => saveRecord(id, col, v));

  const pressing = renewals.filter((r) =>
    r.urgency === 'Lapsed' || r.urgency === 'Decide now' || r.urgency === 'Coming up');
  const incomplete = records.filter((r) => r.status === 'Pending');

  const byType = new Map<string, Row[]>();
  for (const r of records) byType.set(r.record_type, [...(byType.get(r.record_type) ?? []), r]);

  return (
    <>
      <div className="ph">
        <div>
          <h2>The business</h2>
          <div className="ph-sub">
            {records.length} record{records.length === 1 ? '' : 's'}
            {incomplete.length ? ` · ${incomplete.length} still to fill in` : ''}
          </div>
        </div>
        <div className="ph-act">
          <Link className="btn quiet" href="/business/files">Files</Link>
          <button className="btn" onClick={() => setAdding(!adding)}>
            {adding ? 'Close' : 'Add one'}
          </button>
        </div>
      </div>

      <div className="note">
        <strong>What TGS is, and what it holds that expires.</strong> Insurance, registrations, the
        trademark, domains, advisers.</div>

      {msg && <div className="note">{msg}</div>}

      {/* ── what needs deciding ────────────────────────────────── */}
      {!!pressing.length && (
        <div className="sect">
          <h3>Coming up</h3>
          <div className="ph-sub" style={{ marginBottom: 'var(--s3)' }}>
            The date shown is when a decision is needed, not when it lapses
          </div>
          <table>
            <thead>
              <tr><th>What</th><th>Decide by</th><th>Expires</th><th>Cost</th><th></th></tr>
            </thead>
            <tbody>
              {pressing.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span className="v-name" style={{ fontSize: 15 }}>{r.name}</span>
                    <div className="v-slug">{r.provider ?? r.record_type}</div>
                  </td>
                  <td>
                    <span style={{ color: URGENCY[r.urgency]?.colour }}>
                      {new Date(r.decide_by).toLocaleDateString('en-AU',
                        { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    {r.notice_days ? (
                      <div className="v-slug">{r.notice_days} days notice</div>
                    ) : null}
                  </td>
                  <td className="v-slug">
                    {new Date(r.expires_on).toLocaleDateString('en-AU',
                      { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="v-slug">
                    {r.cost_amount
                      ? `$${Number(r.cost_amount).toLocaleString('en-AU')} ${r.cost_period ?? ''}`
                      : '—'}
                  </td>
                  <td>
                    <span className="pill" style={{ borderColor: URGENCY[r.urgency]?.colour,
                                                    color: URGENCY[r.urgency]?.colour }}>
                      {r.urgency}
                    </span>
                    {r.auto_renews && (
                      <div className="v-slug">Renews itself</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adding && (
        <div className="sect">
          <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'flex-end',
                        flexWrap: 'wrap' }}>
            <div className="f" style={{ minWidth: 180 }}>
              <label>Kind</label>
              <select value={newType} style={sel} onChange={(e) => setNewType(e.target.value)}>
                {TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="f" style={{ minWidth: 260, flex: 1 }}>
              <label>What it is</label>
              <input data-bwignore value={newName} style={sel}
                placeholder="Public liability, professional indemnity, ASIC registration"
                onChange={(e) => setNewName(e.target.value)} />
            </div>
            <button className="btn" disabled={pending || !newName.trim()}
              onClick={() => act(async () => {
                const r = await addRecord(newType, newName);
                if (r.ok) { setAdding(false); setNewName(''); setOpen(r.id ?? null); }
                return r;
              })}>Add</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--s2)', flexWrap: 'wrap',
                    marginBottom: 'var(--s5)' }}>
        <Link className={`btn ${type === 'all' ? '' : 'quiet'}`} href="/business">
          Everything
        </Link>
        {TYPES.filter((t) => byType.has(t)).map((t) => (
          <Link key={t} className={`btn ${type === t ? '' : 'quiet'}`}
                href={`/business?type=${encodeURIComponent(t)}`}>{t}</Link>
        ))}
      </div>

      {[...byType.entries()].map(([kind, items]) => (
        <div className="sect" key={kind}>
          <h3>{kind}</h3>
          {items.map((r) => {
            const isOpen = open === r.id;
            return (
              <div className="row-card" key={r.id} style={{ marginBottom: 'var(--s2)' }}>
                <header>
                  <div>
                    <div className="rt" style={{ fontSize: 18 }}>{r.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-quiet)', marginTop: 2 }}>
                      {[r.provider, r.reference,
                        r.cover_amount && `$${Number(r.cover_amount).toLocaleString('en-AU')} cover`,
                        r.expires_on && `expires ${new Date(r.expires_on)
                          .toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`,
                      ].filter(Boolean).join(' · ') || 'Nothing recorded yet'}
                    </div>
                    {r.status !== 'Active' && (
                      <div style={{ marginTop: 4 }}>
                        <span className="pill" style={{ fontSize: 9,
                          borderColor: r.status === 'Pending' ? 'var(--warn)' : undefined,
                          color: r.status === 'Pending' ? 'var(--warn)' : undefined }}>
                          {r.status === 'Pending' ? 'Details needed' : r.status}
                        </span>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--s3)' }}>
                    <button className="link-btn" onClick={() => setOpen(isOpen ? null : r.id)}>
                      {isOpen ? 'Close' : 'Open'}
                    </button>
                  </div>
                </header>

                {isOpen && (
                  <>
                    {r.notes && (
                      <div className="note" style={{ marginBottom: 'var(--s3)' }}>{r.notes}</div>
                    )}
                    <div className="grid">
                      {([
                        ['reference', 'Reference or policy number', 'text'],
                        ['provider', 'Provider or insurer', 'text'],
                        ['provider_phone', 'Their phone', 'text'],
                        ['provider_email', 'Their email', 'text'],
                        ['arranged_by', 'Arranged through', 'text'],
                        ['arranged_by_contact', 'Who to ring there', 'text'],
                        ['cover_amount', 'Cover', 'number'],
                        ['excess_amount', 'Excess', 'number'],
                        ['starts_on', 'Starts', 'date'],
                        ['expires_on', 'Expires', 'date'],
                        ['notice_days', 'Notice needed, in days', 'number'],
                        ['cost_amount', 'Cost', 'number'],
                      ] as [string, string, string][]).map(([col, label, kind]) => (
                        <div className="f" key={col}>
                          <label>{label}</label>
                          <input type={kind === 'text' ? 'text' : kind}
                            data-bwignore defaultValue={r[col] ?? ''} style={sel}
                            onBlur={(e) => e.target.value !== String(r[col] ?? '') &&
                              save(r.id, col, kind === 'number'
                                ? (e.target.value ? Number(e.target.value) : null)
                                : (e.target.value || null))} />
                          {col === 'notice_days' && (
                            <span className="help">
                              A policy renewing on the 30th with 30 days notice is decided on the 1st
                            </span>
                          )}
                          {col === 'arranged_by' && (
                            <span className="help">
                              The broker or accountant — usually the one to ring, and not the insurer
                            </span>
                          )}
                        </div>
                      ))}
                      <div className="f">
                        <label>Cost period</label>
                        <select defaultValue={r.cost_period ?? ''} style={sel}
                          onChange={(e) => save(r.id, 'cost_period', e.target.value || null)}>
                          <option value="">—</option>
                          {['One off','Monthly','Quarterly','Annually'].map((p) =>
                            <option key={p}>{p}</option>)}
                        </select>
                      </div>
                      <div className="f">
                        <label>State</label>
                        <select defaultValue={r.status} style={sel}
                          onChange={(e) => save(r.id, 'status', e.target.value)}>
                          {['Active','Pending','Lapsed','Cancelled','Superseded'].map((s) =>
                            <option key={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className="f">
                        <label>Renews itself</label>
                        <select defaultValue={r.auto_renews === null ? '' : String(r.auto_renews)}
                          style={sel}
                          onChange={(e) => save(r.id, 'auto_renews',
                            e.target.value === '' ? null : e.target.value === 'true')}>
                          <option value="">Not known</option>
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                        </select>
                      </div>
                      <div className="f">
                        <label>Visible to</label>
                        <select defaultValue={r.min_rank} style={sel}
                          onChange={(e) => save(r.id, 'min_rank', Number(e.target.value))}>
                          <option value={30}>Anybody internal</option>
                          <option value={60}>Finance and above</option>
                          <option value={80}>Administrators only</option>
                          <option value={100}>Owner only</option>
                        </select>
                      </div>
                      <div className="f" style={{ gridColumn: '1 / -1' }}>
                        <label>What is covered</label>
                        <textarea data-bwignore defaultValue={r.cover_summary ?? ''}
                          onBlur={(e) => e.target.value !== (r.cover_summary ?? '') &&
                            save(r.id, 'cover_summary', e.target.value || null)} />
                      </div>
                      <div className="f" style={{ gridColumn: '1 / -1' }}>
                        <label>Exclusions</label>
                        <textarea data-bwignore defaultValue={r.exclusions ?? ''}
                          placeholder="Worth writing down. The exclusions are what decides whether a policy helps."
                          onBlur={(e) => e.target.value !== (r.exclusions ?? '') &&
                            save(r.id, 'exclusions', e.target.value || null)} />
                      </div>
                      <div className="f" style={{ gridColumn: '1 / -1' }}>
                        <label>Notes</label>
                        <textarea data-bwignore defaultValue={r.notes ?? ''}
                          onBlur={(e) => e.target.value !== (r.notes ?? '') &&
                            save(r.id, 'notes', e.target.value || null)} />
                      </div>
                    </div>

                    <div style={{ marginTop: 'var(--s4)' }}>
                      <button className="link-btn" disabled={pending}
                        onClick={() => {
                          if (!window.confirm(`Remove ${r.name}?`)) return;
                          act(() => removeRecord(r.id));
                        }}>Remove</button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* ── the stable facts ──────────────────────────────────── */}
      <div className="sect">
        <h3>Entity details</h3>
        <div className="ph-sub" style={{ marginBottom: 'var(--s3)' }}>
          What other things read — the ABN that goes into a document, the address on an invoice
        </div>
        <div className="grid">
          {settings.map((s) => (
            <div className="f" key={s.setting_key}>
              <label>{s.setting_key.replace(/_/g, ' ')
                .replace(/^./, (c: string) => c.toUpperCase())}</label>
              <input data-bwignore defaultValue={s.setting_value ?? ''} style={sel}
                onBlur={(e) => e.target.value !== (s.setting_value ?? '') &&
                  act(() => saveSetting(s.setting_key, e.target.value))} />
            </div>
          ))}
        </div>
        <div className="note" style={{ marginTop: 'var(--s4)', marginBottom: 0 }}>
          These are inserted into legal documents and invoices. Changing the ABN here changes it
          wherever it is used — which is the point, and the reason to be careful.
        </div>
      </div>
    </>
  );
}
