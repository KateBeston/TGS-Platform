'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import {
  matchFilesToDocuments, uploadMatchedFile, type FileMatch,
} from '@/app/actions/legal';
import { ACCEPT_LEGAL, detectFormat, humanSize } from '@/lib/fileTypes';
import { useSaveState } from './SaveState';

type Doc = { id: number; name: string; category: string | null };
type Outcome = 'pending' | 'done' | 'skipped' | 'failed';

const FILE_KINDS = ['Published PDF', 'Signed copy', 'Draft',
  'Solicitor advice', 'Certificate', 'Reference'];

const sel: React.CSSProperties = {
  background: 'var(--warm-white)', border: '1px solid var(--border-input)',
  padding: '6px 8px', fontSize: 12.5, width: '100%',
};

const CONFIDENCE = {
  Exact:    { label: 'Exact',    style: { borderColor: 'var(--ok)', color: 'var(--ok)' } },
  Strong:   { label: 'Strong',   style: { borderColor: 'var(--ok)', color: 'var(--ok)' } },
  Possible: { label: 'Check',    style: { borderColor: 'var(--warn)', color: 'var(--warn)' } },
  None:     { label: 'No match', style: { borderColor: 'var(--bad)', color: 'var(--bad)' } },
} as const;

/* ═══════════════════════════════════════════════════════════════════════
   BATCH LEGAL UPLOAD

   Filenames are matched to documents and shown before anything is
   attached. Nothing uploads on the strength of a guess — a misfiled legal
   document is worse than an unfiled one, because it looks filed.

   Each file uploads separately so one failure does not lose the rest, and
   re-running is safe: a file already attached under the same name is
   skipped rather than duplicated.
   ═══════════════════════════════════════════════════════════════════════ */

export default function BatchLegalUpload({ documents }: { documents: Doc[] }) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [files, setFiles] = useState<File[]>([]);
  const [matches, setMatches] = useState<FileMatch[]>([]);
  const [assigned, setAssigned] = useState<Record<string, number | null>>({});
  const [kinds, setKinds] = useState<Record<string, string>>({});
  const [outcome, setOutcome] = useState<Record<string, Outcome>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');

  const choose = (list: FileList | null) => {
    if (!list?.length) return;
    const picked = Array.from(list);
    setFiles(picked);
    setOutcome({}); setErrors({}); setMsg('');
    start(async () => {
      const result = await matchFilesToDocuments(picked.map((f) => f.name));
      setMatches(result);
      setAssigned(Object.fromEntries(result.map((m) => [m.fileName, m.documentId])));
      setKinds(Object.fromEntries(result.map((m) => [m.fileName, 'Published PDF'])));
    });
  };

  const ready = matches.filter((m) => assigned[m.fileName] && outcome[m.fileName] !== 'done');
  const unmatched = matches.filter((m) => !assigned[m.fileName]);
  const needsCheck = matches.filter((m) =>
    m.confidence === 'Possible' && assigned[m.fileName]);

  const run = () => start(async () => {
    report('saving');
    let done = 0, failed = 0, skipped = 0;

    for (const m of ready) {
      const file = files.find((f) => f.name === m.fileName);
      const documentId = assigned[m.fileName];
      if (!file || !documentId) continue;

      const fd = new FormData();
      fd.set('legal_document_id', String(documentId));
      fd.set('file_kind', kinds[m.fileName] ?? 'Published PDF');
      fd.set('file', file);

      const res = await uploadMatchedFile(fd);
      if (res.ok) {
        const wasSkipped = !!res.message?.includes('already attached');
        setOutcome((o) => ({ ...o, [m.fileName]: wasSkipped ? 'skipped' : 'done' }));
        wasSkipped ? skipped++ : done++;
      } else {
        setOutcome((o) => ({ ...o, [m.fileName]: 'failed' }));
        setErrors((e) => ({ ...e, [m.fileName]: res.error }));
        failed++;
      }
    }

    report(failed ? 'error' : 'saved', failed ? 'Some failed' : undefined);
    setMsg([
      done ? `${done} attached` : null,
      skipped ? `${skipped} already there` : null,
      failed ? `${failed} failed` : null,
    ].filter(Boolean).join(' · ') || 'Nothing to upload.');
  });

  return (
    <>
      <div className="ph">
        <div>
          <h2>Batch upload</h2>
          <div className="ph-sub">
            {matches.length
              ? `${matches.length} file${matches.length === 1 ? '' : 's'} · ${ready.length} ready`
              : 'Match files to documents by name'}
          </div>
        </div>
        <div className="ph-act">
          <Link className="btn quiet" href="/legal">Back to Legal</Link>
        </div>
      </div>

      <div className="note">
        <strong>Nothing is attached until you confirm it.</strong> Filenames are matched to
        document names and shown below with how confident the match is — a misfiled legal document
        is worse than an unfiled one, because it looks filed.</div>

      <div className="sect">
        <h3>Choose files</h3>
        <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'center',
                      flexWrap: 'wrap' }}>
          <label className="btn" style={{ cursor: 'pointer' }}>
            {files.length ? 'Choose different files' : 'Choose files'}
            <input type="file" hidden multiple disabled={pending}
              accept={ACCEPT_LEGAL}
              onChange={(e) => choose(e.target.files)} />
          </label>
          <span className="help" style={{ margin: 0 }}>
            PDF, Word, spreadsheets, text, images and archives · up to 25 MB each · no limit on
            how many
          </span>
        </div>
        {msg && <div className="note" style={{ marginTop: 'var(--s4)', marginBottom: 0 }}>{msg}</div>}
      </div>

      {!!matches.length && (
        <>
          {(!!unmatched.length || !!needsCheck.length) && (
            <div className="note bad">
              {!!needsCheck.length && (
                <><strong>{needsCheck.length} to check.</strong> The match is plausible but another
                document was close behind. Read those rows before uploading.<br /></>
              )}
              {!!unmatched.length && (
                <><strong>{unmatched.length} unmatched.</strong> Choose a document for each, or
                leave it unassigned and it will be left out.</>
              )}
            </div>
          )}

          <div className="sect">
            <div className="ph" style={{ marginBottom: 'var(--s3)' }}>
              <div>
                <h3 style={{ borderBottom: 0, marginBottom: 0, paddingBottom: 0 }}>
                  Matches
                </h3>
                <div className="ph-sub">Change any of them before uploading</div>
              </div>
              <div className="ph-act">
                <button className="btn" disabled={pending || !ready.length} onClick={run}>
                  {pending ? 'Uploading…' : `Upload ${ready.length}`}
                </button>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>File</th><th>Match</th><th>Attach to</th>
                  <th>Kind</th><th>Result</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m) => {
                  const conf = CONFIDENCE[m.confidence];
                  const state = outcome[m.fileName];
                  const file = files.find((f) => f.name === m.fileName);
                  return (
                    <tr key={m.fileName}
                        style={{ opacity: state === 'done' || state === 'skipped' ? 0.5 : 1 }}>
                      <td>
                        <div className="v-name" style={{ fontSize: 15 }}>{m.fileName}</div>
                        {file && (
                          <div className="v-slug">
                            {detectFormat(file.name, file.type)?.label ?? 'File'}
                            {' · '}{humanSize(file.size)}
                          </div>
                        )}
                      </td>
                      <td style={{ maxWidth: 230 }}>
                        <span className="pill" style={conf.style}>{conf.label}</span>
                        <div className="v-slug" style={{ marginTop: 3 }}>{m.reason}</div>
                      </td>
                      <td style={{ minWidth: 230 }}>
                        <select value={assigned[m.fileName] ?? ''} style={sel} disabled={pending}
                          onChange={(e) => setAssigned((a) => ({
                            ...a, [m.fileName]: e.target.value ? Number(e.target.value) : null }))}>
                          <option value="">Leave out</option>
                          {documents.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ minWidth: 140 }}>
                        <select value={kinds[m.fileName] ?? 'Published PDF'} style={sel}
                          disabled={pending}
                          onChange={(e) => setKinds((k) => ({ ...k, [m.fileName]: e.target.value }))}>
                          {FILE_KINDS.map((k) => <option key={k}>{k}</option>)}
                        </select>
                      </td>
                      <td>
                        {state === 'done' && <span className="pill gold">Attached</span>}
                        {state === 'skipped' && <span className="pill empty">Already there</span>}
                        {state === 'failed' && (
                          <>
                            <span className="pill" style={{ borderColor: 'var(--bad)',
                                                            color: 'var(--bad)' }}>Failed</span>
                            <div className="v-slug" style={{ color: 'var(--bad)' }}>
                              {errors[m.fileName]}
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
