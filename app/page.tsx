import { createClient } from '@/lib/supabase/server';

// Read fresh while there is nothing to cache. Caching comes once there
// are pages worth caching, and guessing at it now would hide whether the
// connection works.
export const dynamic = 'force-dynamic';

export default async function Home() {
  const supabase = await createClient();

  // The published view rather than the table. It carries only public
  // columns, so a mistake here cannot reach a commission rate.
  const { data: venues, error } = await supabase
    .from('published_venues')
    .select('id, venue_name, city, country, venue_type, max_guests')
    .order('venue_name')
    .limit(12);

  // Counted separately, because "nothing published yet" and "the
  // connection is broken" look identical otherwise and only one of them
  // is a problem.
  const { count } = await supabase
    .from('published_venues')
    .select('id', { count: 'exact', head: true });

  return (
    <main className="wrap" style={{ paddingTop: 90, paddingBottom: 90 }}>
      <div className="eyebrow">The Global Sanctum</div>
      <h1 style={{ marginTop: 12 }}>
        Retreat spaces, wellness experiences, globally curated
      </h1>

      <p style={{ maxWidth: 560, color: 'var(--ink-quiet)', fontSize: 18 }}>
        The platform site. Nothing is built yet — this page exists to prove
        the connection to the database, and it does.
      </p>

      <div style={{
        marginTop: 48, padding: '28px 32px',
        background: 'var(--warm-cream)',
        borderLeft: '2px solid var(--gold)',
      }}>
        <div className="eyebrow">Connection</div>

        {error ? (
          <>
            <p style={{ margin: '10px 0 0', color: 'var(--bad)' }}>
              Could not reach the database.
            </p>
            <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--ink-quiet)' }}>
              {error.message}
            </p>
            <p style={{ margin: '12px 0 0', fontSize: 14, color: 'var(--ink-quiet)' }}>
              Usually the environment variables. Check both are set in
              Vercel, for Production as well as Preview.
            </p>
          </>
        ) : (
          <>
            <p style={{ margin: '10px 0 0', fontSize: 18 }}>
              Reached Supabase and read the published venues.
            </p>
            <p style={{ margin: '6px 0 0', fontSize: 15, color: 'var(--ink-quiet)' }}>
              {count === 0
                ? 'None are published yet, which is the expected answer today — '
                  + 'an empty list means the whole chain works.'
                : `${count} published.`}
            </p>
          </>
        )}
      </div>

      {!!venues?.length && (
        <div style={{ marginTop: 48 }}>
          <h2>Published</h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {venues.map((v) => (
              <li key={v.id}
                  style={{ padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 22 }}>
                  {v.venue_name}
                </div>
                <div style={{ fontSize: 14, color: 'var(--ink-quiet)' }}>
                  {[v.city, v.country, v.venue_type].filter(Boolean).join(' · ')}
                  {v.max_guests ? ` · takes ${v.max_guests}` : ''}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
