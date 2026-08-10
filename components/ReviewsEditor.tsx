'use client';

import { useState, useTransition } from 'react';
import { addReview, deleteReview, saveReviewField } from '@/app/actions/curation';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

/** The five sub-ratings shown on the listing page, matching the mockup. */
const RATINGS: [string, string][] = [
  ['rating_overall', 'Overall'],
  ['rating_communication', 'Communication'],
  ['rating_spaces', 'Spaces'],
  ['rating_amenities', 'Amenities'],
  ['rating_location', 'Location'],
  ['rating_value', 'Value'],
];

export default function ReviewsEditor({ venueId, reviews }: { venueId: number; reviews: Row[] }) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState<number | null>(null);

  const act = (fn: () => Promise<any>) => start(async () => {
    report('saving');
    const res = await fn();
    report(res.ok ? 'saved' : 'error', res.ok ? undefined : 'Failed');
    if (!res.ok) alert(res.error);
  });

  const published = reviews.filter((r) => r.is_published);
  const avg = published.length
    ? (published.reduce((s, r) => s + Number(r.rating_overall ?? 0), 0) / published.length).toFixed(1)
    : null;

  return (
    <div className="content"><div className="wrap">
      <div className="ph">
        <div>
          <h2>Reviews</h2>
          <div className="ph-sub">
            {reviews.length} recorded · {published.length} published
            {avg && ` · ${avg} average`}
          </div>
        </div>
        <div className="ph-act">
          <button className="btn" disabled={pending}
                  onClick={() => act(() => addReview(venueId))}>Add review</button>
        </div>
      </div>

      <div className="note">
        <strong>Only genuine reviews, and only published ones count.</strong></div>

      {!reviews.length && (
        <div className="note">
          None yet. Until there is at least one published review, the listing template must not
          emit AggregateRating at all — which is why that block is guarded rather than
          unconditional.
        </div>
      )}

      <div className="rows">
        {reviews.map((r) => {
          const isOpen = open === r.id;
          return (
            <div className="row-card" key={r.id}>
              <header>
                <div>
                  <div className="rt">{r.title || r.reviewer_name || 'Untitled review'}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-quiet)' }}>
                    {r.reviewer_name ?? 'No name'}
                    {r.rating_overall && ` · ${r.rating_overall} overall`}
                    {r.stayed_at && ` · stayed ${new Date(r.stayed_at).toLocaleDateString('en-AU')}`}
                  </div>
                  <div style={{ fontSize: 11.5, marginTop: 3 }}>
                    {r.is_published
                      ? <span style={{ color: 'var(--ok)' }}>Published</span>
                      : <span style={{ color: 'var(--ink-quiet)' }}>Draft</span>}
                    {r.is_verified && <span style={{ color: 'var(--ink-gold)' }}> · verified</span>}
                    {r.response_body && ' · responded'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--s4)' }}>
                  <button className="link-btn" onClick={() => setOpen(isOpen ? null : r.id)}>
                    {isOpen ? 'Close' : 'Edit'}
                  </button>
                  <button className="link-btn" disabled={pending}
                    onClick={() => {
                      if (!window.confirm('Delete this review?')) return;
                      act(() => deleteReview(r.id, venueId));
                    }}>Delete</button>
                </div>
              </header>

              {isOpen && <ReviewPanel r={r} venueId={venueId} act={act} pending={pending} />}
            </div>
          );
        })}
      </div>
    </div></div>
  );
}

function ReviewPanel({
  r, venueId, act, pending,
}: { r: Row; venueId: number; pending: boolean; act: (fn: () => Promise<any>) => void }) {
  const save = (col: string, v: unknown) => act(() => saveReviewField(r.id, venueId, col, v));

  return (
    <>
      <div className="grid">
        <F label="Reviewer name" initial={r.reviewer_name} onSave={(v) => save('reviewer_name', v)} />
        <F label="Context" initial={r.reviewer_context} onSave={(v) => save('reviewer_context', v)}
           help="Retreat host, wellness guest, and so on" />
        <D label="Stayed" initial={r.stayed_at} onSave={(v) => save('stayed_at', v)} />
        <F label="Title" initial={r.title} onSave={(v) => save('title', v)} />
      </div>

      <div className="grid one" style={{ marginTop: 'var(--s3)' }}>
        <F label="Review" textarea initial={r.body} onSave={(v) => save('body', v)} />
      </div>

      <div style={{ marginTop: 'var(--s5)' }}>
        <div style={{ fontSize: 9.5, letterSpacing: '.2em', textTransform: 'uppercase',
                      color: 'var(--ink-quiet)', marginBottom: 'var(--s3)' }}>Ratings</div>
        <div className="grid">
          {RATINGS.map(([col, label]) => (
            <F key={col} label={label} type="number" initial={r[col]}
               onSave={(v) => save(col, v === null ? null : Number(v))} help="1 to 5" />
          ))}
        </div>
      </div>

      <div className="grid one" style={{ marginTop: 'var(--s4)' }}>
        <F label="Venue response" textarea initial={r.response_body}
           onSave={(v) => save('response_body', v)}
           help="Recording a response stamps the time automatically" />
      </div>

      <div style={{ display: 'flex', gap: 'var(--s3)', marginTop: 'var(--s4)' }}>
        <button type="button" disabled={pending}
          className={`pill ${r.is_published ? 'gold' : ''}`}
          style={{ cursor: 'pointer', background: r.is_published ? undefined : 'var(--warm-white)' }}
          onClick={() => save('is_published', !r.is_published)}>
          {r.is_published ? 'Published' : 'Draft'}
        </button>
        <button type="button" disabled={pending}
          className={`pill ${r.is_verified ? 'gold' : ''}`}
          style={{ cursor: 'pointer', background: r.is_verified ? undefined : 'var(--warm-white)' }}
          onClick={() => save('is_verified', !r.is_verified)}>
          {r.is_verified ? 'Verified' : 'Unverified'}
        </button>
        <span className="help" style={{ alignSelf: 'center' }}>
          Verified means tied to a real booking
        </span>
      </div>
    </>
  );
}

function F({
  label, initial, onSave, type = 'text', help, textarea,
}: {
  label: string; initial: any; onSave: (v: string | null) => void;
  type?: string; help?: string; textarea?: boolean;
}) {
  const [v, setV] = useState(initial ?? '');
  const commit = () => { if (String(v) !== String(initial ?? '')) onSave(v === '' ? null : v); };
  return (
    <div className="f">
      <label>{label}</label>
      {textarea
        ? <textarea data-bwignore value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} />
        : <input data-bwignore type={type} value={v}
                 onChange={(e) => setV(e.target.value)} onBlur={commit} />}
      {help && <span className="help">{help}</span>}
    </div>
  );
}

function D({ label, initial, onSave }: { label: string; initial: any; onSave: (v: string | null) => void }) {
  const asDate = initial ? String(initial).slice(0, 10) : '';
  const [v, setV] = useState(asDate);
  return (
    <div className="f">
      <label>{label}</label>
      <input type="date" data-bwignore value={v} onChange={(e) => setV(e.target.value)}
             onBlur={() => v !== asDate && onSave(v || null)} />
    </div>
  );
}
