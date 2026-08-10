import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/* Venue applications.
 *
 * They arrive from the site and sit here until somebody reads them. An
 * application is not a venue — it is somebody's unverified account of
 * their own property, and it becomes a venue only when accepted.
 *
 * Ordered oldest first deliberately. A queue read newest first leaves
 * the oldest application waiting longest, which is the opposite of what
 * anybody wants from a queue. */

const STATUSES = ['Submitted', 'Reading it', 'Asked them something',
                  'Accepted', 'Declined', 'Withdrawn', 'Lapsed'];

const WAITING = ['Submitted', 'Reading it', 'Asked them something'];

function daysSince(iso: string | null) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export default async function ApplicationsPage({
  searchParams,
}: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();

  let query = supabase.from('venue_applications')
    .select('*, countries(name)', { count: 'exact' })
    .order('submitted_at', { ascending: true }).limit(200);

  if (sp.status) query = query.eq('status', sp.status);

  const { data, count } = await query;
  const rows = data ?? [];

  const { data: all } = await supabase.from('venue_applications')
    .select('status, submitted_at');
  const everything = all ?? [];

  const byStatus = STATUSES.map((s) => ({
    status: s, count: everything.filter((r: any) => r.status === s).length,
  }));

  const waiting = everything.filter((r: any) => WAITING.includes(r.status));
  const oldest = waiting.length
    ? Math.max(...waiting.map((r: any) => daysSince(r.submitted_at) ?? 0))
    : null;

  return (
    <div className="content">
      <div className="ph">
        <div>
          <h2>Applications</h2>
          <div className="ph-sub">
            {(count ?? 0).toLocaleString('en-AU')} received
            {sp.status && ` · ${sp.status}`}
          </div>
        </div>
      </div>

      <div className="note">
        <strong>An application is not a venue.</strong> It is somebody&rsquo;s account of
        their own property, unverified, and it becomes a venue only when accepted.
        Nothing here appears on the site.
      </div>

      {oldest !== null && oldest > 3 && (
        <div className="note warn">
          The oldest unanswered application has been waiting {oldest} days. We tell
          people we read every one properly, which is worth being true.
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 'var(--s5)' }}>
        <Link href="/applications" className={`pill ${!sp.status ? 'gold' : ''}`}
              style={{ textDecoration: 'none' }}>All</Link>
        {byStatus.map((s) => (
          <Link key={s.status} href={`/applications?status=${encodeURIComponent(s.status)}`}
                className={`pill ${sp.status === s.status ? 'gold' : ''}`}
                style={{ textDecoration: 'none' }}>
            {s.status} {s.count > 0 && `· ${s.count}`}
          </Link>
        ))}
      </div>

      {!rows.length ? (
        <div className="empty-state">
          <p>Nothing here{sp.status ? ` under ${sp.status}` : ' yet'}.</p>
        </div>
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Venue</th>
              <th>Who</th>
              <th>Where</th>
              <th>For</th>
              <th>Waiting</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => {
              const d = daysSince(r.submitted_at);
              return (
                <tr key={r.id}>
                  <td><Link href={`/applications/${r.id}`}>{r.reference}</Link></td>
                  <td>
                    <Link href={`/applications/${r.id}`}>{r.venue_name}</Link>
                    {r.venue_id && <span className="pill" style={{ marginLeft: 8 }}>Venue made</span>}
                  </td>
                  <td>
                    {[r.first_name, r.surname].filter(Boolean).join(' ')}
                    <div className="muted small">{r.email}</div>
                  </td>
                  <td>{r.location_text ?? r.countries?.name ?? '—'}</td>
                  <td>{r.marketplace ?? '—'}</td>
                  <td className={WAITING.includes(r.status) && (d ?? 0) > 3 ? 'warn' : ''}>
                    {d === null ? '—' : d === 0 ? 'Today' : `${d}d`}
                  </td>
                  <td>{r.status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
