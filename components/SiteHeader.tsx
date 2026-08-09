'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

/* The header, on every public page.
 *
 * Built once rather than per template. The mockups each carry their own
 * copy of it, which is how a nav item gets added to nine pages and
 * forgotten on the tenth.
 *
 * Visual is the v6 home mockup: the mandala emblem beside the wordmark
 * and tagline, a Menu affordance on the left and Enquire on the right,
 * with the full navigation in a left drawer.
 *
 * On the home page the bar sits transparent over the dark full-bleed
 * hero and turns solid once you scroll past it, as in the mockup. Every
 * other page keeps the solid bar: a transparent white nav only reads
 * over a dark hero, and on /legal or /contact there is none, so white
 * type on warm white would be invisible. Home opts in; the rest stay
 * solid. */

/* One listing page with a filter, rather than a page per marketplace.
 *
 * The mockup links to /retreat-venues and /wellness-venues, which are
 * not routes. They resolve to /venues with the marketplace filter
 * already applied, so the link lands where it means to. */
const DISCOVER = [
  { label: 'Retreat Venues', href: '/venues?marketplace=Retreat' },
  { label: 'Wellness Venues', href: '/venues?marketplace=Wellness' },
  { label: 'Wellness Experiences', href: '/wellness-experiences' },
];

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const overHero = pathname === '/';

  // On the home page the nav is transparent until you scroll past the
  // hero, then solid — matching the mockup's window.scrollY > hero - 80.
  // Everywhere else the nav is solid from the top, so this stays false.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    if (!overHero) { setScrolled(false); return; }
    const onScroll = () => {
      const hero = document.querySelector('.hero') as HTMLElement | null;
      const h = hero ? hero.offsetHeight : window.innerHeight;
      setScrolled(window.scrollY > h - 80);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [overHero]);

  const navClass = overHero
    ? `nav nav--over-hero${scrolled ? ' scrolled' : ''}`
    : 'nav';

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

  const close = () => setOpen(false);

  return (
    <>
      <a href="#main" className="skip-to-content">Skip to main content</a>

      <nav className={navClass}>
        <div className="nav-inner">
          <button type="button" className="nav-left"
            aria-expanded={open} aria-controls="site-drawer"
            aria-label="Open navigation" onClick={() => setOpen(true)}>
            <span className={`nav-hamburger ${open ? 'active' : ''}`} aria-hidden="true">
              <span /><span /><span />
            </span>
            <span className="nav-hamburger-label">Menu</span>
          </button>

          <Link href="/" className="nav-logo-area">
            <span className="nav-logo" aria-hidden="true" />
            <span className="nav-brand-stack">
              <span className="nav-brand-text">The Global Sanctum</span>
              <span className="nav-tagline">
                Retreat spaces. Wellness experiences. Globally curated.
              </span>
            </span>
          </Link>

          <div className="nav-right">
            <Link href="/contact" className="nav-enquire">Enquire</Link>
          </div>
        </div>
      </nav>

      <div className={`drawer-overlay ${open ? 'active' : ''}`}
           onClick={close} aria-hidden="true" />

      <div id="site-drawer" className={`drawer ${open ? 'active' : ''}`}
           role="dialog" aria-modal="true" aria-label="Navigation">
        <div className="drawer-header">
          <div className="drawer-header-left">
            <span className="drawer-logo" aria-hidden="true" />
            <span className="drawer-label">Navigation</span>
          </div>
          <button type="button" className="drawer-close" aria-label="Close menu"
            onClick={close}>&times;</button>
        </div>

        <div className="drawer-search">
          <div className="drawer-search-bar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
            <input type="text" aria-label="Search"
              placeholder="Search venues, experiences, locations..." />
          </div>
        </div>

        <div className="drawer-body">
          <div className="drawer-group">
            <div className="drawer-group-label">Discover</div>
            {DISCOVER.map((i) => (
              <Link key={i.href} href={i.href} className="drawer-link" onClick={close}>
                {i.label}<span className="drawer-link-arrow" aria-hidden="true">→</span>
              </Link>
            ))}
          </div>

          <div className="drawer-group">
            <div className="drawer-group-label">Learn</div>
            <Link href="/about" className="drawer-secondary-link" onClick={close}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
              About Us
            </Link>
            <Link href="/how-it-works" className="drawer-secondary-link" onClick={close}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              How It Works
            </Link>
            <Link href="/the-wellness-edit" className="drawer-secondary-link" onClick={close}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
              The Wellness Edit
            </Link>
          </div>

          <div className="drawer-group">
            <div className="drawer-group-label">Connect</div>
            <Link href="/contact" className="drawer-secondary-link" onClick={close}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
              Contact Us
            </Link>
            <Link href="/list-your-venue" className="drawer-secondary-link" onClick={close}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
              List Your Venue
            </Link>
          </div>

          <div className="drawer-group">
            <Link href="/list-your-venue" className="drawer-cta" onClick={close}>List Your Venue</Link>
          </div>
        </div>

        <div className="drawer-footer">
          <div className="drawer-footer-contact">
            <a href="mailto:hello@theglobalsanctum.com" className="drawer-footer-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
              hello@theglobalsanctum.com
            </a>
          </div>
          <div className="drawer-social">
            <a href="https://www.facebook.com/profile.php?id=61577706717526" target="_blank" rel="noopener" aria-label="Facebook"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg></a>
            <a href="https://www.instagram.com/theglobalsanctum/" target="_blank" rel="noopener" aria-label="Instagram"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" /></svg></a>
            <a href="https://www.linkedin.com/company/the-global-sanctum/" target="_blank" rel="noopener" aria-label="LinkedIn"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg></a>
            <a href="https://au.pinterest.com/07dse6hmjfvvrin3xbdulhd5g5nol7/" target="_blank" rel="noopener" aria-label="Pinterest"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z" /></svg></a>
          </div>
        </div>
      </div>
    </>
  );
}
