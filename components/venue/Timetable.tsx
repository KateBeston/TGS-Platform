import Link from 'next/link';

/* ═══════════════════════════════════════════════════════════════════════
   THE WEEK

   What runs, on which days, at what hour. Read from the venue's own
   timetable rather than from the next fortnight of generated sessions,
   because a guest deciding whether this venue suits them is asking a
   question about their week, not about a date: "is there a morning class
   I could get to before work?"

   The hour a guest books is chosen later, in the picker, against real
   remaining places. This is the shape of the week, so nothing here is
   presented as availability — a class listed on Tuesday may well be
   full this Tuesday, and saying otherwise here would be a promise the
   page cannot keep.

   Times are the venue's own clock, unconverted and labelled as such. A
   6am class in Brisbane is not 6am for a guest in Vancouver, and the
   place to reconcile that is the picker, where the date is being chosen.
   ═══════════════════════════════════════════════════════════════════════ */

type Row = {
  venue_id: number;
  service_id: number;
  service_name: string;
  practice: string | null;
  practice_slug: string | null;
  category: string | null;
  day_of_week: number;
  starts_at_local: string;
  duration_minutes: number | null;
  capacity: number | null;
  price: number | string | null;
  currency: string | null;
};

/* Postgres' own numbering, which is what service_schedules stores:
   Sunday is 0. Monday leads the list, because a week of classes reads
   as a working week rather than as a database column. */
const DAYS = [
  { dow: 1, name: 'Monday', short: 'Mon' },
  { dow: 2, name: 'Tuesday', short: 'Tue' },
  { dow: 3, name: 'Wednesday', short: 'Wed' },
  { dow: 4, name: 'Thursday', short: 'Thu' },
  { dow: 5, name: 'Friday', short: 'Fri' },
  { dow: 6, name: 'Saturday', short: 'Sat' },
  { dow: 0, name: 'Sunday', short: 'Sun' },
];

/* 06:00:00 reads as 6:00am. Built by hand rather than through a Date,
   which would need a day and a zone to render an hour that has neither. */
function clock(t: string) {
  const [hRaw, m] = (t ?? '').split(':');
  const h = Number(hRaw);
  if (!Number.isFinite(h)) return t;
  const ampm = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${m && m !== '00' ? `:${m}` : ''}${ampm}`;
}

const mins = (n: number | null) => (n ? `${n} min` : null);

const money = (v: number | string | null, c: string | null) => {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  try {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency', currency: c || 'AUD', maximumFractionDigits: 0,
    }).format(n);
  } catch { return `${n}`; }
};

export default function Timetable({
  rows, timezone, serviceHref,
}: {
  rows: Row[];
  /** The venue's zone, named so a guest reads the hours as the venue's. */
  timezone?: string | null;
  /** Where a class links to, so the row is a way in rather than a notice. */
  serviceHref?: (r: Row) => string | null;
}) {
  if (!rows?.length) return null;

  const byDay = DAYS
    .map((d) => ({
      ...d,
      rows: rows.filter((r) => r.day_of_week === d.dow)
        .sort((a, b) => a.starts_at_local.localeCompare(b.starts_at_local)),
    }))
    .filter((d) => d.rows.length);

  /* How many distinct things run in a week, which is the number a guest
     is actually weighing — not how many rows the pattern has. */
  const classes = new Set(rows.map((r) => r.service_id)).size;
  const zone = timezone ? timezone.split('/').pop()?.replace(/_/g, ' ') : null;

  return (
    <div className="tt">
      <p className="tt-intro">
        {classes === 1 ? 'One class runs' : `${classes} classes run`} to a
        weekly timetable
        {byDay.length === 1 ? ' on one day' : ` across ${byDay.length} days`}.
        Hours are the venue&rsquo;s own{zone ? `, ${zone} time` : ''}. Choose a
        date when you book &mdash; places left are shown then.
      </p>

      <div className="tt-week">
        {byDay.map((d) => (
          <section key={d.dow} className="tt-day">
            <h4 className="tt-day-name">
              {d.name}
              <span className="tt-day-count">
                {d.rows.length} {d.rows.length === 1 ? 'session' : 'sessions'}
              </span>
            </h4>
            <ul className="tt-rows">
              {d.rows.map((r, i) => {
                const href = serviceHref?.(r) ?? null;
                const meta = [mins(r.duration_minutes),
                              r.capacity ? `${r.capacity} places` : null,
                              money(r.price, r.currency)].filter(Boolean).join(' · ');
                const body = (
                  <>
                    <span className="tt-time">{clock(r.starts_at_local)}</span>
                    <span className="tt-what">
                      <span className="tt-name">{r.service_name}</span>
                      {r.practice && r.practice !== r.service_name && (
                        <span className="tt-practice">{r.practice}</span>
                      )}
                      {meta && <span className="tt-meta">{meta}</span>}
                    </span>
                  </>
                );
                return (
                  <li key={`${r.service_id}-${r.starts_at_local}-${i}`} className="tt-row">
                    {href
                      ? <Link href={href} className="tt-row-link">{body}</Link>
                      : <span className="tt-row-link tt-row-plain">{body}</span>}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
