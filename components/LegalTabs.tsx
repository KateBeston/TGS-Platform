'use client';

import { useEffect, useState } from 'react';

/* Eight documents on one route.
 *
 * All eight are rendered into the HTML and hidden, so a crawler reads
 * every one and a deep link opens the right one. Seven policies that
 * only exist after JavaScript runs are seven policies nobody can find.
 *
 * Old anchors are accepted as well as slugs. /legal#privacy is linked
 * from four places on the site and from who knows how many sent emails,
 * and a link in an email cannot be rewritten. */

export default function LegalTabs({
  tabs, aliases,
}: {
  tabs: { slug: string; name: string }[];
  aliases: Record<string, string>;
}) {
  const [active, setActive] = useState(tabs[0]?.slug);

  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.replace('#', '');
      if (!h) return;
      const slug = aliases[h] ?? h;
      if (tabs.some((t) => t.slug === slug)) {
        setActive(slug);
        document.getElementById('legal-top')?.scrollIntoView({ behavior: 'smooth' });
      }
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, [tabs, aliases]);

  useEffect(() => {
    for (const t of tabs) {
      const panel = document.getElementById(`legal-${t.slug}`);
      if (panel) panel.hidden = t.slug !== active;
    }
  }, [active, tabs]);

  return (
    <div className="legal-tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.slug} type="button" role="tab"
          aria-selected={active === t.slug}
          className={active === t.slug ? 'is-on' : ''}
          onClick={() => {
            setActive(t.slug);
            history.replaceState(null, '', `#${t.slug}`);
          }}>
          {t.name}
        </button>
      ))}
    </div>
  );
}
