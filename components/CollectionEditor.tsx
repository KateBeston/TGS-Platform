'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  deleteCollection, saveCollectionField, searchVenues, toggleCollectionVenue,
} from '@/app/actions/curation';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

export default function CollectionEditor({
  collection, members,
}: { collection: Row; members: Row[] }) {
  const router = useRouter();
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [list, setList] = useState(members);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Row[]>([]);

  const act = (fn: () => Promise<any>) => start(async () => {
    report('saving');
    const res = await fn();
    report(res.ok ? 'saved' : 'error', res.ok ? undefined : 'Failed');
    if (!res.ok) alert(res.error);
  });

  const save = (col: string, v: unknown) => act(() => saveCollectionField(collection.id, col, v));

  return (
    <>
      <div className="ph">
        <div>
          <h2>{collection.name}</h2>
          <div className="ph-sub">{list.length} venue{list.length === 1 ? '' : 's'}</div>
        </div>
        <div className="ph-act">
          {collection.is_published
            ? <span className="pill gold">Published</span>
            : <span className="pill empty">Draft</span>}
        </div>
      </div>

      <div className="sect">
        <h3>Details</h3>
        <div className="grid">
          <F label="Name" initial={collection.name} onSave={(v) => save('name', v)} />
          <F label="Slug" initial={collection.slug} onSave={(v) => save('slug', v)}
             help="Permanent once published" />
          <F label="Tagline" initial={collection.tagline} onSave={(v) => save('tagline', v)} />
          <div className="f">
            <label>Marketplace</label>
            <select defaultValue={collection.marketplace ?? ''} disabled={pending}
              onChange={(e) => save('marketplace', e.target.value || null)}
              style={{ background: 'var(--warm-white)', border: '1px solid var(--border-input)',
                       padding: '8px 10px', fontSize: 13 }}>
              <option value="">Both</option>
              <option value="Retreat">Retreat</option>
              <option value="Wellness">Wellness</option>
            </select>
          </div>
        </div>
        <div className="grid one" style={{ marginTop: 'var(--s3)' }}>
          <F label="Introduction" textarea initial={collection.intro}
             onSave={(v) => save('intro', v)}
             help="The copy at the top of the collection page" />
          <F label="Hero image URL" initial={collection.hero_image_url}
             onSave={(v) => save('hero_image_url', v)} />
        </div>
      </div>

      <div className="sect">
        <h3>Search metadata</h3>
        <div className="grid one">
          <F label="Meta title" initial={collection.meta_title}
             onSave={(v) => save('meta_title', v)} />
          <F label="Meta description" textarea initial={collection.meta_description}
             onSave={(v) => save('meta_description', v)} />
        </div>
      </div>

      <div className="sect">
        <h3>Venues</h3>
        <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'flex-end',
                      marginBottom: 'var(--s4)' }}>
          <div className="f" style={{ minWidth: 280, flex: 1 }}>
            <label htmlFor="cq">Add a venue</label>
            <input id="cq" data-bwignore value={q} placeholder="Venue name"
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' &&
                start(async () => setResults(await searchVenues(q)))}
              style={{ background: 'var(--warm-white)', border: '1px solid var(--border-input)',
                       padding: '8px 10px', fontSize: 13 }} />
          </div>
          <button className="btn quiet" disabled={pending}
            onClick={() => start(async () => setResults(await searchVenues(q)))}>Search</button>
        </div>

        {!!results.length && (
          <table style={{ marginBottom: 'var(--s5)' }}>
            <tbody>
              {results.map((r) => {
                const already = list.some((m) => m.venue_id === r.id);
                return (
                  <tr key={r.id}>
                    <td><span className="v-name">{r.venue_name}</span></td>
                    <td className="v-slug">{r.country_name ?? '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      {already
                        ? <span className="pill empty">Added</span>
                        : <button className="link-btn" disabled={pending}
                            onClick={() => act(async () => {
                              const res = await toggleCollectionVenue(collection.id, r.id, true);
                              if (res.ok) setList([...list, { venue_id: r.id,
                                venues: { id: r.id, venue_name: r.venue_name } }]);
                              return res;
                            })}>Add</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {!list.length && <div className="note">No venues in this collection yet.</div>}
        {!!list.length && (
          <table>
            <tbody>
              {list.map((m) => (
                <tr key={m.venue_id}>
                  <td><span className="v-name">{m.venues?.venue_name ?? 'Venue'}</span></td>
                  <td className="v-slug">{m.venues?.countries?.name ?? '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="link-btn" disabled={pending}
                      onClick={() => act(async () => {
                        const res = await toggleCollectionVenue(collection.id, m.venue_id, false);
                        if (res.ok) setList(list.filter((x) => x.venue_id !== m.venue_id));
                        return res;
                      })}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="sect">
        <h3>Status</h3>
        <div style={{ display: 'flex', gap: 'var(--s3)' }}>
          <button type="button" disabled={pending}
            className={`pill ${collection.is_published ? 'gold' : ''}`}
            style={{ cursor: 'pointer',
                     background: collection.is_published ? undefined : 'var(--warm-white)' }}
            onClick={() => save('is_published', !collection.is_published)}>
            {collection.is_published ? 'Published' : 'Draft'}
          </button>
          <button type="button" disabled={pending}
            className={`pill ${collection.is_featured ? 'gold' : ''}`}
            style={{ cursor: 'pointer',
                     background: collection.is_featured ? undefined : 'var(--warm-white)' }}
            onClick={() => save('is_featured', !collection.is_featured)}>
            {collection.is_featured ? 'Featured on home' : 'Not featured'}
          </button>
          <button className="link-btn" disabled={pending}
            onClick={() => {
              if (!window.confirm(`Delete "${collection.name}"? The venues are unaffected.`)) return;
              act(async () => {
                const res = await deleteCollection(collection.id);
                if (res.ok) router.push('/collections');
                return res;
              });
            }}>Delete collection</button>
        </div>
      </div>
    </>
  );
}

function F({
  label, initial, onSave, help, textarea,
}: {
  label: string; initial: any; onSave: (v: string | null) => void;
  help?: string; textarea?: boolean;
}) {
  const [v, setV] = useState(initial ?? '');
  const commit = () => { if (v !== (initial ?? '')) onSave(v === '' ? null : v); };
  return (
    <div className="f">
      <label>{label}</label>
      {textarea
        ? <textarea data-bwignore value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} />
        : <input data-bwignore value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} />}
      {help && <span className="help">{help}</span>}
    </div>
  );
}
