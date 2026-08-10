import Link from 'next/link';
import { notFound } from 'next/navigation';
import ApplicationDecision from '@/components/ApplicationDecision';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/* One application, and what they signed.
 *
 * The agreements sit on this page rather than somewhere separate,
 * because the question "what did they actually agree to" arrives while
 * you are looking at their application, not later from a menu. */

function List({ title, items }: { title: string; items: any }) {
  const v = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!v.length) return null;
  return (
    <div className="f">
      <label>{title}</label>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {v.map((i: string) => <span key={i} className="pill">{i}</span>)}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="f">
      <label>{label}</label>
      <div>{String(value)}</div>
    </div>
  );
}

export default async function ApplicationPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: app } = await supabase.from('venue_applications')
    .select('*, countries(name), venue_types(name)').eq('id', id).maybeSingle();

  if (!app) notFound();

  const { data: signed } = await supabase.from('acceptance_record')
    .select('*').eq('signatory_email', app.email)
    .order('document');

  const agreements = signed ?? [];
  const anyProblem = agreements.some((a: any) => a.integrity !== 'Intact');

  return (
    <div className="content">
      <div className="ph">
        <div>
          <span className="tb-crumb"><Link href="/applications">Applications</Link></span>
          <h2>{app.venue_name}</h2>
          <div className="ph-sub">
            {app.reference} · {app.status} · received{' '}
            {new Date(app.submitted_at).toLocaleDateString('en-AU',
              { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
      </div>

      <div className="two-col">
        <div>
          <div className="card">
            <h3>Who applied</h3>
            <Field label="Name" value={[app.salutation, app.first_name, app.surname]
              .filter(Boolean).join(' ')} />
            <Field label="Email" value={app.email} />
            <Field label="Phone" value={app.phone} />
            <Field label="Their role" value={app.role} />
            <Field label="Business" value={app.business_name} />
            <Field label="Business address" value={app.business_address} />
            <Field label="ABN" value={app.abn} />
          </div>

          <div className="card">
            <h3>The venue, as they describe it</h3>
            <div className="note">
              Their words, unverified. Nothing here has been checked.
            </div>
            <Field label="Name" value={app.venue_name} />
            <Field label="Where" value={app.location_text ?? app.countries?.name} />
            <Field label="Marketplace" value={app.marketplace} />
            <Field label="Type" value={app.venue_types?.name ?? app.venue_type_other} />
            <Field label="Website" value={app.website_url} />
            <Field label="Instagram" value={app.instagram_url} />
            <Field label="Practice space capacity" value={app.practice_space_capacity} />
            <Field label="Daily guest capacity" value={app.daily_guest_capacity} />
            <Field label="Accommodation capacity" value={app.accommodation_capacity} />
            <Field label="Bedrooms" value={app.total_bedrooms} />
            <Field label="Ensuites" value={app.ensuites} />
            <Field label="Shared bathrooms" value={app.shared_bathrooms} />
            <List title="Spaces" items={app.space_type_names} />
            <List title="Services" items={app.service_names} />
            <List title="Beds" items={app.bed_configuration} />
            <List title="Accommodation features" items={app.accommodation_features} />
            <List title="Amenities" items={app.amenity_names} />
            <Field label="Other amenities" value={app.other_amenities} />
            <Field label="Price from" value={app.price_from
              && `${app.price_currency ?? 'AUD'} ${app.price_from} ${app.price_basis ?? ''}`} />
            <Field label="Includes" value={app.price_includes} />
          </div>

          <div className="card">
            <h3>Who may come</h3>
            <div className="note">
              Asked at application because it is far harder to ask later, and a
              retreat host needs it before they enquire rather than after.
            </div>
            <List title="Who may attend" items={app.who_may_attend} />
            <Field label="And" value={app.who_may_attend_other} />
            <Field label="Orientation" value={app.orientation} />
            <List title="Cultural protocols" items={app.cultural_protocols} />
            <Field label="Stated where" value={app.protocols_stated_where} />
            <Field label="Hosting notes" value={app.hosting_notes} />
          </div>

          {app.message && (
            <div className="card">
              <h3>What they said</h3>
              <p style={{ whiteSpace: 'pre-wrap' }}>{app.message}</p>
            </div>
          )}
        </div>

        <div>
          <ApplicationDecision id={app.id} status={app.status} venueId={app.venue_id} />

          <div className="card">
            <h3>What they signed</h3>
            {!agreements.length ? (
              <div className="note warn">
                Nothing recorded. Every application should carry five agreements —
                if this one has none, the recording failed and their acceptance
                cannot be produced if asked.
              </div>
            ) : (
              <>
                {anyProblem && (
                  <div className="note warn">
                    One of these no longer matches the wording they agreed to.
                  </div>
                )}
                <table className="tbl">
                  <thead>
                    <tr><th>Document</th><th>Version</th><th>Length</th><th /></tr>
                  </thead>
                  <tbody>
                    {agreements.map((a: any) => (
                      <tr key={a.id}>
                        <td>
                          {a.document}
                          <div className="muted small">
                            {new Date(a.accepted_at).toLocaleDateString('en-AU')}
                            {a.ip_address && ` · ${a.ip_address}`}
                          </div>
                        </td>
                        <td>
                          {a.version}
                          {a.phase !== 'Both' && (
                            <div className="muted small">{a.phase}</div>
                          )}
                        </td>
                        <td className="muted small">
                          {a.characters_agreed_to?.toLocaleString('en-AU')}
                        </td>
                        <td className={a.integrity === 'Intact' ? 'muted small' : 'warn'}>
                          {a.integrity}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="muted small" style={{ marginTop: 'var(--s3)' }}>
                  Signed <strong>{app.signed_name}</strong> on{' '}
                  {app.signed_on && new Date(app.signed_on).toLocaleDateString('en-AU')}.
                  The wording is fingerprinted at the moment of acceptance, so it can
                  be proved later that it has not changed.
                </div>
              </>
            )}
          </div>

          <div className="card">
            <h3>Where it came from</h3>
            <Field label="How they heard" value={app.heard_about} />
            <Field label="Referred from" value={app.submitted_from} />
            <Field label="IP" value={app.submitted_ip} />
            <Field label="Journal" value={app.wants_journal ? 'Subscribed' : 'No'} />
            {app.reviewed_by && (
              <>
                <Field label="Last read by" value={app.reviewed_by} />
                <Field label="Note" value={app.decision_note} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
