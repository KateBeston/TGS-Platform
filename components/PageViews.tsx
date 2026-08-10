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
    const query = params.toString();
    const path = pathname + (query ? `?${query}` : '');

    // GA4 dataLayer — skip the very first view (GTM's container load counts it).
    if (!first.current) {
      const w = window as any;
      w.dataLayer = w.dataLayer ?? [];
      w.dataLayer.push({
        event: 'page_view',
        page_path: path,
        page_title: document.title,
        page_location: window.location.href,
      });
    }

    // First-party page_views — every view, including the first, so landing
    // pages aren't undercounted. Fire-and-forget; never blocks the page.
    try {
      const existing = sessionStorage.getItem('tgs_sid');
      const sid: string = existing
        ?? ((self.crypto as any)?.randomUUID?.() ?? String(Math.random()).slice(2) + Date.now());
      if (!existing) sessionStorage.setItem('tgs_sid', sid);
      fetch('/api/pageview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, referrer: document.referrer || null, sessionId: sid }),
        keepalive: true,
      }).catch(() => {});
    } catch { /* sessionStorage unavailable — skip silently */ }

    first.current = false;
  }, [pathname, params]);

  return null;
}
