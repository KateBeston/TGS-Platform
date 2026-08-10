'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { VENUE_TABS } from '@/lib/venueSchema';

// Content and Media have dedicated pages rather than generated tabs.
const EXTRA = [
  { slug: 'taxonomy', label: 'Practices' },
  { slug: 'services', label: 'Services' },
  { slug: 'facilities', label: 'Facilities' },
  { slug: 'content', label: 'Listing content' },
  { slug: 'scheduling', label: 'Scheduling' },
  { slug: 'related', label: 'Related' },
  { slug: 'reviews', label: 'Reviews' },
  { slug: 'subscription', label: 'Subscription' },
  // Last, because it is a maintenance action rather than a part of the
  // record — you come here when a venue has changed its site.
  { slug: 'availability', label: 'Availability' },
  { slug: 'reread', label: 'Site reads' },
  // Last, and deliberately at the end — archiving and merging are things
  // done to a record rather than parts of it.
  { slug: 'archive', label: 'Archive' },
];

export default function VenueSectionNav({ id }: { id: number }) {
  const path = usePathname();
  return (
    <nav style={{ display: 'flex', flexWrap: 'wrap', borderBottom: '1px solid var(--border)' }}>
      {[...VENUE_TABS, ...EXTRA].map((s) => {
        const href = `/venues/${id}/${s.slug}`;
        const active = path === href;
        return (
          <Link key={s.slug} href={href}
            style={{
              padding: '12px var(--s4)', fontSize: 13, letterSpacing: '.04em',
              textTransform: 'uppercase', textDecoration: 'none', whiteSpace: 'nowrap',
              fontWeight: active ? 600 : 400,
              color: active ? 'var(--ink)' : 'var(--ink-quiet)',
              borderBottom: active ? '2px solid var(--gold)' : '2px solid transparent',
              marginBottom: -1,
            }}>{s.label}</Link>
        );
      })}
    </nav>
  );
}
