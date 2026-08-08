'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

/* Page views on route changes.
 *
 * This is a single-page application: after the first load, navigation
 * replaces the content without a new document, and GA4 sees nothing. The
 * audit is explicit — without this it records only the landing page, so
 * every session looks like a bounce and no journey through the site is
 * visible at all.
 *
 * The first view is left to GTM's own container load, so it is not
 * counted twice.
 */

export default function PageViews() {
  const pathname = usePathname();
  const params = useSearchParams();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }

    const w = window as any;
    w.dataLayer = w.dataLayer ?? [];

    const query = params.toString();
    w.dataLayer.push({
      event: 'page_view',
      page_path: pathname + (query ? `?${query}` : ''),
      page_title: document.title,
      page_location: window.location.href,
    });
  }, [pathname, params]);

  return null;
}
