'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { explainChange } from '@/app/actions/legal';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

const TYPE: Record<string, { label: string; tone: 'gold' | 'plain' | 'warn' }> = {
  'Created':         { label: 'Created',        tone: 'plain' },
  'Wording':         { label: 'Wording',        tone: 'gold' },
  'Field':           { label: 'Detail',         tone: 'plain' },
  'Version created': { label: 'New version',    tone: 'gold' },
  'Put in force':    { label: 'Put in force',   tone: 'gold' },
  'Published':       { label: 'Published',      tone: 'gold' },
  'Unpublished':     { label: 'Unpublished',    tone: 'warn' },
  'File added':      { label: 'File added',     tone: 'plain' },
  'File removed':    { label: 'File removed',   tone: 'warn' },
  'Reviewed':        { label: 'Note',           tone: 'plain' },
};

/** Changes that need a reason. A tidied summary line does not; wording on
 *  a document people have accepted does. */
const NEEDS_REASON = ['Wording', 'Put in force', 'Published', 'Unpublished'];

const sel: React.CSSProperties = {
  background: 'var(--warm-white)', border: '1px solid var(--border-input)',
  padding: '6px 8px', fontSize: 12.5, width: '100%',
};

export default function ChangeLog({
  entries, unexplained, filter,
}: { entries: Row[]; unexplained: number; filter: string }) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState<number | null>(null);

  const act = (fn: () => Promise<any>) => start(async () => {
    report('saving');
    const res = await fn();
    report(res.ok ? 'saved' : 'error', res.ok ? undefined : 'Failed');
    if (!res.ok) alert(res.error);
  });

  const pill = (tone: string) =>
    tone === 'gold' ? 'pill gold' : tone === 'warn' ? 'pill' : 'pill empty';

  return (
    <>
      <div className="ph">
        <div>
          <h2>Change history</h2>
          <div className="ph-sub">
            {entries.length} entries
            {unexplained > 0 && ` · ${unexplained} with no reason recorded`}
          </div>
        </div>
        <div className="ph-act">
          <Link className={`btn ${filter === 'all' ? '' : 'quiet'}`} href="/legal/changes">
            Everything
          </Link>
          <Link className={`btn ${filter === 'unexplained' ? '' : 'quiet'}`}
                href="/legal/changes?filter=unexplained">
            Needs a reason {unexplained > 0 && `· ${unexplained}`}
          </Link>
        </div>
      </div>

      <div className="note">
        <strong>What changed is recorded automatically. Why it changed is not.</strong></div>

      {!entries.length && (
        <div className="note" style={{ marginBottom: 0 }}>
          {filter === 'unexplained'
            ? 'Nothing outstanding — every significant change has a reason recorded.'
            : 'No changes recorded yet. Everything from here is logged automatically.'}
        </div>
      )}

      {entries.map((e) => {
        const t = TYPE[e.change_type] ?? { label: e.change_type, tone: 'plain' as const };
        const needsReason = NEEDS_REASON.includes(e.change_type) && !e.reason;
        const isOpen = open === e.id;

        return (
          <div className="row-card" key={e.id}
               style={{ marginBottom: 'var(--s2)',
                        borderLeft: needsReason ? '3px solid var(--warn)' : undefined }}>
            <header>
              <div style={{ display: 'flex', gap: 'var(--s4)', alignItems: 'baseline' }}>
                <div style={{ minWidth: 96, fontSize: 12, color: 'var(--ink-quiet)',
                              fontVariantNumeric: 'tabular-nums' }}>
                  {new Date(e.changed_at).toLocaleDateString('en-AU',
                    { day: 'numeric', month: 'short', year: 'numeric' })}
                  <div>{new Date(e.changed_at).toLocaleTimeString('en-AU',
                    { hour: 'numeric', minute: '2-digit' })}</div>
                </div>
                <div>
                  <div className="rt" style={{ fontSize: 17 }}>
                    {e.summary ?? t.label}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-quiet)', marginTop: 2 }}>
                    <span className={pill(t.tone)}>{t.label}</span>
                    {' '}
                    <Link href={`/legal/${e.legal_document_id}`}
                          style={{ color: 'var(--ink-gold)' }}>
                      {e.legal_documents?.name ?? 'Document'}
                    </Link>
                    {e.legal_documents?.requires_acceptance && ' · people accept this'}
                    {e.changed_by && ` · ${e.changed_by}`}
                  </div>
                  {e.reason && (
                    <div style={{ fontSize: 12.5, marginTop: 5, fontStyle: 'italic',
                                  color: 'var(--ink-quiet)' }}>
                      {e.reason}
                      {e.prompted_by && ` — prompted by ${e.prompted_by}`}
                    </div>
                  )}
                  {e.field_name && e.old_value !== e.new_value && (
                    <div className="v-slug" style={{ marginTop: 4, maxWidth: 560 }}>
                      {e.old_value
                        ? <>was <em>{String(e.old_value).slice(0, 90)}</em> · </>
                        : <>was empty · </>}
                      now <em>{String(e.new_value ?? '').slice(0, 90) || 'empty'}</em>
                    </div>
                  )}
                </div>
              </div>
              <button className="link-btn" onClick={() => setOpen(isOpen ? null : e.id)}>
                {isOpen ? 'Close' : e.reason ? 'Edit reason' : 'Add reason'}
              </button>
            </header>

            {isOpen && (
              <div className="grid">
                <div className="f">
                  <label>Reason for the change</label>
                  <textarea data-bwignore defaultValue={e.reason ?? ''}
                    placeholder="The basis for the change"
                    onBlur={(ev) => ev.target.value !== (e.reason ?? '') &&
                      act(() => explainChange(e.id, e.legal_document_id, 'reason',
                                              ev.target.value || null))} />
                </div>
                <div>
                  <div className="f">
                    <label>Prompted by</label>
                    <input data-bwignore style={sel} defaultValue={e.prompted_by ?? ''}
                      placeholder="Solicitor advice, a complaint, a regulation"
                      onBlur={(ev) => ev.target.value !== (e.prompted_by ?? '') &&
                        act(() => explainChange(e.id, e.legal_document_id, 'prompted_by',
                                                ev.target.value || null))} />
                    <span className="help">
                      What turns a log into evidence — where the change came from
                    </span>
                  </div>
                  <div className="f" style={{ marginTop: 'var(--s3)' }}>
                    <label>Reference</label>
                    <input data-bwignore style={sel} defaultValue={e.reference ?? ''}
                      placeholder="Advice dated, ticket number, section"
                      onBlur={(ev) => ev.target.value !== (e.reference ?? '') &&
                        act(() => explainChange(e.id, e.legal_document_id, 'reference',
                                                ev.target.value || null))} />
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
