'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const ITEMS = [
  { href: '/settings', label: 'Catalogues', exact: true },
  { href: '/settings/catalogues/candidates', label: 'Unrecognised amenities' },
  { href: '/settings/catalogues/practices', label: 'Practices to review' },
  { href: '/settings/holidays', label: 'Public holidays' },
  { href: '/settings/users', label: 'People' },
  { href: '/account', label: 'My account' },
];

/** Settings collapses to one line until you need it. Opens automatically
 *  when you are already inside one of its pages, so navigating there from
 *  elsewhere never leaves the menu closed behind you. */
export default function SettingsNav() {
  const path = usePathname();
  const inside = path.startsWith('/settings') || path.startsWith('/account');
  const [open, setOpen] = useState(inside);
  const expanded = open || inside;

  return (
    <>
      <button
        className={`nav-item nav-toggle ${expanded ? 'active' : ''}`}
        aria-expanded={expanded}
        onClick={() => setOpen(!expanded)}
      >
        <span>Settings</span>
        <span className="count" aria-hidden="true">{expanded ? '−' : '+'}</span>
      </button>

      {expanded && ITEMS.map((i) => {
        const on = i.exact ? path === i.href : path.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href}
                className={`nav-item nav-sub ${on ? 'active' : ''}`}>
            <span>{i.label}</span>
          </Link>
        );
      })}
    </>
  );
}
