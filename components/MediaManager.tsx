'use client';

import { useState, useTransition } from 'react';
import {
  addMediaByUrl, assignPlacement, deleteMedia, reorderMedia,
  saveMediaField, setPrimary, uploadMedia,
} from '@/app/actions/media';
import { ACCEPT_MEDIA } from '@/lib/fileTypes';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

export default function MediaManager({
  venueId, placements, media, spaces, rooms,
}: {
  venueId: number;
  placements: Row[];
  media: Row[];
  spaces: { id: number; name: string }[];
  rooms: { id: number; name: string }[];
}) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');
  const [target, setTarget] = useState<number | null>(null);
  const [urlValue, setUrlValue] = useState('');

  const act = (fn: () => Promise<any>) => start(async () => {
    report('saving');
    const res = await fn();
    setMsg(res.ok ? (res.message ?? 'Saved.') : res.error);
    report(res.ok ? 'saved' : 'error', res.ok ? undefined : 'Failed');
  });

  const listing = placements.filter(
    (p) => (p.surface === 'Listing' || p.surface === 'Card') && !/retired/i.test(p.label));
  const library = placements.filter((p) => p.surface === 'Brand' || p.surface === 'Internal');
  const byPlacement = (id: number) => media.filter((m) => m.placement_id === id);
  const unassigned = media.filter((m) => !m.placement_id);

  const onFile = (placementId: number | null) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.set('venue_id', String(venueId));
    if (placementId) fd.set('placement_id', String(placementId));
    fd.set('file', file);
    e.target.value = '';
    act(() => uploadMedia(fd));
  };

  return (
    <div className="content"><div className="wrap">
      <div className="ph">
        <div>
          <h2>Media</h2>
          <div className="ph-sub">
            {media.length} item{media.length === 1 ? '' : 's'} · listing images are placed;
            everything else lives in the library
          </div>
        </div>
      </div>

      <div className="note">
        <strong>The hero is uploaded once and used in three places</strong> — the static image at
        the top of the listing, the venue card on the home page, and the card in venue search.</div>

      {msg && <div className="note">{msg}</div>}

      {/* ── LISTING ─────────────────────────────────────────────── */}
      <div className="sect">
        <h3>Listing images</h3>
        <div className="ph-sub" style={{ marginBottom: 'var(--s5)' }}>
          Where each image appears on the public page
        </div>

        {listing.map((p) => {
          const items = byPlacement(p.id);
          const full = p.max_items && items.length >= p.max_items;
          return (
            <div className="row-card" key={p.id} style={{ marginBottom: 'var(--s4)' }}>
              <header>
                <div>
                  <div className="rt">{p.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-quiet)' }}>
                    {p.description}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-quiet)', marginTop: 4 }}>
                    {p.aspect_ratio && `${p.aspect_ratio} · `}
                    {p.recommended_width && `${p.recommended_width}px wide recommended · `}
                    {items.length}{p.max_items ? ` of ${p.max_items}` : ''} used
                    {p.is_required && !items.length &&
                      <span style={{ color: 'var(--warn)' }}> · required</span>}
                    {p.links_to && ` · one per ${p.links_to.replace('_', ' ')}`}
                  </div>
                </div>
                <label className={`btn quiet ${full ? '' : ''}`}
                       style={{ cursor: full ? 'not-allowed' : 'pointer', opacity: full ? 0.45 : 1 }}>
                  Upload
                  <input type="file" hidden disabled={full || pending}
                         accept={ACCEPT_MEDIA}
                         onChange={onFile(p.id)} />
                </label>
              </header>

              {!items.length && (
                <div style={{ padding: 'var(--s4)', border: '1px dashed var(--border-input)',
                              color: 'var(--ink-quiet)', fontSize: 12, textAlign: 'center' }}>
                  Nothing here yet
                </div>
              )}

              {!!items.length && (
                <SortableGrid items={items} venueId={venueId} act={act} pending={pending}
                              spaces={spaces} rooms={rooms} linksTo={p.links_to}
                              sortable={(p.max_items ?? 1) > 1} />
              )}
            </div>
          );
        })}
      </div>

      {/* ── LIBRARY ─────────────────────────────────────────────── */}
      <div className="sect">
        <h3>General library</h3>
        <div className="ph-sub" style={{ marginBottom: 'var(--s4)' }}>
          Logos, floor plans, documents and anything not yet placed. Nothing here is rendered on
          the public listing.
        </div>

        <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'flex-end',
                      marginBottom: 'var(--s5)', flexWrap: 'wrap' }}>
          <div className="f" style={{ minWidth: 180 }}>
            <label htmlFor="lib">Add to library</label>
            <select id="lib" value={target ?? ''} disabled={pending}
              onChange={(e) => setTarget(e.target.value ? Number(e.target.value) : null)}
              style={{ background: 'var(--warm-white)', border: '1px solid var(--border-input)',
                       padding: '8px 10px', fontSize: 13 }}>
              <option value="">Unsorted</option>
              {library.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
          <label className="btn quiet" style={{ cursor: 'pointer' }}>
            Upload file
            <input type="file" hidden disabled={pending}
                   accept={ACCEPT_MEDIA}
                   onChange={onFile(target)} />
          </label>

          <div className="f" style={{ minWidth: 240, flex: 1 }}>
            <label htmlFor="url">Or paste an image URL</label>
            <input id="url" value={urlValue} placeholder="https://…" disabled={pending}
                   onChange={(e) => setUrlValue(e.target.value)}
                   style={{ background: 'var(--warm-white)',
                            border: '1px solid var(--border-input)',
                            padding: '8px 10px', fontSize: 13 }} />
          </div>
          <button className="btn quiet" disabled={pending || !urlValue.trim()}
            onClick={() => act(async () => {
              const r = await addMediaByUrl(venueId, urlValue, target);
              if (r.ok) setUrlValue('');
              return r;
            })}>Add URL</button>
        </div>

        {library.map((p) => {
          const items = byPlacement(p.id);
          if (!items.length) return null;
          return (
            <div key={p.id} style={{ marginBottom: 'var(--s5)' }}>
              <div style={{ fontSize: 9.5, letterSpacing: '.2em', textTransform: 'uppercase',
                            color: 'var(--ink-quiet)', marginBottom: 'var(--s3)' }}>
                {p.label}
              </div>
              <SortableGrid items={items} venueId={venueId} act={act} pending={pending}
                            spaces={spaces} rooms={rooms} placements={placements} sortable />
            </div>
          );
        })}

        <div style={{ fontSize: 9.5, letterSpacing: '.2em', textTransform: 'uppercase',
                      color: 'var(--ink-quiet)', marginBottom: 'var(--s3)' }}>
          Unsorted
        </div>
        {!unassigned.length && (
          <div className="note" style={{ marginBottom: 0 }}>Nothing unsorted.</div>
        )}
        {!!unassigned.length && (
          <SortableGrid items={unassigned} venueId={venueId} act={act} pending={pending}
                        spaces={spaces} rooms={rooms} placements={placements} sortable />
        )}
      </div>
    </div></div>
  );
}

/** Reordering, two ways on purpose.
 *  Drag is quicker once there are a dozen images, but it does not work on
 *  touch and is awkward with a keyboard. The arrows always work. Both
 *  write the same display_order, and the move is applied locally first so
 *  it feels instant rather than waiting on a round trip. */
function SortableGrid({
  items, venueId, act, pending, spaces, rooms, linksTo, placements, sortable,
}: {
  items: Row[]; venueId: number; pending: boolean;
  act: (fn: () => Promise<any>) => void;
  spaces: { id: number; name: string }[];
  rooms: { id: number; name: string }[];
  linksTo?: string | null;
  placements?: Row[];
  sortable?: boolean;
}) {
  const [order, setOrder] = useState<Row[]>(items);
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  // Keep in step when the server sends a fresh list after an upload.
  const ids = items.map((i) => i.id).join(',');
  const currentIds = order.map((i) => i.id).join(',');
  if (ids !== currentIds && items.length !== order.length) setOrder(items);

  const commit = (next: Row[]) => {
    setOrder(next);
    act(() => reorderMedia(venueId, next.map((n) => n.id)));
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || from === to) return;
    const next = [...order];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    commit(next);
  };

  return (
    <>
      {sortable && order.length > 1 && (
        <div style={{ fontSize: 11, color: 'var(--ink-quiet)', marginBottom: 'var(--s2)' }}>
          Drag to reorder, or use the arrows. The first image shows first.
        </div>
      )}
      <div style={{ display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))',
                    gap: 'var(--s3)' }}>
        {order.map((m, i) => (
          <div key={m.id}
            draggable={!!sortable && !pending}
            onDragStart={() => setDragging(i)}
            onDragOver={(e) => { e.preventDefault(); setOver(i); }}
            onDragLeave={() => setOver(null)}
            onDragEnd={() => { setDragging(null); setOver(null); }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragging !== null) move(dragging, i);
              setDragging(null); setOver(null);
            }}
            style={{
              cursor: sortable ? 'grab' : 'default',
              opacity: dragging === i ? 0.4 : 1,
              outline: over === i && dragging !== i ? '2px solid var(--gold)' : 'none',
              outlineOffset: 2,
            }}>
            <MediaCard m={m} venueId={venueId} act={act} pending={pending}
                       spaces={spaces} rooms={rooms} linksTo={linksTo}
                       placements={placements}
                       position={sortable && order.length > 1 ? i + 1 : undefined}
                       total={order.length}
                       onMove={sortable ? (dir: number) => move(i, i + dir) : undefined} />
          </div>
        ))}
      </div>
    </>
  );
}

function MediaCard({
  m, venueId, act, pending, spaces, rooms, linksTo, placements,
  position, total, onMove,
}: {
  m: Row; venueId: number; pending: boolean;
  act: (fn: () => Promise<any>) => void;
  spaces: { id: number; name: string }[];
  rooms: { id: number; name: string }[];
  linksTo?: string | null;
  placements?: Row[];
  position?: number;
  total?: number;
  onMove?: (direction: number) => void;
}) {
  const [alt, setAlt] = useState(m.alt_text ?? '');
  const isImage = m.media_type === 'image';

  return (
    <div style={{ border: '1px solid var(--border)', background: 'var(--warm-white)' }}>
      {position !== undefined && onMove && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '5px var(--s3)', borderBottom: '1px solid var(--border)',
                      background: 'var(--warm-cream)' }}>
          <span style={{ fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase',
                         color: 'var(--ink-quiet)' }}>
            {position === 1 ? 'Shows first' : `Position ${position}`}
          </span>
          <span style={{ display: 'flex', gap: 2 }}>
            <button type="button" disabled={pending || position === 1}
              aria-label="Move earlier" onClick={() => onMove(-1)}
              style={{ border: '1px solid var(--border)', background: 'var(--warm-white)',
                       cursor: 'pointer', padding: '1px 7px', fontSize: 12,
                       opacity: position === 1 ? 0.3 : 1 }}>&#8592;</button>
            <button type="button" disabled={pending || position === total}
              aria-label="Move later" onClick={() => onMove(1)}
              style={{ border: '1px solid var(--border)', background: 'var(--warm-white)',
                       cursor: 'pointer', padding: '1px 7px', fontSize: 12,
                       opacity: position === total ? 0.3 : 1 }}>&#8594;</button>
          </span>
        </div>
      )}

      <div style={{ aspectRatio: '4/3', background: 'var(--warm-cream)',
                    display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
        {isImage && (m.display_url ?? m.url)
          ? <img src={m.display_url ?? m.url} alt={m.alt_text ?? ''} loading="lazy"
                 style={{ width: '100%', height: '100%', objectFit: 'cover',
                          objectPosition: `${m.focal_x ?? 50}% ${m.focal_y ?? 50}%` }} />
          : <span style={{ fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase',
                           color: 'var(--ink-quiet)' }}>{m.media_type}</span>}
      </div>

      <div style={{ padding: 'var(--s3)' }}>
        <div className="f" style={{ marginBottom: 'var(--s2)' }}>
          <input value={alt} placeholder="Alt text" disabled={pending}
                 data-bwignore data-1p-ignore
                 onChange={(e) => setAlt(e.target.value)}
                 onBlur={() => alt !== (m.alt_text ?? '') &&
                   act(() => saveMediaField(m.id, venueId, 'alt_text', alt || null))}
                 style={{ fontSize: 12, padding: '6px 8px',
                          border: '1px solid var(--border-input)', width: '100%' }} />
          <span className="help" style={{ fontSize: 10 }}>
            Describes the image for screen readers and search
          </span>
        </div>

        {linksTo === 'space' && !!spaces.length && (
          <select defaultValue={m.space_id ?? ''} disabled={pending}
            onChange={(e) => act(() => saveMediaField(m.id, venueId, 'space_id',
              e.target.value ? Number(e.target.value) : null))}
            style={{ fontSize: 12, padding: '5px 6px', width: '100%',
                     border: '1px solid var(--border-input)', marginBottom: 'var(--s2)' }}>
            <option value="">Which space?</option>
            {spaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}

        {linksTo === 'room_type' && !!rooms.length && (
          <select defaultValue={m.room_type_id ?? ''} disabled={pending}
            onChange={(e) => act(() => saveMediaField(m.id, venueId, 'room_type_id',
              e.target.value ? Number(e.target.value) : null))}
            style={{ fontSize: 12, padding: '5px 6px', width: '100%',
                     border: '1px solid var(--border-input)', marginBottom: 'var(--s2)' }}>
            <option value="">Which room type?</option>
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        )}

        {placements && (
          <select defaultValue={m.placement_id ?? ''} disabled={pending}
            onChange={(e) => act(() => assignPlacement(m.id, venueId,
              e.target.value ? Number(e.target.value) : null))}
            style={{ fontSize: 12, padding: '5px 6px', width: '100%',
                     border: '1px solid var(--border-input)', marginBottom: 'var(--s2)' }}>
            <option value="">Unplaced</option>
            {placements.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        )}

        {isImage && m.is_primary && (
          <div style={{ marginBottom: 'var(--s2)' }}>
            <div style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase',
                          color: 'var(--ink-quiet)', marginBottom: 4 }}>
              Focal point
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input type="range" min={0} max={100} defaultValue={m.focal_x ?? 50}
                     disabled={pending} aria-label="Horizontal focal point"
                     onMouseUp={(e) => act(() => saveMediaField(
                       m.id, venueId, 'focal_x', Number((e.target as HTMLInputElement).value)))}
                     onTouchEnd={(e) => act(() => saveMediaField(
                       m.id, venueId, 'focal_x', Number((e.target as HTMLInputElement).value)))}
                     style={{ flex: 1 }} />
              <input type="range" min={0} max={100} defaultValue={m.focal_y ?? 50}
                     disabled={pending} aria-label="Vertical focal point"
                     onMouseUp={(e) => act(() => saveMediaField(
                       m.id, venueId, 'focal_y', Number((e.target as HTMLInputElement).value)))}
                     onTouchEnd={(e) => act(() => saveMediaField(
                       m.id, venueId, 'focal_y', Number((e.target as HTMLInputElement).value)))}
                     style={{ flex: 1 }} />
            </div>
            <span className="help" style={{ fontSize: 10 }}>
              Keeps the important part in frame when cropped to a card
            </span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', gap: 'var(--s2)' }}>
          <button className="link-btn" disabled={pending}
            onClick={() => act(() => saveMediaField(m.id, venueId, 'is_approved', !m.is_approved))}>
            {m.is_approved ? 'Approved' : 'Approve'}
          </button>
          {isImage && !m.is_primary && (
            <button className="link-btn" disabled={pending}
              onClick={() => act(() => setPrimary(m.id, venueId))}>Make hero</button>
          )}
          {m.is_primary && <span className="pill gold">Hero</span>}
          <button className="link-btn" disabled={pending}
            onClick={() => {
              if (!window.confirm('Delete this file? This cannot be undone.')) return;
              act(() => deleteMedia(m.id, venueId));
            }}>Delete</button>
        </div>
      </div>
    </div>
  );
}
