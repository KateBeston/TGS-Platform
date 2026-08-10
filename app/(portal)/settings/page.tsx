import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { CATALOGUES } from '@/lib/catalogueSchema';
import LaunchDate from '@/components/LaunchDate';
import OrgSettings from '@/components/OrgSettings';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const supabase = await createClient();

  const counts = await Promise.all(
    CATALOGUES.map(async (c) => {
      const { count } = await supabase.from(c.table).select('*', { count: 'exact', head: true });
      return count ?? 0;
    })
  );

  // One date that the complimentary period and the legal phase both
  // hang off, so it belongs somewhere findable rather than in a table
  // nobody opens.
  const [{ data: milestone }, { data: period }] = await Promise.all([
    supabase.from('platform_milestones').select('*').maybeSingle(),
    supabase.rpc('complimentary_period'),
  ]);

  const { data: settings } = await supabase
    .from('tgs_settings').select('*')
    .order('setting_group').order('display_order').order('setting_key');

  const nonSecret = (settings ?? []).filter((s: any) => !s.is_secret);
  const secretCount = (settings ?? []).length - nonSecret.length;

  return (
    <div className="content"><div className="wrap">
      <PendingCandidates />
      <div className="ph">
        <div>
          <h2>Settings</h2>
          <div className="ph-sub">Catalogues and organisation configuration</div>
        </div>
      </div>

      <div className="note">
        <strong>Credentials are not stored here.</strong> Stripe, Supabase and any other keys
        live in Vercel environment variables, where the application can read them and no
        signed-in user can.</div>

      <div className="band">
        <div className="band-label">
          <span className="bl">The platform</span>
        </div>
        <LaunchDate
          wentLiveAt={milestone?.went_live_at ?? null}
          months={milestone?.complimentary_months ?? 6}
          inWords={(period as any)?.in_words
            ?? 'The platform is not live yet, so the six months has not started.'} />
      </div>

      <div className="band">
        <div className="band-label">
          <span className="bl">Catalogues</span>
        </div>
        <div className="tiles">
          {CATALOGUES.map((c, i) => (
            <Link className="tile" key={c.slug} href={`/settings/${c.slug}`}
                  style={{ textAlign: 'left', padding: 'var(--s5)' }}>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 24 }}>{c.label}</div>
              <div className="tile-meta" style={{ marginTop: 'var(--s2)' }}>
                {counts[i].toLocaleString('en-AU')} record{counts[i] === 1 ? '' : 's'}
                {c.protected && ' · slug protected'}
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="band">
        <div className="band-label">
          <span className="bl">Access</span>
        </div>
        <div className="tiles">
          <Link className="tile" href="/settings/holidays"
                style={{ textAlign: 'left', padding: 'var(--s5)' }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 24 }}>Public holidays</div>
            <div className="tile-meta" style={{ marginTop: 'var(--s2)' }}>
              Synced per country, 200 supported
            </div>
          </Link>
          <Link className="tile" href="/settings/users"
                style={{ textAlign: 'left', padding: 'var(--s5)' }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 24 }}>People</div>
            <div className="tile-meta" style={{ marginTop: 'var(--s2)' }}>
              Accounts, roles and area access
            </div>
          </Link>
        </div>
      </div>

      <div className="band">
        <div className="band-label">
          <span className="bl">Organisation</span>
        </div>
        <OrgSettings rows={nonSecret} />
      </div>
    </div></div>
  );
}


/** A quiet prompt rather than a badge. Phrases venues used that the
 *  catalogue did not know — worth deciding on, not urgent. */
async function PendingCandidates() {
  const supabase = await createClient();
  const { count } = await supabase
    .from('facility_candidates')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'Pending');
  if (!count) return null;
  return (
    <div className="note">
      <strong>{count} amenit{count === 1 ? 'y' : 'ies'} venues wrote that the catalogue does not
      know.</strong>{' '}
      <Link href="/settings/catalogues/candidates" style={{ color: 'var(--ink-gold)' }}>
        Decide on them
      </Link> — most will be other wordings of something already listed, and recording one
      improves matching for every venue read afterwards.
    </div>
  );
}
