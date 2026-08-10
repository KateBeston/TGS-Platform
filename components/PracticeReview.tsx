'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import {
  createCategory, practiceAcceptMany, practiceAsAlias, practiceAsNew, practiceReject,
} from '@/app/actions/practiceCandidates';
import { FlagPills } from './PracticeFlags';
import { suggestPracticeName } from '@/lib/practiceName';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

const sel: React.CSSProperties = {
  background: 'var(--warm-white)', border: '1px solid var(--border-input)',
  padding: '6px 8px', fontSize: 12.5, width: '100%',
};

const TABS = [
  { key: 'Pending',  label: 'To decide' },
  { key: 'Added',    label: 'Added' },
  { key: 'Alias',    label: 'Another wording' },
  { key: 'Rejected', label: 'Rejected' },
];

/* ═══════════════════════════════════════════════════════════════════════
   PRACTICES TO REVIEW

   Two sources, and they are different in kind.

   Phrases venues actually used, which the taxonomy did not recognise —
   these carry a count, and a phrase twenty venues use is a gap.

   And suggestions raised while reviewing the taxonomy, which have never
   been seen on a site. Three categories were empty; these fill them.
   ═══════════════════════════════════════════════════════════════════════ */

export default function PracticeReview({
  rows, practices, categories, counts, status, flagTypes,
}: {
  rows: Row[]; practices: Row[]; categories: Row[];
  counts: Record<string, number>; status: string;
  flagTypes?: Row[];
}) {
  const flagBySlug = new Map((flagTypes ?? []).map((f) => [f.slug, f]));

  /** What a candidate would carry once accepted. Shown before the
   *  decision, because "add all ten" on a category holding ayahuasca
   *  should not be a surprise. */
  const flagsFor = (r: Row) =>
    (r.suggested_flags ?? [])
      .map((slug: string) => flagBySlug.get(slug))
      .filter(Boolean) as Row[];
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [open, setOpen] = useState<number | null>(null);
  const [alias, setAlias] = useState<number | ''>('');
  const [newCategoryFor, setNewCategoryFor] = useState<number | null>(null);
  const [newCategory, setNewCategory] = useState('');
  const [msg, setMsg] = useState('');

  const act = (fn: () => Promise<any>) => start(async () => {
    report('saving');
    const res = await fn();
    setMsg(res?.ok === false ? res.error : (res?.message ?? ''));
    report(res?.ok === false ? 'error' : 'saved');
    if (res?.ok !== false) { setOpen(null); setAlias(''); setChosen(new Set()); }
  });

  const toggle = (id: number) => {
    const next = new Set(chosen);
    next.has(id) ? next.delete(id) : next.add(id);
    setChosen(next);
  };

  // Suggestions have never been seen; observed phrases have a count.
  const suggested = rows.filter((r) => r.times_seen === 0);
  const observed = rows.filter((r) => r.times_seen > 0);

  const byCategory = new Map<string, Row[]>();
  for (const r of suggested) {
    const name = r.modality_categories?.name ?? 'Uncategorised';
    byCategory.set(name, [...(byCategory.get(name) ?? []), r]);
  }

  const group = (label: string, items: Row[], categoryId?: number) => (
    <div className="row-card" key={label} style={{ marginBottom: 'var(--s3)' }}>
      <header>
        <div>
          <div className="rt" style={{ fontSize: 18 }}>{label}</div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-quiet)', marginTop: 2 }}>
            {items.length} suggested
          </div>
        </div>
        <button className="link-btn" disabled={pending}
          onClick={() => act(() => practiceAcceptMany(items.map((i) => i.id), categoryId))}>
          Add all {items.length}
        </button>
      </header>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {items.map((i) => {
          const on = chosen.has(i.id);
          const flags = flagsFor(i);
          const worst = flags.find((f: any) => f.severity === 'Critical')
            ?? flags.find((f: any) => f.severity === 'High');
          return (
            <button key={i.id} type="button" className={`pill ${on ? 'gold' : ''}`}
              disabled={pending}
              title={i.flag_note ?? undefined}
              style={{
                cursor: 'pointer',
                background: on ? undefined : 'var(--warm-white)',
                // A candidate carrying a serious flag looks different
                // before it is ticked, not after.
                borderColor: worst ? (worst as any).colour : undefined,
              }}
              onClick={() => toggle(i.id)}>
              {i.phrase}
              {worst && (
                <span style={{ marginLeft: 5, color: (worst as any).colour }}>•</span>
              )}
            </button>
          );
        })}
      </div>
      {items.some((i) => flagsFor(i).length) && (
        <div style={{ marginTop: 'var(--s3)' }}>
          {items.filter((i) => flagsFor(i).length).map((i) => (
            <div key={i.id} style={{ marginBottom: 'var(--s3)' }}>
              <div style={{ fontSize: 12.5, fontWeight: 500 }}>{i.phrase}</div>
              <FlagPills flags={flagsFor(i) as any} size="small" />
              {/* Why it was raised rather than matched. Without this a
                  deliberate distinction looks identical to a typo. */}
              {i.near_reason && (
                <div className="note" style={{ margin: '6px 0', fontSize: 12 }}>
                  <strong>Nearly {i.near?.name ?? 'matched'}.</strong> {i.near_reason}
                  {' '}Accept as a wording of it, or add it as its own practice if the
                  difference matters.
                </div>
              )}

              {i.flag_note && (
                <p style={{ fontSize: 12, lineHeight: 1.55, margin: '4px 0 0',
                            color: 'var(--ink-quiet)', maxWidth: '72ch' }}>
                  {i.flag_note}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="ph">
        <div>
          <h2>Practices to review</h2>
          <div className="ph-sub">
            {counts.Pending ?? 0} waiting · {practices.length} in the taxonomy
          </div>
        </div>
        {!!chosen.size && (
          <div className="ph-act">
            <button className="btn" disabled={pending}
              onClick={() => act(() => practiceAcceptMany(Array.from(chosen)))}>
              Add {chosen.size} selected
            </button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 'var(--s3)', flexWrap: 'wrap',
                    marginBottom: 'var(--s5)' }}>
        {TABS.map((t) => (
          <Link key={t.key}
                className={`btn ${status === t.key ? '' : 'quiet'}`}
                href={`/settings/catalogues/practices?status=${t.key}`}>
            {t.label}{counts[t.key] ? ` · ${counts[t.key]}` : ''}
          </Link>
        ))}
      </div>

      {msg && <div className="note">{msg}</div>}

      {!!observed.length && (
        <div className="sect">
          <h3>Seen on a venue site</h3>
          <div className="ph-sub" style={{ marginBottom: 'var(--s3)' }}>
            Phrases the taxonomy did not recognise, most used first
          </div>
          {observed.map((r) => {
            const isOpen = open === r.id;
            return (
              <div className="row-card" key={r.id} style={{ marginBottom: 'var(--s2)' }}>
                <header>
                  <div>
                    <div className="rt" style={{ fontSize: 18 }}>{r.phrase}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-quiet)', marginTop: 2 }}>
                      seen {r.times_seen} time{r.times_seen === 1 ? '' : 's'}
                      {r.venue_ids?.length > 1 && ` across ${r.venue_ids.length} venues`}
                      {r.example_price && ` · charged ${Number(r.example_price).toLocaleString('en-AU')}`}
                      {r.example_duration && ` · ${r.example_duration} min`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--s3)' }}>
                    <button className="link-btn"
                      onClick={() => setOpen(isOpen ? null : r.id)}>
                      {isOpen ? 'Close' : 'Decide'}
                    </button>
                    <button className="link-btn" disabled={pending}
                      onClick={() => act(() => practiceReject(r.id))}>Reject</button>
                  </div>
                </header>

                {isOpen && (
                  <div className="grid">
                    <div>
                      <div className="f">
                        <label>Another wording of</label>
                        <select value={alias} style={sel}
                          onChange={(e) => setAlias(e.target.value ? Number(e.target.value) : '')}>
                          <option value="">Choose an existing practice</option>
                          {practices.map((pr) => (
                            <option key={pr.id} value={pr.id}>
                              {(pr as any).modality_categories?.name} · {pr.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button className="btn" disabled={pending || !alias}
                        style={{ marginTop: 'var(--s3)' }}
                        onClick={() => act(() => practiceAsAlias(r.id, Number(alias)))}>
                        Record as another wording
                      </button>
                    </div>
                    <div>
                      {/* Named the way the taxonomy already names things,
                          and editable — a website writes "ROOFTOP INFRARED
                          SAUNA RITUAL" and that does not belong beside
                          "Japanese Onsen". The raw phrase is kept as a
                          wording either way, so nothing is lost. */}
                      <div className="f">
                        <label>Add it as</label>
                        <input data-bwignore style={sel} id={`nm-${r.id}`}
                          defaultValue={suggestPracticeName(r.phrase).suggested} />
                        {(() => {
                          const { removed } = suggestPracticeName(r.phrase);
                          return removed.length ? (
                            <span className="help">
                              Dropped {removed.join(', ')} as venue wording.
                              Put it back if it changes what this is.
                            </span>
                          ) : null;
                        })()}
                      </div>

                      <div className="f">
                        <label>In</label>
                        <select defaultValue={r.suggested_category_id ?? ''} style={sel}
                          id={`cat-${r.id}`}
                          onChange={(e) => {
                            if (e.target.value === 'new') {
                              setNewCategoryFor(r.id); e.target.value = '';
                            }
                          }}>
                          <option value="">Choose a category</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                          <option value="new">— a new category —</option>
                        </select>
                      </div>

                      {/* A nineteenth category is a real decision, but
                          sending somebody to Settings mid-review loses
                          their place — and the alternative is a practice
                          filed under the wrong category because that was
                          easier than leaving. */}
                      {newCategoryFor === r.id && (
                        <div className="f">
                          <label>New category name</label>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <input data-bwignore style={sel} value={newCategory}
                              placeholder="Thermal & Hydrotherapy"
                              onChange={(e) => setNewCategory(e.target.value)} />
                            <button className="btn quiet" disabled={pending || !newCategory.trim()}
                              onClick={() => act(async () => {
                                const res = await createCategory(newCategory);
                                if (res.ok) {
                                  setNewCategoryFor(null); setNewCategory('');
                                }
                                return res;
                              })}>Add</button>
                          </div>
                          <span className="help">
                            Title case, as the others are — Thermal &amp; Hydrotherapy, Sound &amp;
                            Vibrational
                          </span>
                        </div>
                      )}

                      <button className="btn quiet" disabled={pending}
                        style={{ marginTop: 'var(--s3)' }}
                        onClick={() => {
                          const el = document.getElementById(
                            `cat-${r.id}`) as HTMLSelectElement | null;
                          const nm = document.getElementById(
                            `nm-${r.id}`) as HTMLInputElement | null;
                          const cat = Number(el?.value);
                          const name = nm?.value?.trim();
                          if (!cat) { setMsg('Choose a category first.'); return; }
                          if (!name) { setMsg('It needs a name.'); return; }
                          act(() => practiceAsNew(r.id, cat, name));
                        }}>
                        Add to the taxonomy
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!!suggested.length && (
        <div className="sect">
          <h3>Suggested while reviewing</h3>
          <div className="note">
            Not seen on a venue site — raised because the taxonomy looked thin there. Three
            categories were entirely empty, and Body Therapies had eight practices with no
            Swedish, deep tissue or Balinese, which is most of what a spa menu lists.</div>
          {[...byCategory.entries()].map(([name, items]) =>
            group(name, items, items[0]?.suggested_category_id))}
        </div>
      )}

      {!rows.length && (
        <div className="note" style={{ marginBottom: 0 }}>
          Nothing in this state.
        </div>
      )}
    </>
  );
}
