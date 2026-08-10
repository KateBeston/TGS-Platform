'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { readPageInto } from '@/app/actions/venueIntake';
import { useSaveState } from './SaveState';

const WHAT = [
  { key: 'services', label: 'Services', note: 'A treatment menu, or what they sell by the hour' },
  { key: 'facilities', label: 'Facilities', note: 'What the venue has — a sauna, a pool, a gym. Things a guest walks into rather than books.' },
  { key: 'packages', label: 'Packages', note: 'Named rituals at one price, made of several parts' },
  { key: 'rooms', label: 'Room types', note: 'An accommodation page' },
  { key: 'spaces', label: 'Spaces', note: 'Shalas, studios, meeting rooms' },
] as const;

const sel: React.CSSProperties = {
  background: 'var(--warm-white)', border: '1px solid var(--border-input)',
  padding: '8px 10px', fontSize: 13.5, width: '100%',
};

/* ═══════════════════════════════════════════════════════════════════════
   READ ONE PAGE

   Different from a re-read, which crawls a whole site and replaces the
   picture. This takes a single page and adds what it finds.

   For when somebody is looking at a spa menu and can see it holds forty
   treatments the record does not have. Re-reading the whole site to get
   them would cost more and change more than intended.

   It adds rather than replaces, so running it twice produces duplicates.
   Said plainly below rather than guarded against, because merging would
   need a matching rule and a wrong merge is harder to undo than a
   duplicate row.
   ═══════════════════════════════════════════════════════════════════════ */

export default function ReadOnePage({
  venueId, spaces = [],
}: { venueId: number; spaces?: { id: number; name: string; operator?: string | null }[] }) {
  const router = useRouter();
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [what, setWhat] = useState<typeof WHAT[number]['key']>('services');
  const [follow, setFollow] = useState(true);
  const [spaceId, setSpaceId] = useState<string>('');
  const [msg, setMsg] = useState('');

  return (
    <div className="sect">
      <div className="ph" style={{ marginBottom: 'var(--s3)' }}>
        <div>
          <h3 style={{ borderBottom: 0, marginBottom: 0, paddingBottom: 0 }}>
            Read one page
          </h3>
          <div className="ph-sub">
            Adds what a single page holds, without re-reading the whole site
          </div>
        </div>
        <div className="ph-act">
          <button className="btn quiet" onClick={() => setOpen(!open)}>
            {open ? 'Close' : 'Point it at a page'}
          </button>
        </div>
      </div>

      {msg && <div className="note">{msg}</div>}

      {open && (
        <>
          <div className="grid">
            <div className="f" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="pageurl">The page</label>
              <input id="pageurl" data-bwignore style={sel} value={url}
                placeholder="https://www.1hotels.com/melbourne/bamford-wellness-spa"
                onChange={(e) => setUrl(e.target.value)} />
            </div>

            <div className="f" style={{ gridColumn: '1 / -1' }}>
              <label>What to take from it</label>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {WHAT.map((w) => (
                  <button key={w.key} type="button"
                    className={`pill ${what === w.key ? 'gold' : ''}`}
                    style={{ cursor: 'pointer',
                             background: what === w.key ? undefined : 'var(--warm-white)' }}
                    onClick={() => setWhat(w.key)}>
                    {w.label}
                  </button>
                ))}
              </div>
              <span className="help">
                {WHAT.find((w) => w.key === what)?.note}
                {' · '}
                Asking for one thing gives a better answer than asking for everything.
              </span>
            </div>
          </div>

          {!!spaces.length && (what === 'services' || what === 'packages') && (
            <div className="f" style={{ marginTop: 'var(--s3)' }}>
              <label htmlFor="intospace">Put them in</label>
              <select id="intospace" style={sel} value={spaceId}
                onChange={(e) => setSpaceId(e.target.value)}>
                <option value="">The venue, not a particular space</option>
                {spaces.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    {sp.name}{sp.operator ? ` · run by ${sp.operator}` : ''}
                  </option>
                ))}
              </select>
              <span className="help">
                A hotel with a spa, a gym and a studio has three menus. Services with no space
                cannot be shown under the right heading.
              </span>
            </div>
          )}

          <div className="f" style={{ marginTop: 'var(--s3)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8,
                            cursor: 'pointer' }}>
              <input type="checkbox" checked={follow} data-bwignore
                onChange={(e) => setFollow(e.target.checked)} />
              Follow the links on that page
            </label>
            <span className="help">
              A wellness tab is usually a contents page — it links to the spa, the gym and the
              pool, and the treatments live on those rather than on it. Up to six pages beneath
              the same path.
            </span>
          </div>

          <button className="btn" disabled={pending || !url.trim()}
            style={{ marginTop: 'var(--s3)' }}
            onClick={() => start(async () => {
              report('saving');
              const r = await readPageInto(venueId, url, what, follow,
                                           spaceId ? Number(spaceId) : null);
              setMsg(r.ok ? (r.message ?? 'Read.') : (r as any).error);
              report(r.ok ? 'saved' : 'error');
              if (r.ok) { setUrl(''); router.refresh(); }
            })}>
            {pending
              ? (follow ? 'Reading that section…' : 'Reading that page…')
              : (follow ? 'Read the section' : 'Read the page')}
          </button>

          <div className="note" style={{ marginTop: 'var(--s4)', marginBottom: 0 }}>
            This adds rather than replaces, so running it twice on the same page produces
            duplicates. Merging would need a matching rule, and a wrong merge is harder to undo
            than a duplicate row.
          </div>
        </>
      )}
    </div>
  );
}
