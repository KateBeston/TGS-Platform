'use client';

import { useState, useTransition } from 'react';
import { toggleTaxonomy, togglePractice } from '@/app/actions/taxonomy';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

/** The five gate flags a practice can carry. Shown because they are the
 *  difference between "we offer this" and "we can legally offer this to
 *  this person on this date". */
const GATES: [string, string][] = [
  ['hard_requirement', 'Hard requirement'],
  ['legal_review', 'Legal or jurisdiction'],
  ['cultural_gate', 'Cultural'],
  ['health_screening', 'Health screening'],
  ['access_condition', 'Access condition'],
];

export default function TaxonomyEditor({
  venueId, categories, practices, outcomes, audiences, formats,
  myCategories, myPractices, myOutcomes, myAudiences,
}: {
  venueId: number;
  categories: Row[]; practices: Row[]; outcomes: Row[]; audiences: Row[]; formats: Row[];
  myCategories: number[]; myPractices: number[]; myOutcomes: number[]; myAudiences: number[];
}) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [cats, setCats] = useState(myCategories);
  const [prac, setPrac] = useState(myPractices);
  const [outs, setOuts] = useState(myOutcomes);
  const [auds, setAuds] = useState(myAudiences);
  const [open, setOpen] = useState<number | null>(null);
  const [filter, setFilter] = useState('');

  const act = (fn: () => Promise<any>, undo: () => void) => start(async () => {
    report('saving');
    const res = await fn();
    report(res.ok ? 'saved' : 'error', res.ok ? undefined : 'Not saved');
    if (!res.ok) { undo(); alert(res.error); }
  });

  const onPractice = (p: Row) => {
    const on = !prac.includes(p.id);
    const prev = prac, prevCats = cats;
    setPrac(on ? [...prac, p.id] : prac.filter((x) => x !== p.id));
    // Selecting a practice implies its category — reflect that immediately.
    if (on && p.category_id && !cats.includes(p.category_id)) setCats([...cats, p.category_id]);
    act(() => togglePractice(venueId, p.id, on), () => { setPrac(prev); setCats(prevCats); });
  };

  const onSimple = (
    table: string, id: number, list: number[], setList: (v: number[]) => void
  ) => {
    const on = !list.includes(id);
    const prev = list;
    setList(on ? [...list, id] : list.filter((x) => x !== id));
    act(() => toggleTaxonomy(table, venueId, id, on), () => setList(prev));
  };

  const q = filter.trim().toLowerCase();
  const visible = (c: Row) => {
    const inCat = practices.filter((p) => p.category_id === c.id);
    if (!q) return inCat;
    return inCat.filter((p) => p.name.toLowerCase().includes(q));
  };

  const pill = (on: boolean) => ({
    cursor: 'pointer',
    background: on ? undefined : 'var(--warm-white)',
  });

  return (
    <div className="content"><div className="wrap">
      <div className="ph">
        <div>
          <h2>Practices</h2>
          <div className="ph-sub">
            {prac.length} practice{prac.length === 1 ? '' : 's'} across {cats.length} categor{cats.length === 1 ? 'y' : 'ies'}
          </div>
        </div>
      </div>

      <div className="note">
        <strong>This is what makes a venue findable by what it actually offers.</strong></div>

      <div className="f" style={{ maxWidth: 320, marginBottom: 'var(--s5)' }}>
        <label htmlFor="pf">Find a practice</label>
        <input id="pf" data-bwignore value={filter} placeholder="Type to narrow"
               onChange={(e) => setFilter(e.target.value)}
               style={{ background: 'var(--warm-white)', border: '1px solid var(--border-input)',
                        padding: '8px 10px', fontSize: 13 }} />
      </div>

      {categories.map((c) => {
        const inCat = visible(c);
        if (q && !inCat.length) return null;
        const chosen = inCat.filter((p) => prac.includes(p.id)).length;
        const catOn = cats.includes(c.id);

        return (
          <div className="row-card" key={c.id} style={{ marginBottom: 'var(--s3)' }}>
            <header>
              <div>
                <div className="rt">{c.name}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-quiet)' }}>
                  {chosen ? `${chosen} selected` : 'None selected'}
                  {catOn && ' · category applied'}
                  {c.in_retreat && c.in_wellness ? ' · retreat and wellness'
                    : c.in_retreat ? ' · retreat' : ' · wellness'}
                </div>
              </div>
              <button className="link-btn"
                      onClick={() => setOpen(open === c.id ? null : c.id)}>
                {open === c.id || q ? 'Close' : 'Choose'}
              </button>
            </header>

            {(open === c.id || q) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {inCat.map((p) => {
                  const on = prac.includes(p.id);
                  const gates = GATES.filter(([k]) => p[k]);
                  return (
                    <button key={p.id} type="button" disabled={pending}
                      className={`pill ${on ? 'gold' : ''}`}
                      title={gates.length
                        ? `Gated: ${gates.map(([, l]) => l).join(', ')}`
                        : undefined}
                      style={{ ...pill(on),
                               borderStyle: gates.length ? 'dashed' : 'solid' }}
                      onClick={() => onPractice(p)}>
                      {p.name}
                      {gates.length > 0 && ' \u00b7'}
                    </button>
                  );
                })}
                {!inCat.length && (
                  <span style={{ fontSize: 12, color: 'var(--ink-quiet)' }}>
                    No practices in this category yet.
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}

      <div className="note" style={{ marginTop: 'var(--s4)' }}>
        A dashed practice carries a gate — a legal, cultural, health-screening or access condition
        that must be satisfied before it can be offered. Hover to see which.
      </div>

      <div className="sect" style={{ marginTop: 'var(--s7)' }}>
        <h3>Outcomes</h3>
        <div className="ph-sub" style={{ marginBottom: 'var(--s3)' }}>
          What a guest is seeking. A facet, not a category.
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {outcomes.map((o) => {
            const on = outs.includes(o.id);
            return (
              <button key={o.id} type="button" disabled={pending}
                className={`pill ${on ? 'gold' : ''}`} style={pill(on)}
                onClick={() => onSimple('venue_outcomes', o.id, outs, setOuts)}>
                {o.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="sect">
        <h3>Audiences</h3>
        <div className="ph-sub" style={{ marginBottom: 'var(--s3)' }}>Who this venue suits.</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {audiences.map((a) => {
            const on = auds.includes(a.id);
            return (
              <button key={a.id} type="button" disabled={pending}
                className={`pill ${on ? 'gold' : ''}`} style={pill(on)}
                onClick={() => onSimple('venue_audiences', a.id, auds, setAuds)}>
                {a.name}
              </button>
            );
          })}
        </div>
      </div>
    </div></div>
  );
}
