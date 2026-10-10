import Link from 'next/link';

/* ═══════════════════════════════════════════════════════════════════════
   WHAT IS ON OFFER HERE

   Driven by venue_discounts — the offers that actually compute — rather
   than the old venue_promotions banner table. A banner fed by a separate
   hand-written table can advertise something checkout will not honour,
   and that is the one failure a price banner must not have.

   It carries the condition in words, because a conditional offer is
   never struck through on a price: "20% off when you book two or more"
   belongs here, and the cart applies it once there are two.

   The button goes where the offer lives. One service, and it goes to
   that service; anything wider, and it goes to the section.
   ═══════════════════════════════════════════════════════════════════════ */

type Offer = {
  id: number;
  title: string;
  description: string | null;
  kind: string;
  value: number | null;
  code: string | null;
  currency: string | null;
  applies_to: string;
  starts_on: string | null;
  ends_on: string | null;
  days_of_week: number[] | null;
  min_items: number | null;
  min_people: number | null;
  min_spend: number | null;
  venue_discount_items?: { service_id: number | null; duration_id: number | null }[];
};

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday',
              'Friday', 'Saturday'];

const money = (n: number | null, c: string | null) =>
  n == null ? null : new Intl.NumberFormat('en-AU', {
    style: 'currency', currency: c ?? 'AUD', maximumFractionDigits: 0,
  }).format(n);

const day = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : null;

/** The offer's size, in the words it was written in. */
function headline(o: Offer): string {
  if (o.kind === 'Percentage off' && o.value != null) return `${o.value}% off`;
  if (o.kind === 'Amount off' && o.value != null) {
    return `${money(o.value, o.currency)} off`;
  }
  return 'One free';
}

/** The conditions, as a sentence a guest can act on. */
function terms(o: Offer): string[] {
  const out: string[] = [];
  if (o.min_items && o.min_items > 1) out.push(`booking ${o.min_items} or more`);
  if (o.min_people && o.min_people > 1) out.push(`${o.min_people} people or more`);
  if (o.min_spend) out.push(`spending ${money(o.min_spend, o.currency)} or more`);
  if (o.code) out.push(`quoting ${o.code}`);
  if (o.days_of_week?.length && o.days_of_week.length < 7) {
    out.push(o.days_of_week.map((d) => DAYS[d]).join(', '));
  }
  return out;
}

export default function OfferBanner({
  offers, serviceAnchors = {}, sectionHref = '#experiences',
  sectionLabel = 'See the services',
}: {
  offers: Offer[];
  /** Service id to the anchor of its card, where one exists. */
  serviceAnchors?: Record<number, string>;
  sectionHref?: string;
  sectionLabel?: string;
}) {
  if (!offers.length) return null;

  return (
    <div className="offb">
      <div className="offb-h">
        {offers.length === 1 ? 'On offer' : 'Offers'}
      </div>

      <ul className="offb-list">
        {offers.map((o) => {
          const cond = terms(o);
          const window = [day(o.starts_on), day(o.ends_on)].filter(Boolean);

          /* Exactly one named service, and the button goes to it. Two or
             more, or venue-wide, and it goes to the section — sending
             somebody to the first of five is worse than sending them to
             all five. */
          const named = (o.venue_discount_items ?? [])
            .map((i) => i.service_id).filter(Boolean) as number[];
          const one = o.applies_to === 'Chosen services' && named.length === 1
            ? serviceAnchors[named[0]] : undefined;

          return (
            <li key={o.id} className="offb-item">
              <div className="offb-main">
                <span className="offb-fig">{headline(o)}</span>
                <span className="offb-title">{o.title}</span>
                {!!cond.length && (
                  <span className="offb-terms">when {cond.join(', ')}</span>
                )}
                {o.description && <p className="offb-desc">{o.description}</p>}
                {window.length > 0 && (
                  <p className="offb-dates">{window.join(' – ')}</p>
                )}
              </div>
              <Link className="offb-cta" href={one ?? sectionHref}>
                {one ? 'See the service' : sectionLabel}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
