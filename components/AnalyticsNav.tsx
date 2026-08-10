'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ANALYTICS_TABS } from '@/lib/analyticsTabs';

export default function AnalyticsNav() {
  const path = usePathname();
  return (
    <nav style={{ display: 'flex', flexWrap: 'wrap', borderBottom: '1px solid var(--border)',
                  marginBottom: 'var(--s6)' }}>
      {ANALYTICS_TABS.map((t) => {
        const href = `/analytics/${t.slug}`;
        const on = path === href;
        return (
          <Link key={t.slug} href={href}
            style={{
              padding: '12px var(--s4)', fontSize: 13, letterSpacing: '.04em',
              textTransform: 'uppercase', textDecoration: 'none', whiteSpace: 'nowrap',
              fontWeight: on ? 600 : 400,
              color: on ? 'var(--ink)' : t.live ? 'var(--ink-quiet)' : 'var(--border-input)',
              borderBottom: on ? '2px solid var(--gold)' : '2px solid transparent',
              marginBottom: -1,
            }}>{t.label}</Link>
        );
      })}
    </nav>
  );
}
