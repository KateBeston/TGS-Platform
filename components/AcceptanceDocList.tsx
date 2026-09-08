import Link from 'next/link';

/* The agreements a booking calls for, grouped by what they relate to.
 *
 * A flat list of eight tells somebody nothing. On a mixed booking — a treatment
 * and a venue hire — four are universal, two are theirs as a guest and two are
 * theirs as a host, and those are genuinely different obligations. Reading
 * "Retreat Host Agreement" next to "Assumption of Risk Waiver" with no
 * distinction invites the assumption that one of them is a mistake.
 *
 * The grouping is not decoration. Somebody signing as a host and attending as a
 * guest is accepting two different sets of terms about two different roles, and
 * the page should say so.
 */

type Doc = {
  slug: string;
  name: string;
  booking_context: string | null;
  version_label?: string | null;
};

const GROUPS: { key: string; title: string; blurb: string }[] = [
  {
    key: 'Any',
    title: 'For every booking',
    blurb: 'These apply whatever you have chosen.',
  },
  {
    key: 'Wellness',
    title: 'Because you are attending',
    blurb: 'You have booked a treatment or experience, so these apply to you as a guest.',
  },
  {
    key: 'Retreat',
    title: 'Because you are hosting',
    blurb: 'You have hired a venue or its spaces, so these apply to you as the person running it.',
  },
];

export default function AcceptanceDocList({ docs }: { docs: Doc[] }) {
  if (!docs.length) return null;

  const grouped = GROUPS
    .map((g) => ({ ...g, docs: docs.filter((d) => (d.booking_context ?? 'Any') === g.key) }))
    .filter((g) => g.docs.length > 0);

  /* With one group there is nothing to distinguish, so the headings would be
     noise. They earn their place only when a booking is more than one thing. */
  const showHeadings = grouped.length > 1;

  return (
    <div className="acc-docs">
      {grouped.map((g) => (
        <div key={g.key} className="acc-doc-group">
          {showHeadings && (
            <>
              <h5 className="acc-doc-h">{g.title}</h5>
              <p className="acc-doc-blurb">{g.blurb}</p>
            </>
          )}
          <ul className="step-docs">
            {g.docs.map((d) => (
              <li key={d.slug}>
                <Link href={`/legal/${d.slug}`}>{d.name}</Link>
                {d.version_label && <span>{d.version_label}</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
