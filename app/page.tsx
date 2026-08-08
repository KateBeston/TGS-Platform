import { createClient, environmentIsReady } from '@/lib/supabase/server';

// Read fresh while there is nothing to cache. Caching comes once there
// are pages worth caching, and guessing at it now would hide whether the
// connection works.
export const dynamic = 'force-dynamic';

type Venue = {
  id: number;
  venue_name: string | null;
  city: string | null;
  country: string | null;
  venue_type: string | null;
  max_guests: number | null;
};

export default async function Home() {
  // Checked before connecting. A missing variable throws inside the
  // Supabase client, before any try/catch in this page can run — which
  // produces a blank server error rather than a sentence naming the
  // variable.
  const env = environmentIsReady();

  let venues: Venue[] = [];
  let count: number | null = null;
  let problem: string | null = null;

  if (env.ready) {
    try {
      const supabase = await createClient();

      const [list, total] = await Promise.all([
        supabase.from('published_venues')
          .select('id, venue_name, city, country, venue_type, max_guests')
          .order('venue_name').limit(12),
        supabase.from('published_venues')
          .select('id', { count: 'exact', head: true }),
      ]);

      if (list.error) problem = list.error.message;
      venues = (list.data ?? []) as Venue[];
      count = total.count ?? 0;
    } catch (e: any) {
      problem = String(e?.message ?? e);
    }
  }

  return (
    <main className="wrap" style={{ paddingTop: 90, paddingBottom: 90 }}>
      <div className="eyebrow">The Global Sanctum</div>
      <h1 style={{ marginTop: 12 }}>
        Retreat spaces, wellness experiences, globally curated
      </h1>

      <p style={{ maxWidth: 560, color: 'var(--ink-quiet)', fontSize: 18 }}>
        The platform site. Nothing is built yet — this page exists to prove
        the connection to the database.
      </p>

      <div style={{
        marginTop: 48, padding: '28px 32px',
        background: 'var(--warm-cream)',
        borderLeft: `2px solid ${env.ready && !problem ? 'var(--gold)' : 'var(--bad)'}`,
      }}>
        <div className="eyebrow">Connection</div>

        {!env.ready ? (
          <>
            <p style={{ margin: '10px 0 0', fontSize: 18 }}>
              Not configured yet.
            </p>
            <p style={{ margin: '8px 0 0', fontSize: 15, color: 'var(--ink-quiet)' }}>
              Missing:{' '}
              {env.missing.map((m, i) => (
                <span key={m}>
                  {i > 0 && ', '}
                  <code style={{ fontFamily: 'ui-monospace, Menlo, monospace',
                                 fontSize: 13.5 }}>{m}</code>
                </span>
              ))}
            </p>
            <p style={{ margin: '14px 0 0', fontSize: 15, color: 'var(--ink-quiet)' }}>
              In Vercel, under Settings → Environment Variables. Add both, tick
              Production, Preview and Development, then redeploy — Vercel only
              picks up new variables on a fresh build, so saving them is not
              enough on its own.
            </p>
          </>
        ) : problem ? (
          <>
            <p style={{ margin: '10px 0 0', fontSize: 18 }}>
              Reached the environment but not the data.
            </p>
            <p style={{ margin: '8px 0 0', fontSize: 15, color: 'var(--ink-quiet)' }}>
              {problem}
            </p>
          </>
        ) : (
          <>
            <p style={{ margin: '10px 0 0', fontSize: 18 }}>
              Reached Supabase and read the published venues.
            </p>
            <p style={{ margin: '8px 0 0', fontSize: 15, color: 'var(--ink-quiet)' }}>
              {count === 0
                ? 'None are published yet, which is the expected answer today — '
                  + 'an empty list means the whole chain works.'
                : `${count} published.`}
            </p>
          </>
        )}
      </div>

      {!!venues.length && (
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
