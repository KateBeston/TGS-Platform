'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import {
  addChangeNote, addFileByUrl, createVersion, deleteLegalFile, explainChange,
  makeCurrent, openLegalFile, saveLegalDocument, saveLegalFile, saveVersion,
  setSensitivity, uploadLegalFile,
} from '@/app/actions/legal';
import { ACCEPT_LEGAL, detectFormat, humanSize, isArchive } from '@/lib/fileTypes';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

const TYPES = ['Public', 'Venue', 'Host', 'Guest', 'Partner', 'Internal', 'Consent', 'Template'];
const CATEGORIES = ['Website', 'Booking', 'Data & privacy', 'Consent', 'Venue agreements',
  'Host agreements', 'Insurance & compliance', 'Internal policy', 'Templates'];
/** Where a document stands. The distinction that matters is between
 *  written-and-in-force and written-and-not-yet: a draft on a website is
 *  a liability, a draft in the portal is work in progress. */
const DOC_STATUS: { key: string; label: string; colour: string; note: string }[] = [
  { key: 'In draft', label: 'In draft', colour: 'var(--muted)',
    note: 'Being written. Cannot be published.' },
  { key: 'Under review', label: 'Under review', colour: 'var(--warn)',
    note: 'Written, and needs checking before it binds anybody.' },
  { key: 'With adviser', label: 'With adviser', colour: 'var(--ink-gold)',
    note: 'Out with Jeremy or Andrew.' },
  { key: 'Current', label: 'Current', colour: 'var(--ok)',
    note: 'In force.' },
  { key: 'Superseded', label: 'Superseded', colour: 'var(--muted)',
    note: 'Replaced by another document.' },
  { key: 'Retired', label: 'Retired', colour: 'var(--muted)',
    note: 'No longer used.' },
];

const FILE_KINDS = ['Published PDF', 'Signed copy', 'Draft',
  'Solicitor advice', 'Certificate', 'Reference'];

/** Who can see it. Privileged exists because solicitor advice is covered
 *  by legal professional privilege, and a signed agreement names a
 *  counterparty who did not agree to it being read by whoever has a
 *  login. */
const SENSITIVITY = [
  { key: 'Public',     label: 'Public — on the website' },
  { key: 'Internal',   label: 'Internal — any portal user' },
  { key: 'Restricted', label: 'Restricted — legal area only' },
  { key: 'Privileged', label: 'Privileged — administrators only' },
];

const sel: React.CSSProperties = {
  background: 'var(--warm-white)', border: '1px solid var(--border-input)',
  padding: '7px 9px', width: '100%', fontSize: 13,
};

export default function LegalDocumentEditor({
  doc, versions, files, acceptances, changes, access,
}: {
  doc: Row; versions: Row[]; files: Row[];
  acceptances: number; changes: Row[]; access: Row[];
}) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');
  const [openVersion, setOpenVersion] = useState<number | null>(
    versions.find((v) => v.is_current)?.id ?? versions[0]?.id ?? null);
  const [note, setNote] = useState({ summary: '', reason: '', prompted: '' });
  const [urlName, setUrlName] = useState('');
  const [urlValue, setUrlValue] = useState('');

  const act = (fn: () => Promise<any>) => start(async () => {
    report('saving');
    const res = await fn();
    setMsg(res.ok ? (res.message ?? '') : res.error);
    report(res.ok ? 'saved' : 'error', res.ok ? undefined : 'Failed');
  });

  const save = (col: string, v: unknown) => act(() => saveLegalDocument(doc.id, col, v));
  const current = versions.find((v) => v.is_current);

  return (
    <>
      <div className="ph">
        <div>
          <h2>{doc.name}</h2>
          <div className="ph-sub">
            {doc.document_type} · {doc.category ?? 'uncategorised'}
            {current && ` · in force since ${new Date(current.effective_from).toLocaleDateString('en-AU')}`}
            {acceptances > 0 && ` · ${acceptances} acceptances recorded`}
          </div>
        </div>
        <div className="ph-act">
          <select defaultValue={doc.doc_status ?? 'Current'} disabled={pending}
            style={{ ...sel, width: 'auto',
                     borderColor: DOC_STATUS.find((s) => s.key === doc.doc_status)?.colour }}
            onChange={(e) => act(() => saveLegalDocument(doc.id, 'doc_status', e.target.value))}>
            {DOC_STATUS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <select defaultValue={doc.sensitivity ?? 'Internal'} disabled={pending}
            style={{ ...sel, width: 'auto' }}
            onChange={(e) => act(() => setSensitivity(doc.id, e.target.value))}>
            {SENSITIVITY.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <Link className="btn quiet" href={`/legal/${doc.id}/print`}>
            Print &amp; export
          </Link>
          <button type="button" disabled={pending}
            className={`pill ${doc.is_published ? 'gold' : ''}`}
            style={{ cursor: 'pointer',
                     background: doc.is_published ? undefined : 'var(--warm-white)' }}
            onClick={() => save('is_published', !doc.is_published)}>
            {doc.is_published ? 'Published' : 'Draft'}
          </button>
        </div>
      </div>

      {msg && <div className="note">{msg}</div>}

      {acceptances > 0 && (
        <div className="note">
          <strong>{acceptances} people have accepted this document.</strong> Revising it creates a
          new version — the wording they agreed to keeps its text and gains an end date, so it can
          still be produced if it is ever questioned.
        </div>
      )}

      <div className="sect">
        <h3>Details</h3>
        <div className="grid">
          <F label="Name" initial={doc.name} onSave={(v) => save('name', v)} />
          <F label="Slug" initial={doc.slug} onSave={(v) => save('slug', v)}
             help={doc.is_published
               ? 'Locked while published — unpublish to change it'
               : 'Becomes the public URL. Permanent once published.'} />
          <div className="f">
            <label>Who it applies to</label>
            <select defaultValue={doc.document_type} style={sel}
              onChange={(e) => save('document_type', e.target.value)}>
              {TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="f">
            <label>Category</label>
            <select defaultValue={doc.category ?? ''} style={sel}
              onChange={(e) => save('category', e.target.value || null)}>
              <option value="">Uncategorised</option>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <F label="Jurisdiction" initial={doc.jurisdiction} onSave={(v) => save('jurisdiction', v)} />
          <D label="Review due" initial={doc.review_due} onSave={(v) => save('review_due', v)}
             help="A prompt to re-read it, not a legal deadline" />
        </div>

        <div className="grid one" style={{ marginTop: 'var(--s3)' }}>
          <F label="Summary" textarea initial={doc.summary} onSave={(v) => save('summary', v)}
             help="Internal — what this document is for and when it applies" />
          <F label="Where it is used" initial={(doc.used_on ?? []).join(', ')}
             onSave={(v) => save('used_on', v ? v.split(',').map((s) => s.trim()) : null)}
             help="Comma separated. So a change can be traced to what it affects." />
          <F label="Note" textarea initial={doc.owner_note} onSave={(v) => save('owner_note', v)}
             help="Anything to remember — questions for Jeremy, points still unresolved" />
        </div>

        <div style={{ display: 'flex', gap: 'var(--s3)', marginTop: 'var(--s4)' }}>
          <button type="button" disabled={pending}
            className={`pill ${doc.requires_acceptance ? 'gold' : ''}`}
            style={{ cursor: 'pointer',
                     background: doc.requires_acceptance ? undefined : 'var(--warm-white)' }}
            onClick={() => save('requires_acceptance', !doc.requires_acceptance)}>
            {doc.requires_acceptance ? 'Must be accepted' : 'Read only'}
          </button>
          <span className="help" style={{ alignSelf: 'center' }}>
            Acceptance records who agreed, to which version, and when
          </span>
        </div>
      </div>

      {/* ── versions ──────────────────────────────────────────── */}
      <div className="sect">
        <div className="ph" style={{ marginBottom: 'var(--s4)' }}>
          <div>
            <h3 style={{ borderBottom: 0, marginBottom: 0, paddingBottom: 0 }}>Wording</h3>
            <div className="ph-sub">
              {versions.length
                ? `${versions.length} version${versions.length === 1 ? '' : 's'}`
                : 'Not written yet'}
            </div>
          </div>
          <div className="ph-act">
            <button className="btn quiet" disabled={pending}
              onClick={() => act(() => createVersion(
                doc.id, `v${versions.length + 1}`,
                new Date().toISOString().slice(0, 10)))}>
              New version
            </button>
          </div>
        </div>

        {!versions.length && (
          <div className="note" style={{ marginBottom: 0 }}>
            No wording yet. Create a version, then paste or write the text — it is edited here
            rather than in the website, so a change does not need a deploy.
          </div>
        )}

        {versions.map((v) => {
          const isOpen = openVersion === v.id;
          return (
            <div className="row-card" key={v.id} style={{ marginBottom: 'var(--s3)',
              borderLeft: v.is_current ? '3px solid var(--gold)' : undefined }}>
              <header>
                <div>
                  <div className="rt" style={{ fontSize: 18 }}>
                    {v.version_label ?? 'Untitled version'}
                    {v.is_current && <span className="pill gold" style={{ marginLeft: 8 }}>
                      In force</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-quiet)' }}>
                    {v.effective_from
                      ? `From ${new Date(v.effective_from).toLocaleDateString('en-AU')}` : 'No start date'}
                    {v.effective_to && ` to ${new Date(v.effective_to).toLocaleDateString('en-AU')}`}
                    {v.body && ` · ${String(v.body).length.toLocaleString('en-AU')} characters`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'center' }}>
                  {!v.is_current && (
                    <button className="link-btn" disabled={pending}
                      onClick={() => act(() => makeCurrent(v.id, doc.id))}>
                      Put in force
                    </button>
                  )}
                  <button className="link-btn"
                    onClick={() => setOpenVersion(isOpen ? null : v.id)}>
                    {isOpen ? 'Close' : 'Edit'}
                  </button>
                </div>
              </header>

              {isOpen && (
                <>
                  <div className="grid">
                    <F label="Label" initial={v.version_label}
                       onSave={(x) => act(() => saveVersion(v.id, doc.id, 'version_label', x))} />
                    <D label="Effective from" initial={v.effective_from}
                       onSave={(x) => act(() => saveVersion(v.id, doc.id, 'effective_from', x))} />
                    <F label="Approved by" initial={v.approved_by}
                       onSave={(x) => act(() => saveVersion(v.id, doc.id, 'approved_by', x))} />
                    <F label="What changed" initial={v.change_summary}
                       onSave={(x) => act(() => saveVersion(v.id, doc.id, 'change_summary', x))} />
                  </div>
                  <div className="grid one" style={{ marginTop: 'var(--s3)' }}>
                    <div className="f">
                      <label>Text</label>
                      <textarea data-bwignore defaultValue={v.body ?? ''}
                        style={{ minHeight: 340, fontFamily: 'var(--sans)', lineHeight: 1.6 }}
                        onBlur={(e) => e.target.value !== (v.body ?? '') &&
                          act(() => saveVersion(v.id, doc.id, 'body', e.target.value || null))} />
                      <span className="help">
                        Markdown or plain text. Saved when you click away.
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* ── the platform site ─────────────────────────────────── */}
      <div className="sect">
        <h3>On the website</h3>
        <div className="note">
          <strong>The wording lives here, not in the site.</strong> The platform reads this
          document over an API, so revising a policy is an edit on this page rather than a
          redeploy — which is the whole reason legal text is not held in Sanity or in markup.</div>

        <table>
          <tbody>
            <tr>
              <td style={{ width: 150, color: 'var(--ink-quiet)' }}>Public address</td>
              <td className="v-slug">theglobalsanctum.com/legal/{doc.slug}</td>
            </tr>
            <tr>
              <td style={{ color: 'var(--ink-quiet)' }}>The site reads</td>
              <td className="v-slug">/api/legal/{doc.slug}</td>
            </tr>
            <tr>
              <td style={{ color: 'var(--ink-quiet)' }}>Formats</td>
              <td className="v-slug">
                <a href={`/api/legal/${doc.slug}`} target="_blank" rel="noopener">JSON</a>
                {' · '}
                <a href={`/api/legal/${doc.slug}?format=html`} target="_blank" rel="noopener">HTML</a>
                {' · '}
                <a href={`/api/legal/${doc.slug}?format=md`} target="_blank" rel="noopener">Markdown</a>
                {' · '}
                <a href={`/api/legal/${doc.slug}?format=txt`} target="_blank" rel="noopener">Plain text</a>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="grid" style={{ marginTop: 'var(--s4)' }}>
          <F label="Meta title" initial={doc.meta_title}
             onSave={(v) => save('meta_title', v)}
             help="For the public page. Leave blank to use the document name." />
          <F label="Meta description" initial={doc.meta_description}
             onSave={(v) => save('meta_description', v)} />
        </div>
      </div>

      {/* ── access log ────────────────────────────────────────── */}
      {!!access.length && (
        <div className="sect">
          <h3>Who has opened these files</h3>
          <div className="ph-sub" style={{ marginBottom: 'var(--s3)' }}>
            Recorded automatically, and cannot be edited or deleted
          </div>
          <table>
            <thead><tr><th>When</th><th>File</th><th>Who</th><th>How</th></tr></thead>
            <tbody>
              {access.map((a: Row) => (
                <tr key={a.id}>
                  <td className="v-slug" style={{ whiteSpace: 'nowrap' }}>
                    {new Date(a.accessed_at).toLocaleString('en-AU',
                      { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                  </td>
                  <td className="v-slug">{a.file_name}</td>
                  <td>{a.accessed_by}</td>
                  <td><span className="pill empty">{a.access_type}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── what is wrong with it ─────────────────────────────── */}
      {doc.needs_attention && (
        <div className={`note ${/ABN/i.test(doc.needs_attention) ? 'bad' : ''}`}>
          <strong>Needs a look:</strong> {doc.needs_attention}
        </div>
      )}

      {/* ── history ───────────────────────────────────────────── */}
      <div className="sect">
        <div className="ph" style={{ marginBottom: 'var(--s4)' }}>
          <div>
            <h3 style={{ borderBottom: 0, marginBottom: 0, paddingBottom: 0 }}>History</h3>
            <div className="ph-sub">
              {changes.length ? `${changes.length} recorded` : 'Nothing recorded yet'}
              {changes.filter((c: Row) =>
                ['Wording','Put in force','Published'].includes(c.change_type) && !c.reason).length > 0 &&
                ` · ${changes.filter((c: Row) =>
                  ['Wording','Put in force','Published'].includes(c.change_type) && !c.reason).length} with no reason`}
            </div>
          </div>
          <div className="ph-act">
            <Link className="btn quiet" href="/legal/changes">All documents</Link>
          </div>
        </div>

        <div className="note">
          <strong>What changed is recorded automatically; why it changed is not.</strong> Nothing
          can infer a reason, and it is the part an audit asks about. Record one against any change
          that alters what a person agreed to.
        </div>

        <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'flex-end',
                      flexWrap: 'wrap', marginBottom: 'var(--s5)' }}>
          <div className="f" style={{ minWidth: 220, flex: 1 }}>
            <label>Record a note</label>
            <input data-bwignore style={sel} value={note.summary}
              placeholder="Advice received, a question raised, a decision not to change"
              onChange={(e) => setNote({ ...note, summary: e.target.value })} />
          </div>
          <div className="f" style={{ minWidth: 200, flex: 1 }}>
            <label>Reason for the change</label>
            <input data-bwignore style={sel} value={note.reason}
              onChange={(e) => setNote({ ...note, reason: e.target.value })} />
          </div>
          <div className="f" style={{ minWidth: 160 }}>
            <label>Prompted by</label>
            <input data-bwignore style={sel} value={note.prompted}
              onChange={(e) => setNote({ ...note, prompted: e.target.value })} />
          </div>
          <button className="btn quiet" disabled={pending || !note.summary.trim()}
            onClick={() => act(async () => {
              const res = await addChangeNote(doc.id, note.summary, note.reason, note.prompted);
              if (res.ok) setNote({ summary: '', reason: '', prompted: '' });
              return res;
            })}>Record</button>
        </div>

        {!changes.length && (
          <div className="note" style={{ marginBottom: 0 }}>
            Nothing yet. Every edit from here is logged.
          </div>
        )}

        {!!changes.length && (
          <table>
            <thead><tr><th>When</th><th>What</th><th>Why</th><th></th></tr></thead>
            <tbody>
              {changes.map((c: Row) => {
                const needs = ['Wording','Put in force','Published','Unpublished']
                  .includes(c.change_type) && !c.reason;
                return (
                  <tr key={c.id}>
                    <td className="v-slug" style={{ whiteSpace: 'nowrap' }}>
                      {new Date(c.changed_at).toLocaleDateString('en-AU',
                        { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td>
                      <span className={c.change_type === 'Wording' ||
                                       c.change_type === 'Put in force'
                        ? 'pill gold' : 'pill empty'}>{c.change_type}</span>
                      <div className="v-slug" style={{ marginTop: 3, maxWidth: 340 }}>
                        {c.summary}
                      </div>
                    </td>
                    <td style={{ maxWidth: 300 }}>
                      {c.reason
                        ? <div style={{ fontSize: 12.5 }}>
                            {c.reason}
                            {c.prompted_by && (
                              <div className="v-slug">Prompted by {c.prompted_by}</div>
                            )}
                          </div>
                        : needs
                          ? <input data-bwignore style={{ ...sel, borderColor: 'var(--warn)' }}
                              placeholder="Why did this change?"
                              onBlur={(e) => e.target.value &&
                                act(() => explainChange(c.id, doc.id, 'reason', e.target.value))} />
                          : <span className="v-slug">—</span>}
                    </td>
                    <td></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── files ─────────────────────────────────────────────── */}
      <div className="sect">
        <h3>Files</h3>
        <div className="ph-sub" style={{ marginBottom: 'var(--s4)' }}>
          The artefact rather than the text — a signed copy, a counter-signed agreement, advice
        </div>

        <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'flex-end',
                      flexWrap: 'wrap', marginBottom: 'var(--s4)' }}>
          <label className="btn quiet" style={{ cursor: 'pointer' }}>
            Upload a file
            <input type="file" hidden disabled={pending}
              accept={ACCEPT_LEGAL}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const fd = new FormData();
                fd.set('legal_document_id', String(doc.id));
                fd.set('file_kind', 'Reference');
                fd.set('file', file);
                e.target.value = '';
                act(() => uploadLegalFile(fd));
              }} />
          </label>
          <div className="f" style={{ minWidth: 160 }}>
            <label>Or paste a link to it</label>
            <input data-bwignore value={urlName} placeholder="Name" style={sel}
                   onChange={(e) => setUrlName(e.target.value)} />
          </div>
          <div className="f" style={{ minWidth: 230, flex: 1 }}>
            <label>&nbsp;</label>
            <input data-bwignore value={urlValue} placeholder="https://…" style={sel}
                   onChange={(e) => setUrlValue(e.target.value)} />
          </div>
          <button className="btn quiet" disabled={pending || !urlValue.trim()}
            onClick={() => act(async () => {
              const res = await addFileByUrl(doc.id, urlValue, urlName, 'Reference');
              if (res.ok) { setUrlValue(''); setUrlName(''); }
              return res;
            })}>Add link</button>
        </div>

        <div className="note">
          <strong>Opening a file is recorded.</strong> Who opened it, when, and which file — kept
          permanently and not editable. For legal documents that is usually the question worth
          being able to answer.</div>

        {!files.length && (
          <div className="note" style={{ marginBottom: 0 }}>
            No files. PDF, Word, spreadsheets, text, images, archives and signature files are all
            accepted, up to 25 MB each.
          </div>
        )}

        {!!files.length && (
          <table>
            <thead>
              <tr><th>File</th><th>Kind</th><th>Signed by</th>
                  <th>Signed</th><th>Expires</th><th></th></tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.id}>
                  <td>
                    <button type="button" className="link-btn" disabled={pending}
                      style={{ padding: 0, textAlign: 'left' }}
                      onClick={() => start(async () => {
                        const res = await openLegalFile(f.id);
                        if (res.ok) window.open(res.url, '_blank', 'noopener');
                        else setMsg(res.error);
                      })}>
                      <span className="v-name" style={{ fontSize: 16 }}>{f.file_name}</span>
                    </button>
                    <div className="v-slug">
                      {detectFormat(f.file_name, f.mime_type)?.label ?? 'File'}
                      {f.file_size_bytes && ` · ${humanSize(f.file_size_bytes)}`}
                    </div>
                    {isArchive(f.file_name, f.mime_type) && (
                      <div style={{ marginTop: 5 }}>
                        <input data-bwignore
                          defaultValue={
                            /^Not described/.test(f.archive_contents ?? '')
                              ? '' : (f.archive_contents ?? '')}
                          placeholder="What is inside this archive?"
                          style={{ ...sel, fontSize: 12,
                                   borderColor: /^Not described/.test(f.archive_contents ?? '')
                                     ? 'var(--warn)' : undefined }}
                          onBlur={(e) => act(() =>
                            saveLegalFile(f.id, doc.id, 'archive_contents',
                                          e.target.value || null))} />
                        <span className="help" style={{ fontSize: 10.5 }}>
                          An archive cannot be previewed or searched — without this, nobody can
                          tell what it holds without downloading it
                        </span>
                      </div>
                    )}
                  </td>
                  <td>
                    <select defaultValue={f.file_kind} style={{ ...sel, width: 'auto' }}
                      onChange={(e) => act(() =>
                        saveLegalFile(f.id, doc.id, 'file_kind', e.target.value))}>
                      {FILE_KINDS.map((k) => <option key={k}>{k}</option>)}
                    </select>
                  </td>
                  <td>
                    <input data-bwignore defaultValue={f.signed_by ?? ''} style={sel}
                      onBlur={(e) => e.target.value !== (f.signed_by ?? '') &&
                        act(() => saveLegalFile(f.id, doc.id, 'signed_by', e.target.value || null))} />
                  </td>
                  <td>
                    <input type="date" data-bwignore defaultValue={f.signed_at ?? ''} style={sel}
                      onBlur={(e) => act(() =>
                        saveLegalFile(f.id, doc.id, 'signed_at', e.target.value || null))} />
                  </td>
                  <td>
                    <input type="date" data-bwignore defaultValue={f.expires_at ?? ''} style={sel}
                      onBlur={(e) => act(() =>
                        saveLegalFile(f.id, doc.id, 'expires_at', e.target.value || null))} />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="link-btn" disabled={pending}
                      onClick={() => {
                        if (!window.confirm(`Delete ${f.file_name}?`)) return;
                        act(() => deleteLegalFile(f.id, doc.id));
                      }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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

function D({
  label, initial, onSave, help,
}: { label: string; initial: any; onSave: (v: string | null) => void; help?: string }) {
  const asDate = initial ? String(initial).slice(0, 10) : '';
  const [v, setV] = useState(asDate);
  return (
    <div className="f">
      <label>{label}</label>
      <input type="date" data-bwignore value={v} onChange={(e) => setV(e.target.value)}
             onBlur={() => v !== asDate && onSave(v || null)} />
      {help && <span className="help">{help}</span>}
    </div>
  );
}
