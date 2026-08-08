'use client';

import { useEffect, useState } from 'react';

/* The sticky bar, carrying the venue name beside the tabs.
 *
 * Once somebody has scrolled past the hero the page loses its title, and
 * a tab bar that says nothing but "Overview · Spaces" could belong to
 * anything. The name sits to the left of the tabs for the whole scroll.
 *
 * Panels are server-rendered siblings; this shows one and hides the
 * rest. The hash drives it, so #spaces can be linked to and the back
 * button works. */

export default function VenueTabs({
  tabs, venueName, location,
}: {
  tabs: { id: string; label: string }[];
  venueName: string;
  location: string;
}) {
  const [active, setActive] = useState(tabs[0]?.id);

  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.replace('#', '');
      if (h && tabs.some((t) => t.id === h)) setActive(h);
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, [tabs]);

  useEffect(() => {
    for (const t of tabs) {
      const panel = document.getElementById(`panel-${t.id}`);
      if (panel) panel.hidden = t.id !== active;
    }
  }, [active, tabs]);

  return (
    <div className="tab-nav">
      <div className="tab-nav-wrap">
        <div className="tab-nav-inner" role="tablist">
          {tabs.map((t) => (
            <button key={t.id} type="button" role="tab"
              aria-selected={active === t.id}
              className={active === t.id ? 'is-on' : ''}
              onClick={() => {
                setActive(t.id);
                history.replaceState(null, '', `#${t.id}`);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
