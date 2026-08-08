'use client';

import { useEffect, useState } from 'react';

/* The tabs on a venue page.
 *
 * Every panel is rendered on the server and in the HTML, so a crawler
 * reads all of it and a deep link opens the right one. Hiding a panel
 * behind a click that only JavaScript can make means a search engine
 * sees one tab out of eight.
 *
 * The hash drives it, so /wellness-venues/x#services can be linked to
 * and the back button works. */

export default function VenueTabs({
  tabs,
}: {
  tabs: { id: string; label: string; count?: number }[];
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

  // The panels are server-rendered siblings, so this shows one and hides
  // the rest rather than mounting anything.
  useEffect(() => {
    for (const t of tabs) {
      const panel = document.getElementById(`panel-${t.id}`);
      if (panel) panel.hidden = t.id !== active;
    }
  }, [active, tabs]);

  return (
    <div className="vtabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} type="button" role="tab"
          aria-selected={active === t.id}
          className={active === t.id ? 'is-on' : ''}
          onClick={() => {
            setActive(t.id);
            history.replaceState(null, '', `#${t.id}`);
          }}>
          {t.label}
          {t.count ? <span className="vtab-count">{t.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
