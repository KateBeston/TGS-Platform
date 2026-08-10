'use client';

import DocShell from './doc/DocShell';
import {
  DocCallout, DocFacts, DocList, DocSection, docDate, docTime,
} from './doc/DocParts';
import { DOCUMENT_KINDS } from '@/lib/documents';

type Row = Record<string, any>;

export default function EnquiryBrief({
  enquiry, dates, requirements, matches, audience,
}: {
  enquiry: Row; dates: Row[]; requirements: Row[]; matches: Row[];
  audience: 'venue' | 'host';
}) {
  const kind = DOCUMENT_KINDS.enquiry_brief;
  const name = [enquiry.first_name, enquiry.surname].filter(Boolean).join(' ');
  const ref = enquiry.enquiry_reference ?? enquiry.enquiry_code ?? `ENQ-${enquiry.id}`;

  const essential = requirements.filter((r) => r.is_essential);
  const preferred = requirements.filter((r) => !r.is_essential);
  const shown = audience === 'host'
    ? matches.filter((m) => ['Available', 'Selected', 'Approached'].includes(m.match_status))
    : [];

  return (
    <DocShell
      kind={kind}
      audience={audience}
      branding="TGS"
      backHref={`/enquiries/${enquiry.id}`}
      backLabel="Back to the enquiry"
      title={audience === 'venue' ? 'Retreat enquiry' : 'Your enquiry'}
      reference={ref}
      intro={audience === 'host' && name
        ? `${name}, this is what we have recorded. If anything is wrong or missing, tell us and we will amend it before approaching anywhere.`
        : undefined}
    >
      <DocSection title="The brief">
        <DocFacts rows={[
          ['Enquiry type', enquiry.enquiry_type],
          ['Guests', enquiry.guest_count],
          ['Bedrooms needed', enquiry.bedrooms_required],
          ['Destination', enquiry.countries?.name],
          ['Area', enquiry.destination_notes],
          ['Focus', enquiry.modality_categories?.name],
          ['Practice', enquiry.modality_practices?.name],
          ['Outcome sought', enquiry.outcomes?.name],
          ['Venue type', enquiry.venue_types?.name],
          ['Setting', enquiry.setting_preference],
          ...(audience === 'venue'
            ? [['Budget', enquiry.budget_band] as [string, any]] : []),
        ]} />
      </DocSection>

      {!!dates.length && (
        <DocSection title="Dates">
          <DocFacts rows={dates.map((d, i) => [
            i === 0 ? 'Preferred' : `Alternative ${i}`,
            <>
              {docDate(d.date_from) ?? 'Not set'}
              {d.date_to && ` to ${docDate(d.date_to)}`}
              {d.nights ? ` · ${d.nights} nights` : ''}
              {(d.arrival_time || d.departure_time) && (
                <div className="doc-meta">
                  {docTime(d.arrival_time) && `Arriving ${docTime(d.arrival_time)}`}
                  {d.arrival_time && d.departure_time && ' · '}
                  {docTime(d.departure_time) && `Departing ${docTime(d.departure_time)}`}
                </div>
              )}
              {d.is_flexible && (
                <div className="doc-meta">
                  Flexible{d.flexibility_days ? ` by ${d.flexibility_days} days` : ''}
                </div>
              )}
              {d.notes && <div className="doc-aside">{d.notes}</div>}
            </>,
          ])} />
        </DocSection>
      )}

      {!!essential.length && (
        <DocSection title="Essential requirements">
          <DocList items={essential.map((r) => ({
            text: <>
              {r.requirement}
              {r.requirement_types?.label && (
                <span style={{ fontSize: 11, color: 'var(--ink-quiet)' }}>
                  {' '}· {r.requirement_types.label}
                </span>
              )}
            </>,
            note: r.detail,
          }))} />
        </DocSection>
      )}

      {!!preferred.length && (
        <DocSection title="Preferred, not essential">
          <DocList items={preferred.map((r) => ({ text: r.requirement, note: r.detail }))} />
        </DocSection>
      )}

      {enquiry.notes && (
        <DocSection title="Notes">
          <p style={{ fontSize: 14, whiteSpace: 'pre-wrap', margin: '12px 0 0' }}>
            {enquiry.notes}
          </p>
        </DocSection>
      )}

      {audience === 'host' && !!shown.length && (
        <DocSection title="Venues available">
          {shown.map((m) => (
            <div className="doc-block" key={m.id} style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 19 }}>
                {m.venues?.venue_name}
              </div>
              <div className="doc-meta">
                {[m.venues?.cities?.name, m.venues?.countries?.name].filter(Boolean).join(', ')}
                {m.venues?.max_guests && ` · up to ${m.venues.max_guests} guests`}
              </div>
              {m.why_this_venue && (
                <p style={{ fontSize: 14, margin: '6px 0 0' }}>{m.why_this_venue}</p>
              )}
              {m.quoted_amount && (
                <div style={{ fontSize: 13, marginTop: 4 }}>
                  Quoted {m.currency ?? 'AUD'}{' '}
                  {Number(m.quoted_amount).toLocaleString('en-AU')}
                </div>
              )}
            </div>
          ))}
        </DocSection>
      )}

      {audience === 'venue' && (
        <DocSection title="What we need from you">
          <DocList items={[
            { text: 'Whether you are available for any of the dates above' },
            { text: 'Whether you can meet the essential requirements' },
            { text: 'An indicative price for the group and duration' },
            { text: 'Anything you would want the host to know before deciding' },
          ]} />
          <DocCallout>
            The guest&rsquo;s contact details are held by us and shared only once a booking is
            agreed.
          </DocCallout>
        </DocSection>
      )}
    </DocShell>
  );
}
