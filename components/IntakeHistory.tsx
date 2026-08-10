'use client';

import Link from 'next/link';

type Row = Record<string, any>;

/* ═══════════════════════════════════════════════════════════════════════
   READ FROM A WEBSITE — the record

   Every venue that has been through the URL process, whatever became of
   it. Waiting, accepted, failed and discarded, because a failure is as
   worth keeping as a success: it says a site could not be read, and
   trying the same one again next month is wasted money.
   ═══════════════════════════════════════════════════════════════════════ */

const TABS: { key: string; label: string; blurb: string }[] = [
  { key: 'all', label: 'Everything', blurb: 'Every read, whatever became of it' },
  { key: 'Ready', label: 'Waiting', blurb: 'Read and not yet checked' },
  { key: 'Accepted', label: 'Completed', blurb: 'Checked and applied to a venue' },
  { key: 'Failed', label: 'Failed', blurb: 'Could not be read, and why' },
  { key: 'Discarded', label: 'Discarded', blurb: 'Read and not used' },
];

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  Ready:     { borderColor: 'var(--gold)', color: 'var(--ink)' },
  Accepted:  { borderColor: 'var(--ok)', color: 'var(--ok)' },
  Failed:    { borderColor: 'var(--bad)', color: 'var(--bad)' },
  Discarded: { color: 'var(--muted)' },
  Reading:   { borderColor: 'var(--warn)', color: 'var(--warn)' },
};

export default function IntakeHistory({
  rows, counts, spent, status,
}: { rows: Row[]; counts: Record<string, number>; spent: number; status: string }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <>
      <div className="ph">
        <div>
          <h2>Read from a website</h2>
          <div className="ph-sub">
            {total} read{total === 1 ? '' : 's'} · ${spent.toFixed(3)} spent in total
          </div>
        </div>
        <div className="ph-act">
          <Link className="btn" href="/venues/new">Read a new site</Link>
        </div>
      </div>

      <div className="note">
        <strong>This is the record, not the workspace.</strong> A venue read from a website is
        created in the venues list with everything filled in, and that is where you edit it — the
        tabs there hold the whole record.</div>

      <div style={{ display: 'flex', gap: 'var(--s3)', flexWrap: 'wrap',
                    marginBottom: 'var(--s3)' }}>
        {TABS.map((t) => (
          <Link key={t.key}
                className={`btn ${status === t.key ? '' : 'quiet'}`}
                href={t.key === 'all' ? '/venues/intake' : `/venues/intake?status=${t.key}`}>
            {t.label}
            {t.key !== 'all' && counts[t.key] ? ` · ${counts[t.key]}` : ''}
          </Link>
        ))}
      </div>

      <div className="ph-sub" style={{ marginBottom: 'var(--s5)' }}>
        {TABS.find((t) => t.key === status)?.blurb}
      </div>

      {!rows.length && (
        <div className="note" style={{ marginBottom: 0 }}>
          Nothing here yet.
        </div>
      )}

      {!!rows.length && (
        <table>
          <thead>
            <tr>
              <th>Site</th><th>Found</th><th>What came back</th>
              <th>Kind</th><th>State</th><th>Cost</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.draft_id}>
                <td style={{ maxWidth: 250 }}>
                  {/* Clickable, so the site can be opened alongside the draft
                      while checking it. */}
                  <a href={r.source_url} target="_blank" rel="noopener"
                     className="v-slug" style={{ wordBreak: 'break-all' }}>
                    {String(r.source_url ?? '').replace(/^https?:\/\/(www\.)?/, '')}
                  </a>
                  <div className="v-slug" style={{ marginTop: 2 }}>
                    {new Date(r.created_at).toLocaleDateString('en-AU',
                      { day: 'numeric', month: 'short', year: 'numeric' })}
                    {r.pages_read ? ` · ${r.pages_read} pages` : ''}
                    {r.pages_failed ? ` · ${r.pages_failed} unreachable` : ''}
                  </div>
                </td>
                <td>
                  {r.venue_id ? (
                    <Link href={`/venues/${r.venue_id}/details`}
                          style={{ textDecoration: 'none' }}>
                      <span className="v-name" style={{ fontSize: 16 }}>
                        {r.venue_name ?? r.name_found}
                      </span>
                    </Link>
                  ) : (
                    <span className="v-name" style={{ fontSize: 16 }}>
                      {r.name_found ?? '—'}
                    </span>
                  )}
                </td>
                <td className="v-slug">
                  {r.status === 'Failed'
                    ? <span style={{ color: 'var(--bad)' }}>{r.error_message}</span>
                    : [
                        r.rooms_found ? `${r.rooms_found} rooms` : null,
                        r.spaces_found ? `${r.spaces_found} spaces` : null,
                        r.services_found ? `${r.services_found} services` : null,
                      ].filter(Boolean).join(' · ') || 'Venue detail only'}
                  {!!r.flags && (
                    <div style={{ color: 'var(--warn)' }}>
                      {r.flags} to check
                    </div>
                  )}
                </td>
                <td>
                  <span className="pill empty" style={{ fontSize: 9 }}>{r.run_kind}</span>
                </td>
                <td>
                  <span className="pill" style={STATUS_STYLE[r.status] ?? {}}>{r.status}</span>
                </td>
                <td className="v-slug">
                  {r.cost_usd ? `$${Number(r.cost_usd).toFixed(3)}` : '—'}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {r.status === 'Ready' && (
                    <Link className="btn quiet" href={`/venues/new?draft=${r.draft_id}`}>
                      Check it
                    </Link>
                  )}
                  {r.status === 'Accepted' && r.venue_id && (
                    <Link className="btn" href={`/venues/${r.venue_id}/details`}>
                      Open the venue
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
