'use client';

import { useState, useTransition } from 'react';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

const STATUS = [
  'To confirm', 'Confirmed available', 'Confirmed unavailable',
  'Partly available', 'Venue did not answer',
];

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  'To confirm':             { borderColor: 'var(--warn)', color: 'var(--warn)' },
  'Confirmed available':    { borderColor: 'var(--ok)', color: 'var(--ok)' },
  'Confirmed unavailable':  { borderColor: 'var(--bad)', color: 'var(--bad)' },
  'Partly available':       { borderColor: 'var(--gold)', color: 'var(--ink-gold)' },
  'Venue did not answer':   { color: 'var(--muted)' },
};

/* ═══════════════════════════════════════════════════════════════════════
   ACCESS NEEDS

   Raised on the enquiry, not answered from the venue record.

   A venue's record says what its website said, which is fine for a
   listing and not fine when somebody is about to be told yes. So this
   flags that the question was asked and that a person must confirm it
   before replying.

   Every need carries what to actually ask. General guidance is useless at
   the moment somebody has to make the call.
   ═══════════════════════════════════════════════════════════════════════ */

export default function AccessNeeds({
  needs, types, onAdd, onSave, onRemove,
}: {
  needs: Row[];
  types: Row[];
  onAdd: (typeId: number, words: string) => Promise<any>;
  onSave: (id: number, column: string, value: unknown) => Promise<any>;
  onRemove: (id: number) => Promise<any>;
}) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [newType, setNewType] = useState<number | ''>('');
  const [words, setWords] = useState('');

  const act = (fn: () => Promise<any>) => start(async () => {
    report('saving');
    const res = await fn();
    report(res?.ok === false ? 'error' : 'saved');
    if (res?.ok !== false) { setAdding(false); setNewType(''); setWords(''); }
  });

  const sel: React.CSSProperties = {
    background: 'var(--warm-white)', border: '1px solid var(--border-input)',
    padding: '6px 8px', fontSize: 12.5, width: '100%',
  };

  const unconfirmed = needs.filter((n) => n.status === 'To confirm').length;

  return (
    <div className="sect">
      <div className="ph" style={{ marginBottom: 'var(--s3)' }}>
        <div>
          <h3 style={{ borderBottom: 0, marginBottom: 0, paddingBottom: 0 }}>
            Access needs
          </h3>
          <div className="ph-sub">
            {needs.length
              ? `${needs.length} raised${unconfirmed ? ` · ${unconfirmed} still to confirm` : ''}`
              : 'None raised'}
          </div>
        </div>
        <div className="ph-act">
          <button className="btn quiet" onClick={() => setAdding(!adding)}>
            {adding ? 'Close' : 'Record one'}
          </button>
        </div>
      </div>

      {!!unconfirmed && (
        <div className="note bad">
          <strong>Confirm with the venue before answering this enquiry.</strong></div>
      )}

      {adding && (
        <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'flex-end',
                      flexWrap: 'wrap', marginBottom: 'var(--s4)' }}>
          <div className="f" style={{ minWidth: 220 }}>
            <label>Type of access need</label>
            <select value={newType} style={sel}
              onChange={(e) => setNewType(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Choose</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>{t.category} · {t.name}</option>
              ))}
            </select>
          </div>
          <div className="f" style={{ minWidth: 260, flex: 1 }}>
            <label>What the guest wrote</label>
            <input data-bwignore value={words} style={sel}
              placeholder="What the guest actually wrote"
              onChange={(e) => setWords(e.target.value)} />
            <span className="help">
              The category is a label; what they wrote is the requirement
            </span>
          </div>
          <button className="btn" disabled={pending || !newType}
            onClick={() => act(() => onAdd(Number(newType), words))}>
            Record it
          </button>
        </div>
      )}

      {needs.map((n) => {
        const type = types.find((t) => t.id === n.need_type_id);
        return (
          <div className="row-card" key={n.id} style={{ marginBottom: 'var(--s2)' }}>
            <header>
              <div>
                <div className="rt" style={{ fontSize: 17 }}>{type?.name}</div>
                {n.guest_words && (
                  <div style={{ fontSize: 13, marginTop: 4, fontStyle: 'italic' }}>
                    &ldquo;{n.guest_words}&rdquo;
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'center' }}>
                <span className="pill" style={STATUS_STYLE[n.status] ?? {}}>{n.status}</span>
                <button className="link-btn" disabled={pending}
                  onClick={() => act(() => onRemove(n.id))}>Remove</button>
              </div>
            </header>

            {type?.what_to_ask && (
              <div className="note" style={{ marginBottom: 'var(--s3)' }}>
                <strong>What to ask:</strong> {type.what_to_ask}
              </div>
            )}

            <div className="grid">
              <div className="f">
                <label>Status</label>
                <select defaultValue={n.status} style={sel}
                  onChange={(e) => act(() => onSave(n.id, 'status', e.target.value))}>
                  {STATUS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="f">
                <label>Confirmed with</label>
                <input data-bwignore defaultValue={n.confirmed_with ?? ''} style={sel}
                  placeholder="Who at the venue"
                  onBlur={(e) => e.target.value !== (n.confirmed_with ?? '') &&
                    act(() => onSave(n.id, 'confirmed_with', e.target.value || null))} />
              </div>
              <div className="f" style={{ gridColumn: '1 / -1' }}>
                <label>The venue's answer</label>
                <textarea data-bwignore defaultValue={n.venue_response ?? ''}
                  placeholder="Their answer, in their words — this is what the guest is being told"
                  onBlur={(e) => e.target.value !== (n.venue_response ?? '') &&
                    act(() => onSave(n.id, 'venue_response', e.target.value || null))} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
