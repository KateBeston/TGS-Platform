import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import NewLegalDocument from '@/components/NewLegalDocument';

export const dynamic = 'force-dynamic';

const ORDER = ['Website', 'Booking', 'Data & privacy', 'Consent',
  'Venue agreements', 'Host agreements', 'Insurance & compliance',
  'Internal policy', 'Templates'];

export default async function LegalPage() {
  const supabase = await createClient();

  const [{ data: docs }, { data: versions }, { data: files },
         { count: acceptances }, { data: exports }] = await Promise.all([
    supabase.from('legal_documents').select('*').order('display_order').order('id'),
    supabase.from('legal_document_versions')
      .select('legal_document_id,is_current,effective_from,version_label'),
    supabase.from('legal_files').select('legal_document_id'),
    supabase.from('legal_acceptances').select('*', { count: 'exact', head: true }),
    supabase.from('compliance_exports').select('*')
      .eq('export_kind', 'Legal').order('exported_at', { ascending: false }).limit(6),
  ]);

  const currentFor = new Map<number, any>();
  const versionCount = new Map<number, number>();
  (versions ?? []).forEach((v: any) => {
    versionCount.set(v.legal_document_id, (versionCount.get(v.legal_document_id) ?? 0) + 1);
    if (v.is_current) currentFor.set(v.legal_document_id, v);
  });

  const fileCount = new Map<number, number>();
  (files ?? []).forEach((f: any) =>
    fileCount.set(f.legal_document_id, (fileCount.get(f.legal_document_id) ?? 0) + 1));

  const all = docs ?? [];
  const grouped = ORDER
    .map((cat) => ({ cat, items: all.filter((d: any) => d.category === cat) }))
    .filter((g) => g.items.length);
  const uncategorised = all.filter((d: any) => !d.category);

  const drafted = all.filter((d: any) => currentFor.has(d.id)).length;
  const published = all.filter((d: any) => d.is_published).length;

  return (
    <div className="content"><div className="wrap">
      <NeedsAttention />
      <DocumentStates />

      <div className="ph">
        <div>
          <h2>Legal</h2>
          <div className="ph-sub">
            {all.length} documents · {drafted} with wording · {published} published
          </div>
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="v">{all.length}</div><div className="l">Documents</div>
        </div>
        <div className="stat">
          <div className={`v ${!drafted ? 'zero' : ''}`}>{drafted}</div>
          <div className="l">Have wording</div>
        </div>
        <div className="stat">
          <div className={`v ${!published ? 'zero' : ''}`}>{published}</div>
          <div className="l">Published</div>
        </div>
        <div className="stat">
          <div className={`v ${!acceptances ? 'zero' : ''}`}>{acceptances ?? 0}</div>
          <div className="l">Acceptances recorded</div>
        </div>
      </div>

      <div className="note">
        <strong>Wording is edited here, not in the website.</strong></div>

      <div style={{ marginBottom: 'var(--s6)', paddingBottom: 'var(--s5)',
                    borderBottom: '1px solid var(--border)' }}>
        <NewLegalDocument />
        <div style={{ marginTop: 'var(--s4)' }}>
          <Link className="btn quiet" href="/legal/upload">Batch upload files</Link>
          <Link className="btn quiet" href="/legal/changes"
                style={{ marginLeft: 'var(--s2)' }}>Change history</Link>
          <span className="help" style={{ marginLeft: 'var(--s3)' }}>
            Drop in a folder of PDFs and they are matched to documents by name
          </span>
        </div>
      </div>

      <div className="sect">
        <div className="ph" style={{ marginBottom: 'var(--s3)' }}>
          <div>
            <h3 style={{ borderBottom: 0, marginBottom: 0, paddingBottom: 0 }}>
              Compliance archive
            </h3>
            <div className="ph-sub">
              {exports?.length
                ? `Last taken ${new Date(exports[0].exported_at).toLocaleDateString('en-AU')}`
                : 'Never taken'}
            </div>
          </div>
          <div className="ph-act">
            <a className="btn" href="/api/compliance/legal">Download everything</a>
            <a className="btn quiet" href="/api/compliance/legal?files=no">Wording only</a>
          </div>
        </div>

        <div className="note">
          <strong>One file holding everything</strong> — the wording of every version, the PDFs
          uploaded against each document, the acceptance records, and a manifest.</div>

        {!!exports?.length && (
          <table>
            <thead>
              <tr><th>Taken</th><th>Documents</th><th>Versions</th>
                  <th>Files</th><th>Acceptances</th><th>Size</th></tr>
            </thead>
            <tbody>
              {exports.map((e: any) => (
                <tr key={e.id}>
                  <td className="v-slug">
                    {new Date(e.exported_at).toLocaleString('en-AU',
                      { day: 'numeric', month: 'short', year: 'numeric' })}
                    {e.notes && <div style={{ color: 'var(--warn)' }}>{e.notes}</div>}
                  </td>
                  <td>{e.documents_count}</td>
                  <td>{e.versions_count}</td>
                  <td>{e.files_count}</td>
                  <td>{e.acceptances_count}</td>
                  <td className="v-slug">
                    {e.size_bytes ? `${Math.round(e.size_bytes / 1024)} KB` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {grouped.map((g) => (
        <div className="sect" key={g.cat}>
          <h3>{g.cat}</h3>
          <table>
            <thead>
              <tr><th>Document</th><th>For</th><th>Wording</th>
                  <th>Files</th><th>Status</th></tr>
            </thead>
            <tbody>
              {g.items.map((d: any) => {
                const cur = currentFor.get(d.id);
                return (
                  <tr key={d.id}>
                    <td>
                      <Link href={`/legal/${d.id}`} style={{ textDecoration: 'none' }}>
                        <div className="v-name">{d.name}</div>
                        {d.summary && (
                          <div className="v-slug" style={{ maxWidth: 460 }}>{d.summary}</div>
                        )}
                      </Link>
                    </td>
                    <td><span className="pill">{d.document_type}</span></td>
                    <td className="v-slug">
                      {cur
                        ? <>{cur.version_label ?? 'Current'}
                            <div>from {new Date(cur.effective_from).toLocaleDateString('en-AU')}</div></>
                        : <span className="pill empty">Not written</span>}
                      {(versionCount.get(d.id) ?? 0) > 1 && (
                        <div>{versionCount.get(d.id)} versions</div>
                      )}
                    </td>
                    <td>{fileCount.get(d.id) ?? <span className="pill empty">0</span>}</td>
                    <td>
                      {d.is_published
                        ? <span className="pill gold">Published</span>
                        : <span className="pill empty">Draft</span>}
                      {d.requires_acceptance && (
                        <div className="v-slug" style={{ marginTop: 3 }}>Needs acceptance</div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      {!!uncategorised.length && (
        <div className="sect">
          <h3>Uncategorised</h3>
          <table>
            <tbody>
              {uncategorised.map((d: any) => (
                <tr key={d.id}>
                  <td>
                    <Link href={`/legal/${d.id}`} style={{ textDecoration: 'none' }}>
                      <span className="v-name">{d.name}</span>
                    </Link>
                  </td>
                  <td><span className="pill">{d.document_type}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div></div>
  );
}


/** What is wrong with the documents as they stand.
 *
 *  Shown at the top rather than as a column somewhere, because a flag on
 *  a record nobody opens is a flag nobody sees. Three carry the wrong
 *  ABN, which is the one that matters — a document naming the wrong
 *  entity may not bind anybody. */
async function NeedsAttention() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('legal_documents')
    .select('id,name,needs_attention')
    .not('needs_attention', 'is', null)
    .order('name');

  if (!data?.length) return null;

  const abn = data.filter((d: any) => /ABN/i.test(d.needs_attention));
  const rest = data.filter((d: any) => !/ABN/i.test(d.needs_attention));

  return (
    <>
      {!!abn.length && (
        <div className="note bad">
          <strong>{abn.length} document{abn.length === 1 ? '' : 's'} name the wrong
          entity.</strong> They carry ABN 22 577 793 174; the correct one is Aurella Group Pty Ltd,
          ABN 70 649 742 423. This is the flag that matters most — a document naming the wrong
          entity may not bind anybody.
          <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            {abn.map((d: any) => (
              <li key={d.id} style={{ marginBottom: 3 }}>
                <Link href={`/legal/${d.id}`} style={{ color: 'var(--ink-gold)' }}>
                  {d.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!!rest.length && (
        <div className="note">
          <strong>{rest.length} document{rest.length === 1 ? '' : 's'} need a look.</strong>{' '}
          Mostly language — &ldquo;facilitator&rdquo; and &ldquo;traveller&rdquo; where TGS says
          &ldquo;retreat host&rdquo; and &ldquo;guest&rdquo; — and four with no source document at
          all.
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
            {rest.map((d: any) => (
              <Link key={d.id} className="pill" href={`/legal/${d.id}`}
                    style={{ textDecoration: 'none' }}>{d.name}</Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}


/** Where the documents stand, at a glance.
 *
 *  Drafts named rather than counted — a count says four are missing, the
 *  names say which four and therefore what to do next. */
async function DocumentStates() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('legal_documents')
    .select('id,name,doc_status,needs_attention')
    .neq('doc_status', 'Current')
    .order('doc_status').order('name');

  const { count: current } = await supabase
    .from('legal_documents').select('*', { count: 'exact', head: true })
    .eq('doc_status', 'Current');

  if (!data?.length) return null;

  const drafts = data.filter((d: any) => d.doc_status === 'In draft');
  const others = data.filter((d: any) => d.doc_status !== 'In draft');

  return (
    <div className="stats" style={{ marginBottom: 'var(--s5)' }}>
      <div className="stat">
        <div className="v">{current ?? 0}</div>
        <div className="l">In force</div>
      </div>
      {!!drafts.length && (
        <div className="stat" style={{ minWidth: 280 }}>
          <div className="v" style={{ color: 'var(--muted)' }}>{drafts.length}</div>
          <div className="l">Still to write</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
            {drafts.map((d: any) => (
              <Link key={d.id} className="pill" href={`/legal/${d.id}`}
                    style={{ textDecoration: 'none', fontSize: 9,
                             borderStyle: 'dashed' }}>{d.name}</Link>
            ))}
          </div>
        </div>
      )}
      {!!others.length && (
        <div className="stat" style={{ minWidth: 220 }}>
          <div className="v" style={{ color: 'var(--warn)' }}>{others.length}</div>
          <div className="l">Needs checking</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
            {others.map((d: any) => (
              <Link key={d.id} className="pill" href={`/legal/${d.id}`}
                    style={{ textDecoration: 'none', fontSize: 9,
                             borderColor: 'var(--warn)' }}>{d.name}</Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
