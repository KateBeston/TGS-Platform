'use client';

import { useEffect, useRef, useState } from 'react';

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
  const barRef = useRef<HTMLDivElement>(null);

  /* Where to land when a tab changes.
   *
   * It used to scroll to the very top of the page, which threw away the hero
   * and made every tab change feel like a page load. Landing at the tab bar
   * instead puts the first line of the new section directly beneath it, which
   * is where someone who just chose a section wants to start reading.
   *
   * The offset is read from --nav-h rather than hardcoded, so it stays correct
   * if the header height changes. */
  const scrollToSection = () => {
    const bar = barRef.current;
    if (!bar) return;
    const navH = parseInt(
      getComputedStyle(document.documentElement).getPropertyValue('--nav-h'),
      10,
    ) || 82;
    const top = bar.getBoundingClientRect().top + window.scrollY - navH;
    // Only move if the bar is not already sitting where it would land, so a
    // tab change from the top of the page does not jolt for no reason.
    if (Math.abs(window.scrollY - top) > 4) {
      window.scrollTo({ top, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.replace('#', '');
      if (h && tabs.some((t) => t.id === h)) setActive(h);
    };
    fromHash();
    /* A deep link such as #reviews should land in the same place a click does,
       not at whatever position the browser picked before the panel existed. */
    if (window.location.hash) {
      const id = window.location.hash.replace('#', '');
      if (tabs.some((t) => t.id === id)) {
        requestAnimationFrame(() => requestAnimationFrame(scrollToSection));
      }
    }
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
    <div className="tab-nav" ref={barRef}>
      <div className="tab-nav-wrap">
        <div className="tab-nav-inner" role="tablist">
          {tabs.map((t) => (
            <button key={t.id} type="button" role="tab"
              aria-selected={active === t.id}
              className={active === t.id ? 'is-on' : ''}
              onClick={() => {
                setActive(t.id);
                history.replaceState(null, '', `#${t.id}`);
                scrollToSection();
              }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
