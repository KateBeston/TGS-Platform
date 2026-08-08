'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

/* The header, on every public page.
 *
 * Built once rather than per template. The mockups each carry their own
 * copy of it, which is how a nav item gets added to nine pages and
 * forgotten on the tenth. */

/* One listing page with a filter, rather than a page per marketplace.
 *
 * The mockup had /retreat-venues and /wellness-venues as separate
 * listings, which asks somebody to decide what they are before they have
 * looked at anything. The filter does the same job and lets them change
 * their mind without going back.
 *
 * The marketplace links still work — they land on /venues with the
 * filter already applied, so a link from the home page or an email
 * arrives where it means to. */
const NAV = {
  Discover: [
    { label: 'All venues', href: '/venues' },
    { label: 'Retreat venues', href: '/venues?marketplace=Retreat' },
    { label: 'Wellness venues', href: '/venues?marketplace=Wellness' },
    { label: 'Wellness experiences', href: '/wellness-experiences' },
  ],
  Learn: [
    { label: 'About us', href: '/about' },
    { label: 'How it works', href: '/how-it-works' },
    { label: 'The Wellness Edit', href: '/the-wellness-edit' },
  ],
  Connect: [
    { label: 'Contact us', href: '/contact' },
    { label: 'List your venue', href: '/list-your-venue' },
  ],
};

export default function SiteHeader() {
  const [open, setOpen] = useState(false);

  // A drawer that stays open when the page changes is a drawer somebody
  // has to close twice.
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, []);

  return (
    <>
      <a href="#main" className="skip">Skip to main content</a>

      <header className="site-header">
        <div className="wrap header-inner">
          <button type="button" className="menu-btn"
            aria-expanded={open} aria-controls="site-nav"
            onClick={() => setOpen(true)}>
            <span className="menu-lines" aria-hidden="true" />
            Menu
          </button>

          <Link href="/" className="wordmark">
            <span className="wordmark-name">The Global Sanctum</span>
            <span className="wordmark-line">
              Retreat spaces. Wellness experiences. Globally curated.
            </span>
          </Link>

          <Link href="/contact" className="btn-enquire">Enquire</Link>
        </div>
      </header>

      <div id="site-nav" className={`nav-drawer ${open ? 'is-open' : ''}`}
           role="dialog" aria-modal="true" aria-label="Navigation">
        <div className="nav-inner">
          <div className="nav-top">
            <span className="eyebrow">Navigation</span>
            <button type="button" className="nav-close" aria-label="Close navigation"
              onClick={() => setOpen(false)}>&times;</button>
          </div>

          {Object.entries(NAV).map(([group, items]) => (
            <div key={group} className="nav-group">
              <div className="nav-group-title">{group}</div>
              {items.map((i) => (
                <Link key={i.href} href={i.href} className="nav-link"
                      onClick={() => setOpen(false)}>
                  {i.label}<span aria-hidden="true">&rarr;</span>
                </Link>
              ))}
            </div>
          ))}

          <div className="nav-foot">
            <a href="mailto:hello@theglobalsanctum.com">hello@theglobalsanctum.com</a>
          </div>
        </div>
      </div>

      {open && (
        <div className="nav-scrim" onClick={() => setOpen(false)} aria-hidden="true" />
      )}
    </>
  );
}
