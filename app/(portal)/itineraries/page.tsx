import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function ItinerariesPage() {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from('itineraries')
    .select('*, venues:base_venue_id(venue_name), enquiries(first_name,surname)')
    .order('date_from', { ascending: false, nullsFirst: false }).limit(100);

  return (
    <div className="content">
      <div className="ph">
        <div>
          <h2>Itineraries</h2>
          <div className="ph-sub">
            What happens inside a retreat window, wherever it happens
          </div>
        </div>
      </div>

      <div className="note">
        Itineraries are created from an enquiry, so the dates, guest count and selected venue
        carry across rather than being retyped. Open an enquiry and use Build itinerary.
      </div>

      {!rows?.length && <div className="note">None yet.</div>}

      {!!rows?.length && (
        <table>
          <thead>
            <tr><th>Itinerary</th><th>Base venue</th><th>Dates</th>
                <th>Guests</th><th>Status</th></tr>
          </thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/itineraries/${r.id}`} style={{ textDecoration: 'none' }}>
                    <div className="v-name">{r.name}</div>
                    {r.enquiries && (
                      <div className="v-slug">
                        {[r.enquiries.first_name, r.enquiries.surname].filter(Boolean).join(' ')}
                      </div>
                    )}
                  </Link>
                </td>
                <td className="v-slug">{r.venues?.venue_name ?? '—'}</td>
                <td className="v-slug">
                  {r.date_from
                    ? new Date(r.date_from).toLocaleDateString('en-AU')
                    : '—'}
                  {r.date_to && ` to ${new Date(r.date_to).toLocaleDateString('en-AU')}`}
                </td>
                <td>{r.guest_count ?? '—'}</td>
                <td>
                  <span className={`pill ${r.status === 'Confirmed' ? 'gold' : 'empty'}`}>
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
