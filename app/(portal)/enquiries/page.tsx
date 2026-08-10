import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import NewEnquiry from '@/components/NewEnquiry';

export const dynamic = 'force-dynamic';

const STATUSES = ['New', 'In Progress', 'Presented', 'Won', 'Lost', 'No Response', 'Spam'];

export default async function EnquiriesPage({
  searchParams,
}: { searchParams: Promise<{ status?: string; type?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from('enquiries')
    .select('*, countries(name), venues(venue_name)', { count: 'exact' })
    .order('created_at', { ascending: false }).limit(100);

  if (sp.status) query = query.eq('status', sp.status);
  if (sp.type) query = query.eq('enquiry_type', sp.type);

  const { data, count } = await query;
  const rows = data ?? [];

  const byStatus = STATUSES.map((s) => ({
    status: s,
    count: rows.filter((r: any) => r.status === s).length,
  }));

  return (
    <div className="content">
      <div className="ph">
        <div>
          <h2>Enquiries</h2>
          <div className="ph-sub">
            {(count ?? 0).toLocaleString('en-AU')} recorded
            {sp.status && ` · ${sp.status}`}
          </div>
        </div>
      </div>

      <div className="note">
        <strong>The most valuable object in the database.</strong></div>

      <div style={{ marginBottom: 'var(--s6)', paddingBottom: 'var(--s5)',
                    borderBottom: '1px solid var(--border)' }}>
        <NewEnquiry />
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 'var(--s5)' }}>
        <Link href="/enquiries" className={`pill ${!sp.status ? 'gold' : ''}`}
              style={{ textDecoration: 'none' }}>All</Link>
        {byStatus.map((s) => (
          <Link key={s.status} href={`/enquiries?status=${encodeURIComponent(s.status)}`}
                className={`pill ${sp.status === s.status ? 'gold' : ''}`}
                style={{ textDecoration: 'none' }}>
            {s.status} {s.count > 0 && `· ${s.count}`}
          </Link>
        ))}
      </div>

      {!rows.length && (
        <div className="note">
          {sp.status ? 'None with that status.' : 'No enquiries yet. Add one above, or wait for the platform form to post here.'}
        </div>
      )}

      {!!rows.length && (
        <table>
          <thead>
            <tr>
              <th>Enquiry</th><th>Type</th><th>Where</th><th>When</th>
              <th>Guests</th><th>Status</th><th>Received</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/enquiries/${r.id}`} style={{ textDecoration: 'none' }}>
                    <div className="v-name">
                      {[r.first_name, r.surname].filter(Boolean).join(' ') || r.email || 'Unnamed'}
                    </div>
                    <div className="v-slug">{r.enquiry_reference ?? r.enquiry_code ?? `#${r.id}`}</div>
                  </Link>
                </td>
                <td><span className="pill">{r.enquiry_type}</span></td>
                <td>{r.countries?.name ?? <span className="pill empty">Any</span>}</td>
                <td className="v-slug">
                  {r.date_from
                    ? new Date(r.date_from).toLocaleDateString('en-AU')
                    : r.dates_flexible ? 'Flexible' : '—'}
                </td>
                <td>{r.guest_count ?? '—'}</td>
                <td>
                  <span className={`pill ${r.status === 'Won' ? 'gold' : ''}`}
                        style={r.status === 'Lost' ? { borderStyle: 'dashed' } : undefined}>
                    {r.status}
                  </span>
                </td>
                <td className="v-slug">
                  {new Date(r.created_at).toLocaleDateString('en-AU')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
