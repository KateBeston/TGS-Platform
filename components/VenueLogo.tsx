'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { removeLogo, setLogo } from '@/app/actions/venues';
import { useSaveState } from './SaveState';

/* ═══════════════════════════════════════════════════════════════════════
   THE VENUE'S MARK

   Read from their site, and replaceable — a venue rebrands, or the read
   caught a favicon instead of the logo.

   An uploaded one is kept in storage rather than hotlinked. A logo read
   from their site is their file on their server, which disappears the
   day they redesign; one they sent us is ours to keep.
   ═══════════════════════════════════════════════════════════════════════ */

export default function VenueLogo({
  venueId, logoUrl, source,
}: { venueId: number; logoUrl: string | null; source: string | null }) {
  const router = useRouter();
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const file = useRef<HTMLInputElement>(null);

  const upload = async (f: File) => {
    setBusy(true);
    const supabase = createClient();
    const ext = f.name.split('.').pop()?.toLowerCase() ?? 'png';
    const path = `${venueId}-${Date.now()}.${ext}`;

    // venue-logos rather than venue-media, which is private and holds
    // contracts. A logo has to be readable by a browser, and
    // getPublicUrl on a private bucket returns a link that silently
    // shows a broken image.
    const { error } = await supabase.storage
      .from('venue-logos').upload(path, f, { upsert: false });

    if (error) { setMsg(error.message); setBusy(false); return; }

    const { data } = supabase.storage.from('venue-logos').getPublicUrl(path);
    const r = await setLogo(venueId, data.publicUrl, 'Uploaded');
    setMsg(r.ok ? '' : (r as any).error);
    setBusy(false);
    setOpen(false);
    router.refresh();
  };

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      {logoUrl ? (
        <img src={logoUrl} alt=""
          onClick={() => setOpen(!open)}
          style={{ height: 56, maxWidth: 190, objectFit: 'contain',
                   objectPosition: 'left center', display: 'block',
                   cursor: 'pointer' }}
          title="Change or remove" />
      ) : (
        <button className="link-btn" onClick={() => setOpen(!open)}
          style={{ fontSize: 11.5 }}>
          Add a logo
        </button>
      )}

      <input ref={file} type="file" hidden accept="image/*"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 40,
          background: 'var(--warm-white)', border: '1px solid var(--border)',
          borderTop: '2px solid var(--gold)', padding: 'var(--s4)',
          minWidth: 260, marginTop: 6,
          boxShadow: '0 6px 24px rgba(49,49,49,.10)',
        }}>
          {source && (
            <div className="v-slug" style={{ marginBottom: 'var(--s3)' }}>
              {source}
            </div>
          )}

          {msg && <div className="note bad" style={{ fontSize: 12 }}>{msg}</div>}

          <button className="btn quiet" disabled={busy}
            style={{ width: '100%', marginBottom: 6 }}
            onClick={() => file.current?.click()}>
            {busy ? 'Uploading…' : 'Upload a new one'}
          </button>

          <div className="f" style={{ marginBottom: 6 }}>
            <label style={{ fontSize: 9 }}>Or paste an address</label>
            <input data-bwignore placeholder="https://"
              style={{ background: 'var(--warm-white)',
                       border: '1px solid var(--border-input)',
                       padding: '6px 8px', fontSize: 12, width: '100%' }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                const v = (e.target as HTMLInputElement).value.trim();
                if (!v) return;
                start(async () => {
                  report('saving');
                  const r = await setLogo(venueId, v, 'Set by hand');
                  report(r.ok ? 'saved' : 'error');
                  setMsg(r.ok ? '' : (r as any).error);
                  if (r.ok) { setOpen(false); router.refresh(); }
                });
              }} />
          </div>

          {logoUrl && (
            <button className="link-btn" disabled={pending}
              onClick={() => start(async () => {
                report('saving');
                const r = await removeLogo(venueId);
                report(r.ok ? 'saved' : 'error');
                if (r.ok) { setOpen(false); router.refresh(); }
              })}>
              Remove it
            </button>
          )}

          <button className="link-btn" style={{ marginLeft: logoUrl ? 12 : 0 }}
            onClick={() => setOpen(false)}>Close</button>
        </div>
      )}
    </div>
  );
}
