import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import SignOutButton from '@/components/SignOutButton';
import SettingsNav from '@/components/SettingsNav';
import { SaveStateProvider, SaveIndicator } from '@/components/SaveState';
import SessionTimeout from '@/components/SessionTimeout';

// Nav badge counts change rarely and nothing depends on them being to the
// second. Caching for a minute removes three queries from every page load.
export const revalidate = 60;

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ count: venueCount }, { count: legalCount }, { count: listingCount },
         { count: contactCount }, { count: enquiryCount },
         { count: applicationCount }] = await Promise.all([
    supabase.from('venues').select('*', { count: 'exact', head: true }),
    supabase.from('legal_documents').select('*', { count: 'exact', head: true }),
    supabase.from('venue_listings').select('*', { count: 'exact', head: true }),
    supabase.from('contacts').select('*', { count: 'exact', head: true }),
    supabase.from('enquiries').select('*', { count: 'exact', head: true }),
    // Waiting, not ever. A badge showing every application ever received
    // tells nobody anything about what needs doing.
    supabase.from('venue_applications').select('*', { count: 'exact', head: true })
      .in('status', ['Submitted', 'Reading it', 'Asked them something']),
  ]);

  return (
    <SaveStateProvider>
      <SessionTimeout />
      <div className="app">
        <aside className="side">
          <div className="side-head">
            <div className="sh-name">The Global Sanctum</div>
            <div className="sh-sub">Internal portal</div>
          </div>

          <div className="side-body">
            <div className="nav-group">
              <h4>Overview</h4>
              <Link className="nav-item" href="/home"><span>Home</span></Link>
            </div>
            <div className="nav-group">
              <h4>Work</h4>
              <Link className="nav-item" href="/concierge"><span>Concierge</span></Link>
              <Link className="nav-sub" href="/concierge/search"><span>Venue search</span></Link>
              <Link className="nav-item" href="/applications">
                <span>Applications</span>
                {(applicationCount ?? 0) > 0 && (
                  <span className="count">{applicationCount}</span>
                )}
              </Link>
              <Link className="nav-item" href="/itineraries"><span>Itineraries</span></Link>
            </div>
            <div className="nav-group">
              <h4>Records</h4>
              <Link className="nav-item" href="/venues">
                <span>Venues</span><span className="count">{venueCount ?? '—'}</span>
              </Link>
              <Link className="nav-item" href="/contacts">
                <span>Contacts</span><span className="count">{contactCount ?? 0}</span>
              </Link>
              <Link className="nav-item" href="/enquiries">
                <span>Enquiries</span><span className="count">{enquiryCount ?? 0}</span>
              </Link>
              <Link className="nav-item" href="/collections"><span>Collections</span></Link>
              <Link className="nav-item" href="/listings">
                <span>Listings</span><span className="count">{listingCount ?? 0}</span>
              </Link>
            </div>
            <div className="nav-group">
              <h4>Business</h4>
              <Link className="nav-item" href="/finance"><span>Finance</span></Link>
              <Link className="nav-item" href="/legal">
                <span>Legal</span><span className="count">{legalCount ?? '—'}</span>
              </Link>
              <Link className="nav-sub" href="/legal/acceptances"><span>Acceptances</span></Link>
              <Link className="nav-item" href="/property"><span>Property</span></Link>
              <Link className="nav-item" href="/docs"><span>Internal docs</span></Link>
              <Link className="nav-item" href="/business"><span>The business</span></Link>
              <Link className="nav-item" href="/analytics"><span>Analytics</span></Link>
              <Link className="nav-item" href="/marketing"><span>Marketing</span></Link>
              <Link className="nav-item" href="/site"><span>Platform site</span></Link>
              <span className="nav-item off"><span>Sanctum Institute</span></span>
              <SettingsNav />
            </div>
          </div>

          <div className="side-foot">
            <div className="sf-label">Logged in as</div>
            <div className="sf-name">{user?.email ?? '—'}</div>
            <SignOutButton />
          </div>
        </aside>

        <div className="main">
          <div className="topbar">
            <span className="tb-crumb"><Link href="/home">Home</Link></span>
            <div className="tb-right"><SaveIndicator /></div>
          </div>
          {children}
        </div>
      </div>
    </SaveStateProvider>
  );
}
