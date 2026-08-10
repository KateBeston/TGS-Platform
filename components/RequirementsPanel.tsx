'use client';

import { useState, useTransition } from 'react';
import {
  addRequirement, recordUnmetRequirement, removeRequirement, saveRequirementField,
} from '@/app/actions/enquiries';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

/** Free text, typed. The requirement itself is whatever someone actually
 *  asked for — a dawn fire ceremony, a coeliac kitchen, a piano, somewhere
 *  that will let them scatter ashes. The TYPE is from a catalogue, so it
 *  stays countable without constraining what can be asked. */
export default function RequirementsPanel({
  enquiryId, types, requirements, shortlist,
}: {
  enquiryId: number;
  types: Row[];
  requirements: Row[];
  shortlist: Row[];
}) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [list, setList] = useState(requirements);
  const [text, setText] = useState('');
  const [typeId, setTypeId] = useState('');
  const [essential, setEssential] = useState(true);
  const [unmetFor, setUnmetFor] = useState<number | null>(null);
  const [reason, setReason] = useState('');

  const act = (fn: () => Promise<any>) => start(async () => {
    report('saving');
    const res = await fn();
    report(res.ok ? 'saved' : 'error', res.ok ? undefined : 'Failed');
    if (!res.ok) alert(res.error);
  });

  const sel = { background: 'var(--warm-white)', border: '1px solid var(--border-input)',
                padding: '8px 10px', fontSize: 13 };

  const essentials = list.filter((r) => r.is_essential);
  const unmet = list.filter((r) => r.is_essential && r.is_met === false);

  return (
    <div className="sect">
      <h3>Requirements</h3>
      <div className="ph-sub" style={{ marginBottom: 'var(--s4)' }}>
        {list.length} recorded · {essentials.length} essential
        {unmet.length > 0 && ` · ${unmet.length} unmet`}
      </div>

      <div className="note">
        <strong>Write whatever they actually asked for.</strong> A dawn fire ceremony, a coeliac
        kitchen, step-free access to the shala, somewhere that will let them scatter ashes.</div>

      <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'flex-end',
                    flexWrap: 'wrap', marginBottom: 'var(--s5)' }}>
        <div className="f" style={{ minWidth: 280, flex: 1 }}>
          <label htmlFor="rq">Add a requirement</label>
          <input id="rq" data-bwignore value={text} style={sel}
            placeholder="What did they ask for?"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' || !text.trim()) return;
              act(async () => {
                const res = await addRequirement(
                  enquiryId, text, typeId ? Number(typeId) : null, essential);
                if (res.ok) {
                  setList([...list, { id: res.id, requirement: text,
                    requirement_type_id: typeId ? Number(typeId) : null,
                    is_essential: essential }]);
                  setText('');
                }
                return res;
              });
            }} />
        </div>
        <div className="f" style={{ minWidth: 170 }}>
          <label htmlFor="rt">Type</label>
          <select id="rt" value={typeId} style={sel} onChange={(e) => setTypeId(e.target.value)}>
            <option value="">Not categorised</option>
            {types.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
        <button type="button" className={`pill ${essential ? 'gold' : ''}`}
          style={{ cursor: 'pointer', alignSelf: 'center',
                   background: essential ? undefined : 'var(--warm-white)' }}
          onClick={() => setEssential(!essential)}>
          {essential ? 'Essential' : 'Preferred'}
        </button>
        <button className="btn" disabled={pending || !text.trim()}
          onClick={() => act(async () => {
            const res = await addRequirement(
              enquiryId, text, typeId ? Number(typeId) : null, essential);
            if (res.ok) {
              setList([...list, { id: res.id, requirement: text,
                requirement_type_id: typeId ? Number(typeId) : null, is_essential: essential }]);
              setText('');
            }
            return res;
          })}>Add</button>
      </div>

      {!list.length && (
        <div className="note" style={{ marginBottom: 0 }}>
          Nothing recorded yet. Most enquiries carry at least one thing that no filter would find.
        </div>
      )}

      {!!list.length && (
        <div className="rows">
          {list.map((r) => {
            const type = types.find((t) => t.id === r.requirement_type_id);
            const isUnmet = r.is_met === false;
            const isMet = r.is_met === true;

            return (
              <div className="row-card" key={r.id}
                   style={isUnmet ? { borderLeft: '3px solid var(--bad)' } : undefined}>
                <header>
                  <div>
                    <div className="rt">{r.requirement}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-quiet)' }}>
                      {type?.label ?? 'Not categorised'}
                      {' · '}
                      <button type="button" className="link-btn" disabled={pending}
                        onClick={() => act(async () => {
                          const next = !r.is_essential;
                          setList(list.map((x) =>
                            x.id === r.id ? { ...x, is_essential: next } : x));
                          return saveRequirementField(r.id, enquiryId, 'is_essential', next);
                        })}>
                        {r.is_essential ? 'Essential' : 'Preferred'}
                      </button>
                      {isMet && r.venues?.venue_name && ` · met by ${r.venues.venue_name}`}
                      {isUnmet && <span style={{ color: 'var(--bad)' }}> · unmet</span>}
                    </div>
                  </div>
                  <button className="link-btn" disabled={pending}
                    onClick={() => act(async () => {
                      const res = await removeRequirement(r.id, enquiryId);
                      if (res.ok) setList(list.filter((x) => x.id !== r.id));
                      return res;
                    })}>Remove</button>
                </header>

                <div className="grid one">
                  <div className="f">
                    <label>Detail</label>
                    <textarea data-bwignore defaultValue={r.detail ?? ''}
                      placeholder="Anything that helps match it"
                      onBlur={(e) => e.target.value !== (r.detail ?? '') &&
                        act(() => saveRequirementField(r.id, enquiryId, 'detail',
                          e.target.value || null))} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'center',
                              flexWrap: 'wrap', marginTop: 'var(--s3)' }}>
                  <span style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase',
                                 color: 'var(--ink-quiet)' }}>Met by</span>
                  <select defaultValue={r.met_by_venue_id ?? ''} disabled={pending} style={sel}
                    onChange={(e) => act(async () => {
                      const vid = e.target.value ? Number(e.target.value) : null;
                      await saveRequirementField(r.id, enquiryId, 'met_by_venue_id', vid);
                      return saveRequirementField(r.id, enquiryId, 'is_met', vid ? true : null);
                    })}>
                    <option value="">Not yet</option>
                    {shortlist.map((m) => (
                      <option key={m.venue_id} value={m.venue_id}>
                        {m.venues?.venue_name ?? `Venue ${m.venue_id}`}
                      </option>
                    ))}
                  </select>

                  {r.is_essential && !isMet && (
                    unmetFor === r.id ? (
                      <>
                        <input data-bwignore value={reason} placeholder="Why could nothing meet it?"
                          style={{ ...sel, minWidth: 240 }}
                          onChange={(e) => setReason(e.target.value)} />
                        <button className="btn quiet" disabled={pending}
                          onClick={() => act(async () => {
                            const res = await recordUnmetRequirement(r.id, enquiryId, reason);
                            if (res.ok) {
                              setList(list.map((x) =>
                                x.id === r.id ? { ...x, is_met: false, unmet_reason: reason } : x));
                              setUnmetFor(null); setReason('');
                            }
                            return res;
                          })}>Record gap</button>
                        <button className="link-btn"
                          onClick={() => setUnmetFor(null)}>Cancel</button>
                      </>
                    ) : (
                      <button className="link-btn" onClick={() => setUnmetFor(r.id)}>
                        Nothing can meet this
                      </button>
                    )
                  )}
                </div>

                {isUnmet && r.unmet_reason && (
                  <div style={{ marginTop: 'var(--s3)', fontSize: 12, fontStyle: 'italic',
                                color: 'var(--ink-quiet)' }}>
                    {r.unmet_reason}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
