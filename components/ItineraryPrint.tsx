'use client';

import DocShell from './doc/DocShell';
import {
  DocEntry, DocSection, docDate, docDay, docTime,
} from './doc/DocParts';
import { DOCUMENT_KINDS, type BrandingRegister } from '@/lib/documents';

type Row = Record<string, any>;

const ORDINALS = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight',
  'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen'];

export default function ItineraryPrint({
  itinerary, items, audience, branding, hostBranding,
}: {
  itinerary: Row; items: Row[];
  audience: 'guest' | 'internal';
  branding: BrandingRegister;
  hostBranding: Row | null;
}) {
  const guest = audience === 'guest';
  const kind = DOCUMENT_KINDS.itinerary;

  const dates = Array.from(new Set(items.map((i) => i.item_date))).sort();
  const visible = guest
    ? items.filter((i) => !['Cancelled', 'Declined'].includes(i.booking_status))
    : items;

  const total = items
    .filter((i) => !i.is_included)
    .reduce((s, i) => s + Number(
      i.price_total ?? (i.price_per_person ?? 0) * (i.participant_count ?? itinerary.guest_count ?? 1)
    ), 0);

  const unconfirmed = items.filter((i) =>
    ['Idea', 'Requested', 'Held'].includes(i.booking_status)).length;

  const where = [
    itinerary.venues?.venue_name,
    itinerary.venues?.cities?.name,
    itinerary.venues?.countries?.name,
  ].filter(Boolean).join(' · ');

  const when = [
    docDate(itinerary.date_from),
    itinerary.date_to && itinerary.date_to !== itinerary.date_from
      ? `to ${docDate(itinerary.date_to)}` : null,
    itinerary.guest_count ? `${itinerary.guest_count} guests` : null,
  ].filter(Boolean).join(' ');

  return (
    <DocShell
      kind={kind}
      audience={audience}
      branding={branding}
      host={hostBranding
        ? { ...hostBranding, display_name: itinerary.host_display_name ?? hostBranding.display_name }
        : itinerary.host_display_name
          ? { display_name: itinerary.host_display_name } : null}
      backHref={`/itineraries/${itinerary.id}`}
      backLabel="Back to the itinerary"
      title={itinerary.name}
      subtitles={[where, when]}
      warning={!guest && unconfirmed
        ? `${unconfirmed} item${unconfirmed === 1 ? '' : 's'} not yet confirmed.` : undefined}
      exports={[
        { label: 'Calendar file', href: `/api/itinerary/${itinerary.id}?format=ics` },
        { label: 'Spreadsheet', href: `/api/itinerary/${itinerary.id}?format=csv` },
      ]}
    >
      {!dates.length && (
        <p style={{ marginTop: 24, fontSize: 14, color: 'var(--ink-quiet)' }}>
          Nothing scheduled yet.
        </p>
      )}

      {dates.map((d, i) => {
        const dayItems = visible.filter((x) => x.item_date === d);
        if (!dayItems.length) return null;

        return (
          <DocSection key={d} title={`Day ${ORDINALS[i] ?? i + 1}`} subtitle={docDay(d)}
                      avoidBreak={false}>
            {dayItems.map((it) => {
              const offsite = it.venue_id && it.venue_id !== itinerary.base_venue_id;
              const cost = it.price_total
                ?? (it.price_per_person ?? 0)
                   * (it.participant_count ?? itinerary.guest_count ?? 1);

              const meta: React.ReactNode[] = [];
              if (offsite && it.venues?.venue_name) {
                meta.push(
                  <span className="doc-away" key="v">
                    At {it.venues.venue_name}
                    {it.venues?.cities?.name && `, ${it.venues.cities.name}`}
                  </span>
                );
              } else if (it.venue_spaces?.name) {
                meta.push(it.venue_spaces.name);
              }
              if (it.location_note) meta.push(it.location_note);
              if (it.participant_count && it.participant_count !== itinerary.guest_count) {
                meta.push(`${it.participant_count} guests`);
              }
              if (!guest && it.booking_status !== 'Confirmed') meta.push(it.booking_status);
              if (!guest && it.payable_to) meta.push(`payable to ${it.payable_to}`);
              if (it.is_included) meta.push('included');
              else if (cost > 0) {
                meta.push(`${it.currency ?? 'AUD'} ${guest
                  ? `${Number(it.price_per_person ?? 0).toLocaleString('en-AU')} per person`
                  : cost.toLocaleString('en-AU')}`);
              }

              return (
                <DocEntry key={it.id}
                  when={it.is_all_day || !it.starts_at ? 'All day' : docTime(it.starts_at)}
                  whenSub={!it.is_all_day && it.ends_at ? `to ${docTime(it.ends_at)}` : undefined}
                  title={it.title}
                  tag={it.is_optional ? 'Optional' : undefined}
                  description={it.description}
                  meta={meta}
                  aside={[
                    it.travel_minutes_to_next
                      ? `Allow ${it.travel_minutes_to_next} minutes to travel on` : null,
                    !guest && it.notes ? it.notes : null,
                  ].filter(Boolean).join(' · ') || undefined}
                />
              );
            })}
          </DocSection>
        );
      })}

      {!guest && total > 0 && (
        <DocSection title="Total">
          <div style={{ fontSize: 15, marginTop: 10 }}>
            AUD {total.toLocaleString('en-AU')}
            <span style={{ fontSize: 12.5, color: 'var(--ink-quiet)' }}>
              {' '}· excluding items included in the package
            </span>
          </div>
        </DocSection>
      )}
    </DocShell>
  );
}
