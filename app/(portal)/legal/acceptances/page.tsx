import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/* Every acceptance, ever.
 *
 * Version X, agreed by Y on Z, from that address — and whether the
 * wording is still what they agreed to. That last column should always
 * read Intact; the value is being able to say so rather than assume it.
 *
 * Editing signed wording is refused at the database, so a problem here
 * would mean something happened before that protection existed or
 * through a route that bypassed it. */

export default async function AcceptancesPage({
  searchParams,
}: { searchParams: Promise<{ document?: string; q?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();

  let query = supabase.from('acceptance_record')
    .select('*', { count: 'exact' })
    .order('accepted_at', { ascending: false }).limit(300);

  if (sp.document) query = query.eq('document_slug', sp.document);
  if (sp.q) query = query.or(
    `signatory_name.ilike.%${sp.q}%,signatory_email.ilike.%${sp.q}%`);

  const [{ data, count }, { data: problems }, { data: docs }] = await Promise.all([
    query,
    supabase.from('acceptance_problems').select('id'),
    supabase.from('legal_documents').select('slug,name')
      .eq('requires_acceptance', true).order('name'),
  ]);

  const rows = data ?? [];
  const problemCount = (problems ?? []).length;

  return (
    <div className="content">
      <div className="ph">
        <div>
          <span className="tb-crumb"><Link href="/legal">Legal</Link></span>
          <h2>Acceptances</h2>
          <div className="ph-sub">
            {(count ?? 0).toLocaleString('en-AU')} recorded
          </div>
        </div>
      </div>

      {problemCount > 0 ? (
        <div className="note warn">
          <strong>{problemCount} {problemCount === 1 ? 'record does' : 'records do'} not
          match the wording agreed to.</strong> Something was edited after somebody
          accepted it. The database now refuses that, so this predates the protection
          or came through a route that bypassed it.
        </div>
      ) : (
        <div className="note">
          <strong>Every record intact.</strong> The wording is fingerprinted at the
          moment somebody agrees, and editing signed wording is refused — so what
          they agreed to can be produced exactly, years later.
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 'var(--s5)' }}>
        <Link href="/legal/acceptances"
          className={`pill ${!sp.document ? 'gold' : ''}`}
          style={{ textDecoration: 'none' }}>All documents</Link>
        {(docs ?? []).map((d: any) => (
          <Link key={d.slug} href={`/legal/acceptances?document=${d.slug}`}
            className={`pill ${sp.document === d.slug ? 'gold' : ''}`}
            style={{ textDecoration: 'none' }}>{d.name}</Link>
        ))}
      </div>

      {!rows.length ? (
        <div className="empty-state">
          <p>
            Nothing recorded yet. Acceptances appear here the moment somebody
            signs an agreement — from a venue application, a booking, or the portal.
          </p>
        </div>
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              <th>Who</th>
              <th>Document</th>
              <th>Version</th>
              <th>When</th>
              <th>From</th>
              <th>Length</th>
              <th>Wording</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.id}>
                <td>
                  {r.signatory_name}
                  <div className="muted small">{r.signatory_email}</div>
                  {r.venue_name && (
                    <div className="muted small">{r.venue_name}</div>
                  )}
                </td>
                <td>
                  <Link href={`/legal/acceptances?document=${r.document_slug}`}>
                    {r.document}
                  </Link>
                  <div className="muted small">{r.source}</div>
                </td>
                <td>
                  {r.version}
                  {r.phase && r.phase !== 'Both' && (
                    <div className="muted small">{r.phase} period</div>
                  )}
                </td>
                <td>
                  {new Date(r.accepted_at).toLocaleDateString('en-AU',
                    { day: 'numeric', month: 'short', year: 'numeric' })}
                  <div className="muted small">
                    {new Date(r.accepted_at).toLocaleTimeString('en-AU',
                      { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </td>
                <td className="muted small">{r.ip_address ?? '—'}</td>
                <td className="muted small">
                  {r.characters_agreed_to?.toLocaleString('en-AU') ?? '—'}
                </td>
                <td className={r.integrity === 'Intact' ? 'muted small' : 'warn'}>
                  {r.integrity}
                  {r.fingerprint && (
                    <div className="muted small" style={{ fontFamily: 'monospace' }}>
                      {r.fingerprint.slice(0, 12)}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
