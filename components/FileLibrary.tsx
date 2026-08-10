'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  fileUrl, recordFile, recordLink, removeFile, saveFile,
} from '@/app/actions/files';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

const sel: React.CSSProperties = {
  background: 'var(--warm-white)', border: '1px solid var(--border-input)',
  padding: '6px 8px', fontSize: 12.5, width: '100%',
};

const size = (b: number | null) => {
  if (!b) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
};

const when = (d: string) => new Date(d).toLocaleDateString('en-AU',
  { day: 'numeric', month: 'short', year: 'numeric' });

/* ═══════════════════════════════════════════════════════════════════════
   BUSINESS FILES

   Ten areas, matching what was on the laptop — which is one hard drive
   away from being no folders at all.

   Two of them point elsewhere rather than duplicating: legal documents
   live in Legal, with versioning and acceptance records a folder cannot
   provide, and most of Finance is now invoices and statements.

   Not everything belongs here. A shared drive folder or a Figma file
   should stay where it is — what matters is that somebody looking for it
   can find out where that is, which is what a recorded link does.
   ═══════════════════════════════════════════════════════════════════════ */

export default function FileLibrary({
  areas, files, area, query,
}: { areas: Row[]; files: Row[]; area: string; query: string }) {
  const router = useRouter();
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [msg, setMsg] = useState('');
  const [linking, setLinking] = useState(false);
  const [link, setLink] = useState({ name: '', url: '', area: '' });
  const [search, setSearch] = useState(query);
  const input = useRef<HTMLInputElement>(null);

  const act = (fn: () => Promise<any>) => start(async () => {
    report('saving');
    const r = await fn();
    setMsg(r?.ok === false ? r.error : (r?.message ?? ''));
    report(r?.ok === false ? 'error' : 'saved');
    if (r?.ok !== false) { setLinking(false); setLink({ name: '', url: '', area: '' }); }
  });

  const top = areas.filter((a) => !a.parent_id);
  const subs = (id: number) => areas.filter((a) => a.parent_id === id);
  const current = areas.find((a) => a.slug === area);

  /** Uploads straight to storage from the browser.
   *
   *  A server action would hold the whole file in memory on the way
   *  through, which fails on anything large for no benefit. */
  const upload = async (fileList: FileList) => {
    if (!current || current.lives_at) {
      setMsg('Choose an area first — files need somewhere to go.');
      return;
    }
    setUploading(true);
    const supabase = createClient();
    let done = 0;

    for (const f of Array.from(fileList)) {
      setProgress(`${f.name} — ${done + 1} of ${fileList.length}`);
      // Prefixed with the area and a timestamp, so two files of the same
      // name in different months do not collide.
      const path = `${current.slug}/${Date.now()}-${f.name.replace(/[^\w.\-]/g, '_')}`;

      const { error } = await supabase.storage
        .from('business-files').upload(path, f, { upsert: false });

      if (error) { setMsg(`${f.name}: ${error.message}`); continue; }

      await recordFile(current.id, f.name, path, {
        size_bytes: f.size, mime_type: f.type,
        file_kind: f.name.split('.').pop()?.toUpperCase() ?? null,
      });
      done++;
    }

    setUploading(false);
    setProgress('');
    setMsg(`${done} file${done === 1 ? '' : 's'} uploaded.`);
    router.refresh();
  };

  const open = async (f: Row) => {
    if (f.external_url) { window.open(f.external_url, '_blank'); return; }
    if (!f.storage_path) return;
    const url = await fileUrl(f.storage_path);
    if (url) window.open(url, '_blank');
    else setMsg('Could not open that file.');
  };

  return (
    <>
      <div className="ph">
        <div>
          <h2>Files</h2>
          <div className="ph-sub">
            {current ? current.name : `${files.length} across ${top.length} areas`}
          </div>
        </div>
        <div className="ph-act">
          <button className="btn quiet" onClick={() => setLinking(!linking)}>
            Record a link
          </button>
          <button className="btn" disabled={uploading || !current || !!current?.lives_at}
            onClick={() => input.current?.click()}>
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>

      <input ref={input} type="file" multiple hidden
        onChange={(e) => e.target.files && upload(e.target.files)} />

      {progress && <div className="note">{progress}</div>}
      {msg && <div className="note">{msg}</div>}

      {/* ── search ────────────────────────────────────────────── */}
      <form style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'flex-end',
                     marginBottom: 'var(--s4)' }}
            onSubmit={(e) => {
              e.preventDefault();
              const p = new URLSearchParams();
              if (area !== 'all') p.set('area', area);
              if (search.trim()) p.set('q', search.trim());
              router.push(`/business/files?${p}`);
            }}>
        <div className="f" style={{ flex: 1, maxWidth: 380 }}>
          <label htmlFor="fq">Search files</label>
          <input id="fq" type="search" data-bwignore value={search} style={sel}
            placeholder="Name or description"
            onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button className="btn quiet" type="submit">Search</button>
      </form>

      {linking && (
        <div className="sect">
          <div className="grid">
            <div className="f">
              <label>File name</label>
              <input data-bwignore value={link.name} style={sel}
                placeholder="Brand guidelines in Figma"
                onChange={(e) => setLink({ ...link, name: e.target.value })} />
            </div>
            <div className="f">
              <label>Web address</label>
              <input data-bwignore value={link.url} style={sel}
                placeholder="https://"
                onChange={(e) => setLink({ ...link, url: e.target.value })} />
            </div>
            <div className="f">
              <label>Area</label>
              <select value={link.area} style={sel}
                onChange={(e) => setLink({ ...link, area: e.target.value })}>
                <option value="">Choose</option>
                {areas.filter((a) => !a.lives_at).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.parent_name ? `${a.parent_name} · ` : ''}{a.name}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <button className="btn" disabled={pending || !link.name || !link.url || !link.area}
                onClick={() => act(() =>
                  recordLink(Number(link.area), link.name, link.url))}>
                Record it
              </button>
              <span className="help" style={{ marginLeft: 10 }}>
                For things that should stay where they are — a shared drive folder, a Figma file
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── the areas ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 'var(--s2)', flexWrap: 'wrap',
                    marginBottom: 'var(--s5)' }}>
        <Link className={`btn ${area === 'all' ? '' : 'quiet'}`} href="/business/files">
          Everything
        </Link>
        {top.map((a) => (
          <Link key={a.id} className={`btn ${area === a.slug ? '' : 'quiet'}`}
                href={a.lives_at ?? `/business/files?area=${a.slug}`}
                style={a.lives_at ? { borderStyle: 'dashed' } : undefined}>
            {a.name}
            {a.files_including_sub > 0 && ` · ${a.files_including_sub}`}
          </Link>
        ))}
      </div>

      {current?.lives_at && (
        <div className="note">
          These live in <Link href={current.lives_at}>{current.name}</Link> rather than here — with
          versioning and acceptance records a folder cannot provide.
        </div>
      )}

      {!!current && !current.lives_at && !!subs(current.id).length && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap',
                      marginBottom: 'var(--s4)' }}>
          {subs(current.id).map((s) => (
            <Link key={s.id} className="pill" href={`/business/files?area=${s.slug}`}
                  style={{ textDecoration: 'none' }}>
              {s.name}{s.files > 0 && ` · ${s.files}`}
            </Link>
          ))}
        </div>
      )}

      {current?.description && (
        <div className="ph-sub" style={{ marginBottom: 'var(--s4)' }}>
          {current.description}
        </div>
      )}

      {/* ── the files ─────────────────────────────────────────── */}
      {!files.length ? (
        <div className="note" style={{ marginBottom: 0 }}>
          {query ? 'Nothing matches that.'
            : current?.lives_at ? 'Nothing stored here by design.'
            : current ? 'Nothing here yet — upload, or record a link to where it lives.'
            : 'Nothing yet. Choose an area and upload.'}
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>File</th><th>Area</th><th>Version</th>
              <th>Added</th><th style={{ width: 120 }}></th>
            </tr>
          </thead>
          <tbody>
            {files.map((f) => (
              <tr key={f.id}>
                <td>
                  <button className="link-btn" style={{ textAlign: 'left' }}
                    onClick={() => open(f)}>
                    <span className="v-name" style={{ fontSize: 15 }}>{f.name}</span>
                  </button>
                  <div className="v-slug">
                    {[f.file_kind, size(f.size_bytes),
                      f.external_url ? 'held elsewhere' : null,
                      f.venues?.venue_name].filter(Boolean).join(' · ')}
                  </div>
                  {f.description && (
                    <div className="v-slug" style={{ maxWidth: 420 }}>{f.description}</div>
                  )}
                </td>
                <td className="v-slug">{f.file_areas?.name}</td>
                <td>
                  <input data-bwignore defaultValue={f.version_label ?? ''}
                    style={{ ...sel, width: 90 }} placeholder="—"
                    onBlur={(e) => e.target.value !== (f.version_label ?? '')
                      && act(() => saveFile(f.id, 'version_label', e.target.value || null))} />
                </td>
                <td className="v-slug">{when(f.created_at)}</td>
                <td style={{ textAlign: 'right' }}>
                  <button className="link-btn" disabled={pending}
                    onClick={() => {
                      if (!window.confirm(`Remove ${f.name}?`)) return;
                      act(async () => { const r = await removeFile(f.id); router.refresh(); return r; });
                    }}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
